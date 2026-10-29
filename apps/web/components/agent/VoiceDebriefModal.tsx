'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Square,
  Loader2,
  MessageSquare,
  X,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

interface ConnectionOption {
  id: string;
  name: string;
  partner_id: string;
}

interface VoiceDebriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  connections?: ConnectionOption[];
  onDebriefComplete?: (data: { transcript: string; reflection: string; partnerName: string }) => void;
}

const MAX_DURATION_SECONDS = 90;

export function VoiceDebriefModal({ isOpen, onClose, connections = [], onDebriefComplete }: VoiceDebriefModalProps) {
  const [phase, setPhase] = useState<'select' | 'record' | 'processing' | 'reflection'>('select');
  const [selectedConnection, setSelectedConnection] = useState<ConnectionOption | null>(null);
  const [customPartnerName, setCustomPartnerName] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [reflection, setReflection] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedRef = useRef(0);

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      stopRecordingCleanup();
    };
  }, []);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setPhase('select');
      setSelectedConnection(null);
      setCustomPartnerName('');
      setReflection(null);
      setTranscript(null);
      setError(null);
      setElapsed(0);
    }
  }, [isOpen]);

  const stopRecordingCleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    setError(null);
    chunksRef.current = [];
    elapsedRef.current = 0;
    setElapsed(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        processRecording();
      };

      recorder.start(250);
      setIsRecording(true);

      // Timer with auto-stop at 90 seconds
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);

        if (elapsedRef.current >= MAX_DURATION_SECONDS) {
          stopRecording();
        }
      }, 1000);
    } catch (err) {
      setError('Microphone access denied. Please allow microphone permissions.');
      console.error('[VoiceDebrief] Mic error:', err);
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const processRecording = async () => {
    setPhase('processing');

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    if (blob.size < 1000) {
      setError('Recording was too short. Please try again.');
      setPhase('record');
      return;
    }

    const partnerName = selectedConnection?.name || customPartnerName || 'partner';

    const formData = new FormData();
    formData.append('audioFile', blob, `debrief-${Date.now()}.webm`);
    formData.append('durationSeconds', String(elapsedRef.current));
    formData.append('partnerName', partnerName);
    if (selectedConnection?.id) {
      formData.append('connectionId', selectedConnection.id);
    }

    try {
      const res = await fetch('/api/agent/v2/voice-debrief', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Processing failed' }));
        if (errData.error === 'no_speech_detected') {
          setError(errData.message || 'No speech detected. Try again closer to the mic.');
          setPhase('record');
          return;
        }
        throw new Error(errData.error || 'Processing failed');
      }

      const data = await res.json();
      setTranscript(data.transcript || null);
      setReflection(data.reflection || 'I\u2019m holding this — let me reflect more deeply next time.');
      setPhase('reflection');
    } catch (err: any) {
      console.error('[VoiceDebrief] Processing error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
      setPhase('record');
      toast.error('Voice debrief processing failed');
    }
  };

  const progressPercent = (elapsed / MAX_DURATION_SECONDS) * 100;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="voice-debrief-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs"
      />

      {/* Modal */}
      <motion.div
        key="voice-debrief-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          className="relative w-full max-w-lg rounded-3xl border border-[#E6DFD5] bg-[#FAF7F2] shadow-2xl font-sans overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#EAE3D9] bg-[#F5EFEB] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8f4d30] text-white shadow-xs">
                <MessageSquare size={15} />
              </div>
              <div>
                <h3 className="font-serif text-base font-semibold text-[#2E2012]">
                  Voice Debrief
                </h3>
                <p className="text-xs text-[#7A5A3A]">
                  Process a conversation with a partner
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#7A5A3A] hover:bg-black/5 hover:text-[#2E2012] transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4 min-h-[280px]">
            {/* ── Phase 1: Select Partner ── */}
            {phase === 'select' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                <p className="text-sm text-[#5C3E21] leading-relaxed">
                  Just had a meaningful conversation? Record a 90-second reflection and
                  Force will surface what it notices — patterns, emotional undertones,
                  and what might be worth exploring further.
                </p>

                {connections.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[#2E2012] flex items-center gap-1.5">
                      <Users size={13} className="text-[#8f4d30]" />
                      Select a Force connection
                    </label>
                    <div className="grid gap-2">
                      {connections.map((conn, index) => (
                        <button
                          key={`connection-${conn.id || conn.partner_id || 'unknown'}-${index}`}
                          onClick={() => {
                            setSelectedConnection(conn);
                            setCustomPartnerName('');
                          }}
                          className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition-all cursor-pointer ${
                            selectedConnection?.id === conn.id
                              ? 'border-[#8f4d30] bg-[#8f4d30]/8 text-[#2E2012]'
                              : 'border-[#E6DFD5] bg-white/60 text-[#5C3E21] hover:border-[#D7C8B8]'
                          }`}
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8f4d30]/10 text-[#8f4d30] text-xs font-semibold shrink-0">
                            {conn.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{conn.name}</span>
                          {selectedConnection?.id === conn.id && (
                            <CheckCircle2 size={15} className="ml-auto text-[#8f4d30]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#2E2012]">
                    {connections.length > 0 ? 'Or type a name' : 'Who did you talk to?'}
                  </label>
                  <input
                    type="text"
                    value={customPartnerName}
                    onChange={(e) => {
                      setCustomPartnerName(e.target.value);
                      if (e.target.value.trim()) setSelectedConnection(null);
                    }}
                    placeholder="e.g. Sarah, Mom, my manager..."
                    className="w-full rounded-xl border border-[#E6DFD5] bg-white/60 px-4 py-2.5 text-sm text-[#2E2012] placeholder:text-[#B8A89A] focus:border-[#8f4d30] focus:outline-none focus:ring-1 focus:ring-[#8f4d30]/30 transition-all"
                  />
                </div>

                <button
                  onClick={() => setPhase('record')}
                  disabled={!selectedConnection && !customPartnerName.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#8f4d30] px-4 py-3 text-sm font-medium text-white hover:bg-[#723c24] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
                >
                  <Mic size={15} />
                  <span>Start Recording</span>
                </button>
              </motion.div>
            )}

            {/* ── Phase 2: Record ── */}
            {phase === 'record' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-5 flex flex-col items-center pt-2"
              >
                <div className="text-center space-y-1">
                  <p className="text-xs text-[#7A5A3A] font-medium">
                    Reflecting on conversation with{' '}
                    <strong className="text-[#2E2012]">
                      {selectedConnection?.name || customPartnerName}
                    </strong>
                  </p>
                  <p className="text-[11px] text-[#B8A89A]">
                    Speak naturally — what happened, how did it feel, what stuck with you
                  </p>
                </div>

                {error && (
                  <div className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
                    {error}
                  </div>
                )}

                {/* Timer Ring */}
                <div className="relative flex items-center justify-center">
                  <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="#EAE3D9"
                      strokeWidth="4"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke={elapsed >= 80 ? '#dc2626' : '#8f4d30'}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 54}`}
                      strokeDashoffset={`${2 * Math.PI * 54 * (1 - progressPercent / 100)}`}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-2xl font-mono font-bold text-[#2E2012]">
                      {formatTime(elapsed)}
                    </span>
                    <span className="text-[10px] text-[#7A5A3A] mt-0.5">
                      / {formatTime(MAX_DURATION_SECONDS)}
                    </span>
                  </div>
                </div>

                {/* Recording Controls */}
                <div className="flex items-center gap-4">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-[#8f4d30] text-white shadow-lg hover:bg-[#723c24] transition-all cursor-pointer hover:scale-105"
                    >
                      <Mic size={22} />
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 transition-all cursor-pointer hover:scale-105 animate-pulse"
                    >
                      <Square size={20} />
                    </button>
                  )}
                </div>

                {isRecording && (
                  <p className="text-xs text-[#8f4d30] font-medium flex items-center gap-1.5 animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    Listening...
                  </p>
                )}

                {!isRecording && elapsed === 0 && (
                  <p className="text-xs text-[#7A5A3A]">Tap to start recording</p>
                )}
              </motion.div>
            )}

            {/* ── Phase 3: Processing ── */}
            {phase === 'processing' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-10 space-y-4"
              >
                <div className="relative">
                  <Loader2 size={32} className="animate-spin text-[#8f4d30]" />
                  <Sparkles
                    size={14}
                    className="absolute -top-1 -right-1 text-[#8f4d30] animate-pulse"
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-serif font-medium text-[#2E2012]">
                    Processing your reflection...
                  </p>
                  <p className="text-xs text-[#7A5A3A]">
                    Transcribing voice · Connecting to memory · Generating reflection
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── Phase 4: Reflection ── */}
            {phase === 'reflection' && reflection && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Transcript preview */}
                {transcript && (
                  <div className="rounded-xl border border-[#E6DFD5] bg-white/50 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#7A5A3A] font-medium">
                      <Clock size={11} />
                      <span>Your reflection ({formatTime(elapsed)})</span>
                    </div>
                    <p className="text-xs text-[#5C3E21] leading-relaxed line-clamp-3 italic">
                      &ldquo;{transcript}&rdquo;
                    </p>
                  </div>
                )}

                {/* Agent reflection */}
                <div className="rounded-2xl border border-[#8f4d30]/20 bg-[#8f4d30]/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#8f4d30]">
                    <Sparkles size={13} />
                    <span>Force's reflection</span>
                  </div>
                  <div className="text-sm text-[#2E2012] leading-relaxed prose prose-sm prose-stone">
                    <ReactMarkdown>{reflection}</ReactMarkdown>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    onClick={() => {
                      setPhase('select');
                      setElapsed(0);
                      setReflection(null);
                      setTranscript(null);
                    }}
                    className="flex-1 rounded-xl border border-[#E6DFD5] bg-white/60 px-4 py-2.5 text-xs font-medium text-[#5C3E21] hover:bg-[#F5EFEB] transition-all cursor-pointer"
                  >
                    Record Another
                  </button>
                  <button
                    onClick={() => {
                      if (onDebriefComplete && transcript && reflection) {
                        onDebriefComplete({
                          transcript,
                          reflection,
                          partnerName: selectedConnection?.name || customPartnerName || 'Partner',
                        });
                      }
                      onClose();
                    }}
                    className="flex-1 rounded-xl bg-[#8f4d30] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#723c24] transition-all cursor-pointer shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

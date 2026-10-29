import { useEffect, useRef, useState } from 'react';

export type VoiceRecordingState = 'idle' | 'recording' | 'recorded';

interface UseVoiceRecordingOptions {
  onRecordingSignature: (signature: string) => void;
  onError: (message: string) => void;
}

export function useVoiceRecording({ onRecordingSignature, onError }: UseVoiceRecordingOptions) {
  const [voiceRecordingState, setVoiceRecordingState] = useState<VoiceRecordingState>('idle');
  const [isVoicePlaying, setIsVoicePlaying] = useState<boolean>(false);
  const [voiceElapsedSeconds, setVoiceElapsedSeconds] = useState<number>(0);
  const [voiceDurationSeconds, setVoiceDurationSeconds] = useState<number>(0);
  const [voiceCurrentSeconds, setVoiceCurrentSeconds] = useState<number>(0);
  const [recordedVoiceFile, setRecordedVoiceFile] = useState<File | null>(null);
  const [recordedVoiceUrl, setRecordedVoiceUrl] = useState<string | null>(null);
  const [newlyRecordedFile, setNewlyRecordedFile] = useState<File | null>(null);
  const [voiceStream, setVoiceStream] = useState<MediaStream | null>(null);

  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<BlobPart[]>([]);
  const voiceRecordingTickRef = useRef<NodeJS.Timeout | null>(null);
  const voiceElapsedRef = useRef<number>(0);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);

  const formatSeconds = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getVoiceFileSignature = (file: File, durationSec: number): string => {
    return `${file.name}:${file.size}:${file.type}:${file.lastModified}:${durationSec}`;
  };

  const revokeVoiceObjectUrl = (url: string | null) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  };

  const clearVoiceRecordingTimer = () => {
    if (voiceRecordingTickRef.current) {
      clearInterval(voiceRecordingTickRef.current);
      voiceRecordingTickRef.current = null;
    }
  };

  const stopActiveStream = () => {
    if (voiceStreamRef.current) {
      voiceStreamRef.current.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
      setVoiceStream(null);
    }
  };

  const startVoiceRecording = async () => {
    if (voiceRecordingState === 'recording') {
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      onError('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128000 });

      voiceChunksRef.current = [];
      voiceElapsedRef.current = 0;
      setVoiceElapsedSeconds(0);
      setVoiceRecordingState('recording');
      setIsVoicePlaying(false);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearVoiceRecordingTimer();

        const blob = new Blob(voiceChunksRef.current, { type: 'audio/webm' });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace(/T/g, '_');
        const file = new File([blob], `voice_note_${timestamp}.webm`, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(blob);

        setRecordedVoiceFile(file);
        setNewlyRecordedFile(file);
        revokeVoiceObjectUrl(recordedVoiceUrl);
        setRecordedVoiceUrl(audioUrl);

        const duration = voiceElapsedRef.current > 0 ? voiceElapsedRef.current : 1;
        setVoiceDurationSeconds(duration);
        setVoiceCurrentSeconds(0);
        setVoiceRecordingState('recorded');

        const signature = getVoiceFileSignature(file, duration);
        onRecordingSignature(signature);

        stopActiveStream();
      };

      voiceRecorderRef.current = recorder;
      voiceStreamRef.current = stream;
      setVoiceStream(stream);
      recorder.start();

      voiceRecordingTickRef.current = setInterval(() => {
        voiceElapsedRef.current += 1;
        setVoiceElapsedSeconds(voiceElapsedRef.current);
      }, 1000);
    } catch (error) {
      console.error('Voice recording start failed:', error);
      onError('Microphone access failed. Please allow microphone permission.');
      setVoiceRecordingState('idle');
      clearVoiceRecordingTimer();
      stopActiveStream();
    }
  };

  const stopVoiceRecording = () => {
    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
      voiceRecorderRef.current.stop();
    }
  };

  const handleVoicePlayPause = () => {
    if (!voiceAudioRef.current) return;

    if (isVoicePlaying) {
      voiceAudioRef.current.pause();
      setIsVoicePlaying(false);
      return;
    }

    void voiceAudioRef.current.play();
    setIsVoicePlaying(true);
  };

  const handleVoiceSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.target.value);
    setVoiceCurrentSeconds(nextTime);
    if (voiceAudioRef.current) {
      voiceAudioRef.current.currentTime = nextTime;
    }
  };

  const onAudioTimeUpdate = () => {
    if (voiceAudioRef.current) {
      setVoiceCurrentSeconds(Math.floor(voiceAudioRef.current.currentTime));
    }
  };

  const onAudioEnded = () => {
    setIsVoicePlaying(false);
  };

  const onAudioLoadedMetadata = () => {
    if (voiceAudioRef.current) {
      const metaDuration = Math.floor(voiceAudioRef.current.duration || 0);
      if (metaDuration > 0) setVoiceDurationSeconds(metaDuration);
    }
  };

  const clearNewlyRecordedFile = () => {
    setNewlyRecordedFile(null);
  };

  const setRecordedAudioFromUrl = (url: string) => {
    setRecordedVoiceFile(null);
    setRecordedVoiceUrl(url);
    setVoiceRecordingState('recorded');
    setVoiceCurrentSeconds(0);
    setIsVoicePlaying(false);
  };

  const resetVoiceRecording = () => {
    clearVoiceRecordingTimer();
    stopActiveStream();
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current.currentTime = 0;
    }

    voiceElapsedRef.current = 0;
    setVoiceRecordingState('idle');
    setIsVoicePlaying(false);
    setVoiceElapsedSeconds(0);
    setVoiceDurationSeconds(0);
    setVoiceCurrentSeconds(0);
    setRecordedVoiceFile(null);
    setNewlyRecordedFile(null);
    revokeVoiceObjectUrl(recordedVoiceUrl);
    setRecordedVoiceUrl(null);
    setVoiceStream(null);
  };

  useEffect(() => {
    return () => {
      clearVoiceRecordingTimer();
      stopActiveStream();
      revokeVoiceObjectUrl(recordedVoiceUrl);
    };
  }, [recordedVoiceUrl]);

  return {
    voiceRecordingState,
    isVoicePlaying,
    voiceElapsedSeconds,
    voiceDurationSeconds,
    voiceCurrentSeconds,
    recordedVoiceFile,
    recordedVoiceUrl,
    newlyRecordedFile,
    voiceAudioRef,
    setRecordedVoiceFile,
    formatSeconds,
    getVoiceFileSignature,
    startVoiceRecording,
    stopVoiceRecording,
    handleVoicePlayPause,
    handleVoiceSeek,
    onAudioTimeUpdate,
    onAudioEnded,
    onAudioLoadedMetadata,
    clearNewlyRecordedFile,
    setRecordedAudioFromUrl,
    resetVoiceRecording,
    voiceStream,
  };
}

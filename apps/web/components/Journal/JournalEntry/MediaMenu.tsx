'use client'

import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Volume2, Mic, Video, FileText, FileIcon, StopCircle, Layers, type LucideIcon } from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';

interface MediaMenuProps {
  onFileSelect: (files: FileList | null, type: 'image' | 'audio' | 'video' | 'document') => void;
  onRequestOCR?: () => void;
  disabled?: boolean;
}

function audioBufferToWAV(buffer: AudioBuffer): Promise<Blob> {
  return new Promise((resolve) => {
    const numOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numOfChannels * 2;
    const sampleRate = buffer.sampleRate;

    const audioData = new ArrayBuffer(44 + length);
    const view = new DataView(audioData);

    writeUTFBytes(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeUTFBytes(view, 8, 'WAVE');

    writeUTFBytes(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numOfChannels * 2, true);
    view.setUint16(32, numOfChannels * 2, true);
    view.setUint16(34, 16, true);

    writeUTFBytes(view, 36, 'data');
    view.setUint32(40, length, true);

    const data = new Float32Array(buffer.getChannelData(0));
    let offset = 44;

    for (let i = 0; i < data.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, data[i] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }

    resolve(new Blob([view], { type: 'audio/wav' }));
  });
}

function writeUTFBytes(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i += 1) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

const MediaMenu: React.FC<MediaMenuProps> = ({ onFileSelect, onRequestOCR, disabled = false }) => {
  const { isDarkMode } = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null);

  const fileInputRefs = {
    image: useRef<HTMLInputElement>(null),
    audio: useRef<HTMLInputElement>(null),
    video: useRef<HTMLInputElement>(null),
    document: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const recorder = new MediaRecorder(stream, {
        audioBitsPerSecond: 128000,
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const webmBlob = new Blob(chunks, { type: 'audio/webm' });

        try {
          const audioContext = new AudioContext();
          const arrayBuffer = await webmBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          const wavBlob = await audioBufferToWAV(audioBuffer);
          const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-').replace(/T/g, '_');
          const file = new File([wavBlob], `recording_${timestamp}.wav`, { type: 'audio/wav' });
          const container = new DataTransfer();
          container.items.add(file);
          onFileSelect(container.files, 'audio');
        } catch (error) {
          console.error('Error converting audio format:', error);
          const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-').replace(/T/g, '_');
          const file = new File([webmBlob], `recording_${timestamp}.webm`, { type: 'audio/webm' });
          const container = new DataTransfer();
          container.items.add(file);
          onFileSelect(container.files, 'audio');
        } finally {
          setIsRecording(false);
        }
      };

      recorder.start();
      setAudioRecorder(recorder);
      setIsRecording(true);
      setIsOpen(false);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access your microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (audioRecorder) {
      audioRecorder.stop();
      audioRecorder.stream.getTracks().forEach((track) => track.stop());
      setAudioRecorder(null);
    }
  };

  const handleButtonClick = (type: 'image' | 'audio' | 'video' | 'document') => {
    if (disabled || isRecording) return;
    fileInputRefs[type].current?.click();
    setIsOpen(false);
  };

  const handleOCR = () => {
    if (disabled || isRecording) return;
    setIsOpen(false);
    onRequestOCR?.();
  };

  const menuItems = [
    { id: 'image', label: 'Upload Images', icon: ImageIcon, action: () => handleButtonClick('image') },
    { id: 'audio', label: 'Upload Audio File', icon: Volume2, action: () => handleButtonClick('audio') },
    { id: 'record', label: 'Record Audio', icon: Mic, action: startRecording },
    { id: 'video', label: 'Upload Videos', icon: Video, action: () => handleButtonClick('video') },
    { id: 'document', label: 'Upload Document', icon: FileText, action: () => handleButtonClick('document') },
    onRequestOCR
      ? { id: 'ocr', label: 'Extract Text (OCR)', icon: FileIcon, action: handleOCR }
      : null,
    {
      id: 'bulk',
      label: 'Bulk Import (Multiple Pages)',
      icon: Layers,
      action: () => {
        setIsOpen(false);
        window.location.href = '/journal/new?mode=writeBulkImport';
      },
    },
  ].filter(Boolean) as Array<{ id: string; label: string; icon: LucideIcon; action: () => void }>;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={disabled || isRecording}
        data-guide-target="journal-add-files"
        className="flex h-10 w-10 items-center justify-center rounded-full border text-lg font-light transition-colors"
        style={{
          borderColor: isDarkMode ? '#4B5563' : '#E5E7EB',
          backgroundColor: disabled || isRecording
            ? (isDarkMode ? '#374151' : '#F3F4F6')
            : (isDarkMode ? '#1F2937' : '#FFFFFF'),
          color: disabled || isRecording ? (isDarkMode ? '#9CA3AF' : '#9CA3AF') : (isDarkMode ? '#F9FAFB' : '#111827'),
          cursor: disabled || isRecording ? 'not-allowed' : 'pointer',
        }}
        aria-label="Add media"
      >
        +
      </button>

      {isOpen && (
        <div
          className="absolute bottom-12 left-0 z-50 w-56 rounded-xl border p-2 shadow-lg"
          style={{
            backgroundColor: isDarkMode ? '#1F2937' : '#FFFFFF',
            borderColor: isDarkMode ? '#374151' : '#E5E7EB',
          }}
        >
          {menuItems.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                onClick={option.action}
                data-guide-target={option.id === 'ocr' ? 'journal-ocr-menu' : undefined}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors"
                style={{ color: isDarkMode ? '#F3F4F6' : '#111827' }}
              >
                <span style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                  <Icon className="h-4 w-4" />
                </span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {isRecording && (
        <button
          type="button"
          onClick={stopRecording}
          className="mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
          style={{
            borderColor: isDarkMode ? '#7F1D1D' : '#FCA5A5',
            backgroundColor: isDarkMode ? '#3F1D1D' : '#FEE2E2',
            color: isDarkMode ? '#FCA5A5' : '#991B1B',
          }}
        >
          <StopCircle size={14} className="animate-pulse" />
          Stop Recording
        </button>
      )}

      <input
        ref={fileInputRefs.image}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={(event) => {
          onFileSelect(event.target.files, 'image');
          event.target.value = '';
        }}
        className="hidden"
        multiple
        disabled={disabled || isRecording}
      />
      <input
        ref={fileInputRefs.audio}
        type="file"
        accept="audio/*"
        onChange={(event) => {
          onFileSelect(event.target.files, 'audio');
          event.target.value = '';
        }}
        className="hidden"
        multiple
        disabled={disabled || isRecording}
      />
      <input
        ref={fileInputRefs.video}
        type="file"
        accept="video/*"
        onChange={(event) => {
          onFileSelect(event.target.files, 'video');
          event.target.value = '';
        }}
        className="hidden"
        multiple
        disabled={disabled || isRecording}
      />
      <input
        ref={fileInputRefs.document}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        onChange={(event) => {
          onFileSelect(event.target.files, 'document');
          event.target.value = '';
        }}
        className="hidden"
        multiple
        disabled={disabled || isRecording}
      />
    </div>
  );
};

export default MediaMenu;
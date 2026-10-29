import React, { useEffect, useRef, useState } from 'react';
import { Image, Mic, FileText, Film, StopCircle, MoreVertical, Upload } from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';

// Add helper function for WAV conversion 
function audioBufferToWAV(buffer: AudioBuffer): Promise<Blob> {
  return new Promise(resolve => {
    const numOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numOfChannels * 2;
    const sampleRate = buffer.sampleRate;
    
    // Create the WAV file
    const audioData = new ArrayBuffer(44 + length);
    const view = new DataView(audioData);
    
    // RIFF chunk descriptor
    writeUTFBytes(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeUTFBytes(view, 8, 'WAVE');
    
    // FMT sub-chunk
    writeUTFBytes(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numOfChannels * 2, true);
    view.setUint16(32, numOfChannels * 2, true);
    view.setUint16(34, 16, true);
    
    // Data sub-chunk
    writeUTFBytes(view, 36, 'data');
    view.setUint32(40, length, true);
    
    // Write the PCM samples
    const data = new Float32Array(buffer.getChannelData(0));
    let offset = 44;
    
    for (let i = 0; i < data.length; i++) {
      const s = Math.max(-1, Math.min(1, data[i] || 0));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    } 
    
    resolve(new Blob([view], { type: 'audio/wav' }));
  });
}

function writeUTFBytes(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

interface MediaSelectorProps {
  onFileSelect: (files: FileList | null, type: 'image' | 'audio' | 'video' | 'document') => void;
  disabled?: boolean;
  onRequestOCR?: () => void;
  compact?: boolean;
}

const MediaSelector: React.FC<MediaSelectorProps> = ({
  onFileSelect,
  disabled = false,
  onRequestOCR,
  compact = false
}) => {
  const unifiedInputRef = useRef<HTMLInputElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRefs = {
    image: useRef<HTMLInputElement>(null),
    audio: useRef<HTMLInputElement>(null),
    video: useRef<HTMLInputElement>(null),
    document: useRef<HTMLInputElement>(null),
  };

  const [isRecording, setIsRecording] = useState(false);
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  
  // Get theme from context
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setShowActionMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getFileCategory = (file: File): 'image' | 'audio' | 'video' | 'document' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('video/')) return 'video';

    // Some browsers/devices leave MIME empty for HEIC/HEIF files.
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'heic' || extension === 'heif') return 'image';

    return 'document';
  };

  const dispatchByType = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const grouped = {
      image: new DataTransfer(),
      audio: new DataTransfer(),
      video: new DataTransfer(),
      document: new DataTransfer(),
    };

    Array.from(files).forEach((file) => {
      const category = getFileCategory(file);
      grouped[category].items.add(file);
    });

    (Object.keys(grouped) as Array<'image' | 'audio' | 'video' | 'document'>).forEach((type) => {
      if (grouped[type].files.length > 0) {
        onFileSelect(grouped[type].files, type);
      }
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Use higher quality audio settings for better analysis results
      const recorder = new MediaRecorder(stream, {
        audioBitsPerSecond: 128000,
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 
          'audio/webm;codecs=opus' : 'audio/webm'
      });
      
      const chunks: BlobPart[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        // Create a more compatible audio format - MP3 is more widely supported
        // First create the initial blob from recording chunks
        const webmBlob = new Blob(chunks, { type: 'audio/webm' });
        
        try {
          // Convert to WAV format which is better supported by most audio analysis APIs
          const audioContext = new AudioContext();
          const arrayBuffer = await webmBlob.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Convert AudioBuffer to WAV format
          const wavBlob = await audioBufferToWAV(audioBuffer);
          
          // Create a proper file with a .wav extension
          // Use a safe filename format without special characters like colons that cause file system issues
          const timestamp = new Date().toISOString()
            .replace(/:/g, '-')     // Replace colons with hyphens
            .replace(/\./g, '-')    // Replace periods with hyphens
            .replace(/T/g, '_');    // Replace T with underscore
          
          const file = new File([wavBlob], `recording_${timestamp}.wav`, { 
            type: 'audio/wav'
          });
          
          // Create a FileList-like object
          const container = new DataTransfer();
          container.items.add(file);
          onFileSelect(container.files, 'audio');
        } catch (err) {
          console.error('Error converting audio format:', err);
          // Fallback to original format if conversion fails
          const timestamp = new Date().toISOString()
            .replace(/:/g, '-')     // Replace colons with hyphens
            .replace(/\./g, '-')    // Replace periods with hyphens
            .replace(/T/g, '_');    // Replace T with underscore
            
          const file = new File([webmBlob], `recording_${timestamp}.webm`, { 
            type: 'audio/webm'
          });
          const container = new DataTransfer();
          container.items.add(file);
          onFileSelect(container.files, 'audio');
        } finally {
          // Clean up
          setIsRecording(false);
        }
      };
      
      recorder.start();
      setAudioRecorder(recorder);
      setIsRecording(true);
      setShowActionMenu(false);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access your microphone. Please check your permissions.');
    }
  };
  
  // Function to stop recording
  const stopRecording = () => {
    if (audioRecorder) {
      audioRecorder.stop();
      // Stop all tracks in the stream
      audioRecorder.stream.getTracks().forEach(track => track.stop());
      setAudioRecorder(null);
    }
  };

  const handleButtonClick = (type: 'image' | 'audio' | 'video' | 'document') => {
    if (disabled) return;

    if (fileInputRefs[type]?.current) {
      fileInputRefs[type].current!.click();
    }
    setShowActionMenu(false);
  };

  const handleUnifiedAddFiles = () => {
    if (disabled || isRecording) return;
    unifiedInputRef.current?.click();
  };

  return (
    <div className={`flex items-center gap-2 rounded-lg p-1.5 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
      <button
        onClick={handleUnifiedAddFiles}
        disabled={disabled || isRecording}
        data-guide-target="journal-add-files"
        className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
        style={{
          borderColor: isDarkMode ? '#4B5563' : '#CBD5E1',
          backgroundColor: disabled || isRecording ? (isDarkMode ? '#374151' : '#E5E7EB') : (isDarkMode ? '#111827' : '#FFFFFF'),
          color: disabled || isRecording ? (isDarkMode ? '#9CA3AF' : '#94A3B8') : (isDarkMode ? '#E5E7EB' : '#334155'),
          cursor: disabled || isRecording ? 'not-allowed' : 'pointer'
        }}
      >
        <Upload size={16} />
        {!compact && 'Add Files'}
      </button>

      <input
        ref={unifiedInputRef}
        type="file"
        accept="image/*,.heic,.heif,audio/*,video/*,.pdf,.doc,.docx,.txt"
        className="hidden"
        multiple
        disabled={disabled || isRecording}
        onChange={(e) => {
          dispatchByType(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="relative" ref={menuContainerRef}>
        <button
          onClick={() => setShowActionMenu((prev) => !prev)}
          disabled={disabled}
          data-guide-target="journal-ocr-menu"
          className="rounded-md border p-2 transition-colors"
          style={{
            borderColor: isDarkMode ? '#4B5563' : '#CBD5E1',
            backgroundColor: disabled ? (isDarkMode ? '#374151' : '#E5E7EB') : (isDarkMode ? '#111827' : '#FFFFFF'),
            color: disabled ? (isDarkMode ? '#9CA3AF' : '#94A3B8') : (isDarkMode ? '#CBD5E1' : '#64748B'),
            cursor: disabled ? 'not-allowed' : 'pointer'
          }}
          aria-label="More upload options"
        >
          <MoreVertical size={16} />
        </button>

        {showActionMenu && !disabled && (
          <div
            className={`absolute left-0 top-11 z-20 min-w-52.5 rounded-md border p-1.5 shadow-lg ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
          >
            <button
              onClick={() => handleButtonClick('image')}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <Image size={15} /> Upload Images
            </button>
            <button
              onClick={() => handleButtonClick('audio')}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <FileText size={15} /> Upload Audio File
            </button>
            <button
              onClick={startRecording}
              disabled={isRecording}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${isRecording ? 'opacity-60' : ''}`}
            >
              <Mic size={15} /> Record Audio
            </button>
            <button
              onClick={() => handleButtonClick('video')}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <Film size={15} /> Upload Videos
            </button>
            <button
              onClick={() => handleButtonClick('document')}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <FileText size={15} /> Upload Documents
            </button>
            {onRequestOCR && (
              <button
                onClick={() => {
                  setShowActionMenu(false);
                  onRequestOCR();
                }}
                data-guide-target="journal-ocr-menu"
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <FileText size={15} /> Extract Text (OCR)
              </button>
            )}
          </div>
        )}
      </div>

      {isRecording && (
        <button
          onClick={stopRecording}
          className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-medium"
          style={{
            borderColor: isDarkMode ? '#7F1D1D' : '#FCA5A5',
            backgroundColor: isDarkMode ? '#3F1D1D' : '#FEE2E2',
            color: isDarkMode ? '#FCA5A5' : '#991B1B'
          }}
          aria-label="Stop recording"
        >
          <StopCircle size={14} className="animate-pulse" />
          Stop Recording
        </button>
      )}

      <input
        ref={fileInputRefs.image}
        type="file"
        accept="image/*,.heic,.heif"
        onChange={(e) => {
          onFileSelect(e.target.files, 'image');
          e.target.value = '';
        }}
        className="hidden"
        multiple
        disabled={disabled || isRecording}
      />
      <input
        ref={fileInputRefs.audio}
        type="file"
        accept="audio/*"
        onChange={(e) => {
          onFileSelect(e.target.files, 'audio');
          e.target.value = '';
        }}
        className="hidden"
        multiple
        disabled={disabled || isRecording}
      />
      <input
        ref={fileInputRefs.video}
        type="file"
        accept="video/*"
        onChange={(e) => {
          onFileSelect(e.target.files, 'video');
          e.target.value = '';
        }}
        className="hidden"
        multiple
        disabled={disabled || isRecording}
      />
      <input
        ref={fileInputRefs.document}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        onChange={(e) => {
          onFileSelect(e.target.files, 'document');
          e.target.value = '';
        }}
        className="hidden"
        multiple
        disabled={disabled || isRecording}
      />

      {isRecording && (
        <span className="ml-1 flex items-center gap-2 text-xs text-red-500">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
          Recording...
        </span>
      )}
    </div>
  );
};

export default MediaSelector;
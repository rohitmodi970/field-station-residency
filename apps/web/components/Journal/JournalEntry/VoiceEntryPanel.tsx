import React from 'react';
import Image from 'next/image';
import { Square, Type, Settings2, Plus, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import RetroIPod from './RetroIPod';

type VoiceRecordingState = 'idle' | 'recording' | 'recorded';

interface VoiceEntryPanelStyles {
  borderColor: string;
  bgPage: string;
  bgCard: string;
  primaryColor: string;
  primaryLight: string;
  textPrimary: string;
  textSecondary: string;
}
// VoiceEntryPanel component manages the voice recording interface, including recording controls, audio playback, and transcript display. It handles different states of the voice recording process and provides an interactive experience for users to manage their voice notes within a journal entry.
interface VoiceEntryPanelProps {
  styles: VoiceEntryPanelStyles;
  showVoiceTextEditor: boolean;
  voiceRecordingState: VoiceRecordingState;
  isVoicePlaying: boolean;
  voiceElapsedSeconds: number;
  voiceCurrentSeconds: number;
  voiceDurationSeconds: number;
  recordedVoiceUrl: string | null;
  voiceNoteUrls: string[];
  activeVoiceNoteIndex: number;
  isGeneratingTranscript: boolean;
  voiceTranscript: string;
  onTranscriptChange: (value: string) => void;
  isDarkMode: boolean;
  formatSeconds: (seconds: number) => string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onToggleTextArea: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPlayPause: () => void;
  onSeek: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAudioTimeUpdate: () => void;
  onAudioEnded: () => void;
  onAudioLoadedMetadata: () => void;
  onSelectVoiceNote: (index: number) => void;
  onReRecordFirstNote: () => void;
  allowTextToggle?: boolean;
}

const VoiceEntryPanel: React.FC<VoiceEntryPanelProps> = ({
  styles,
  showVoiceTextEditor,
  voiceRecordingState,
  isVoicePlaying,
  voiceElapsedSeconds,
  voiceCurrentSeconds,
  voiceDurationSeconds,
  recordedVoiceUrl,
  voiceNoteUrls,
  activeVoiceNoteIndex,
  isGeneratingTranscript,
  voiceTranscript,
  onTranscriptChange,
  isDarkMode,
  formatSeconds,
  audioRef,
  onToggleTextArea,
  onStartRecording,
  onStopRecording,
  onPlayPause,
  onSeek,
  onAudioTimeUpdate,
  onAudioEnded,
  onAudioLoadedMetadata,
  onSelectVoiceNote,
  onReRecordFirstNote,
  allowTextToggle = true,
}) => {
  const transcriptBackground = isDarkMode ? '#111827' : styles.bgCard;
  const [showControls, setShowControls] = React.useState(false);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = React.useState(false);
  const [isCopyingTranscript, setIsCopyingTranscript] = React.useState(false);
  // Volume state – synced to the audio element
  const [volume, setVolume] = React.useState(0.8);
  const [isTranscriptFocused, setIsTranscriptFocused] = React.useState(false);

  React.useEffect(() => {
    if (voiceRecordingState === 'recorded') {
      setShowControls(true);
    }
  }, [voiceRecordingState]);

  const canNavigateNotes = voiceNoteUrls.length > 1;
  const totalNotes = voiceNoteUrls.length;
  const canReRecordOnlyNote = totalNotes === 1;
  const noteLabel =
    totalNotes > 0
      ? `Note ${activeVoiceNoteIndex + 1} of ${totalNotes}`
      : 'Note 1 of 1';

  const noteCoverImages = [
    '/music_template.jpeg',
    '/voice_note1.jpg',
    '/voice_note2.jpg',
    '/voice_note3.jpg',
    '/voice_note4.jpg',
    '/voice_note5.jpg',
  ];

  const coverImageForActiveNote =
    noteCoverImages[activeVoiceNoteIndex % noteCoverImages.length] || '/music_template.jpeg';

  const isLowConfidenceTranscript = /could not detect spoken words clearly|try re-recording closer to the microphone/i.test(voiceTranscript);

  // ── Note navigation ────────────────────────────────────────────────
  const goToPreviousNote = () => {
    if (!canNavigateNotes) return;
    onSelectVoiceNote(
      activeVoiceNoteIndex === 0 ? totalNotes - 1 : activeVoiceNoteIndex - 1,
    );
  };

  const goToNextNote = () => {
    if (!canNavigateNotes) return;
    onSelectVoiceNote(
      activeVoiceNoteIndex === totalNotes - 1 ? 0 : activeVoiceNoteIndex + 1,
    );
  };

  // ── Volume control (updates the actual audio element) ──────────────
  const handleVolumeChange = (newVolume: number) => {
    const clamped = Math.max(0, Math.min(1, newVolume));
    setVolume(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  };

  // ── Skip 5 seconds ─────────────────────────────────────────────────
  const handleSkipBack = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(
      0,
      audioRef.current.currentTime - 5,
    );
  };

  const handleSkipForward = () => {
    if (!audioRef.current) return;
    const dur = audioRef.current.duration || 0;
    audioRef.current.currentTime = Math.min(
      isFinite(dur) ? dur : 0,
      audioRef.current.currentTime + 5,
    );
  };

  const handleCopyTranscript = async () => {
    if (!voiceTranscript.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(voiceTranscript);
      setIsCopyingTranscript(true);
      window.setTimeout(() => setIsCopyingTranscript(false), 1200);
    } catch (error) {
      console.error('[VoiceEntryPanel] Failed to copy transcript', error);
    }
  };

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: styles.bgPage }}
    >
      {/* ── Controls toggle (only when something is recorded) ── */}
      {voiceRecordingState !== 'idle' && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setShowControls((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
            style={{ borderColor: styles.borderColor, color: styles.textSecondary }}
            title="Toggle voice controls"
          >
            <Settings2 size={14} />
            {showControls ? 'Hide Player Controls' : 'Player Controls'}
          </button>
        </div>
      )}

      {/* ── IDLE: Show record button ──────────────────────────── */}
      {voiceRecordingState === 'idle' && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <button
            type="button"
            onClick={onStartRecording}
            className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full shadow-lg transition-all hover:scale-105 active:scale-95"
            style={{
              border: `2px solid ${styles.borderColor}`,
              backgroundColor: styles.bgCard,
            }}
            aria-label="Start voice recording"
          >
            <Image
              src="https://framerusercontent.com/images/vn9Fhn3Ak8lw97yDVLk1q42T9Ds.png?width=216&height=328"
              alt="Retro microphone icon"
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
            />
          </button>

          <p className="mt-4 text-sm font-semibold" style={{ color: styles.textPrimary }}>
            Tap the mic to start recording
          </p>
          <p className="mt-1 text-xs" style={{ color: styles.textSecondary }}>
            Your voice note and transcript will appear here after recording.
          </p>

          <div
            className="mt-4 rounded-full px-3 py-1.5 text-[11px]"
            style={{ backgroundColor: styles.bgCard, color: styles.textSecondary }}
          >
            Tip: You can also attach existing audio in the media section below.
          </div>
        </div>
      )}

      {/* ── RECORDING: Show stop button + timer ──────────────── */}
      {voiceRecordingState === 'recording' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <button
            type="button"
            onClick={onStopRecording}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform active:scale-95"
            aria-label="Stop recording"
          >
            <Square size={28} />
          </button>
          <p className="text-sm font-medium tracking-wide text-red-500">
            Recording… {formatSeconds(voiceElapsedSeconds)}
          </p>
        </div>
      )}

      {/* ── RECORDED + URL: Show Retro iPod player ──────────── */}
      {voiceRecordingState === 'recorded' && recordedVoiceUrl && (
        <div className="space-y-3">
          {/* Retro iPod component */}
          <RetroIPod
            isPlaying={isVoicePlaying}
            currentSeconds={voiceCurrentSeconds}
            durationSeconds={voiceDurationSeconds}
            volume={volume}
            trackName={noteLabel}
            artistName="My Journal"
            albumName="Voice Memos"
            coverImage={coverImageForActiveNote}
            isDarkMode={isDarkMode}
            canNavigateNotes={canNavigateNotes}
            formatSeconds={formatSeconds}
            onPlayPause={onPlayPause}
            onSkipBack={handleSkipBack}
            onSkipForward={handleSkipForward}
            onVolumeChange={handleVolumeChange}
            onPrevNote={goToPreviousNote}
            onNextNote={goToNextNote}
            onAddNote={onStartRecording}
            onMenuPress={() => setShowControls((prev) => !prev)}
          />

          {/* ── Extended controls panel   */}
          {showControls && (
            <div
              className="space-y-2.5 rounded-xl p-3"
              style={{ backgroundColor: styles.bgCard }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="text-xs uppercase tracking-[0.14em]"
                  style={{ color: styles.textSecondary }}
                >
                  Playback
                </p>
                <div className="flex items-center gap-2">
                  {canReRecordOnlyNote && (
                    <button
                      type="button"
                      onClick={onReRecordFirstNote}
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
                      style={{ borderColor: '#ef4444', color: '#ef4444' }}
                    >
                      Re-record
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onStartRecording}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs"
                    style={{ borderColor: styles.borderColor, color: styles.textPrimary }}
                  >
                    <Plus size={12} />
                    Add Note
                  </button>
                </div>
              </div>

              {/* Seek scrubber */}
              <input
                type="range"
                min={0}
                max={Math.max(voiceDurationSeconds, 1)}
                value={Math.min(voiceCurrentSeconds, Math.max(voiceDurationSeconds, 1))}
                onChange={onSeek}
                className="w-full"
                aria-label="Seek audio"
              />

              {allowTextToggle && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onToggleTextArea}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                    style={{ borderColor: styles.borderColor, color: styles.textSecondary }}
                    title="Toggle journal text area"
                  >
                    <Type size={12} />
                    {showVoiceTextEditor ? 'Hide Text' : 'Show Text'}
                  </button>
                </div>
              )}

              <p className="text-xs" style={{ color: styles.textSecondary }}>
                Add another note to this entry. Transcripts are merged automatically.
              </p>
            </div>
          )}

          {/* Generating transcript indicator */}
          {isGeneratingTranscript && (
            <p className="text-xs" style={{ color: styles.textSecondary }}>
              Generating transcript automatically…
            </p>
          )}

          {/* Transcript display */}
          {voiceTranscript && (
            <div
              className="rounded-lg p-2.5"
              style={{ backgroundColor: styles.bgCard }}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p
                  className="text-xs font-semibold uppercase tracking-[0.12em]"
                  style={{ color: styles.textSecondary }}
                >
                  Transcript
                </p>

                <div className="flex items-center gap-1.5">
                  {isLowConfidenceTranscript && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: isDarkMode ? '#7F1D1D' : '#FEE2E2', color: isDarkMode ? '#FCA5A5' : '#991B1B' }}
                    >
                      Low confidence, please review
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsTranscriptExpanded((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px]"
                    style={{ borderColor: styles.borderColor, color: styles.textSecondary }}
                  >
                    {isTranscriptExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {isTranscriptExpanded ? 'Collapse' : 'Expand'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyTranscript}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px]"
                    style={{ borderColor: styles.borderColor, color: styles.textSecondary }}
                  >
                    <Copy size={12} />
                    {isCopyingTranscript ? 'Copied' : 'Copy'}
                  </button>

                </div>
              </div>

              <textarea
                value={voiceTranscript}
                onChange={(event) => onTranscriptChange(event.target.value)}
                onFocus={() => setIsTranscriptFocused(true)}
                onBlur={() => setIsTranscriptFocused(false)}
                className="min-h-30 w-full resize-y rounded-md border p-2 text-sm outline-none transition-all focus:ring-2"
                style={{
                  minHeight: isTranscriptExpanded ? '170px' : '94px',
                  color: styles.textPrimary,
                  backgroundColor: transcriptBackground,
                  borderColor: styles.borderColor,
                  colorScheme: isDarkMode ? 'dark' : 'light',
                  caretColor: styles.primaryColor,
                  boxShadow: `${isTranscriptFocused ? `0 0 0 2px ${styles.primaryLight}, ` : ''}inset 0 0 0 1000px ${transcriptBackground}`,
                  WebkitBoxShadow: `${isTranscriptFocused ? `0 0 0 2px ${styles.primaryLight}, ` : ''}inset 0 0 0 1000px ${transcriptBackground}`,
                  WebkitTextFillColor: styles.textPrimary,
                }}
                placeholder="Transcript will appear here..."
              />
            </div>
          )}

          {/* Hint when controls are hidden */}
          {!showControls && (
            <p
              className="text-center text-[11px] uppercase tracking-[0.12em]"
              style={{ color: styles.textSecondary }}
            >
              {allowTextToggle
                ? 'Open controls to seek, add note, or toggle text'
                : 'Open controls to seek or add note'}
            </p>
          )}
        </div>
      )}

      {/* ── RECORDED but no URL yet: processing state ──────── */}
      {voiceRecordingState === 'recorded' && !recordedVoiceUrl && (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm" style={{ color: styles.textSecondary }}>
            Processing recording…
          </p>
        </div>
      )}

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={recordedVoiceUrl ?? undefined}
        onTimeUpdate={onAudioTimeUpdate}
        onEnded={onAudioEnded}
        onLoadedMetadata={onAudioLoadedMetadata}
        className="hidden"
      />
    </div>
  );
};

export default VoiceEntryPanel;
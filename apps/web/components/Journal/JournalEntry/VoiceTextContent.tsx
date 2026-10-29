import React, { useEffect } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Save, Clock, AlertTriangle, PlusCircle, MessageSquare, CheckCircle2, Loader2, Circle } from 'lucide-react';
import VoiceEntryPanel from './VoiceEntryPanel';
import MediaSelector from './file-attachements/MediaSelector';
import MediaMenu from './MediaMenu';
import MediaPreview from './file-attachements/MediaPreview';
import SentimentAnalysisDashboard from '@/components/Journal/JournalEntry/SentimentAnalysis';

type EntryMode = 'text' | 'voice';

type Styles = {
  primaryColor: string;
  primaryLight: string;
  primaryMedium: string;
  bgPage: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
};

interface MediaFile {
  id: string;
  file: File;
  type: 'image' | 'audio' | 'video' | 'document';
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  url?: string;
  driveFileId?: string;
  driveMimeType?: string;
  errorMessage?: string;
}

interface VoiceTextContentProps {
  entryMode: EntryMode;
  viewMode: string;
  styles: Styles;
  itemVariants: Variants;
  showVoiceTextEditor: boolean;
  onToggleVoiceTextEditor: () => void;
  allowVoiceTextToggle: boolean;
  voiceRecordingState: 'idle' | 'recording' | 'recorded';
  isVoicePlaying: boolean;
  voiceElapsedSeconds: number;
  voiceCurrentSeconds: number;
  voiceDurationSeconds: number;
  recordedVoiceUrl: string | null;
  voiceNoteUrls: string[];
  activeVoiceNoteIndex: number;
  isGeneratingTranscript: boolean;
  voiceTranscript: string;
  onVoiceTranscriptChange: (value: string) => void;
  formatSeconds: (seconds: number) => string;
  voiceAudioRef: React.RefObject<HTMLAudioElement | null>;
  startVoiceRecording: () => void;
  stopVoiceRecording: () => void;
  handleVoicePlayPause: () => void;
  handleVoiceSeek: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAudioTimeUpdate: () => void;
  onAudioEnded: () => void;
  onAudioLoadedMetadata: () => void;
  handleSelectVoiceNote: (index: number) => void;
  handleReRecordFirstNote: () => void;
  journalType: string;
  journalTypes: Array<{ id: string; name: string }>;
  tags: string[];
  setTags: (tags: string[]) => void;
  handleFileSelect: (files: FileList | null, type: 'image' | 'audio' | 'video' | 'document') => void;
  isUploading: boolean;
  mediaFiles: MediaFile[];
  setShowOCRUpload: (show: boolean) => void;
  handleRemoveFile: (mediaId: string) => void;
  handleUpload: () => void;
  failedUploads: MediaFile[];
  isDarkMode: boolean;
  handleRetryFailedUploads: () => void;
  content: string;
  setContent: (value: string) => void;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  wordCount: number;
  lastAutoSaved: Date | null;
  getFormattedTime: (date: Date | null) => string;
  pendingBackendSync: boolean;
  syncStatus: 'idle' | 'local_saved' | 'syncing' | 'synced' | 'sync_failed';
  autoSaveProgress: number;
  autoSaveCountdownSeconds: number;
  showMetadata: boolean;
  saveEntry: () => void;
  isSaving: boolean;
  manualSaveCooldownSeconds: number;
  entrySavedSuccessfully: boolean;
  setShowChatbot: (show: boolean) => void;
  savedEntries: Record<string, unknown>[];
  currentJournalId: string | null;
  createNewEntry: () => void;
  location: string;
  setLocation: (value: string) => void;
  weather: string;
  setWeather: (value: string) => void;
  isArchived: boolean;
  setIsArchived: (value: boolean) => void;
  showAnalysis: boolean;
  analysisResult: Record<string, unknown> | null;
}

const VoiceTextContent: React.FC<VoiceTextContentProps> = ({
  entryMode,
  viewMode,
  styles,
  itemVariants,
  showVoiceTextEditor,
  onToggleVoiceTextEditor,
  allowVoiceTextToggle,
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
  onVoiceTranscriptChange,
  formatSeconds,
  voiceAudioRef,
  startVoiceRecording,
  stopVoiceRecording,
  handleVoicePlayPause,
  handleVoiceSeek,
  onAudioTimeUpdate,
  onAudioEnded,
  onAudioLoadedMetadata,
  handleSelectVoiceNote,
  handleReRecordFirstNote,
  tags,
  setTags,
  handleFileSelect,
  isUploading,
  mediaFiles,
  setShowOCRUpload,
  handleRemoveFile,
  handleUpload,
  failedUploads,
  isDarkMode,
  handleRetryFailedUploads,
  content,
  setContent,
  editorRef,
  wordCount,
  lastAutoSaved,
  getFormattedTime,
  pendingBackendSync,
  syncStatus,
  autoSaveProgress,
  autoSaveCountdownSeconds,
  showMetadata,
  saveEntry,
  isSaving,
  manualSaveCooldownSeconds,
  entrySavedSuccessfully,
  setShowChatbot,
  createNewEntry,
  location,
  setLocation,
  weather,
  setWeather,
  isArchived,
  setIsArchived,
  showAnalysis,
  analysisResult,
}) => {
  useEffect(() => {
    if (entryMode !== 'voice') return;
    if (tags.includes('voicenote')) return;
    setTags([...tags, 'voicenote']);
  }, [entryMode, tags, setTags]);

  const isFocusMode = viewMode === 'focus';
  const isPreviewMode = viewMode === 'preview';
  const isWritingMode = !isFocusMode && !isPreviewMode;
  const isManualSaveCoolingDown = manualSaveCooldownSeconds > 0;
  const showPlaceholder = content.trim().length === 0;
  const useTextWritingLayout = entryMode === 'text' && isWritingMode;
  const showAttachmentsPanel = useTextWritingLayout && (mediaFiles.length > 0 || failedUploads.length > 0);
  const [isOpeningChatbot, setIsOpeningChatbot] = React.useState(false);
  const [isCreatingAnotherEntry, setIsCreatingAnotherEntry] = React.useState(false);

  const handleOpenChatbot = () => {
    if (isOpeningChatbot) return;
    setIsOpeningChatbot(true);
    setShowChatbot(true);
    window.setTimeout(() => setIsOpeningChatbot(false), 800);
  };

  const handleCreateAnotherEntry = () => {
    if (isCreatingAnotherEntry) return;
    setIsCreatingAnotherEntry(true);
    createNewEntry();
    window.setTimeout(() => setIsCreatingAnotherEntry(false), 800);
  };

  const syncBadge = (() => {
    if (syncStatus === 'sync_failed') {
      return {
        icon: <AlertTriangle size={12} className="shrink-0" />,
        label: 'Sync failed (will retry)',
        backgroundColor: styles.primaryMedium,
        color: styles.textPrimary,
      };
    }

    if (isSaving || syncStatus === 'syncing') {
      return {
        icon: <Loader2 size={12} className="shrink-0 animate-spin" />,
        label: 'Syncing to server...',
        backgroundColor: styles.primaryLight,
        color: styles.textSecondary,
      };
    }

    if (pendingBackendSync || syncStatus === 'local_saved') {
      return {
        icon: <Circle size={10} className="shrink-0 fill-current" />,
        label: autoSaveCountdownSeconds > 0
          ? `Saved locally • sync in ${autoSaveCountdownSeconds}s`
          : 'Saved locally • sync queued',
        backgroundColor: styles.primaryLight,
        color: styles.primaryColor,
      };
    }

    if (syncStatus === 'synced') {
      return {
        icon: <CheckCircle2 size={12} className="shrink-0" />,
        label: 'Synced to server',
        backgroundColor: styles.primaryLight,
        color: styles.textPrimary,
      };
    }

    return null;
  })();

  const attachHint = useTextWritingLayout
    ? 'Use the Add Media button to attach images, audio, video, or documents.'
    : 'Attach image, audio, video, or document files from the Add Files control.';

  const attachmentsPanel = (
    <div className="flex flex-col gap-4">
      {mediaFiles.length === 0 && (
        <div
          className="rounded-lg border px-3 py-2 text-xs"
          style={{ borderColor: styles.borderColor, color: styles.textSecondary, backgroundColor: styles.bgPage }}
        >
          {attachHint}
        </div>
      )}

      {mediaFiles.length > 0 && (
        <div className="space-y-2">
          <div
            className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1 pr-40 md:pr-56"
            style={{ backgroundColor: `${styles.bgCard}F0`, backdropFilter: 'blur(4px)' }}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: styles.textSecondary }}>
              <span className="rounded-full px-2.5 py-1" style={{ backgroundColor: styles.bgPage }}>
                Attached files
              </span>
              {entryMode === 'voice' && <span>Voice notes are managed in the player above</span>}
            </div>

            {mediaFiles.some((media) => media.status === 'idle') && (
              <motion.button
                onClick={handleUpload}
                disabled={isUploading}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium shadow-md transition-all hover:shadow-lg"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  backgroundColor: isUploading ? styles.primaryLight : styles.primaryColor,
                  color: isUploading ? styles.textPrimary : '#FFFFFF',
                  opacity: isUploading ? 0.7 : 1,
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                }}
              >
                <Save size={14} />
                <span>{isUploading ? 'Uploading...' : 'Upload Files'}</span>
              </motion.button>
            )}
          </div>
          <MediaPreview mediaFiles={mediaFiles} onRemove={handleRemoveFile} isUploading={isUploading} />
        </div>
      )}

      {failedUploads.length > 0 && !isUploading && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2">
          <div
            className="flex items-center gap-2 rounded-lg p-3"
            style={{ backgroundColor: styles.primaryMedium, color: styles.textPrimary }}
          >
            <AlertTriangle size={16} />
            <span className="text-sm font-medium">
              {failedUploads.length} file{failedUploads.length > 1 ? 's' : ''} failed to upload
            </span>
          </div>
          <motion.button
            onClick={handleRetryFailedUploads}
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium shadow-md transition-all hover:shadow-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ backgroundColor: styles.primaryColor, color: '#FFFFFF' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            <span>Retry Failed Uploads</span>
          </motion.button>
        </motion.div>
      )}
    </div>
  );

  return (
    <>
      {entryMode === 'voice' && (
        <motion.div className="mb-6" variants={itemVariants} initial={false} animate="visible">
          <VoiceEntryPanel
            styles={styles}
            showVoiceTextEditor={showVoiceTextEditor}
            voiceRecordingState={voiceRecordingState}
            isVoicePlaying={isVoicePlaying}
            voiceElapsedSeconds={voiceElapsedSeconds}
            voiceCurrentSeconds={voiceCurrentSeconds}
            voiceDurationSeconds={voiceDurationSeconds}
            recordedVoiceUrl={recordedVoiceUrl}
            voiceNoteUrls={voiceNoteUrls}
            activeVoiceNoteIndex={activeVoiceNoteIndex}
            isGeneratingTranscript={isGeneratingTranscript}
            voiceTranscript={voiceTranscript}
            onTranscriptChange={onVoiceTranscriptChange}
            isDarkMode={isDarkMode}
            formatSeconds={formatSeconds}
            audioRef={voiceAudioRef}
            onToggleTextArea={onToggleVoiceTextEditor}
            onStartRecording={startVoiceRecording}
            onStopRecording={stopVoiceRecording}
            onPlayPause={handleVoicePlayPause}
            onSeek={handleVoiceSeek}
            onAudioTimeUpdate={onAudioTimeUpdate}
            onAudioEnded={onAudioEnded}
            onAudioLoadedMetadata={onAudioLoadedMetadata}
            onSelectVoiceNote={handleSelectVoiceNote}
            onReRecordFirstNote={handleReRecordFirstNote}
            allowTextToggle={allowVoiceTextToggle}
          />
        </motion.div>
      )}

      {isWritingMode && (
        <motion.div className="mb-6 flex flex-col space-y-4 rounded-xl p-6" variants={itemVariants} initial={false} animate="visible">
          {useTextWritingLayout ? (
            <div className="relative">
              <div className="px-6 pt-6 text-center">
                <p className="text-sm" style={{ color: styles.textPrimary }}>
                  Take your time. There is no right way to do this.
                </p>
              </div>

              <div className="relative px-4 pb-4 pt-4">
                <textarea
                  ref={editorRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                    data-guide-target="journal-writing-area"
                  className="min-h-90 w-full resize-none border-none bg-transparent pb-12 text-base leading-relaxed outline-none focus:ring-0"
                  style={{
                    color: styles.primaryColor,
                    fontFamily: '"Noto Serif", serif',
                    caretColor: styles.primaryColor,
                    backgroundColor: 'transparent',
                    border: 0,
                    boxShadow: 'none',
                    outline: 'none',
                    appearance: 'none',
                  }}
                  placeholder=""
                />

                {showPlaceholder && (
                  <div className="pointer-events-none absolute inset-0 pt-4">
                    <p className="text-base leading-relaxed px-6" style={{ color: styles.textPrimary }}>
                      Start wherever your mind is right now...
                    </p>
                  </div>
                )}

                <div className="absolute bottom-4 left-6">
                  <MediaMenu
                    onFileSelect={handleFileSelect}
                    onRequestOCR={() => setShowOCRUpload(true)}
                    disabled={isUploading}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="relative rounded-xl p-3 pt-14 md:p-4 md:pt-14" style={{ backgroundColor: styles.bgCard }}>
              <div className="absolute right-3 top-3 z-30 md:right-4 md:top-4">
                <MediaSelector
                  onFileSelect={handleFileSelect}
                  disabled={isUploading}
                  onRequestOCR={() => setShowOCRUpload(true)}
                  compact={voiceRecordingState === 'recording'}
                />
              </div>
              {attachmentsPanel}
            </div>
          )}
          {showAttachmentsPanel && (
            <div className="rounded-xl border px-4 py-4" style={{ borderColor: styles.borderColor, backgroundColor: styles.bgCard }}>
              {attachmentsPanel}
            </div>
          )}
        </motion.div>
      )}

      {isPreviewMode ? (
        <motion.div
          className="prose prose-lg max-w-none rounded-lg border p-5 shadow-inner transition-all duration-300"
          style={{
            color: styles.textPrimary,
            fontFamily: '"Noto Serif", serif',
            backgroundColor: `${styles.bgPage}80`,
            borderColor: styles.borderColor,
          }}
          variants={itemVariants}
          initial={false}
          animate="visible"
        >
          {content.trim().length === 0 ? (
            <p className="m-0 text-sm" style={{ color: styles.textSecondary }}>
              Write something to see preview.
            </p>
          ) : (
            content.split('\n').map((paragraph, index) => (paragraph ? <p key={index}>{paragraph}</p> : <br key={index} />))
          )}
        </motion.div>
      ) : (
        entryMode === 'voice' && !showVoiceTextEditor ? null : (
          !useTextWritingLayout && (
            <motion.div variants={itemVariants} initial={false} animate="visible" className="rounded-xl" style={{ backgroundColor: styles.bgPage }}>
              <textarea
                ref={editorRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="h-[62vh] w-full resize-none rounded-xl border-none bg-transparent p-5 text-lg leading-relaxed outline-none transition-all duration-300 focus:ring-2"
                style={{ color: styles.textPrimary, minHeight: '400px', fontFamily: '"Noto Serif", serif', caretColor: styles.primaryColor, boxShadow: 'none' }}
                placeholder="Start writing your thoughts..."
              />
            </motion.div>
          )
        )
      )}

      {isWritingMode && (
        <motion.div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: styles.borderColor }} variants={itemVariants} initial={false} animate="visible">
          <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: styles.textSecondary }}>
            <span>{wordCount} words</span>
            {!useTextWritingLayout && lastAutoSaved && (
              <span className="flex items-center">
                <Clock size={14} className="mr-1" />
                Auto-saved locally at {getFormattedTime(lastAutoSaved)}
              </span>
            )}
            {!useTextWritingLayout && syncBadge && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium"
                style={{ backgroundColor: syncBadge.backgroundColor, color: syncBadge.color }}
              >
                {syncBadge.icon}
                {syncBadge.label}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <motion.button
              onClick={saveEntry}
              data-guide-target="journal-save-entry"
              className="relative flex items-center gap-2 overflow-hidden rounded-lg px-4 py-2 font-medium shadow-md transition-all hover:shadow-lg hover:saturate-125 hover:brightness-105 disabled:hover:saturate-100 disabled:hover:brightness-100"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                backgroundPosition: isSaving || isManualSaveCoolingDown
                  ? '100% 50%'
                  : ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{
                backgroundPosition: {
                  duration: 5.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }}
              style={{
                backgroundImage: useTextWritingLayout
                  ? isDarkMode
                    ? 'linear-gradient(135deg, rgba(82,95,70,0.96) 0%, rgba(90,113,92,0.96) 46%, rgba(61,76,91,0.96) 100%)'
                    : 'linear-gradient(135deg, #9f6958 0%, #8f7f62 48%, #7a8f66 100%)'
                  : `linear-gradient(135deg, ${styles.primaryColor} 0%, ${styles.primaryMedium} 50%, ${styles.primaryColor} 100%)`,
                backgroundSize: '200% 200%',
                color: useTextWritingLayout ? styles.textPrimary : '#FFFFFF',
                opacity: isSaving || isManualSaveCoolingDown ? 0.7 : 1,
              }}
              disabled={isSaving || isManualSaveCoolingDown}
            >
              {pendingBackendSync && !isSaving && !useTextWritingLayout && (
                <span
                  className="pointer-events-none absolute inset-y-0 left-0 rounded-lg"
                  style={{
                    width: `${Math.max(0, Math.min(1, autoSaveProgress)) * 100}%`,
                    backgroundColor: styles.primaryLight,
                    transition: 'width 100ms linear',
                  }}
                />
              )}
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span className="relative z-10">
                {isSaving
                  ? 'Saving...'
                  : isManualSaveCoolingDown
                    ? `Save (${manualSaveCooldownSeconds}s)`
                    : pendingBackendSync && !useTextWritingLayout
                      ? `Auto-save ${autoSaveCountdownSeconds}s`
                      : useTextWritingLayout
                        ? 'Reflect on this'
                        : 'Save Entry'}
              </span>
            </motion.button>

            {entrySavedSuccessfully && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  backgroundPosition: isOpeningChatbot ? '100% 50%' : ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  duration: 0.3,
                  backgroundPosition: {
                    duration: 5.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }}
                onClick={handleOpenChatbot}
                disabled={isOpeningChatbot}
                data-guide-target="journal-speak-force"
                className="flex items-center gap-2 rounded-lg border px-4 py-2 font-medium transition-all hover:saturate-125 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:saturate-100 disabled:hover:brightness-100"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  backgroundImage: isDarkMode
                    ? 'linear-gradient(135deg, rgba(148,163,184,0.14) 0%, rgba(148,163,184,0.08) 50%, rgba(148,163,184,0.14) 100%)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,231,223,0.9) 50%, rgba(255,255,255,0.95) 100%)',
                  backgroundSize: '200% 200%',
                  color: styles.textPrimary,
                  borderColor: styles.borderColor,
                }}
              >
                {isOpeningChatbot ? <Loader2 size={18} className="animate-spin" /> : <MessageSquare size={18} />}
                <span>{isOpeningChatbot ? 'Opening...' : 'Speak with Force'}</span>
              </motion.button>
            )}

            {entrySavedSuccessfully && (
              <motion.button
                onClick={handleCreateAnotherEntry}
                disabled={isCreatingAnotherEntry}
                data-guide-target="journal-create-another-entry"
                className="flex items-center gap-2 rounded-lg border px-4 py-2 font-medium transition-all hover:saturate-125 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:saturate-100 disabled:hover:brightness-100"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                  backgroundPosition: isCreatingAnotherEntry ? '100% 50%' : ['0% 50%', '100% 50%', '0% 50%'],
                }}
                transition={{
                  backgroundPosition: {
                    duration: 5.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }}
                style={{
                  backgroundImage: isDarkMode
                    ? 'linear-gradient(135deg, rgba(148,163,184,0.14) 0%, rgba(148,163,184,0.08) 50%, rgba(148,163,184,0.14) 100%)'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,231,223,0.9) 50%, rgba(255,255,255,0.95) 100%)',
                  backgroundSize: '200% 200%',
                  color: styles.textPrimary,
                  border: `1px solid ${styles.borderColor}`,
                }}
              >
                {isCreatingAnotherEntry ? <Loader2 size={18} className="animate-spin" /> : <PlusCircle size={18} />}
                <span>{isCreatingAnotherEntry ? 'Creating...' : 'Create Another Entry'}</span>
              </motion.button>
            )}
          </div>
        </motion.div>
      )}

      {showMetadata && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-6 rounded-lg p-6"
          style={{ backgroundColor: styles.bgCard }}
        >
          <h3 className="mb-4 text-lg font-semibold" style={{ color: styles.textPrimary }}>
            Additional Details
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: styles.textSecondary }}>
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Home, Office, Coffee Shop"
                className="w-full rounded-lg border px-4 py-2 outline-none transition-colors focus:ring-2"
                style={{ backgroundColor: styles.bgPage, borderColor: styles.borderColor, color: styles.textPrimary, caretColor: styles.primaryColor }}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium" style={{ color: styles.textSecondary }}>
                Weather
              </label>
              <input
                type="text"
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                placeholder="e.g., Sunny, Rainy, Cloudy"
                className="w-full rounded-lg border px-4 py-2 outline-none transition-colors focus:ring-2"
                style={{ backgroundColor: styles.bgPage, borderColor: styles.borderColor, color: styles.textPrimary, caretColor: styles.primaryColor }}
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={isArchived}
                  onChange={(e) => setIsArchived(e.target.checked)}
                  className="h-5 w-5 rounded"
                  style={{ accentColor: styles.primaryColor }}
                />
                <span className="text-sm font-medium" style={{ color: styles.textPrimary }}>
                  Archive this entry (hide from main journal list)
                </span>
              </label>
            </div>
          </div>
        </motion.div>
      )}

      {showAnalysis && analysisResult && (
        <>
          <div className="mb-6"></div>
          <SentimentAnalysisDashboard
            data={analysisResult as unknown as Array<{
              sentiment: string;
              roberta_sentiment: string;
              primary_emotion: string;
              secondary_emotions: string[];
              emotion_scores: Record<string, number>;
              timestamp: string;
              image_path?: string;
            }>}
          />
        </>
      )}
    </>
  );
};

export default VoiceTextContent;

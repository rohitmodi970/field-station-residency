import React from 'react';
import type { Variants } from 'framer-motion';
import VoiceTextContent from './VoiceTextContent';

type EntryMode = 'text' | 'voice';
type ViewMode = 'writing' | 'preview' | 'focus';

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

type MediaFile = {
  id: string;
  file: File;
  type: 'image' | 'audio' | 'video' | 'document';
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  backendMediaId?: string;
  url?: string;
  driveFileId?: string;
  driveMimeType?: string;
  errorMessage?: string;
};
// Note: The props for VoiceTextContentContainer are quite extensive, so we group them into logical sections (VoiceGroup, JournalGroup, MediaGroup, EditorGroup, MetaGroup) for better organization and readability. Each group encapsulates related state and handlers for a specific aspect of the journal entry functionality.
type VoiceGroup = {
  showVoiceTextEditor: boolean;
  setShowVoiceTextEditor: React.Dispatch<React.SetStateAction<boolean>>;
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
  updateVoiceTranscript: (value: string) => void;
  handleRegenerateTranscript: () => Promise<void>;
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
};

type JournalGroup = {
  journalType: string;
  journalTypes: Array<{ id: string; name: string }>;
  tags: string[];
  setTags: (tags: string[]) => void;
  newTag: string;
  setNewTag: (value: string) => void;
};

type MediaGroup = {
  handleFileSelect: (files: FileList | null, type: 'image' | 'audio' | 'video' | 'document') => void;
  MEDIA_LIMITS: {
    image: { count: number; size: number };
    audio: { count: number; size: number };
    video: { count: number; size: number };
    document: { count: number; size: number };
  };
  isUploading: boolean;
  mediaFiles: MediaFile[];
  setShowOCRUpload: (show: boolean) => void;
  handleRemoveFile: (mediaId: string) => void;
  handleUpload: () => void;
  failedUploads: MediaFile[];
  handleRetryFailedUploads: () => void;
};

type EditorGroup = {
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
};

type MetaGroup = {
  isFavorite: boolean;
  setIsFavorite: (value: boolean) => void;
  showMetadata: boolean;
  setShowMetadata: (value: boolean) => void;
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
};

type VoiceTextContentContainerProps = {
  entryMode: EntryMode;
  viewMode: ViewMode;
  styles: Styles;
  itemVariants: Variants;
  isDarkMode: boolean;
  voice: VoiceGroup;
  journal: JournalGroup;
  media: MediaGroup;
  editor: EditorGroup;
  meta: MetaGroup;
};

const VoiceTextContentContainer: React.FC<VoiceTextContentContainerProps> = ({
  entryMode,
  viewMode,
  styles,
  itemVariants,
  isDarkMode,
  voice,
  journal,
  media,
  editor,
  meta,
}) => {
  return (
    <VoiceTextContent
      entryMode={entryMode}
      viewMode={viewMode}
      styles={styles}
      itemVariants={itemVariants}
      showVoiceTextEditor={voice.showVoiceTextEditor}
      onToggleVoiceTextEditor={() => voice.setShowVoiceTextEditor((prev) => !prev)}
      allowVoiceTextToggle={viewMode !== 'focus'}
      voiceRecordingState={voice.voiceRecordingState}
      isVoicePlaying={voice.isVoicePlaying}
      voiceElapsedSeconds={voice.voiceElapsedSeconds}
      voiceCurrentSeconds={voice.voiceCurrentSeconds}
      voiceDurationSeconds={voice.voiceDurationSeconds}
      recordedVoiceUrl={voice.recordedVoiceUrl}
      voiceNoteUrls={voice.voiceNoteUrls}
      activeVoiceNoteIndex={voice.activeVoiceNoteIndex}
      isGeneratingTranscript={voice.isGeneratingTranscript}
      voiceTranscript={voice.voiceTranscript}
      onVoiceTranscriptChange={voice.updateVoiceTranscript}
      formatSeconds={voice.formatSeconds}
      voiceAudioRef={voice.voiceAudioRef}
      startVoiceRecording={voice.startVoiceRecording}
      stopVoiceRecording={voice.stopVoiceRecording}
      handleVoicePlayPause={voice.handleVoicePlayPause}
      handleVoiceSeek={voice.handleVoiceSeek}
      onAudioTimeUpdate={voice.onAudioTimeUpdate}
      onAudioEnded={voice.onAudioEnded}
      onAudioLoadedMetadata={voice.onAudioLoadedMetadata}
      handleSelectVoiceNote={voice.handleSelectVoiceNote}
      handleReRecordFirstNote={voice.handleReRecordFirstNote}
      journalType={journal.journalType}
      journalTypes={journal.journalTypes}
      tags={journal.tags}
      setTags={journal.setTags}
      handleFileSelect={media.handleFileSelect}
      isUploading={media.isUploading}
      mediaFiles={media.mediaFiles}
      setShowOCRUpload={media.setShowOCRUpload}
      handleRemoveFile={media.handleRemoveFile}
      handleUpload={media.handleUpload}
      failedUploads={media.failedUploads}
      isDarkMode={isDarkMode}
      handleRetryFailedUploads={media.handleRetryFailedUploads}
      content={editor.content}
      setContent={editor.setContent}
      editorRef={editor.editorRef}
      wordCount={editor.wordCount}
      lastAutoSaved={editor.lastAutoSaved}
      getFormattedTime={editor.getFormattedTime}
      pendingBackendSync={editor.pendingBackendSync}
      syncStatus={editor.syncStatus}
      autoSaveProgress={editor.autoSaveProgress}
      autoSaveCountdownSeconds={editor.autoSaveCountdownSeconds}
      showMetadata={meta.showMetadata}
      saveEntry={meta.saveEntry}
      isSaving={meta.isSaving}
      manualSaveCooldownSeconds={meta.manualSaveCooldownSeconds}
      entrySavedSuccessfully={meta.entrySavedSuccessfully}
      setShowChatbot={meta.setShowChatbot}
      savedEntries={meta.savedEntries}
      currentJournalId={meta.currentJournalId}
      createNewEntry={meta.createNewEntry}
      location={meta.location}
      setLocation={meta.setLocation}
      weather={meta.weather}
      setWeather={meta.setWeather}
      isArchived={meta.isArchived}
      setIsArchived={meta.setIsArchived}
      showAnalysis={meta.showAnalysis}
      analysisResult={meta.analysisResult}
    />
  );
};

export default VoiceTextContentContainer;

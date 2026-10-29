import React from 'react';
import JournalModeControls from './JournalModeControls';
import SettingsPanel from './SettingsPanel';

type EntryMode = 'text' | 'voice';
type ViewMode = 'writing' | 'preview' | 'focus';

type Styles = {
  primaryColor: string;
  primaryLight: string;
  bgPage: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
};

type JournalType = { id: string; name: string; description: string; icon: string };

type JournalEntryShellProps = {
  isMinimalTextEntry: boolean;
  showSettings: boolean;
  entryMode: EntryMode;
  date: string;
  setDate: (value: string) => void;
  styles: Styles;
  isDarkMode: boolean;
  onToggleFocusMode: () => void;
  viewMode: ViewMode;
  isSaving: boolean;
  manualSaveCooldownSeconds: number;
  onSave: () => void;
  onSwitchMode: (mode: 'writing' | 'preview') => void;
  lastNonFocusViewMode: 'writing' | 'preview';
  showVoiceTextEditor: boolean;
  onToggleVoiceTextEditor: () => void;
  isUnsaved: boolean;
  lastSavedLabel: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  tags: string[];
  newTag: string;
  setNewTag: (value: string) => void;
  setTags: (tags: string[]) => void;
  isRecordingActive: boolean;
  journalType: string;
  setJournalType: (value: string) => void;
  setViewMode: (mode: string) => void;
  journalTypes: JournalType[];
  viewModes: Array<{ id: string; name: string; description: string }>;
  cacheOwnerLabel: string;
  cacheDrafts: Array<{ key: string; journalId: string; title: string; updatedAt: string; isSynced: boolean; isStale: boolean; sizeBytes: number }>;
  onRefreshCache: () => void;
  onRemoveCacheDraft: (key: string) => void;
  onClearStaleCache: () => void;
  onClearAllCacheDraftsForCurrentUser: () => void;
  onExit?: () => void;
  entrySavedSuccessfully?: boolean;
};

const JournalEntryShell: React.FC<JournalEntryShellProps> = ({
  isMinimalTextEntry,
  showSettings,
  entryMode,
  date,
  setDate,
  styles,
  isDarkMode,
  onToggleFocusMode,
  viewMode,
  isSaving,
  manualSaveCooldownSeconds,
  onSave,
  onSwitchMode,
  lastNonFocusViewMode,
  showVoiceTextEditor,
  onToggleVoiceTextEditor,
  isUnsaved,
  lastSavedLabel,
  isFavorite,
  onToggleFavorite,
  tags,
  newTag,
  setNewTag,
  setTags,
  isRecordingActive,
  journalType,
  setJournalType,
  setViewMode,
  journalTypes,
  viewModes,
  cacheOwnerLabel,
  cacheDrafts,
  onRefreshCache,
  onRemoveCacheDraft,
  onClearStaleCache,
  onClearAllCacheDraftsForCurrentUser,
  onExit,
  entrySavedSuccessfully,
}) => {
  return (
    <>
      {!isMinimalTextEntry && (
        <JournalModeControls
          entryMode={entryMode}
          date={date}
          setDate={setDate}
          styles={styles}
          isDarkMode={isDarkMode}
          onToggleFocusMode={onToggleFocusMode}
          viewMode={viewMode}
          isSaving={isSaving}
          manualSaveCooldownSeconds={manualSaveCooldownSeconds}
          onSave={onSave}
          onSwitchMode={onSwitchMode}
          lastNonFocusViewMode={lastNonFocusViewMode}
          showVoiceTextEditor={showVoiceTextEditor}
          onToggleVoiceTextEditor={onToggleVoiceTextEditor}
          isUnsaved={isUnsaved}
          lastSavedLabel={lastSavedLabel}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
          tags={tags}
          newTag={newTag}
          setNewTag={setNewTag}
          setTags={setTags}
          isRecordingActive={isRecordingActive}
          onExit={onExit}
          entrySavedSuccessfully={entrySavedSuccessfully}
        />
      )}

      {!isMinimalTextEntry && (
        <SettingsPanel
          showSettings={showSettings}
          viewMode={viewMode}
          journalType={journalType}
          setJournalType={setJournalType}
          setViewMode={setViewMode}
          journalTypes={journalTypes}
          viewModes={viewModes}
          styles={styles}
          isDarkMode={isDarkMode}
          cacheOwnerLabel={cacheOwnerLabel}
          cacheDrafts={cacheDrafts}
          onRefreshCache={onRefreshCache}
          onRemoveCacheDraft={onRemoveCacheDraft}
          onClearStaleCache={onClearStaleCache}
          onClearAllCache={onClearAllCacheDraftsForCurrentUser}
        />
      )}
    </>
  );
};

export default JournalEntryShell;

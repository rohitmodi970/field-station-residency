import React from 'react';
import { Calendar, Bookmark, Plus, X, ArrowLeft, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { navigateBackFromJournal } from '@/lib/journal/new-entry-navigation';

type EntryMode = 'text' | 'voice';
type ViewMode = 'writing' | 'preview' | 'focus';

interface JournalModeControlsProps {
  entryMode: EntryMode;
  date: string;
  setDate: (date: string) => void;
  styles: {
    borderColor: string;
    bgPage: string;
    bgCard: string;
    primaryColor: string;
    primaryLight: string;
    textPrimary: string;
    textSecondary: string;
  };
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
  isRecordingActive?: boolean;
  onExit?: () => void;
  entrySavedSuccessfully?: boolean;
}

const JournalModeControls: React.FC<JournalModeControlsProps> = ({
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
  isRecordingActive = false,
  onExit,
  entrySavedSuccessfully,
}) => {
  const router = useRouter();
  const [showTagInput, setShowTagInput] = React.useState(false);

  const normalizedViewMode: ViewMode =
    viewMode === 'focus' || viewMode === 'preview' || viewMode === 'writing'
      ? viewMode
      : 'writing';

  const effectiveEditorMode = normalizedViewMode === 'focus' ? lastNonFocusViewMode : normalizedViewMode;
  const isVoiceFocusMode = entryMode === 'voice' && normalizedViewMode === 'focus';

  const handleAddTag = () => {
    const value = newTag.trim();
    if (!value || tags.includes(value)) {
      return;
    }
    setTags([...tags, value]);
    setNewTag('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const nonEssentialControlStyle = isRecordingActive ? { opacity: 0.55 } : undefined;
  const isManualSaveCoolingDown = manualSaveCooldownSeconds > 0;

  const handleBackClick = () => {
    if (onExit) {
      onExit();
      return;
    }
    const hasUnsavedChanges = isUnsaved && !entrySavedSuccessfully;
    if (hasUnsavedChanges && typeof window !== 'undefined') {
      const shouldLeave = window.confirm('You have unsaved content. Leave this page?');
      if (!shouldLeave) {
        return;
      }
    }
    navigateBackFromJournal(router);
  };

  return (
    <div
      className="px-4 py-3 md:px-6"
      style={{ backgroundColor: styles.bgCard }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBackClick}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-85 cursor-pointer"
            style={{
              borderColor: styles.borderColor,
              color: styles.textPrimary,
              backgroundColor: styles.bgPage,
              ...nonEssentialControlStyle,
            }}
            aria-label="Back to previous page"
            title="Back to previous page"
          >
            <ArrowLeft size={13} />
            <span>Back</span>
          </button>

          <span
            className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
            style={{ backgroundColor: `${styles.primaryLight}80`, color: styles.primaryColor }}
          >
            {entryMode === 'voice' ? 'Voice Mode' : 'Journal Mode'}
          </span>
          <div
            className="hidden items-center gap-2 rounded-full px-3 py-1.5 text-sm sm:flex"
            style={{ backgroundColor: styles.bgPage, color: styles.textSecondary }}
          >
            <Calendar size={14} />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border px-2 py-1 text-sm outline-none"
              style={{
                color: styles.textPrimary,
                borderColor: styles.borderColor,
                backgroundColor: styles.bgPage,
                colorScheme: isDarkMode ? 'dark' : 'light',
                boxShadow: isDarkMode ? `inset 0 0 0 1000px ${styles.bgPage}` : undefined,
                WebkitTextFillColor: styles.textPrimary,
              }}
              aria-label="Select date"
            />
          </div>
        </div>

        <div className="relative flex w-full items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:overflow-visible sm:pb-0">

          <button
            type="button"
            onClick={onToggleFocusMode}
            className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-widest"
            style={{ ...nonEssentialControlStyle, borderColor: styles.borderColor, color: styles.textSecondary }}
          >
            {entryMode === 'voice'
              ? (normalizedViewMode === 'focus' ? 'Exit Voice Focus' : 'Voice Focus')
              : (normalizedViewMode === 'focus' ? 'Exit Focus' : 'Focus')}
          </button>

          <button
            type="button"
            onClick={onToggleFavorite}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
            style={{
              ...nonEssentialControlStyle,
              borderColor: isFavorite ? styles.primaryColor : styles.borderColor,
              backgroundColor: isFavorite ? `${styles.primaryLight}90` : styles.bgPage,
              color: isFavorite ? styles.primaryColor : styles.textSecondary,
            }}
          >
            <Bookmark size={13} fill={isFavorite ? styles.primaryColor : 'none'} />
            <span className="sm:hidden">Fav</span>
            <span className="hidden sm:inline">{isFavorite ? 'Favorited' : 'Favorite'}</span>
          </button>

          {normalizedViewMode === 'focus' && (
            <motion.button
              type="button"
              onClick={onSave}
              className="rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-widest"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              style={{
                backgroundColor: styles.primaryColor,
                color: '#FFFFFF',
                opacity: isSaving || isManualSaveCoolingDown ? 0.7 : 1,
              }}
              disabled={isSaving || isManualSaveCoolingDown}
            >
              {isSaving ? 'Saving' : isManualSaveCoolingDown ? `Save (${manualSaveCooldownSeconds}s)` : 'Save'}
            </motion.button>
          )}
        </div>
      </div>

      <div className="mx-auto mt-2 flex w-full max-w-5xl flex-col items-start gap-2 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" style={{ color: styles.textSecondary }}>
        <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:overflow-visible sm:pb-0">
          <button
            type="button"
            onClick={() => onSwitchMode('writing')}
            className="rounded-full border px-2.5 py-1"
            style={{
              borderColor: effectiveEditorMode === 'writing' ? styles.primaryColor : styles.borderColor,
              backgroundColor: effectiveEditorMode === 'writing' ? `${styles.primaryLight}90` : styles.bgPage,
              color: effectiveEditorMode === 'writing' ? styles.primaryColor : styles.textSecondary,
            }}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => onSwitchMode('preview')}
            className="rounded-full border px-2.5 py-1"
            style={{
              borderColor: effectiveEditorMode === 'preview' ? styles.primaryColor : styles.borderColor,
              backgroundColor: effectiveEditorMode === 'preview' ? `${styles.primaryLight}90` : styles.bgPage,
              color: effectiveEditorMode === 'preview' ? styles.primaryColor : styles.textSecondary,
            }}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => {
              const hasUnsavedChanges = isUnsaved && !entrySavedSuccessfully;
              if (hasUnsavedChanges && typeof window !== 'undefined') {
                const shouldLeave = window.confirm('You have unsaved content. Leave this page to start bulk import?');
                if (!shouldLeave) {
                  return;
                }
              }
              router.push('/journal/new?mode=writeBulkImport');
            }}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-90 cursor-pointer"
            style={{
              borderColor: '#f59e0b',
              color: '#f59e0b',
              backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.08)',
            }}
            title="Bulk Import handwritten journals"
          >
            <Layers size={12} className="text-amber-500" />
            <span>Bulk Import</span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded-full bg-amber-500 text-white">
              Beta
            </span>
          </button>
          {entryMode === 'voice' && (
            <button
              type="button"
              onClick={onToggleVoiceTextEditor}
              className="rounded-full border px-2.5 py-1"
              disabled={isVoiceFocusMode}
              style={{
                borderColor: showVoiceTextEditor ? styles.primaryColor : styles.borderColor,
                backgroundColor: showVoiceTextEditor ? `${styles.primaryLight}90` : styles.bgPage,
                color: showVoiceTextEditor ? styles.primaryColor : styles.textSecondary,
                opacity: isVoiceFocusMode ? 0.5 : 1,
                cursor: isVoiceFocusMode ? 'not-allowed' : 'pointer',
              }}
            >
              {showVoiceTextEditor ? 'Text On' : 'Text Off'}
            </button>
          )}
        </div>
        <span className="whitespace-nowrap">{isUnsaved ? 'Unsaved changes' : `Saved ${lastSavedLabel || 'recently'}`}</span>
      </div>

      <div className="mx-auto mt-2 hidden w-full max-w-5xl flex-row flex-wrap items-center justify-between gap-2 sm:flex">
        <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-1" style={nonEssentialControlStyle}>
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs"
              style={{ backgroundColor: styles.primaryLight, color: styles.primaryColor }}
            >
              #{tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
                className="rounded-full"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {showTagInput ? (
            <>
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                    setShowTagInput(false);
                  }
                  if (e.key === 'Escape') {
                    setShowTagInput(false);
                  }
                }}
                placeholder="Add tag"
                className="rounded-full border px-3 py-1 text-xs outline-none"
                style={{ borderColor: styles.borderColor, backgroundColor: styles.bgPage, color: styles.textPrimary }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  handleAddTag();
                  setShowTagInput(false);
                }}
                className="rounded-full p-1.5"
                style={{ backgroundColor: styles.primaryLight, color: styles.primaryColor }}
                aria-label="Confirm tag"
              >
                <Plus size={13} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowTagInput(true)}
              className="rounded-full border px-2.5 py-1 text-xs"
              style={{ ...nonEssentialControlStyle, borderColor: styles.borderColor, color: styles.textSecondary, backgroundColor: styles.bgPage }}
            >
              + Add tag
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto mt-2 flex w-full max-w-5xl flex-col items-start gap-2 sm:hidden">
        <div className="flex w-full items-center gap-2 overflow-x-auto pb-1" style={nonEssentialControlStyle}>
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs"
              style={{ backgroundColor: styles.primaryLight, color: styles.primaryColor }}
            >
              #{tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
                className="rounded-full"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          {showTagInput ? (
            <>
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                    setShowTagInput(false);
                  }
                  if (e.key === 'Escape') {
                    setShowTagInput(false);
                  }
                }}
                placeholder="Add tag"
                className="rounded-full border px-3 py-1 text-xs outline-none"
                style={{ borderColor: styles.borderColor, backgroundColor: styles.bgPage, color: styles.textPrimary }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  handleAddTag();
                  setShowTagInput(false);
                }}
                className="rounded-full p-1.5"
                style={{ backgroundColor: styles.primaryLight, color: styles.primaryColor }}
                aria-label="Confirm tag"
              >
                <Plus size={13} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowTagInput(true)}
              className="rounded-full border px-2.5 py-1 text-xs"
              style={{ ...nonEssentialControlStyle, borderColor: styles.borderColor, color: styles.textSecondary, backgroundColor: styles.bgPage }}
            >
              + Add tag
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default JournalModeControls;

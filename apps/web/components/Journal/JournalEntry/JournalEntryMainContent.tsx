"use client";

import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { HelpCircle, ArrowLeft, Layers } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { navigateBackFromJournal } from '@/lib/journal/new-entry-navigation';
import FocusModeEditor from './FocusModeEditor';
import JournalTitleSection from './JournalTitleSection';
import VoiceTextContentContainer from './VoiceTextContentContainer';

type EntryMode = 'text' | 'voice';
type ViewMode = 'writing' | 'preview' | 'focus';

type PromptContext = {
  text: string;
  explanation?: string;
};

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

type Mood = { id: string; emoji: string; label: string };

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
  journalTypes: Array<{ id: string; name: string; description?: string; icon?: string }>;
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
  isDarkMode: boolean;
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

type VoiceTextContentProps = {
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

type JournalEntryMainContentProps = {
  isMinimalTextEntry: boolean;
  minimalBackgroundStyle: React.CSSProperties;
  entrySavedSuccessfully: boolean;
  contentVariants: Variants;
  revealAnimation: boolean;
  normalizedViewMode: ViewMode;
  entryMode: EntryMode;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
  content: string;
  onContentChange: (value: string) => void;
  styles: Styles;
  itemVariants: Variants;
  promptContext?: PromptContext;
  titleRef: React.RefObject<HTMLInputElement | null>;
  title: string;
  onTitleChange: (value: string) => void;
  onTitleFocus: () => void;
  onTitleBlur: () => void;
  isTitleFocused: boolean;
  isDarkMode: boolean;
  date: string;
  selectedMood: string | null;
  moods: Mood[];
  voiceTextContentProps: VoiceTextContentProps;
  isUnsaved?: boolean;
  onExit?: () => void;
};

type GuideStep = {
  title: string;
  body: string;
  hint: string;
  target: string;
  afterSave?: boolean;
};

const JOURNAL_GUIDE_SEEN_KEY = 'force_journal_guide_seen';

const JOURNAL_GUIDE_STEPS: GuideStep[] = [
  {
    title: 'Start here',
    body: 'This is your journal editor. Start with the prompt card or write your own thoughts in the page.',
    hint: 'The prompt is optional. You can always write freely instead.',
    target: 'journal-prompt-card',
  },
  {
    title: 'Add files & OCR',
    body: 'Use Add Files to attach images, audio, video, or documents. The same menu also includes OCR for extracting text from images or scans.',
    hint: 'This menu covers attachments and text extraction in one place.',
    target: 'journal-add-files',
  },
  {
    title: 'Save your entry',
    body: 'Use Save Entry or Reflect on this to store what you wrote.',
    hint: 'After saving, the follow-up actions appear for the next step.',
    target: 'journal-save-entry',
  },
  {
    title: 'Speak with Force',
    body: 'After saving, this button opens the assistant so you can ask questions about the entry you made.',
    hint: 'It appears once the entry is saved.',
    target: 'journal-speak-force',
    afterSave: true,
  },
  {
    title: 'Create another entry',
    body: 'This button starts a fresh entry so you can keep journaling without leaving the page.',
    hint: 'It is the quickest way to continue writing.',
    target: 'journal-create-another-entry',
    afterSave: true,
  },
];

const JournalEntryMainContent: React.FC<JournalEntryMainContentProps> = ({
  isMinimalTextEntry,
  minimalBackgroundStyle,
  entrySavedSuccessfully,
  contentVariants,
  revealAnimation,
  normalizedViewMode,
  entryMode,
  editorRef,
  content,
  onContentChange,
  styles,
  itemVariants,
  promptContext,
  titleRef,
  title,
  onTitleChange,
  onTitleFocus,
  onTitleBlur,
  isTitleFocused,
  isDarkMode,
  date,
  selectedMood,
  moods,
  voiceTextContentProps,
  isUnsaved,
  onExit,
}) => {
  const [showPromptPopover, setShowPromptPopover] = React.useState(false);
  const hasPromptContext = Boolean(promptContext?.text?.trim());
  const [showGuide, setShowGuide] = React.useState(false);
  const [guideStep, setGuideStep] = React.useState(0);
  const [guideRect, setGuideRect] = React.useState<DOMRect | null>(null);
  const [guideCardStyle, setGuideCardStyle] = React.useState<React.CSSProperties>({});
  const router = useRouter();

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const alreadySeen = window.localStorage.getItem(JOURNAL_GUIDE_SEEN_KEY) === 'true';
      if (!alreadySeen) {
        setGuideStep(0);
        setShowGuide(true);
      }
    } catch {
      setGuideStep(0);
      setShowGuide(true);
    }
  }, []);

  const handleCloseEditor = () => {
    if (onExit) {
      onExit();
      return;
    }
    const hasUnsavedContent = isUnsaved && !entrySavedSuccessfully;
    if (hasUnsavedContent && typeof window !== 'undefined') {
      const shouldLeave = window.confirm('You have unsaved content. Leave this page?');
      if (!shouldLeave) {
        return;
      }
    }
    navigateBackFromJournal(router);
  };

  const handleGoToBulkImport = () => {
    const hasUnsavedContent = isUnsaved && !entrySavedSuccessfully;
    if (hasUnsavedContent && typeof window !== 'undefined') {
      const shouldLeave = window.confirm('You have unsaved content. Leave this page to start bulk import?');
      if (!shouldLeave) {
        return;
      }
    }
    router.push('/journal/new?mode=writeBulkImport');
  };

  const markGuideSeen = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(JOURNAL_GUIDE_SEEN_KEY, 'true');
    } catch {
      // Ignore storage issues and let the guide close normally.
    }
  }, []);

  const closeGuide = React.useCallback(() => {
    setShowGuide(false);
    markGuideSeen();
  }, [markGuideSeen]);

  const openGuide = React.useCallback(() => {
    setGuideStep(0);
    setShowGuide(true);
  }, []);

  const handleGuideNext = React.useCallback(() => {
    const nextStep = guideStep + 1;
    if (nextStep < JOURNAL_GUIDE_STEPS.length) {
      const nextGuideStep = JOURNAL_GUIDE_STEPS[nextStep];
      if (nextGuideStep && (!nextGuideStep.afterSave || entrySavedSuccessfully)) {
        setGuideStep(nextStep);
        return;
      }
    }

    closeGuide();
  }, [closeGuide, entrySavedSuccessfully, guideStep]);

  const activeGuideStep = JOURNAL_GUIDE_STEPS[guideStep];

  React.useEffect(() => {
    if (!showGuide || !activeGuideStep) {
      setGuideRect(null);
      setGuideCardStyle({});
      return;
    }

    if (activeGuideStep.afterSave && !entrySavedSuccessfully) {
      return;
    }

    const updateGuideAnchor = () => {
      const isCompactViewport = window.innerWidth < 768 || window.innerHeight < 720;
      const fallbackTarget = activeGuideStep.target === 'journal-prompt-card' ? 'journal-writing-area' : '';
      const anchor = document.querySelector(`[data-guide-target="${activeGuideStep.target}"]`) as HTMLElement | null
        || (fallbackTarget ? document.querySelector(`[data-guide-target="${fallbackTarget}"]`) as HTMLElement | null : null);
      if (!anchor) {
        setGuideRect(null);
        setGuideCardStyle({});
        return;
      }

      const rect = anchor.getBoundingClientRect();
      setGuideRect(rect);

      if (isCompactViewport) {
        const maxCardHeight = Math.max(240, window.innerHeight - 24);
        setGuideCardStyle({
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          maxHeight: `${maxCardHeight}px`,
        });
        return;
      }

      const cardWidth = Math.min(360, window.innerWidth - 32);
      const maxCardHeight = Math.max(240, window.innerHeight - 32);
      const estimatedCardHeight = Math.min(320, maxCardHeight);
      const fitsRight = rect.right + 20 + cardWidth < window.innerWidth;
      const left = fitsRight ? rect.right + 20 : Math.max(16, rect.left - cardWidth - 20);
      const maxTop = Math.max(16, window.innerHeight - estimatedCardHeight - 16);
      const top = Math.max(16, Math.min(rect.top - 8, maxTop));

      setGuideCardStyle({ left, top, maxHeight: `${maxCardHeight}px` });
    };

    updateGuideAnchor();
    window.addEventListener('resize', updateGuideAnchor);
    window.addEventListener('scroll', updateGuideAnchor, true);
    return () => {
      window.removeEventListener('resize', updateGuideAnchor);
      window.removeEventListener('scroll', updateGuideAnchor, true);
    };
  }, [activeGuideStep, entrySavedSuccessfully, showGuide]);

  return (
    <motion.div
      className={isMinimalTextEntry
        ? 'flex min-h-screen items-start justify-center px-4 py-4 sm:px-6 sm:py-6 lg:items-center lg:py-10'
        : 'flex-1 overflow-auto px-4 py-5 md:px-6 md:py-6'}
      style={minimalBackgroundStyle}
      variants={contentVariants}
      initial="hidden"
      animate={revealAnimation ? 'hidden' : 'visible'}
    >
      {showGuide && activeGuideStep && (
        <div className="fixed inset-0 z-10000 bg-black/20 backdrop-blur-[1px]">
          {guideRect && (
            <div
              className="fixed rounded-[18px] border-2 border-white/90"
              style={{
                top: Math.max(8, guideRect.top - 8),
                left: Math.max(8, guideRect.left - 8),
                width: guideRect.width + 16,
                height: guideRect.height + 16,
                boxShadow: '0 0 0 9999px rgba(15,23,42,0.42)',
                borderRadius: 18,
                pointerEvents: 'none',
              }}
            />
          )}

          <div
            className="fixed w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-3xl border bg-white/97 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.22)]"
            style={guideCardStyle}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.16em] bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(90deg, #7c3aed 0%, #ec4899 55%, #f59e0b 100%)' }}
                >
                  Quick guide
                </p>
                <h2 className="mt-1 text-xl font-semibold" style={{ color: styles.textPrimary }}>
                  {activeGuideStep.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeGuide}
                className="rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-black/5"
                style={{ borderColor: styles.borderColor, color: styles.textSecondary }}
              >
                Skip
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed" style={{ color: styles.textPrimary }}>
              {activeGuideStep.body}
            </p>
            <div className="mt-3 rounded-2xl border px-4 py-3" style={{ borderColor: styles.borderColor, backgroundColor: styles.primaryLight }}>
              <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: styles.textSecondary }}>
                Why it matters
              </p>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: styles.textPrimary }}>
                {activeGuideStep.hint}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {JOURNAL_GUIDE_STEPS.map((_, index) => (
                  <span
                    key={index}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: index === guideStep ? '1.5rem' : '0.45rem',
                      backgroundColor: index === guideStep ? styles.primaryColor : `${styles.primaryColor}40`,
                    }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleGuideNext}
                className="rounded-full px-4 py-2 text-sm font-medium text-white shadow-sm transition-transform hover:-translate-y-0.5"
                style={{ backgroundColor: styles.primaryColor }}
              >
                {guideStep < JOURNAL_GUIDE_STEPS.length - 1 ? 'Next' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={openGuide}
        className="fixed left-4 bottom-8 z-9999 inline-flex items-center gap-2 rounded-full border bg-white px-4 py-3 text-sm font-medium shadow-md transition-all hover:-translate-y-0.5 sm:left-6"
        style={{ borderColor: styles.borderColor, color: styles.textPrimary }}
        aria-label="Open journal guide"
        title="Open journal guide"
      >
        <HelpCircle size={16} style={{ color: styles.primaryColor }} />
        <span>Guide</span>
      </button>

      {/* desktop prompt moved inside content container so it sits above the title */}

      {/* Mobile: small toggle that opens the prompt as a popover/modal */}
        {/* Toggle that opens the prompt as a popover/modal (visible on all sizes) */}
        {hasPromptContext && (
          <div>
            <button
              type="button"
              aria-label="Show prompt"
              aria-expanded={showPromptPopover}
              onClick={() => setShowPromptPopover((s) => !s)}
              className="fixed right-6 bottom-8 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-md"
              style={{ border: `1px solid ${styles.borderColor}` }}
            >
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#10b981' }} />
              </span>
            </button>

            {showPromptPopover && (
              <div
                data-guide-target="journal-prompt-card"
                className="fixed left-4 bottom-16 z-45 w-[88%] max-w-xs rounded-2xl border px-3 py-2.5 shadow-xl sm:max-w-sm md:w-80 md:right-8 md:left-auto md:bottom-36 md:px-4 md:py-3"
                style={{ backgroundColor: styles.primaryLight, borderColor: styles.borderColor }}
              >
                <div className="flex justify-between items-start">
                  <p
                    className="m-0 text-[10px] font-semibold uppercase tracking-[0.12em] bg-clip-text text-transparent"
                    style={{
                      backgroundImage: 'linear-gradient(90deg, #7c3aed 0%, #ec4899 55%, #f59e0b 100%)',
                    }}
                  >
                    {entryMode === 'voice' ? "Speak about today's prompt" : "Write about today's prompt"}
                  </p>
                  <button onClick={() => setShowPromptPopover(false)} aria-label="Close prompt" style={{ color: styles.textSecondary }}>
                    ✕
                  </button>
                </div>
                <p
                  className="mt-1.5 text-sm font-medium leading-relaxed bg-clip-text text-transparent"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, #4f46e5 0%, #db2777 48%, #d97706 100%)',
                  }}
                >
                  {promptContext?.text}
                </p>
                {promptContext?.explanation && (
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: styles.textSecondary }}>
                    {promptContext.explanation}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

      {normalizedViewMode === 'focus' && entryMode !== 'voice' ? (
        <FocusModeEditor
          editorRef={editorRef}
          content={content}
          onContentChange={onContentChange}
          styles={{ textPrimary: styles.textPrimary }}
        />
      ) : (
        <div
          className={isMinimalTextEntry
            ? 'w-full max-w-3xl overflow-hidden rounded-[28px] border shadow-[0_20px_60px_rgba(15,23,42,0.18)] lg:max-h-[calc(100vh-2.5rem)] lg:overflow-y-auto'
            : 'mx-auto w-full max-w-5xl rounded-[28px] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.08)] md:p-7'}
          style={{ backgroundColor: styles.bgCard, borderColor: styles.borderColor }}
        >
          {isMinimalTextEntry && (
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: styles.borderColor }}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onExit || handleCloseEditor}
                  aria-label="Back to previous page"
                  title="Close and go back"
                  className="h-3 w-3 rounded-full flex items-center justify-center p-0 transition-opacity hover:opacity-80 cursor-pointer"
                  style={{ backgroundColor: '#ef4444' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="Black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
                    <path d="M18 6 L6 18 M6 6 L18 18" />
                  </svg>
                </button>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: '#10b981' }} />
              </div>

              <button
                type="button"
                onClick={onExit || handleCloseEditor}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all hover:opacity-80 cursor-pointer"
                style={{ borderColor: styles.borderColor, color: styles.textSecondary }}
                aria-label="Back to previous page"
                title="Back to previous page"
              >
                <ArrowLeft size={13} />
                <span>Back</span>
              </button>
            </div>
          )}

          <div className={isMinimalTextEntry ? 'px-8 py-12' : ''}>
            {promptContext?.text ? (
              <motion.div
                variants={itemVariants}
                data-guide-target="journal-prompt-card"
                className="mb-4 rounded-2xl border px-3 py-3 sm:px-4 sm:py-3.5"
                style={{
                  borderColor: styles.borderColor,
                  backgroundColor: styles.primaryLight,
                }}
              >
                <p
                  className="m-0 text-[10px] font-semibold uppercase tracking-[0.12em] bg-clip-text text-transparent"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, #7c3aed 0%, #ec4899 55%, #f59e0b 100%)',
                  }}
                >
                  {entryMode === 'voice' ? "Speak about today's prompt" : "Write about today's prompt"}
                </p>
                <p
                  className="mt-1.5 text-sm font-medium leading-relaxed bg-clip-text text-transparent"
                  style={{
                    backgroundImage: 'linear-gradient(90deg, #4f46e5 0%, #db2777 48%, #d97706 100%)',
                  }}
                >
                  {promptContext.text}
                </p>
                {promptContext.explanation && (
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: styles.textSecondary }}>
                    {promptContext.explanation}
                  </p>
                )}
              </motion.div>
            ) : null}

            <JournalTitleSection
              itemVariants={itemVariants}
              titleRef={titleRef}
              title={title}
              onTitleChange={onTitleChange}
              onTitleFocus={onTitleFocus}
              onTitleBlur={onTitleBlur}
              isTitleFocused={isTitleFocused}
              styles={{
                textPrimary: styles.textPrimary,
                textSecondary: styles.textSecondary,
                bgPage: styles.bgPage,
                primaryColor: styles.primaryColor,
                borderColor: styles.borderColor,
                primaryLight: styles.primaryLight,
              }}
              isDarkMode={isDarkMode}
              date={date}
              selectedMood={selectedMood}
              moods={moods}
              showMeta={!isMinimalTextEntry}
              isMinimal={isMinimalTextEntry}
            />

            <VoiceTextContentContainer
              entryMode={voiceTextContentProps.entryMode}
              viewMode={voiceTextContentProps.viewMode}
              styles={voiceTextContentProps.styles}
              itemVariants={voiceTextContentProps.itemVariants}
              isDarkMode={voiceTextContentProps.isDarkMode}
              voice={voiceTextContentProps.voice}
              journal={voiceTextContentProps.journal}
              media={voiceTextContentProps.media}
              editor={voiceTextContentProps.editor}
              meta={voiceTextContentProps.meta}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default JournalEntryMainContent;

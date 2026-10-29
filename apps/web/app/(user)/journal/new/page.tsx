"use client"

import dynamic from 'next/dynamic';
import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PenSquare, Mic, ArrowRight, ArrowLeft, Loader2, RefreshCw, Sparkles, X, MoreHorizontal, HelpCircle, Layers, Layout, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';
import {
  JOURNAL_NEW_MAX_PROMPT_LENGTH,
  readJournalPromptContext,
  readJournalPromptPrefill,
  clearJournalPromptContext,
  clearJournalPromptPrefill,
  setJournalPromptContext,
  setJournalPromptPrefill,
  setJournalReturnUrl,
  navigateBackFromJournal,
} from '@/lib/journal/new-entry-navigation';

const JournalEntry = dynamic(
  () => import('@/components/Journal/JournalEntry/JournalEntry'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading journal editor...</p>
        </div>
      </div>
    ),
  }
);

const NewEntryLanding = dynamic(
  () => import('@/components/Journal/JournalEntry/NewEntryLanding'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    ),
  }
);

const BulkJournalImport = dynamic(
  () => import('@/components/Journal/BulkImport/BulkJournalImport'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading Bulk Import...</p>
        </div>
      </div>
    ),
  }
);

type EntryMode = 'text' | 'voice';

function isBulkImportMode(mode: string | null, quick: string | null): boolean {
  const m = mode?.toLowerCase();
  const q = quick?.toLowerCase();
  return (
    q === 'bulk' ||
    m === 'writebulkimport' ||
    m === 'bulkimport' ||
    m === 'bulk' ||
    m === 'bulk_import' ||
    m === 'bulk-import'
  );
}

function normalizeEntryMode(mode: string | null): EntryMode {
  return mode === 'voice' || mode === 'speak' ? 'voice' : 'text';
}

type NewPageGuideStep = {
  title: string;
  body: string;
  hint: string;
  target: string;
};

const NEW_PAGE_GUIDE_STEPS: NewPageGuideStep[] = [
  {
    title: 'A quiet space to write',
    body: 'If you love typing out your thoughts, working with prompts, or simply writing freely without rules, Write mode is your peaceful corner.',
    hint: 'Take all the time you need. There is no right or wrong way to write.',
    target: 'journal-mode-write',
  },
  {
    title: 'Speak your mind freely',
    body: 'Sometimes talking out loud feels so much easier. Just press Speak and let your thoughts flow — we will turn your words into a written journal entry for you.',
    hint: 'Wonderful for evenings, walks outside, or when typing feels like too much effort.',
    target: 'journal-mode-voice',
  },
  {
    title: 'A little inspiration',
    body: 'Not sure where to begin today? We offer a thoughtful question each day to help spark your reflection.',
    hint: 'You can answer it by writing or speaking, or skip it whenever you already know what to say.',
    target: 'journal-mode-prompt',
  },
  {
    title: 'Old journals & extra options',
    body: 'Have handwritten notes or physical notebooks? Tap these three dots to bring them in with Bulk Import, or choose from gentle guided templates.',
    hint: 'You can also open this little guide again whenever you need.',
    target: 'journal-mode-more',
  },
];

interface EntryData {
  title: string;
  content: string;
  tags: string[];
  journalType: string;
}

interface PromptContext {
  text: string;
  explanation?: string;
}

async function fetchPersonalizedPrompt(force: boolean = false, currentPrompt: string = ''): Promise<PromptContext | null> {
  try {
    let promptRes: Response;
    const query = force
      ? `?force=true&t=${Date.now()}&current=${encodeURIComponent(currentPrompt)}`
      : '';
    const url = `/api/prompts/personalized${query}`;

    try {
      const { isEncryptionInitialized } = await import('@/utils/encryption/keyManager');
      if (isEncryptionInitialized()) {
        const { createClient } = await import('@/utils/supabase/client');
        const { decryptEntriesForAI } = await import('@/utils/encryption/decryptForAI');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const entries = await decryptEntriesForAI(user.id, 3);
          promptRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entries, force, currentPrompt }),
          });
        } else {
          promptRes = await fetch(url);
        }
      } else {
        promptRes = await fetch(url);
      }
    } catch {
      promptRes = await fetch(url);
    }

    if (promptRes && promptRes.ok) {
      const data = await promptRes.json();
      const rawPrompt = data?.prompt || data?._plaintext?.prompt;
      if (rawPrompt?.text) {
        return {
          text: String(rawPrompt.text).trim().slice(0, JOURNAL_NEW_MAX_PROMPT_LENGTH),
          explanation: String(rawPrompt.explanation || '').trim().slice(0, JOURNAL_NEW_MAX_PROMPT_LENGTH),
        };
      }
    }
  } catch {
    // Ignore prompt fetch errors
  }
  return null;
}

// Client component that uses useSearchParams
function NewEntryContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { currentTheme, isDarkMode } = useTheme();

  // State for journal entry
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Prompt context state: initialized from URL searchParams so SSR and initial client hydration match
  const [promptContext, setPromptContext] = useState<PromptContext | null>(() => {
    const promptParam = searchParams.get('prompt');
    if (promptParam) {
      return {
        text: promptParam.trim().slice(0, JOURNAL_NEW_MAX_PROMPT_LENGTH),
      };
    }
    return null;
  });

  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [isPromptButtonLoading, setIsPromptButtonLoading] = useState(false);
  const [showPromptModeDialog, setShowPromptModeDialog] = useState(false);
  const [isRefreshingPrompt, setIsRefreshingPrompt] = useState(false);
  const promptFetchInitiatedRef = useRef(false);

  // View state: initialized synchronously from searchParams to avoid flash of NewEntryLanding
  const initialMode = searchParams.get('mode');
  const initialQuick = searchParams.get('quick');
  const initialTemplateId = searchParams.get('templateId');
  const isInitialBulk = isBulkImportMode(initialMode, initialQuick);

  const [entryMode, setEntryMode] = useState<EntryMode>(() => {
    return initialMode === 'voice' || initialMode === 'speak' ? 'voice' : 'text';
  });
  const [journalType, setJournalType] = useState<string>(() => {
    return initialMode === 'voice' || initialMode === 'speak' ? 'voice' : 'personal';
  });
  const [showJournalEntry, setShowJournalEntry] = useState<boolean>(() => {
    if (isInitialBulk) return false;
    if (initialQuick) {
      if (initialQuick !== 'template' || initialTemplateId) return true;
    }
    if (initialTemplateId) return true;
    if (
      initialMode === 'voice' ||
      initialMode === 'speak' ||
      initialMode === 'write' ||
      initialMode === 'text' ||
      initialMode === 'quick' ||
      initialMode === 'mood'
    ) {
      return true;
    }
    return false;
  });
  const [showModePicker, setShowModePicker] = useState<boolean>(() => {
    if (isInitialBulk || initialQuick || initialTemplateId || initialMode) {
      return false;
    }
    return true;
  });

  // Mode picker dropdown menu and guide state
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [guideRect, setGuideRect] = useState<DOMRect | null>(null);
  const [guideCardStyle, setGuideCardStyle] = useState<React.CSSProperties>({});
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const activeGuideStep = NEW_PAGE_GUIDE_STEPS[guideStep];

  useEffect(() => {
    if (!showMoreMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  // Positioning and spotlight for interactive guide (matches write mode guide)
  useEffect(() => {
    if (!showGuideModal || !activeGuideStep) {
      setGuideRect(null);
      setGuideCardStyle({});
      return;
    }

    const updateGuideAnchor = () => {
      const isCompactViewport = window.innerWidth < 768 || window.innerHeight < 720;
      const anchor = document.querySelector(`[data-guide-target="${activeGuideStep.target}"]`) as HTMLElement | null;
      if (!anchor) {
        setGuideRect(null);
        setGuideCardStyle({
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        });
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
  }, [activeGuideStep, showGuideModal]);

  const closeGuide = useCallback(() => {
    setShowGuideModal(false);
  }, []);

  const handleGuideNext = useCallback(() => {
    if (guideStep + 1 < NEW_PAGE_GUIDE_STEPS.length) {
      setGuideStep((prev) => prev + 1);
    } else {
      closeGuide();
    }
  }, [closeGuide, guideStep]);

  // Record referrer on mount so we can navigate back to the previous page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (document.referrer) {
        const url = new URL(document.referrer);
        if (url.host === window.location.host && !url.pathname.startsWith('/journal/new')) {
          setJournalReturnUrl(url.pathname + url.search);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Preload editor chunk in background during idle time so transition from mode picker is instant
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const preload = () => {
      import('@/components/Journal/JournalEntry/JournalEntry');
    };
    if ('requestIdleCallback' in window) {
      const id = (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(preload);
      return () => (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id);
    } else {
      const t = setTimeout(preload, 150);
      return () => clearTimeout(t);
    }
  }, []);

  const preloadEditor = () => {
    try {
      import('@/components/Journal/JournalEntry/JournalEntry');
    } catch {
      // Ignore
    }
  };

  // Effect to load prompt if not already available
  useEffect(() => {
    const sourceParam = searchParams.get('source');
    const promptParam = searchParams.get('prompt');

    if (promptParam && !promptContext) {
      setPromptContext({
        text: promptParam.trim().slice(0, JOURNAL_NEW_MAX_PROMPT_LENGTH),
      });
      return;
    }

    // Read client-side storage after mount to prevent hydration mismatch
    if (!promptContext) {
      const storedContext = readJournalPromptContext();
      if (storedContext?.text) {
        setPromptContext(storedContext);
        return;
      }
      const storedPrefill = readJournalPromptPrefill();
      if (storedPrefill) {
        setPromptContext({ text: storedPrefill });
        return;
      }
    }

    if (sourceParam === 'dashboard_prompt' && !promptContext && !promptFetchInitiatedRef.current) {
      promptFetchInitiatedRef.current = true;
      setIsPromptLoading(true);
      fetchPersonalizedPrompt()
        .then((fetched) => {
          if (fetched) {
            setPromptContext(fetched);
          }
        })
        .finally(() => {
          setIsPromptLoading(false);
        });
    }
  }, [searchParams, promptContext]);

  // Effect to resolve view and mode based on searchParams
  useEffect(() => {
    const quickLinkParam = searchParams.get('quick');
    const templateIdParam = searchParams.get('templateId');
    const modeParam = searchParams.get('mode');

    if (isBulkImportMode(modeParam, quickLinkParam)) {
      setShowJournalEntry(false);
      setShowModePicker(false);
      return;
    }

    if (quickLinkParam) {
      if (quickLinkParam !== 'template' || templateIdParam) {
        setEntryMode('text');
        setJournalType('personal');
        setShowJournalEntry(true);
        setShowModePicker(false);
      }
      return;
    }

    if (templateIdParam) {
      setEntryMode('text');
      setJournalType('personal');
      setShowJournalEntry(true);
      setShowModePicker(false);
      return;
    }

    if (modeParam === 'voice' || modeParam === 'speak') {
      setEntryMode('voice');
      setJournalType('voice');
      setShowJournalEntry(true);
      setShowModePicker(false);
      return;
    }

    if (modeParam === 'write' || modeParam === 'text') {
      setEntryMode('text');
      setJournalType('personal');
      setShowJournalEntry(true);
      setShowModePicker(false);
      return;
    }

    if (modeParam === 'quick' || modeParam === 'mood') {
      setEntryMode('text');
      setJournalType('personal');
      setShowJournalEntry(true);
      setShowModePicker(false);
      return;
    }

    // When no mode specified
    setShowJournalEntry(false);
    setShowModePicker(true);
  }, [searchParams]);

  const handleStartNewEntry = (entryData: EntryData) => {
    setTitle(entryData.title);
    setContent(entryData.content);
    setTags(entryData.tags);
    setJournalType(entryData.journalType);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('quick');
    nextParams.set('mode', 'write');
    router.replace(`${pathname}?${nextParams.toString()}`);
    setShowJournalEntry(true);
  };

  const handleSelectMode = (mode: 'write' | 'voice') => {
    const isVoice = mode === 'voice';
    const resolvedMode: EntryMode = isVoice ? 'voice' : 'text';
    const modeParamValue = isVoice ? 'voice' : 'write';

    // Directly choosing write or speak from the main picker starts a clean entry without today's prompt
    clearJournalPromptContext();
    clearJournalPromptPrefill();
    setPromptContext(null);

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('prompt');
    nextParams.set('mode', modeParamValue);
    router.replace(`${pathname}?${nextParams.toString()}`);

    setEntryMode(resolvedMode);
    setJournalType(isVoice ? 'voice' : 'personal');
    setShowPromptModeDialog(false);
    setShowModePicker(false);
    setShowJournalEntry(true);
  };

  const handleOpenPromptModeChoice = async () => {
    if (isPromptButtonLoading) {
      return;
    }

    if (!promptContext?.text) {
      setIsPromptButtonLoading(true);
      try {
        const fetched = await fetchPersonalizedPrompt();
        if (fetched) {
          setPromptContext(fetched);
          setJournalPromptPrefill(fetched.text);
          setJournalPromptContext(fetched);
        }
      } finally {
        setIsPromptButtonLoading(false);
      }
    }

    setShowPromptModeDialog(true);
  };

  const handleStartPromptEntry = (mode: 'write' | 'voice') => {
    const isVoice = mode === 'voice';
    const resolvedMode: EntryMode = isVoice ? 'voice' : 'text';
    const modeParamValue = isVoice ? 'voice' : 'write';

    if (promptContext?.text) {
      setJournalPromptPrefill(promptContext.text);
      setJournalPromptContext({
        text: promptContext.text,
        explanation: promptContext.explanation,
      });
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('mode', modeParamValue);
    router.replace(`${pathname}?${nextParams.toString()}`);

    setEntryMode(resolvedMode);
    setJournalType(isVoice ? 'voice' : 'personal');
    setShowPromptModeDialog(false);
    setShowModePicker(false);
    setShowJournalEntry(true);
  };

  const handleRefreshPromptOnNewPage = async () => {
    if (isRefreshingPrompt) return;
    setIsRefreshingPrompt(true);
    try {
      const fetched = await fetchPersonalizedPrompt(true, promptContext?.text || '');
      if (fetched) {
        setPromptContext(fetched);
        setJournalPromptPrefill(fetched.text);
        setJournalPromptContext(fetched);
      }
    } finally {
      setIsRefreshingPrompt(false);
    }
  };

  return (
    <div className="min-h-screen">
      {showJournalEntry ? (
        <JournalEntry
          title={title}
          content={content}
          promptContext={promptContext ?? undefined}
          tags={tags}
          journalType={journalType}
          entryMode={entryMode}
        />
      ) : showModePicker ? (
        <div
          className="flex min-h-screen items-center justify-center px-6 py-10"
          style={{
            background: isDarkMode
              ? 'radial-gradient(1200px 540px at 50% -10%, rgba(236, 72, 153, 0.22), transparent 62%), #1c1020'
              : 'radial-gradient(1200px 540px at 50% -10%, rgba(255, 173, 209, 0.38), transparent 62%), #fff3f8',
          }}
        >
          <div
            className="w-full max-w-3xl rounded-3xl border p-7 shadow-2xl backdrop-blur-sm md:p-9"
            style={{
              borderColor: isDarkMode ? 'rgba(236, 72, 153, 0.35)' : 'rgba(223, 126, 174, 0.45)',
              backgroundColor: isDarkMode ? 'rgba(43, 24, 40, 0.72)' : 'rgba(255, 247, 252, 0.9)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => navigateBackFromJournal(router)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80 cursor-pointer"
                style={{
                  borderColor: isDarkMode ? 'rgba(236, 72, 153, 0.35)' : 'rgba(223, 126, 174, 0.45)',
                  color: isDarkMode ? '#F8FAFC' : '#4f1636',
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                }}
                aria-label="Back to previous page"
                title="Back to previous page"
              >
                <ArrowLeft size={13} />
                <span>Back</span>
              </button>

              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: currentTheme.primary }}>
                  Start New Journal
                </div>

                {/* Triple dot menu for minimal UI */}
                <div className="relative" ref={moreMenuRef} data-guide-target="journal-mode-more">
                  <button
                    type="button"
                    onClick={() => setShowMoreMenu((prev) => !prev)}
                    className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border text-xs font-semibold transition-all hover:scale-105 hover:opacity-90 cursor-pointer"
                    style={{
                      borderColor: isDarkMode ? 'rgba(236, 72, 153, 0.35)' : 'rgba(223, 126, 174, 0.45)',
                      color: isDarkMode ? '#F8FAFC' : '#4f1636',
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    }}
                    title="More entry options"
                    aria-label="More options"
                  >
                    <MoreHorizontal size={15} />
                  </button>

                  {/* Dropdown menu */}
                  {showMoreMenu && (
                    <div
                      className="absolute right-0 top-10 z-50 w-56 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-xl transition-all"
                      style={{
                        borderColor: isDarkMode ? 'rgba(236, 72, 153, 0.3)' : 'rgba(223, 126, 174, 0.4)',
                        backgroundColor: isDarkMode ? 'rgba(32, 18, 30, 0.96)' : 'rgba(255, 250, 253, 0.98)',
                        boxShadow: isDarkMode ? '0 20px 40px rgba(0,0,0,0.7)' : '0 20px 40px rgba(121, 89, 72, 0.2)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          router.push('/journal/new?mode=writeBulkImport');
                        }}
                        className="flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                        style={{ color: '#f59e0b' }}
                      >
                        <div className="flex items-center gap-2">
                          <Layers size={14} className="text-amber-500" />
                          <span>Bulk Import</span>
                        </div>
                        <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                          Beta
                        </span>
                      </button>

                      {/* <button
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          router.push('/journal/new?quick=template');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                        style={{ color: isDarkMode ? '#F8FAFC' : '#334155' }}
                      >
                        <Layout size={14} style={{ color: currentTheme.primary }} />
                        <span>Use a Template</span>
                      </button> */}

                      {/* <button
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          router.push('/journal/new?quick=ocr');
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                        style={{ color: isDarkMode ? '#F8FAFC' : '#334155' }}
                      >
                        <ImageIcon size={14} style={{ color: currentTheme.primary }} />
                        <span>Extract from Image (OCR)</span>
                      </button> */}

                      <div className="my-1 border-t" style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }} />

                      <button
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          setGuideStep(0);
                          setShowGuideModal(true);
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                        style={{ color: isDarkMode ? 'rgba(255,255,255,0.7)' : '#64748B' }}
                      >
                        <HelpCircle size={14} />
                        <span>Guide & Tips</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <h1 className="mt-3 text-3xl font-semibold md:text-4xl" style={{ color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
              How would you like to journal today?
            </h1>
            <p className="mt-3 text-sm md:text-base" style={{ color: isDarkMode ? '#f6cbe3' : '#7b2853' }}>
              Pick a mode to begin. You can still switch between writing and voice tools inside the editor.
            </p>

            {/* Prompt preview if available */}
            {promptContext?.text && (
              <div
                data-guide-target="journal-mode-prompt"
                className="mt-6 p-4 rounded-2xl border text-sm"
                style={{
                  borderColor: isDarkMode ? 'rgba(236, 72, 153, 0.25)' : 'rgba(223, 126, 174, 0.3)',
                  backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.6)',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: currentTheme.primary }}>
                    Today&apos;s Prompt
                  </div>
                  <button
                    type="button"
                    onClick={handleRefreshPromptOnNewPage}
                    disabled={isRefreshingPrompt}
                    title="Get a different prompt"
                    aria-label="Get a different prompt"
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all hover:opacity-100 opacity-80 cursor-pointer"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      color: currentTheme.primary,
                    }}
                  >
                    <RefreshCw size={11} className={isRefreshingPrompt ? "animate-spin" : ""} />
                    <span>{isRefreshingPrompt ? 'Refreshing...' : 'New Prompt'}</span>
                  </button>
                </div>
                <p className="font-medium italic" style={{ color: isDarkMode ? '#fff1f8' : '#334155' }}>
                  &ldquo;{promptContext.text}&rdquo;
                </p>
                {promptContext.explanation && (
                  <p className="mt-1 text-xs" style={{ color: isDarkMode ? '#f6cbe3' : '#64748B' }}>
                    {promptContext.explanation}
                  </p>
                )}
              </div>
            )}

            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              <button
                data-guide-target="journal-mode-write"
                type="button"
                onClick={() => handleSelectMode('write')}
                onMouseEnter={preloadEditor}
                onTouchStart={preloadEditor}
                className="group flex flex-col justify-start rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                style={{
                  borderColor: isDarkMode ? 'rgba(244, 114, 182, 0.4)' : 'rgba(212, 119, 161, 0.35)',
                  backgroundColor: isDarkMode ? 'rgba(56, 30, 53, 0.75)' : 'rgba(255, 252, 254, 0.95)',
                }}
              >
                <div className="mb-4 inline-flex w-8 h-8 rounded-xl p-2 items-center justify-center" style={{ backgroundColor: `${currentTheme.primary}22` }}>
                  <PenSquare size={18} style={{ color: currentTheme.primary }} />
                </div>
                <p className="text-lg font-semibold" style={{ color: isDarkMode ? '#fff1f8' : '#4f1636' }}>Write</p>
                <p className="mt-2 text-sm" style={{ color: isDarkMode ? '#f6cbe3' : '#7b2853' }}>
                  Best for long-form writing, structured reflection, and detailed journaling.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium" style={{ color: currentTheme.primary }}>
                  Start Writing
                  <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                </div>
                <p className="mt-2 text-xs" style={{ color: isDarkMode ? '#94A3B8' : '#64748B' }}>
                  Includes Template, OCR, Bulk Import, and Blank start.
                </p>
              </button>

              <button
                data-guide-target="journal-mode-voice"
                type="button"
                onClick={() => handleSelectMode('voice')}
                onMouseEnter={preloadEditor}
                onTouchStart={preloadEditor}
                className="group flex flex-col justify-start rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                style={{
                  borderColor: isDarkMode ? 'rgba(244, 114, 182, 0.4)' : 'rgba(212, 119, 161, 0.35)',
                  backgroundColor: isDarkMode ? 'rgba(56, 30, 53, 0.75)' : 'rgba(255, 252, 254, 0.95)',
                }}
              >
                <div className="mb-4 w-8 h-8 inline-flex rounded-xl p-2 items-center justify-center" style={{ backgroundColor: `${currentTheme.primary}22` }}>
                  <Mic size={18} style={{ color: currentTheme.primary }} />
                </div>
                <p className="text-lg font-semibold" style={{ color: isDarkMode ? '#fff1f8' : '#4f1636' }}>Speak</p>
                <p className="mt-2 text-sm" style={{ color: isDarkMode ? '#f6cbe3' : '#7b2853' }}>
                  Best for quick capture on the go with automatic transcript generation.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium" style={{ color: currentTheme.primary }}>
                  Start Speaking
                  <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                </div>
                <p className="mt-2 text-xs" style={{ color: isDarkMode ? '#94A3B8' : '#64748B' }}>
                  Voice notes with instant transcript and audio attachments.
                </p>
              </button>
            </div>

            <div className="mt-5 flex items-center justify-center" data-guide-target={!promptContext?.text ? 'journal-mode-prompt' : undefined}>
              <button
                type="button"
                onClick={handleOpenPromptModeChoice}
                onMouseEnter={preloadEditor}
                onTouchStart={preloadEditor}
                disabled={isPromptButtonLoading}
                className="group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:saturate-125 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80 disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:saturate-100 disabled:hover:brightness-100 cursor-pointer"
                style={{
                  border: isDarkMode ? '0.5px solid rgba(148,163,184,0.16)' : '0.5px solid rgba(0,0,0,0.035)',
                  color: '#FFFFFF',
                  backgroundImage: isDarkMode
                    ? 'linear-gradient(135deg, rgba(82,95,70,0.96) 0%, rgba(90,113,92,0.96) 46%, rgba(61,76,91,0.96) 100%)'
                    : 'linear-gradient(135deg, #9f6958 0%, #8f7f62 48%, #7a8f66 100%)',
                  boxShadow: isDarkMode
                    ? '0 8px 18px rgba(0,0,0,0.34), 0 1px 4px rgba(15,23,42,0.18)'
                    : '0 8px 18px rgba(121,89,72,0.32)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }}
              >
                {isPromptButtonLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Loading Prompt...
                  </>
                ) : (
                  <>
                    Write About Today&apos;s Prompt
                    <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </div>

            <p className="mt-6 text-xs text-center" style={{ color: isDarkMode ? '#94A3B8' : '#64748B' }}>
              Tip: Voice mode can still include attached files and transcript editing after recording.
            </p>
          </div>

          {/* Mode Selection Dialog when choosing Today's Prompt */}
          {showPromptModeDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => setShowPromptModeDialog(false)}
              />

              {/* Modal Content */}
              <div
                role="dialog"
                aria-modal="true"
                className="relative z-10 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border backdrop-blur-2xl"
                style={{
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(223, 126, 174, 0.45)',
                  backgroundColor: isDarkMode ? 'rgba(28, 16, 32, 0.96)' : 'rgba(255, 250, 252, 0.98)',
                  boxShadow: isDarkMode
                    ? '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(236, 72, 153, 0.15)'
                    : '0 25px 50px -12px rgba(121, 89, 72, 0.35)',
                }}
              >
                {/* Close button */}
                <button
                  type="button"
                  aria-label="Close dialog"
                  onClick={() => setShowPromptModeDialog(false)}
                  className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-full transition-colors cursor-pointer"
                  style={{
                    color: isDarkMode ? 'rgba(255,255,255,0.6)' : '#64748B',
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  }}
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Tag / Badge */}
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${currentTheme.primary}18`,
                      color: currentTheme.primary,
                      letterSpacing: '0.08em',
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Today&apos;s Prompt
                  </span>
                </div>

                {/* Header */}
                <h3
                  className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight"
                  style={{
                    color: isDarkMode ? '#F8FAFC' : '#1E293B',
                  }}
                >
                  How would you like to express this prompt?
                </h3>

                <p
                  className="mt-2 text-sm sm:text-base leading-relaxed"
                  style={{
                    color: isDarkMode ? 'rgba(255,255,255,0.72)' : '#64748B',
                  }}
                >
                  Do you want to express by writing or by speaking?
                </p>

                {/* Prompt Snippet */}
                {promptContext?.text && (
                  <div
                    className="mt-4 p-3.5 sm:p-4 rounded-2xl border text-sm"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(255, 245, 250, 0.7)',
                      borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(223, 126, 174, 0.25)',
                      color: isDarkMode ? 'rgba(255,255,255,0.88)' : '#475569',
                    }}
                  >
                    <p className="font-medium italic">&ldquo;{promptContext.text}&rdquo;</p>
                    {promptContext.explanation && (
                      <p className="mt-1 text-xs opacity-80">{promptContext.explanation}</p>
                    )}
                  </div>
                )}

                {/* Action Buttons: Write vs Speak for this prompt */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => handleStartPromptEntry('write')}
                    onMouseEnter={preloadEditor}
                    onTouchStart={preloadEditor}
                    className="group relative flex flex-col items-start p-4 sm:p-5 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:translate-y-0 cursor-pointer"
                    style={{
                      borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(223, 126, 174, 0.35)',
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(255, 255, 255, 0.95)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                      style={{
                        backgroundColor: `${currentTheme.primary}20`,
                        color: currentTheme.primary,
                      }}
                    >
                      <PenSquare className="w-5 h-5" />
                    </div>
                    <span
                      className="text-base sm:text-lg font-semibold"
                      style={{ color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
                    >
                      Write
                    </span>
                    <span
                      className="mt-1 text-xs sm:text-sm leading-relaxed"
                      style={{ color: isDarkMode ? 'rgba(255,255,255,0.65)' : '#64748B' }}
                    >
                      Reflect and write freely with today&apos;s prompt
                    </span>
                    <div
                      className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold group-hover:gap-2 transition-all"
                      style={{ color: currentTheme.primary }}
                    >
                      <span>Start Writing</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStartPromptEntry('voice')}
                    onMouseEnter={preloadEditor}
                    onTouchStart={preloadEditor}
                    className="group relative flex flex-col items-start p-4 sm:p-5 rounded-2xl border text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-lg active:translate-y-0 cursor-pointer"
                    style={{
                      borderColor: isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(223, 126, 174, 0.35)',
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(255, 255, 255, 0.95)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
                      style={{
                        backgroundColor: `${currentTheme.primary}20`,
                        color: currentTheme.primary,
                      }}
                    >
                      <Mic className="w-5 h-5" />
                    </div>
                    <span
                      className="text-base sm:text-lg font-semibold"
                      style={{ color: isDarkMode ? '#F8FAFC' : '#0F172A' }}
                    >
                      Speak
                    </span>
                    <span
                      className="mt-1 text-xs sm:text-sm leading-relaxed"
                      style={{ color: isDarkMode ? 'rgba(255,255,255,0.65)' : '#64748B' }}
                    >
                      Voice reflection with instant transcript
                    </span>
                    <div
                      className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold group-hover:gap-2 transition-all"
                      style={{ color: currentTheme.primary }}
                    >
                      <span>Start Speaking</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Guide Overlay (styled like write mode) */}
          {showGuideModal && activeGuideStep && (
            <div className="fixed inset-0 z-10000 bg-black/20 backdrop-blur-[1px]">
              {guideRect && (
                <div
                  className="fixed rounded-[18px] border-2 border-white/90 transition-all duration-300"
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
                className="fixed w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-3xl border p-4 shadow-[0_24px_70px_rgba(15,23,42,0.22)] transition-all duration-300"
                style={{
                  ...guideCardStyle,
                  backgroundColor: isDarkMode ? 'rgba(28, 16, 32, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                  borderColor: isDarkMode ? 'rgba(236, 72, 153, 0.35)' : 'rgba(223, 126, 174, 0.45)',
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.16em] bg-clip-text text-transparent"
                      style={{ backgroundImage: 'linear-gradient(90deg, #7c3aed 0%, #ec4899 55%, #f59e0b 100%)' }}
                    >
                      Quick guide
                    </p>
                    <h2 className="mt-1 text-xl font-semibold" style={{ color: isDarkMode ? '#F8FAFC' : '#0F172A' }}>
                      {activeGuideStep.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={closeGuide}
                    className="rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                    style={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', color: isDarkMode ? '#94A3B8' : '#64748B' }}
                  >
                    Skip
                  </button>
                </div>

                <p className="mt-3 text-sm leading-relaxed" style={{ color: isDarkMode ? '#E2E8F0' : '#334155' }}>
                  {activeGuideStep.body}
                </p>
                <div
                  className="mt-3 rounded-2xl border px-4 py-3"
                  style={{
                    borderColor: isDarkMode ? 'rgba(236, 72, 153, 0.25)' : 'rgba(223, 126, 174, 0.3)',
                    backgroundColor: isDarkMode ? 'rgba(236, 72, 153, 0.12)' : 'rgba(255, 240, 248, 0.8)',
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: isDarkMode ? '#f472b6' : '#be185d' }}>
                    Why it matters
                  </p>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: isDarkMode ? '#F8FAFC' : '#1E293B' }}>
                    {activeGuideStep.hint}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    {NEW_PAGE_GUIDE_STEPS.map((_, index) => (
                      <span
                        key={index}
                        className="h-1.5 rounded-full transition-all duration-300"
                        style={{
                          width: index === guideStep ? '1.5rem' : '0.45rem',
                          backgroundColor: index === guideStep ? currentTheme.primary : `${currentTheme.primary}40`,
                        }}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleGuideNext}
                    className="rounded-full px-4 py-2 text-sm font-medium text-white shadow-sm transition-transform hover:-translate-y-0.5 cursor-pointer"
                    style={{ backgroundColor: currentTheme.primary }}
                  >
                    {guideStep < NEW_PAGE_GUIDE_STEPS.length - 1 ? 'Next' : 'Got it'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : isBulkImportMode(searchParams.get('mode'), searchParams.get('quick')) ? (
        <div
          className="min-h-screen py-8"
          style={{
            background: isDarkMode
              ? 'radial-gradient(1000px 420px at 50% -10%, rgba(236, 72, 153, 0.2), transparent 60%), #1c1020'
              : 'radial-gradient(1000px 420px at 50% -10%, rgba(255, 173, 209, 0.34), transparent 60%), #fff3f8',
          }}
        >
          <BulkJournalImport onBack={() => router.push('/journal/new')} />
        </div>
      ) : (
        <div
          className="min-h-screen py-8"
          style={{
            background: isDarkMode
              ? 'radial-gradient(1000px 420px at 50% -10%, rgba(236, 72, 153, 0.2), transparent 60%), #1c1020'
              : 'radial-gradient(1000px 420px at 50% -10%, rgba(255, 173, 209, 0.34), transparent 60%), #fff3f8',
          }}
        >
          <NewEntryLanding
            onStartNewEntry={handleStartNewEntry}
            quickLink={searchParams.get('quick') as 'blank' | 'template' | 'ocr' | 'bulk' | undefined}
            templateId={searchParams.get('templateId') || undefined}
          />
        </div>
      )}
    </div>
  );
}

// Main component with Suspense boundary
export default function NewEntry() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading journal entry...</p>
        </div>
      </div>
    }>
      <NewEntryContent />
    </Suspense>
  );
}

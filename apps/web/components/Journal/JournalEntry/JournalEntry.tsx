"use client"
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/utilities/context/ThemeContext';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import Toast from '@/components/ui/toast';
import ThemeSidebar from '@/components/Navbar/ThemeSidebar';
import JournalEntryShell from './JournalEntryShell';
import JournalEntryMainContent from './JournalEntryMainContent';
import JournalEntryAuxWrapper from './JournalEntryAuxWrapper';
import { encryptJournalEntry } from '@/utils/encryption/journalEncryption';
import { isEncryptionInitialized } from '@/utils/encryption/keyManager';
import { useVoiceTranscript } from './useVoiceTranscript';
import { useVoiceRecording } from './useVoiceRecording';
import { useJournalNotifier } from './useJournalNotifier';
import { navigateBackFromJournal, clearJournalPromptContext } from '@/lib/journal/new-entry-navigation';
import {
  buildJournalSaveThrottleMessage,
  JOURNAL_AUTOSAVE_EMPTY_VOICE_CODE,
  JOURNAL_SAVE_THROTTLE_WINDOW_MS,
  toRetryAfterSeconds,
} from '@/utils/journalSaveThrottle';

type EntryMode = 'text' | 'voice';
type ViewMode = 'writing' | 'preview' | 'focus';

interface PromptContext {
  text: string;
  explanation?: string;
}

const formatVoiceNoteTitle = (dateInput?: string | Date): string => {
  const parsedDate = typeof dateInput === 'string'
    ? (() => {
        const localDateMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (localDateMatch) {
          const year = Number.parseInt(localDateMatch[1] as string, 10);
          const month = Number.parseInt(localDateMatch[2] as string, 10);
          const day = Number.parseInt(localDateMatch[3] as string, 10);
          return new Date(year, month - 1, day);
        }
        return new Date(dateInput);
      })()
    : (dateInput || new Date());
  const resolved = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  return `Voice Note ${resolved.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })}`;
};

const normalizeViewMode = (mode: string): ViewMode => {
  if (mode === 'focus' || mode === 'preview' || mode === 'writing') {
    return mode;
  }
  return 'writing';
};

interface MediaFile {
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
}

interface VoiceNoteUploadInfo {
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

interface CacheDraftSummary {
  key: string;
  journalId: string;
  title: string;
  updatedAt: string;
  isSynced: boolean;
  isStale: boolean;
  sizeBytes: number;
}

interface DraftCacheEntry extends Record<string, unknown> {
  journal_id?: string;
  title?: string | null;
  content?: string | null;
  date?: string;
  tags?: string[];
  mood?: string | null;
  journal_type?: string;
  is_favorite?: boolean;
  is_archived?: boolean;
  location?: string | null;
  weather?: string | null;
  media?: Record<string, unknown>;
  timestamp?: string;
  _synced?: boolean;
  is_encrypted?: boolean;
  prompt_context?: PromptContext | null;
  prompt_encrypted?: string | null;
  prompt_iv?: string | null;
  is_prompt_response?: boolean;
}

const DRAFT_CACHE_PREFIX = 'journal_entry_v2';
const LEGACY_DRAFT_PREFIX = 'journal_entry_';
const DRAFT_CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const revokeBlobUrl = (url?: string) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

const getErrorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const maybeResponse = (error as { response?: { status?: unknown } }).response;
  return typeof maybeResponse?.status === 'number' ? maybeResponse.status : undefined;
};

const isDefaultVoiceNoteTitle = (titleValue: string, dateInput?: string | Date): boolean => {
  const normalized = titleValue.trim();
  if (!normalized) {
    return false;
  }

  return normalized === formatVoiceNoteTitle(dateInput).trim();
};

const JournalEntry: React.FC<{
  title?: string;
  content?: string;
  promptContext?: PromptContext;
  tags?: string[];
  journalType?: string;
  entryMode?: EntryMode;
}> = ({ title: initialTitle = '', content: initialContent = '', promptContext, tags: initialTags = [], journalType: initialJournalType = 'personal', entryMode = 'text' }) => {
  const { currentTheme, isDarkMode, elementColors } = useTheme();
  const router = useRouter();
  const lastSavedContentRef = useRef<string>(initialContent);
  const lastSavedTitleRef = useRef<string>(
    initialTitle || (entryMode === 'voice' ? formatVoiceNoteTitle(new Date()) : 'Untitled entry')
  );
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0] ?? '');
  const [title, setTitle] = useState<string>(() => {
    if (initialTitle) {
      return initialTitle;
    }
    return entryMode === 'voice' ? formatVoiceNoteTitle(new Date()) : 'Untitled entry';
  });

  const [activePrompt, setActivePrompt] = useState<PromptContext | undefined>(promptContext);

  useEffect(() => {
    if (promptContext) {
      setActivePrompt(promptContext);
    }
  }, [promptContext]);

  // Auto-fill title when a promptContext is provided and title is default/empty
  React.useEffect(() => {
    const effectivePrompt = activePrompt || promptContext;
    if (effectivePrompt && effectivePrompt.text) {
      const isDefaultTitle = !initialTitle || initialTitle.trim() === '' || title.trim().toLowerCase().startsWith('untitled') || isDefaultVoiceNoteTitle(title, date);
      if (isDefaultTitle) {
        const now = new Date();
        const dateLabel = now.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
        setTitle(entryMode === 'voice' ? `Voice reflection on today's prompt — ${dateLabel}` : `Writing on today's prompt — ${dateLabel}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePrompt, promptContext, entryMode]);
  const [content, setContent] = useState<string>(initialContent);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [newTag, setNewTag] = useState<string>('');
  const [journalType, setJournalType] = useState<string>(() => {
    if (initialJournalType && initialJournalType !== 'personal') {
      return initialJournalType;
    }
    return entryMode === 'voice' ? 'voice' : (initialJournalType || 'personal');
  });
  const showSettings = false;
  const [viewMode, setViewMode] = useState<ViewMode>('writing'); // 'writing', 'preview', 'focus'
  const [lastNonFocusViewMode, setLastNonFocusViewMode] = useState<'writing' | 'preview'>('writing');
  const [focusEntryViewMode, setFocusEntryViewMode] = useState<'writing' | 'preview'>('writing');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [revealAnimation, setRevealAnimation] = useState<boolean>(true);
  const [wordCount, setWordCount] = useState<number>(0);
  const [isTitleFocused, setIsTitleFocused] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isUnsaved, setIsUnsaved] = useState<boolean>(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [isArchived, setIsArchived] = useState<boolean>(false);
  const [location, setLocation] = useState<string>('');
  const [weather, setWeather] = useState<string>('');
  const [showMetadata, setShowMetadata] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [manualSaveCooldownSeconds, setManualSaveCooldownSeconds] = useState<number>(0);
  const [currentJournalId, setCurrentJournalId] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [showOCRUpload, setShowOCRUpload] = useState<boolean>(false);
  // Auto-save related states
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const [pendingBackendSync, setPendingBackendSync] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'local_saved' | 'syncing' | 'synced' | 'sync_failed'>('idle');
  const [autoSaveSyncDueAt, setAutoSaveSyncDueAt] = useState<number | null>(null);
  const [autoSaveProgress, setAutoSaveProgress] = useState<number>(0);
  const [autoSaveCountdownSeconds, setAutoSaveCountdownSeconds] = useState<number>(0);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const backendSyncTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaFetchRequestRef = useRef(0);
  const mediaFetchInFlightRef = useRef<string | null>(null);
  const mediaLoadedForJournalRef = useRef<string | null>(null);
  const autoSaveToLocalStorageRef = useRef<() => void>(() => undefined);
  const handleUploadRef = useRef<() => Promise<void>>(async () => undefined);
  const syncToBackendRef = useRef<(journalId: string, source?: 'auto' | 'manual' | 'flush') => Promise<void>>(async () => undefined);
  const autoSyncRetryCountRef = useRef<number>(0);
  const pendingRetryJournalIdRef = useRef<string | null>(null);
  const manualSaveCooldownUntilRef = useRef<number>(0);
  const [, setMediaUploadState] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  // New state to track uploaded media
  const [journalMedia, setJournalMedia] = useState<Record<string, Array<Record<string, unknown>>>>({
    image: [],
    audio: [],
    video: [],
    document: []
  });

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pendingBackendSync || !autoSaveSyncDueAt) {
      setAutoSaveProgress(0);
      setAutoSaveCountdownSeconds(0);
      return;
    }

    const SYNC_DELAY_MS = 10000;
    const startedAt = autoSaveSyncDueAt - SYNC_DELAY_MS;

    const updateProgress = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, autoSaveSyncDueAt - now);
      const elapsedMs = Math.min(SYNC_DELAY_MS, Math.max(0, now - startedAt));
      setAutoSaveProgress(elapsedMs / SYNC_DELAY_MS);
      setAutoSaveCountdownSeconds(Math.ceil(remainingMs / 1000));
    };

    updateProgress();
    const progressTimer = setInterval(updateProgress, 100);
    return () => clearInterval(progressTimer);
  }, [pendingBackendSync, autoSaveSyncDueAt]);

  // Journal types
  const journalTypes = [
    { id: 'personal', name: 'Personal', icon: '📔', description: 'Record your thoughts and daily experiences' },
    { id: 'gratitude', name: 'Gratitude', icon: '🙏', description: "Focus on what you're thankful for" },
    { id: 'goals', name: 'Goals', icon: '🎯', description: 'Track your progress toward objectives' },
    { id: 'creative', name: 'Creative', icon: '🎨', description: 'Explore ideas and creative writing' }
  ];

  // View modes
  const viewModes = [
    { id: 'writing', name: 'Writing Mode', description: 'Standard editor with all tools' },
    { id: 'focus', name: 'Focus Mode', description: 'Distraction-free writing environment' }
  ];
  // Define media limits once to keep hook dependencies stable.
  const MEDIA_LIMITS = React.useMemo(
    () => ({
      image: { count: 6, size: 25 * 1024 * 1024 }, // 25MB
      audio: { count: 11, size: 50 * 1024 * 1024 }, // 50MB
      video: { count: 2, size: 200 * 1024 * 1024 }, // 200MB
      document: { count: 5, size: 5 * 1024 * 1024 }, // 5MB
    }),
    []
  );
  const [savedEntries, setSavedEntries] = useState<Record<string, unknown>[]>([]);
  const [cacheDraftSummaries, setCacheDraftSummaries] = useState<CacheDraftSummary[]>([]);

  // Add new state for analysis result
  const [analysisResult] = useState<Record<string, unknown> | null>(null);
  const [showAnalysis] = useState<boolean>(false);

  // Chatbot state
  const [showChatbot, setShowChatbot] = useState<boolean>(false);
  const [entrySavedSuccessfully, setEntrySavedSuccessfully] = useState<boolean>(false);
  const [userProfile, setUserProfile] = useState<Record<string, unknown> | null>(null);
  const [showUploadAlert, setShowUploadAlert] = useState<boolean>(false);
  const [failedUploads, setFailedUploads] = useState<MediaFile[]>([]);
  const [showVoiceTextEditor, setShowVoiceTextEditor] = useState<boolean>(entryMode !== 'voice');
  const [pendingVoiceAutoUpload, setPendingVoiceAutoUpload] = useState<boolean>(false);
  const [activeVoiceNoteIndex, setActiveVoiceNoteIndex] = useState<number>(0);
  const [voiceNoteUploadInfo, setVoiceNoteUploadInfo] = useState<VoiceNoteUploadInfo | null>(null);

  const { successMessage, errorMessage, showMessage } = useJournalNotifier();

  useEffect(() => {
    const updateCooldownSeconds = () => {
      const remainingMs = Math.max(0, manualSaveCooldownUntilRef.current - Date.now());
      const nextSeconds = remainingMs > 0 ? toRetryAfterSeconds(remainingMs) : 0;
      setManualSaveCooldownSeconds((current) => (current === nextSeconds ? current : nextSeconds));
    };

    updateCooldownSeconds();
    const timer = setInterval(updateCooldownSeconds, 200);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const setManualSaveCooldown = useCallback((cooldownMs: number) => {
    const normalizedMs = Math.max(0, cooldownMs);
    manualSaveCooldownUntilRef.current = Date.now() + normalizedMs;
    setManualSaveCooldownSeconds(normalizedMs > 0 ? toRetryAfterSeconds(normalizedMs) : 0);
  }, []);

  const {
    isGeneratingTranscript,
    voiceTranscript,
    voiceTranscriptEncrypted,
    voiceTranscriptIv,
    voiceTranscriptSignature,
    voiceTranscriptGeneratedAt,
    handleRecordingSignature,
    generateTranscript,
    addTranscriptFieldsToPayload,
    updateVoiceTranscript,
    resetTranscriptState,
  } = useVoiceTranscript({
    currentJournalId,
    showMessage,
    onVoiceNoteUploaded: setVoiceNoteUploadInfo,
  });

  const {
    voiceRecordingState,
    isVoicePlaying,
    voiceElapsedSeconds,
    voiceDurationSeconds,
    voiceCurrentSeconds,
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
  } = useVoiceRecording({
    onRecordingSignature: handleRecordingSignature,
    onError: (message: string) => {
      showMessage(message, true);
    },
  });

  useEffect(() => {
    // Check if encryption is required and initialized
    const checkEncryption = async () => {
      try {
        // Fetch user's encryption settings and salt
        const saltResponse = await fetch('/api/encryption/salt');
        const userResponse = await fetch('/api/user/current');
        
        if (saltResponse.ok && userResponse.ok) {
          const saltData = await saltResponse.json();
          const userData = await userResponse.json();
          if (userData.user?.id) {
            setActiveUserId(userData.user.id);
          }
          
          // If encryption is enabled but not initialized in session
          if (saltData.encryption_enabled && !isEncryptionInitialized()) {
            if (userData.user?.id) {
              // Try to restore encryption from IndexedDB cache first
              const { restoreEncryptionFromCache } = await import('@/utils/encryption/keyManager');
              const restored = await restoreEncryptionFromCache(userData.user.id);
              
              if (restored) {
                console.log('[JournalEntry] Encryption restored from cache');
                return; // Encryption is now initialized
              }
              
              // If not restored from cache, try auto-initialization
              console.log('[JournalEntry] No cache found, attempting auto-initialization');
              
              // Check if user is OAuth user (no password login)
              const isOAuthUser = userData.user.app_metadata?.provider !== 'email';
              
              // Try to auto-initialize encryption for all users
              // (Both OAuth users with user.id and email users with cached master key)
              try {
                console.log('[JournalEntry] Auto-initializing encryption for', isOAuthUser ? 'OAuth' : 'email', 'user');
                console.log('[JournalEntry] Salt data:', saltData);
                const { autoInitializeEncryptionForOAuthUser } = await import('@/utils/encryption');
                await autoInitializeEncryptionForOAuthUser(userData.user.id);
                console.log('[JournalEntry] Encryption auto-initialized successfully');
              } catch (encError) {
                console.error('[JournalEntry] Failed to auto-initialize encryption:', encError);
                console.error('[JournalEntry] Error details:', encError instanceof Error ? encError.message : encError);
                
                // If auto-init fails for email users, they might need to re-login
                if (!isOAuthUser) {
                  alert('Encryption initialization failed. Please log out and log in again to re-initialize encryption.');
                } else {
                  alert('Failed to initialize encryption. Please try refreshing the page or contact support.');
                }
                return;
              }
            } else {
              console.log('[JournalEntry] User ID not found - encryption setup unavailable');
              alert('Encryption setup is temporarily unavailable. Please try again later.');
              return;
            }
          }
        }
      } catch (error) {
        console.error('[JournalEntry] Error checking encryption status:', error);
      }
    };

    checkEncryption();

  }, []);

  const getDraftOwnerKey = useCallback(() => {
    return activeUserId ? `user:${activeUserId}` : 'anonymous';
  }, [activeUserId]);

  const listDraftStorageKeys = useCallback(() => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(DRAFT_CACHE_PREFIX) || key.startsWith(LEGACY_DRAFT_PREFIX))) {
        keys.push(key);
      }
    }
    return keys;
  }, []);

  const parseVersionedDraftKey = useCallback((key: string) => {
    if (!key.startsWith(DRAFT_CACHE_PREFIX)) {
      return null;
    }
    // Key format: journal_entry_v2_<owner>_<journalId>
    // Remove prefix and find the last underscore for journalId
    const withoutPrefix = key.slice(DRAFT_CACHE_PREFIX.length + 1); // +1 for the underscore
    const lastUnderscoreIndex = withoutPrefix.lastIndexOf('_');
    if (lastUnderscoreIndex === -1) {
      return null;
    }
    const owner = withoutPrefix.slice(0, lastUnderscoreIndex);
    const journalId = withoutPrefix.slice(lastUnderscoreIndex + 1);
    if (!owner || !journalId) {
      return null;
    }
    return {
      version: '2',
      owner,
      journalId,
    };
  }, []);

  const buildVersionedDraftKey = useCallback((journalId: string, ownerKey?: string) => {
    const owner = ownerKey || (activeUserId ? `user:${activeUserId}` : 'anonymous');
    return `${DRAFT_CACHE_PREFIX}_${owner}_${journalId}`;
  }, [activeUserId]);

  const readDraftByJournalId = useCallback((journalId: string) => {
    try {
      const ownerKey = activeUserId ? `user:${activeUserId}` : 'anonymous';
      const key = buildVersionedDraftKey(journalId, ownerKey);
      const raw = localStorage.getItem(key);
      if (!raw) {
        return null;
      }
      const entry = JSON.parse(raw) as DraftCacheEntry;
      return { key, entry };
    } catch (error) {
      console.error('[JournalEntry] Error reading draft:', error);
      return null;
    }
  }, [activeUserId, buildVersionedDraftKey]);

  const writeDraftByJournalId = useCallback((journalId: string, entry: Record<string, unknown>) => {
    try {
      const ownerKey = activeUserId ? `user:${activeUserId}` : 'anonymous';
      const key = buildVersionedDraftKey(journalId, ownerKey);
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.error('[JournalEntry] Error writing draft:', error);
    }
  }, [activeUserId, buildVersionedDraftKey]);

  const removeDraftByJournalId = useCallback((journalId: string) => {
    try {
      const ownerKey = activeUserId ? `user:${activeUserId}` : 'anonymous';
      const key = buildVersionedDraftKey(journalId, ownerKey);
      localStorage.removeItem(key);
    } catch (error) {
      console.error('[JournalEntry] Error removing draft:', error);
    }
  }, [activeUserId, buildVersionedDraftKey]);

  const refreshCacheDraftSummaries = useCallback(() => {
    const now = Date.now();
    const ownerKey = getDraftOwnerKey();

    const summaries: CacheDraftSummary[] = listDraftStorageKeys()
      .map((key) => {
        const versionedMeta = parseVersionedDraftKey(key);
        if (versionedMeta && activeUserId && versionedMeta.owner !== ownerKey) {
          return null;
        }

        const raw = localStorage.getItem(key);
        if (!raw) {
          return null;
        }

        try {
          const entry = JSON.parse(raw) as Record<string, unknown>;
          const updatedAt = String(entry._cache_updated_at || entry.timestamp || new Date(0).toISOString());
          const updatedMs = Date.parse(updatedAt);
          const journalId =
            (versionedMeta?.journalId || String(entry.journal_id || '').trim() || key.replace(LEGACY_DRAFT_PREFIX, '')).trim();

          return {
            key,
            journalId,
            title: String(entry.title || '(untitled draft)'),
            updatedAt,
            isSynced: Boolean(entry._synced),
            isStale: Number.isFinite(updatedMs) ? now - updatedMs > DRAFT_CACHE_MAX_AGE_MS : true,
            sizeBytes: raw.length,
          } as CacheDraftSummary;
        } catch {
          return null;
        }
      })
      .filter((summary): summary is CacheDraftSummary => Boolean(summary))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    setCacheDraftSummaries(summaries);
  }, [activeUserId, getDraftOwnerKey, listDraftStorageKeys, parseVersionedDraftKey]);

  const removeCacheDraftByKey = useCallback(
    (key: string) => {
      localStorage.removeItem(key);
      refreshCacheDraftSummaries();
      showMessage('Removed selected cached draft.', false);
    },
    [refreshCacheDraftSummaries, showMessage]
  );

  const clearStaleCacheDrafts = useCallback(() => {
    const now = Date.now();
    const ownerKey = getDraftOwnerKey();
    let removed = 0;

    listDraftStorageKeys().forEach((key) => {
      const versionedMeta = parseVersionedDraftKey(key);
      if (versionedMeta && activeUserId && versionedMeta.owner !== ownerKey) {
        return;
      }

      const raw = localStorage.getItem(key);
      if (!raw) {
        return;
      }

      try {
        const entry = JSON.parse(raw) as Record<string, unknown>;
        const updatedMs = Date.parse(String(entry._cache_updated_at || entry.timestamp || 0));
        if (!Number.isFinite(updatedMs) || now - updatedMs > DRAFT_CACHE_MAX_AGE_MS) {
          localStorage.removeItem(key);
          removed += 1;
        }
      } catch {
        localStorage.removeItem(key);
        removed += 1;
      }
    });

    refreshCacheDraftSummaries();
    showMessage(removed > 0 ? `Removed ${removed} stale cached draft(s).` : 'No stale cached drafts found.', false);
  }, [activeUserId, getDraftOwnerKey, listDraftStorageKeys, parseVersionedDraftKey, refreshCacheDraftSummaries, showMessage]);

  const clearAllCacheDraftsForCurrentUser = useCallback(() => {
    const ownerKey = getDraftOwnerKey();
    let removed = 0;

    listDraftStorageKeys().forEach((key) => {
      const versionedMeta = parseVersionedDraftKey(key);

      if (versionedMeta) {
        if (activeUserId && versionedMeta.owner !== ownerKey) {
          return;
        }
        localStorage.removeItem(key);
        removed += 1;
        return;
      }

      // Legacy keys are not user scoped; clear them when explicit user action is taken.
      if (key.startsWith(LEGACY_DRAFT_PREFIX)) {
        localStorage.removeItem(key);
        removed += 1;
      }
    });

    refreshCacheDraftSummaries();
    showMessage(removed > 0 ? `Cleared ${removed} cached draft(s).` : 'No cached drafts to clear.', false);
  }, [activeUserId, getDraftOwnerKey, listDraftStorageKeys, parseVersionedDraftKey, refreshCacheDraftSummaries, showMessage]);

  useEffect(() => {
    if (!showSettings) {
      return;
    }

    refreshCacheDraftSummaries();
  }, [showSettings, refreshCacheDraftSummaries]);

  const normalizedViewMode = normalizeViewMode(viewMode);
  const isMinimalTextEntry = entryMode === 'text';
  const minimalBackgroundStyle = isMinimalTextEntry
    ? {
        background: isDarkMode
          ? 'radial-gradient(1200px 520px at 50% -10%, rgba(236, 72, 153, 0.2), transparent 60%), #111827'
          : 'radial-gradient(1200px 520px at 50% -10%, rgba(255, 196, 216, 0.5), transparent 60%), #FFF8F4',
      }
    : { backgroundColor: isDarkMode ? '#1F2937' : '#FFF8F4' };

  // Define default styles object
  const styles = {
    container: 'rounded-lg',
    card: 'rounded-lg border',
    input: 'rounded-lg border',
    primaryColor: currentTheme.primary,
    primaryLight: currentTheme.primary + '20',
    primaryMedium: currentTheme.primary + '35',
    bgPage: isDarkMode ? '#111827' : '#FFF8F4',
    bgCard: isDarkMode ? '#1F2937' : '#FFFFFF',
    textPrimary: isDarkMode ? '#FFFFFF' : '#000000',
    textSecondary: isDarkMode ? '#D1D5DB' : '#666666',
    borderColor: isDarkMode ? '#374151' : '#E5E7EB',
  };

  // Define moods for mood selector
  const moods = [
    { id: 'happy', name: 'Happy', label: 'Happy', emoji: '😊' },
    { id: 'sad', name: 'Sad', label: 'Sad', emoji: '😢' },
    { id: 'neutral', name: 'Neutral', label: 'Neutral', emoji: '😐' },
    { id: 'anxious', name: 'Anxious', label: 'Anxious', emoji: '😰' },
    { id: 'focused', name: 'Focused', label: 'Focused', emoji: '🎯' },
    { id: 'energetic', name: 'Energetic', label: 'Energetic', emoji: '🤩' },
  ];

  const voiceNoteUrls = React.useMemo(() => {
    const uploadedAudioUrls = mediaFiles
      .filter((media) => media.type === 'audio' && typeof media.url === 'string' && media.url.length > 0)
      .map((media) => media.url as string);

    const isStaleRecordedBlobUrl = Boolean(
      recordedVoiceUrl &&
      recordedVoiceUrl.startsWith('blob:') &&
      uploadedAudioUrls.length > 0 &&
      !uploadedAudioUrls.includes(recordedVoiceUrl)
    );

    const merged =
      recordedVoiceUrl && !isStaleRecordedBlobUrl
        ? [...uploadedAudioUrls, recordedVoiceUrl]
        : uploadedAudioUrls;

    return Array.from(new Set(merged));
  }, [mediaFiles, recordedVoiceUrl]);

  useEffect(() => {
    if (voiceNoteUrls.length === 0) {
      setActiveVoiceNoteIndex(0);
      return;
    }

    if (!recordedVoiceUrl) {
      setRecordedAudioFromUrl(voiceNoteUrls[0] as string);
      setActiveVoiceNoteIndex(0);
      return;
    }

    const index = voiceNoteUrls.indexOf(recordedVoiceUrl);
    if (index >= 0 && index !== activeVoiceNoteIndex) {
      setActiveVoiceNoteIndex(index);
      return;
    }

    if (index === -1) {
      const nextIndex = Math.min(activeVoiceNoteIndex, voiceNoteUrls.length - 1);
      setRecordedAudioFromUrl(voiceNoteUrls[nextIndex] as string);
      setActiveVoiceNoteIndex(nextIndex);
    }
  }, [voiceNoteUrls, recordedVoiceUrl, activeVoiceNoteIndex, setRecordedAudioFromUrl]);

  const handleSelectVoiceNote = (index: number) => {
    const targetUrl = voiceNoteUrls[index];
    if (!targetUrl) {
      return;
    }
    setActiveVoiceNoteIndex(index);
    if (targetUrl !== recordedVoiceUrl) {
      setRecordedAudioFromUrl(targetUrl);
    }
  };

  const handleRegenerateTranscript = useCallback(async () => {
    if (!recordedVoiceUrl) {
      return;
    }

    let recordedVoiceFile: File | null = null;

    const matchedAudio = mediaFiles.find(
      (media) => media.type === 'audio' && media.url === recordedVoiceUrl && media.file instanceof File
    );

    if (matchedAudio?.file && matchedAudio.file.size > 0) {
      recordedVoiceFile = matchedAudio.file;
    } else {
      try {
        const response = await fetch(recordedVoiceUrl);
        if (!response.ok) {
          throw new Error('Failed to fetch voice note for transcript regeneration');
        }

        const blob = await response.blob();
        const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
        recordedVoiceFile = new File(
          [blob],
          `voice_note_regenerate_${Date.now()}.${extension}`,
          { type: blob.type || 'audio/webm' }
        );
      } catch (error) {
        console.error('[JournalEntry] Failed to prepare file for transcript regeneration', error);
        showMessage('Unable to regenerate transcript right now. Please try again.', true);
        return;
      }
    }

    await generateTranscript({
      recordedVoiceFile,
      recordedVoiceUrl,
      voiceDurationSeconds,
      getVoiceFileSignature,
      setRecordedVoiceFile,
    });
  }, [
    recordedVoiceUrl,
    mediaFiles,
    generateTranscript,
    voiceDurationSeconds,
    getVoiceFileSignature,
    setRecordedVoiceFile,
    showMessage,
  ]);

  const switchEditorMode = (mode: 'writing' | 'preview') => {
    // In focus mode, change the target mode but stay in focus until explicitly exited.
    if (normalizedViewMode === 'focus') {
      setLastNonFocusViewMode(mode);
      return;
    }

    setLastNonFocusViewMode(mode);
    setViewMode(mode);
  };

  const toggleFocusMode = () => {
    if (normalizedViewMode === 'focus') {
      setViewMode(focusEntryViewMode);
      return;
    }

    if (normalizedViewMode === 'writing' || normalizedViewMode === 'preview') {
      setFocusEntryViewMode(normalizedViewMode);
      setLastNonFocusViewMode(normalizedViewMode);
    }
    setViewMode('focus');
  };

  const setViewModeFromShell = (mode: string) => {
    const normalizedMode = normalizeViewMode(mode);

    if (normalizedMode === 'focus') {
      if (normalizedViewMode === 'focus') {
        setViewMode(focusEntryViewMode);
      } else {
        if (normalizedViewMode === 'writing' || normalizedViewMode === 'preview') {
          setFocusEntryViewMode(normalizedViewMode);
          setLastNonFocusViewMode(normalizedViewMode);
        }
        setViewMode('focus');
      }
      return;
    }

    setLastNonFocusViewMode(normalizedMode);
    setViewMode(normalizedMode);
  };

  const getPersistedTitle = (candidate: string) => {
    const trimmed = candidate.trim();
    if (trimmed) {
      return trimmed;
    }
    return entryMode === 'voice' ? formatVoiceNoteTitle(date) : '';
  };

  // Handle initial reveal animation
  useEffect(() => {
    if (revealAnimation) {
      const timer = setTimeout(() => {
        setRevealAnimation(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [revealAnimation]);

  // Focus on title input when component mounts
  useEffect(() => {
    if (titleRef.current && !revealAnimation) {
      titleRef.current.focus();
    }
  }, [revealAnimation]);

  const hasDraftableData = useCallback(() => {
    const normalizedTitle = title.trim();
    const isLooseVoiceNoteTitle = /^voice note\b/i.test(normalizedTitle);
    const isPromptDerivedTitle = /^(writing|voice reflection|voice note|reflecting)\s+on\s+today's\s+prompt/i.test(normalizedTitle);
    const isDefaultUntitled = /^untitled(\s+entry)?$/i.test(normalizedTitle);
    const isOnlyDefaultVoiceTitle =
      entryMode === 'voice' &&
      normalizedTitle.length > 0 &&
      (isDefaultVoiceNoteTitle(normalizedTitle, date) || isDefaultVoiceNoteTitle(normalizedTitle, new Date()));

    const hasMeaningfulTitle =
      normalizedTitle.length > 0 &&
      !(isDefaultUntitled || isOnlyDefaultVoiceTitle || (entryMode === 'voice' && isLooseVoiceNoteTitle) || isPromptDerivedTitle);

    const hasAudioOrTranscript =
      voiceTranscript.trim().length > 0 ||
      mediaFiles.some((media) => media.type === 'audio' && (media.status === 'success' || media.status === 'uploading')) ||
      Boolean(recordedVoiceUrl);

    // In voice mode, if there is no audio recording, no transcript, and no typed content,
    // it's an unrecorded voice session - NEVER consider it draftable for autosave!
    if (entryMode === 'voice' && !hasAudioOrTranscript && content.trim().length === 0) {
      return false;
    }

    const hasSuccessfulMedia = mediaFiles.some((media) => media.status === 'success');

    // In text mode, if there is no content, no audio/transcript, no media,
    // and the title is default/prompt-derived/empty - DO NOT autosave blank entry!
    if (!hasMeaningfulTitle && content.trim().length === 0 && !hasAudioOrTranscript && !hasSuccessfulMedia) {
      return false;
    }

    return (
      hasMeaningfulTitle ||
      content.trim().length > 0 ||
      hasAudioOrTranscript ||
      hasSuccessfulMedia ||
      tags.length > 0 ||
      Boolean(selectedMood) ||
      location.trim().length > 0 ||
      weather.trim().length > 0 ||
      isFavorite ||
      isArchived
    );
  }, [
    title,
    content,
    date,
    entryMode,
    tags,
    selectedMood,
    location,
    weather,
    isFavorite,
    isArchived,
    voiceTranscript,
    mediaFiles,
    recordedVoiceUrl,
  ]);

  // Calculate word count whenever content changes and set up auto-save
  useEffect(() => {
    const hasMeaningfulDraftData = hasDraftableData();

    if (content) {
      const words = content.trim().split(/\s+/);
      setWordCount(words.length);
    } else {
      setWordCount(0);
    }

    // Only mark unsaved when meaningful user draft data exists and has actually changed.
    const isDirty = content !== lastSavedContentRef.current || title !== lastSavedTitleRef.current;
    if (isDirty && hasMeaningfulDraftData) {
      setIsUnsaved(true);
      setEntrySavedSuccessfully(false);
    } else if (!hasMeaningfulDraftData) {
      setIsUnsaved(false);
    }

    // Clear any existing auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set a new auto-save timer (save to localStorage after 3 seconds of inactivity)
    if (hasMeaningfulDraftData) {
      autoSaveTimerRef.current = setTimeout(() => {
        autoSaveToLocalStorageRef.current();
      }, 3000);
    }
  }, [content, title, tags, date, selectedMood, journalType, isFavorite, isArchived, location, weather, voiceTranscript, mediaFiles, hasDraftableData]);

  const handleExitToPreviousPage = useCallback(() => {
    const isAudioDirty = entryMode === 'voice' && (
      Boolean(recordedVoiceUrl) || 
      voiceTranscript.trim().length > 0 ||
      mediaFiles.some((media) => media.type === 'audio' && (media.status === 'success' || media.status === 'uploading'))
    );
    const isContentDirty = content !== lastSavedContentRef.current;
    const isTitleDirty = title !== lastSavedTitleRef.current;

    const hasUnsavedChanges = (isUnsaved || isContentDirty || isAudioDirty) && !entrySavedSuccessfully;

    if (hasUnsavedChanges && typeof window !== 'undefined') {
      const shouldLeave = window.confirm('You have unsaved content. Leave this page?');
      if (!shouldLeave) {
        return;
      }
    }
    navigateBackFromJournal(router);
  }, [isUnsaved, entrySavedSuccessfully, entryMode, content, title, recordedVoiceUrl, voiceTranscript, mediaFiles, router]);
  const handleFileSelect = useCallback(
    (files: FileList | null, type: 'image' | 'audio' | 'video' | 'document') => {
      // Implementation from MediaUploader component
      if (!files || files.length === 0) return;

      // Filter existing files of this type
      const existingFilesOfType = mediaFiles.filter((m) => m.type === type);

      // Check if adding these files would exceed limit
      if (existingFilesOfType.length + files.length > MEDIA_LIMITS[type].count) {
        alert(
          `You can only upload up to ${MEDIA_LIMITS[type].count} ${type} files. You already have ${existingFilesOfType.length}.`
        );
        return;
      }

      // Process each file
      const newMediaFiles: MediaFile[] = [];

      Array.from(files).forEach((file) => {
        // Check file size
        if (file.size > MEDIA_LIMITS[type].size) {
          alert(`File ${file.name} exceeds the maximum size for ${type} uploads (${MEDIA_LIMITS[type].size / (1024 * 1024)}MB)`);
          return;
        }

        newMediaFiles.push({
          file,
          type,
          progress: 0,
          id: uuidv4(),
          status: 'idle',
          url: type === 'audio' ? URL.createObjectURL(file) : undefined,
        });
      });

      setMediaFiles((prev) => [...prev, ...newMediaFiles]);
    },
    [mediaFiles, MEDIA_LIMITS]
  );

  useEffect(() => {
    if (!newlyRecordedFile) {
      return;
    }

    const container = new DataTransfer();
    container.items.add(newlyRecordedFile);
    handleFileSelect(container.files, 'audio');
    setPendingVoiceAutoUpload(true);
    if (entryMode === 'voice') {
      void generateTranscript({
        recordedVoiceFile: newlyRecordedFile,
        recordedVoiceUrl,
        voiceDurationSeconds,
        getVoiceFileSignature,
        setRecordedVoiceFile,
      });
    }
    clearNewlyRecordedFile();
  }, [
    newlyRecordedFile,
    handleFileSelect,
    clearNewlyRecordedFile,
    entryMode,
    generateTranscript,
    recordedVoiceUrl,
    voiceDurationSeconds,
    getVoiceFileSignature,
    setRecordedVoiceFile,
  ]);

  // Handle media upload process
  const handleUpload = async () => {
    if (mediaFiles.length === 0 || isUploading) return;

    // Check if there's any content (title, content, or tags) before allowing upload
    const hasContent = title.trim() || content.trim() || tags.length > 0;
    
    if (!hasContent && !currentJournalId) {
      setShowUploadAlert(true);
      return;
    }

    setIsUploading(true);

    // Get or create journalId if needed
    let journalId = currentJournalId;

    // Check if we need to create/save the journal first. If the user is
    // attempting to upload media but hasn't created a journal yet (no
    // `journalId` or a temp id), create the journal in the backend first.
    // If title/content are empty but media is present, create the journal
    // with implicit placeholder text so backend validations don't reject it.
    if (!journalId || journalId.startsWith('temp_')) {
      // Save the journal entry first to get a real journal_id
      try {
        const isTempJournal = journalId && journalId.startsWith('temp_');
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let entryData: any = {
          title: getPersistedTitle(title || ''),
          content: content || '',
          date: date || new Date().toISOString(),
          tags: tags || [],
          mood: selectedMood || null,
          journal_type: journalType || 'general',
          is_favorite: isFavorite,
          is_archived: isArchived,
          location: location || null,
          weather: weather || null,
          voice_transcript_encrypted: voiceTranscriptEncrypted,
          voice_transcript_iv: voiceTranscriptIv,
          voice_transcript_source_signature: voiceTranscriptSignature,
          voice_transcript_generated_at: voiceTranscriptGeneratedAt,
        };

        // If the user hasn't written title/content but has selected files to
        // upload, add an implicit title/content so backend creation will
        // succeed and return a journal_id we can use for media uploads.
        const hasTitle = entryData.title && String(entryData.title).trim().length > 0;
        const hasContent = entryData.content && String(entryData.content).trim().length > 0;
        if (!hasTitle && !hasContent && mediaFiles && mediaFiles.length > 0) {
          const mediaNames = mediaFiles
            .map((m) => m.file?.name || '')
            .filter(Boolean);
          const mediaLabel = mediaNames.length ? mediaNames.slice(0, 3).join(', ') : 'media';
          entryData.title = `Media: ${mediaLabel}`;
          entryData.content = `Attached media: ${mediaLabel}`;
        }

        // Ensure encryption is initialized if backend requires it. If
        // encryption is enabled server-side but not initialized client-side,
        // attempt auto-initialization (this mirrors the logic used on mount).
        try {
          const saltResp = await fetch('/api/encryption/salt');
          if (saltResp.ok) {
            const saltData = await saltResp.json();
            if (saltData.encryption_enabled && !isEncryptionInitialized()) {
              // Fetch current user id for initialization
              const userResp = await fetch('/api/user/current');
              if (!userResp.ok) {
                throw new Error('Failed to fetch user for encryption init');
              }
              const userJson = await userResp.json();
              const userId = userJson?.user?.id;
              if (!userId) {
                throw new Error('User ID not available for encryption init');
              }
              // Attempt to auto-initialize encryption (may be a no-op if already initialized)
              const { autoInitializeEncryptionForOAuthUser } = await import('@/utils/encryption');
              await autoInitializeEncryptionForOAuthUser(userId);
              if (process.env.NODE_ENV !== 'production') console.debug('[JournalEntry.handleUpload] auto-initialized encryption for user', userId);
            }
          }
        } catch (initErr) {
          console.error('[JournalEntry.handleUpload] encryption auto-init failed', initErr);
          showMessage('Encryption initialization failed — cannot upload media now.', true);
          setIsUploading(false);
          return;
        }

        // Calculate word count from CURRENT editor state BEFORE encryption
        let word_count = 0;
        let reading_time_minutes = 0;
        try {
          const { calculateJournalMetrics } = await import('@/utils/wordCount');
          // Use the current content from editor state, not from entryData which might be empty
          const currentContent = content || entryData.content || '';
          const metrics = calculateJournalMetrics(currentContent);
          word_count = metrics.word_count;
          reading_time_minutes = metrics.reading_time_minutes;
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[JournalEntry.handleUpload] calculated metrics:', { word_count, reading_time_minutes, contentLength: currentContent.length });
          }
        } catch (e) {
          console.error('Failed to calculate word metrics:', e);
        }

        // If encryption is initialized, encrypt before sending
        if (isEncryptionInitialized()) {
          try {
            const userResponse = await fetch('/api/user/current');
            const userData = await userResponse.json();
            if (userData.user?.id) {
              const promptToEncrypt = activePrompt?.text ? activePrompt : undefined;
              const enc = await encryptJournalEntry({
                title: entryData.title,
                content: entryData.content,
                prompt: promptToEncrypt,
                journal_type: entryData.journal_type,
                tags: entryData.tags,
                mood: entryData.mood,
                date: entryData.date,
                is_favorite: entryData.is_favorite,
                is_archived: entryData.is_archived,
                location: entryData.location,
                weather: entryData.weather,
                is_prompt_response: Boolean(promptToEncrypt?.text),
              }, userData.user.id);
              entryData = {
                ...entryData,
                title_encrypted: enc.title_encrypted,
                content_encrypted: enc.content_encrypted,
                title_iv: enc.title_iv,
                content_iv: enc.content_iv,
                prompt_encrypted: enc.prompt_encrypted,
                prompt_iv: enc.prompt_iv,
                is_prompt_response: enc.is_prompt_response,
                is_encrypted: true,
                title: null,
                content: null,
                word_count,
                reading_time_minutes,
              };
              if (process.env.NODE_ENV !== 'production') {
                console.debug('[JournalEntry.handleUpload] entry encrypted before save (redacted)');
              }
            }
          } catch (e) {
            console.error('Failed to encrypt before upload save, proceeding plaintext:', e);
          }
        } else {
          // If not encrypted, still include word count
          entryData = {
            ...entryData,
            word_count,
            reading_time_minutes,
          };
        }

        // Generate journal_id if not exists
        if (!journalId) {
          journalId = uuidv4();
        } else if (journalId.startsWith('temp_')) {
          journalId = uuidv4();
        }

        // Add journal_id to entry data
        entryData.journal_id = journalId;

        // Create new journal
        const response = await fetch('/api/journals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entryData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to save journal entry');
        }

        const result = await response.json();
        journalId = result.journal.journal_id;
        setCurrentJournalId(journalId);

        // If we created the journal with implicit placeholders (title/content),
        // reflect those placeholders in the visible UI so the user sees them.
        try {
          if (entryData?.title) setTitle(entryData.title);
          if (entryData?.content) setContent(entryData.content);
        } catch (uiErr) {
          // non-fatal
          if (process.env.NODE_ENV !== 'production') console.debug('[JournalEntry.handleUpload] failed to set UI title/content', uiErr);
        }

        // Update localStorage if we had a temp journal
        if (isTempJournal && currentJournalId) {
          removeDraftByJournalId(currentJournalId);
          
          // Cancel any pending backend sync for the old temp ID
          if (backendSyncTimerRef.current) {
            clearTimeout(backendSyncTimerRef.current);
            backendSyncTimerRef.current = null;
          }
        }

      } catch (error) {
        console.error('Error saving entry before upload:', error);
        setIsUploading(false);
        showMessage('Failed to save journal before upload. Please try again.', true);
        return;
      }
    }

    const uploadPromises = mediaFiles
      .filter((media) => media.status === 'idle')
      .map(async (media) => {
        try {
          const shouldUsePresignedAudioFlow =
            media.type === 'audio' &&
            voiceNoteUploadInfo?.fileName === media.file.name &&
            voiceNoteUploadInfo?.fileSize === media.file.size &&
            voiceNoteUploadInfo?.mimeType === (media.file.type || 'audio/webm');

          if (media.type === 'audio' && entryMode === 'voice' && !shouldUsePresignedAudioFlow) {
            showMessage('Preparing your voice note for upload. It will continue automatically in a moment.');
            setPendingVoiceAutoUpload(true);
            return null;
          }

          // Update status to uploading
          setMediaFiles((prev) =>
            prev.map((m) =>
              m.id === media.id ? { ...m, status: 'uploading' } : m
            )
          );

          let uploadResponseData: {
            message: string;
            media: {
              id: string;
              drive_file_id?: string;
              bucket: string;
              path: string;
              public_url: string;
              signed_url?: string;
            };
          };

          if (shouldUsePresignedAudioFlow && voiceNoteUploadInfo) {
            const attachResponse = await axios.post<{
              message: string;
              media: {
                id: string;
                bucket: string;
                path: string;
                public_url: string;
                signed_url?: string;
              };
            }>('/api/journals/media/from-upload', {
              journal_id: journalId,
              filePath: voiceNoteUploadInfo.filePath,
              fileName: voiceNoteUploadInfo.fileName,
              fileSize: voiceNoteUploadInfo.fileSize,
              mimeType: voiceNoteUploadInfo.mimeType,
            });

            uploadResponseData = {
              message: attachResponse.data.message,
              media: {
                ...attachResponse.data.media,
                drive_file_id: attachResponse.data.media.id,
              },
            };
          } else if (media.type === 'audio') {
            const presignedResponse = await fetch('/api/audio-analysis/presigned-upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: media.file.name,
                fileSize: media.file.size,
                mimeType: media.file.type || 'audio/webm',
              }),
            });

            if (!presignedResponse.ok) {
              const errorData = await presignedResponse.json().catch(() => ({}));
              throw new Error(errorData?.error || `Failed to get upload URL for ${media.file.name}`);
            }

            const uploadData = await presignedResponse.json() as {
              uploadUrl: string;
              filePath: string;
              path?: string;
            };

            console.debug('[JournalEntry] presigned upload data:', uploadData);

            const filePath = uploadData.filePath || uploadData.path;
            if (!filePath) {
              throw new Error('Audio upload URL did not return a storage path');
            }

            const putResponse = await fetch(uploadData.uploadUrl, {
              method: 'PUT',
              body: media.file,
              headers: {
                'Content-Type': media.file.type || 'audio/webm',
              },
            });

            console.debug('[JournalEntry] PUT upload response status:', putResponse.status);
            if (!putResponse.ok) {
              const text = await putResponse.text().catch(() => '');
              console.error('[JournalEntry] PUT upload failed body:', text);
              throw new Error(`Failed to upload ${media.file.name}`);
            }

            const attachResponse = await axios.post<{
              message: string;
              media: {
                id: string;
                bucket: string;
                path: string;
                public_url: string;
                signed_url?: string;
              };
            }>('/api/journals/media/from-upload', {
              journal_id: journalId,
              media_type: media.type,
              filePath,
              fileName: media.file.name,
              fileSize: media.file.size,
              mimeType: media.file.type || 'audio/webm',
              bucket: 'users_cloud',
            });

            console.debug('[JournalEntry] attachResponse.data:', attachResponse.data);

            uploadResponseData = {
              message: attachResponse.data.message,
              media: {
                ...attachResponse.data.media,
                drive_file_id: attachResponse.data.media.id,
              },
            };
          } else {
            // Create FormData for the file upload
            const formData = new FormData();
            formData.append('file', media.file);
            formData.append('journal_id', journalId as string);
            formData.append('media_type', media.type);

            // Upload to new Supabase-based media API endpoint
            const uploadResponse = await axios.post<{
              message: string;
              media: {
                id: string;
                drive_file_id?: string;
                bucket: string;
                path: string;
                public_url: string;
                signed_url?: string;
              };
            }>('/api/journals/media', formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
            });

            uploadResponseData = uploadResponse.data;
          }

          const response = uploadResponseData.media;

          // Update mediaFiles state with the Supabase response
          const updatedMedia: MediaFile = {
            ...media,
            status: 'success' as const,
            progress: 100,
            backendMediaId: response.id,
            url: response.signed_url || response.public_url,
            driveFileId: response.drive_file_id || response.id,
            driveMimeType: media.file.type
          };

          // Replace transient blob playback URL with persisted upload URL for the same note.
          if (
            media.type === 'audio' &&
            media.url &&
            recordedVoiceUrl === media.url &&
            updatedMedia.url
          ) {
            setRecordedAudioFromUrl(updatedMedia.url);
          }

          revokeBlobUrl(media.url);

          setMediaFiles((prev) =>
            prev.map((m) => (m.id === media.id ? updatedMedia : m))
          );

          // Add media to journal in database using the PATCH endpoint
          await fetch('/api/journals', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              journal_id: journalId,
              // Note: Media is handled separately via /api/journal/media
              // This just updates the journal metadata
            }),
          });

          return updatedMedia;
        } catch (error: unknown) {
          console.error('Upload error:', error);
          
          // Determine error message
          let errorMsg = 'Upload failed';
          const axiosError = error as {
            response?: { status?: number; data?: { error?: string } };
            code?: string;
            message?: string;
          };

          if (axiosError?.response) {
            if (axiosError.response?.status === 413) {
              errorMsg = 'File too large';
            } else if (axiosError.response?.status === 401) {
              errorMsg = 'Authentication required';
            } else if (axiosError.response?.data?.error) {
              errorMsg = axiosError.response.data.error;
            }
          } else if (axiosError?.code === 'ECONNABORTED' || axiosError?.message?.includes('timeout')) {
            errorMsg = 'Upload timeout';
          } else if (axiosError?.message) {
            errorMsg = axiosError.message;
          }

          // Update status to error and track failed upload
          const errorMedia = { ...media, status: 'error' as const, errorMessage: errorMsg };
          setMediaFiles((prev) =>
            prev.map((m) =>
              m.id === media.id ? errorMedia : m
            )
          );
          
          // Add to failed uploads for retry
          setFailedUploads((prev) => [...prev, errorMedia]);
          
          // Show user-friendly error message
          showMessage(`Failed to upload ${media.file.name}: ${errorMsg}`, true);

          return null;
        }
      });

    const results = await Promise.all(uploadPromises);
    setIsUploading(false);

    // Update journalMedia state with successful uploads
    const successfulUploads = results.filter(Boolean) as MediaFile[];
    if (successfulUploads.length > 0) {
      // Convert MediaFile[] to Record<string, unknown>[] for handleMediaUploadComplete
      const mediaRecords = successfulUploads.map(file => ({
        ...file,
        fileName: file.file.name,
        fileSize: file.file.size
      } as Record<string, unknown>));

      handleMediaUploadComplete(mediaRecords);

      // Update any text content if needed
      if (content || title) {
        setIsUnsaved(true);
      }
    }
  };
  handleUploadRef.current = handleUpload;

  useEffect(() => {
    if (!pendingVoiceAutoUpload || isUploading) {
      return;
    }

    const hasPendingVoiceAudio = mediaFiles.some((media) => {
      if (media.type !== 'audio' || media.status !== 'idle') {
        return false;
      }

      const fileName = media.file?.name || '';
      return fileName.startsWith('voice_note_') || fileName.startsWith('voice_note_existing');
    });

    if (!hasPendingVoiceAudio) {
      return;
    }

    if (entryMode === 'voice' && !voiceNoteUploadInfo) {
      return;
    }

    setPendingVoiceAutoUpload(false);
    void handleUploadRef.current();
  }, [pendingVoiceAutoUpload, isUploading, mediaFiles, entryMode, voiceNoteUploadInfo]);


  // Retry failed uploads
  const handleRetryFailedUploads = async () => {
    if (failedUploads.length === 0 || isUploading) return;

    // Reset failed uploads status to idle so they can be retried
    setMediaFiles((prev) =>
      prev.map((m) =>
        failedUploads.some(f => f.id === m.id) ? { ...m, status: 'idle', progress: 0 } : m
      )
    );
    
    // Clear failed uploads list
    setFailedUploads([]);
    
    // Trigger upload again
    await handleUpload();
  };

  // Handle file removal
  const handleRemoveFile = async (mediaId: string) => {
    // Find the file to be removed
    const fileToRemove = mediaFiles.find(m => m.id === mediaId);

    if (fileToRemove && fileToRemove.status === 'success') {
      try {
        // Only call the API if this is a saved journal (not a temp journal)
        if (currentJournalId && !currentJournalId.startsWith('temp_')) {
          // Remove using DB media id when available; include drive id fallback for legacy rows.
          const params = new URLSearchParams();
          if (fileToRemove.backendMediaId) {
            params.set('media_id', fileToRemove.backendMediaId);
          }
          if (fileToRemove.driveFileId) {
            params.set('drive_file_id', fileToRemove.driveFileId);
          }

          if (params.toString()) {
            await axios.delete(`/api/journals/media?${params.toString()}`);
          }
        }
      } catch (error: unknown) {
        const status = getErrorStatus(error);
        if (status !== 404) {
          console.error('Error removing file from storage:', error);
          alert('Failed to remove file. Please try again.');
          return;
        }

        // If the media is already missing on the server, continue local cleanup.
        console.warn('Media already removed on server. Continuing local cleanup.', {
          mediaId: fileToRemove.backendMediaId,
          driveFileId: fileToRemove.driveFileId,
        });
      }

      // Also update the journalMedia state after successful deletion
      const updatedMediaState = { ...journalMedia };
      const mediaType = fileToRemove.type as MediaType;
      if (mediaType === 'image' || mediaType === 'audio' || mediaType === 'video' || mediaType === 'document') {
        updatedMediaState[mediaType] = updatedMediaState[mediaType]?.filter((item) => {
          const itemDriveFileId = typeof item.driveFileId === 'string' ? item.driveFileId : '';
          const itemBackendMediaId = typeof item.backendMediaId === 'string' ? item.backendMediaId : '';
          const driveMismatch = !fileToRemove.driveFileId || itemDriveFileId !== fileToRemove.driveFileId;
          const mediaMismatch = !fileToRemove.backendMediaId || itemBackendMediaId !== fileToRemove.backendMediaId;
          return driveMismatch && mediaMismatch;
        }) || [];
        setJournalMedia(updatedMediaState);
        setIsUnsaved(true); // Mark as unsaved so changes are saved
      }
    }

    // Remove from state regardless of database operation
    revokeBlobUrl(fileToRemove?.url);
    setMediaFiles((prev) => prev.filter((m) => m.id !== mediaId));
  };
  // Auto-save to localStorage
  function autoSaveToLocalStorage() {
    // Guard against empty autosave attempts.
    if (!hasDraftableData()) {
      return;
    }

    let entryId = currentJournalId;
    if (!entryId) {
      entryId = crypto.randomUUID();
      setCurrentJournalId(entryId);
    }

    const entry = {
      journal_id: entryId,
      title: getPersistedTitle(title),
      content,
      date,
      tags,
      mood: selectedMood,
      journal_type: journalType,
      timestamp: new Date().toISOString(),
      media: journalMedia,
      is_favorite: isFavorite,
      is_archived: isArchived,
      location: location || null,
      weather: weather || null,
      voice_transcript_encrypted: voiceTranscriptEncrypted,
      voice_transcript_iv: voiceTranscriptIv,
      voice_transcript_source_signature: voiceTranscriptSignature,
      voice_transcript_generated_at: voiceTranscriptGeneratedAt,
      prompt_context: activePrompt || null,
      is_prompt_response: Boolean(activePrompt?.text),
      _synced: false, // Track if entry has been synced to backend
    };

    // If the user provided no title/content but did attach media, add implicit
    // placeholder text to the saved entry so backend validations that expect
    // non-empty fields won't fail. We do NOT update the visible inputs here.
    // IMPORTANT: Use current state values (title, content) to check if user has typed anything
    const currentHasTitle = title && title.trim().length > 0;
    const currentHasContent = content && content.trim().length > 0;
    const successfulMediaNames = mediaFiles
      .filter(m => m.status === 'success')
      .map((m) => m.file?.name || '')
      .filter(Boolean);

    // Only generate placeholder if user hasn't typed any title or content
    if (!currentHasTitle && !currentHasContent && successfulMediaNames.length > 0) {
      if (entryMode === 'voice') {
        entry.title = 'Voice Entry';
      } else {
        const mediaLabel = successfulMediaNames.slice(0, 3).join(', ') || 'media';
        entry.title = `Media: ${mediaLabel}`;
        entry.content = `Attached media: ${mediaLabel}`;
      }
    }

    // Save to localStorage
    writeDraftByJournalId(entryId, entry);
    setLastAutoSaved(new Date());
    setPendingBackendSync(true);
    setSyncStatus('local_saved');
    autoSyncRetryCountRef.current = 0;
    pendingRetryJournalIdRef.current = entryId;

    // Update savedEntries state if needed
    const existingEntryIndex = savedEntries.findIndex(e => e.journal_id === entryId);
    if (existingEntryIndex >= 0) {
      const updatedEntries = [...savedEntries];
      updatedEntries[existingEntryIndex] = entry;
      setSavedEntries(updatedEntries);
    } else {
      setSavedEntries([...savedEntries, entry]);
    }

    // Set timer for backend sync
    if (backendSyncTimerRef.current) {
      clearTimeout(backendSyncTimerRef.current);
    }
    // Schedule backend sync after 10 seconds (shorter autosave interval)
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[JournalEntry.autoSaveToLocalStorage] scheduling backend sync for', entryId);
    }
    const nextSyncDueAt = Date.now() + 10000;
    setAutoSaveSyncDueAt(nextSyncDueAt);
    backendSyncTimerRef.current = setTimeout(() => {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[JournalEntry.autoSaveToLocalStorage] triggering syncToBackend for', entryId);
      }
      syncToBackend(entryId, 'auto');
    }, 10000); // 10 sec
  }
  autoSaveToLocalStorageRef.current = autoSaveToLocalStorage;

  const ensureEncryptionReady = async (): Promise<boolean> => {
    try {
      const saltResp = await fetch('/api/encryption/salt');
      if (!saltResp.ok) {
        return false;
      }

      const saltData = await saltResp.json();
      if (!saltData?.encryption_enabled) {
        return true;
      }

      if (isEncryptionInitialized()) {
        return true;
      }

      const userResp = await fetch('/api/user/current');
      if (!userResp.ok) {
        return false;
      }

      const userJson = await userResp.json();
      const userId = userJson?.user?.id;
      if (!userId) {
        return false;
      }

      const { autoInitializeEncryptionForOAuthUser } = await import('@/utils/encryption');
      await autoInitializeEncryptionForOAuthUser(userId);
      return isEncryptionInitialized();
    } catch (err) {
      console.error('[JournalEntry] ensureEncryptionReady failed', err);
      return false;
    }
  };



  // Sync entry to backend
  const syncToBackend = async (journalId: string, source: 'auto' | 'manual' | 'flush' = 'auto'): Promise<void> => {
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine && source !== 'manual') {
        throw new Error('offline');
      }

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[JournalEntry.syncToBackend] begin', { journalId });
      }
      // Get the entry from localStorage
      let localDraft = readDraftByJournalId(journalId);
      if (!localDraft) {
        console.warn(`[JournalEntry.syncToBackend] Entry ${journalId} not found in localStorage — attempting fallback from current component state.`);

        const fallbackEntry = {
          journal_id: journalId,
          title: getPersistedTitle(title),
          content,
          date,
          tags,
          mood: selectedMood,
          journal_type: journalType,
          timestamp: new Date().toISOString(),
          media: journalMedia,
          is_favorite: isFavorite,
          is_archived: isArchived,
          location: location || null,
          weather: weather || null,
          voice_transcript_encrypted: voiceTranscriptEncrypted,
          voice_transcript_iv: voiceTranscriptIv,
          voice_transcript_source_signature: voiceTranscriptSignature,
          voice_transcript_generated_at: voiceTranscriptGeneratedAt,
          prompt_context: activePrompt || null,
          is_prompt_response: Boolean(activePrompt?.text),
          _synced: false,
        } as Record<string, unknown>;

        try {
          writeDraftByJournalId(journalId, fallbackEntry);
          localDraft = { key: buildVersionedDraftKey(journalId), entry: fallbackEntry };
          if (process.env.NODE_ENV !== 'production') console.debug('[JournalEntry.syncToBackend] fallback draft written to localStorage', { journalId });
        } catch (e) {
          console.error('[JournalEntry.syncToBackend] failed to write fallback draft', e);
          setPendingBackendSync(false);
          setAutoSaveSyncDueAt(null);
          setSyncStatus('idle');
          return;
        }
      }

      const localEntry = localDraft.entry as DraftCacheEntry;

      if (process.env.NODE_ENV !== 'production') {
        console.debug('[JournalEntry.syncToBackend] localEntry._synced', localEntry?._synced);
      }

      if (!isEncryptionInitialized()) {
        const encryptionReady = await ensureEncryptionReady();
        if (!encryptionReady) {
          showMessage('Encryption is not initialized. Please refresh or log in again before saving.', true);
          const encError = new Error('Encryption not initialized') as Error & { isNonRetryable?: boolean };
          encError.isNonRetryable = true;
          throw encError;
        }
      }

      setIsSaving(true);
      setSyncStatus('syncing');

      // Check if entry has been synced to backend (_synced flag)
      const isNewEntry = !localEntry._synced;
      const countMediaAttachments = (mediaValue: unknown): number => {
        if (!mediaValue || typeof mediaValue !== 'object') {
          return 0;
        }

        return Object.values(mediaValue as Record<string, unknown>).reduce<number>((count, value: unknown) => {
          if (Array.isArray(value)) {
            return count + value.length;
          }
          return count;
        }, 0);
      };

      if (isNewEntry) {
        // Double-check if this entry was already synced
        // by checking if a synced entry with the same journal_id exists
        const ownerKey = getDraftOwnerKey();
        const allKeys = listDraftStorageKeys().filter((key) => {
          const versionedMeta = parseVersionedDraftKey(key);
          if (versionedMeta && activeUserId && versionedMeta.owner !== ownerKey) {
            return false;
          }
          return true;
        });
        const hasRealEntry = allKeys.some(key => {
          if (key === localDraft.key) return false; // Skip self
          try {
            const entry = JSON.parse(localStorage.getItem(key) || '{}');
            // Check if this journal_id was already synced
            return entry.journal_id === journalId && entry._synced;
          } catch {
            return false;
          }
        });

        if (hasRealEntry) {
          console.log(`Entry ${journalId} already has a synced counterpart, skipping POST`);
          removeDraftByJournalId(journalId);
          setPendingBackendSync(false);
          setAutoSaveSyncDueAt(null);
          setIsUnsaved(false);
          setLastSaved(new Date());
          setSyncStatus('synced');
          return;
        }

        // Create a new entry in the backend
        // Remove media, timestamp, and _synced fields as they don't belong in journals table
        const { media, ...entryDataForAPI } = localEntry;
        delete entryDataForAPI.timestamp;
        delete entryDataForAPI._synced;

        const currentContentForGuard = String(content || entryDataForAPI.content || '').trim();
        const titleForGuard = String(entryDataForAPI.title || '').trim();
        const defaultVoiceTitle = entryMode === 'voice'
          ? formatVoiceNoteTitle(entryDataForAPI.date || date).trim()
          : '';
        const isPromptDerivedTitle = /^(writing|voice reflection|voice note|reflecting)\s+on\s+today's\s+prompt/i.test(titleForGuard);

        entryDataForAPI.save_source = source;
        entryDataForAPI.content_plaintext_length = currentContentForGuard.length;
        entryDataForAPI.media_attachment_count = countMediaAttachments(media);
        entryDataForAPI.is_default_voice_title =
          entryMode === 'voice' &&
          titleForGuard.length > 0 &&
          (titleForGuard === defaultVoiceTitle || isPromptDerivedTitle || /^voice note\b/i.test(titleForGuard));

        // GUARD: Prevent autosave from creating blank entries in database
        if (source === 'auto') {
          const hasAudioMedia = mediaFiles.some((m) => m.type === 'audio' && (m.status === 'success' || m.status === 'uploading'));
          const hasVoiceTranscript = Boolean(voiceTranscript && voiceTranscript.trim().length > 0);
          const hasRecordedAudio = Boolean(recordedVoiceUrl) || hasAudioMedia;
          const hasPlaintext = currentContentForGuard.length > 0;
          const hasMediaAttachments = countMediaAttachments(media) > 0;

          if (entryMode === 'voice' && !hasRecordedAudio && !hasVoiceTranscript && !hasPlaintext) {
            if (process.env.NODE_ENV !== 'production') {
              console.debug('[JournalEntry.syncToBackend] Skipping auto POST: voice mode has no recording, transcript, or content.');
            }
            setIsSaving(false);
            setPendingBackendSync(false);
            setAutoSaveSyncDueAt(null);
            setIsUnsaved(false);
            setSyncStatus('idle');
            return;
          }

          if (entryMode === 'text' && !hasPlaintext && !hasMediaAttachments && (isPromptDerivedTitle || !titleForGuard || titleForGuard.toLowerCase().startsWith('untitled'))) {
            if (process.env.NODE_ENV !== 'production') {
              console.debug('[JournalEntry.syncToBackend] Skipping auto POST: text mode has no content/media and default/prompt title.');
            }
            setIsSaving(false);
            setPendingBackendSync(false);
            setAutoSaveSyncDueAt(null);
            setIsUnsaved(false);
            setSyncStatus('idle');
            return;
          }
        }

        // If a stored entry lacks title/content but has media, add implicit
        // placeholders so that backend validations requiring non-empty fields
        // don't reject the autosave. This is a best-effort fallback for older
        // entries saved before this change.
        const apiHasTitle = entryDataForAPI.title && String(entryDataForAPI.title).trim().length > 0;
        const apiHasContent = entryDataForAPI.content && String(entryDataForAPI.content).trim().length > 0;
        if (!apiHasTitle && !apiHasContent) {
          if (entryMode === 'voice') {
            entryDataForAPI.title = 'Voice Entry';
            entryDataForAPI.content = entryDataForAPI.content || '';
          } else {
            try {
              const mediaNames: string[] = [];
              if (media && typeof media === 'object') {
                Object.values(media as Record<string, unknown>).forEach((arr: unknown) => {
                  if (Array.isArray(arr)) {
                    arr.forEach((f: unknown) => {
                      const fileRecord = f as { fileName?: string; file?: { name?: string } };
                      if (fileRecord.fileName) mediaNames.push(fileRecord.fileName);
                      else if (fileRecord.file?.name) mediaNames.push(fileRecord.file.name);
                    });
                  }
                });
              }
              const mediaLabel = mediaNames.length ? mediaNames.slice(0, 3).join(', ') : 'media';
              entryDataForAPI.title = `Media: ${mediaLabel}`;
              entryDataForAPI.content = `Attached media: ${mediaLabel}`;
            } catch {
              entryDataForAPI.title = 'Media upload';
              entryDataForAPI.content = 'Attached media files';
            }
          }
        }

        // Calculate word count from CURRENT editor state BEFORE encryption
        try {
          const { calculateJournalMetrics } = await import('@/utils/wordCount');
          // Use current content from editor state, not from localStorage which might be encrypted
          const currentContent = content || entryDataForAPI.content || '';
          const metrics = calculateJournalMetrics(currentContent);
          entryDataForAPI.word_count = metrics.word_count;
          entryDataForAPI.reading_time_minutes = metrics.reading_time_minutes;
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[JournalEntry.syncToBackend] calculated metrics:', { word_count: metrics.word_count, contentLength: currentContent.length });
          }
        } catch (e) {
          console.error('[JournalEntry.syncToBackend] failed to calculate word metrics', e);
        }

        // If encryption is required by the backend, ensure we encrypt here before POST.
        // Manual save path encrypts prior to POST; autosave may not. Attempt client-side encryption
        // if encryption subsystem is initialized and the entry isn't already encrypted.
        if (isEncryptionInitialized() && !entryDataForAPI.is_encrypted) {
          try {
            const userResp = await fetch('/api/user/current');
            const userJson = await userResp.json();
            const userId = userJson?.user?.id;
            if (userId) {
              const promptToEncrypt = activePrompt?.text ? activePrompt : (localEntry?.prompt_context as PromptContext | undefined);
              const encrypted = await encryptJournalEntry({
                title: entryDataForAPI.title || '',
                content: entryDataForAPI.content || '',
                prompt: promptToEncrypt,
                date: entryDataForAPI.date || new Date().toISOString(),
                mood: entryDataForAPI.mood || null,
                tags: entryDataForAPI.tags || [],
                is_favorite: entryDataForAPI.is_favorite || false,
                is_archived: entryDataForAPI.is_archived || false,
                is_prompt_response: Boolean(promptToEncrypt?.text),
              }, userId);
              entryDataForAPI.title_encrypted = encrypted.title_encrypted;
              entryDataForAPI.title_iv = encrypted.title_iv;
              entryDataForAPI.content_encrypted = encrypted.content_encrypted;
              entryDataForAPI.content_iv = encrypted.content_iv;
              entryDataForAPI.prompt_encrypted = encrypted.prompt_encrypted;
              entryDataForAPI.prompt_iv = encrypted.prompt_iv;
              entryDataForAPI.is_prompt_response = encrypted.is_prompt_response;
              entryDataForAPI.title = null;
              entryDataForAPI.content = null;
              entryDataForAPI.is_encrypted = true;
              await addTranscriptFieldsToPayload(entryDataForAPI, userId);
              if (process.env.NODE_ENV !== 'production') console.debug('[JournalEntry.syncToBackend] autosave encrypted payload prepared');
            }
          } catch (encErr) {
            console.error('[JournalEntry.syncToBackend] failed to encrypt autosave payload', encErr);
          }
        }
        
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[JournalEntry.syncToBackend] POST payload (redacted)', {
            ...entryDataForAPI,
            title_encrypted: entryDataForAPI?.title_encrypted ? '[redacted]' : null,
            content_encrypted: entryDataForAPI?.content_encrypted ? '[redacted]' : null,
          });
          try {
            console.debug('[JournalEntry.syncToBackend] POST payload (raw)', JSON.stringify(entryDataForAPI));
          } catch {
            // ignore stringify errors
          }
        }
        const response = await fetch('/api/journals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entryDataForAPI),
        });

        if (!response.ok) {
          // Try to surface server validation errors in dev
          let serverBody = '<<no body>>';
          let serverJson: Record<string, unknown> | null = null;
          try {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              const json = await response.json();
              serverJson = json as Record<string, unknown>;
              serverBody = JSON.stringify(json);
            } else {
              serverBody = await response.text();
            }
          } catch (e) {
            serverBody = `<<failed to read response body: ${e}>>`;
          }
          const logMethod = response.status >= 500 ? 'error' : 'warn';
          console[logMethod]('[JournalEntry.syncToBackend] POST failed', { status: response.status, body: serverBody });

          if (response.status === 429) {
            const retryAfterHeader = response.headers.get('retry-after');
            const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
            const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
              ? retryAfterSeconds * 1000
              : JOURNAL_SAVE_THROTTLE_WINDOW_MS;
            const throttledMessage = typeof serverJson?.error === 'string'
              ? serverJson.error
              : buildJournalSaveThrottleMessage(toRetryAfterSeconds(retryAfterMs));
            const throttledError = new Error(throttledMessage) as Error & {
              status?: number;
              retryAfterMs?: number;
              isThrottled?: boolean;
            };
            throttledError.status = 429;
            throttledError.retryAfterMs = retryAfterMs;
            throttledError.isThrottled = true;
            throw throttledError;
          }

          if (serverJson?.code === JOURNAL_AUTOSAVE_EMPTY_VOICE_CODE) {
            const skippedError = new Error(
              typeof serverJson?.error === 'string' ? serverJson.error : 'Autosave skipped.'
            ) as Error & {
              status?: number;
              code?: string;
              isNonRetryable?: boolean;
            };
            skippedError.status = response.status;
            skippedError.code = JOURNAL_AUTOSAVE_EMPTY_VOICE_CODE;
            skippedError.isNonRetryable = true;
            throw skippedError;
          }

          throw new Error(typeof serverJson?.error === 'string' ? serverJson.error : 'Failed to create journal entry in backend');
        }

        const result = await response.json();
        // Get the journal ID from backend response
        const backendJournalId = result.journal.journal_id;

        // Mark entry as synced
        const updatedEntry = {
          ...localEntry,
          ...entryDataForAPI,
          journal_id: backendJournalId,
          _synced: true,
        };

        // Update localStorage with synced flag
        writeDraftByJournalId(journalId, updatedEntry);

        // If backend returned a different ID, update it
        if (backendJournalId !== journalId) {
          removeDraftByJournalId(journalId);
          writeDraftByJournalId(backendJournalId, updatedEntry);
          setCurrentJournalId(backendJournalId);
        }

        // Update saved entries list
        const updatedEntries = savedEntries.map(e =>
          e.journal_id === journalId ? { ...updatedEntry } : e
        );
        setSavedEntries(updatedEntries);
        try {
          clearJournalPromptContext();
        } catch {
          // Ignore
        }

        // Enable media upload state after successful sync to backend
        setMediaUploadState(true);
        // DO NOT update visible UI from localStorage here - it would overwrite user's current edits
        // The placeholder text in localStorage is only for backend validation
      } else {
        // Update an existing entry
        // Remove media, timestamp, and _synced fields as they don't belong in journals table
        const { ...entryDataForAPI } = localEntry;
        delete entryDataForAPI.media;
        delete entryDataForAPI.timestamp;
        delete entryDataForAPI._synced;

        const currentContentForGuard = String(content || entryDataForAPI.content || '').trim();
        const titleForGuard = String(entryDataForAPI.title || '').trim();
        const defaultVoiceTitle = entryMode === 'voice'
          ? formatVoiceNoteTitle(entryDataForAPI.date || date).trim()
          : '';

        entryDataForAPI.save_source = source;
        entryDataForAPI.content_plaintext_length = currentContentForGuard.length;
        entryDataForAPI.media_attachment_count = countMediaAttachments(localEntry.media);
        entryDataForAPI.is_default_voice_title =
          entryMode === 'voice' &&
          titleForGuard.length > 0 &&
          titleForGuard === defaultVoiceTitle;

        // Calculate word count from CURRENT editor state BEFORE encryption
        try {
          const { calculateJournalMetrics } = await import('@/utils/wordCount');
          // Use current content from editor state, not from localStorage which might be encrypted
          const currentContent = content || entryDataForAPI.content || '';
          const metrics = calculateJournalMetrics(currentContent);
          entryDataForAPI.word_count = metrics.word_count;
          entryDataForAPI.reading_time_minutes = metrics.reading_time_minutes;
          if (process.env.NODE_ENV !== 'production') {
            console.debug('[JournalEntry.syncToBackend PUT] calculated metrics:', { word_count: metrics.word_count, contentLength: currentContent.length });
          }
        } catch (e) {
          console.error('[JournalEntry.syncToBackend] failed to calculate word metrics for PUT', e);
        }

        // For PUT/update: if encryption is initialized and the payload isn't encrypted,
        // attempt to encrypt so server validations requiring encryption pass.
        if (isEncryptionInitialized() && !entryDataForAPI.is_encrypted) {
          try {
            const userResp = await fetch('/api/user/current');
            const userJson = await userResp.json();
            const userId = userJson?.user?.id;
            if (userId) {
              const promptToEncrypt = activePrompt?.text ? activePrompt : (localEntry?.prompt_context as PromptContext | undefined);
              const encrypted = await encryptJournalEntry({
                title: entryDataForAPI.title || '',
                content: entryDataForAPI.content || '',
                prompt: promptToEncrypt,
                date: entryDataForAPI.date || new Date().toISOString(),
                mood: entryDataForAPI.mood || null,
                tags: entryDataForAPI.tags || [],
                is_favorite: entryDataForAPI.is_favorite || false,
                is_archived: entryDataForAPI.is_archived || false,
                is_prompt_response: Boolean(promptToEncrypt?.text),
              }, userId);
              entryDataForAPI.title_encrypted = encrypted.title_encrypted;
              entryDataForAPI.title_iv = encrypted.title_iv;
              entryDataForAPI.content_encrypted = encrypted.content_encrypted;
              entryDataForAPI.content_iv = encrypted.content_iv;
              entryDataForAPI.prompt_encrypted = encrypted.prompt_encrypted;
              entryDataForAPI.prompt_iv = encrypted.prompt_iv;
              entryDataForAPI.is_prompt_response = encrypted.is_prompt_response;
              entryDataForAPI.title = null;
              entryDataForAPI.content = null;
              entryDataForAPI.is_encrypted = true;
              await addTranscriptFieldsToPayload(entryDataForAPI, userId);
              if (process.env.NODE_ENV !== 'production') console.debug('[JournalEntry.syncToBackend] autosave encrypted payload prepared for PUT');
            }
          } catch (encErr) {
            console.error('[JournalEntry.syncToBackend] failed to encrypt autosave payload for PUT', encErr);
          }
        }
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[JournalEntry.syncToBackend] PUT payload (redacted)', {
            journal_id: journalId,
            ...entryDataForAPI,
            title_encrypted: entryDataForAPI?.title_encrypted ? '[redacted]' : null,
            content_encrypted: entryDataForAPI?.content_encrypted ? '[redacted]' : null,
          });
        }
        const response = await fetch('/api/journals', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            journal_id: journalId,
            ...entryDataForAPI
          }),
        });

        if (!response.ok) {
          let serverJson: Record<string, unknown> | null = null;
          try {
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              serverJson = await response.json();
            }
          } catch {
            // Ignore parse failures for fallback error handling.
          }

          const logMethod = response.status >= 500 ? 'error' : 'warn';
          console[logMethod]('[JournalEntry.syncToBackend] PUT failed', { status: response.status, body: serverJson });

          if (response.status === 429) {
            const retryAfterHeader = response.headers.get('retry-after');
            const retryAfterSeconds = retryAfterHeader ? Number.parseInt(retryAfterHeader, 10) : NaN;
            const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
              ? retryAfterSeconds * 1000
              : JOURNAL_SAVE_THROTTLE_WINDOW_MS;
            const throttledMessage = typeof serverJson?.error === 'string'
              ? serverJson.error
              : buildJournalSaveThrottleMessage(toRetryAfterSeconds(retryAfterMs));
            const throttledError = new Error(throttledMessage) as Error & {
              status?: number;
              retryAfterMs?: number;
              isThrottled?: boolean;
            };
            throttledError.status = 429;
            throttledError.retryAfterMs = retryAfterMs;
            throttledError.isThrottled = true;
            throw throttledError;
          }

          if (serverJson?.code === JOURNAL_AUTOSAVE_EMPTY_VOICE_CODE) {
            const skippedError = new Error(
              typeof serverJson?.error === 'string' ? serverJson.error : 'Autosave skipped.'
            ) as Error & {
              status?: number;
              code?: string;
              isNonRetryable?: boolean;
            };
            skippedError.status = response.status;
            skippedError.code = JOURNAL_AUTOSAVE_EMPTY_VOICE_CODE;
            skippedError.isNonRetryable = true;
            throw skippedError;
          }

          throw new Error(typeof serverJson?.error === 'string' ? serverJson.error : 'Failed to update journal entry in backend');
        }

        // Update the entry in localStorage to mark it as synced
        const updatedEntry = {
          ...localEntry,
          ...entryDataForAPI,
          _synced: true,
        };

        writeDraftByJournalId(journalId, updatedEntry);

        // Update saved entries list
        const updatedEntries = savedEntries.map(e =>
          e.journal_id === journalId ? { ...updatedEntry } : e
        );
        setSavedEntries(updatedEntries);
        try {
          clearJournalPromptContext();
        } catch {
          // Ignore
        }

        // Enable media upload state after successful sync to backend
        setMediaUploadState(true);
        // DO NOT update visible UI from localStorage here - it would overwrite user's current edits
        // The placeholder text in localStorage is only for backend validation
      }

      lastSavedContentRef.current = content;
      lastSavedTitleRef.current = title;
      setPendingBackendSync(false);
      setAutoSaveSyncDueAt(null);
      setIsUnsaved(false);
      setLastSaved(new Date());
      setSyncStatus('synced');
      autoSyncRetryCountRef.current = 0;
      pendingRetryJournalIdRef.current = null;
    } catch (error) {
      const syncError = error as Error & {
        status?: number;
        retryAfterMs?: number;
        isThrottled?: boolean;
        code?: string;
        isNonRetryable?: boolean;
      };
      const isThrottled = syncError.isThrottled || syncError.status === 429;
      const retryAfterMs = isThrottled
        ? Math.max(1000, syncError.retryAfterMs ?? JOURNAL_SAVE_THROTTLE_WINDOW_MS)
        : 0;

      if (isThrottled) {
        console.info('Sync throttled; will retry after cooldown.', {
          retryAfterMs,
          source,
        });
      } else {
        console.error('Error syncing to backend:', error);
      }

      if (isThrottled) {
        setManualSaveCooldown(retryAfterMs);
      }

      if (source === 'manual') {
        setSyncStatus('sync_failed');
      } else {
        if (syncError.isNonRetryable || syncError.code === JOURNAL_AUTOSAVE_EMPTY_VOICE_CODE) {
          setPendingBackendSync(false);
          setAutoSaveSyncDueAt(null);
          setIsUnsaved(false);
          setSyncStatus('idle');
          autoSyncRetryCountRef.current = 0;
          pendingRetryJournalIdRef.current = null;
          return;
        }

        const MAX_RETRIES = 4;
        const BASE_RETRY_MS = 5000;

        if (backendSyncTimerRef.current) {
          clearTimeout(backendSyncTimerRef.current);
          backendSyncTimerRef.current = null;
        }

        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        const retries = autoSyncRetryCountRef.current;

        if (isOffline) {
          setPendingBackendSync(true);
          setAutoSaveSyncDueAt(null);
          setSyncStatus('sync_failed');
          pendingRetryJournalIdRef.current = journalId;
        } else if (retries < MAX_RETRIES) {
          const retryDelayMs = isThrottled
            ? retryAfterMs
            : Math.min(BASE_RETRY_MS * (2 ** retries), 60000);
          autoSyncRetryCountRef.current = retries + 1;
          setPendingBackendSync(true);
          setAutoSaveSyncDueAt(Date.now() + retryDelayMs);
          setSyncStatus('local_saved');
          pendingRetryJournalIdRef.current = journalId;
          backendSyncTimerRef.current = setTimeout(() => {
            syncToBackendRef.current(journalId, source);
          }, retryDelayMs);
        } else {
          setPendingBackendSync(true);
          setAutoSaveSyncDueAt(null);
          setSyncStatus('sync_failed');
          pendingRetryJournalIdRef.current = journalId;
        }
      }
    } finally {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[JournalEntry.syncToBackend] end');
      }
      setIsSaving(false);
    }
  };
  syncToBackendRef.current = syncToBackend;

  useEffect(() => {
    const handleOnline = () => {
      const journalId = pendingRetryJournalIdRef.current || currentJournalId;
      if (!journalId) {
        return;
      }

      if (backendSyncTimerRef.current) {
        clearTimeout(backendSyncTimerRef.current);
        backendSyncTimerRef.current = null;
      }

      autoSyncRetryCountRef.current = 0;
      setPendingBackendSync(true);
      setSyncStatus('local_saved');
      setAutoSaveSyncDueAt(Date.now() + 500);

      backendSyncTimerRef.current = setTimeout(() => {
        syncToBackendRef.current(journalId, 'auto');
      }, 500);
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [currentJournalId]);

  // Ensure we attempt to sync before the page is hidden/unloaded
  useEffect(() => {
    const flushSync = () => {
      const journalId = currentJournalId;
      if (journalId) {
        try {
          // Attempt a final sync (don't await here)
          if (process.env.NODE_ENV !== 'production') console.debug('[JournalEntry] pagehide/visibilitychange - flushing sync for', journalId);
          syncToBackendRef.current(journalId, 'flush');
        } catch {
          // best-effort
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushSync();
      }
    };

    window.addEventListener('pagehide', flushSync);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', flushSync);

    return () => {
      window.removeEventListener('pagehide', flushSync);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', flushSync);
    };
  }, [currentJournalId]);

  // Define valid media types
  type MediaType = 'image' | 'audio' | 'video' | 'document';

  // Handle when media uploads are completed
  const handleMediaUploadComplete = (mediaFiles: Record<string, unknown>[]) => {
    // Group media files by type and update journal media state
    const newMediaState = { ...journalMedia };

    mediaFiles.forEach(file => {
      if (file.url && file.driveFileId && file.type) {
        // Convert MediaFile to format matching our schema
        const mediaFileRecord = {
          backendMediaId: file.backendMediaId as string | undefined,
          url: file.url as string,
          driveFileId: file.driveFileId as string,
          driveMimeType: file.driveMimeType as string || 'application/octet-stream',
          fileName: file.fileName as string,
          fileSize: file.fileSize as number,
          uploadedAt: new Date()
        };

        // Add to appropriate media type array if it's a valid media type
        const mediaType = file.type as MediaType;
        if (mediaType === 'image' || mediaType === 'audio' || mediaType === 'video' || mediaType === 'document') {
          newMediaState[mediaType] = [
            ...(newMediaState[mediaType] || []),
            mediaFileRecord,
          ];
        }
      }
    });

    setJournalMedia(newMediaState);
    // Don't set isUnsaved here - media upload already updated the journal via PUT
    // setIsUnsaved(true); // Removed to prevent duplicate backend sync
  };

  // Manual save - saves to localStorage and immediately syncs to backend
  const saveEntry = async () => {
    try {
      if (isSaving) {
        return;
      }

      const remainingCooldownMs = Math.max(0, manualSaveCooldownUntilRef.current - Date.now());
      if (remainingCooldownMs > 0) {
        showMessage(buildJournalSaveThrottleMessage(toRetryAfterSeconds(remainingCooldownMs)), true);
        return;
      }

      setIsSaving(true);
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[JournalEntry.saveEntry] start', {
          hasTitle: !!title,
          hasContent: !!content,
          mediaCount: mediaFiles.filter(m => m.status === 'success').length,
          encryptionInitialized: isEncryptionInitialized(),
        });
      }

      // Don't require title or content - allow saving with just media
      // Only validate that we have something to save (content, title, or media)
      const hasContent = title.trim() || content.trim();
      const hasMedia = mediaFiles.some((m) => m.status === 'success') || Object.values(journalMedia).some((arr) => Array.isArray(arr) && arr.length > 0);

      if (!hasContent && !hasMedia) {
        showMessage("Please add content, a title, or upload media to your journal", true);
        setIsSaving(false);
        return;
      }

      let entryId = currentJournalId;
      if (!entryId) {
        entryId = crypto.randomUUID();
        setCurrentJournalId(entryId);
      }

      // First save to localStorage
      const entry = {
        journal_id: entryId,
        title: getPersistedTitle(title),
        content, // Can be empty
        date,
        tags,
        mood: selectedMood,
        journal_type: journalType,
        timestamp: new Date().toISOString(),
        media: journalMedia,
        is_favorite: isFavorite,
        is_archived: isArchived,
        location: location || null,
        weather: weather || null,
        voice_transcript_encrypted: voiceTranscriptEncrypted,
        voice_transcript_iv: voiceTranscriptIv,
        voice_transcript_source_signature: voiceTranscriptSignature,
        voice_transcript_generated_at: voiceTranscriptGeneratedAt,
        prompt_context: activePrompt || null,
        is_prompt_response: Boolean(activePrompt?.text),
        _synced: false, // Track if entry has been synced to backend
      };

      // Check if encryption is enabled and encrypt data BEFORE saving to localStorage
      const encryptionEnabled = isEncryptionInitialized();
      if (encryptionEnabled) {
        try {
          // Fetch current user ID for encryption
          const userResponse = await fetch('/api/user/current');
          const userData = await userResponse.json();
          
          if (userData.user?.id) {
            if (process.env.NODE_ENV !== 'production') {
              console.debug('[JournalEntry.saveEntry] encrypting for user', userData.user.id);
            }
            // Encrypt title and content on client side
            const promptToEncrypt = activePrompt?.text ? activePrompt : undefined;
            const encryptedData = await encryptJournalEntry({
              title: getPersistedTitle(title || ''),
              content: content || '',
              prompt: promptToEncrypt,
              journal_type: journalType,
              tags,
              mood: selectedMood,
              date,
              is_favorite: isFavorite,
              is_archived: isArchived,
              location: location || null,
              weather: weather || null,
              is_prompt_response: Boolean(promptToEncrypt?.text),
            }, userData.user.id);

            // Override entry with encrypted fields
            Object.assign(entry, {
              title_encrypted: encryptedData.title_encrypted,
              content_encrypted: encryptedData.content_encrypted,
              title_iv: encryptedData.title_iv,
              content_iv: encryptedData.content_iv,
              prompt_encrypted: encryptedData.prompt_encrypted,
              prompt_iv: encryptedData.prompt_iv,
              is_prompt_response: encryptedData.is_prompt_response,
              is_encrypted: true,
              title: null,
              content: null,
            });

            await addTranscriptFieldsToPayload(entry, userData.user.id);
            if (process.env.NODE_ENV !== 'production') {
              console.debug('[JournalEntry.saveEntry] encrypted entry prepared');
            }
          }
        } catch (error) {
          console.error('Encryption failed:', error);
          showMessage('Failed to encrypt journal entry. Saving without encryption.', true);
        }
      }

      // If user only provided media with no title/content, add implicit
      // placeholders to the saved entry object so the backend receives
      // non-empty values. We do not modify the visible inputs here.
      // IMPORTANT: Use current state values (title, content) to check if user has typed anything
      const currentHasTitle = title && title.trim().length > 0;
      const currentHasContent = content && content.trim().length > 0;
      const successfulMediaNames = mediaFiles
        .filter(m => m.status === 'success')
        .map((m) => m.file?.name || '')
        .filter(Boolean);

      // Only generate placeholder if user hasn't typed any title or content
      if (!currentHasTitle && !currentHasContent && successfulMediaNames.length > 0) {
        if (entryMode === 'voice') {
          entry.title = 'Voice Entry';
        } else {
          const mediaLabel = successfulMediaNames.slice(0, 3).join(', ') || 'media';
          entry.title = `Media: ${mediaLabel}`;
          entry.content = `Attached media: ${mediaLabel}`;
        }
      }

      // Save to localStorage with encrypted data if encryption was successful
      writeDraftByJournalId(entryId, entry);

      // Cancel any pending auto-sync BEFORE syncing to prevent race conditions
      if (backendSyncTimerRef.current) {
        clearTimeout(backendSyncTimerRef.current);
        backendSyncTimerRef.current = null;
      }
      setAutoSaveSyncDueAt(null);
      setSyncStatus('syncing');

      // Sync to backend
      await syncToBackend(entryId, 'manual');
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[JournalEntry.saveEntry] sync complete');
      }

      lastSavedContentRef.current = content;
      lastSavedTitleRef.current = title;
      setLastSaved(new Date());
      setIsUnsaved(false);
      setPendingBackendSync(false);
      setAutoSaveSyncDueAt(null);
      setEntrySavedSuccessfully(true);
      setManualSaveCooldown(JOURNAL_SAVE_THROTTLE_WINDOW_MS);
      showMessage('Journal entry saved successfully');

      // Fetch user profile for chatbot context
      try {
        const userResponse = await fetch('/api/user/current');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUserProfile(userData.user);
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error);
      }

      // --- METRICS TRACKING ---
      // Send character count to metrics API
      const charCount = (title ? title.length : 0) + (content ? content.length : 0);
      if (charCount > 0) {
        fetch('/api/metrics/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ charactersWritten: charCount })
        });
      }
      // --- END METRICS TRACKING ---

      // --- EMBEDDING GENERATION FOR MINDMAP ---
      // Generate embedding for mind map connections (async, non-blocking)
      const contentForEmbedding = content || title || '';
      if (contentForEmbedding.length > 50 && entryId) {
        console.log('[JournalEntry] Starting embedding generation for journal_id:', entryId);
        
        // First, fetch the journal to get its database UUID (id)
        fetch(`/api/journals?journal_id=${entryId}`)
          .then(res => res.json())
          .then(data => {
            const journalDbId = data.journals?.[0]?.id;
            if (!journalDbId) {
              console.warn('[JournalEntry] Could not find database ID for journal, skipping embedding');
              return;
            }
            
            console.log('[JournalEntry] Found database ID:', journalDbId, 'for journal_id:', entryId);
            
            // Now generate the embedding with the correct database ID
            // Also pass title for category extraction
            return fetch('/api/journal-embeddings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entryId: journalDbId, // Use database UUID, not journal_id
                content: contentForEmbedding,
                title: title || '', // Pass title for category extraction
                threshold: 0.5
              })
            });
          })
          .then(res => res?.json())
          .then(result => {
            if (result) {
              console.log('[JournalEntry] Embedding generation result:', result);
              if (result.success) {
                console.log(`[JournalEntry] Created ${result.edgesCreated} connections for entry`);
              }
            }
          })
          .catch(err => console.error('[JournalEntry] Embedding generation error:', err));
      } else {
        console.log('[JournalEntry] Skipping embedding - content too short or no entry ID', {
          contentLength: contentForEmbedding.length,
          entryId
        });
      }
      // --- END EMBEDDING GENERATION ---
    } catch (error: unknown) {
      const typedError = error as Error & { status?: number; isThrottled?: boolean; retryAfterMs?: number };
      const isThrottled = typedError?.isThrottled || typedError?.status === 429;
      if (isThrottled) {
        const retryAfterMs = Math.max(1000, typedError.retryAfterMs ?? JOURNAL_SAVE_THROTTLE_WINDOW_MS);
        setManualSaveCooldown(retryAfterMs);
        showMessage(typedError.message || buildJournalSaveThrottleMessage(toRetryAfterSeconds(retryAfterMs)), true);
        console.info('Manual save throttled; waiting before retry.', { retryAfterMs });
      } else {
        console.error('Error saving journal entry:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to save journal entry';
        showMessage(`Error: ${errorMessage}`, true);
      }
    } finally {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[JournalEntry.saveEntry] end');
      }
      setIsSaving(false);
    }
  };


  // Get formatted time for display
  const getFormattedTime = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleOCRTextExtracted = (extractedText: string) => {
    // Append the extracted text to existing content
    const newContent = content ? `${content}\n\n${extractedText}` : extractedText;
    setContent(newContent);
    setIsUnsaved(true);
  };

  const mapJournalMediaToMediaFiles = useCallback(
    (mediaState: Record<string, Array<Record<string, unknown>>>) => {
      const types: Array<'image' | 'audio' | 'video' | 'document'> = ['image', 'audio', 'video', 'document'];
      const existingMediaFiles: MediaFile[] = [];

      types.forEach((type) => {
        const records = Array.isArray(mediaState[type]) ? mediaState[type] : [];
        records.forEach((record, index) => {
          const fileUrl = typeof record.url === 'string' ? record.url : '';
          if (!fileUrl) {
            return;
          }

          const fileName =
            (typeof record.fileName === 'string' && record.fileName) ||
            `${type}-file-${index}`;
          const mimeType =
            (typeof record.driveMimeType === 'string' && record.driveMimeType) ||
            `${type}/*`;
          const backendMediaId =
            typeof record.backendMediaId === 'string'
              ? record.backendMediaId
              : undefined;
          const driveFileId =
            typeof record.driveFileId === 'string'
              ? record.driveFileId
              : backendMediaId;

          existingMediaFiles.push({
            id: `cached-${backendMediaId || driveFileId || type}-${index}`,
            file: new File([], fileName, { type: mimeType }),
            type,
            progress: 100,
            status: 'success',
            backendMediaId,
            driveFileId,
            driveMimeType: mimeType,
            url: fileUrl,
          });
        });
      });

      return existingMediaFiles;
    },
    []
  );

  // Animation variants
  const contentVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };
  // Add this useEffect to load journal media
  useEffect(() => {
    const requestId = ++mediaFetchRequestRef.current;
    let cancelled = false;

    const isStaleRequest = () => cancelled || requestId !== mediaFetchRequestRef.current;

    const applyFetchedMediaFiles = (existingMediaFiles: MediaFile[]) => {
      if (isStaleRequest() || existingMediaFiles.length === 0) {
        return;
      }

      setMediaFiles(existingMediaFiles);

      if (entryMode === 'voice' && !recordedVoiceUrl) {
        const existingAudio = existingMediaFiles.find((m) => m.type === 'audio' && !!m.url);
        if (existingAudio?.url) {
          setRecordedAudioFromUrl(existingAudio.url);
        }
      }
    };

    const fetchJournalMedia = async () => {
      if (currentJournalId && !currentJournalId.startsWith('temp_')) {
        if (mediaLoadedForJournalRef.current === currentJournalId) {
          return;
        }

        if (mediaFetchInFlightRef.current === currentJournalId) {
          return;
        }

        mediaFetchInFlightRef.current = currentJournalId;

        try {
          interface MediaResponse {
            success: boolean;
            media: Array<{
              id?: string;
              media_type?: string;
              file_name?: string;
              public_url?: string;
              signed_url?: string;
              drive_file_id?: string;
              drive_mime_type?: string;
              mime_type?: string;
            }>;
          }

          const localDraft = readDraftByJournalId(currentJournalId);
          if (localDraft && !localDraft.entry?._synced) {
            mediaFetchInFlightRef.current = null;
            return;
          }

          const response = await axios.get<MediaResponse>(
            `/api/journals/media?journal_id=${currentJournalId}`,
            {
              validateStatus: (status) => status === 200 || status === 404,
            }
          );

          if (response.status === 404) {
            mediaLoadedForJournalRef.current = currentJournalId;
            return;
          }

          if (isStaleRequest()) {
            return;
          }

          if (response.data.success) {
            const existingMediaFiles: MediaFile[] = [];

            let rawMediaList: Array<{
              id?: string;
              media_type?: string;
              file_name?: string;
              public_url?: string;
              signed_url?: string;
              drive_file_id?: string;
              drive_mime_type?: string;
              mime_type?: string;
            }> = [];

            if (Array.isArray(response.data.media)) {
              rawMediaList = response.data.media;
            } else if (response.data.media && typeof response.data.media === 'object') {
              rawMediaList = Object.values(response.data.media).flatMap((items) =>
                Array.isArray(items) ? (items as typeof rawMediaList) : []
              );
            }

            rawMediaList.forEach((file, index) => {
              const type = file.media_type;
              if (type !== 'image' && type !== 'audio' && type !== 'video' && type !== 'document') {
                return;
              }

              const fileName = file.file_name || `${type}-file-${index}`;
              const fileUrl = file.signed_url || file.public_url || '';
              if (!fileUrl) {
                return;
              }

              existingMediaFiles.push({
                id: `existing-${file.id || type}-${index}`,
                // Create a placeholder file object for existing uploads.
                file: new File([], fileName, { type: file.mime_type || `${type}/*` }),
                type,
                progress: 100,
                status: 'success',
                backendMediaId: file.id,
                driveFileId: file.drive_file_id || file.id,
                driveMimeType: file.drive_mime_type || file.mime_type,
                url: fileUrl,
              });
            });

            applyFetchedMediaFiles(existingMediaFiles);
            mediaLoadedForJournalRef.current = currentJournalId;
          }
        } catch (error) {
          if (!isStaleRequest()) {
            console.error('Error fetching journal media:', error);
          }
        } finally {
          if (mediaFetchInFlightRef.current === currentJournalId) {
            mediaFetchInFlightRef.current = null;
          }
        }
      } else if (journalMedia) {
        // Fall back to journalMedia if provided and journalId is temporary
        const existingMediaFiles = mapJournalMediaToMediaFiles(journalMedia);
        applyFetchedMediaFiles(existingMediaFiles);
      }
    };

    fetchJournalMedia();

    return () => {
      cancelled = true;
    };
  }, [
    currentJournalId,
    journalMedia,
    entryMode,
    recordedVoiceUrl,
    setRecordedAudioFromUrl,
    mapJournalMediaToMediaFiles,
    readDraftByJournalId,
  ]);

  // Create a fresh new entry in the UI (client-side). This clears editor state
  // and assigns a temp journal id so the user can start a new entry immediately.
  const createNewEntry = () => {
    mediaFetchRequestRef.current += 1;
    mediaFetchInFlightRef.current = null;
    mediaLoadedForJournalRef.current = null;

    // Clear pending timers
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (backendSyncTimerRef.current) {
      clearTimeout(backendSyncTimerRef.current);
      backendSyncTimerRef.current = null;
    }

    const tempId = `temp_${crypto.randomUUID()}`;
    const todayIso = new Date().toISOString().split('T')[0] ?? '';
    setCurrentJournalId(tempId);
    setDate(todayIso);
    setTitle(entryMode === 'voice' ? formatVoiceNoteTitle(todayIso) : '');
    setContent('');
    setTags([]);
    setNewTag('');
    setSelectedMood(null);
    setIsFavorite(false);
    setIsArchived(false);
    setLocation('');
    setWeather('');
    mediaFiles.forEach((media) => revokeBlobUrl(media.url));
    setMediaFiles([]);
    setJournalMedia({ image: [], audio: [], video: [], document: [] });
    setIsUnsaved(false);
    setPendingBackendSync(false);
    setAutoSaveSyncDueAt(null);
    setSyncStatus('idle');
    setLastSaved(null);
    setViewMode('writing');
    setShowMetadata(false);
    setShowVoiceTextEditor(entryMode !== 'voice');
    setPendingVoiceAutoUpload(false);
    resetVoiceRecording();
    resetTranscriptState();
    showMessage('Ready for a new entry', false);

    setTimeout(() => {
      try {
        titleRef.current?.focus();
      } catch {
        // Ignore focus errors in environments that block programmatic focus.
      }
    }, 50);
  };

  const handleReRecordFirstNote = async () => {
    if (voiceNoteUrls.length !== 1) {
      return;
    }

    const confirmed = window.confirm(
      'Re-record will delete your current voice note and transcript. Continue?'
    );

    if (!confirmed) {
      return;
    }

    const audioMediaIds = mediaFiles.filter((file) => file.type === 'audio').map((file) => file.id);

    for (const mediaId of audioMediaIds) {
      // Reuse remove flow so cloud/local cleanup stays consistent.
      await handleRemoveFile(mediaId);
    }

    setPendingVoiceAutoUpload(false);
    setActiveVoiceNoteIndex(0);
    resetVoiceRecording();
    resetTranscriptState();
    void startVoiceRecording();
  };

  const voiceContentProps = {
    showVoiceTextEditor,
    setShowVoiceTextEditor,
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
    updateVoiceTranscript,
    handleRegenerateTranscript,
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
  };

  const journalContentProps = {
    journalType,
    journalTypes,
    tags,
    setTags,
    newTag,
    setNewTag,
  };

  const mediaContentProps = {
    handleFileSelect,
    MEDIA_LIMITS,
    isUploading,
    mediaFiles,
    setShowOCRUpload,
    handleRemoveFile,
    handleUpload,
    failedUploads,
    isDarkMode,
    handleRetryFailedUploads,
  };

  const editorContentProps = {
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
  };

  const metaContentProps = {
    isFavorite,
    setIsFavorite,
    showMetadata,
    setShowMetadata,
    saveEntry,
    isSaving,
    manualSaveCooldownSeconds,
    entrySavedSuccessfully,
    setShowChatbot,
    savedEntries,
    currentJournalId,
    createNewEntry,
    location,
    setLocation,
    weather,
    setWeather,
    isArchived,
    setIsArchived,
    showAnalysis,
    analysisResult,
  };

  const cacheOwnerLabel = activeUserId ? `user:${activeUserId}` : 'anonymous';

  return (
    <div
      className="flex flex-col h-screen transition-all duration-300"
      style={{ backgroundColor: isDarkMode ? '#1F2937' : '#FFF8F4' }}
    >
      <ThemeSidebar />
      {/* Success Message Toast */}
      {successMessage && (
        <Toast message={successMessage} type="success" visible={true} duration={3000} />
      )}

      {/* Error Message Toast */}
      {errorMessage && (
        <Toast message={errorMessage} type="error" visible={true} duration={2000} />
      )}

      <JournalEntryShell
        isMinimalTextEntry={isMinimalTextEntry}
        showSettings={showSettings}
        entryMode={entryMode}
        date={date}
        setDate={setDate}
        styles={styles}
        isDarkMode={isDarkMode}
        onToggleFocusMode={toggleFocusMode}
        viewMode={normalizedViewMode}
        isSaving={isSaving}
        manualSaveCooldownSeconds={manualSaveCooldownSeconds}
        onSave={saveEntry}
        onSwitchMode={switchEditorMode}
        lastNonFocusViewMode={lastNonFocusViewMode}
        showVoiceTextEditor={showVoiceTextEditor}
        onToggleVoiceTextEditor={() => setShowVoiceTextEditor((prev) => !prev)}
        isUnsaved={isUnsaved}
        lastSavedLabel={getFormattedTime(lastSaved)}
        isFavorite={isFavorite}
        onToggleFavorite={() => setIsFavorite(!isFavorite)}
        tags={tags}
        newTag={newTag}
        setNewTag={setNewTag}
        setTags={setTags}
        isRecordingActive={voiceRecordingState === 'recording'}
        journalType={journalType}
        setJournalType={setJournalType}
        setViewMode={setViewModeFromShell}
        journalTypes={journalTypes}
        viewModes={viewModes}
        cacheOwnerLabel={cacheOwnerLabel}
        cacheDrafts={cacheDraftSummaries}
        onRefreshCache={refreshCacheDraftSummaries}
        onRemoveCacheDraft={removeCacheDraftByKey}
        onClearStaleCache={clearStaleCacheDrafts}
        onClearAllCacheDraftsForCurrentUser={clearAllCacheDraftsForCurrentUser}
        onExit={handleExitToPreviousPage}
        entrySavedSuccessfully={entrySavedSuccessfully}
      />

      <JournalEntryMainContent
        isMinimalTextEntry={isMinimalTextEntry}
        minimalBackgroundStyle={minimalBackgroundStyle}
        entrySavedSuccessfully={entrySavedSuccessfully}
        isUnsaved={isUnsaved}
        onExit={handleExitToPreviousPage}
        contentVariants={contentVariants}
        revealAnimation={revealAnimation}
        normalizedViewMode={normalizedViewMode}
        entryMode={entryMode}
        editorRef={editorRef}
        content={content}
        onContentChange={setContent}
        styles={styles}
        itemVariants={itemVariants}
        promptContext={activePrompt || promptContext}
        titleRef={titleRef}
        title={title}
        onTitleChange={setTitle}
        onTitleFocus={() => setIsTitleFocused(true)}
        onTitleBlur={() => setIsTitleFocused(false)}
        isTitleFocused={isTitleFocused}
        isDarkMode={isDarkMode}
        date={date}
        selectedMood={selectedMood}
        moods={moods}
        voiceTextContentProps={{
          entryMode,
          viewMode: normalizedViewMode,
          styles,
          itemVariants,
          isDarkMode,
          voice: voiceContentProps,
          journal: journalContentProps,
          media: mediaContentProps,
          editor: editorContentProps,
          meta: metaContentProps,
        }}
      />

      <JournalEntryAuxWrapper
        showUploadAlert={showUploadAlert}
        isDarkMode={isDarkMode}
        elementTextColor={elementColors.text}
        primaryColor={currentTheme.primary}
        onCloseUploadAlert={() => setShowUploadAlert(false)}
        showOCRUpload={showOCRUpload}
        onTextExtracted={handleOCRTextExtracted}
        onCloseOCR={() => setShowOCRUpload(false)}
        showChatbot={showChatbot}
        entrySavedSuccessfully={entrySavedSuccessfully}
        onCloseChatbot={() => setShowChatbot(false)}
        journalEntry={{
          title: getPersistedTitle(title),
          content: content || '',
          voiceTranscript: voiceTranscript || undefined,
          tags,
          mood: selectedMood || undefined,
          date,
        }}
        userProfile={userProfile || undefined}
      />
    </div>
  );
};

export default JournalEntry;
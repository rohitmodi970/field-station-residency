"use client"
/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '@/utilities/context/ThemeContext';
import { Calendar, Clock, Image, Mic, Video, FileText, ArrowLeft, Save, XCircle, Upload, Tag, Trash2, Heart, Archive, ArchiveRestore, Plus, X, Check, AlertTriangle, ZoomIn, Share2, Globe, Copy, CheckCircle, ScanLine, Sparkles } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import ThemeSidebar from '@/components/Navbar/ThemeSidebar';
import Toast from '@/components/ui/toast';
import AnimatedLoader from '@/components/Loader';
import ErrorScreen from '@/components/ErrorScreen';
import { DeleteConfirmationModal } from '@/components/DeleteConfirmationModal';
import { encryptJournalEntry } from '@/utils/encryption/journalEncryption';
import { isEncryptionInitialized, initializeEncryption, getEncryptionKey } from '@/utils/encryption/keyManager';
import { decryptText } from '@/utils/encryption/crypto';
import { getCachedJournalKey } from '@/utils/encryption/collaborationCrypto';
import { useCollabSession } from '@/hooks/useCollabSession';

import MediaModal from '@/components/MediaModal';
import OCRInsertPanel from '@/components/Journal/JournalEntry/OCRInsertPanel';
// Types
interface Media {
  driveFileId: string;
  name?: string;
  fileName?: string;
  mimeType?: string;
  driveMimeType?: string;
  thumbnailUrl?: string;
  url?: string;
  createdAt?: string;
  uploadedAt?: string;
  fileSize?: number;
  mediaId?: string; // For deletion
}

interface JournalMedia {
  image: Media[];
  audio: Media[];
  video: Media[];
  document: Media[];
}

interface Journal {
  id: string;
  journalId: string;
  title: string;
  content: string;
  voiceTranscript?: string;
  voice_transcript_encrypted?: string | null;
  voice_transcript_iv?: string | null;
  prompt?: { text: string; explanation?: string } | null;
  prompt_encrypted?: string | null;
  prompt_iv?: string | null;
  is_prompt_response?: boolean;
  date: string;
  mood: string;
  moodColor: string;
  tags: string[];
  media: JournalMedia;
  timestamp?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  is_favorite: boolean;
  is_archived: boolean;
  is_public?: boolean;
  published_at?: string;
  published_share_id?: string;
  // Collaboration fields (Phase 3)
  is_collaborative?: boolean;
  collab_key_version?: number;
}

type ToastType = 'success' | 'error' | 'warning' | 'info';

const JournalPage = () => {
  const params = useParams();
  const router = useRouter();
  const journalId = params.journalId as string;
  const { currentTheme, isDarkMode, elementColors, pageBackground, currentFont } = useTheme();

  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [editedJournal, setEditedJournal] = useState<Partial<Journal>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [redirectTimer, setRedirectTimer] = useState(5);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');

  // ── Phase 3: Collaboration session ───────────────────────────────────────
  const isCollaborative    = journal?.is_collaborative ?? false;
  const collabKeyVersion   = journal?.collab_key_version ?? 1;
  const hasJournalKey      = isCollaborative && getCachedJournalKey(journalId) != null;

  const collabSession = useCollabSession({
    journalId,
    enabled:    hasJournalKey,
    keyVersion: collabKeyVersion,
  });

  // Show a toast if kicked (access revoked / key rotated)
  useEffect(() => {
    if (!collabSession.kickReason) return;
    const msgs: Record<string, string> = {
      access_revoked:    'Your access to this journal has been revoked.',
      key_rotated:       'Journal encryption key was rotated. Please reload.',
      ownership_changed: 'Journal ownership changed. Please reload.',
    };
    setError(msgs[collabSession.kickReason] ?? 'Disconnected from collaboration session.');
  }, [collabSession.kickReason]);
  const [selectedMedia, setSelectedMedia] = useState<{
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  name: string;
  mimeType?: string;
} | null>(null);
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: ToastType;
  }>({
    visible: false,
    message: '',
    type: 'info'
  });
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [includeMedia, setIncludeMedia] = useState(false);
  const [includeAnalysis, setIncludeAnalysis] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [anonymousAlias, setAnonymousAlias] = useState('');
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [showCopied, setShowCopied] = useState(false);
  const [hasChangesAfterPublish, setHasChangesAfterPublish] = useState(false);
  const [originalPublishedContent, setOriginalPublishedContent] = useState<{title: string; content: string} | null>(null);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [promptContext, setPromptContext] = useState<{ text: string; explanation?: string } | null>(null);
  const [isPromptResponse, setIsPromptResponse] = useState<boolean>(false);



  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ visible: true, message, type });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, visible: false }));
  };

  const moodOptions = [
    { label: 'Happy', value: 'Happy', color: 'yellow', hex: '#FCD34D' },
    { label: 'Sad', value: 'Sad', color: 'blue', hex: '#60A5FA' },
    { label: 'Excited', value: 'Excited', color: 'orange', hex: '#FBBF24' },
    { label: 'Peaceful', value: 'Peaceful', color: 'blue', hex: '#93C5FD' },
    { label: 'Anxious', value: 'Anxious', color: 'purple', hex: '#A78BFA' },
    { label: 'Frustrated', value: 'Frustrated', color: 'red', hex: '#F87171' },
    { label: 'Grateful', value: 'Grateful', color: 'green', hex: '#34D399' },
    { label: 'Optimistic', value: 'Optimistic', color: 'green', hex: '#6EE7B7' },
    { label: 'Stressed', value: 'Stressed', color: 'purple', hex: '#C084FC' },
    { label: 'Thoughtful', value: 'Thoughtful', color: 'purple', hex: '#A78BFA' },
    { label: 'Angry', value: 'Angry', color: 'red', hex: '#EF4444' },
    { label: 'Neutral', value: 'Neutral', color: 'gray', hex: '#9CA3AF' }
  ];
useEffect(() => {
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && selectedMedia) {
      setSelectedMedia(null);
    }
  };
  window.addEventListener('keydown', handleEsc);
  return () => window.removeEventListener('keydown', handleEsc);
}, [selectedMedia]);
  const getMoodColorHex = (colorName: string): string => {
    const foundMood = moodOptions.find(mood => mood.color === colorName);
    return foundMood ? foundMood.hex : '#9CA3AF';
  };

  // Helper to parse date properly (handles ISO 8601 with timezone)
  const parseJournalDate = (dateString?: string): Date => {
    // Return current date if no dateString provided or it's falsy
    if (!dateString) return new Date();
    
    // If it's just a date (YYYY-MM-DD) without time, parse it as local midnight 
    // to prevent timezone offsets from making it look like a weird time (e.g., 05:30 AM)
    if (dateString.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number) as [number, number, number];
      return new Date(year, month - 1, day);
    }
    
    // Parse ISO 8601 dates properly (e.g., "2025-12-04T18:50:12.563721+00:00")
    return new Date(dateString);
  };

  // Get the actual journal entry date (date > timestamp > created_at)
  const getJournalDateTime = (): Date => {
    const dateSource = journal?.date || journal?.timestamp || journal?.created_at;
    return parseJournalDate(dateSource);
  };

  // Returns a relative time string like "3 days ago", "just now", etc.
  const getTimeAgo = (dateString?: string): string => {
    if (!dateString) return '-';
    const date = parseJournalDate(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
    if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
    return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
  };

  const formatVoiceNoteTitle = (dateValue?: string | Date): string => {
    const parsed = typeof dateValue === 'string' ? parseJournalDate(dateValue) : (dateValue || new Date());
    return `Voice Note ${parsed.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })}`;
  };

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return '';
    const date = parseJournalDate(dateString);
    
    // Check if it's an invalid date
    if (isNaN(date.getTime())) return '';
    
    // Format to YYYY-MM-DDThh:mm in local time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const getButtonStyle = (variant: 'primary' | 'secondary' | 'danger' = 'primary'): React.CSSProperties => {
    if (variant === 'primary') {
      return {
        backgroundColor: '#8f6248',
        color: '#ffffff',
      };
    } else if (variant === 'secondary') {
      return {
        backgroundColor: isDarkMode ? '#3f3430' : '#f6ece3',
        color: isDarkMode ? '#eadfd7' : '#5f473b',
      };
    } else if (variant === 'danger') {
      return {
        backgroundColor: '#EF4444',
        color: '#ffffff',
      };
    }
    // fallback to an empty style object to satisfy return type
    return {};
  };

  // Initialize encryption
  useEffect(() => {
    async function initEncryption() {
      try {
        if (isEncryptionInitialized()) return;

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const isOAuthUser = user.app_metadata?.provider !== 'email';
          
          if (isOAuthUser) {
            const { autoInitializeEncryptionForOAuthUser } = await import('@/utils/encryption');
            await autoInitializeEncryptionForOAuthUser(user.id);
          } else {
            // For email/password users, restore from IndexedDB cache
            const { restoreEncryptionFromCache } = await import('@/utils/encryption');
            await restoreEncryptionFromCache(user.id);
          }
        }
      } catch (err) {
        console.error('Failed to initialize encryption:', err);
      } finally {
        setEncryptionReady(true);
      }
    }
    initEncryption();
  }, []);

  // Check auth
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
      }
      setAuthLoading(false);
    }
    checkAuth();
  }, [router]);

  // Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (deleteSuccess && redirectTimer > 0) {
      interval = setInterval(() => {
        setRedirectTimer(prev => prev - 1);
      }, 1000);
    } else if (deleteSuccess && redirectTimer === 0) {
      router.push('/journal');
    }
    return () => clearInterval(interval);
  }, [deleteSuccess, redirectTimer, router]);

  // Fetch journal
  useEffect(() => {
    const fetchJournalData = async () => {
      try {
        setLoading(true);
        
        const journalResponse = await fetch(`/api/journals/${journalId}`);
        
        if (!journalResponse.ok) {
          throw new Error('Failed to fetch journal entry');
        }
        
        const data = await journalResponse.json();
        let journalData = data.journal;
        let mediaArray = data.media || [];

        // Fallback for environments where single-journal route returns no media rows.
        if ((!Array.isArray(mediaArray) || mediaArray.length === 0) && journalData?.journal_id) {
          try {
            const mediaResponse = await fetch(`/api/journals/media?journal_id=${journalData.journal_id}`);
            if (mediaResponse.ok) {
              const mediaPayload = await mediaResponse.json();
              if (mediaPayload?.success && Array.isArray(mediaPayload.media)) {
                mediaArray = mediaPayload.media;
              }
            }
          } catch (mediaFallbackError) {
            console.error('Failed loading media fallback:', mediaFallbackError);
          }
        }
        
        // Transform media array into grouped format
        const mediaByType: JournalMedia = {
          image: [],
          audio: [],
          video: [],
          document: []
        };
        
        for (const media of mediaArray) {
          const type = media.media_type as keyof JournalMedia;
          if (mediaByType[type]) {
            // Get signed URL if Supabase storage
            let url = media.signed_url || media.public_url;
            if (media.storage_provider === 'supabase' && media.bucket && media.path) {
              try {
                // Call API route to get signed URL (can't use admin client on frontend)
                const response = await fetch('/api/media/signed-url', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    bucket: media.bucket,
                    path: media.path,
                    expiresIn: 3600
                  })
                });
                
                if (response.ok) {
                  const data = await response.json();
                  url = data.signedUrl;
                }
              } catch (err) {
                console.error('Failed to get signed URL:', err);
              }
            }
            
            mediaByType[type].push({
              driveFileId: media.drive_file_id || media.id,
              name: media.file_name,
              fileName: media.file_name,
              mimeType: media.mime_type,
              driveMimeType: media.drive_mime_type,
              thumbnailUrl: media.thumbnail_url,
              url: url,
              createdAt: media.created_at,
              uploadedAt: media.created_at,
              fileSize: media.file_size,
              mediaId: media.id, // Add media ID for deletion
            });
          }
        }
        
        journalData.media = mediaByType;
        
        const { getJournalEntryById } = await import('@/utilities/journal-data');
        const decryptedEntry = await getJournalEntryById(journalId);
        
        if (decryptedEntry) {
          journalData = {
            ...journalData,
            title: decryptedEntry.title,
            content: decryptedEntry.content,
          };
        }

        let decryptedVoiceTranscript = '';
        try {
          if (
            journalData?.voice_transcript_encrypted &&
            journalData?.voice_transcript_iv &&
            isEncryptionInitialized() &&
            user?.id
          ) {
            const key = await getEncryptionKey(user.id);
            decryptedVoiceTranscript = await decryptText(
              journalData.voice_transcript_encrypted,
              journalData.voice_transcript_iv,
              key
            );
          }
        } catch (voiceDecryptError) {
          console.warn('Failed to decrypt voice transcript:', voiceDecryptError);
        }

        let decryptedPrompt: { text: string; explanation?: string } | null = null;
        try {
          if (
            journalData?.prompt_encrypted &&
            journalData?.prompt_iv &&
            isEncryptionInitialized() &&
            user?.id
          ) {
            const key = await getEncryptionKey(user.id);
            const rawPromptText = await decryptText(
              journalData.prompt_encrypted,
              journalData.prompt_iv,
              key
            );
            try {
              decryptedPrompt = JSON.parse(rawPromptText);
            } catch {
              decryptedPrompt = { text: rawPromptText };
            }
          }
        } catch (promptDecryptError) {
          console.warn('Failed to decrypt prompt:', promptDecryptError);
        }

        if (!decryptedPrompt && decryptedEntry?.prompt) {
          decryptedPrompt = decryptedEntry.prompt;
        }

        const isPrompt = Boolean(
          journalData?.is_prompt_response ||
          decryptedEntry?.is_prompt_response ||
          decryptedPrompt?.text ||
          journalData?.prompt_encrypted
        );

        setPromptContext(decryptedPrompt);
        setIsPromptResponse(isPrompt);
        journalData.prompt = decryptedPrompt;
        journalData.is_prompt_response = isPrompt;

        const resolvedTitle = (journalData.title || '').trim();
        const hasVoiceData = Boolean(decryptedVoiceTranscript.trim()) || mediaByType.audio.length > 0;
        if (!resolvedTitle && hasVoiceData) {
          const voiceDateSource = journalData?.timestamp || journalData?.updated_at || journalData?.date || journalData?.created_at;
          journalData.title = formatVoiceNoteTitle(voiceDateSource);
        }

        setVoiceTranscript(decryptedVoiceTranscript);
        console.log('Decrypted Entry:', decryptedEntry);
        console.log('Media loaded:', mediaByType);
        setJournal(journalData);
        setEditedJournal({
          title: journalData.title || (hasVoiceData ? formatVoiceNoteTitle(journalData?.date || journalData?.created_at) : ''),
          content: journalData.content || '',
          date: journalData.date,
          mood: journalData.mood,
          tags: journalData.tags || [],
        });
        
        // Store original published content if journal is public
        if (journalData.is_public) {
          setOriginalPublishedContent({
            title: journalData.title,
            content: journalData.content,
          });
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching journal:', err);
        setError('Unable to load journal. Please try again later.');
        setLoading(false);
      }
    };

    if (journalId && encryptionReady && !authLoading) {
      fetchJournalData();
    }
  }, [journalId, encryptionReady, authLoading, user?.id]);

  const handleDeleteJournal = async () => {
    try {
      setIsDeleting(true);
      
      const response = await fetch(`/api/journals?journal_id=${journalId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete journal');
      }
      
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setDeleteSuccess(true);
      showToast('Journal deleted successfully! Redirecting...', 'success');
      
    } catch (err: any) {
      console.error('Error deleting journal:', err);
      setIsDeleting(false);
      showToast(`Failed to delete journal: ${err.message}`, 'error');
    }
  };

  const handleToggleFavorite = async () => {
    if (!journal) return;
    
    try {
      const newValue = !journal.is_favorite;
      
      const response = await fetch('/api/journals/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journal_id: journalId,
          field: 'is_favorite',
          value: newValue,
        }),
      });

      if (!response.ok) throw new Error('Failed to toggle favorite');

      setJournal(prev => prev ? { ...prev, is_favorite: newValue } : null);
      showToast(newValue ? 'Added to favorites!' : 'Removed from favorites', 'success');
    } catch (err: any) {
      showToast(`Failed to update favorite: ${err.message}`, 'error');
    }
  };

  const handleToggleArchive = async () => {
    if (!journal) return;
    
    try {
      const newValue = !journal.is_archived;
      
      const response = await fetch('/api/journals/toggle', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journal_id: journalId,
          field: 'is_archived',
          value: newValue,
        }),
      });

      if (!response.ok) throw new Error('Failed to toggle archive');

      setJournal(prev => prev ? { ...prev, is_archived: newValue } : null);
      showToast(newValue ? 'Journal archived!' : 'Journal unarchived', 'success');
    } catch (err: any) {
      showToast(`Failed to update archive: ${err.message}`, 'error');
    }
  };

  const handlePublish = async () => {
    if (!journal) return;
    
    try {
      setPublishing(true);

      // If user wants to include analysis, fetch and decrypt it
      let analysisSnapshot = null;
      if (includeAnalysis) {
        try {
          const analysisRes = await fetch(`/api/journal/${journalId}/analysis`);
          if (analysisRes.ok) {
            const { analyses } = await analysisRes.json();
            if (analyses && analyses.length > 0) {
              const latestAnalysis = analyses[0];
              if (latestAnalysis.result_encrypted && latestAnalysis.result_iv && user?.id) {
                const key = await getEncryptionKey(user.id);
                const decrypted = await decryptText(
                  latestAnalysis.result_encrypted,
                  latestAnalysis.result_iv,
                  key
                );
                analysisSnapshot = JSON.parse(decrypted);
              }
            }
          }
        } catch (analysisErr) {
          console.warn('Could not fetch/decrypt analysis for publish:', analysisErr);
          // Continue publishing without analysis rather than failing
        }
      }
      
      const response = await fetch(`/api/journal/${journalId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          include_media: includeMedia,
          media_mode: 'signed',
          snapshot_title: journal.title,
          snapshot_content: journal.content,
          is_anonymous: isAnonymous,
          anonymous_alias: isAnonymous ? anonymousAlias || undefined : undefined,
          include_analysis: includeAnalysis,
          snapshot_analysis: analysisSnapshot,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to publish');
      }

      const result = await response.json();
      
      setJournal(prev => prev ? {
        ...prev,
        is_public: true,
        published_at: result.data.published_at,
        published_share_id: result.data.share_id,
      } : null);
      
      setOriginalPublishedContent({
        title: journal.title,
        content: journal.content,
      });
      setHasChangesAfterPublish(false);
      setPublicUrl(result.data.public_url);
      showToast('Journal published successfully!', 'success');
      setShowPublishDialog(false);
      
    } catch (err: any) {
      showToast(`Failed to publish: ${err.message}`, 'error');
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!journal) return;
    
    try {
      const response = await fetch(`/api/journal/${journalId}/unpublish`, {
        method: 'PATCH',
      });

      if (!response.ok) throw new Error('Failed to unpublish');

      setJournal(prev => prev ? { ...prev, is_public: false } : null);
      setPublicUrl(null);
      setOriginalPublishedContent(null);
      setHasChangesAfterPublish(false);
      showToast('Journal unpublished', 'success');
    } catch (err: any) {
      showToast(`Failed to unpublish: ${err.message}`, 'error');
    }
  };

  const copyPublicUrl = () => {
    // Prefer username-based canonical URL; fall back to /p/ legacy URL
    const url = publicUrl || (journal?.published_share_id ? `${window.location.origin}/p/${journal.published_share_id}` : '');
    navigator.clipboard.writeText(url);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const handleUpdatePublished = async () => {
    if (!journal) return;
    
    try {
      setPublishing(true);
      
      // Unpublish old version first
      await fetch(`/api/journal/${journalId}/unpublish`, {
        method: 'DELETE', // Use DELETE to remove old record
      });
      
      // Publish new version
      const response = await fetch(`/api/journal/${journalId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          include_media: includeMedia,
          media_mode: 'signed',
          snapshot_title: journal.title,
          snapshot_content: journal.content,
          include_analysis: includeAnalysis,
          snapshot_analysis: null, // Snapshot refreshed via full re-publish (handlePublish)
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update published journal');
      }

      const result = await response.json();
      
      setJournal(prev => prev ? {
        ...prev,
        is_public: true,
        published_at: result.data.published_at,
        published_share_id: result.data.share_id,
      } : null);
      
      setOriginalPublishedContent({
        title: journal.title,
        content: journal.content,
      });
      setHasChangesAfterPublish(false);
      showToast('Published journal updated successfully!', 'success');
      
    } catch (err: any) {
      showToast(`Failed to update: ${err.message}`, 'error');
    } finally {
      setPublishing(false);
    }
  };



  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditedJournal(prev => ({ ...prev, [name]: value }));
    
    // Check if content has changed after publishing
    if (journal?.is_public && originalPublishedContent) {
      const titleChanged = name === 'title' && value !== originalPublishedContent.title;
      const contentChanged = name === 'content' && value !== originalPublishedContent.content;
      
      if (titleChanged || contentChanged) {
        setHasChangesAfterPublish(true);
      }
    }
  };

  const handleMoodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedMood = e.target.value;
    const selectedMoodOption = moodOptions.find(option => option.value === selectedMood);
    
    setEditedJournal(prev => ({
      ...prev,
      mood: selectedMood,
      moodColor: selectedMoodOption ? selectedMoodOption.color : 'gray',
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      setEditedJournal(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }));
      setNewTag('');
      setShowTagInput(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditedJournal(prev => ({
      ...prev,
      tags: (prev.tags || []).filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      const encryptionReady = isEncryptionInitialized();
      if (!encryptionReady) {
        throw new Error('Encryption is not initialized. Please refresh or re-login.');
      }
      // Always encrypt before saving
      const encryptedData = await encryptJournalEntry({
        title: editedJournal.title || '',
        content: editedJournal.content || '',
        date: editedJournal.date || new Date().toISOString(),
        mood: editedJournal.mood || null,
        tags: editedJournal.tags || [],
        is_favorite: journal?.is_favorite || false,
        is_archived: journal?.is_archived || false,
      }, user.id);
      const updateData = {
        journal_id: journalId,
        title: null,
        content: null,
        title_encrypted: encryptedData.title_encrypted,
        title_iv: encryptedData.title_iv,
        content_encrypted: encryptedData.content_encrypted,
        content_iv: encryptedData.content_iv,
        prompt_encrypted: journal?.prompt_encrypted || null,
        prompt_iv: journal?.prompt_iv || null,
        is_prompt_response: journal?.is_prompt_response ?? isPromptResponse,
        date: editedJournal.date,
        mood: editedJournal.mood,
        tags: editedJournal.tags,
        is_encrypted: true,
      };
      const response = await fetch('/api/journals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (!response.ok) throw new Error('Failed to update journal');
      const data = await response.json();
      // Decrypt updated journal for instant display
      let updatedJournal = data.journal;
      if (updatedJournal.is_encrypted && updatedJournal.title_encrypted && updatedJournal.content_encrypted) {
        try {
          const decrypted = await encryptJournalEntry({
            title: editedJournal.title || '',
            content: editedJournal.content || '',
            date: editedJournal.date || new Date().toISOString(),
            mood: editedJournal.mood || null,
            tags: editedJournal.tags || [],
            is_favorite: journal?.is_favorite || false,
            is_archived: journal?.is_archived || false,
            is_prompt_response: journal?.is_prompt_response ?? isPromptResponse,
          }, user.id);
          updatedJournal = {
            ...updatedJournal,
            title: editedJournal.title || '',
            content: editedJournal.content || '',
          };
        } catch (err) {
          updatedJournal = {
            ...updatedJournal,
            title: '[Encrypted - Unable to decrypt]',
            content: '[Encrypted content - encryption key not available]',
          };
        }
      }
      setJournal(prevJournal => ({ ...prevJournal!, ...updatedJournal, prompt: promptContext, is_prompt_response: isPromptResponse }));
      
      // Check if content changed after publishing
      if (journal?.is_public && originalPublishedContent) {
        const titleChanged = editedJournal.title !== originalPublishedContent.title;
        const contentChanged = editedJournal.content !== originalPublishedContent.content;
        
        if (titleChanged || contentChanged) {
          setHasChangesAfterPublish(true);
        }
      }
      
      setIsEditing(false);
      setSaving(false);
      showToast('Journal updated successfully!', 'success');
    } catch (err: any) {
      showToast(`Failed to save changes: ${err.message}`, 'error');
      setSaving(false);
    }
  };

  // Determine media type from file MIME type
  const getMediaTypeFromFile = (file: File): string => {
    const mimeType = file.type.toLowerCase();
    
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('application/pdf') || 
        mimeType.includes('document') || 
        mimeType.includes('word') ||
        mimeType.includes('text/')) return 'document';
    
    // Default to document for unknown types
    return 'document';
  };

  const handleMediaUpload = async (file: File) => {
    if (!file || !journalId) {
      showToast('Please select a file', 'warning');
      return;
    }
    
    try {
      setMediaUploading(true);
      setUploadProgress(0);
      
      // Automatically determine media type from file
      const mediaType = getMediaTypeFromFile(file);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('journal_id', journalId);
      formData.append('media_type', mediaType);
      
      const response = await fetch('/api/journals/media', {
        method: 'POST',
        body: formData,
      });
      
      setUploadProgress(100);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      // Refetch journal data to get updated media
      const journalResponse = await fetch(`/api/journals/${journalId}`);
      if (journalResponse.ok) {
        const data = await journalResponse.json();
        let journalData = data.journal;
        const mediaArray = data.media || [];
        
        // Re-transform media
        const mediaByType: JournalMedia = {
          image: [],
          audio: [],
          video: [],
          document: []
        };
        
        for (const media of mediaArray) {
          const type = media.media_type as keyof JournalMedia;
          if (mediaByType[type]) {
            let url = media.public_url;
            if (media.storage_provider === 'supabase' && media.bucket && media.path) {
              try {
                // Call API route to get signed URL (can't use admin client on frontend)
                const response = await fetch('/api/media/signed-url', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    bucket: media.bucket,
                    path: media.path,
                    expiresIn: 3600
                  })
                });
                
                if (response.ok) {
                  const data = await response.json();
                  url = data.signedUrl;
                }
              } catch (err) {
                console.error('Failed to get signed URL:', err);
              }
            }
            
            mediaByType[type].push({
              driveFileId: media.drive_file_id || media.id,
              name: media.file_name,
              fileName: media.file_name,
              mimeType: media.mime_type,
              driveMimeType: media.drive_mime_type,
              thumbnailUrl: media.thumbnail_url,
              url: url,
              createdAt: media.created_at,
              uploadedAt: media.created_at,
              fileSize: media.file_size,
              mediaId: media.id,
            });
          }
        }
        
        journalData.media = mediaByType;
        setJournal(prev => ({ ...prev!, media: mediaByType }));
      }
      
      setSelectedFile(null);
      setMediaUploading(false);
      
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      showToast(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} uploaded successfully!`, 'success');
      
    } catch (err: any) {
      showToast(`Upload failed: ${err.message}`, 'error');
      setMediaUploading(false);
    }
  };

  const handleDeleteMedia = async (mediaId: string, mediaType: string) => {
    if (!confirm('Are you sure you want to delete this media? This action cannot be undone.')) return;
    
    try {
      const response = await fetch(`/api/journal/media?media_id=${mediaId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Delete failed');
      }
      
      // Update local state by removing the deleted media
      setJournal(prev => {
        if (!prev) return prev;
        const updatedMedia = { ...prev.media };
        const typeKey = mediaType as keyof JournalMedia;
        updatedMedia[typeKey] = updatedMedia[typeKey].filter(
          (m: any) => m.mediaId !== mediaId
        );
        return { ...prev, media: updatedMedia };
      });
      
      showToast('Media deleted successfully!', 'success');
      
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  if (loading) {
    return <AnimatedLoader elementColors={{ text: elementColors.text }} />;
  }

  if (error) {
    return <ErrorScreen message={error} />;
  }

  if (!journal) {
    return <ErrorScreen message="The requested journal entry could not be found." />;
  }

  const mediaData = journal.media || { image: [], audio: [], video: [], document: [] };
  const displayTitle = (journal.title || '').trim() || (voiceTranscript.trim() || mediaData.audio.length > 0 ? formatVoiceNoteTitle(getJournalDateTime()) : 'Untitled Entry');

  return (
    <div 
      className="min-h-screen transition-colors duration-200"
      style={{ 
        background: isDarkMode
          ? 'radial-gradient(circle at 16% 6%, rgba(196, 129, 93, 0.2), transparent 42%), radial-gradient(circle at 82% 2%, rgba(120, 170, 156, 0.17), transparent 36%), linear-gradient(165deg, #171211 0%, #201814 46%, #17120f 100%)'
          : 'radial-gradient(circle at 20% 10%, rgba(241, 193, 178, 0.18), transparent 42%), radial-gradient(circle at 78% 4%, rgba(166, 210, 199, 0.18), transparent 34%), linear-gradient(168deg, #fff8f4 0%, #f8efe6 52%, #f0e3d8 100%)',
        color: elementColors.text,
        fontFamily: 'var(--font-family)'
      }}
    >
      <ThemeSidebar />
      

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={hideToast}
        duration={4000}
      />

      {/* OCR Insert Panel */}
      {showOCR && (
        <OCRInsertPanel
          currentContent={editedJournal.content || ''}
          onInsert={(text, mode) => {
            if (mode === 'append') {
              const current = editedJournal.content || '';
              const newContent = current ? `${current}\n\n${text}` : text;
              setEditedJournal(prev => ({ ...prev, content: newContent }));
            } else {
              setEditedJournal(prev => ({ ...prev, content: text }));
            }
            setShowOCR(false);
            showToast(mode === 'append' ? 'OCR text appended to journal!' : 'Journal content replaced with OCR text.', 'success');
          }}
          onClose={() => setShowOCR(false)}
        />
      )}
      
      
      <DeleteConfirmationModal 
        showDeleteConfirm={showDeleteConfirm}
        setShowDeleteConfirm={setShowDeleteConfirm}
        handleDeleteJournal={handleDeleteJournal}
        isDeleting={isDeleting}
        getCardStyle={() => ({ backgroundColor: isDarkMode ? '#1F2937' : '#ffffff' })}
        getButtonStyle={getButtonStyle}
      />

      {/* Header */}
      <header 
        className="sticky top-0 z-40 backdrop-blur-xl border-b"
        style={{
          backgroundColor: isDarkMode ? 'rgba(29, 24, 23, 0.82)' : 'rgba(255, 248, 244, 0.86)',
          borderColor: isDarkMode ? '#3f3a37' : '#e4d6ca'
        }}
      >
        <div className="max-w-4xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <Link 
              href="/journal"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-opacity-10"
              style={{ 
                color: isDarkMode ? '#c4b8b1' : '#6e4f43',
                backgroundColor: 'transparent'
              }}
            >
              <ArrowLeft size={16} />
              <span className="text-sm">Back</span>
            </Link>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleToggleFavorite}
                className="p-2 rounded-lg transition-all"
                style={{
                  color: journal.is_favorite ? '#EF4444' : (isDarkMode ? '#9CA3AF' : '#6B7280'),
                  backgroundColor: journal.is_favorite ? (isDarkMode ? '#7F1D1D' : '#FEE2E2') : 'transparent'
                }}
              >
                <Heart size={18} fill={journal.is_favorite ? 'currentColor' : 'none'} />
              </button>
              
              <button 
                onClick={handleToggleArchive}
                className="p-2 rounded-lg transition-colors"
                style={{
                  color: isDarkMode ? '#9CA3AF' : '#6B7280'
                }}
              >
                {journal.is_archived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
              </button>

              {/* Publish Button */}
              {journal.is_public ? (
                <>
                  <button 
                    onClick={handleUnpublish}
                    className="px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                    style={{
                      backgroundColor: isDarkMode ? '#065F46' : '#D1FAE5',
                      color: isDarkMode ? '#D1FAE5' : '#065F46'
                    }}
                  >
                    <Globe size={16} />
                    <span className="text-sm">Published</span>
                  </button>
                  
                  {/* Update Published Button - shows when changes detected */}
                  {hasChangesAfterPublish && (
                    <button 
                      onClick={handleUpdatePublished}
                      disabled={publishing}
                      className="px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                      style={{
                        backgroundColor: isDarkMode ? '#92400E' : '#FEF3C7',
                        color: isDarkMode ? '#FCD34D' : '#92400E'
                      }}
                    >
                      <Upload size={16} />
                      <span className="text-sm">{publishing ? 'Updating...' : 'Update Published'}</span>
                    </button>
                  )}
                </>
              ) : (
                <button 
                  onClick={() => setShowPublishDialog(true)}
                  className="px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                  style={{
                    backgroundColor: isDarkMode ? '#4a3429' : '#f7e7da',
                    color: isDarkMode ? '#f0d3c2' : '#7c4d39'
                  }}
                >
                  <Share2 size={16} />
                  <span className="text-sm">Publish</span>
                </button>
              )}
              
              {!isEditing ? (
                <>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 rounded-lg font-medium transition-colors"
                    style={getButtonStyle('primary')}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: '#EF4444' }}
                  >
                    <Trash2 size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-lg font-medium transition-colors"
                    style={getButtonStyle('secondary')}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveChanges}
                    className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1"
                    style={getButtonStyle('primary')}
                    disabled={saving}
                  >
                    <Check size={16} />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Public URL Banner */}
      {journal.is_public && journal.published_share_id && (
        <div className="max-w-4xl mx-auto px-6 pt-4">
          <div 
            className="flex items-center justify-between p-4 rounded-lg border"
            style={{
              backgroundColor: isDarkMode ? '#064E3B' : '#ECFDF5',
              borderColor: isDarkMode ? '#065F46' : '#A7F3D0'
            }}
          >
            <div className="flex items-center gap-3">
              <Globe 
                size={20} 
                style={{ color: isDarkMode ? '#10B981' : '#059669' }}
              />
              <div>
                <p 
                  className="text-sm font-medium"
                  style={{ color: isDarkMode ? '#D1FAE5' : '#065F46' }}
                >
                  This journal is published
                </p>
                <p 
                  className="text-xs mt-0.5"
                  style={{ color: isDarkMode ? '#A7F3D0' : '#047857' }}
                >
                  {window.location.origin}/p/{journal.published_share_id}
                </p>
              </div>
            </div>
            <button
              onClick={copyPublicUrl}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{
                backgroundColor: isDarkMode ? '#065F46' : '#10B981',
                color: '#ffffff'
              }}
            >
              {showCopied ? (
                <>
                  <CheckCircle size={16} />
                  <span className="text-sm">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span className="text-sm">Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Publish Dialog */}
      {showPublishDialog && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowPublishDialog(false)}
        >
          <div
            className="w-full max-w-md rounded-lg shadow-xl p-6"
            style={{
              backgroundColor: isDarkMode ? '#1F2937' : '#ffffff',
              color: elementColors.text
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-4">Publish Journal</h3>
            
            <p className="text-sm mb-6" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
              Your journal will be accessible via a public URL. Anyone with the link can view it.
            </p>

            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMedia}
                  onChange={(e) => setIncludeMedia(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: currentTheme.primary }}
                />
                <div>
                  <span className="text-sm font-medium">Include media files</span>
                  <p className="text-xs mt-0.5" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                    Share attached images, audio, and videos
                  </p>
                </div>
              </label>
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAnalysis}
                  onChange={(e) => setIncludeAnalysis(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: currentTheme.primary }}
                />
                <div>
                  <span className="text-sm font-medium">Include analysis report</span>
                  <p className="text-xs mt-0.5" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                    Share the AI-generated mood, sentiment, and insights analysis
                  </p>
                  {includeAnalysis && (
                    <p className="text-xs mt-1" style={{ color: isDarkMode ? '#FBBF24' : '#92400E' }}>
                      ⚠️ Analysis must have been generated for this journal first. If none exists it will be skipped.
                    </p>
                  )}
                </div>
              </label>
            </div>

            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: currentTheme.primary }}
                />
                <div>
                  <span className="text-sm font-medium">Publish anonymously</span>
                  <p className="text-xs mt-0.5" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                    Hide your identity from readers
                  </p>
                </div>
              </label>
              {isAnonymous && (
                <div className="mt-3 ml-7">
                  <input
                    type="text"
                    value={anonymousAlias}
                    onChange={(e) => setAnonymousAlias(e.target.value)}
                    placeholder="Optional alias (e.g., 'A Wandering Soul')"
                    maxLength={50}
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 transition-all"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#F9FAFB',
                      borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                      color: elementColors.text,
                    }}
                  />
                  <p className="text-xs mt-1" style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                    Shown instead of your name. Leave blank for &quot;Anonymous&quot;.
                  </p>
                </div>
              )}
            </div>

            <div 
              className="p-3 rounded-lg mb-6"
              style={{ backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }}
            >
              <p className="text-xs" style={{ color: isDarkMode ? '#D1D5DB' : '#4B5563' }}>
                ⚠️ Publishing will create a public snapshot of your journal. 
                The content will remain accessible even if you edit the original entry.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPublishDialog(false)}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
                style={getButtonStyle('secondary')}
                disabled={publishing}
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                style={getButtonStyle('primary')}
                disabled={publishing}
              >
                {publishing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Share2 size={16} />
                    Publish
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content — outer wrapper gives side-by-side layout when prompt exists */}
      <main
        className={[
          'my-6 mx-auto transition-all duration-300',
          (isPromptResponse || Boolean(promptContext?.text))
            ? 'max-w-5xl flex flex-col lg:flex-row gap-4 items-start'
            : 'max-w-4xl',
        ].join(' ')}
      >
        {/* Prompt Context Sidebar */}
        {(isPromptResponse || Boolean(promptContext?.text)) && (
          <aside
            className="w-full lg:w-[220px] lg:flex-shrink-0 rounded-[24px] border overflow-hidden shadow-md"
            style={{
              backgroundColor: isDarkMode ? 'rgba(28, 22, 20, 0.88)' : 'rgba(255, 247, 240, 0.95)',
              borderColor: isDarkMode ? 'rgba(143, 98, 72, 0.35)' : 'rgba(222, 207, 195, 0.85)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Accent strip at the very top */}
            <div
              className="h-1 w-full"
              style={{
                background: isDarkMode
                  ? 'linear-gradient(90deg, #c4815d 0%, #e0a98b 100%)'
                  : 'linear-gradient(90deg, #8f6248 0%, #c4815d 100%)',
              }}
            />

            <div className="p-4">
              {/* Badge */}
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(196, 129, 93, 0.18)' : 'rgba(143, 98, 72, 0.1)',
                  color: isDarkMode ? '#e0a98b' : '#8f6248',
                }}
              >
                {Boolean(voiceTranscript.trim() || mediaData.audio.length > 0)
                  ? '🎙 Spoken Prompt'
                  : '✍ Written Prompt'}
              </span>

              {promptContext?.text ? (
                <>
                  <p
                    className="text-sm font-semibold leading-snug"
                    style={{ color: isDarkMode ? '#f3ede8' : '#3b2a22' }}
                  >
                    {promptContext.text}
                  </p>
                  {promptContext.explanation && (
                    <p
                      className="mt-2 text-[11px] leading-relaxed"
                      style={{ color: isDarkMode ? '#b0a09a' : '#7a5c50', opacity: 0.9 }}
                    >
                      {promptContext.explanation}
                    </p>
                  )}
                </>
              ) : (
                <p
                  className="text-xs italic leading-relaxed"
                  style={{ color: isDarkMode ? '#9CA3AF' : '#7a5c50' }}
                >
                  This reflection was written in response to a daily prompt.
                </p>
              )}

              {/* Decorative quotation mark */}
              <div
                className="mt-4 text-5xl font-serif leading-none select-none opacity-10"
                style={{ color: isDarkMode ? '#e0a98b' : '#8f6248' }}
                aria-hidden
              >
                &ldquo;
              </div>
            </div>
          </aside>
        )}

        {/* Journal card */}
        <div
          className={[
            'rounded-[30px] border border-[#decfc3]/65 bg-[#fffaf6]/88 px-6 py-10 shadow-[0_14px_34px_rgba(95,70,52,0.1)] backdrop-blur-sm',
            (isPromptResponse || Boolean(promptContext?.text)) ? 'flex-1 min-w-0' : 'w-full',
          ].join(' ')}
          style={{
            backgroundColor: isDarkMode ? 'rgba(18,14,12,0.92)' : undefined,
            borderColor: isDarkMode ? 'rgba(100,70,55,0.4)' : undefined,
          }}
        >

          {/* Title */}
        {isEditing ? (
          <input
            type="text"
            name="title"
            value={editedJournal.title || ''}
            onChange={handleInputChange}
            className="w-full text-4xl font-bold mb-6 bg-transparent border-none outline-none placeholder-gray-400"
            style={{ color: elementColors.text, fontFamily: "'Iowan Old Style', 'Palatino Linotype', serif" }}
            placeholder="Untitled"
          />
        ) : (
          <h1 className="text-4xl font-bold mb-6 tracking-[0.01em]" style={{ color: elementColors.text, fontFamily: "'Iowan Old Style', 'Palatino Linotype', serif" }}>
            {displayTitle}
          </h1>
        )}

        {/* Metadata */}
        <div 
          className="flex flex-wrap items-center gap-4 mb-8 pb-8 border-b"
          style={{ 
            borderColor: isDarkMode ? '#374151' : '#e5e7eb',
            color: isDarkMode ? '#9CA3AF' : '#6B7280'
          }}
        >
          {isEditing ? (
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={16} />
              <input
                type="datetime-local"
                value={formatDateForInput(editedJournal.date || journal.date)}
                onChange={(e) => {
                  const localDate = new Date(e.target.value);
                  setEditedJournal(prev => ({ ...prev, date: localDate.toISOString() }));
                }}
                className="rounded-lg border px-3 py-1.5 text-sm outline-none transition-colors focus:ring-2"
                style={{
                  color: elementColors.text,
                  borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                  backgroundColor: isDarkMode ? '#1F2937' : '#F9FAFB',
                  colorScheme: isDarkMode ? 'dark' : 'light',
                }}
                aria-label="Edit entry date"
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={16} />
                <span>{getJournalDateTime().toLocaleDateString('en-US', { 
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock size={16} />
                <span>{getJournalDateTime().toLocaleTimeString('en-US', {
                  hour: '2-digit', minute: '2-digit', hour12: true
                })}</span>
              </div>
            </>
          )}
          {journal.mood && (
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: getMoodColorHex(journal.moodColor) }}
              />
              <span className="text-sm">{journal.mood}</span>
            </div>
          )}
          {/* Metadata section */}
          <div className="flex items-center gap-2 text-xs ml-auto">
            <span>Updated {getTimeAgo(journal.updatedAt || journal.updated_at || journal.date)}</span>
            <span>·</span>
            <span>{journal.content ? journal.content.split(/\s+/).filter(Boolean).length : 0} words</span>
          </div>
        </div>

        {/* Tags */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2">
            {(isEditing ? editedJournal.tags : journal.tags)?.map((tag, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm"
                style={{
                  backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                  color: elementColors.text
                }}
              >
                #{tag}
                {isEditing && (
                  <button 
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                )}
              </span>
            ))}
            
            {isEditing && (
              showTagInput ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="New tag"
                    className="px-3 py-1 rounded-full text-sm outline-none"
                    style={{
                      backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                      color: elementColors.text
                    }}
                    autoFocus
                  />
                  <button onClick={handleAddTag} style={{ color: elementColors.button }}>
                    <Check size={16} />
                  </button>
                  <button onClick={() => setShowTagInput(false)} style={{ color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowTagInput(true)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm border-2 border-dashed transition-colors"
                  style={{
                    borderColor: isDarkMode ? '#4B5563' : '#D1D5DB',
                    color: isDarkMode ? '#9CA3AF' : '#6B7280'
                  }}
                >
                  <Plus size={14} />
                  Add tag
                </button>
              )
            )}
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <div>
            {/* Edit toolbar */}
            <div className="flex items-center gap-2 mb-3 pb-3 border-b" style={{ borderColor: isDarkMode ? '#374151' : '#E5E7EB' }}>
              <button
                onClick={() => setShowOCR(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] active:scale-95"
                style={{
                  backgroundColor: `${elementColors.button}15`,
                  color: elementColors.button,
                }}
              >
                <ScanLine size={16} />
                OCR Scan
              </button>
              <span className="text-xs" style={{ color: isDarkMode ? '#6B7280' : '#9CA3AF' }}>
                Extract text from images or PDFs
              </span>
            </div>
            <textarea
              name="content"
              value={editedJournal.content || ''}
              onChange={handleInputChange}
              // eslint-disable-next-line
              className="w-full min-h-100 text-base leading-relaxed bg-transparent border-none outline-none resize-none placeholder-gray-400"
              style={{ color: elementColors.text }}
              placeholder="Start writing..."
            />
          </div>
        ) : (
          <div className="prose prose-lg max-w-none">
            {journal.content.split('\n\n').map((para, idx) => (
              <p 
                key={idx} 
                className="mb-4 leading-relaxed"
                style={{ color: elementColors.text }}
              >
                {para}
              </p>
            ))}
          </div>
        )}

        {!!voiceTranscript.trim() && (
          <div
            className="mt-8 p-5 rounded-xl border"
            style={{
              backgroundColor: isDarkMode ? '#111827' : '#F8FAFC',
              borderColor: isDarkMode ? '#374151' : '#E5E7EB',
            }}
          >
            <h2 className="text-lg font-semibold mb-3" style={{ color: elementColors.text }}>
              Voice Transcript
            </h2>
            <p className="whitespace-pre-wrap leading-relaxed" style={{ color: elementColors.text }}>
              {voiceTranscript}
            </p>
          </div>
        )}

        {/* Media Gallery */}
        {(mediaData.image.length > 0 || mediaData.audio.length > 0 || mediaData.video.length > 0 || mediaData.document.length > 0 || isEditing) && (
          <div className="mt-12">
            <h2 
              className="text-xl font-semibold mb-6"
              style={{ color: elementColors.text }}
            >
              Media
            </h2>

            {/* Unified Upload Section */}
            {isEditing && (
              <div className="mb-8">
                <label 
                  htmlFor="file-upload"
                  className="w-full p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:border-opacity-70"
                  style={{
                    borderColor: elementColors.button,
                    backgroundColor: isDarkMode ? 'rgba(55, 65, 81, 0.3)' : 'rgba(243, 244, 246, 0.5)',
                    color: elementColors.text
                  }}
                >
                  <Upload size={32} className="mb-3" style={{ color: elementColors.button }} />
                  <span className="text-lg font-medium mb-2">Upload Media</span>
                  <span className="text-sm opacity-70">
                    Images, Audio, Video, or Documents
                  </span>
                  <span className="text-xs opacity-50 mt-2">
                    The file type will be detected automatically
                  </span>
                  {mediaUploading && (
                    <div className="mt-4 w-full max-w-xs">
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full transition-all duration-300"
                          style={{ 
                            width: `${uploadProgress}%`,
                            backgroundColor: elementColors.button 
                          }}
                        />
                      </div>
                      <p className="text-xs text-center mt-2">Uploading... {uploadProgress}%</p>
                    </div>
                  )}
                </label>
                <input
                  id="file-upload"
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleMediaUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                  accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt,.rtf"
                  disabled={mediaUploading}
                />
              </div>
            )}
            
            {/* Images */}
            {mediaData.image.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-4" style={{ color: elementColors.text }}>Images</h3>
                <div className="grid grid-cols-2 gap-4">
                  {mediaData.image.map((img, idx) => (
  <div 
    key={img.mediaId || idx}
    className="group relative rounded-xl overflow-hidden aspect-video cursor-pointer"
    style={{ backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }}
    onClick={() => !isEditing && setSelectedMedia({
      type: 'image',
      url: img.url || img.thumbnailUrl || '',
      name: img.name || img.fileName || `Image ${idx + 1}`,
      mimeType: img.mimeType
    })}
  >
    <img 
      src={img.url || img.thumbnailUrl || ''}
      alt={img.name || img.fileName || `Image ${idx + 1}`}
      className="w-full h-full object-cover transition-transform group-hover:scale-105"
      loading="lazy"
    />
    {isEditing && (
      <button 
        onClick={(e) => {
          e.stopPropagation();
          handleDeleteMedia(img.mediaId || img.driveFileId, 'image');
        }}
        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <Trash2 size={16} />
      </button>
    )}
    {!isEditing && (
      <div className="absolute inset-0  bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
        <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={32} />
      </div>
    )}
  </div>
))}
                </div>
              </div>
            )}

            {/* Audio */}
            {mediaData.audio.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-4" style={{ color: elementColors.text }}>Audio</h3>
                <div className="space-y-3">
                 {mediaData.audio.map((audio, idx) => (
  <div 
    key={audio.mediaId || idx}
    className="group relative p-4 rounded-xl cursor-pointer hover:shadow-lg transition-all"
    style={{ backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }}
    onClick={() => !isEditing && setSelectedMedia({
      type: 'audio',
      url: audio.url || '',
      name: audio.name || audio.fileName || `Audio ${idx + 1}`,
      mimeType: audio.mimeType
    })}
  >
    <div className="flex items-center gap-3">
      <Mic className="w-5 h-5" style={{ color: elementColors.text }} />
      <div className="flex-1">
        <p className="font-medium" style={{ color: elementColors.text }}>
          {audio.name || audio.fileName || `Audio ${idx + 1}`}
        </p>
        {audio.url && (
          <audio 
            controls 
            className="w-full mt-2" 
            src={audio.url}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
      {isEditing && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteMedia(audio.mediaId || audio.driveFileId, 'audio');
          }}
          className="p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  </div>
))}
                </div>
              </div>
            )}

            {/* Video */}
            {mediaData.video.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-4" style={{ color: elementColors.text }}>Videos</h3>
                <div className="grid grid-cols-1 gap-4">
                  {mediaData.video.map((vid, idx) => (
  <div 
    key={vid.mediaId || idx}
    className="group relative rounded-xl overflow-hidden cursor-pointer"
    style={{ backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }}
    onClick={() => !isEditing && setSelectedMedia({
      type: 'video',
      url: vid.url || '',
      name: vid.name || vid.fileName || `Video ${idx + 1}`,
      mimeType: vid.mimeType
    })}
  >
    <video 
      controls
      src={vid.url || ''}
      className="w-full"
      poster={vid.thumbnailUrl}
      onClick={(e) => e.stopPropagation()}
    />
    {isEditing && (
      <button 
        onClick={(e) => {
          e.stopPropagation();
          handleDeleteMedia(vid.mediaId || vid.driveFileId, 'video');
        }}
        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <Trash2 size={16} />
      </button>
    )}
  </div>
))}
                </div>
              </div>
            )}

            {/* Documents */}
            {mediaData.document.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-4" style={{ color: elementColors.text }}>Documents</h3>
                <div className="space-y-3">
                  {mediaData.document.map((doc, idx) => (
  <div 
    key={doc.mediaId || idx}
    className="group relative p-4 rounded-xl cursor-pointer hover:shadow-lg transition-all"
    style={{ backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }}
    onClick={() => !isEditing && setSelectedMedia({
      type: 'document',
      url: doc.url || '',
      name: doc.name || doc.fileName || `Document ${idx + 1}`,
      mimeType: doc.mimeType
    })}
  >
    <div className="flex items-center gap-3">
      <FileText className="w-5 h-5" style={{ color: elementColors.text }} />
      <div className="flex-1">
        <p className="font-medium" style={{ color: elementColors.text }}>
          {doc.name || doc.fileName || `Document ${idx + 1}`}
        </p>
        {doc.url && (
          <a 
            href={doc.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-amber-600 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View document
          </a>
        )}
      </div>
      {isEditing && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteMedia(doc.mediaId || doc.driveFileId, 'document');
          }}
          className="p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  </div>
))}
                </div>
              </div>
            )}
          </div>
        )}
        </div> {/* End journal card */}
      </main>
      <MediaModal
        isOpen={!!selectedMedia}
        onClose={() => setSelectedMedia(null)}
        media={selectedMedia}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default JournalPage;
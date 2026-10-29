"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/utilities/context/ThemeContext';
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  Loader2,
  Lock,
  Shield,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type { JournalGroup } from './BulkJournalImport';
import { encryptJournalEntry } from '@/utils/encryption/journalEncryption';
import { isEncryptionInitialized } from '@/utils/encryption/keyManager';

// ─── Types ───────────────────────────────────────────────────────────

interface ConfirmStepProps {
  journalGroups: JournalGroup[];
  tempFolder: string;
  onComplete: (results: BulkCreateResults) => void;
  onBack: () => void;
}

export interface BulkCreateResults {
  totalCreated: number;
  totalFailed: number;
  created: JournalResultItem[];
  failed: JournalResultItem[];
  tempCleaned: boolean;
}

export interface JournalResultItem {
  journal_id: string;
  db_id?: string;
  date: string;
  title_plain?: string | null;
  success: boolean;
  error?: string;
  imagesAttached: number;
}

type PhaseStatus = 'idle' | 'running' | 'done' | 'error';

interface JournalProgress {
  groupId: string;
  title: string;
  encrypted: PhaseStatus;
  submitted: PhaseStatus;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function generateJournalId(userId: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${userId.substring(0, 8)}_${timestamp}_${random}`;
}

function calculateWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function calculateReadingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200)); // ~200 wpm
}

// ─── Component ───────────────────────────────────────────────────────

const ConfirmStep: React.FC<ConfirmStepProps> = ({
  journalGroups,
  tempFolder,
  onComplete,
  onBack,
}) => {
  const { currentTheme, isDarkMode } = useTheme();

  const [phase, setPhase] = useState<'ready' | 'encrypting' | 'submitting' | 'done' | 'error'>('ready');
  const [progress, setProgress] = useState<JournalProgress[]>([]);
  const [encryptionAvailable, setEncryptionAvailable] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [overallError, setOverallError] = useState<string | null>(null);

  const abortRef = useRef(false);
  const startedRef = useRef(false);

  // Filter to only journals marked for import
  const journalsToCreate = journalGroups.filter((g) => g.includeInImport);

  // ── Init: check encryption + fetch user ID ─────────────────────

  useEffect(() => {
    const init = async () => {
      let currentUserId: string | null = null;

      // Fetch user ID (needed for encryption + journal ID generation)
      try {
        const res = await fetch('/api/user/current');
        const data = await res.json();
        if (data.user?.id) {
          currentUserId = data.user.id;
          setUserId(data.user.id);
        }
      } catch {
        console.error('[ConfirmStep] Failed to fetch current user');
      }

      // Check if encryption is already initialized in memory
      let encReady = isEncryptionInitialized();

      // If not initialized, try to restore / auto-init (same flow as JournalEntry)
      if (!encReady && currentUserId) {
        try {
          // 1. Check if encryption is enabled for this user
          const saltRes = await fetch('/api/encryption/salt');
          if (saltRes.ok) {
            const saltData = await saltRes.json();

            if (saltData.encryption_enabled) {
              // 2. Try restoring from IndexedDB cache
              const { restoreEncryptionFromCache } = await import(
                '@/utils/encryption/keyManager'
              );
              const restored = await restoreEncryptionFromCache(currentUserId);

              if (restored) {
                console.log('[ConfirmStep] Encryption restored from cache');
                encReady = true;
              } else {
                // 3. Auto-initialize (works for OAuth users using userId as password)
                console.log('[ConfirmStep] Attempting auto-initialization');
                const { autoInitializeEncryptionForOAuthUser } = await import(
                  '@/utils/encryption'
                );
                await autoInitializeEncryptionForOAuthUser(currentUserId);
                encReady = isEncryptionInitialized();
                if (encReady) {
                  console.log('[ConfirmStep] Encryption auto-initialized');
                }
              }
            }
          }
        } catch (err) {
          console.error('[ConfirmStep] Encryption init failed:', err);
          // Non-fatal — will fall back to plaintext
        }
      }

      setEncryptionAvailable(encReady);

      // Initialize progress list
      setProgress(
        journalsToCreate.map((g) => ({
          groupId: g.groupId,
          title: g.title || `Journal ${g.date || 'undated'}`,
          encrypted: 'idle',
          submitted: 'idle',
        })),
      );
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Main processing function ───────────────────────────────────

  const startProcessing = useCallback(async () => {
    if (startedRef.current || !userId) return;
    startedRef.current = true;
    abortRef.current = false;

    setPhase('encrypting');

    // Build payloads with optional encryption
    interface JournalPayload {
      journal_id: string;
      title?: string | null;
      content?: string | null;
      title_encrypted?: string | null;
      title_iv?: string | null;
      content_encrypted?: string | null;
      content_iv?: string | null;
      is_encrypted: boolean;
      date: string;
      tags: string[];
      journal_type: string;
      word_count: number;
      reading_time_minutes: number;
      attach_images: boolean;
      source_image_paths: string[];
    }

    const payloads: JournalPayload[] = [];

    // Step 1: Encrypt each journal
    for (let i = 0; i < journalsToCreate.length; i++) {
      if (abortRef.current) return;

      const group = journalsToCreate[i]!;
      const journalId = generateJournalId(userId);
      const wordCount = calculateWordCount(group.combinedText);
      const readingTime = calculateReadingTime(wordCount);

      // Collect source image paths from pages
      const sourceImagePaths = group.attachImages
        ? group.pages.map((p) => p.filePath).filter(Boolean)
        : [];

      // Update progress: encrypting
      setProgress((prev) =>
        prev.map((p) =>
          p.groupId === group.groupId ? { ...p, encrypted: 'running' as PhaseStatus } : p,
        ),
      );

      let payload: JournalPayload;

      if (encryptionAvailable) {
        try {
          const encrypted = await encryptJournalEntry(
            {
              title: group.title || '',
              content: group.combinedText || '',
              journal_type: group.journalType || 'personal',
              tags: group.tags,
              date: group.date ?? new Date().toISOString().split('T')[0]!,
              is_favorite: false,
              is_archived: false,
            },
            userId,
          );

          const fallbackDate = group.date ?? new Date().toISOString().split('T')[0]!;

          payload = {
            journal_id: journalId,
            title_encrypted: encrypted.title_encrypted,
            title_iv: encrypted.title_iv,
            content_encrypted: encrypted.content_encrypted,
            content_iv: encrypted.content_iv,
            is_encrypted: true,
            title: null,
            content: null,
            date: fallbackDate,
            tags: group.tags || ['handwritten', 'bulk-import'],
            journal_type: group.journalType || 'personal',
            word_count: wordCount,
            reading_time_minutes: readingTime,
            attach_images: group.attachImages,
            source_image_paths: sourceImagePaths,
          };

          setProgress((prev) =>
            prev.map((p) =>
              p.groupId === group.groupId ? { ...p, encrypted: 'done' as PhaseStatus } : p,
            ),
          );
        } catch (err) {
          console.error('[ConfirmStep] Encryption failed for', group.groupId, err);
          const encFallbackDate = group.date ?? new Date().toISOString().split('T')[0]!;
          // Fall back to plaintext
          payload = {
            journal_id: journalId,
            title: group.title || '',
            content: group.combinedText || '',
            is_encrypted: false,
            date: encFallbackDate,
            tags: group.tags || ['handwritten', 'bulk-import'],
            journal_type: group.journalType || 'personal',
            word_count: wordCount,
            reading_time_minutes: readingTime,
            attach_images: group.attachImages,
            source_image_paths: sourceImagePaths,
          };

          setProgress((prev) =>
            prev.map((p) =>
              p.groupId === group.groupId
                ? { ...p, encrypted: 'error' as PhaseStatus, error: 'Encryption failed — saving unencrypted' }
                : p,
            ),
          );
        }
      } else {
        // No encryption — plaintext
        const fallbackDate = group.date ?? new Date().toISOString().split('T')[0]!;
        payload = {
          journal_id: journalId,
          title: group.title || '',
          content: group.combinedText || '',
          is_encrypted: false,
          date: fallbackDate,
          tags: group.tags || ['handwritten', 'bulk-import'],
          journal_type: group.journalType || 'personal',
          word_count: wordCount,
          reading_time_minutes: readingTime,
          attach_images: group.attachImages,
          source_image_paths: sourceImagePaths,
        };

        setProgress((prev) =>
          prev.map((p) =>
            p.groupId === group.groupId ? { ...p, encrypted: 'done' as PhaseStatus } : p,
          ),
        );
      }

      payloads.push(payload);

      // Small delay so the UI doesn't flash
      await new Promise((r) => setTimeout(r, 50));
    }

    // Step 2: Submit to bulk-create API
    setPhase('submitting');

    // Mark all as submitting
    setProgress((prev) =>
      prev.map((p) => ({ ...p, submitted: 'running' as PhaseStatus })),
    );

    try {
      const res = await fetch('/api/journal/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journals: payloads,
          tempFolder,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `Server error ${res.status}`);
      }

      const result = await res.json();

      // Update per-journal submission status
      const createdIds = new Set(
        (result.created || []).map((c: { journal_id: string }) => c.journal_id),
      );

      setProgress((prev) =>
        prev.map((p, idx) => {
          const journalId = payloads[idx]?.journal_id;
          if (!journalId) return { ...p, submitted: 'error' as PhaseStatus };
          if (createdIds.has(journalId)) {
            return { ...p, submitted: 'done' as PhaseStatus };
          }
          const failInfo = (result.failed || []).find(
            (f: { journal_id: string }) => f.journal_id === journalId,
          );
          return {
            ...p,
            submitted: 'error' as PhaseStatus,
            error: failInfo?.error || 'Unknown error',
          };
        }),
      );

      setPhase('done');

      onComplete({
        totalCreated: result.totalCreated || 0,
        totalFailed: result.totalFailed || 0,
        created: result.created || [],
        failed: result.failed || [],
        tempCleaned: result.tempCleaned || false,
      });
    } catch (err) {
      console.error('[ConfirmStep] Bulk create failed:', err);
      setOverallError(
        err instanceof Error ? err.message : 'Failed to create journals',
      );
      setPhase('error');

      setProgress((prev) =>
        prev.map((p) => ({
          ...p,
          submitted: p.submitted === 'running' ? ('error' as PhaseStatus) : p.submitted,
        })),
      );
    }
  }, [userId, journalsToCreate, encryptionAvailable, tempFolder, onComplete]);

  // ── Styles ─────────────────────────────────────────────────────

  const cardBg = isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50';
  const textPrimary = isDarkMode ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  // Status icon helper
  const StatusIcon = ({ status }: { status: PhaseStatus }) => {
    switch (status) {
      case 'idle':
        return <div className={`w-4 h-4 rounded-full border-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`} />;
      case 'running':
        return <Loader2 size={16} className="animate-spin text-blue-400" />;
      case 'done':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'error':
        return <XCircle size={16} className="text-red-400" />;
    }
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center space-y-2"
      >
        <h2 className={`text-xl font-semibold ${textPrimary}`}>
          {phase === 'ready'
            ? `Your ${journalsToCreate.length} journal${journalsToCreate.length !== 1 ? 's are' : ' is'} ready!`
            : phase === 'encrypting'
              ? 'Securing your journals...'
              : phase === 'submitting'
                ? 'Almost there...'
                : phase === 'done'
                  ? 'All set!'
                  : 'Something went wrong'}
        </h2>
        <p className={textSecondary}>
          {phase === 'ready'
            ? 'Everything looks good. Tap the button below to save them.'
            : phase === 'encrypting'
              ? 'Protecting your entries with encryption...'
              : phase === 'submitting'
                ? 'Saving your journals safely...'
                : phase === 'done'
                  ? 'Your journals have been saved.'
                  : 'Don\'t worry — you can try again.'}
        </p>
      </motion.div>

      {/* Encryption banner */}
      <motion.div
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
          encryptionAvailable
            ? isDarkMode
              ? 'bg-green-500/10 border border-green-500/20'
              : 'bg-green-50 border border-green-200'
            : isDarkMode
              ? 'bg-yellow-500/10 border border-yellow-500/20'
              : 'bg-yellow-50 border border-yellow-200'
        }`}
      >
        {encryptionAvailable ? (
          <>
            <Shield size={18} className="text-green-500 shrink-0" />
            <span className={`text-sm ${isDarkMode ? 'text-green-300' : 'text-green-700'}`}>
              Your journals will be encrypted before saving — only you can read them.
            </span>
          </>
        ) : (
          <>
            <ShieldAlert size={18} className="text-yellow-500 shrink-0" />
            <span className={`text-sm ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
              Encryption isn&apos;t active right now. Journals will be saved without encryption.
            </span>
          </>
        )}
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.08 }}
          className={`${cardBg} rounded-xl p-4 text-center`}
        >
          <FileText size={20} className="mx-auto mb-1.5" style={{ color: currentTheme.primary }} />
          <div className={`text-2xl font-bold ${textPrimary}`}>{journalsToCreate.length}</div>
          <div className={`text-xs ${textSecondary}`}>
            {journalsToCreate.length === 1 ? 'Journal' : 'Journals'}
          </div>
        </motion.div>
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.12 }}
          className={`${cardBg} rounded-xl p-4 text-center`}
        >
          <ImageIcon size={20} className="mx-auto mb-1.5" style={{ color: currentTheme.primary }} />
          <div className={`text-2xl font-bold ${textPrimary}`}>
            {journalsToCreate.reduce(
              (sum, g) => sum + (g.attachImages ? g.pages.length : 0),
              0,
            )}
          </div>
          <div className={`text-xs ${textSecondary}`}>Photos</div>
        </motion.div>
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.16 }}
          className={`${cardBg} rounded-xl p-4 text-center`}
        >
          {encryptionAvailable ? (
            <Shield size={20} className="mx-auto mb-1.5 text-green-500" />
          ) : (
            <Lock size={20} className="mx-auto mb-1.5" style={{ color: currentTheme.primary }} />
          )}
          <div className={`text-lg font-bold ${textPrimary}`}>
            {encryptionAvailable ? 'Protected' : 'Standard'}
          </div>
          <div className={`text-xs ${textSecondary}`}>Privacy</div>
        </motion.div>
      </div>

      {/* Per-journal progress */}
      {progress.length > 0 && phase !== 'ready' && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="space-y-2 max-h-75 overflow-y-auto pr-1"
        >
          {progress.map((p, i) => (
            <motion.div
              key={p.groupId}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`${cardBg} rounded-xl px-4 py-3 flex items-center gap-3`}
            >
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${textPrimary}`}>
                  {p.title}
                </div>
                {p.error && (
                  <div className="text-xs text-red-400 mt-0.5">{p.error}</div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1">
                  <StatusIcon status={p.encrypted} />
                  <span className={`text-[10px] ${textSecondary}`}>
                    {p.encrypted === 'done' ? 'Secured' : p.encrypted === 'running' ? 'Securing' : 'Secure'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <StatusIcon status={p.submitted} />
                  <span className={`text-[10px] ${textSecondary}`}>
                    {p.submitted === 'done' ? 'Saved' : p.submitted === 'running' ? 'Saving' : 'Save'}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Error message */}
      {overallError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`px-4 py-3 rounded-xl ${
            isDarkMode ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'
          }`}
        >
          <p className="text-sm text-red-400">{overallError}</p>
        </motion.div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          disabled={phase === 'encrypting' || phase === 'submitting'}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            phase === 'encrypting' || phase === 'submitting'
              ? 'opacity-50 cursor-not-allowed'
              : isDarkMode
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {phase === 'ready' && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={startProcessing}
            disabled={!userId}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: currentTheme.primary }}
          >
            {encryptionAvailable && <Lock size={14} />}
            Save {journalsToCreate.length === 1 ? 'My Journal' : `My ${journalsToCreate.length} Journals`}
          </motion.button>
        )}

        {(phase === 'encrypting' || phase === 'submitting') && (
          <div className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium" style={{ color: currentTheme.primary }}>
            <Loader2 size={16} className="animate-spin" />
            {phase === 'encrypting' ? 'Securing...' : 'Saving...'}
          </div>
        )}

        {phase === 'error' && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              startedRef.current = false;
              setPhase('ready');
              setOverallError(null);
              setProgress((prev) =>
                prev.map((p) => ({
                  ...p,
                  encrypted: 'idle' as PhaseStatus,
                  submitted: 'idle' as PhaseStatus,
                  error: undefined,
                })),
              );
            }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ backgroundColor: currentTheme.primary }}
          >
            Try Again
          </motion.button>
        )}
      </div>
    </div>
  );
};

export default ConfirmStep;

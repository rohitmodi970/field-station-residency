'use client';

import { useState } from 'react';
import { Database, Loader2, RotateCcw } from 'lucide-react';
import { decryptJournalEntry } from '@/utils/encryption/journalEncryption';
import { ensureEncryptionReady } from '@/utils/encryption';
import {
  BACKFILL_SUMMARY_KEY,
  clearSyncLedger,
  getIndexedJournalCount,
  loadSyncLedger,
  saveSyncLedger,
  type SyncLedger,
} from '@/utils/vektori/syncLedger';

type Props = {
  isDarkMode: boolean;
  accentColor: string;
  disabled?: boolean;
  onComplete?: () => void;
  onSummary?: (summary: BackfillResult & { completedAt: string; uniqueIndexed: number }) => void;
};

type BackfillResult = {
  ingested: number;
  unchanged: number;
  skipped: number;
  failed: number;
  total: number;
  uniqueIndexed: number;
};

const PAGE_SIZE = 100;
const BATCH_SIZE = 25;
const LOCKED_TITLE = '🔒 Locked Entry';

async function fetchJournalPage(offset: number) {
  const response = await fetch(
    `/api/journals?limit=${PAGE_SIZE}&offset=${offset}&sortBy=created_at&sortOrder=asc&is_archived=false`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch journals');
  }

  const data = await response.json();
  return {
    journals: data.journals || [],
    total: typeof data.total === 'number' ? data.total : null,
  };
}

async function decryptJournal(entry: Record<string, unknown>, encryptionReady: boolean) {
  let title = String(entry.title || '');
  let content = String(entry.content || '');

  if (entry.is_encrypted && entry.title_encrypted && entry.content_encrypted) {
    if (!encryptionReady || typeof entry.user_id !== 'string') {
      return null;
    }

    try {
      const decrypted = await decryptJournalEntry(
        {
          title_encrypted: String(entry.title_encrypted),
          title_iv: String(entry.title_iv),
          content_encrypted: String(entry.content_encrypted),
          content_iv: String(entry.content_iv),
          date: String(entry.date || entry.journal_date || ''),
          is_favorite: Boolean(entry.is_favorite),
          is_archived: Boolean(entry.is_archived),
          journal_type: entry.journal_type as string | null | undefined,
          mood: entry.mood as string | null | undefined,
          tags: entry.tags as string[] | null | undefined,
          location: entry.location as string | null | undefined,
          weather: entry.weather as string | null | undefined,
        },
        entry.user_id
      );

      title = decrypted.title || '';
      content = decrypted.content || '';
    } catch {
      return null;
    }
  }

  if (!title.trim() && !content.trim()) {
    return null;
  }

  if (title === LOCKED_TITLE) {
    return null;
  }

  return {
    journalId: String(entry.journal_id || entry.id),
    title,
    content,
    mood: String(entry.mood || ''),
    entryDate: String(entry.journal_date || entry.date || entry.created_at || ''),
    createdAt: String(entry.created_at || ''),
    updatedAt: String(entry.updated_at || entry.created_at || ''),
  };
}

async function clearUserMemory() {
  const response = await fetch('/api/vektori/privacy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'clear' }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Failed to clear memory');
  }
}

export function VektoriBackfillButton({ isDarkMode, accentColor, disabled = false, onComplete, onSummary }: Props) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number | null } | null>(null);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runBackfill = async (options?: { force?: boolean }) => {
    if (running) return;

    setRunning(true);
    setError(null);
    setResult(null);
    setProgress({ processed: 0, total: null });

    const totals: BackfillResult = {
      ingested: 0,
      unchanged: 0,
      skipped: 0,
      failed: 0,
      total: 0,
      uniqueIndexed: 0,
    };

    let totalCount: number | null = null;
    let ledger: SyncLedger = options?.force ? {} : loadSyncLedger();

    try {
      if (options?.force) {
        await clearUserMemory();
        clearSyncLedger();
        ledger = {};
      }

      const encryptionStatus = await ensureEncryptionReady({});
      const encryptionReady = encryptionStatus.ready;

      if (encryptionStatus.status === 'needs_unlock') {
        throw new Error('Unlock your encryption first, then try syncing again.');
      }

      let offset = 0;
      let keepGoing = true;

      while (keepGoing) {
        const page = await fetchJournalPage(offset);
        const journals = page.journals as Record<string, unknown>[];

        if (page.total !== null && totalCount === null) {
          totalCount = page.total;
        }

        if (journals.length === 0) {
          break;
        }

        const prepared = [];
        for (const journal of journals) {
          const payload = await decryptJournal(journal, encryptionReady);
          totals.total += 1;
          setProgress({ processed: totals.total, total: totalCount });

          if (!payload) {
            totals.skipped += 1;
            continue;
          }

          const syncToken = payload.updatedAt || payload.createdAt || 'synced';
          if (!options?.force && ledger[payload.journalId] === syncToken) {
            totals.unchanged += 1;
            continue;
          }

          prepared.push(payload);
        }

        for (let index = 0; index < prepared.length; index += BATCH_SIZE) {
          const batch = prepared.slice(index, index + BATCH_SIZE);
          const response = await fetch('/api/vektori/backfill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ journals: batch }),
          });

          const data = await response.json().catch(() => null);
          if (!response.ok) {
            throw new Error(data?.error || 'Backfill batch failed');
          }

          totals.ingested += data.ingested || 0;
          totals.skipped += data.skipped || 0;
          totals.failed += data.failed || 0;

          const ingestedIds = Array.isArray(data.ingestedIds) ? data.ingestedIds as string[] : [];
          for (const journal of batch) {
            if (ingestedIds.includes(journal.journalId)) {
              ledger[journal.journalId] = journal.updatedAt || journal.createdAt || 'synced';
            }
          }
        }

        offset += journals.length;
        keepGoing = journals.length === PAGE_SIZE;
      }

      saveSyncLedger(ledger);
      totals.uniqueIndexed = getIndexedJournalCount(ledger);

      setResult(totals);
      const summary = { ...totals, completedAt: new Date().toISOString() };
      localStorage.setItem(BACKFILL_SUMMARY_KEY, JSON.stringify(summary));
      onSummary?.(summary);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backfill failed');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const progressPercent =
    progress?.total && progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : null;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => runBackfill()}
        disabled={disabled || running}
        className="flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition hover:opacity-80 disabled:opacity-60"
        style={{
          borderColor: `${accentColor}55`,
          color: accentColor,
          background: isDarkMode ? 'rgba(15,23,42,0.72)' : 'rgba(255,250,246,0.95)',
        }}
      >
        {running ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
        {running ? 'Syncing journals...' : 'Sync new & updated journals'}
      </button>

      <button
        type="button"
        onClick={() => runBackfill({ force: true })}
        disabled={disabled || running}
        className={`flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold transition hover:opacity-80 disabled:opacity-60 ${isDarkMode ? 'border-slate-700 text-slate-300' : 'border-[#dcc7bb] text-[#7a5148]'}`}
      >
        <RotateCcw size={12} />
        Reset memory and full re-sync
      </button>

      {running && progress && (
        <div className={`rounded-2xl border p-3 text-xs ${isDarkMode ? 'border-slate-700 text-slate-300' : 'border-[#dcc7bb] text-[#6f5048]'}`}>
          <p>
            Processed {progress.processed}
            {progress.total ? ` of ${progress.total}` : ''} journals
            {progressPercent !== null ? ` (${progressPercent}%)` : ''}
          </p>
          {progressPercent !== null && (
            <div className={`mt-2 h-2 overflow-hidden rounded-full ${isDarkMode ? 'bg-slate-800' : 'bg-[#f0e0d6]'}`}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progressPercent}%`, backgroundColor: accentColor }} />
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {result && !error && (
        <p className={`rounded-2xl border px-3 py-2 text-xs leading-5 ${isDarkMode ? 'border-slate-700 text-slate-300' : 'border-[#dcc7bb] text-[#6f5048]'}`}>
          Sync complete: {result.ingested} newly indexed, {result.unchanged} already up to date, {result.skipped} skipped, {result.failed} failed.
          {' '}Memory holds {result.uniqueIndexed} unique journals.
        </p>
      )}
    </div>
  );
}

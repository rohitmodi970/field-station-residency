'use client';

import { decryptJournalEntry } from '@/utils/encryption/journalEncryption';
import { ensureEncryptionReady } from '@/utils/encryption';
import { buildSearchPlan, expandSearchTerms, scoreTextMatch } from '@/utils/vektori/query.js';

export type LocalJournalCandidate = {
  journalId: string;
  title: string;
  content: string;
  mood?: string;
  entryDate?: string;
  broadFallback?: boolean;
};

const LOCKED_TITLE = '🔒 Locked Entry';
const MIN_CONTENT_LENGTH = 24;

function scoreJournal(title: string, content: string, baseTerms: string[], expandedTerms: string[]) {
  const titleScore = scoreTextMatch(title, baseTerms) * 3 + scoreTextMatch(title, expandedTerms);
  const contentScore = scoreTextMatch(content, baseTerms) * 2 + scoreTextMatch(content, expandedTerms);
  return titleScore + contentScore;
}

async function fetchAllJournals() {
  const pageSize = 100;
  let offset = 0;
  const all: Record<string, unknown>[] = [];

  while (true) {
    const response = await fetch(
      `/api/journals?limit=${pageSize}&offset=${offset}&sortBy=created_at&sortOrder=desc&is_archived=false`,
      { cache: 'no-store' }
    );

    if (!response.ok) break;

    const data = await response.json();
    const journals = data.journals || [];
    all.push(...journals);

    if (journals.length < pageSize) break;
    offset += journals.length;
  }

  return all;
}

async function decryptEntry(entry: Record<string, unknown>, encryptionReady: boolean) {
  let title = String(entry.title || '');
  let content = String(entry.content || '');

  if (entry.is_encrypted && entry.title_encrypted && entry.content_encrypted) {
    if (!encryptionReady || typeof entry.user_id !== 'string') return null;

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

  if (!title.trim() && !content.trim()) return null;
  if (title === LOCKED_TITLE) return null;

  return {
    journalId: String(entry.journal_id || entry.id),
    title,
    content,
    mood: String(entry.mood || ''),
    entryDate: String(entry.journal_date || entry.date || entry.created_at || ''),
  };
}

export async function findLocalJournalCandidates(query: string, limit = 8): Promise<LocalJournalCandidate[]> {
  const plan = buildSearchPlan(query);
  const baseTerms = plan.baseTerms;
  const expandedTerms = expandSearchTerms(query);

  if (baseTerms.length === 0 && expandedTerms.length === 0) return [];

  const encryptionStatus = await ensureEncryptionReady({});
  if (!encryptionStatus.ready) return [];

  const entries = await fetchAllJournals();
  const scored: Array<LocalJournalCandidate & { score: number }> = [];
  const recentSubstantive: LocalJournalCandidate[] = [];

  for (const entry of entries) {
    const decrypted = await decryptEntry(entry, true);
    if (!decrypted) continue;

    const combinedLength = `${decrypted.title}\n${decrypted.content}`.trim().length;
    if (combinedLength >= MIN_CONTENT_LENGTH) {
      recentSubstantive.push(decrypted);
    }

    const score = scoreJournal(decrypted.title, decrypted.content, baseTerms, expandedTerms);
    if (score <= 0) continue;

    scored.push({ ...decrypted, score });
  }

  if (scored.length > 0) {
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(({ score: _score, ...candidate }) => candidate);
  }

  // No keyword overlap — send recent substantive entries for semantic filtering by Claude.
  return recentSubstantive.slice(0, limit).map((candidate) => ({
    ...candidate,
    broadFallback: true,
  }));
}

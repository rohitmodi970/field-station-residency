import { scoreTextMatch } from '@/utils/vektori/query.js';

export type ParsedJournalMemory = {
  journalId: string;
  title: string;
  content: string;
  entryDate?: string;
  mood?: string;
};

export function parseJournalMemoryText(text: string): ParsedJournalMemory | null {
  const journalId = text.match(/Journal ID:\s*(.+)/)?.[1]?.trim();
  const title = text.match(/Title:\s*(.+)/)?.[1]?.trim();
  const content = text.match(/Content:\s*([\s\S]*?)(?:\nMood:|\nEntry Date:|\nCreated At:|$)/)?.[1]?.trim();
  const entryDate = text.match(/Entry Date:\s*(.+)/)?.[1]?.trim();
  const mood = text.match(/Mood:\s*(.+)/)?.[1]?.trim();

  if (!title && !content) return null;

  return {
    journalId: journalId || 'unknown',
    title: title || 'Untitled entry',
    content: content || '',
    entryDate,
    mood,
  };
}

export function collectCandidateMemories(items: Array<{ text: string; score?: number }>, limit = 12) {
  const candidates: Array<ParsedJournalMemory & { rawScore?: number }> = [];

  for (const item of items) {
    const parsed = parseJournalMemoryText(item.text);
    if (!parsed) continue;
    if (!parsed.content.trim() && !parsed.title.trim()) continue;

    candidates.push({
      ...parsed,
      rawScore: item.score,
    });

    if (candidates.length >= limit) break;
  }

  return candidates;
}

export function mergeSearchCandidates(
  vektoriCandidates: ParsedJournalMemory[],
  localCandidates: ParsedJournalMemory[],
  baseTerms: string[],
  limit = 10
) {
  const map = new Map<string, ParsedJournalMemory & { score: number }>();

  for (const candidate of [...vektoriCandidates, ...localCandidates]) {
    const score = scoreTextMatch(`${candidate.title}\n${candidate.content}`, baseTerms);
    const existing = map.get(candidate.journalId);
    if (!existing || score > existing.score) {
      map.set(candidate.journalId, { ...candidate, score });
    }
  }

  return [...map.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _score, ...candidate }) => candidate);
}

export function truncateText(text: string, maxLength = 900) {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}

export function buildCandidateContext(candidates: ParsedJournalMemory[]) {
  return candidates
    .map((candidate, index) => {
      return [
        `[${index + 1}] journal_id=${candidate.journalId}`,
        `title=${candidate.title}`,
        candidate.entryDate ? `date=${candidate.entryDate}` : '',
        candidate.mood ? `mood=${candidate.mood}` : '',
        `content=${truncateText(candidate.content, 900)}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

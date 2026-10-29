import { ingestVektoriMessages } from '@/utils/vektori/client';
import { buildVektoriJournalMessages } from '@/utils/vektori/payload.js';
import type { ParsedJournalMemory } from './parseJournalMemory';

export async function repairVektoriIndex(
  userId: string,
  candidates: ParsedJournalMemory[]
): Promise<number> {
  let repaired = 0;

  for (const candidate of candidates) {
    const messages = buildVektoriJournalMessages({
      journalId: candidate.journalId,
      title: candidate.title,
      content: candidate.content,
      mood: candidate.mood || '',
      entryDate: candidate.entryDate || '',
      eventType: 'repair',
    });

    if (messages.length === 0) continue;

    const ok = await ingestVektoriMessages({
      userId,
      sessionId: `journal-${candidate.journalId}`,
      messages,
    });

    if (ok) repaired += 1;
  }

  return repaired;
}

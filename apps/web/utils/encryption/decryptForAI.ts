// apps/web/utils/encryption/decryptForAI.ts
/**
 * Client-side decryption helper for AI features.
 *
 * For key_version >= 2 users the server cannot reconstruct the master key —
 * the wrapping credential is a random 32-byte value stored only in IndexedDB.
 * This utility fetches recent journal entries from Supabase and decrypts them
 * client-side so the plaintext can be forwarded to AI API routes.
 *
 * Privacy model:
 *   ✅ Data AT REST in DB → always AES-GCM encrypted (unchanged)
 *   ✅ Server can never reconstruct masterKey (unchanged)
 *   ⚠️ Data in transit to AI routes → plaintext (accepted trade-off;
 *       same as the existing POST /api/journal-embeddings flow)
 *
 * Requires the master key to already be loaded in memory
 * (i.e. EncryptionGate / ensureEncryptionReady has completed).
 */

import { getEncryptionKey } from './keyManager';
import { decryptText } from './crypto';
import { createClient } from '@/utils/supabase/client';
import { resolveJournalContent } from '@/utilities/journalTitle';

/** Minimal shape that AI server routes accept in their POST bodies. */
export interface AIReadyEntry {
  content: string;
  created_at: string;
  display_date?: string;
}

/**
 * Fetch and client-side decrypt the most recent `limit` journal entries.
 *
 * Returns an array of `{ content, created_at }` ready to POST to
 * `/api/prompts/personalized` or similar AI routes.
 *
 * Returns an empty array if:
 *  - No entries exist for the user
 *  - The master key is not in memory
 *  - Any unexpected error occurs (non-fatal)
 */
export async function decryptEntriesForAI(
  userId: string,
  limit = 3
): Promise<AIReadyEntry[]> {
  try {
    const supabase = createClient();

    const { data: entries, error } = await supabase
      .from('journals')
      .select(
        'content, content_encrypted, content_iv, voice_transcript_encrypted, voice_transcript_iv, is_encrypted, display_date, created_at'
      )
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('display_date', { ascending: false })
      .limit(limit);

    if (error || !entries || entries.length === 0) return [];

    // Master key must already be in memory — getEncryptionKey reads from cache only.
    let masterKey: CryptoKey;
    try {
      masterKey = await getEncryptionKey(userId);
    } catch {
      console.warn('[decryptForAI] Master key not in memory — cannot decrypt for AI');
      return [];
    }

    const results: AIReadyEntry[] = [];

    for (const entry of entries) {
      let content = entry.content || '';
      let voiceTranscript = '';

      if (entry.is_encrypted) {
        if (entry.content_encrypted && entry.content_iv) {
          try {
            content = await decryptText(entry.content_encrypted, entry.content_iv, masterKey);
          } catch {
            content = '';
          }
        }
        if (entry.voice_transcript_encrypted && entry.voice_transcript_iv) {
          try {
            voiceTranscript = await decryptText(
              entry.voice_transcript_encrypted,
              entry.voice_transcript_iv,
              masterKey
            );
          } catch {
            voiceTranscript = '';
          }
        }
      }

      const resolvedContent = resolveJournalContent({
        content,
        transcript: voiceTranscript,
      }).value;

      if (resolvedContent && resolvedContent.trim().length > 0) {
        results.push({ 
          content: resolvedContent, 
          created_at: entry.created_at,
          display_date: entry.display_date 
        });
      }
    }

    return results;
  } catch (err) {
    console.error('[decryptForAI] Unexpected error:', err);
    return [];
  }
}

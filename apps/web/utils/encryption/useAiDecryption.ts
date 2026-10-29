// apps/web/utils/encryption/useAiDecryption.ts
/**
 * React hook that provides a ready-to-use decrypt helper for AI data.
 *
 * Usage:
 *   const { decryptRow } = useAiDecryption();
 *   const plaintext = await decryptRow(decryptAiTodo, row);
 *
 * The hook reads master key + private key from the in-memory cache that
 * ensureEncryptionReady / autoInitializeEncryptionForOAuthUser populates.
 * If neither key is available (e.g. locked state), the helpers gracefully
 * return null / empty strings and log a warning.
 */

import { useCallback } from 'react';
import { getEncryptionKey, getPrivateKey } from './keyManager';
import {
  decryptAiTodo,
  decryptAudioAnalysis,
  decryptAiPromptCache,
  decryptCognitionResponse,
  decryptJournalEmbedding,
  type AiTodoDecrypted,
  type AudioAnalysisDecrypted,
  type CognitionResponseDecrypted,
  type JournalEmbeddingDecrypted,
} from './aiDataEncryption';

// Alias for readability in consumer code
export type PlaintextAiTodo = AiTodoDecrypted;

// Re-export the typed helpers so callers don't need two imports.
export type {
  AudioAnalysisDecrypted,
  CognitionResponseDecrypted,
  JournalEmbeddingDecrypted,
};


// ─────────────────────────────────────────────────────────────────────────────
// Types for decryptAiPromptCache return value
// ─────────────────────────────────────────────────────────────────────────────
export type AiPromptCacheDecrypted<T = unknown> = T | null;

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export interface AiDecryptionHook {
  /** Decrypt a single ai_todos DB row → PlaintextAiTodo */
  decryptTodo: (row: Record<string, unknown>) => Promise<PlaintextAiTodo>;
  /** Decrypt a single audio_analysis_history DB row */
  decryptAudio: (row: Record<string, unknown>) => Promise<AudioAnalysisDecrypted>;
  /** Decrypt a single ai_prompt_cache DB row as T */
  decryptPromptCache: <T = unknown>(row: Record<string, unknown>) => Promise<T | null>;
  /** Decrypt a single cognition_responses DB row */
  decryptCognition: (row: Record<string, unknown>) => Promise<CognitionResponseDecrypted>;
  /** Decrypt a single journal_embeddings DB row */
  decryptEmbedding: (row: Record<string, unknown>) => Promise<JournalEmbeddingDecrypted>;
}

/**
 * Returns a stable set of decrypt helpers that pull the master key and
 * private key from the in-memory cache.  Call from any client component.
 */
export function useAiDecryption(): AiDecryptionHook {
  const getMasterKey = useCallback(async (): Promise<CryptoKey | null> => {
    try {
      return await getEncryptionKey();
    } catch {
      return null;
    }
  }, []);

  const ensurePrivateKey = useCallback(async (masterKey: CryptoKey): Promise<CryptoKey | null> => {
    let privKey = getPrivateKey();
    if (privKey) return privKey;
    try {
      const res = await fetch('/api/encryption/key-pair');
      if (res.ok) {
        const data = await res.json();
        if (data?.encrypted_private_key && data?.private_key_iv) {
          const { loadPrivateKey } = await import('./hybridCrypto');
          privKey = await loadPrivateKey(data.encrypted_private_key, data.private_key_iv, masterKey);
        }
      }
    } catch (err) {
      console.warn('[useAiDecryption] Failed to load private key on demand:', err);
    }
    return privKey;
  }, []);

  const decryptTodo = useCallback(async (row: Record<string, unknown>): Promise<PlaintextAiTodo> => {
    const masterKey = await getMasterKey();
    if (!masterKey) return plaintextTodo(row);
    const privateKey = await ensurePrivateKey(masterKey);
    const decrypted = await decryptAiTodo(row as any, masterKey, privateKey);
    return {
      title: decrypted.title || (row.title as string) || null,
      description: decrypted.description || (row.description as string) || null,
      ai_reasoning: decrypted.ai_reasoning || (row.ai_reasoning as string) || null,
      category: decrypted.category || (row.category as string) || null,
      calendar_event_title: decrypted.calendar_event_title || (row.calendar_event_title as string) || null,
    };
  }, [getMasterKey, ensurePrivateKey]);

  const decryptAudio = useCallback(async (row: Record<string, unknown>): Promise<AudioAnalysisDecrypted> => {
    const masterKey = await getMasterKey();
    if (!masterKey) return { summary: (row.summary as string) ?? null, results: (row.results as any) ?? null };
    const privateKey = await ensurePrivateKey(masterKey);
    return decryptAudioAnalysis(row as any, masterKey, privateKey);
  }, [getMasterKey, ensurePrivateKey]);

  const decryptPromptCache = useCallback(async <T = unknown>(row: Record<string, unknown>): Promise<T | null> => {
    if (!row) return null;
    if (row._plaintext && typeof row._plaintext === 'object') {
      return row._plaintext as unknown as T;
    }
    if (row.prompt && typeof row.prompt === 'object') {
      return row as unknown as T;
    }
    if (row.response && typeof row.response === 'object' && !row.is_encrypted) {
      return row.response as unknown as T;
    }

    const masterKey = await getMasterKey();
    if (!masterKey) {
      // Legacy plaintext path — the row may have a `response` field directly or be the raw object
      return ((row.response as T) ?? ((row.prompt ? row : null) as unknown as T)) ?? null;
    }

    const privateKey = await ensurePrivateKey(masterKey);
    const decrypted = await decryptAiPromptCache<T>(row as any, masterKey, privateKey);
    if (!decrypted && row.prompt) {
      return row as unknown as T;
    }
    if (!decrypted && row.response && typeof row.response === 'object') {
      return row.response as unknown as T;
    }
    return decrypted;
  }, [getMasterKey, ensurePrivateKey]);

  const decryptCognition = useCallback(async (row: Record<string, unknown>): Promise<CognitionResponseDecrypted> => {
    const masterKey = await getMasterKey();
    if (!masterKey) return plaintextCognition(row);
    const privateKey = await ensurePrivateKey(masterKey);
    return decryptCognitionResponse(row as any, masterKey, privateKey);
  }, [getMasterKey, ensurePrivateKey]);

  const decryptEmbedding = useCallback(async (row: Record<string, unknown>): Promise<JournalEmbeddingDecrypted> => {
    const masterKey = await getMasterKey();
    if (!masterKey) return { keyword: (row.keyword as string) ?? null, category: (row.category as string) ?? null };
    const privateKey = await ensurePrivateKey(masterKey);
    return decryptJournalEmbedding(row as any, masterKey, privateKey);
  }, [getMasterKey, ensurePrivateKey]);

  return { decryptTodo, decryptAudio, decryptPromptCache, decryptCognition, decryptEmbedding };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback helpers (return plaintext from row when no master key is available)
// ─────────────────────────────────────────────────────────────────────────────

function plaintextTodo(row: Record<string, unknown>): PlaintextAiTodo {
  return {
    title: (row.title as string) ?? null,
    description: (row.description as string) ?? null,
    ai_reasoning: (row.ai_reasoning as string) ?? null,
    category: (row.category as string) ?? null,
    calendar_event_title: (row.calendar_event_title as string) ?? null,
  };
}

function plaintextCognition(row: Record<string, unknown>): CognitionResponseDecrypted {
  return {
    insight_core: (row.insight_core as string) ?? null,
    insight_tension: (row.insight_tension as string) ?? null,
    entry_text: (row.entry_text as string) ?? null,
    question_responses: (row.question_responses as any) ?? null,
    analysis_snapshot: (row.analysis_snapshot as any) ?? null,
    generated_tasks: (row.generated_tasks as any) ?? null,
    output_state: (row.output_state as any) ?? null,
  };
}

// apps/web/utils/encryption/aiDataEncryption.ts
/**
 * AI Data Encryption — Per-Table Typed Helpers
 *
 * Provides typed encrypt/decrypt functions for each of the 5 AI tables:
 *   - audio_analysis_history
 *   - ai_prompt_cache
 *   - ai_todos
 *   - cognition_responses
 *   - journal_embeddings
 *
 * SERVER WRITES (LLM output → DB):
 *   Use serverEncryptAi*() helpers — they take a JsonWebKey (user's public key)
 *   and return the encrypted column patches ready for Supabase INSERT/UPDATE.
 *
 * CLIENT READS (DB → display):
 *   Use decryptAi*() helpers — they take a DB row, the master key, and the
 *   private key, and return the plaintext fields. The smartDecrypt() function
 *   inside automatically handles v1 (AES) and v2 (ECIES) envelopes.
 *
 * DIRECT CLIENT WRITES (user input → DB):
 *   Use the existing encryptText(plaintext, masterKey) from crypto.ts to produce
 *   a v1 ciphertext. No special helper needed — just encrypt the fields and set
 *   is_encrypted = true.
 */

import { serverEncryptFields, smartDecrypt, smartDecryptJson } from './hybridCrypto';

// ─────────────────────────────────────────────────────────────────────────────
// 1. audio_analysis_history
// ─────────────────────────────────────────────────────────────────────────────

export interface AudioAnalysisEncryptedPatch {
  summary_encrypted: string | null;
  summary_iv: string | null;
  results_encrypted: string | null;
  results_iv: string | null;
  is_encrypted: true;
}

/**
 * Encrypt audio analysis fields for server-side writes (after Hume/LLM analysis).
 *
 * @param summary - Plain text summary string
 * @param results - Results object (will be JSON-serialized before encryption)
 * @param userPublicKeyJwk - User's ECDH P-256 public key (from DB)
 */
export async function serverEncryptAudioAnalysis(
  summary: string | null,
  results: Record<string, unknown> | null,
  userPublicKeyJwk: JsonWebKey | null
): Promise<AudioAnalysisEncryptedPatch> {
  const resultsStr = results != null ? JSON.stringify(results) : null;

  const enc = await serverEncryptFields(
    { summary, results: resultsStr },
    userPublicKeyJwk
  );

  return {
    summary_encrypted: enc.summary?.encrypted ?? null,
    summary_iv: enc.summary?.iv ?? null,
    results_encrypted: enc.results?.encrypted ?? null,
    results_iv: enc.results?.iv ?? null,
    is_encrypted: true,
  };
}

export interface AudioAnalysisDecrypted {
  summary: string | null;
  results: Record<string, unknown> | null;
}

/**
 * Decrypt audio analysis fields from a DB row.
 */
export async function decryptAudioAnalysis(
  row: {
    summary?: string | null;
    summary_encrypted?: string | null;
    summary_iv?: string | null;
    results?: Record<string, unknown> | null;
    results_encrypted?: string | null;
    results_iv?: string | null;
    is_encrypted?: boolean;
  },
  masterKey: CryptoKey,
  privateKey: CryptoKey | null
): Promise<AudioAnalysisDecrypted> {
  if (!row.is_encrypted) {
    // Legacy plaintext row
    return {
      summary: row.summary ?? null,
      results: row.results ?? null,
    };
  }

  const summary = await smartDecrypt(row.summary_encrypted, row.summary_iv, masterKey, privateKey);
  const results = await smartDecryptJson<Record<string, unknown>>(
    row.results_encrypted,
    row.results_iv,
    masterKey,
    privateKey
  );

  return { summary, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ai_prompt_cache
// ─────────────────────────────────────────────────────────────────────────────

export interface AiPromptCacheEncryptedPatch {
  response_encrypted: string | null;
  response_iv: string | null;
  is_encrypted: true;
}

/**
 * Encrypt the AI prompt cache response for server-side writes.
 *
 * @param response - The JSON-serializable Claude/LLM response object
 * @param userPublicKeyJwk - User's ECDH P-256 public key
 */
export async function serverEncryptAiPromptCache(
  response: Record<string, unknown>,
  userPublicKeyJwk: JsonWebKey | null
): Promise<AiPromptCacheEncryptedPatch> {
  const responseStr = JSON.stringify(response);

  const enc = await serverEncryptFields(
    { response: responseStr },
    userPublicKeyJwk
  );

  return {
    response_encrypted: enc.response?.encrypted ?? null,
    response_iv: enc.response?.iv ?? null,
    is_encrypted: true,
  };
}

/**
 * Decrypt an ai_prompt_cache response from a DB row.
 * Returns the parsed JSON object, or the legacy plaintext response JSONB if not encrypted.
 */
export async function decryptAiPromptCache<T = Record<string, unknown>>(
  row: {
    response?: T | null;
    response_encrypted?: string | null;
    response_iv?: string | null;
    is_encrypted?: boolean;
  },
  masterKey: CryptoKey,
  privateKey: CryptoKey | null
): Promise<T | null> {
  if (!row.is_encrypted) {
    return row.response ?? null;
  }

  return smartDecryptJson<T>(row.response_encrypted, row.response_iv, masterKey, privateKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ai_todos
// ─────────────────────────────────────────────────────────────────────────────

export interface AiTodoEncryptedPatch {
  title_encrypted: string | null;
  title_iv: string | null;
  description_encrypted: string | null;
  description_iv: string | null;
  ai_reasoning_encrypted: string | null;
  ai_reasoning_iv: string | null;
  category_encrypted: string | null;
  category_iv: string | null;
  calendar_event_title_encrypted: string | null;
  calendar_event_title_iv: string | null;
  is_encrypted: true;
}

/**
 * Encrypt ai_todo sensitive fields for server-side writes.
 * Called after the LLM generates todos from calendar events.
 */
export async function serverEncryptAiTodo(
  fields: {
    title: string;
    description?: string | null;
    ai_reasoning?: string | null;
    category?: string | null;
    calendar_event_title?: string | null;
  },
  userPublicKeyJwk: JsonWebKey | null
): Promise<AiTodoEncryptedPatch> {
  const enc = await serverEncryptFields(
    {
      title: fields.title,
      description: fields.description ?? null,
      ai_reasoning: fields.ai_reasoning ?? null,
      category: fields.category ?? null,
      calendar_event_title: fields.calendar_event_title ?? null,
    },
    userPublicKeyJwk
  );

  return {
    title_encrypted: enc.title?.encrypted ?? null,
    title_iv: enc.title?.iv ?? null,
    description_encrypted: enc.description?.encrypted ?? null,
    description_iv: enc.description?.iv ?? null,
    ai_reasoning_encrypted: enc.ai_reasoning?.encrypted ?? null,
    ai_reasoning_iv: enc.ai_reasoning?.iv ?? null,
    category_encrypted: enc.category?.encrypted ?? null,
    category_iv: enc.category?.iv ?? null,
    calendar_event_title_encrypted: enc.calendar_event_title?.encrypted ?? null,
    calendar_event_title_iv: enc.calendar_event_title?.iv ?? null,
    is_encrypted: true,
  };
}

export interface AiTodoDecrypted {
  title: string | null;
  description: string | null;
  ai_reasoning: string | null;
  category: string | null;
  calendar_event_title: string | null;
}

/**
 * Decrypt ai_todo sensitive fields from a DB row.
 */
export async function decryptAiTodo(
  row: {
    title?: string | null;
    description?: string | null;
    ai_reasoning?: string | null;
    category?: string | null;
    calendar_event_title?: string | null;
    title_encrypted?: string | null;
    title_iv?: string | null;
    description_encrypted?: string | null;
    description_iv?: string | null;
    ai_reasoning_encrypted?: string | null;
    ai_reasoning_iv?: string | null;
    category_encrypted?: string | null;
    category_iv?: string | null;
    calendar_event_title_encrypted?: string | null;
    calendar_event_title_iv?: string | null;
    is_encrypted?: boolean;
  },
  masterKey: CryptoKey,
  privateKey: CryptoKey | null
): Promise<AiTodoDecrypted> {
  if (!row.is_encrypted) {
    return {
      title: row.title ?? null,
      description: row.description ?? null,
      ai_reasoning: row.ai_reasoning ?? null,
      category: row.category ?? null,
      calendar_event_title: row.calendar_event_title ?? null,
    };
  }

  const [title, description, ai_reasoning, category, calendar_event_title] = await Promise.all([
    smartDecrypt(row.title_encrypted, row.title_iv, masterKey, privateKey),
    smartDecrypt(row.description_encrypted, row.description_iv, masterKey, privateKey),
    smartDecrypt(row.ai_reasoning_encrypted, row.ai_reasoning_iv, masterKey, privateKey),
    smartDecrypt(row.category_encrypted, row.category_iv, masterKey, privateKey),
    smartDecrypt(row.calendar_event_title_encrypted, row.calendar_event_title_iv, masterKey, privateKey),
  ]);

  return { title, description, ai_reasoning, category, calendar_event_title };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. cognition_responses
// ─────────────────────────────────────────────────────────────────────────────

export interface CognitionResponseEncryptedPatch {
  insight_core_encrypted: string | null;
  insight_core_iv: string | null;
  insight_tension_encrypted: string | null;
  insight_tension_iv: string | null;
  entry_text_encrypted: string | null;
  entry_text_iv: string | null;
  question_responses_encrypted: string | null;
  question_responses_iv: string | null;
  analysis_snapshot_encrypted: string | null;
  analysis_snapshot_iv: string | null;
  generated_tasks_encrypted: string | null;
  generated_tasks_iv: string | null;
  output_state_encrypted: string | null;
  output_state_iv: string | null;
  is_encrypted: true;
}

/**
 * Encrypt all sensitive fields of a cognition_response for server-side writes.
 */
export async function serverEncryptCognitionResponse(
  fields: {
    insight_core: string;
    insight_tension?: string | null;
    entry_text?: string | null;
    question_responses: Array<{ id: string; question: string; answer: string }>;
    analysis_snapshot?: Record<string, unknown> | null;
    generated_tasks?: Array<Record<string, unknown>> | null;
    output_state?: Record<string, unknown> | null;
  },
  userPublicKeyJwk: JsonWebKey | null
): Promise<CognitionResponseEncryptedPatch> {
  const enc = await serverEncryptFields(
    {
      insight_core: fields.insight_core,
      insight_tension: fields.insight_tension ?? null,
      entry_text: fields.entry_text ?? null,
      question_responses: JSON.stringify(fields.question_responses),
      analysis_snapshot: fields.analysis_snapshot ? JSON.stringify(fields.analysis_snapshot) : null,
      generated_tasks: fields.generated_tasks ? JSON.stringify(fields.generated_tasks) : null,
      output_state: fields.output_state ? JSON.stringify(fields.output_state) : null,
    },
    userPublicKeyJwk
  );

  return {
    insight_core_encrypted: enc.insight_core?.encrypted ?? null,
    insight_core_iv: enc.insight_core?.iv ?? null,
    insight_tension_encrypted: enc.insight_tension?.encrypted ?? null,
    insight_tension_iv: enc.insight_tension?.iv ?? null,
    entry_text_encrypted: enc.entry_text?.encrypted ?? null,
    entry_text_iv: enc.entry_text?.iv ?? null,
    question_responses_encrypted: enc.question_responses?.encrypted ?? null,
    question_responses_iv: enc.question_responses?.iv ?? null,
    analysis_snapshot_encrypted: enc.analysis_snapshot?.encrypted ?? null,
    analysis_snapshot_iv: enc.analysis_snapshot?.iv ?? null,
    generated_tasks_encrypted: enc.generated_tasks?.encrypted ?? null,
    generated_tasks_iv: enc.generated_tasks?.iv ?? null,
    output_state_encrypted: enc.output_state?.encrypted ?? null,
    output_state_iv: enc.output_state?.iv ?? null,
    is_encrypted: true,
  };
}

export interface CognitionResponseDecrypted {
  insight_core: string | null;
  insight_tension: string | null;
  entry_text: string | null;
  question_responses: Array<{ id: string; question: string; answer: string }> | null;
  analysis_snapshot: Record<string, unknown> | null;
  generated_tasks: Array<Record<string, unknown>> | null;
  output_state: Record<string, unknown> | null;
}

/**
 * Decrypt all sensitive fields of a cognition_response row.
 */
export async function decryptCognitionResponse(
  row: {
    insight_core?: string | null;
    insight_tension?: string | null;
    entry_text?: string | null;
    question_responses?: Array<{ id: string; question: string; answer: string }> | null;
    analysis_snapshot?: Record<string, unknown> | null;
    generated_tasks?: Array<Record<string, unknown>> | null;
    output_state?: Record<string, unknown> | null;
    insight_core_encrypted?: string | null;
    insight_core_iv?: string | null;
    insight_tension_encrypted?: string | null;
    insight_tension_iv?: string | null;
    entry_text_encrypted?: string | null;
    entry_text_iv?: string | null;
    question_responses_encrypted?: string | null;
    question_responses_iv?: string | null;
    analysis_snapshot_encrypted?: string | null;
    analysis_snapshot_iv?: string | null;
    generated_tasks_encrypted?: string | null;
    generated_tasks_iv?: string | null;
    output_state_encrypted?: string | null;
    output_state_iv?: string | null;
    is_encrypted?: boolean;
  },
  masterKey: CryptoKey,
  privateKey: CryptoKey | null
): Promise<CognitionResponseDecrypted> {
  if (!row.is_encrypted) {
    return {
      insight_core: row.insight_core ?? null,
      insight_tension: row.insight_tension ?? null,
      entry_text: row.entry_text ?? null,
      question_responses: row.question_responses ?? null,
      analysis_snapshot: row.analysis_snapshot ?? null,
      generated_tasks: row.generated_tasks ?? null,
      output_state: row.output_state ?? null,
    };
  }

  const [
    insight_core,
    insight_tension,
    entry_text,
    question_responses,
    analysis_snapshot,
    generated_tasks,
    output_state,
  ] = await Promise.all([
    smartDecrypt(row.insight_core_encrypted, row.insight_core_iv, masterKey, privateKey),
    smartDecrypt(row.insight_tension_encrypted, row.insight_tension_iv, masterKey, privateKey),
    smartDecrypt(row.entry_text_encrypted, row.entry_text_iv, masterKey, privateKey),
    smartDecryptJson<Array<{ id: string; question: string; answer: string }>>(
      row.question_responses_encrypted, row.question_responses_iv, masterKey, privateKey
    ),
    smartDecryptJson<Record<string, unknown>>(
      row.analysis_snapshot_encrypted, row.analysis_snapshot_iv, masterKey, privateKey
    ),
    smartDecryptJson<Array<Record<string, unknown>>>(
      row.generated_tasks_encrypted, row.generated_tasks_iv, masterKey, privateKey
    ),
    smartDecryptJson<Record<string, unknown>>(
      row.output_state_encrypted, row.output_state_iv, masterKey, privateKey
    ),
  ]);

  return {
    insight_core,
    insight_tension,
    entry_text,
    question_responses,
    analysis_snapshot,
    generated_tasks,
    output_state,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. journal_embeddings
// ─────────────────────────────────────────────────────────────────────────────

export interface JournalEmbeddingEncryptedPatch {
  keyword_encrypted: string | null;
  keyword_iv: string | null;
  category_encrypted: string | null;
  category_iv: string | null;
  is_encrypted: true;
}

/**
 * Encrypt journal_embedding keyword and category for server-side writes.
 * NOTE: embedding VECTOR(768) is intentionally NOT encrypted.
 */
export async function serverEncryptJournalEmbedding(
  keyword: string | null,
  category: string | null,
  userPublicKeyJwk: JsonWebKey | null
): Promise<JournalEmbeddingEncryptedPatch> {
  const enc = await serverEncryptFields(
    { keyword, category },
    userPublicKeyJwk
  );

  return {
    keyword_encrypted: enc.keyword?.encrypted ?? null,
    keyword_iv: enc.keyword?.iv ?? null,
    category_encrypted: enc.category?.encrypted ?? null,
    category_iv: enc.category?.iv ?? null,
    is_encrypted: true,
  };
}

export interface JournalEmbeddingDecrypted {
  keyword: string | null;
  category: string | null;
}

/**
 * Decrypt journal_embedding keyword and category from a DB row.
 */
export async function decryptJournalEmbedding(
  row: {
    keyword?: string | null;
    category?: string | null;
    keyword_encrypted?: string | null;
    keyword_iv?: string | null;
    category_encrypted?: string | null;
    category_iv?: string | null;
    is_encrypted?: boolean;
  },
  masterKey: CryptoKey,
  privateKey: CryptoKey | null
): Promise<JournalEmbeddingDecrypted> {
  if (!row.is_encrypted) {
    return {
      keyword: row.keyword ?? null,
      category: row.category ?? null,
    };
  }

  const [keyword, category] = await Promise.all([
    smartDecrypt(row.keyword_encrypted, row.keyword_iv, masterKey, privateKey),
    smartDecrypt(row.category_encrypted, row.category_iv, masterKey, privateKey),
  ]);

  return { keyword, category };
}

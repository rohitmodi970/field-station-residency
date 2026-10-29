import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { parsePublicKeyFromDb } from '@/utils/encryption/hybridCrypto';
import {
  serverEncryptAiTodo,
  serverEncryptAudioAnalysis,
  serverEncryptAiPromptCache,
  serverEncryptCognitionResponse,
  serverEncryptJournalEmbedding,
} from '@/utils/encryption/aiDataEncryption';

const BATCH_SIZE = 50;

const VALID_TABLES = [
  'ai_todos',
  'audio_analysis_history',
  'ai_prompt_cache',
  'cognition_responses',
  'journal_embeddings',
] as const;

type ValidTable = typeof VALID_TABLES[number];

export async function POST(req: NextRequest) {
  try {
    // createClient() is async in the App Router — must be awaited
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { table, limit = BATCH_SIZE } = body;

    if (!table || !VALID_TABLES.includes(table as ValidTable)) {
      return NextResponse.json(
        { error: `Invalid table name. Allowed: ${VALID_TABLES.join(', ')}` },
        { status: 400 }
      );
    }

    // 1. Fetch user's public key
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('encryption_public_key, key_version')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.encryption_public_key) {
      return NextResponse.json({
        error: 'No encryption public key found. Ensure encryption is initialized for this user.',
      }, { status: 400 });
    }

    // parsePublicKeyFromDb is synchronous (JSON.parse wrapper) — no await needed
    const publicKey = parsePublicKeyFromDb(userData.encryption_public_key);

    // 2. Fetch unencrypted rows
    const { data: rows, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', user.id)
      .eq('is_encrypted', false)
      .limit(limit);

    if (fetchError) {
      console.error('[Backfill] Error fetching rows', { table, error: fetchError });
      return NextResponse.json({ error: 'Failed to fetch rows' }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ message: 'No unencrypted rows found', processed: 0 });
    }

    // 3. Process each row
    let processed = 0;

    for (const row of rows) {
      try {
        let encryptedFields: Record<string, unknown> = {};

        switch (table as ValidTable) {
          case 'ai_todos':
            encryptedFields = await serverEncryptAiTodo(
              {
                title: row.title,
                description: row.description ?? null,
                ai_reasoning: row.ai_reasoning ?? null,
                category: row.category ?? null,
                calendar_event_title: row.calendar_event_title ?? null,
              },
              publicKey
            ) as unknown as Record<string, unknown>;
            break;

          case 'audio_analysis_history':
            // serverEncryptAudioAnalysis(summary, results, pubKey) — positional args
            encryptedFields = await serverEncryptAudioAnalysis(
              row.summary ?? null,
              row.results ?? null,
              publicKey
            ) as unknown as Record<string, unknown>;
            break;

          case 'ai_prompt_cache': {
            // response column may be stored as a JSON object or a serialized string;
            // serverEncryptAiPromptCache expects a Record — parse if needed.
            const responseObj: Record<string, unknown> =
              typeof row.response === 'string'
                ? (JSON.parse(row.response) as Record<string, unknown>)
                : (row.response as Record<string, unknown>) ?? {};
            encryptedFields = await serverEncryptAiPromptCache(responseObj, publicKey) as unknown as Record<string, unknown>;
            break;
          }

          case 'cognition_responses':
            encryptedFields = await serverEncryptCognitionResponse(
              {
                insight_core: row.insight_core,
                insight_tension: row.insight_tension ?? null,
                entry_text: row.entry_text ?? null,
                question_responses: row.question_responses ?? [],
                analysis_snapshot: row.analysis_snapshot ?? null,
                generated_tasks: row.generated_tasks ?? null,
                output_state: row.output_state ?? null,
              },
              publicKey
            ) as unknown as Record<string, unknown>;
            break;

          case 'journal_embeddings':
            // serverEncryptJournalEmbedding(keyword, category, pubKey) — positional args
            encryptedFields = await serverEncryptJournalEmbedding(
              row.keyword ?? null,
              row.category ?? null,
              publicKey
            ) as unknown as Record<string, unknown>;
            break;
        }

        // 4. Perform the update
        // Plaintext columns are kept intact during the transition window.
        // is_encrypted is already set to true by the encrypt helpers above.
        const { error: updateError } = await supabase
          .from(table)
          .update(encryptedFields)
          .eq('id', row.id);

        if (updateError) {
          console.error('[Backfill] Failed to update row', { rowId: row.id, table, error: updateError });
        } else {
          processed++;
        }
      } catch (encryptError) {
        console.error('[Backfill] Failed to encrypt row', { rowId: row.id, table, error: encryptError });
      }
    }

    return NextResponse.json({
      message: `Processed ${processed} rows`,
      processed,
      total_found: rows.length,
      has_more: rows.length === limit,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[Backfill API] Unexpected error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

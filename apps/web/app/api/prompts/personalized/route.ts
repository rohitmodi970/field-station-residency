import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { deriveKeyFromPassword, decryptText, base64ToUint8Array, importMasterKey } from '@/utils/encryption/crypto';
import { resolveJournalContent } from '@/utilities/journalTitle';
import { serverEncryptAiPromptCache } from '@/utils/encryption/aiDataEncryption';
import { parsePublicKeyFromDb } from '@/utils/encryption/hybridCrypto';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AIReadyEntry {
  content: string;
  created_at: string;
  display_date?: string;
}

// ─── Core: generate prompt from journal entries via Claude ────────────────────

/**
 * Shared logic: given pre-decrypted entries, call Claude and return a response.
 * Used by both GET (server-decrypted, key_version=1) and POST (client-decrypted, key_version>=2).
 * Only returns dynamic AI-generated prompts — no curated fallbacks.
 */
async function generatePromptFromEntries(
  validEntries: AIReadyEntry[],
  userId: string,
  adminClient: ReturnType<typeof createAdminClient>,
  force: boolean = false,
  currentPrompt: string = ''
): Promise<NextResponse> {
  if (validEntries.length === 0) {
    console.warn('[Prompts] No journal entries available — cannot generate dynamic prompt.');
    return NextResponse.json(
      { error: 'no_entries', message: 'Write a few journal entries first so we can personalize your prompts.' },
      { status: 404 }
    );
  }

  // Build a stable cache key based on content + timestamps + current date (24-hour TTL)
  const today = new Date().toISOString().slice(0, 10);
  const entriesSignature = JSON.stringify(
    validEntries.map(entry => ({
      content: entry.content,
      created_at: entry.created_at,
      display_date: entry.display_date,
    }))
  ) + `|${today}`;
  const cacheKey = createHash('sha256').update(entriesSignature).digest('hex');

  // Return cached response if available and not force-refreshed
  if (!force) {
    const { data: cachedRow, error: cacheError } = await adminClient
      .from('ai_prompt_cache')
      .select('*')
      .eq('user_id', userId)
      .eq('cache_key', cacheKey)
      .single();

    if (!cacheError && cachedRow) {
      // Return the full DB row — client will decrypt if needed
      console.log('[Prompts] Returning cached prompt row for user', userId);
      return NextResponse.json(cachedRow);
    }
  } else {
    console.log('[Prompts] Force refresh — bypassing cache for user', userId);
  }

  // ─── Call Claude ──────────────────────────────────────────────────────────

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[Prompts] ANTHROPIC_API_KEY is not configured — cannot generate dynamic prompt.');
    return NextResponse.json(
      { error: 'api_key_missing', message: 'AI prompt generation is currently unavailable. Please try again later.' },
      { status: 503 }
    );
  }

  const forceInstruction = force
    ? `\nNote: The user requested a fresh perspective (refresh). Choose an insightful angle that feels distinct from typical journaling prompts.${currentPrompt ? ` Do NOT repeat or closely rephrase this current prompt: "${currentPrompt}". Ask a completely different question.` : ''}`
    : '';

  const claudePrompt = `Based on the following recent journal entries, generate both a personalized writing prompt and AI suggestions. Analyze the entries for mood trends, patterns, and potential areas for growth.${forceInstruction}

Recent Journal Entries:

${validEntries.map((entry, index) => {
    const displayDateStr = entry.display_date ? ` (Journal Date: ${new Date(entry.display_date).toLocaleDateString()})` : '';
    const createdDateStr = ` (Created: ${new Date(entry.created_at).toLocaleDateString()})`;
    return `Entry ${index + 1}${displayDateStr}${createdDateStr}:\n${entry.content}\n---`;
  }).join('\n\n')}

Generate a response in the following JSON format:
{
  "prompt": {
    "text": "The writing prompt question",
    "explanation": "A brief explanation of why this prompt might be helpful"
  },
  "suggestions": {
    "moodTrends": {
      "primaryMood": "The dominant emotion in recent entries",
      "trend": "How the mood has been changing (increasing, decreasing, fluctuating)",
      "intensity": "A number between 0 and 1 indicating the strength of the emotion"
    },
    "aiNudge": {
      "theme": "A specific theme or topic to explore",
      "suggestion": "A personalized suggestion based on their writing",
      "action": "A specific, actionable step they can take"
    },
    "patternInsight": {
      "pattern": "An observed pattern in their writing",
      "exploration": "A suggestion for exploring this pattern further"
    }
  }
}

The response should:
1. Be personalized to their current situation and writing patterns
2. Identify emotional trends and patterns
3. Provide actionable suggestions
4. Encourage deeper reflection
5. Be supportive and constructive
6. Never suggest abandoning, discarding, or cutting off a person as a first-line recommendation
7. For relationship stress, prioritize boundaries, respectful communication, support-seeking, and reflection

Return ONLY the JSON object, no additional text.`;

  let claudeResponse: Response;
  const claudeStart = Date.now();
  // Abort the Claude call after 25 seconds — a forcibly-closed TCP connection
  // (wsarecv error) will otherwise leave `fetch` hanging forever, keeping the
  // client skeleton loading indefinitely.
  const claudeAbort = new AbortController();
  const claudeTimeout = setTimeout(() => {
    console.error(`[Prompts:Server] [3/6] Claude call timed out after 25s — aborting.`);
    claudeAbort.abort();
  }, 25_000);
  const claudeModel = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
  console.log(`[Prompts:Server] [3/6] Calling Claude API... (model: ${claudeModel}, max_tokens: 1024, temp: ${force ? 0.7 : 0.2})`);
  try {
    claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: claudeModel,
        messages: [{ role: 'user', content: claudePrompt }],
        max_tokens: 1024,
        temperature: force ? 0.7 : 0.2,
      }),
      signal: claudeAbort.signal,
    });
    clearTimeout(claudeTimeout);
    console.log(`[Prompts:Server] [3/6] Claude responded in ${Date.now() - claudeStart}ms — HTTP ${claudeResponse.status}`);
  } catch (networkError: any) {
    clearTimeout(claudeTimeout);
    const isAbort = networkError?.name === 'AbortError';
    const elapsed = Date.now() - claudeStart;
    console.error(`[Prompts:Server] Claude call failed after ${elapsed}ms (${isAbort ? 'timeout' : networkError?.message}) — no fallback.`);
    return NextResponse.json(
      { error: 'claude_network_error', message: 'AI prompt generation timed out. Please try refreshing again.' },
      { status: 502 }
    );
  }

  if (!claudeResponse.ok) {
    let errorMessage = `Claude API error (${claudeResponse.status})`;
    try {
      const err = await claudeResponse.json();
      errorMessage = err.error?.message || errorMessage;
    } catch { /* ignore parse error */ }

    console.error(`[Prompts] Claude returned ${claudeResponse.status}: ${errorMessage} — no fallback.`);
    return NextResponse.json(
      { error: 'claude_api_error', message: 'AI prompt generation failed. Please try refreshing again.' },
      { status: 502 }
    );
  }

  const claudeData = await claudeResponse.json();
  const rawText = claudeData.content?.[0]?.text || '';
  const cleanedText = rawText
    .replace(/```json\n?|\n?```/g, '')
    .replace(/^json\n?/g, '')
    .trim();

  console.log(`[Prompts:Server] [4/6] Parsing Claude JSON response (raw text length: ${rawText.length})...`);
  let responseData: Record<string, unknown>;
  try {
    responseData = JSON.parse(cleanedText);
    console.log(`[Prompts:Server] [4/6] JSON parsed OK. Keys: [${Object.keys(responseData).join(', ')}]`);
    console.log(`[Prompts:Server] [4/6] prompt.text preview: "${(responseData?.prompt as any)?.text?.slice(0, 80)}"`);
  } catch (parseError) {
    console.error('[Prompts:Server] [4/6] Failed to parse Claude response as JSON:', parseError);
    return NextResponse.json(
      { error: 'claude_parse_error', message: 'AI response was malformed. Please try refreshing again.' },
      { status: 502 }
    );
  }

  // Validate the shape before caching
  if (!responseData?.prompt || typeof (responseData.prompt as any)?.text !== 'string') {
    console.error('[Prompts:Server] [4/6] Claude response missing required prompt.text field:', responseData);
    return NextResponse.json(
      { error: 'claude_invalid_response', message: 'AI response was incomplete. Please try refreshing again.' },
      { status: 502 }
    );
  }

  // ─── Cache response (encrypted if user has public key) ────────────────────

  const { data: userData } = await adminClient
    .from('users')
    .select('encryption_public_key')
    .eq('id', userId)
    .single();
  const pubKey = parsePublicKeyFromDb(userData?.encryption_public_key);
  console.log(`[Prompts:Server] [5/6] User public key found: ${!!pubKey}. Preparing cache row...`);

  let cacheRow: Record<string, unknown> = { user_id: userId, cache_key: cacheKey };
  if (pubKey) {
    const enc = await serverEncryptAiPromptCache(responseData, pubKey);
    cacheRow = { ...cacheRow, ...enc };
    console.log(`[Prompts:Server] [5/6] Response encrypted with user public key.`);
  } else {
    cacheRow.response = responseData;
    console.log(`[Prompts:Server] [5/6] No public key — storing plaintext response.`);
  }

  console.log(`[Prompts:Server] [6/6] Upserting cache row to ai_prompt_cache...`);
  const upsertStart = Date.now();
  const { data: upsertedRow, error: upsertError } = await adminClient
    .from('ai_prompt_cache')
    .upsert(cacheRow, { onConflict: 'user_id,cache_key' })
    .select('*')
    .single();

  if (upsertError || !upsertedRow) {
    console.warn(`[Prompts:Server] [6/6] Cache upsert failed after ${Date.now() - upsertStart}ms — returning plaintext response directly.`, upsertError);
    // Return plaintext directly — client reads it without decryption needed.
    return NextResponse.json({ ...responseData, _plaintext: responseData });
  }

  console.log(`[Prompts:Server] [6/6] Cache upsert OK in ${Date.now() - upsertStart}ms. Returning row with _plaintext.`);
  // Attach the verified plaintext to the response (HTTP only, never persisted).
  // This lets the client use the data immediately even if the ECIES private key
  // is not yet loaded in memory, avoiding an indefinite skeleton loading state.
  return NextResponse.json({ ...upsertedRow, _plaintext: responseData });
}

// ─── GET handler (key_version = 1 legacy path) ────────────────────────────────

/**
 * Legacy GET path: server fetches journals and attempts server-side decrypt.
 * Works for key_version = 1 users (credential = user.id, 100k PBKDF2 iterations).
 * For key_version >= 2 users, the server cannot decrypt. Client should use POST.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Prompts] GET personalized prompt endpoint called');

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true' || searchParams.get('refresh') === 'true';
    const currentPrompt = searchParams.get('current') || searchParams.get('exclude') || '';

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { data: userData } = await adminClient
      .from('users')
      .select('encryption_salt, encrypted_master_key, master_key_iv, key_version')
      .eq('id', user.id)
      .single();

    const { data: recentEntries, error: journalError } = await adminClient
      .from('journals')
      .select('content, content_encrypted, content_iv, voice_transcript_encrypted, voice_transcript_iv, is_encrypted, created_at, display_date')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(3);

    if (journalError) {
      console.error('[Prompts] Error fetching journals:', journalError);
      return NextResponse.json({ error: 'journal_fetch_error', message: 'Failed to fetch journal entries.' }, { status: 500 });
    }

    let masterKey: CryptoKey | null = null;
    const keyVersion = userData?.key_version ?? 1;

    if (
      keyVersion <= 1 &&
      userData?.encryption_salt &&
      userData?.encrypted_master_key &&
      userData?.master_key_iv
    ) {
      try {
        const salt = base64ToUint8Array(userData.encryption_salt);
        const passwordKey = await deriveKeyFromPassword(user.id, salt);
        const masterKeyBase64 = await decryptText(
          userData.encrypted_master_key,
          userData.master_key_iv,
          passwordKey
        );
        const masterKeyBytes = base64ToUint8Array(masterKeyBase64);
        masterKey = await importMasterKey(masterKeyBytes);
        console.log('[Prompts] Successfully decrypted master key (key_version=1)');
      } catch (error) {
        console.error('[Prompts] Failed to decrypt master key:', error);
      }
    } else if (keyVersion >= 2) {
      console.log('[Prompts] key_version=2 — skipping server-side decrypt. Client should use POST.');
    }

    const decryptedEntries = await Promise.all(
      (recentEntries || []).map(async (entry) => {
        let content = entry.content || '';
        let voiceTranscript = '';

        if (entry.is_encrypted && entry.content_encrypted && entry.content_iv && masterKey) {
          try {
            content = await decryptText(entry.content_encrypted, entry.content_iv, masterKey);
          } catch { content = ''; }
        }

        if (entry.is_encrypted && entry.voice_transcript_encrypted && entry.voice_transcript_iv && masterKey) {
          try {
            voiceTranscript = await decryptText(entry.voice_transcript_encrypted, entry.voice_transcript_iv, masterKey);
          } catch { voiceTranscript = ''; }
        }

        const resolvedContent = resolveJournalContent({ content, transcript: voiceTranscript }).value;
        return { content: resolvedContent, created_at: entry.created_at, display_date: entry.display_date };
      })
    );

    const validEntries = decryptedEntries.filter(e => e.content && e.content.trim().length > 0);
    return generatePromptFromEntries(validEntries, user.id, adminClient, force, currentPrompt);

  } catch (error) {
    console.error('[Prompts] Unhandled error in GET handler:', error);
    return NextResponse.json(
      { error: 'unexpected_error', message: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}

// ─── POST handler (key_version >= 2 client-decrypted path) ───────────────────

/**
 * Client-decrypted POST path.
 * The client decrypts journal entries locally (using the in-memory master key)
 * and posts them here as plaintext. The server never touches the encryption key.
 *
 * Body: { entries: [{ content: string, created_at: string }], force?: boolean, currentPrompt?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const force = searchParams.get('force') === 'true' || searchParams.get('refresh') === 'true' || body?.force === true;
    const currentPrompt = searchParams.get('current') || searchParams.get('exclude') || body?.currentPrompt || body?.exclude || '';

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const entries: AIReadyEntry[] = Array.isArray(body?.entries) ? body.entries : [];
    const validEntries = entries.filter(
      e => e && typeof e.content === 'string' && e.content.trim().length > 0
    );

    console.log(`[Prompts] POST — ${validEntries.length} entries for user ${user.id} (force: ${force})`);

    const adminClient = createAdminClient();
    return generatePromptFromEntries(validEntries, user.id, adminClient, force, currentPrompt);

  } catch (error) {
    console.error('[Prompts] Unhandled error in POST handler:', error);
    return NextResponse.json(
      { error: 'unexpected_error', message: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}

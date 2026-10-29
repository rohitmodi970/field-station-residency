import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { serverEncryptAiPromptCache } from '@/utils/encryption/aiDataEncryption';
import { parsePublicKeyFromDb } from '@/utils/encryption/hybridCrypto';
import { executeLLMRequest } from '@/lib/llm/llmService';

type GreetingSource = 'waitlist' | 'journal' | 'reengagement' | 'fallback';

interface HeroGreeting {
  badge: string;
  title: string;
  subtitle: string;
  source: GreetingSource;
}

interface GreetingRequestBody {
  baseGreeting: HeroGreeting;
  recentJournalSnippets?: string[];
  daysSinceLastEntry?: number | null;
  isNewUserContext?: boolean;
  friendlyContext?: {
    firstName?: string;
    toneMode?: 'gentle_friend' | 'coach_friend' | 'reflective_friend';
    totalEntries?: number;
    streakCount?: number;
    averageMood?: string;
    topTopics?: string[];
    localHour?: number;
  };
}

interface CachedGreetingResponse {
  greeting: HeroGreeting;
  meta?: {
    source?: string;
    reason?: string;
  };
  cachedAt?: number;
}

const GREETING_CACHE_TTL_MS = 30 * 60 * 1000;
const GREETING_CACHE_VERSION = 'v1';

function cleanJsonText(text: string): string {
  return text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
}

function clampText(value: string, maxLen: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trim()}…`;
}

function normalizeGreeting(input: Partial<HeroGreeting>, fallback: HeroGreeting): HeroGreeting {
  return {
    source: fallback.source,
    badge: clampText(input.badge || fallback.badge, 48),
    title: clampText(input.title || fallback.title, 110),
    subtitle: clampText(input.subtitle || fallback.subtitle, 220),
  };
}

function createGreetingCacheKey(body: GreetingRequestBody): string {
  const signaturePayload = {
    v: GREETING_CACHE_VERSION,
    baseGreeting: body.baseGreeting,
    snippets: (body.recentJournalSnippets || []).slice(0, 2),
    daysSinceLastEntry: body.daysSinceLastEntry ?? null,
    isNewUserContext: Boolean(body.isNewUserContext),
    friendlyContext: {
      firstName: body.friendlyContext?.firstName || null,
      toneMode: body.friendlyContext?.toneMode || 'gentle_friend',
      totalEntries: body.friendlyContext?.totalEntries ?? null,
      streakCount: body.friendlyContext?.streakCount ?? null,
      averageMood: body.friendlyContext?.averageMood || null,
      topTopics: (body.friendlyContext?.topTopics || []).slice(0, 3),
      localHour: body.friendlyContext?.localHour ?? null,
    },
  };

  return `spotlight_greeting:${createHash('sha256').update(JSON.stringify(signaturePayload)).digest('hex')}`;
}

function isCacheFresh(cachedAt?: number): boolean {
  if (!cachedAt) return false;
  return Date.now() - cachedAt < GREETING_CACHE_TTL_MS;
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  console.log('[spotlight/greeting] ▶ POST request received');
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn('[spotlight/greeting] ✗ Unauthorized:', authError?.message || 'no user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log(`[spotlight/greeting] Auth OK — user: ${user.id.slice(0, 8)}... (${Date.now() - t0}ms)`);

    const body = (await request.json()) as GreetingRequestBody;
    const baseGreeting = body?.baseGreeting;
    console.log(`[spotlight/greeting] Base greeting: source=${baseGreeting?.source}, title="${baseGreeting?.title?.slice(0, 50)}"`);
    console.log(`[spotlight/greeting] Context: firstName=${body?.friendlyContext?.firstName}, totalEntries=${body?.friendlyContext?.totalEntries}, streakCount=${body?.friendlyContext?.streakCount}, localHour=${body?.friendlyContext?.localHour}`);

    if (!baseGreeting?.title || !baseGreeting?.subtitle || !baseGreeting?.badge) {
      console.warn('[spotlight/greeting] ✗ Missing baseGreeting fields');
      return NextResponse.json({ error: 'baseGreeting is required' }, { status: 400 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('encryption_public_key')
      .eq('id', user.id)
      .single();
    const pubKey = parsePublicKeyFromDb(userData?.encryption_public_key);
    console.log(`[spotlight/greeting] pubKey present: ${!!pubKey}`);

    const cacheKey = createGreetingCacheKey(body);
    console.log(`[spotlight/greeting] Cache key: ${cacheKey.slice(0, 30)}...`);

    const { data: cachedEntry, error: cachedError } = await adminClient
      .from('ai_prompt_cache')
      .select('*')
      .eq('user_id', user.id)
      .eq('cache_key', cacheKey)
      .single();

    if (!cachedError && cachedEntry) {
      const cachedAt = cachedEntry.updated_at ? new Date(cachedEntry.updated_at).getTime() :
                       cachedEntry.created_at ? new Date(cachedEntry.created_at).getTime() :
                       (cachedEntry.response as CachedGreetingResponse)?.cachedAt;
      const fresh = isCacheFresh(cachedAt);
      console.log(`[spotlight/greeting] DB cache found — fresh: ${fresh}, age: ${cachedAt ? Math.round((Date.now() - cachedAt) / 1000) : '?'}s`);

      if (fresh) {
        const cachedGreetingPayload = (cachedEntry.response as CachedGreetingResponse)?.greeting || (cachedEntry.response as any);
        console.log(`[spotlight/greeting] ✓ Returning fresh cached greeting (${Date.now() - t0}ms):`, JSON.stringify(cachedGreetingPayload)?.slice(0, 100));
        const result = {
          ...cachedEntry,
          greeting: cachedGreetingPayload,
          _plaintext: cachedEntry.response,
        };
        return NextResponse.json(result);
      } else {
        console.log('[spotlight/greeting] Cache stale, regenerating...');
      }
    } else {
      console.log(`[spotlight/greeting] No DB cache found (error: ${cachedError?.message || 'none'})`);
    }

    const upsertAndReturn = async (payload: CachedGreetingResponse) => {
      const cacheRow: any = {
        user_id: user.id,
        cache_key: cacheKey,
        response: payload,
        is_encrypted: false,
      };
      const { data: upsertedRow } = await adminClient
        .from('ai_prompt_cache')
        .upsert(cacheRow, { onConflict: 'user_id,cache_key' })
        .select('*')
        .single();
      const finalResult = { ...(upsertedRow || cacheRow), _plaintext: payload, greeting: payload.greeting, response: payload };
      return NextResponse.json(finalResult);
    };

    const friendlyContext = body.friendlyContext || {};
    const toneMode = friendlyContext.toneMode || 'gentle_friend';

    const prompt = `You are rewriting a dashboard hero greeting for a journaling app.

Voice and style:
- Sound like a trusted friend who knows the user over time.
- Warm, natural, and lightly conversational.
- Keep it emotionally safe and never manipulative.
- Keep it short and readable in a dashboard hero.
- Avoid cliches and avoid over-cheerful hype.
- If context supports it, include one soft familiarity cue (habit, streak, recurring theme, or recent feeling).

Rules:
1) Keep it supportive, concise, and human.
2) Keep emotional safety. No harsh language.
3) Prefer a reflective question in subtitle when possible.
4) Do not mention technical details, algorithms, or private metadata.
5) Do not invent facts beyond provided context.
6) Return STRICT JSON only in this shape:
{
  "badge": "string",
  "title": "string",
  "subtitle": "string"
}

Context:
- Base badge: ${baseGreeting.badge}
- Base title: ${baseGreeting.title}
- Base subtitle: ${baseGreeting.subtitle}
- Greeting source: ${baseGreeting.source}
- Is new user context: ${Boolean(body?.isNewUserContext)}
- Days since last entry: ${body?.daysSinceLastEntry ?? 'unknown'}
- Recent snippets: ${(body?.recentJournalSnippets || []).slice(0, 2).join(' | ') || 'none'}
- Friendly tone mode: ${toneMode}
- First name: ${friendlyContext.firstName || 'unknown'}
- Total entries: ${friendlyContext.totalEntries ?? 'unknown'}
- Current streak: ${friendlyContext.streakCount ?? 'unknown'}
- Average mood: ${friendlyContext.averageMood || 'unknown'}
- Top topics: ${(friendlyContext.topTopics || []).slice(0, 3).join(' | ') || 'none'}
- Local hour: ${friendlyContext.localHour ?? 'unknown'}

Generate a polished alternative that stays close to the base meaning.`;

    let generatedText = '';

    // Try Claude with fallback to Gemini via executeLLMRequest
    console.log(`[spotlight/greeting] ▶ Calling executeLLMRequest (claude) at T+${Date.now() - t0}ms`);
    try {
      try {
        const llmResult = await executeLLMRequest({
          prompt,
          provider: 'claude',
          options: { rawPrompt: true, temperature: 0.4 },
        });
        generatedText = llmResult?.text || '';
        console.log(`[spotlight/greeting] Claude text length: ${generatedText.length}`);
      } catch (claudeErr) {
        console.warn('[spotlight/greeting] Claude failed, falling back to Gemini:', claudeErr);
        const geminiResult = await executeLLMRequest({
          prompt,
          provider: 'gemini',
          options: { rawPrompt: true, temperature: 0.4 },
        });
        generatedText = geminiResult?.text || '';
        console.log(`[spotlight/greeting] Gemini text length: ${generatedText.length}`);
      }
    } catch (llmErr) {
      console.error('[spotlight/greeting] LLM call threw:', llmErr);
    }

    const cleaned = cleanJsonText(generatedText);
    console.log(`[spotlight/greeting] Cleaned text length: ${cleaned.length}, preview: "${cleaned.slice(0, 150)}"`);

    try {
      if (!cleaned) throw new Error('Empty LLM response');
      const parsed = JSON.parse(cleaned) as Partial<HeroGreeting>;
      console.log(`[spotlight/greeting] Parsed JSON: badge="${parsed.badge?.slice(0, 30)}", title="${parsed.title?.slice(0, 50)}", subtitle="${parsed.subtitle?.slice(0, 50)}"`);
      const greeting = normalizeGreeting(parsed, baseGreeting);

      const responsePayload: CachedGreetingResponse = {
        greeting: { ...greeting, source: 'llm' as any },
        meta: { source: 'llm' },
        cachedAt: Date.now(),
      };
      console.log(`[spotlight/greeting] ✓ Returning LLM greeting (${Date.now() - t0}ms total)`);
      return await upsertAndReturn(responsePayload);
    } catch (parseErr) {
      console.error(`[spotlight/greeting] ✗ JSON parse failed or empty response:`, parseErr);
      const fallbackPayload: CachedGreetingResponse = {
        greeting: baseGreeting,
        meta: { source: 'fallback', reason: 'llm_fallback' },
        cachedAt: Date.now(),
      };
      console.log(`[spotlight/greeting] Returning fallback greeting (${Date.now() - t0}ms total)`);
      return await upsertAndReturn(fallbackPayload);
    }
  } catch (error) {
    console.error(`[spotlight/greeting] ✗ Top-level error:`, error);
    return NextResponse.json({
      error: 'Failed to generate greeting',
      details: (error as Error).message,
    }, { status: 500 });
  }
}

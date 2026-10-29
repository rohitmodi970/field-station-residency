import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
type OnboardingMode = 'write' | 'speak';

type CacheEntry = {
  expiresAt: number;
  payload: {
    result: {
      journal_id: string;
      mode: OnboardingMode;
      created_at: string;
      recognition_result: string | null;
      reflection_prompt: string | null;
      onboarding_context: string | null;
    } | null;
  };
};

const CACHE_TTL_MS = 30_000;
const onboardingResultCache = new Map<string, CacheEntry>();

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { user };
}

export async function GET() {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const cached = onboardingResultCache.get(user.id);
    if (cached && cached.expiresAt > Date.now()) {
      const response = NextResponse.json(cached.payload, { status: 200 });
      response.headers.set('Cache-Control', `private, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
      return response;
    }
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('user_onboarding_results')
      .select('journal_id, mode, created_at, recognition_result, reflection_prompt, onboarding_context')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        const payload = { result: null };
        onboardingResultCache.set(user.id, {
          expiresAt: Date.now() + CACHE_TTL_MS,
          payload,
        });
        const response = NextResponse.json(payload, { status: 200 });
        response.headers.set('Cache-Control', `private, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
        return response;
      }
      return NextResponse.json(
        { error: error.message || 'Failed to fetch onboarding result' },
        { status: 500 }
      );
    }

    const payload = { result: data || null };
    onboardingResultCache.set(user.id, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });
    const response = NextResponse.json(payload, { status: 200 });
    response.headers.set('Cache-Control', `private, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const body = await req.json();
    const journalId = String(body?.journal_id || '').trim();
    const mode = body?.mode as OnboardingMode | undefined;
    const recognitionResult = typeof body?.recognition_result === 'string'
      ? body.recognition_result.trim()
      : null;
    const reflectionPrompt = typeof body?.reflection_prompt === 'string'
      ? body.reflection_prompt.trim()
      : null;
    const onboardingContext = typeof body?.onboarding_context === 'string'
      ? body.onboarding_context.trim()
      : null;

    if (!journalId || !mode || !['write', 'speak'].includes(mode)) {
      return NextResponse.json(
        { error: 'journal_id and valid mode are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_onboarding_results')
      .upsert({
        user_id: user.id,
        journal_id: journalId,
        mode,
        recognition_result: recognitionResult || null,
        reflection_prompt: reflectionPrompt || null,
        onboarding_context: onboardingContext || null,
      }, { onConflict: 'user_id' })
      .select('journal_id, mode, created_at, recognition_result, reflection_prompt, onboarding_context')
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    onboardingResultCache.delete(user.id);
    return NextResponse.json({ result: data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

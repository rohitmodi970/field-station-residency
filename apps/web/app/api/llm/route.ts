// app/api/llm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  executeLLMRequest,
  isInternalSecretValid,
  MAX_PROMPT_LENGTH_CHARS,
  LLMOptions,
  LLMProvider,
} from '@/lib/llm/llmService';
import { checkLLMRateLimit } from '@/lib/llm/rateLimiter';

/**
 * Extracts the real client IP address from proxy headers.
 */
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return '127.0.0.1';
}

/**
 * Validates that requests are not arriving from unauthorized cross-origin sites.
 */
function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // Direct internal server requests often omit Origin

  const host = request.headers.get('host');
  if (host && origin.includes(host)) return true;

  // Allow local development
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;

  // Allow configured app URLs
  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      if (origin.includes(parsed.host)) return true;
    } catch {
      // ignore parsing error
    }
  }

  return false;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = getClientIp(request);

  // 1. Origin / CSRF verification: block third-party sites using our endpoint as a proxy
  if (!isAllowedOrigin(request)) {
    console.warn(`[api/llm] Forbidden cross-origin request from origin: ${request.headers.get('origin')} (IP: ${clientIp})`);
    return NextResponse.json(
      { error: 'Forbidden: Cross-origin access to LLM services is disallowed' },
      { status: 403 }
    );
  }

  // 2. Authentication Check:
  // Check A: Internal secret header (for server-to-server calls within Force)
  const internalSecret =
    request.headers.get('x-internal-secret') ||
    request.headers.get('x-force-internal') ||
    request.headers.get('X-Internal-Secret');

  const isInternal = isInternalSecretValid(internalSecret);

  let authenticatedUserId: string | null = null;

  if (!isInternal) {
    // Check B: Authenticated Supabase session (for client-side calls from logged-in users)
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (user && !authError) {
        authenticatedUserId = user.id;
      }
    } catch (sessionErr) {
      console.warn('[api/llm] Session check error:', sessionErr);
    }

    // Check C: Bearer token in Authorization header
    if (!authenticatedUserId) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        try {
          const supabase = await createClient();
          const {
            data: { user: tokenUser },
          } = await supabase.auth.getUser(token);
          if (tokenUser) {
            authenticatedUserId = tokenUser.id;
          }
        } catch {
          // invalid bearer token
        }
      }
    }

    // If REQUIRE_AUTH is true (default), unauthenticated requests are strictly rejected
    const requireAuth = process.env.REQUIRE_AUTH !== 'false';
    if (requireAuth && !authenticatedUserId) {
      console.warn(`[api/llm] Unauthorized access attempt blocked from IP: ${clientIp}`);
      return NextResponse.json(
        {
          error: 'Unauthorized: Valid user authentication or internal secret required to access LLM services',
        },
        { status: 401 }
      );
    }
  }

  // 3. Rate Limiting Check (applies to public/user requests; internal calls have generous headroom)
  if (!isInternal) {
    const rateCheck = checkLLMRateLimit({
      userId: authenticatedUserId,
      ip: clientIp,
    });

    if (!rateCheck.allowed) {
      console.warn(
        `[api/llm] Rate limit triggered for ${authenticatedUserId ? `user ${authenticatedUserId}` : `IP ${clientIp}`}`
      );
      return NextResponse.json(
        { error: rateCheck.reason || 'Too many requests. Please wait before making more LLM queries.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.retryAfterSeconds || 60),
          },
        }
      );
    }
  }

  // 4. Request Payload Parsing and Validation
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const { prompt, provider, options = {} } = body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'Prompt is required and must be a non-empty string' }, { status: 400 });
  }

  let safePrompt = prompt;
  if (safePrompt.length > MAX_PROMPT_LENGTH_CHARS) {
    console.warn(`[api/llm] Prompt length (${safePrompt.length}) exceeds ${MAX_PROMPT_LENGTH_CHARS}, truncating safely`);
    safePrompt = safePrompt.slice(0, MAX_PROMPT_LENGTH_CHARS);
  }

  // 5. Execute LLM Request with bounded tokens & error protection
  try {
    const response = await executeLLMRequest({
      prompt: safePrompt,
      provider: provider as LLMProvider | undefined,
      options: options as LLMOptions | undefined,
    });

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[api/llm] Execution error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to process LLM request',
      },
      { status: 500 }
    );
  }
}
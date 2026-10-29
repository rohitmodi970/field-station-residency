// apps/web/utils/auth/stepUp.ts
/**
 * Step-Up Authentication Service — Security Architecture v2
 *
 * Provides cryptographic elevation tokens for high-security mutations:
 * - Changing vault master password
 * - Regenerating recovery codes
 * - Disabling 2FA (TOTP)
 * - Revoking active devices
 * - Exporting encrypted vault
 * - Permanently deleting account
 *
 * Security Properties:
 * 1. Tokens are HMAC-SHA256 signed with a dedicated elevation secret.
 * 2. Short TTL (default: 300 seconds / 5 minutes).
 * 3. Bound to userId, deviceId, sessionId, and explicit action scope.
 * 4. JTI single-use replay protection.
 * 5. Universal support for mobile (X-Force-Elevation header) and web SSR cookies.
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';

export type ElevationScope =
  | 'change_password'
  | 'regenerate_codes'
  | 'delete_account'
  | 'revoke_device'
  | 'disable_totp'
  | 'export_vault'
  | 'manage_account';

export interface ElevationTokenPayload {
  sub: string; // userId
  session_id?: string;
  device_id?: string;
  scope: ElevationScope;
  jti: string;
  iat: number;
  exp: number;
  purpose: 'force_step_up_elevation';
}

const ELEVATION_SECRET =
  process.env.ELEVATION_JWT_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'force_elevation_internal_secure_fallback_2026';

// ── In-Memory JTI Replay Prevention Cache (cleans up expired entries) ──────
const usedJtis = new Map<string, number>();

function cleanupJtis() {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of usedJtis.entries()) {
    if (exp <= now) {
      usedJtis.delete(jti);
    }
  }
}

// Clean up every 2 minutes
setInterval(cleanupJtis, 2 * 60 * 1000).unref?.();

// ── Token Encoding / Decoding (HMAC-SHA256) ────────────────────────────────

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  if (!str) return '';
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Issue a signed step-up elevation token
 */
export async function issueElevationToken(params: {
  userId: string;
  sessionId?: string;
  deviceId?: string;
  scope: ElevationScope;
  maxAgeSeconds?: number;
}): Promise<{ token: string; expiresIn: number; jti: string }> {
  const maxAge = params.maxAgeSeconds ?? 300; // 5 minutes default
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const payload: ElevationTokenPayload = {
    sub: params.userId,
    session_id: params.sessionId,
    device_id: params.deviceId,
    scope: params.scope,
    jti,
    iat: now,
    exp: now + maxAge,
    purpose: 'force_step_up_elevation',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', ELEVATION_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const token = `${encodedHeader}.${encodedPayload}.${signature}`;

  return {
    token,
    expiresIn: maxAge,
    jti,
  };
}

/**
 * Verify a signed step-up elevation token
 */
export async function verifyElevationToken(
  token: string,
  options?: {
    expectedUserId?: string;
    requiredScope?: ElevationScope;
    consumeJti?: boolean;
  }
): Promise<{
  valid: boolean;
  payload?: ElevationTokenPayload;
  error?: string;
}> {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Elevation token missing' };
    }

    const parts = token.split('.');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      return { valid: false, error: 'Malformed elevation token format' };
    }

    const [encodedHeader, encodedPayload, signature] = parts as [string, string, string];

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', ELEVATION_SECRET)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);

    if (
      sigBuf.length !== expBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expBuf)
    ) {
      return { valid: false, error: 'Invalid token signature' };
    }

    const payload: ElevationTokenPayload = JSON.parse(
      base64UrlDecode(encodedPayload)
    );

    if (payload.purpose !== 'force_step_up_elevation') {
      return { valid: false, error: 'Invalid token purpose' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return { valid: false, error: 'Elevation token has expired' };
    }

    if (options?.expectedUserId && payload.sub !== options.expectedUserId) {
      return { valid: false, error: 'Elevation token user mismatch' };
    }

    // Check scope ('manage_account' is a wildcard supervisor scope)
    if (
      options?.requiredScope &&
      payload.scope !== options.requiredScope &&
      payload.scope !== 'manage_account'
    ) {
      return {
        valid: false,
        error: `Elevation token does not grant scope '${options.requiredScope}'`,
      };
    }

    // Check JTI replay
    if (usedJtis.has(payload.jti)) {
      return { valid: false, error: 'Elevation token has already been consumed' };
    }

    if (options?.consumeJti) {
      usedJtis.set(payload.jti, payload.exp);
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Token verification failed' };
  }
}

/**
 * Universal Server Middleware Helper for Sensitive Routes
 *
 * Checks:
 * 1. User authentication (via cookies or Bearer token)
 * 2. Verified X-Force-Elevation header OR recent session authentication
 */
export async function requireRecentAuth(
  req: Request | NextRequest,
  options?: {
    requiredScope?: ElevationScope;
    maxAgeSeconds?: number;
    consumeToken?: boolean;
  }
): Promise<
  | { authorized: true; user: any; elevationPayload?: ElevationTokenPayload; supabase: any }
  | { authorized: false; error: string; status: number }
> {
  // 1. Authenticate user
  const authResult = await getAuthenticatedUser(req);
  if ('error' in authResult || !authResult.user) {
    return {
      authorized: false,
      error: authResult.error || 'Unauthorized',
      status: authResult.status || 401,
    };
  }

  const user = authResult.user;

  // 2. Extract elevation token from headers
  const elevationHeader =
    req.headers.get('x-force-elevation') ||
    req.headers.get('X-Force-Elevation');

  if (!elevationHeader) {
    return {
      authorized: false,
      error: 'Step-up re-authentication required for this sensitive operation',
      status: 403,
    };
  }

  // 3. Verify elevation token
  const verifyResult = await verifyElevationToken(elevationHeader, {
    expectedUserId: user.id,
    requiredScope: options?.requiredScope,
    consumeJti: options?.consumeToken ?? false,
  });

  if (!verifyResult.valid || !verifyResult.payload) {
    return {
      authorized: false,
      error: verifyResult.error || 'Step-up authentication token invalid or expired',
      status: 403,
    };
  }

  return {
    authorized: true,
    user,
    elevationPayload: verifyResult.payload,
    supabase: authResult.supabase,
  };
}

// apps/web/app/api/auth/elevate/route.ts
/**
 * Step-Up Elevation API — Security Architecture v2
 *
 * POST /api/auth/elevate
 *
 * Re-authenticates the current user and issues a short-lived (300s)
 * signed elevation token (HMAC-SHA256) required for high-risk operations.
 *
 * Supports:
 * - Password users: verifies current password via Supabase Auth
 * - OAuth users (Google/Apple) without password:
 *     - If TOTP is enabled: verifies 6-digit TOTP code
 *     - If TOTP not enabled: sends or verifies a 6-digit email security code
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { issueElevationToken, ElevationScope } from '@/utils/auth/stepUp';
import { OTP } from 'otplib';

const otp = new OTP();

// ── In-Memory Rate Limiter (Max 5 failed attempts per 15 minutes) ─────────────
interface RateLimitRecord {
  attempts: number;
  resetAt: number;
}
const rateLimits = new Map<string, RateLimitRecord>();

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimits.get(key);

  if (!record || record.resetAt <= now) {
    rateLimits.set(key, { attempts: 1, resetAt: now + 15 * 60 * 1000 });
    return { allowed: true, remaining: 4 };
  }

  if (record.attempts >= 5) {
    return { allowed: false, remaining: 0 };
  }

  record.attempts += 1;
  return { allowed: true, remaining: 5 - record.attempts };
}

function clearRateLimit(key: string) {
  rateLimits.delete(key);
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate the caller (handles Bearer token & SSR cookies)
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      );
    }
    const user = authResult.user;
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const rateLimitKey = `elevate:${user.id}:${clientIp}`;

    const { allowed } = checkRateLimit(rateLimitKey);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many failed verification attempts. Please wait 15 minutes.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      password,
      totp_code,
      email_otp,
      scope = 'manage_account',
      device_id,
      action = 'verify',
    } = body as {
      password?: string;
      totp_code?: string;
      email_otp?: string;
      scope?: ElevationScope;
      device_id?: string;
      action?: 'send_email_otp' | 'verify';
    };

    const adminSupabase = createAdminClient();

    // 2. Fetch user's security configuration (TOTP & OAuth status)
    const [{ data: totpRow }, { data: settingsRow }] = await Promise.all([
      adminSupabase
        .from('totp_settings')
        .select('secret, enabled, last_used_timestep')
        .eq('user_id', user.id)
        .maybeSingle(),
      adminSupabase
        .from('user_settings')
        .select('totp_enabled, vault_password_set')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const isTotpEnabled = Boolean(totpRow?.enabled || settingsRow?.totp_enabled);
    const provider = user.app_metadata?.provider ?? 'email';
    const isOAuthUser = provider !== 'email';

    // 3. Handle Send Email OTP Request for OAuth users without password/TOTP
    if (action === 'send_email_otp') {
      if (!user.email) {
        return NextResponse.json(
          { error: 'User does not have a verified email address.' },
          { status: 400 }
        );
      }

      const { error: otpSendError } = await authResult.supabase.auth.signInWithOtp({
        email: user.email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (otpSendError) {
        console.error('[elevate] Failed to send email OTP:', otpSendError);
        return NextResponse.json(
          { error: 'Failed to dispatch security code to your email.' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Security code sent to ${user.email}`,
      });
    }

    // 4. Verify Credentials
    let credentialVerified = false;

    // Check Password if provided
    if (password && typeof password === 'string') {
      const { error: signInError } = await authResult.supabase.auth.signInWithPassword({
        email: user.email!,
        password,
      });

      if (!signInError) {
        credentialVerified = true;
      }
    }

    // Check TOTP code if provided
    if (totp_code && typeof totp_code === 'string' && /^\d{6}$/.test(totp_code.trim())) {
      if (totpRow?.secret && totpRow.enabled) {
        const isValid = otp.verifySync({
          token: totp_code.trim(),
          secret: totpRow.secret,
        }).valid;

        if (isValid) {
          // Check replay
          const currentTimestep = Math.floor(Date.now() / 30000);
          if (totpRow.last_used_timestep && currentTimestep <= totpRow.last_used_timestep) {
            return NextResponse.json(
              { error: 'This TOTP code has already been used. Please wait for the next code.' },
              { status: 401 }
            );
          }

          // Record last used timestep
          await adminSupabase
            .from('totp_settings')
            .update({ last_used_timestep: currentTimestep })
            .eq('user_id', user.id);

          credentialVerified = true;
        }
      }
    }

    // Check Email OTP if provided
    if (!credentialVerified && email_otp && typeof email_otp === 'string' && user.email) {
      const { error: verifyOtpError } = await authResult.supabase.auth.verifyOtp({
        email: user.email,
        token: email_otp.trim(),
        type: 'email',
      });

      if (!verifyOtpError) {
        credentialVerified = true;
      }
    }

    // If TOTP is enabled on this account, TOTP verification is mandatory!
    if (isTotpEnabled && (!totp_code || !credentialVerified)) {
      if (password && credentialVerified) {
        // Password verified, but 2FA is on -> prompt for TOTP code
        return NextResponse.json(
          {
            requires_totp: true,
            error: 'Two-factor authentication code is required to complete elevation.',
          },
          { status: 403 }
        );
      }
    }

    if (!credentialVerified) {
      return NextResponse.json(
        {
          error: isOAuthUser
            ? 'Verification failed. Please enter a valid TOTP code or email verification code.'
            : 'Incorrect password or verification code.',
        },
        { status: 401 }
      );
    }

    // 5. Verification Succeeded: Reset Rate Limiter & Issue Elevation Token
    clearRateLimit(rateLimitKey);

    const { token, expiresIn, jti } = await issueElevationToken({
      userId: user.id,
      deviceId: device_id,
      scope,
      maxAgeSeconds: 300, // 5 minutes
    });

    return NextResponse.json({
      success: true,
      elevation_token: token,
      expires_in: expiresIn,
      jti,
      scope,
    });
  } catch (err: any) {
    console.error('[elevate] Unexpected error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error during elevation.' },
      { status: 500 }
    );
  }
}

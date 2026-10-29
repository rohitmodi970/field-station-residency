// apps/web/app/api/encryption/verify-totp/route.ts
/**
 * Verify TOTP API — Phase 3
 *
 * POST /api/encryption/verify-totp
 * Body: { code: string }
 *
 * Called from NewDeviceVerification.tsx (TOTP tab) when a user enters
 * their 6-digit TOTP code on a new/untrusted device.
 *
 * Flow:
 *   1. Verify Supabase session (user must be authenticated)
 *   2. Look up totp_settings for this user (must be enabled=true)
 *   3. Verify the 6-digit code with window=1 (accepts ±1 time window)
 *   4. If valid: return account-level wrapped master key (same as recovery-code route)
 *   5. Fire 'totp_used' security notification (non-blocking)
 *   6. Client unwraps master key → generates deviceSecret → registers device_keys row
 *
 * Rate limiting: enforced at the middleware / Supabase level.
 * The returned key is still encrypted — client must unwrap with their credential.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

import { OTP } from 'otplib';

const otp = new OTP();

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.findmyforce.com';

export async function POST(req: NextRequest) {
  try {
    // ── 1. Authenticate (handles both mobile Bearer JWT and web SSR cookies) ──
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      );
    }
    const user = authResult.user;

    // ── 2. Parse body ────────────────────────────────────────────────────────
    const body = await req.json();
    const { code } = body as { code: string };

    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return NextResponse.json(
        { error: 'A valid 6-digit TOTP code is required' },
        { status: 400 }
      );
    }

    // ── 3. Fetch enabled TOTP row ────────────────────────────────────────────
    const adminSupabase = createAdminClient();
    const { data: totpRow, error: totpError } = await adminSupabase
      .from('totp_settings')
      .select('secret, enabled')
      .eq('user_id', user.id)
      .eq('enabled', true)
      .single();

    if (totpError || !totpRow) {
      return NextResponse.json(
        { error: 'Authenticator app (2FA) is not set up for this account. Go to Settings → Security to enable it.' },
        { status: 404 }
      );
    }

    // ── 4. Verify TOTP code ──────────────────────────────────────────────────
    const isValid = otp.verifySync({ token: code.trim(), secret: totpRow.secret }).valid;
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid code. Please check your authenticator app and ensure your device clock is synced.' },
        { status: 401 }
      );
    }

    // ── 5. Fetch account-level wrapped master key ────────────────────────────
    // Admin client bypasses RLS to read the users table
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('encrypted_master_key, master_key_iv, encryption_salt, key_version')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('[verify-totp] Failed to fetch encryption data:', userError);
      return NextResponse.json(
        { error: 'Failed to retrieve encryption data after verification' },
        { status: 500 }
      );
    }

    // ── 6. Fire security notification (non-blocking) ─────────────────────────
    fireNotification(user.email ?? '', 'totp_used', { user_id: user.id }).catch((err) =>
      console.warn('[verify-totp] Security notification failed (non-fatal):', err)
    );

    // ── 7. Return wrapped master key to client ───────────────────────────────
    // Client will:
    //   a. Derive unwrap key from PBKDF2(credential, encryption_salt)
    //   b. AES-GCM-Decrypt(encrypted_master_key, master_key_iv) → raw master key bytes
    //   c. Generate a new deviceSecret, re-wrap with that
    //   d. Register a device_keys row
    //   e. Journals unlock
    return NextResponse.json({
      success: true,
      encrypted_master_key: userData.encrypted_master_key,
      master_key_iv: userData.master_key_iv,
      encryption_salt: userData.encryption_salt,
      key_version: userData.key_version ?? 1,
    });
  } catch (err) {
    console.error('[verify-totp] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

async function fireNotification(
  email: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  if (!email) return;
  try {
    await fetch(`${APP_URL}/api/security/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, email, data }),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[verify-totp POST] Skipped security notification in dev: ${APP_URL} not reachable.`);
    } else {
      console.error(`[verify-totp POST] Security notification failed:`, err);
    }
  }
}

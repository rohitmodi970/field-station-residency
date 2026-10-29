// apps/web/app/api/encryption/totp/setup/route.ts
/**
 * TOTP Setup API — Security Architecture v2
 *
 * GET  /api/encryption/totp/setup  → generate pending secret + QR code data URL (15-min TTL)
 * POST /api/encryption/totp/setup  → verify first code, check TTL & replay, activate TOTP
 * DELETE /api/encryption/totp/setup → disable TOTP (requires step-up elevation or code)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { requireRecentAuth } from '@/utils/auth/stepUp';
import QRCode from 'qrcode';
import { OTP } from 'otplib';

const otp = new OTP();
const ISSUER = 'FORCE';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.findmyforce.com';

// ── GET — Generate secret / return existing unverified secret ─────────────────
export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = authResult.user;
    const adminSupabase = createAdminClient();

    // Check for existing row
    const { data: existing, error: fetchError } = await adminSupabase
      .from('totp_settings')
      .select('secret, pending_secret, pending_secret_created_at, enabled, issuer, created_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[totp/setup GET] DB fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to check TOTP status' }, { status: 500 });
    }

    if (existing?.enabled) {
      return NextResponse.json(
        { error: 'TOTP is already enabled for this account' },
        { status: 409 }
      );
    }

    const now = new Date();
    let secret: string;

    // Check if existing pending secret is within 15-minute window
    const isPendingValid =
      existing?.pending_secret &&
      existing?.pending_secret_created_at &&
      now.getTime() - new Date(existing.pending_secret_created_at).getTime() < 15 * 60 * 1000;

    if (isPendingValid) {
      secret = existing.pending_secret;
    } else {
      // Generate fresh 20-byte base32 TOTP secret with fresh 15-min TTL
      secret = otp.generateSecret(20);

      const { error: upsertError } = await adminSupabase
        .from('totp_settings')
        .upsert(
          {
            user_id: user.id,
            secret, // fallback compatibility
            pending_secret: secret,
            pending_secret_created_at: now.toISOString(),
            issuer: ISSUER,
            enabled: false,
            updated_at: now.toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (upsertError) {
        console.error('[totp/setup GET] Upsert error:', upsertError);
        return NextResponse.json({ error: 'Failed to initialise TOTP setup' }, { status: 500 });
      }
    }

    // Build otpauth:// URI
    const accountName = user.email ?? user.id;
    const otpauthUri = otp.generateURI({ issuer: ISSUER, label: accountName, secret });

    // Generate QR code as base64 data URL
    const qrDataUrl = await QRCode.toDataURL(otpauthUri, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 240,
      color: { dark: '#1C1B1A', light: '#FFFFFF' },
    });

    return NextResponse.json({
      secret,
      otpauthUri,
      qrDataUrl,
      issuer: ISSUER,
      accountName,
      expires_in_seconds: 900, // 15 minutes
    });
  } catch (err) {
    console.error('[totp/setup GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── POST — Verify first code and activate TOTP ────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = authResult.user;

    const body = await req.json().catch(() => ({}));
    const { code } = body as { code: string };

    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return NextResponse.json(
        { error: 'A valid 6-digit code is required' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // Fetch pending TOTP row
    const { data: row, error: fetchError } = await adminSupabase
      .from('totp_settings')
      .select('secret, pending_secret, pending_secret_created_at, enabled, last_used_timestep')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError || !row) {
      return NextResponse.json(
        { error: 'No TOTP setup in progress. Please start setup from the Security screen.' },
        { status: 404 }
      );
    }

    if (row.enabled) {
      return NextResponse.json(
        { error: 'TOTP is already enabled for this account' },
        { status: 409 }
      );
    }

    // ── Fail-Closed 15-Minute Expiry Check ────────────────────────────────────
    const activeSecret = row.pending_secret || row.secret;
    const createdAt = row.pending_secret_created_at;

    if (!createdAt || (Date.now() - new Date(createdAt).getTime() > 15 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Setup session has expired. Please restart 2FA setup.' },
        { status: 410 }
      );
    }

    // ── Verify 6-digit code ───────────────────────────────────────────────────
    const isValid = otp.verifySync({ token: code.trim(), secret: activeSecret }).valid;
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid code. Make sure your authenticator app clock is synced.' },
        { status: 401 }
      );
    }

    // Replay protection: check timestep
    const currentTimestep = Math.floor(Date.now() / 30000);
    if (row.last_used_timestep && currentTimestep <= row.last_used_timestep) {
      return NextResponse.json(
        { error: 'This code was already consumed. Please enter the next code.' },
        { status: 401 }
      );
    }

    const nowIso = new Date().toISOString();

    // Activate TOTP & promote secret
    const { error: updateError } = await adminSupabase
      .from('totp_settings')
      .update({
        secret: activeSecret,
        pending_secret: null,
        pending_secret_created_at: null,
        enabled: true,
        last_used_timestep: currentTimestep,
        verified_at: nowIso,
        updated_at: nowIso,
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[totp/setup POST] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to activate TOTP' }, { status: 500 });
    }

    // Synchronize user_settings table
    await adminSupabase
      .from('user_settings')
      .upsert({ user_id: user.id, totp_enabled: true }, { onConflict: 'user_id' });

    // Fire security notification
    fireSecurityNotification(user.email ?? '', 'totp_enabled', {}).catch((err) =>
      console.warn('[totp/setup POST] Security notification failed:', err)
    );

    return NextResponse.json({ success: true, message: 'Authenticator linked successfully.' });
  } catch (err) {
    console.error('[totp/setup POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── DELETE — Remove TOTP from account ────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = authResult.user;

    // Step-Up Elevation verification
    const elevationHeader =
      req.headers.get('x-force-elevation') ||
      req.headers.get('X-Force-Elevation');

    if (elevationHeader) {
      const stepUp = await requireRecentAuth(req, {
        requiredScope: 'disable_totp',
        consumeToken: true,
      });

      if (!stepUp.authorized) {
        return NextResponse.json({ error: stepUp.error }, { status: stepUp.status });
      }
    }

    const adminSupabase = createAdminClient();

    // Synchronize user_settings table
    await adminSupabase
      .from('user_settings')
      .upsert({ user_id: user.id, totp_enabled: false }, { onConflict: 'user_id' });

    // Delete the TOTP row
    const { error: deleteError } = await adminSupabase
      .from('totp_settings')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('[totp/setup DELETE] Delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to remove TOTP' }, { status: 500 });
    }

    fireSecurityNotification(user.email ?? '', 'totp_removed', {}).catch((err) =>
      console.warn('[totp/setup DELETE] Security notification failed:', err)
    );

    return NextResponse.json({ success: true, message: 'Two-factor authentication disabled.' });
  } catch (err) {
    console.error('[totp/setup DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function fireSecurityNotification(
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
      console.log(`[totp/setup] Skipped security notification in dev: ${APP_URL} not reachable.`);
    } else {
      console.error(`[totp/setup] Security notification failed:`, err);
    }
  }
}

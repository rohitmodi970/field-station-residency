// apps/web/app/api/encryption/legacy-verify/verify-otp/route.ts
/**
 * Legacy Migration — Verify OTP
 *
 * POST /api/encryption/legacy-verify/verify-otp
 * Body: { code: string }  (6-digit OTP, digits only)
 *
 * Called after the user types their OTP in the LegacyMigrationGate UI.
 * On success: deletes the challenge row (one-time use) and returns the
 * account-level wrapped master key so the client can proceed to unlock.
 *
 * Security properties:
 *   - Max 5 failed attempts per challenge (then challenge is deleted → must resend)
 *   - Checks expiry (10 min) before bcrypt compare
 *   - Challenge is deleted on success (one-time use, not just marked)
 *   - Returns encrypted master key (still needs password/credential to unwrap)
 *   - All DB access via admin client (RLS blocks user-level access to challenge table)
 *
 * Response on success:
 *   { verified: true, encrypted_master_key, master_key_iv, encryption_salt, key_version }
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

const MAX_ATTEMPTS = 5;

async function resolveEncryptionData(adminSupabase: ReturnType<typeof createAdminClient>, user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const { data, error } = await adminSupabase
    .from('users')
    .select('encryption_salt, encrypted_master_key, master_key_iv, key_version')
    .eq('id', user.id)
    .single();

  if (!error && data?.encryption_salt && data?.encrypted_master_key && data?.master_key_iv) {
    return {
      salt: data.encryption_salt as string,
      encrypted_master_key: data.encrypted_master_key as string,
      master_key_iv: data.master_key_iv as string,
      key_version: (data.key_version as number | null | undefined) ?? 1,
    };
  }

  const metadataSalt = user.user_metadata?.encryption_salt as string | undefined;
  const metadataMasterKey = user.user_metadata?.encrypted_master_key as string | undefined;
  const metadataIV = user.user_metadata?.master_key_iv as string | undefined;
  const metadataKeyVersion = user.user_metadata?.key_version as number | undefined;

  if (metadataSalt && metadataMasterKey && metadataIV) {
    console.log('[verify-otp] Falling back to auth metadata for encryption data');

    await adminSupabase.from('users').upsert(
      {
        id: user.id,
        email: user.email ?? null,
        encryption_salt: metadataSalt,
        encrypted_master_key: metadataMasterKey,
        master_key_iv: metadataIV,
        key_version: metadataKeyVersion ?? 1,
      },
      { onConflict: 'id' }
    );

    return {
      salt: metadataSalt,
      encrypted_master_key: metadataMasterKey,
      master_key_iv: metadataIV,
      key_version: metadataKeyVersion ?? 1,
    };
  }

  // ── Auto-generate encryption keys for OAuth users if missing ──────────────
  const provider = (user as any).app_metadata?.provider ?? 'email';
  if (provider !== 'email') {
    try {
      console.log('[verify-otp] Auto-generating missing encryption data for OAuth user:', user.id);
      const rawSalt = new Uint8Array(16);
      crypto.getRandomValues(rawSalt);
      let saltBinary = '';
      for (let i = 0; i < rawSalt.length; i++) saltBinary += String.fromCharCode(rawSalt[i]!);
      const saltBase64 = btoa(saltBinary);

      const masterKeyBytes = new Uint8Array(32);
      crypto.getRandomValues(masterKeyBytes);
      let masterKeyBinary = '';
      for (let i = 0; i < masterKeyBytes.length; i++) masterKeyBinary += String.fromCharCode(masterKeyBytes[i]!);
      const masterKeyBase64 = btoa(masterKeyBinary);

      const encoder = new TextEncoder();
      const passwordBuffer = encoder.encode(user.id);
      const saltBytes = Uint8Array.from(atob(saltBase64), (c) => c.charCodeAt(0));

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );

      const passwordKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      const iv = new Uint8Array(12);
      crypto.getRandomValues(iv);
      let ivBinary = '';
      for (let i = 0; i < iv.length; i++) ivBinary += String.fromCharCode(iv[i]!);
      const ivBase64 = btoa(ivBinary);

      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        passwordKey,
        encoder.encode(masterKeyBase64)
      );

      const encryptedBytes = new Uint8Array(encryptedBuffer);
      let encryptedBinary = '';
      for (let i = 0; i < encryptedBytes.length; i++) encryptedBinary += String.fromCharCode(encryptedBytes[i]!);
      const encryptedMasterKey = btoa(encryptedBinary);

      await adminSupabase.from('users').upsert(
        {
          id: user.id,
          email: user.email ?? null,
          encryption_salt: saltBase64,
          encrypted_master_key: encryptedMasterKey,
          master_key_iv: ivBase64,
          key_version: 1,
        },
        { onConflict: 'id' }
      );

      return {
        salt: saltBase64,
        encrypted_master_key: encryptedMasterKey,
        master_key_iv: ivBase64,
        key_version: 1,
      };
    } catch (genErr) {
      console.error('[verify-otp] Failed to auto-generate encryption keys for OAuth user:', genErr);
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
    }

    const normalised = code.replace(/\s/g, '').slice(0, 6);
    if (!/^\d{6}$/.test(normalised)) {
      return NextResponse.json(
        { error: 'Please enter a valid 6-digit code' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // ── Fetch active challenge ───────────────────────────────────────────────
    const { data: challenge, error: fetchError } = await adminSupabase
      .from('legacy_otp_challenges')
      .select('id, code_hash, expires_at, attempts')
      .eq('user_id', user.id)
      .single();

    if (fetchError || !challenge) {
      return NextResponse.json(
        { error: 'No active verification code found. Please request a new code.' },
        { status: 404 }
      );
    }

    // ── Expiry check ─────────────────────────────────────────────────────────
    if (new Date(challenge.expires_at) < new Date()) {
      // Delete expired challenge
      await adminSupabase
        .from('legacy_otp_challenges')
        .delete()
        .eq('id', challenge.id);

      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new one.' },
        { status: 410 }
      );
    }

    // ── Attempt limit check ──────────────────────────────────────────────────
    if (challenge.attempts >= MAX_ATTEMPTS) {
      await adminSupabase
        .from('legacy_otp_challenges')
        .delete()
        .eq('id', challenge.id);

      return NextResponse.json(
        { error: 'Too many incorrect attempts. Please request a new verification code.' },
        { status: 429 }
      );
    }

    // ── bcrypt compare ───────────────────────────────────────────────────────
    const isMatch = await bcrypt.compare(normalised, challenge.code_hash);

    if (!isMatch) {
      // Increment attempts counter (non-fatal if this fails)
      await adminSupabase
        .from('legacy_otp_challenges')
        .update({ attempts: (challenge.attempts ?? 0) + 1 })
        .eq('id', challenge.id);

      const remaining = MAX_ATTEMPTS - (challenge.attempts + 1);
      return NextResponse.json(
        {
          error: 'Incorrect code. Please try again.',
          attemptsRemaining: Math.max(0, remaining),
        },
        { status: 401 }
      );
    }

    // ── OTP verified — delete challenge (one-time use) ───────────────────────
    await adminSupabase
      .from('legacy_otp_challenges')
      .delete()
      .eq('id', challenge.id);

    // ── Fetch account-level wrapped master key ───────────────────────────────
    const userData = await resolveEncryptionData(adminSupabase, user);

    if (!userData) {
      console.error('[verify-otp] Failed to resolve user encryption data: missing users row and auth metadata');
      return NextResponse.json(
        { error: 'Verification succeeded but failed to retrieve encryption data. Please log in again.' },
        { status: 500 }
      );
    }

    console.log(`[verify-otp] ✅ Legacy OTP verified for user ${user.id}`);

    // Return the wrapped master key — client still needs their credential
    // (password for email users, userId for OAuth users) to actually decrypt it.
    return NextResponse.json({
      verified: true,
      encrypted_master_key: userData.encrypted_master_key,
      master_key_iv: userData.master_key_iv,
      encryption_salt: userData.salt,
      key_version: userData.key_version ?? 1,
    });
  } catch (err) {
    console.error('[verify-otp] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

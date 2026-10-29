// apps/web/app/api/encryption/upgrade-oauth/route.ts
/**
 * POST /api/encryption/upgrade-oauth
 *
 * Phase 5 — OAuth Security Upgrade
 *
 * Stores the re-wrapped account-level master key for OAuth users.
 * This is called by the client AFTER locally re-wrapping the master key
 * with either:
 *   - A user-chosen password (vault_mode: 'password')
 *   - A random 32-byte credential (vault_mode: 'auto')
 *
 * The actual re-wrapping is done entirely on the client (zero-knowledge).
 * This route only stores the result.
 *
 * Body: {
 *   encrypted_master_key: string   // base64 AES-GCM ciphertext
 *   master_key_iv:        string   // base64 IV
 *   vault_mode:           'auto' | 'password'
 * }
 *
 * Guards:
 *   - User must be authenticated
 *   - User must have ≥ 1 device_keys row (prevents lockout)
 *   - key_version must currently be 1 (idempotent — skips if already upgraded)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

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
    const { encrypted_master_key, master_key_iv, vault_mode } = body as {
      encrypted_master_key: string;
      master_key_iv: string;
      vault_mode: 'auto' | 'password';
    };

    if (!encrypted_master_key || !master_key_iv) {
      return NextResponse.json(
        { error: 'encrypted_master_key and master_key_iv are required' },
        { status: 400 }
      );
    }

    if (!vault_mode || !['auto', 'password'].includes(vault_mode)) {
      return NextResponse.json(
        { error: 'vault_mode must be "auto" or "password"' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // ── Safety gate: must have at least 1 device_keys row ────────────────
    // Prevents the user from being locked out if something goes wrong —
    // they can always fall back to device-based recovery.
    const { count: deviceCount, error: deviceError } = await admin
      .from('device_keys')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (deviceError) {
      console.error('[upgrade-oauth] device_keys count error:', deviceError);
      return NextResponse.json(
        { error: 'Failed to verify device registration status' },
        { status: 500 }
      );
    }

    if ((deviceCount ?? 0) < 1) {
      return NextResponse.json(
        {
          error: 'Cannot upgrade: no trusted devices registered. Complete device setup first.',
          code: 'no_device_keys',
        },
        { status: 403 }
      );
    }

    // ── Idempotency check: skip if already set to password mode ──────────
    // We allow re-running if transitioning from 'auto' → 'password' vault mode.
    const { data: userData, error: userFetchError } = await admin
      .from('users')
      .select('key_version')
      .eq('id', user.id)
      .single();

    if (userFetchError) {
      console.error('[upgrade-oauth] Failed to fetch key_version:', userFetchError);
      return NextResponse.json(
        { error: 'Failed to fetch user encryption state' },
        { status: 500 }
      );
    }

    const { data: settingsData } = await admin
      .from('user_settings')
      .select('oauth_vault_mode')
      .eq('user_id', user.id)
      .single();

    const currentVaultMode = settingsData?.oauth_vault_mode ?? 'none';

    if ((userData?.key_version ?? 1) >= 2 && currentVaultMode === 'password') {
      // Already fully upgraded to password mode — no-op.
      console.log('[upgrade-oauth] Already in password mode (key_version=2), skipping:', user.id);
      return NextResponse.json({ success: true, already_upgraded: true });
    }
    // key_version=2 but vault_mode='auto' → allow password upgrade to proceed.

    // ── Atomically replace the account-level wrapped key ─────────────────
    const { error: updateError } = await admin
      .from('users')
      .update({
        encrypted_master_key,
        master_key_iv,
        key_version: 2,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[upgrade-oauth] Failed to update users table:', updateError);
      return NextResponse.json(
        { error: 'Failed to upgrade encryption key' },
        { status: 500 }
      );
    }

    // ── Update user_settings ──────────────────────────────────────────────
    const settingsUpdate: Record<string, unknown> = {
      vault_upgraded_at: new Date().toISOString(),
      oauth_vault_mode: vault_mode,
    };

    if (vault_mode === 'password') {
      settingsUpdate.vault_password_set = true;
    }

    await admin
      .from('user_settings')
      .update(settingsUpdate)
      .eq('user_id', user.id);

    console.log('[upgrade-oauth] ✅ Account-level key upgraded for user:', user.id, '| mode:', vault_mode);

    return NextResponse.json({ success: true, already_upgraded: false });
  } catch (err) {
    console.error('[upgrade-oauth] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

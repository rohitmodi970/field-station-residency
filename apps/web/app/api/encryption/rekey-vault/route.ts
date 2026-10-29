// apps/web/app/api/encryption/rekey-vault/route.ts
/**
 * Rekey Vault API
 *
 * POST /api/encryption/rekey-vault
 *
 * Used by the forgot-password flow to atomically replace the master key
 * wrapping after the user provides a recovery code + new password.
 *
 * Optimistic concurrency: the caller supplies expected_key_version (read at
 * the start of the rekey flow). The UPDATE is conditional on key_version
 * matching. If a concurrent rekey already bumped it, 0 rows are affected
 * and we return 409 so the client can retry safely.
 *
 * This avoids the cross-transaction row-lock approach (which doesn't work
 * through the Supabase JS client because each RPC/update is a separate
 * HTTP request and therefore a separate Postgres transaction).
 *
 * Body: {
 *   encrypted_master_key: string
 *   master_key_iv: string
 *   new_key_version: number
 *   expected_key_version: number          // for optimistic concurrency
 *   revoke_other_devices?: boolean
 *   current_device_id?: string | null
 *   invalidate_recovery_wrappings?: boolean   // only true during forgot-password rekey
 * }
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
    const {
      encrypted_master_key,
      master_key_iv,
      new_key_version,
      expected_key_version,
      revoke_other_devices = false,
      current_device_id = null,
      invalidate_recovery_wrappings = false,
    } = body as {
      encrypted_master_key: string;
      master_key_iv: string;
      new_key_version: number;
      expected_key_version: number;
      revoke_other_devices?: boolean;
      current_device_id?: string | null;
      invalidate_recovery_wrappings?: boolean;
    };

    if (!encrypted_master_key || !master_key_iv || !new_key_version || expected_key_version === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: encrypted_master_key, master_key_iv, new_key_version, expected_key_version' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // ── Build update payload ───────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      encrypted_master_key,
      master_key_iv,
      key_version: new_key_version,
    };

    // Only null recovery wrappings when the caller explicitly says they're
    // stale (forgot-password rekey, which immediately regenerates fresh ones).
    // Normal password changes from Settings keep wrappings intact — the raw
    // master key doesn't change, so the per-code wrappings remain valid.
    if (invalidate_recovery_wrappings) {
      updatePayload.recovery_key_wrappings = null;
    }

    // ── Optimistic concurrency: conditional UPDATE on expected key_version ─
    // If a concurrent rekey already bumped key_version, this update affects
    // 0 rows and matchedCount will be 0 → return 409.
    const { data: updatedRows, error: updateError } = await adminSupabase
      .from('users')
      .update(updatePayload)
      .eq('id', user.id)
      .eq('key_version', expected_key_version)  // ← the concurrency guard
      .select('id');

    if (updateError) {
      console.error('[rekey-vault] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update vault' }, { status: 500 });
    }

    if (!updatedRows || updatedRows.length === 0) {
      // 0 rows affected = key_version mismatch = concurrent rekey detected
      return NextResponse.json(
        { error: 'Vault was updated by another session. Please try again.' },
        { status: 409 }
      );
    }

    // ── Revoke other devices if requested ─────────────────────────────────
    // Delete all device_keys rows except the current device. Other devices'
    // device secrets become orphaned — they'll be prompted to re-verify on
    // next page load (ensureEncryptionReady → new_device).
    if (revoke_other_devices) {
      let deleteQuery = adminSupabase
        .from('device_keys')
        .delete()
        .eq('user_id', user.id);

      if (current_device_id) {
        deleteQuery = deleteQuery.neq('device_id', current_device_id);
      }

      const { error: deleteError } = await deleteQuery;
      if (deleteError) {
        // Non-fatal: vault is already re-keyed. Other devices will fail
        // to decrypt with their stale device secrets and hit the gate anyway.
        console.warn('[rekey-vault] Device revocation failed (non-fatal):', deleteError);
      }
    }

    // ── Security notification (fire-and-forget) ────────────────────────────
    fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/security/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'vault_rekeyed',
        email: user.email ?? '',
        data: { devices_revoked: revoke_other_devices },
      }),
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[rekey-vault] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

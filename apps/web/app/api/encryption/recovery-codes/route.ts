// apps/web/app/api/encryption/recovery-codes/route.ts
/**
 * Recovery Codes API — Security Architecture v2
 *
 * GET  /api/encryption/recovery-codes
 *   Returns the count of remaining (unused) recovery codes and when they were last set.
 *
 * POST /api/encryption/recovery-codes
 *   Body: {
 *     code_hashes: string[],              // exactly 8 hashes
 *     recovery_key_wrappings?: Array<{    // independent dual-wrapping (one per code)
 *       code_index: number,
 *       salt?: string,                    // independent v2 salt
 *       encrypted_key: string,            // base64 AES-GCM ciphertext
 *       iv: string,                       // base64 IV
 *     }>
 *   }
 *   Delegates to atomic PostgreSQL function `regenerate_recovery_codes` which:
 *   - Archives previous wrappings into recovery_key_wrappings_previous
 *   - Deletes old recovery codes
 *   - Inserts new hashes
 *   - Updates recovery_key_wrappings and user_settings in ONE transaction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { requireRecentAuth } from '@/utils/auth/stepUp';

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = authResult.user;
    const adminSupabase = createAdminClient();

    // Count unused codes
    const { count, error: countError } = await adminSupabase
      .from('recovery_codes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('used_at', null);

    if (countError) {
      console.error('[GET /api/encryption/recovery-codes] Count error:', countError);
      return NextResponse.json({ error: 'Failed to fetch recovery codes' }, { status: 500 });
    }

    // Fetch set_at timestamp from user_settings
    const { data: settings } = await adminSupabase
      .from('user_settings')
      .select('recovery_codes_set_at, recovery_codes_count')
      .eq('user_id', user.id)
      .maybeSingle();

    return NextResponse.json({
      remaining: count ?? 0,
      total: settings?.recovery_codes_count ?? 8,
      set_at: settings?.recovery_codes_set_at ?? null,
    });
  } catch (err) {
    console.error('[GET /api/encryption/recovery-codes] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = authResult.user;

    // Check Step-Up Elevation if header is present
    const elevationHeader =
      req.headers.get('x-force-elevation') ||
      req.headers.get('X-Force-Elevation');

    if (elevationHeader) {
      const stepUp = await requireRecentAuth(req, {
        requiredScope: 'regenerate_codes',
        consumeToken: true,
      });

      if (!stepUp.authorized) {
        return NextResponse.json(
          { error: stepUp.error },
          { status: stepUp.status }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const { code_hashes, recovery_key_wrappings } = body;

    if (!Array.isArray(code_hashes) || code_hashes.length !== 8) {
      return NextResponse.json(
        { error: 'Expected exactly 8 code_hashes' },
        { status: 400 }
      );
    }

    if (code_hashes.some((h: unknown) => typeof h !== 'string' || h.length < 20)) {
      return NextResponse.json(
        { error: 'Invalid code hashes provided' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // ── Atomic Commit via PostgreSQL RPC ──────────────────────────────────────
    const { data: rpcResult, error: rpcError } = await adminSupabase.rpc(
      'regenerate_recovery_codes',
      {
        p_user_id: user.id,
        p_code_hashes: code_hashes,
        p_recovery_key_wrappings: Array.isArray(recovery_key_wrappings) ? recovery_key_wrappings : [],
        p_scheme_version: 2, // Upgrades to independent v2 scheme
      }
    );

    if (rpcError || (rpcResult && !rpcResult.success)) {
      console.error('[POST /api/encryption/recovery-codes] RPC error:', rpcError || rpcResult?.error);
      return NextResponse.json(
        { error: rpcResult?.error || 'Failed to atomically save recovery codes' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    return NextResponse.json({ success: true, count: 8, set_at: now });
  } catch (err: any) {
    console.error('[POST /api/encryption/recovery-codes] Unexpected error:', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

// ── DELETE (Disable/Remove Recovery Codes) ───────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = authResult.user;

    const elevationHeader =
      req.headers.get('x-force-elevation') ||
      req.headers.get('X-Force-Elevation');

    if (elevationHeader) {
      const stepUp = await requireRecentAuth(req, {
        requiredScope: 'manage_account',
        consumeToken: true,
      });

      if (!stepUp.authorized) {
        return NextResponse.json({ error: stepUp.error }, { status: stepUp.status });
      }
    }

    const adminSupabase = createAdminClient();

    // 1. Delete all recovery codes for user
    const { error: deleteError } = await adminSupabase
      .from('recovery_codes')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('[DELETE /api/encryption/recovery-codes] Delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete recovery codes' }, { status: 500 });
    }

    // 2. Update user_settings
    await adminSupabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          recovery_codes_count: 0,
          recovery_codes_set_at: null,
        },
        { onConflict: 'user_id' }
      );

    // 3. Clear recovery_key_wrappings on users table (preserve previous in backup column)
    const { data: currentUser } = await adminSupabase
      .from('users')
      .select('recovery_key_wrappings')
      .eq('id', user.id)
      .single();

    await adminSupabase
      .from('users')
      .update({
        recovery_key_wrappings_previous: currentUser?.recovery_key_wrappings || null,
        recovery_key_wrappings: null,
        vault_updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      message: 'Recovery codes removed successfully.',
    });
  } catch (err: any) {
    console.error('[DELETE /api/encryption/recovery-codes] Unexpected error:', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

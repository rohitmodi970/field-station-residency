// apps/web/app/api/user/change-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { changePassword } from '@/utils/encryption/keyManager';
import { requireRecentAuth } from '@/utils/auth/stepUp';

/**
 * API Route: Change User Vault Password — Security Architecture v2
 * 
 * Supports:
 * 1. Mobile v2 Zero-Knowledge flow: client derives keys locally and passes:
 *    { new_encrypted_master_key, new_master_key_iv, expected_key_version, new_salt, new_recovery_wrappings? }
 *    along with X-Force-Elevation header.
 * 2. Web legacy fallback: server derives keys if plaintext passwords are provided.
 * 
 * Database execution is strictly delegated to the atomic `change_vault_password` RPC
 * with row-level locks and 30-day rollback safety buffer.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user (handles Bearer token & SSR cookies)
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Not authenticated' },
        { status: authResult.status || 401 }
      );
    }
    const user = authResult.user;
    const adminSupabase = createAdminClient();

    const body = await request.json().catch(() => ({}));
    const {
      currentPassword,
      newPassword,
      deviceId,
      // Zero-Knowledge v2 parameters:
      new_encrypted_master_key,
      new_master_key_iv,
      expected_key_version,
      new_salt,
      new_recovery_wrappings,
    } = body;

    // Check if client provided step-up elevation header
    const elevationHeader =
      request.headers.get('x-force-elevation') ||
      request.headers.get('X-Force-Elevation');

    if (elevationHeader) {
      const stepUpResult = await requireRecentAuth(request, {
        requiredScope: 'change_password',
        consumeToken: true,
      });

      if (!stepUpResult.authorized) {
        return NextResponse.json(
          { error: stepUpResult.error },
          { status: stepUpResult.status }
        );
      }
    }

    let finalEncryptedMasterKey: string;
    let finalMasterKeyIV: string;
    let finalSalt: string | null = null;
    let keyVersionToSet: number = 2;
    let currentKeyVersion: number = 1;

    // Fetch current user encryption status
    const { data: userData, error: userError } = await adminSupabase
      .from('users')
      .select('encryption_salt, encrypted_master_key, master_key_iv, key_version, recovery_scheme_version')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Failed to retrieve user encryption data' },
        { status: 500 }
      );
    }

    currentKeyVersion = userData.key_version || 1;
    keyVersionToSet = currentKeyVersion + 1;

    // ── Branch A: Client-Side Zero-Knowledge Derivation (Mobile v2) ──
    if (new_encrypted_master_key && new_master_key_iv) {
      if (currentPassword) {
        const { error: signInError } = await authResult.supabase.auth.signInWithPassword({
          email: user.email!,
          password: currentPassword,
        });

        if (signInError) {
          return NextResponse.json(
            { error: 'Current password is incorrect.' },
            { status: 401 }
          );
        }
      }

      finalEncryptedMasterKey = new_encrypted_master_key;
      finalMasterKeyIV = new_master_key_iv;
      finalSalt = new_salt || userData.encryption_salt;
    }
    // ── Branch B: Legacy Server Derivation ──
    else if (currentPassword && newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: 'New password must be at least 8 characters long' },
          { status: 400 }
        );
      }

      // Verify current password via auth
      const { error: signInError } = await authResult.supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (signInError) {
        return NextResponse.json(
          { error: 'Current password is incorrect.' },
          { status: 401 }
        );
      }

      if (!userData.encrypted_master_key || !userData.master_key_iv) {
        return NextResponse.json(
          { error: 'Your account needs encryption initialization before changing password.' },
          { status: 400 }
        );
      }

      // Re-encrypt master key with new password using existing salt (preserves legacy recovery codes)
      const reWrapped = await changePassword(
        user.id,
        currentPassword,
        newPassword,
        userData.encryption_salt,
        userData.encrypted_master_key,
        userData.master_key_iv
      );

      finalEncryptedMasterKey = reWrapped.encryptedMasterKey;
      finalMasterKeyIV = reWrapped.masterKeyIV;
      finalSalt = userData.encryption_salt;
    } else {
      return NextResponse.json(
        { error: 'Missing required credentials for password change' },
        { status: 400 }
      );
    }

    // ── Atomic Commit via PostgreSQL RPC ──
    const { data: rpcResult, error: rpcError } = await adminSupabase.rpc(
      'change_vault_password',
      {
        p_user_id: user.id,
        p_encrypted_master_key: finalEncryptedMasterKey,
        p_master_key_iv: finalMasterKeyIV,
        p_new_salt: finalSalt,
        p_key_version: keyVersionToSet,
        p_expected_version: expected_key_version !== undefined ? expected_key_version : currentKeyVersion,
        p_new_recovery_wrappings: new_recovery_wrappings || null,
        p_new_scheme_version: new_recovery_wrappings ? 2 : (userData.recovery_scheme_version || 1),
      }
    );

    if (rpcError || (rpcResult && !rpcResult.success)) {
      console.error('[change-password] RPC error:', rpcError || rpcResult?.error);
      return NextResponse.json(
        { error: rpcResult?.error || 'Database rejected atomic password update' },
        { status: 409 }
      );
    }

    // If new plain password was provided, synchronize with Supabase Auth
    if (newPassword) {
      const { error: passwordUpdateError } = await adminSupabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );

      if (passwordUpdateError) {
        console.error('[change-password] Auth password update error:', passwordUpdateError);
      }
    }

    // Update audit metadata
    await adminSupabase
      .from('user_settings')
      .update({ last_password_changed_at: new Date().toISOString() })
      .eq('user_id', user.id);

    // Revoke other device sessions if requested
    if (deviceId) {
      await adminSupabase
        .from('device_keys')
        .delete()
        .eq('user_id', user.id)
        .neq('device_id', deviceId);
    }

    return NextResponse.json({
      success: true,
      key_version: keyVersionToSet,
      message: 'Vault password changed successfully. Your journals remain encrypted and accessible.',
    });
  } catch (error: any) {
    console.error('[change-password] Unexpected error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to change password' },
      { status: 500 }
    );
  }
}

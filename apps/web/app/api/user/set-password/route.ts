// apps/web/app/api/user/set-password/route.ts
/**
 * POST /api/user/set-password
 *
 * Phase 5 — OAuth Security Upgrade
 *
 * Sets a Supabase auth password for OAuth users who signed up with Google
 * and never had a password. Unlike /api/user/change-password, this route
 * does NOT require a currentPassword — because the user literally has none.
 *
 * This is called AFTER the client has already re-wrapped the master key
 * locally with the new password and stored it via /api/encryption/upgrade-oauth.
 *
 * Guards:
 *   - User must be authenticated (valid Supabase session)
 *   - User must be an OAuth provider (not already an email user)
 *   - Password must be ≥ 8 characters
 *
 * On success:
 *   - Sets password in Supabase auth (user can now sign in with email+password)
 *   - Updates user_settings: vault_password_set = true, oauth_vault_mode = 'password'
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

    // ── Guard: Only for OAuth users ───────────────────────────────────────
    const provider = user.app_metadata?.provider;
    if (provider === 'email') {
      return NextResponse.json(
        { error: 'This endpoint is only for users who signed up with Google or another OAuth provider. Use /api/user/change-password instead.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { newPassword } = body as { newPassword: string };

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // ── Set password via admin client ─────────────────────────────────────
    // We use the admin client because the standard client's updateUser()
    // requires a valid email-confirmed session, which OAuth users may not have
    // for password operations.
    const admin = createAdminClient();
    const { error: passwordError } = await admin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (passwordError) {
      console.error('[set-password] Failed to set Supabase auth password:', passwordError);
      return NextResponse.json(
        { error: 'Failed to set password. Please try again.' },
        { status: 500 }
      );
    }

    // ── Update user_settings ──────────────────────────────────────────────
    const { error: settingsError } = await admin
      .from('user_settings')
      .update({
        vault_password_set: true,
        vault_upgraded_at: new Date().toISOString(),
        oauth_vault_mode: 'password',
        last_password_changed_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (settingsError) {
      // Non-fatal — password was set, settings update failed
      console.warn('[set-password] Failed to update user_settings:', settingsError.message);
    }

    console.log('[set-password] ✅ Password set for OAuth user:', user.id);

    return NextResponse.json({
      success: true,
      message: 'Password set successfully. You can now sign in with email + password.',
    });
  } catch (err) {
    console.error('[set-password] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

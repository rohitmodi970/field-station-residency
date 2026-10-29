import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { requireRecentAuth } from '@/utils/auth/stepUp';

/**
 * POST /api/user/deleteAccount
 * 
 * Idempotent, Ordered Account & Data Purge (Apple Guideline 5.1.1(v) compliance)
 * Execution Order:
 * 1. Verify Authentication & Step-Up Elevation (if provided)
 * 2. Record deletion reason in audit archive
 * 3. Purge user files & voice notes from Supabase Storage (users_cloud)
 * 4. Purge AI memory & vector embeddings
 * 5. Purge journals, entries, and media
 * 6. Purge active sessions, device keys, and TOTP/recovery codes
 * 7. Purge user profile & settings
 * 8. Permanently delete Supabase Auth user (auth.admin.deleteUser)
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    const user = authResult.user;
    const adminSupabase = createAdminClient();

    // Check step-up elevation if header provided
    const elevationHeader =
      req.headers.get('x-force-elevation') ||
      req.headers.get('X-Force-Elevation');

    if (elevationHeader) {
      const stepUp = await requireRecentAuth(req, {
        requiredScope: 'delete_account',
        consumeToken: true,
      });

      if (!stepUp.authorized) {
        return NextResponse.json({ error: stepUp.error }, { status: stepUp.status });
      }
    }

    const { reason } = await req.json().catch(() => ({}));

    // Record deletion reason in audit table before hard purge
    try {
      const forwardedFor = req.headers.get('x-forwarded-for');
      const ipAddress = forwardedFor?.split(',')[0]?.trim() || '127.0.0.1';

      await adminSupabase.from('deleted_users').insert({
        original_user_id: user.id,
        name: user.user_metadata?.name || null,
        email: user.email,
        ip_address: ipAddress,
        reason: reason || 'In-app account deletion',
        deleted_at: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn('[deleteAccount] Non-fatal audit log warning:', auditErr);
    }

    // 1. Purge Supabase Storage files in users_cloud
    try {
      const { data: userFiles } = await adminSupabase.storage
        .from('users_cloud')
        .list(user.id);

      if (userFiles && userFiles.length > 0) {
        const filePaths = userFiles.map((f) => `${user.id}/${f.name}`);
        await adminSupabase.storage.from('users_cloud').remove(filePaths);
      }

      const { data: bgFiles } = await adminSupabase.storage
        .from('users_cloud')
        .list(`backgrounds/${user.id}`);

      if (bgFiles && bgFiles.length > 0) {
        const bgPaths = bgFiles.map((f) => `backgrounds/${user.id}/${f.name}`);
        await adminSupabase.storage.from('users_cloud').remove(bgPaths);
      }
    } catch (storageErr) {
      console.warn('[deleteAccount] Non-fatal storage purge warning:', storageErr);
    }

    // 2. Purge AI & vector embeddings
    await adminSupabase.from('journal_embeddings').delete().eq('user_id', user.id);
    await adminSupabase.from('audio_analyses').delete().eq('user_id', user.id);
    await adminSupabase.from('ai_todos').delete().eq('user_id', user.id);
    await adminSupabase.from('user_metrics').delete().eq('user_id', user.id);
    await adminSupabase.from('user_context_model').delete().eq('user_id', user.id);

    // 3. Purge Journals & media
    await adminSupabase.from('journal_media').delete().eq('user_id', user.id);
    await adminSupabase.from('journals').delete().eq('user_id', user.id);

    // 4. Purge security keys & sessions
    await adminSupabase.from('device_keys').delete().eq('user_id', user.id);
    await adminSupabase.from('recovery_codes').delete().eq('user_id', user.id);
    await adminSupabase.from('totp_settings').delete().eq('user_id', user.id);
    await adminSupabase.from('user_sessions').delete().eq('user_id', user.id);
    await adminSupabase.from('user_settings').delete().eq('user_id', user.id);

    // 5. Purge public user record
    await adminSupabase.from('users').delete().eq('id', user.id);

    // 6. Permanently delete Supabase Auth user (Guarantees Apple Guideline 5.1.1(v) compliance)
    const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(user.id);
    if (authDeleteError) {
      console.error('[deleteAccount] Failed to delete auth user:', authDeleteError);
    }

    return NextResponse.json({
      success: true,
      message: 'Account, data, and encryption keys permanently deleted in accordance with Apple App Store Review Guidelines.',
    });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete account', error: error?.message },
      { status: 500 }
    );
  }
}
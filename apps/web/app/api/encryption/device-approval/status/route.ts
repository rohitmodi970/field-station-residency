// apps/web/app/api/encryption/device-approval/status/route.ts
/**
 * GET /api/encryption/device-approval/status?request_id=<uuid>
 *
 * Polled by the REQUESTING device every 3 seconds.
 *
 * Returns:
 *   { status: 'pending' }
 *   { status: 'approved', approver_public_key, encrypted_package, package_iv }
 *   { status: 'denied' }
 *   { status: 'expired' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.status || 401 }
      );
    }
    const user = authResult.user;
    const supabase = authResult.supabase;

    const requestId = req.nextUrl.searchParams.get('request_id');
    if (!requestId) {
      return NextResponse.json({ error: 'request_id is required' }, { status: 400 });
    }

    const { data: row, error: fetchError } = await supabase
      .from('device_approval_requests')
      .select('id, status, expires_at, approver_public_key, encrypted_package, package_iv')
      .eq('id', requestId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Auto-expire on server-side check
    if (row.status === 'pending' && new Date(row.expires_at) < new Date()) {
      await supabase
        .from('device_approval_requests')
        .update({ status: 'expired', resolved_at: new Date().toISOString() })
        .eq('id', requestId);

      return NextResponse.json({ status: 'expired' });
    }

    if (row.status === 'approved') {
      return NextResponse.json({
        status: 'approved',
        approver_public_key: row.approver_public_key,
        encrypted_package: row.encrypted_package,
        package_iv: row.package_iv,
      });
    }

    // pending | denied | expired
    return NextResponse.json({ status: row.status });
  } catch (err) {
    console.error('[device-approval/status] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

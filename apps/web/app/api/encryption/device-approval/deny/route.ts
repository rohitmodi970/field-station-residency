// apps/web/app/api/encryption/device-approval/deny/route.ts
/**
 * POST /api/encryption/device-approval/deny
 *
 * Called by the APPROVING device when the user taps "Deny".
 * Marks the request as denied so the requesting device knows to stop polling.
 *
 * Body: { request_id: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { request_id } = await req.json() as { request_id: string };

    if (!request_id) {
      return NextResponse.json({ error: 'request_id is required' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('device_approval_requests')
      .update({ status: 'denied', resolved_at: new Date().toISOString() })
      .eq('id', request_id)
      .eq('user_id', user.id)
      .eq('status', 'pending');

    if (updateError) {
      console.error('[device-approval/deny] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to deny request' }, { status: 500 });
    }

    console.log('[device-approval/deny] Denied request:', request_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[device-approval/deny] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

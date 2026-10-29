// apps/web/app/api/encryption/device-approval/pending/route.ts
/**
 * GET /api/encryption/device-approval/pending
 *
 * Called by TRUSTED devices to poll for any pending approval requests
 * directed at this user. Acts as a reliable fallback when the Supabase
 * Realtime broadcast is missed (network hiccup, tab reload, etc.).
 *
 * Query params:
 *   exclude_device_id  (optional)  — the calling device's own ID.
 *                                    Used so a requesting device doesn't
 *                                    see its own pending request and show
 *                                    the approval modal on itself.
 *
 * Returns the most recent unexpired pending request, if any:
 *   { request: { request_id, requesting_device_name, requesting_browser, requester_public_key } }
 *   or
 *   { request: null }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const excludeDeviceId = req.nextUrl.searchParams.get('exclude_device_id');

    // Fetch the most recent pending request that has not yet expired
    let query = supabase
      .from('device_approval_requests')
      .select('id, requesting_device_id, requesting_device_name, requesting_browser, requester_public_key, expires_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    // Exclude the request if it was created by the calling device itself
    if (excludeDeviceId) {
      query = query.neq('requesting_device_id', excludeDeviceId);
    }

    const { data: rows, error: fetchError } = await query;

    if (fetchError) {
      console.error('[device-approval/pending] Fetch error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch pending requests' }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ request: null });
    }

    const row = rows[0]!;
    return NextResponse.json({
      request: {
        request_id: row.id,
        requesting_device_name: row.requesting_device_name,
        requesting_browser: row.requesting_browser,
        requester_public_key: row.requester_public_key,
      },
    });
  } catch (err) {
    console.error('[device-approval/pending] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// apps/web/app/api/encryption/device-approval/request/route.ts
/**
 * POST /api/encryption/device-approval/request
 *
 * Called by the NEW (requesting) device to initiate the approval handshake.
 *
 * Body:
 *   {
 *     requesting_device_id:   string   // UUID from IndexedDB
 *     requesting_device_name: string   // "Windows — Chrome"
 *     requesting_browser:     string   // "Chrome"
 *     requester_public_key:   string   // ECDH P-256 public key, base64
 *   }
 *
 * Response: { request_id: string }
 *
 * After insertion, a Supabase Realtime broadcast is made on channel
 * `device-approval:{user_id}` so existing trusted devices can react.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const {
      requesting_device_id,
      requesting_device_name,
      requesting_browser,
      requester_public_key,
    } = body as {
      requesting_device_id: string;
      requesting_device_name: string;
      requesting_browser: string;
      requester_public_key: string;
    };

    if (!requesting_device_id || !requester_public_key) {
      return NextResponse.json(
        { error: 'requesting_device_id and requester_public_key are required' },
        { status: 400 }
      );
    }

    // ── Expire any old pending requests from this device ──────────────────
    await supabase
      .from('device_approval_requests')
      .update({ status: 'expired', resolved_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('requesting_device_id', requesting_device_id)
      .eq('status', 'pending');

    // ── Create new approval request ───────────────────────────────────────
    const { data: row, error: insertError } = await supabase
      .from('device_approval_requests')
      .insert({
        user_id: user.id,
        requesting_device_id,
        requesting_device_name: requesting_device_name ?? 'Unknown device',
        requesting_browser: requesting_browser ?? 'Browser',
        requester_public_key,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError || !row) {
      console.error('[device-approval/request] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create approval request' }, { status: 500 });
    }

    console.log('[device-approval/request] Created request:', row.id, 'for user:', user.id);

    // ── Broadcast to trusted devices ──────────────────────────────────────
    // They are listening on channel `device-approval:{user_id}`
    await supabase.channel(`device-approval:${user.id}`).send({
      type: 'broadcast',
      event: 'approval_requested',
      payload: {
        request_id: row.id,
        requesting_device_name: requesting_device_name ?? 'Unknown device',
        requesting_browser: requesting_browser ?? 'Browser',
        requester_public_key,
      },
    });

    return NextResponse.json({ request_id: row.id });
  } catch (err) {
    console.error('[device-approval/request] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

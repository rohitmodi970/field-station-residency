// apps/web/app/api/encryption/device-approval/approve/route.ts
/**
 * POST /api/encryption/device-approval/approve
 *
 * Called by the APPROVING (existing trusted) device.
 * The approving device has:
 *   1. Decrypted the master key using its own device secret
 *   2. Generated an ephemeral ECDH key pair
 *   3. Derived a shared secret from its private key + requester's public key
 *   4. Encrypted the master key with AES-GCM(sharedSecret)
 *
 * The server stores the encrypted package. The requesting device picks it up
 * via GET /status and derives the same shared secret to unwrap the master key.
 * The server NEVER sees the master key in plaintext.
 *
 * Body:
 *   {
 *     request_id:          string   // UUID from device_approval_requests
 *     approver_public_key: string   // ECDH P-256 public key (base64) from approving device
 *     encrypted_package:   string   // AES-GCM ciphertext of masterKey, base64
 *     package_iv:          string   // IV for the above, base64
 *   }
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

    const body = await req.json();
    const { request_id, approver_public_key, encrypted_package, package_iv } = body as {
      request_id: string;
      approver_public_key: string;
      encrypted_package: string;
      package_iv: string;
    };

    if (!request_id || !approver_public_key || !encrypted_package || !package_iv) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // ── Verify the request exists, belongs to this user, and is still pending ─
    const { data: request, error: fetchError } = await supabase
      .from('device_approval_requests')
      .select('id, status, expires_at')
      .eq('id', request_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
    }

    if (request.status !== 'pending') {
      return NextResponse.json(
        { error: `Request is already ${request.status}` },
        { status: 409 }
      );
    }

    if (new Date(request.expires_at) < new Date()) {
      await supabase
        .from('device_approval_requests')
        .update({ status: 'expired', resolved_at: new Date().toISOString() })
        .eq('id', request_id);
      return NextResponse.json({ error: 'Approval request has expired' }, { status: 410 });
    }

    // ── Store encrypted package and mark as approved ───────────────────────
    const { error: updateError } = await supabase
      .from('device_approval_requests')
      .update({
        status: 'approved',
        approver_public_key,
        encrypted_package,
        package_iv,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', request_id)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[device-approval/approve] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to approve request' }, { status: 500 });
    }

    console.log('[device-approval/approve] Approved request:', request_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[device-approval/approve] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

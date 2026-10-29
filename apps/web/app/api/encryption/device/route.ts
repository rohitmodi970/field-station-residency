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

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid or missing JSON payload' }, { status: 400 });
    }

    const {
      device_id,
      device_name,
      device_type,
      browser,
      encrypted_key,
      key_iv,
      salt
    } = body || {};

    if (!device_id || !encrypted_key || !key_iv || !salt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Best-effort IP detection
    const ip = req.headers.get('x-forwarded-for') || null;

    const { error: upsertError } = await supabase
      .from('device_keys')
      .upsert({
        user_id: user.id,
        device_id,
        device_name,
        device_type,
        browser,
        encrypted_key,
        key_iv,
        salt,
        ip_address: ip,
        last_active_at: new Date().toISOString()
      }, {
        onConflict: 'user_id, device_id'
      });

    if (upsertError) {
      console.error('[API] Device key registration failed:', upsertError);
      return NextResponse.json({ error: 'Failed to register device' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[API] Device key error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

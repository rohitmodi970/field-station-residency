import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createHmac } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized: Please log in first' }, { status: 401 });
    }

    const { platform, sender, t, sig } = await req.json();

    if (!platform || !sender) {
      return NextResponse.json({ ok: false, error: 'Missing platform or sender' }, { status: 400 });
    }

    // Validate signature if provided
    if (sig && t) {
      const secret = process.env.WEBHOOK_SECRET || process.env.PHOTON_WEBHOOK_SECRET || 'force-connect-secret';
      const rawPayload = `${platform}:${sender}:${t}`;
      const expectedToken = createHmac('sha256', secret).update(rawPayload).digest('hex').slice(0, 16);

      // Verify token
      if (sig !== expectedToken) {
        return NextResponse.json({ ok: false, error: 'Invalid or expired signature' }, { status: 403 });
      }
    }

    const adminClient = createAdminClient();
    const cleanSender = String(sender).trim();
    const cleanPlatform = String(platform).toLowerCase();

    // Upsert into external_accounts
    const { error: upsertError } = await adminClient
      .from('external_accounts')
      .upsert(
        {
          user_id: user.id,
          provider: cleanPlatform,
          external_id: cleanSender,
          metadata: { linked_at: new Date().toISOString() },
        },
        { onConflict: 'user_id,provider,external_id' }
      );

    if (upsertError) {
      // If composite key is different, try standard insert
      await adminClient.from('external_accounts').insert({
        user_id: user.id,
        provider: cleanPlatform,
        external_id: cleanSender,
        metadata: { linked_at: new Date().toISOString() },
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Successfully connected ${cleanPlatform} (${cleanSender}) to Force user account!`,
      userId: user.id,
      platform: cleanPlatform,
      sender: cleanSender,
    });
  } catch (err: any) {
    console.error('[Connect API] Linking error:', err);
    return NextResponse.json({ ok: false, error: err?.message || 'Failed to link account' }, { status: 500 });
  }
}

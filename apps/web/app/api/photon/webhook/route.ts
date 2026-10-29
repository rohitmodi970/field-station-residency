import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { handlePhotonMessage, verifySignature } from '@/lib/photon/webhook';

export const runtime = 'nodejs';

function getHeaderValue(headers: Headers, name: string): string {
  return headers.get(name) || headers.get(name.toLowerCase()) || '';
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    status: 'photon_webhook_active',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = Buffer.from(await req.arrayBuffer());
    const headerObj: Record<string, string> = {};
    req.headers.forEach((val, key) => { headerObj[key] = val; });

    // Append to local log file for instant debugging
    try {
      const fs = await import('fs');
      const logLine = `[${new Date().toISOString()}] POST /api/photon/webhook\nHeaders: ${JSON.stringify(headerObj, null, 2)}\nBody: ${rawBody.toString('utf8')}\n\n`;
      fs.appendFileSync('photon_requests.log', logLine);
    } catch (_) {}

    const msgId =
      getHeaderValue(req.headers, 'webhook-id') ||
      getHeaderValue(req.headers, 'svix-id') ||
      getHeaderValue(req.headers, 'x-photon-id') ||
      getHeaderValue(req.headers, 'x-spectrum-id');
    const timestamp =
      getHeaderValue(req.headers, 'webhook-timestamp') ||
      getHeaderValue(req.headers, 'svix-timestamp') ||
      getHeaderValue(req.headers, 'x-spectrum-timestamp') ||
      getHeaderValue(req.headers, 'x-photon-timestamp');
    const signature =
      getHeaderValue(req.headers, 'webhook-signature') ||
      getHeaderValue(req.headers, 'svix-signature') ||
      getHeaderValue(req.headers, 'x-spectrum-signature') ||
      getHeaderValue(req.headers, 'x-photon-signature');

    const webhookSecret = process.env.PHOTON_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
    const isLocalDevelopment = process.env.NODE_ENV !== 'production';

    // Verify signature if secret is configured in production environment
    if (webhookSecret && !isLocalDevelopment) {
      if (!verifySignature(rawBody, timestamp, signature, webhookSecret, msgId)) {
        console.warn('[Photon Webhook] Signature verification failed. Check PHOTON_WEBHOOK_SECRET in Vercel settings.');
        return NextResponse.json(
          {
            ok: false,
            error: 'Invalid Signature',
            debug: { timestamp, signature, body: rawBody.toString('utf8') },
          },
          { status: 401 }
        );
      }
    } else if (!webhookSecret && !isLocalDevelopment) {
      console.warn('[Photon Webhook] PHOTON_WEBHOOK_SECRET is not configured in production environment variables.');
    }

    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const requestBaseUrl = host && !host.includes('localhost') && !host.includes('127.0.0.1')
      ? `${proto}://${host}`
      : undefined;

    const payload = JSON.parse(rawBody.toString('utf8'));
    const adminClient = createAdminClient();
    const result = await handlePhotonMessage(payload, adminClient, requestBaseUrl);

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error: any) {
    console.error('[Photon Webhook] Webhook failed:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

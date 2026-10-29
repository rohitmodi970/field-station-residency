import { NextRequest, NextResponse } from 'next/server';
import { verifyTelegramSecret, handleTelegramWebhook } from '@/lib/telegram/webhook';

export const runtime = 'nodejs';

function getHeaderValue(headers: Headers, name: string): string {
  return headers.get(name) || headers.get(name.toLowerCase()) || '';
}

export async function POST(req: NextRequest) {
  try {
    const secretToken = getHeaderValue(req.headers, 'x-telegram-bot-api-secret-token');
    const payload = await req.json();

    if (!verifyTelegramSecret(secretToken)) {
      return NextResponse.json({ ok: false, error: 'Invalid Telegram webhook secret' }, { status: 401 });
    }

    const result = await handleTelegramWebhook(payload);
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error: any) {
    console.error('[Telegram] Webhook failed:', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Webhook processing failed' }, { status: 500 });
  }
}

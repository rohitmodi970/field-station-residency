import { NextResponse } from 'next/server';
import { validateOnairosApiKey, getOnairosApiKey } from '@/lib/onairos/client';

export async function GET() {
  const apiKey = getOnairosApiKey();

  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      valid: false,
      message: 'ONAIROS_API_KEY is not set in environment.',
    });
  }

  const result = await validateOnairosApiKey(apiKey);

  return NextResponse.json({
    configured: true,
    valid: result.valid,
    developer: result.developer?.name || null,
    plan: result.developer?.plan || null,
    keyName: result.keyName || null,
    permissions: result.permissions || [],
    rateLimits: result.rateLimits || null,
    error: result.error || null,
  });
}

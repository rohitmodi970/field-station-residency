import { NextRequest, NextResponse } from 'next/server';
import { proxyFormDataRequest } from '@/lib/analysis/proxy';

// Canonical endpoint for voice/audio quick analysis.
// Current implementation routes to existing voice-analysis pipeline.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  return proxyFormDataRequest(request, '/api/voice-analysis', formData);
}

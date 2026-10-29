import { NextRequest, NextResponse } from 'next/server';
import { proxyJsonRequest } from '@/lib/analysis/proxy';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  return proxyJsonRequest(request, '/api/audio-analysis/presigned-upload', 'POST', body);
}

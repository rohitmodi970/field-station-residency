import { NextRequest, NextResponse } from 'next/server';
import { proxyJsonRequest } from '@/lib/analysis/proxy';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limit = request.nextUrl.searchParams.get('limit');
  const suffix = limit ? `?limit=${encodeURIComponent(limit)}` : '';
  return proxyJsonRequest(request, `/api/audio-analysis/history${suffix}`, 'GET');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  return proxyJsonRequest(request, '/api/audio-analysis/history', 'POST', body);
}

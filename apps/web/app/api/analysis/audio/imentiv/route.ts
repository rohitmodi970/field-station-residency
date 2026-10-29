import { NextRequest, NextResponse } from 'next/server';
import { proxyFormDataRequest, proxyJsonRequest } from '@/lib/analysis/proxy';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const jobId = request.nextUrl.searchParams.get('jobId');
  const audioId = request.nextUrl.searchParams.get('audioId') || request.nextUrl.searchParams.get('imentivAudioId');

  const params = new URLSearchParams();
  if (jobId) params.set('jobId', jobId);
  if (audioId) params.set('audioId', audioId);

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return proxyJsonRequest(request, `/api/audio-analysis/imentiv${suffix}`, 'GET');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json();
    return proxyJsonRequest(request, '/api/audio-analysis/imentiv', 'POST', body);
  }
  const formData = await request.formData();
  return proxyFormDataRequest(request, '/api/audio-analysis/imentiv', formData);
}

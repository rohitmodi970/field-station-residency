import { NextRequest, NextResponse } from 'next/server';
import { proxyFormDataRequest, proxyJsonRequest } from '@/lib/analysis/proxy';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const jobId = request.nextUrl.searchParams.get('jobId');
  const humeJobId = request.nextUrl.searchParams.get('humeJobId');

  const params = new URLSearchParams();
  if (jobId) params.set('jobId', jobId);
  if (humeJobId) params.set('humeJobId', humeJobId);

  const suffix = params.toString() ? `?${params.toString()}` : '';
  return proxyJsonRequest(request, `/api/audio-analysis/hume${suffix}`, 'GET');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  return proxyFormDataRequest(request, '/api/audio-analysis/hume', formData);
}

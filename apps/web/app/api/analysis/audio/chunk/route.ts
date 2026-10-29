import { NextRequest, NextResponse } from 'next/server';
import { proxyFormDataRequest } from '@/lib/analysis/proxy';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  return proxyFormDataRequest(request, '/api/audio-analysis/chunk', formData);
}

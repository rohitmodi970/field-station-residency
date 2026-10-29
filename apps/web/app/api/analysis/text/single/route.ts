import { NextRequest, NextResponse } from 'next/server';
import { proxyFormDataRequest, proxyJsonRequest } from '@/lib/analysis/proxy';
import { isSingleEntryAnalysisType } from '@/types/analysis.contract';

// Canonical endpoint for single-entry text analysis.
// Supports two modes:
// 1) sentiment_quick (multipart form data: text + optional image)
// 2) text_single (json: journalId + decrypted content/title + analysis_type)
export async function POST(request: NextRequest): Promise<NextResponse> {
  const mode = request.nextUrl.searchParams.get('mode') || 'text_single';

  if (mode === 'sentiment_quick') {
    const formData = await request.formData();
    return proxyFormDataRequest(request, '/api/sentiment/analyze-entry', formData);
  }

  const body = await request.json();
  const journalId = body?.journalId as string | undefined;
  const analysisType = body?.analysis_type;

  if (!journalId) {
    return NextResponse.json({ error: 'journalId is required for text_single mode' }, { status: 400 });
  }

  if (!isSingleEntryAnalysisType(analysisType)) {
    return NextResponse.json({ error: 'Invalid analysis_type' }, { status: 400 });
  }

  return proxyJsonRequest(request, `/api/journal/${journalId}/analyze`, 'POST', {
    decrypted_title: body?.decrypted_title || '',
    decrypted_content: body?.decrypted_content || '',
    resolved_content: body?.resolved_content || '',
    analysis_type: analysisType,
  });
}

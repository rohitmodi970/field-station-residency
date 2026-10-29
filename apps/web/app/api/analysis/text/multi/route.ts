import { NextRequest, NextResponse } from 'next/server';
import { proxyJsonRequest } from '@/lib/analysis/proxy';
import {
  isAnalysisTimeframe,
  isLLMProvider,
  isMultiEntryAnalysisType,
} from '@/types/analysis.contract';

// Canonical endpoint for multi-entry text analysis.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();

  if (!Array.isArray(body?.entries) || body.entries.length === 0) {
    return NextResponse.json({ error: 'entries are required' }, { status: 400 });
  }

  const timeframe = isAnalysisTimeframe(body?.timeframe) ? body.timeframe : 'day';
  const provider = body?.provider && isLLMProvider(body.provider) ? body.provider : undefined;
  const analysisTypes = Array.isArray(body?.analysisTypes)
    ? body.analysisTypes.filter(isMultiEntryAnalysisType)
    : [];

  if (analysisTypes.length === 0) {
    return NextResponse.json({ error: 'analysisTypes must contain at least one valid type' }, { status: 400 });
  }

  return proxyJsonRequest(request, '/api/journal-analysis', 'POST', {
    ...body,
    timeframe,
    analysisTypes,
    provider,
  });
}

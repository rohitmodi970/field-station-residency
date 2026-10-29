import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateSmartAITitle, generateSmartSemanticTitle } from '@/lib/force-agent/smartTitle';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { prompt, assistantResponse, toolUsed } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Generate AI title with semantic fallback
    const title = await generateSmartAITitle({
      prompt,
      assistantResponse,
      toolUsed,
    });

    return NextResponse.json({
      title,
      semanticTitle: generateSmartSemanticTitle(prompt),
    });
  } catch (error: any) {
    console.error('[API Agent Title] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate title' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

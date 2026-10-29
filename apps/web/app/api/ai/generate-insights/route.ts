// apps/web/app/api/ai/generate-insights/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { analyzeText } from '@/utils/ai/aiProcessingService';
import { resolveJournalContent } from '@/utilities/journalTitle';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { journal_id, content, title, transcript, resolved_content } = body;
    const analysisContent = resolveJournalContent({
      content: resolved_content || content,
      transcript,
    }).value;

    if (!journal_id || !analysisContent) {
      return NextResponse.json(
        { error: 'Missing required fields: journal_id and content' },
        { status: 400 }
      );
    }

    // Combine title and content for analysis
    const fullText = title ? `${title}. ${analysisContent}` : analysisContent;

    // Perform AI analysis
    const analysis = await analyzeText(fullText);

    // Prepare insight data
    const insightData = {
      user_id: user.id,
      journal_id,
      task_type: 'journal_analysis',
      title: `Analysis of "${title || 'Untitled Entry'}"`,
      summary: analysis.summary,
      sentiment_score: analysis.sentiment.score,
      topics: analysis.topics.map(t => t.topic),
      keywords: analysis.keywords.map(k => k.keyword),
      confidence: analysis.sentiment.confidence,
      model_id: 'rule-based-v1',
      processing_time_ms: 0, // Will be calculated
      metadata: {
        sentiment_label: analysis.sentiment.label,
        topic_details: analysis.topics,
        keyword_details: analysis.keywords,
        analysis_date: new Date().toISOString()
      }
    };

    const startTime = Date.now();

    // Save to ai_insights table
    const { data: insight, error: insertError } = await supabase
      .from('ai_insights')
      .insert({
        ...insightData,
        processing_time_ms: Date.now() - startTime
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving AI insight:', insertError);
      return NextResponse.json({ error: 'Failed to save AI insight' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      insight,
      analysis 
    }, { status: 201 });
  } catch (error) {
    console.error('Error generating AI insights:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint to generate insights for existing journal entry
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const journalId = searchParams.get('journal_id');

    if (!journalId) {
      return NextResponse.json({ error: 'Missing journal_id parameter' }, { status: 400 });
    }

    // Fetch journal entry
    const { data: journal, error: journalError } = await supabase
      .from('journals')
      .select('id, title, content, title_encrypted, content_encrypted, is_encrypted')
      .eq('id', journalId)
      .eq('user_id', user.id)
      .single();

    if (journalError || !journal) {
      return NextResponse.json({ error: 'Journal entry not found' }, { status: 404 });
    }

    // Note: If journal is encrypted, client must decrypt and call POST endpoint
    if (journal.is_encrypted) {
      return NextResponse.json({ 
        error: 'Journal is encrypted. Please decrypt on client side and use POST endpoint.' 
      }, { status: 400 });
    }

    // Analyze unencrypted journal
    const fullText = journal.title ? `${journal.title}. ${journal.content}` : journal.content;
    const analysis = await analyzeText(fullText);

    return NextResponse.json({ 
      success: true,
      analysis 
    }, { status: 200 });
  } catch (error) {
    console.error('Error generating AI insights:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

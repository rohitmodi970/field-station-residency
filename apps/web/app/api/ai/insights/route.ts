// apps/web/app/api/ai/insights/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/ai/insights - Get AI insights for user's journals
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const journalId = searchParams.get('journal_id');
    const taskType = searchParams.get('task_type');
    const limit = parseInt(searchParams.get('limit') || '10');

    let query = supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (journalId) {
      query = query.eq('journal_id', journalId);
    }

    if (taskType) {
      query = query.eq('task_type', taskType);
    }

    const { data: insights, error } = await query;

    if (error) {
      console.error('Error fetching AI insights:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ insights });
  } catch (error: any) {
    console.error('Error in GET /api/ai/insights:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/ai/insights - Create AI insight for a journal
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      journal_id,
      task_type,
      title,
      summary,
      sentiment_score,
      topics,
      keywords,
      confidence,
      model_id,
      input_chars,
      output_chars,
      meta,
    } = body;

    if (!task_type) {
      return NextResponse.json({ error: 'task_type is required' }, { status: 400 });
    }

    const { data: insight, error } = await supabase
      .from('ai_insights')
      .insert({
        user_id: user.id,
        journal_id,
        task_type,
        title,
        summary,
        sentiment_score,
        topics,
        keywords,
        confidence,
        model_id,
        input_chars,
        output_chars,
        meta,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating AI insight:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ insight });
  } catch (error: any) {
    console.error('Error in POST /api/ai/insights:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

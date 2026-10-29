// apps/web/app/api/analysis/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const analysisType = searchParams.get('type'); // 'sentiment' or 'textual'
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build query
    let query = supabase
      .from('analysis_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply type filter if provided
    if (analysisType && (analysisType === 'sentiment' || analysisType === 'textual')) {
      query = query.eq('analysis_type', analysisType);
    }

    const { data: history, error } = await query;

    if (error) {
      console.error('Error fetching analysis history:', error);
      return NextResponse.json({ error: 'Failed to fetch analysis history' }, { status: 500 });
    }

    return NextResponse.json({ history: history || [] }, { status: 200 });
  } catch (error) {
    console.error('Error in analysis history GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { analysis_type, date_range, start_date, end_date, selected_dates, results } = body;

    // Validate required fields
    if (!analysis_type || !date_range || !results) {
      return NextResponse.json(
        { error: 'Missing required fields: analysis_type, date_range, and results are required' },
        { status: 400 }
      );
    }

    // Validate analysis_type
    if (analysis_type !== 'sentiment' && analysis_type !== 'textual') {
      return NextResponse.json(
        { error: 'Invalid analysis_type. Must be either "sentiment" or "textual"' },
        { status: 400 }
      );
    }

    // Insert into database
    const { data: historyEntry, error } = await supabase
      .from('analysis_history')
      .insert({
        user_id: user.id,
        analysis_type,
        date_range,
        start_date: start_date || null,
        end_date: end_date || null,
        selected_dates: selected_dates || null,
        results
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving analysis history:', error);
      return NextResponse.json({ error: 'Failed to save analysis history' }, { status: 500 });
    }

    return NextResponse.json({ history: historyEntry }, { status: 201 });
  } catch (error) {
    console.error('Error in analysis history POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing analysis history ID' }, { status: 400 });
    }

    // Delete the history entry (RLS will ensure user owns it)
    const { error } = await supabase
      .from('analysis_history')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting analysis history:', error);
      return NextResponse.json({ error: 'Failed to delete analysis history' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Analysis history deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error in analysis history DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

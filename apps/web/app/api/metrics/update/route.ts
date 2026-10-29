import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      charactersWritten,
      sessionDuration,
      pageView,
      isNewSession = false
    } = body;

    // Find or create metrics for user
    const { data: metrics, error: metricsError } = await supabase
      .from('user_metrics')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (metricsError && metricsError.code !== 'PGRST116') {
      throw metricsError;
    }

    if (!metrics) {
      // Create initial metrics
      const { error: createError } = await supabase
        .from('user_metrics')
        .insert({
          user_id: user.id,
          total_characters_written: 0,
          total_time_spent_seconds: 0,
          journal_count: 0,
          average_entry_length: 0,
          waitlist_signed_up: false,
          waitlist_access_granted: false,
          session_history: []
        });
      
      if (createError) {
        throw createError;
      }
    }

    // Prepare updates
    const updates: any = {
      last_active: new Date().toISOString()
    };

    if (charactersWritten) {
      const currentChars = metrics?.total_characters_written || 0;
      updates.total_characters_written = currentChars + charactersWritten;
      
      // Get journal count
      const { count } = await supabase
        .from('journals')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_deleted', false);
      
      updates.journal_count = count || 0;
      updates.average_entry_length = updates.total_characters_written / (count || 1);
    }

    if (sessionDuration) {
      const currentTime = metrics?.total_time_spent_seconds || 0;
      updates.total_time_spent_seconds = currentTime + sessionDuration;
    }

    if (isNewSession || pageView) {
      const sessionHistory = metrics?.session_history || [];
      if (isNewSession) {
        sessionHistory.push({
          start_time: new Date().toISOString(),
          page_views: pageView ? [pageView] : []
        });
      } else if (pageView && sessionHistory.length > 0) {
        const currentSession = sessionHistory[sessionHistory.length - 1];
        if (!currentSession.end_time) {
          currentSession.page_views.push(pageView);
        }
      }
      updates.session_history = sessionHistory;
    }

    // Update the metrics
    const { error: updateError } = await supabase
      .from('user_metrics')
      .update(updates)
      .eq('user_id', user.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating metrics:', error);
    return NextResponse.json(
      { error: 'Failed to update metrics' },
      { status: 500 }
    );
  }
}

// Endpoint to get metrics for a user
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { data: metrics, error: metricsError } = await supabase
      .from('user_metrics')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    if (metricsError) {
      return NextResponse.json(
        { error: 'Metrics not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
} 
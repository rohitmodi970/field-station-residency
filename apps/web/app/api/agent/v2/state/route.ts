import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    // 1. Fetch User Context Model
    const { data: model, error: modelErr } = await supabase
      .from('user_context_model')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (modelErr || !model) {
      return NextResponse.json({ error: 'Context model not found', is_onboarded: false }, { status: 404 });
    }

    // 2. Fetch Recent Messages
    const { data: events } = await supabase
      .from('interaction_events')
      .select('*')
      .eq('user_id', user.id)
      .in('event_type', ['message', 'agent_nudge'])
      .order('created_at', { ascending: false })
      .limit(30);

    const todayStr = new Date().toISOString().slice(0, 10);
    const dailyCount = model.daily_nudge_date === todayStr ? (model.daily_nudge_count || 0) : 0;

    return NextResponse.json({
      success: true,
      is_onboarded: !!model.onboarding_completed_at,
      initial_model: model.initial_model,
      current_model: model.current_model,
      active_threads: (model.unresolved_threads || []).filter((t: any) => t.status !== 'resolved'),
      explicit_facts: model.explicit_facts || [],
      agent_inferences: model.agent_inferences || [],
      observed_patterns: model.observed_patterns || [],
      daily_nudges_remaining: Math.max(0, 2 - dailyCount),
      recent_events: (events || []).reverse(),
    });
  } catch (err: any) {
    console.error('💥 [API:Agent:State] Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

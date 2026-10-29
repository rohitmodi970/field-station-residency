import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { evaluateProactiveTrigger } from '@/lib/agent/v2/triggerEngine';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const force = searchParams.get('force') === 'true' || body?.force === true;
    const simulate = searchParams.get('simulate') === 'true' || body?.simulate === true;

    // ──────────────────────────────────────────────────────────────
    // DEV-ONLY: Simulate mode — bypass LLM entirely and inject a
    // test notification so the Floating Toast + Notification Bell
    // render immediately via Supabase Realtime.
    // Usage: window.__forceSimulateNudge()  (browser console)
    // ──────────────────────────────────────────────────────────────
    if (simulate) {
      const testMessage = body?.message
        || "Noticed you've been building steadily — wanted to check: is there anything from earlier today that's still on your mind?";

      // 1. Log to interaction_events (same shape as real nudge)
      const { data: simEvent } = await supabase
        .from('interaction_events')
        .insert({
          user_id: user.id,
          event_type: 'agent_nudge',
          source: 'agent',
          event_data: {
            text: testMessage,
            action: 'respond',
            confidence: 0.92,
            reasoning_trace: '[SIMULATED] Dev test nudge — bypassed reasoning engine.',
            context_used: ['simulation'],
            simulated: true,
          },
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      // 2. Bridge to notifications table (triggers Supabase Realtime → toast + bell)
      const { error: notifErr } = await supabase
        .from('notifications')
        .insert({
          recipient_id: user.id,
          type: 'action',
          title: '✨ Force Companion',
          body: testMessage,
          priority: 'normal',
          channels: ['in_app'],
          status: 'sent',
          is_read: false,
          is_dismissed: false,
          data: {
            is_companion_nudge: true,
            event_id: simEvent?.id,
            trigger_type: 'simulated_test',
            simulated: true,
          },
        });

      if (notifErr) {
        console.warn('⚠️ [NudgeCheck:Simulate] Failed to insert test notification:', notifErr);
        return NextResponse.json({ success: false, error: notifErr.message }, { status: 500 });
      }

      console.log('✅ [NudgeCheck:Simulate] Test nudge injected — toast should appear.');
      return NextResponse.json({
        success: true,
        simulated: true,
        result: {
          should_reach: true,
          reason: 'simulated_test_nudge',
          decision: {
            action: 'respond',
            content: testMessage,
            confidence: 0.92,
            reasoning_trace: '[SIMULATED] Dev test nudge.',
          },
          eventId: simEvent?.id,
        },
      });
    }

    // ──────────────────────────────────────────────────────────────
    // Normal flow: run the full reasoning engine
    // ──────────────────────────────────────────────────────────────
    const result = await evaluateProactiveTrigger(
      supabase,
      user.id,
      {
        full_name: user.user_metadata?.full_name,
        email: user.email,
      },
      { force }
    );

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error('💥 [API:Agent:NudgeCheck] Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to check nudge' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

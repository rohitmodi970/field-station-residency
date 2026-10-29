import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { notificationId, threadId, reason } = body;

    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId is required' }, { status: 400 });
    }

    // 1. Mark notification as dismissed in notifications table
    await supabase
      .from('notifications')
      .update({
        is_dismissed: true,
        status: 'dismissed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('recipient_id', user.id);

    // 2. Log explicit dismissal telemetry to interaction_events
    await supabase.from('interaction_events').insert({
      user_id: user.id,
      event_type: 'agent_nudge_dismissed',
      source: 'web_app',
      event_data: {
        notification_id: notificationId,
        thread_id: threadId || null,
        reason: reason || 'manual_user_dismissal',
        client_timestamp: new Date().toISOString(),
      },
      processed: true,
      processed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('💥 [API:Agent:NudgeDismiss] Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to dismiss nudge' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import type { UnresolvedThread } from '@/types/context-schemas';

export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    const body = await req.json().catch(() => ({}));
    const { notificationId, threadId, replyText, actionType } = body;

    const userMessage = (replyText || actionType || '').trim();
    if (!userMessage) {
      return NextResponse.json({ error: 'Reply text or action is required' }, { status: 400 });
    }

    // Determine agent's instant contextual reply
    let instantReply = 'Noted! I have updated your reflection notes.';
    let newThreadStatus: 'active' | 'resolved' | 'snoozed' = 'active';

    const lower = userMessage.toLowerCase();

    if (actionType === 'talk_later' || lower.includes('talk later') || lower.includes('later') || lower.includes('busy')) {
      instantReply = "Understood! Pausing this thread for today. We'll pick it up whenever you're ready.";
      newThreadStatus = 'snoozed';
    } else if (actionType === 'resolved' || lower.includes('went well') || lower.includes('resolved') || lower.includes('done') || lower.includes('good')) {
      instantReply = 'Glad to hear that! Marked this thread as resolved.';
      newThreadStatus = 'resolved';
    } else if (actionType === 'postponed' || lower.includes('postpone') || lower.includes('delayed')) {
      instantReply = "Noted! I've postponed this topic so it won't interrupt your flow.";
      newThreadStatus = 'snoozed';
    } else {
      instantReply = `Understood. I've noted: "${userMessage.length > 60 ? userMessage.slice(0, 57) + '...' : userMessage}".`;
    }

    // 1. Update unresolved thread if threadId exists
    if (threadId) {
      const { data: model } = await supabase
        .from('user_context_model')
        .select('unresolved_threads')
        .eq('user_id', user.id)
        .maybeSingle();

      if (model && Array.isArray(model.unresolved_threads)) {
        const updatedThreads = model.unresolved_threads.map((t: UnresolvedThread) => {
          if (t.id === threadId) {
            return {
              ...t,
              status: newThreadStatus === 'resolved' ? 'resolved' : t.status,
              last_referenced_at: new Date().toISOString(),
              context: `${t.initial_context || ''} | Update: ${userMessage}`.trim(),
            };
          }
          return t;
        });

        await supabase
          .from('user_context_model')
          .update({
            unresolved_threads: updatedThreads,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);
      }
    }

    // 2. Log user reply to interaction_events
    await supabase.from('interaction_events').insert({
      user_id: user.id,
      event_type: 'message',
      source: 'quick_reply',
      event_data: {
        text: userMessage,
        action_type: actionType || 'custom',
        thread_id: threadId,
        notification_id: notificationId,
        client_timestamp: new Date().toISOString(),
      },
      processed: true,
      processed_at: new Date().toISOString(),
    });

    // 3. Log agent's instant acknowledgement to interaction_events
    await supabase.from('interaction_events').insert({
      user_id: user.id,
      event_type: 'agent_nudge',
      source: 'agent',
      event_data: {
        text: instantReply,
        action: 'respond',
        confidence: 0.95,
        source_distinction: 'explicit',
        context_used: threadId ? [threadId] : [],
        reasoning_trace: `Instant response to user inline quick reply: "${userMessage}"`,
      },
      processed: true,
      processed_at: new Date().toISOString(),
    });

    // 4. Update notification row if notificationId provided
    if (notificationId) {
      await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
          data: {
            is_companion_nudge: true,
            status: 'replied',
            user_reply: userMessage,
            instant_reply: instantReply,
            thread_status: newThreadStatus,
            replied_at: new Date().toISOString(),
          },
        })
        .eq('id', notificationId);
    }

    return NextResponse.json({
      success: true,
      instantReply,
      threadStatus: newThreadStatus,
    });
  } catch (err: any) {
    console.error('💥 [API:Agent:QuickReply] Error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to process quick reply' }, { status: 500 });
  }
}

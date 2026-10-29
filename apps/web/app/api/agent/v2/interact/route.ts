import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/utils/supabase/server';
import { buildUserContextSnapshot } from '@/lib/agent/v2/contextSnapshotService';
import { evaluateAgentDecision } from '@/lib/agent/v2/reasoningEngine';
import { applyMemoryMutations } from '@/lib/agent/v2/memoryMutationService';

export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    const body = await req.json();
    const message = body?.message?.trim();
    const source = typeof body?.source === 'string' && ['web_app', 'messaging', 'external_api'].includes(body.source)
      ? body.source
      : 'web_app';

    if (!message) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message exceeds maximum length of 5,000 characters' }, { status: 400 });
    }

    // 1. Log the incoming user message to interaction_events
    const { data: userEvent, error: userEventErr } = await supabase
      .from('interaction_events')
      .insert({
        user_id: user.id,
        event_type: 'message',
        source: source,
        event_data: {
          text: message,
          client_timestamp: new Date().toISOString(),
        },
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (userEventErr) {
      console.warn('⚠️ [API:Agent:Interact] Could not log user event:', userEventErr);
    }

    // 2. Build canonical UserContextSnapshot with associative recall
    const snapshot = await buildUserContextSnapshot(
      supabase,
      user.id,
      {
        full_name: user.user_metadata?.full_name,
        email: user.email,
      },
      { query: message }
    );

    if (!snapshot) {
      return NextResponse.json(
        { error: 'Could not assemble user context snapshot. Onboarding may be incomplete.' },
        { status: 422 }
      );
    }

    // 3. Run Agent Reasoning Loop
    const decision = await evaluateAgentDecision({
      snapshot,
      incomingMessage: message,
    });

    // 4. Apply Memory Mutations to user_context_model in background
    await applyMemoryMutations(supabase, user.id, decision);

    // 5. Log the Agent's response event
    let agentEventId: string | undefined;
    if (decision.action !== 'silence' && decision.content) {
      const { data: agentEvent } = await supabase
        .from('interaction_events')
        .insert({
          user_id: user.id,
          event_type: 'message',
          source: 'agent',
          event_data: {
            text: decision.content,
            action: decision.action,
            confidence: decision.confidence,
            source_distinction: decision.source_distinction,
            reasoning_trace: decision.reasoning_trace,
            real_world_action: decision.real_world_action,
            reply_to_event_id: userEvent?.id,
          },
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      agentEventId = agentEvent?.id;
    }

    return NextResponse.json({
      success: true,
      decision,
      user_event_id: userEvent?.id,
      agent_event_id: agentEventId,
    });
  } catch (error: any) {
    console.error('💥 [API:Agent:Interact] Unexpected error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process interaction' },
      { status: 500 }
    );
  }
}

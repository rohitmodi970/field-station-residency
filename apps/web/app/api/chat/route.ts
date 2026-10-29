import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { forceAgentOrchestrator } from '@/lib/force-agent';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      messages,
      systemContext,
      sessionId,
      decryptedJournals,
      decryptedTodos,
      action,
      todoId,
      todoStatus,
      threadId,
      location,
      userLocation,
      activeBackgroundTask,
      previousSessionContext,
    } = body;

    // Quick action: toggle todo status directly from chat card
    if (action === 'toggle_todo' && todoId) {
      const { updateTodoStatus } = await import('@/lib/force-agent/appTools');
      const updated = await updateTodoStatus({
        userId: user.id,
        id: todoId,
        status: todoStatus === 'done' ? 'done' : 'pending',
      });
      return NextResponse.json({ success: true, todo: updated });
    }

    // Quick action: resolve an unresolved thread directly from chat
    if (action === 'resolve_thread' && threadId) {
      const { data: currentModel } = await supabase
        .from('user_context_model')
        .select('unresolved_threads')
        .eq('user_id', user.id)
        .maybeSingle();

      const existingThreads = currentModel?.unresolved_threads || [];
      const updatedThreads = existingThreads.map((t: any) =>
        t.id === threadId
          ? { ...t, status: 'resolved', resolved_at: new Date().toISOString() }
          : t
      );

      await supabase
        .from('user_context_model')
        .update({
          unresolved_threads: updatedThreads,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      await supabase.from('interaction_events').insert({
        user_id: user.id,
        event_type: 'thread_resolved',
        source: 'user',
        event_data: { thread_id: threadId, via: 'agent_chat_action' },
        processed: true,
        processed_at: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, threadId, status: 'resolved' });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // ──────────────────────────────────────────────────────────────
    // MEMORY BRIDGE: Fetch user_context_model (Companion Memory)
    // ──────────────────────────────────────────────────────────────
    const { data: contextModel } = await supabase
      .from('user_context_model')
      .select('unresolved_threads, agent_inferences, explicit_facts, core_values')
      .eq('user_id', user.id)
      .maybeSingle();

    // Format companion context blocks
    const companionContextBlocks: string[] = [];

    if (contextModel) {
      // 1. Unresolved Dilemmas & Active Threads
      const openThreads = Array.isArray(contextModel.unresolved_threads)
        ? contextModel.unresolved_threads.filter((t: any) => t.status === 'open' || t.status === 'active')
        : [];

      if (openThreads.length > 0) {
        const threadList = openThreads
          .map((t: any) => {
            const isTarget = t.id === threadId ? ' ★ [ACTIVE FOCUS OF THIS CONVERSATION]' : '';
            return `• [${t.priority?.toUpperCase() || 'NORMAL'}]: "${t.topic}"${isTarget}${t.context ? ` — Context: ${t.context}` : ''}`;
          })
          .join('\n');

        companionContextBlocks.push(
          `ACTIVE UNRESOLVED DILEMMAS & THREADS (from Force Companion):\n${threadList}\nNote: When the user reaches resolution or clear conviction on one of these dilemmas, encourage them to close the loop and acknowledge that this thread is resolved.`
        );
      }

      // 2. Observed Thinking Patterns & Hypotheses
      const inferences = Array.isArray(contextModel.agent_inferences)
        ? contextModel.agent_inferences.slice(0, 5)
        : [];

      if (inferences.length > 0) {
        const infList = inferences
          .map((i: any) => `• Hypothesis: "${i.inference}" (Observed from: ${i.premise || 'reflection rhythm'})`)
          .join('\n');

        companionContextBlocks.push(
          `OBSERVED THINKING PATTERNS & HYPOTHESES:\n${infList}\n(Ground yourself in these observations, but frame them gently as offers rather than definitive verdicts.)`
        );
      }

      // 3. Core Values
      if (Array.isArray(contextModel.core_values) && contextModel.core_values.length > 0) {
        companionContextBlocks.push(`USER CORE VALUES: ${contextModel.core_values.join(', ')}`);
      }
    }

    const mergedSystemContext = [
      systemContext,
      companionContextBlocks.length > 0 ? companionContextBlocks.join('\n\n') : null,
    ]
      .filter(Boolean)
      .join('\n\n---\n\n');

    const effectiveLocation = userLocation || location;

    const result = await forceAgentOrchestrator.handle({
      userId: user.id,
      type: 'chat',
      messages,
      systemContext: mergedSystemContext,
      sessionId,
      decryptedJournals,
      decryptedTodos,
      location: effectiveLocation,
      activeBackgroundTask,
      previousSessionContext,
    });

    if (result.errors && result.errors.length > 0) {
      const errorMsg = result.errors[0] || 'Failed to process chat request';
      const statusCode = errorMsg.includes('configured') || errorMsg.includes('API key') ? 500 : 400;
      return NextResponse.json(
        { error: errorMsg },
        { status: statusCode }
      );
    }

    // Log agent message to interaction_events for feedback tracking & longitudinal analysis
    let agentEventId: string | undefined = undefined;
    try {
      const { data: agentEvent } = await supabase
        .from('interaction_events')
        .insert({
          user_id: user.id,
          event_type: 'message',
          source: 'agent',
          event_data: {
            text: result.message,
            action: result.toolExecution?.tool ? result.toolExecution.tool : 'respond',
            session_id: sessionId,
            thread_id: threadId,
            tool_execution: result.toolExecution,
          },
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      agentEventId = agentEvent?.id;
    } catch (logErr) {
      console.warn('⚠️ [Chat API] Could not log agent event:', logErr);
    }

    return NextResponse.json({
      message: result.message,
      memory_source: result.memorySource,
      usage: result.usage,
      toolExecution: result.toolExecution,
      interaction_id: agentEventId,
      toolExecutions: result.toolExecutions,
      suggestedTitle: result.suggestedTitle,
    });
  } catch (error: unknown) {
    console.error('[Chat API] Error:', error);
    
    let errorMessage = 'Failed to process chat request';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('rate_limit')) {
        errorMessage = 'API rate limit reached. Please try again in a moment.';
        statusCode = 429;
      } else if (error.message.includes('authentication')) {
        errorMessage = 'API authentication failed. Please contact support.';
        statusCode = 500;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
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


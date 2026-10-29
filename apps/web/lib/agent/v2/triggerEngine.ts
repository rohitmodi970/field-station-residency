/**
 * Force V2 — Contextual Trigger Engine
 * Governs proactive autonomous outreach with strict rate limits (max 1–2 reaches/day)
 * and confidence floor enforcement.
 * 
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { buildUserContextSnapshot } from './contextSnapshotService';
import { evaluateAgentDecision } from './reasoningEngine';
import { applyMemoryMutations } from './memoryMutationService';
import type { AgentDecision } from '@/types/agent-context-contract';

export const MAX_DAILY_PROACTIVE_REACHES = 2;
export const MIN_HOURS_BETWEEN_REACHES = 4;

export interface TriggerEvaluationResult {
  should_reach: boolean;
  reason: string;
  decision?: AgentDecision;
  eventId?: string;
}

export async function evaluateProactiveTrigger(
  supabase: SupabaseClient,
  userId: string,
  userMetadata?: { full_name?: string; email?: string },
  options?: { force?: boolean }
): Promise<TriggerEvaluationResult> {
  const isForce = Boolean(options?.force);

  try {
    // 1. Fetch user model and rate limit state
    const { data: contextModel, error } = await supabase
      .from('user_context_model')
      .select('daily_nudge_count, daily_nudge_date, last_proactive_nudge_at, unresolved_threads')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !contextModel) {
      return { should_reach: false, reason: 'user_model_not_found' };
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    let currentDailyCount = contextModel.daily_nudge_count || 0;

    // Reset daily counter if date shifted
    if (contextModel.daily_nudge_date !== todayStr) {
      currentDailyCount = 0;
    }

    // 2. Check Daily Limit
    if (!isForce && currentDailyCount >= MAX_DAILY_PROACTIVE_REACHES) {
      return { should_reach: false, reason: 'daily_cap_reached' };
    }

    // 3. Check Cooldown Interval
    if (!isForce && contextModel.last_proactive_nudge_at) {
      const lastNudgeTime = new Date(contextModel.last_proactive_nudge_at).getTime();
      const elapsedHours = (Date.now() - lastNudgeTime) / (1000 * 60 * 60);
      if (elapsedHours < MIN_HOURS_BETWEEN_REACHES) {
        return { should_reach: false, reason: 'cooldown_period_active' };
      }
    }

    // 3b. Check Pending Unread Nudge with 24-Hour Auto-Expiry
    const { data: pendingList } = await supabase
      .from('notifications')
      .select('id, created_at')
      .eq('recipient_id', userId)
      .eq('is_read', false)
      .eq('is_dismissed', false)
      .contains('data', { is_companion_nudge: true })
      .order('created_at', { ascending: false })
      .limit(1);

    const pending = pendingList?.[0];
    if (pending) {
      const ageHours = (Date.now() - new Date(pending.created_at).getTime()) / (1000 * 60 * 60);

      if (isForce || ageHours > 24) {
        // Auto-expire stale nudge (>24h old or test override) so returning users aren't permanently blocked
        await supabase
          .from('notifications')
          .update({ is_dismissed: true, data: { is_companion_nudge: true, auto_expired: true } })
          .eq('id', pending.id);

        await supabase.from('interaction_events').insert({
          user_id: userId,
          event_type: 'agent_nudge_expired',
          source: 'agent',
          event_data: {
            notification_id: pending.id,
            age_hours: Math.round(ageHours),
            reason: isForce ? 'overridden_by_force_test' : 'auto_expired_after_24h',
          },
          processed: true,
          processed_at: new Date().toISOString(),
        });
      } else {
        return { should_reach: false, reason: 'pending_nudge_still_active' };
      }
    }

    // 4. Build Context Snapshot
    const snapshot = await buildUserContextSnapshot(supabase, userId, userMetadata);
    if (!snapshot) {
      return { should_reach: false, reason: 'failed_to_build_snapshot' };
    }

    // 5. Evaluate potential trigger topics
    const activeThreads = snapshot.active_threads;
    const topThread = activeThreads.length > 0 ? activeThreads[0] : null;

    const triggerType = topThread ? 'thread_followup' : 'evening_reflection';
    const triggerDescription = topThread 
      ? `Checking in thoughtfully on open thread: ${topThread.topic}`
      : `Reflecting gently on user rhythm during ${snapshot.current_context.time_of_day}`;

    // 6. Run Reasoning Engine
    const decision = await evaluateAgentDecision({
      snapshot,
      triggerContext: {
        type: triggerType,
        description: triggerDescription,
      },
    });

    if (decision.action === 'silence' || !decision.content) {
      // Audit silence decision with the exact same rigor as speaking
      await supabase.from('interaction_events').insert({
        user_id: userId,
        event_type: 'agent_silence',
        source: 'agent',
        event_data: {
          action: 'silence',
          confidence: decision.confidence,
          reasoning_trace: decision.reasoning_trace,
          context_used: decision.context_used,
          trigger_type: triggerType,
        },
        processed: true,
        processed_at: new Date().toISOString(),
      });

      return {
        should_reach: false,
        reason: 'agent_chose_silence',
        decision,
      };
    }

    // 7. Log agent proactive reach to interaction_events
    const { data: newEvent, error: eventErr } = await supabase
      .from('interaction_events')
      .insert({
        user_id: userId,
        event_type: 'agent_nudge',
        source: 'agent',
        event_data: {
          text: decision.content,
          action: decision.action,
          confidence: decision.confidence,
          reasoning_trace: decision.reasoning_trace,
          context_used: decision.context_used,
        },
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (eventErr) {
      console.error('❌ [TriggerEngine] Failed to log agent event:', eventErr);
    }

    // 7b. Bridge proactive reach to global notifications table (Navbar Bell & Floating Capsule)
    const { error: notifErr } = await supabase
      .from('notifications')
      .insert({
        recipient_id: userId,
        type: 'action',
        title: '✨ Force Companion',
        body: decision.content,
        priority: 'normal',
        channels: ['in_app'],
        status: 'sent',
        is_read: false,
        is_dismissed: false,
        data: {
          is_companion_nudge: true,
          event_id: newEvent?.id,
          thread_id: topThread?.id,
          trigger_type: triggerType,
          topic: topThread?.topic,
          action: decision.action,
        },
      });

    if (notifErr) {
      console.warn('⚠️ [TriggerEngine] Failed to bridge nudge to notifications table:', notifErr);
    }

    // 8. Update rate limit state in user_context_model
    await supabase
      .from('user_context_model')
      .update({
        daily_nudge_count: currentDailyCount + 1,
        daily_nudge_date: todayStr,
        last_proactive_nudge_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    // 9. Apply memory mutations if any
    await applyMemoryMutations(supabase, userId, decision);

    return {
      should_reach: true,
      reason: 'proactive_reach_dispatched',
      decision,
      eventId: newEvent?.id,
    };
  } catch (err) {
    console.error('💥 [TriggerEngine] Unexpected error:', err);
    return { should_reach: false, reason: 'unexpected_error' };
  }
}

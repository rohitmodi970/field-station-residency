/**
 * Force V2 — Memory Mutation Service
 * Persists grounded facts, unconfirmed hypotheses (inferences), and unresolved threads
 * into the public.user_context_model table after an agent decision.
 * 
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { AgentDecision } from '@/types/agent-context-contract';
import type {
  ExplicitFact,
  AgentInference,
  ObservedPattern,
  UnresolvedThread,
} from '@/types/context-schemas';

export async function applyMemoryMutations(
  supabase: SupabaseClient,
  userId: string,
  decision: AgentDecision
): Promise<boolean> {
  try {
    const { should_persist } = decision;
    if (!should_persist) return true;

    const hasNewFacts = Array.isArray(should_persist.new_facts) && should_persist.new_facts.length > 0;
    const hasNewInferences = Array.isArray(should_persist.new_inferences) && should_persist.new_inferences.length > 0;
    const hasNewPatterns = Array.isArray(should_persist.new_observed_patterns) && should_persist.new_observed_patterns.length > 0;
    const hasNewThread = !!should_persist.new_thread;
    const hasResolvedThreads = Array.isArray(should_persist.resolved_thread_ids) && should_persist.resolved_thread_ids.length > 0;

    if (!hasNewFacts && !hasNewInferences && !hasNewPatterns && !hasNewThread && !hasResolvedThreads) {
      return true;
    }

    // 1. Fetch current context model
    const { data: current, error: fetchErr } = await supabase
      .from('user_context_model')
      .select('explicit_facts, observed_patterns, agent_inferences, unresolved_threads, model_version')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchErr || !current) {
      console.warn(`⚠️ [MemoryMutationService] Could not fetch user_context_model for ${userId}:`, fetchErr);
      return false;
    }

    const now = new Date().toISOString();

    // 2. Prepare updated lists
    const explicitFacts: ExplicitFact[] = Array.isArray(current.explicit_facts) ? [...current.explicit_facts] : [];
    if (hasNewFacts && should_persist.new_facts) {
      for (const nf of should_persist.new_facts) {
        explicitFacts.push({
          id: `fact-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fact: nf.fact,
          category: nf.category,
          source: 'user_explicit',
          source_label: nf.source_label || 'Direct dialogue',
          verified_by_user: true,
          confidence: nf.confidence || 0.9,
          created_at: now,
        });
      }
    }

    const agentInferences: AgentInference[] = Array.isArray(current.agent_inferences) ? [...current.agent_inferences] : [];
    if (hasNewInferences && should_persist.new_inferences) {
      for (const ni of should_persist.new_inferences) {
        agentInferences.push({
          id: `infer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          inference: ni.inference,
          premise: ni.premise,
          confidence: ni.confidence || 0.7,
          is_confirmed: null,
          created_at: now,
        });
      }
    }

    const observedPatterns: ObservedPattern[] = Array.isArray(current.observed_patterns) ? [...current.observed_patterns] : [];
    if (hasNewPatterns && should_persist.new_observed_patterns) {
      for (const np of should_persist.new_observed_patterns) {
        observedPatterns.push({
          id: `patt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          pattern: np.pattern,
          domain: np.domain,
          first_observed_at: now,
          last_observed_at: now,
          observation_count: 1,
          confidence: np.confidence || 0.8,
          supporting_event_ids: [],
        });
      }
    }

    let unresolvedThreads: UnresolvedThread[] = Array.isArray(current.unresolved_threads) ? [...current.unresolved_threads] : [];
    if (hasResolvedThreads && should_persist.resolved_thread_ids) {
      const resolveSet = new Set(should_persist.resolved_thread_ids);
      unresolvedThreads = unresolvedThreads.map(t => {
        if (resolveSet.has(t.id)) {
          return { ...t, status: 'resolved' as const, resolved_at: now };
        }
        return t;
      });
    }

    if (hasNewThread && should_persist.new_thread) {
      unresolvedThreads.push({
        id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        topic: should_persist.new_thread.topic,
        initial_context: should_persist.new_thread.context,
        status: 'active',
        priority: should_persist.new_thread.priority || 'medium',
        created_at: now,
        last_referenced_at: now,
      });
    }

    // 3. Update database
    const newVersion = (current.model_version || 1) + 1;
    const { error: updateErr } = await supabase
      .from('user_context_model')
      .update({
        explicit_facts: explicitFacts,
        agent_inferences: agentInferences,
        observed_patterns: observedPatterns,
        unresolved_threads: unresolvedThreads,
        model_version: newVersion,
        updated_at: now,
      })
      .eq('user_id', userId);

    if (updateErr) {
      console.error(`❌ [MemoryMutationService] Failed to update user_context_model for ${userId}:`, updateErr);
      return false;
    }

    console.log(`🧠 [MemoryMutationService] Successfully updated context model (v${newVersion}) for user ${userId}`);
    return true;
  } catch (error) {
    console.error(`💥 [MemoryMutationService] Unexpected error:`, error);
    return false;
  }
}

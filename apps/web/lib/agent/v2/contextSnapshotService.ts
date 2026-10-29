/**
 * Force V2 — Context Snapshot Service
 * Compiles a canonical UserContextSnapshot from Supabase for the agent reasoning engine.
 * 
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { UserContextSnapshot, RelationshipConnectionSummary } from '@/types/agent-context-contract';
import type {
  UserContextModelEntity,
  InteractionEventEntity,
  UserSocialProfileEntity,
  ExplicitFact,
  ObservedPattern,
  AgentInference,
  UnresolvedThread,
} from '@/types/context-schemas';

import { searchVektoriMemory, formatVektoriContext } from '@/utils/vektori/client';
import { createAdminClient } from '@/utils/supabase/admin';

export function getTimeOfDay(date: Date = new Date()): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Builds the complete UserContextSnapshot for an interaction.
 * Supports optional associative long-term memory retrieval via Vektori.
 */
export async function buildUserContextSnapshot(
  supabase: SupabaseClient,
  userId: string,
  userMetadata?: { full_name?: string; email?: string },
  options?: { query?: string; maxVectorResults?: number }
): Promise<UserContextSnapshot | null> {
  try {
    // 1. Fetch user context model
    const { data: contextModel, error: contextError } = await supabase
      .from('user_context_model')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (contextError) {
      console.error(`❌ [ContextSnapshotService] Error fetching context for ${userId}:`, contextError);
      return null;
    }

    if (!contextModel) {
      console.warn(`⚠️ [ContextSnapshotService] No context model found for user: ${userId}`);
      return null;
    }

    // 2. Fetch recent interaction events (last 15 events)
    const { data: recentEvents } = await supabase
      .from('interaction_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(15);

    // 3. Fetch social profile enrichment data
    const { data: socialProfiles } = await supabase
      .from('user_social_profiles')
      .select('*')
      .eq('user_id', userId);

    const now = new Date();

    const explicitFacts: ExplicitFact[] = Array.isArray(contextModel.explicit_facts)
      ? contextModel.explicit_facts
      : [];

    const observedPatterns: ObservedPattern[] = Array.isArray(contextModel.observed_patterns)
      ? contextModel.observed_patterns
      : [];

    const agentInferences: AgentInference[] = Array.isArray(contextModel.agent_inferences)
      ? contextModel.agent_inferences
      : [];

    const activeThreads: UnresolvedThread[] = Array.isArray(contextModel.unresolved_threads)
      ? contextModel.unresolved_threads.filter((t: UnresolvedThread) => t.status !== 'resolved')
      : [];

    // 4. Associative Semantic Memory (Vektori Long-Term Recall)
    let vektoriContext: string | undefined;
    let historicalMemories: Array<{ text: string; score?: number; source?: string }> | undefined;

    if (options?.query && options.query.trim().length > 0) {
      try {
        const searchResult = await searchVektoriMemory({
          userId,
          query: options.query,
          depth: 'l1',
          contextWindow: options.maxVectorResults || 3,
        });

        if (searchResult) {
          vektoriContext = formatVektoriContext(searchResult) || undefined;
          const allItems = [
            ...(searchResult.facts || []),
            ...(searchResult.episodes || []),
            ...(searchResult.sentences || []),
          ];
          if (allItems.length > 0) {
            historicalMemories = allItems.map((r) => ({
              text: r.text || '',
              score: r.score,
            }));
          }
        }
      } catch (vErr) {
        console.warn(`⚠️ [ContextSnapshotService] Vektori search non-fatal error for ${userId}:`, vErr);
      }
    }

    // 5. Relationship Bridge — accepted Force connections (lightweight, no private model leakage)
    let relationshipConnections: RelationshipConnectionSummary[] = [];
    let hasModelingPermitted = false;

    try {
      const { data: rawConnections } = await supabase
        .from('force_connections')
        .select('id, requester_id, recipient_id, status, requester_allows_modeling, recipient_allows_modeling, relationship_context, requested_at')
        .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (rawConnections && rawConnections.length > 0) {
        // Collect partner IDs to hydrate names
        const partnerIds = rawConnections.map((c: any) =>
          c.requester_id === userId ? c.recipient_id : c.requester_id
        );

        const admin = createAdminClient();
        const { data: profiles } = await admin
          .from('users')
          .select('id, name')
          .in('id', partnerIds);

        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.name || 'Partner']));

        relationshipConnections = rawConnections.map((c: any) => {
          const partnerId = c.requester_id === userId ? c.recipient_id : c.requester_id;
          const bothModeling = Boolean(c.requester_allows_modeling && c.recipient_allows_modeling);
          if (bothModeling) hasModelingPermitted = true;
          const relCtx = (c.relationship_context || {}) as Record<string, any>;

          return {
            connection_id: c.id,
            partner_name: profileMap.get(partnerId) || 'Partner',
            partner_id: partnerId,
            status: 'accepted' as const,
            is_modeling_permitted: bothModeling,
            shared_topics: Array.isArray(relCtx.shared_topics) ? relCtx.shared_topics : [],
            last_interaction_at: (relCtx.last_interaction_at as string) || c.requested_at,
          };
        });
      }
    } catch (relErr) {
      console.warn(`⚠️ [ContextSnapshotService] Relationship bridge non-fatal error for ${userId}:`, relErr);
    }

    const snapshot: UserContextSnapshot = {
      user_id: userId,
      identity: {
        full_name: userMetadata?.full_name || 'Friend',
        primary_email: userMetadata?.email || '',
      },
      onboarding_model: contextModel.initial_model || null,
      personality_model: contextModel.personality_assessment || null,
      recent_interactions: (recentEvents || []).reverse() as InteractionEventEntity[],
      active_threads: activeThreads,
      behavioral_patterns: [],
      current_context: {
        current_time_iso: now.toISOString(),
        time_of_day: getTimeOfDay(now),
        recent_activity_summary: undefined,
        location_label: undefined,
      },
      explicit_facts: explicitFacts,
      observed_patterns: observedPatterns,
      agent_inferences: agentInferences,
      social_enrichment_profiles: (socialProfiles || []) as UserSocialProfileEntity[],
      relationship_connections: relationshipConnections.length > 0 ? relationshipConnections : undefined,
      permissions: {
        allowed_sources: ['messaging', 'web_app', 'journal', 'social_enrichment'],
        allow_relationship_modeling: hasModelingPermitted,
      },
      vektori_context: vektoriContext,
      historical_memories: historicalMemories,
    };

    return snapshot;
  } catch (error) {
    console.error(`💥 [ContextSnapshotService] Unexpected error building snapshot for ${userId}:`, error);
    return null;
  }
}

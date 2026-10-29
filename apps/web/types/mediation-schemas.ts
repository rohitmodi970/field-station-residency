/**
 * Force V2 — Phase 5 Mediation Contracts & Schemas
 * Defines the canonical data structures for relationship-aware mediation,
 * bridging questions, pattern detection, and privacy-preserving intervention delivery.
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

export const MIN_MEDIATION_CONFIDENCE_THRESHOLD = 0.55;
export const HIGH_MEDIATION_CONFIDENCE_THRESHOLD = 0.80;

export type MediationInterventionType =
  | 'bridging_question'
  | 'pattern_reflection'
  | 'friction_nudge'
  | 'real_world_suggestion'
  | 'silence';

export type MediationVisibility =
  | 'shared'
  | 'private_to_initiator'
  | 'private_to_target';

export type MediationStatus =
  | 'active'
  | 'acted_upon'
  | 'dismissed'
  | 'expired';

export type MediationFeedbackRating =
  | 'helpful'
  | 'unhelpful'
  | 'awkward'
  | 'intrusive';

export interface MediationInterventionEntity {
  id: string;
  connection_id: string;
  initiator_id: string | null;
  target_user_id: string | null;
  visibility: MediationVisibility;
  intervention_type: MediationInterventionType;
  content: string | null;
  bridging_question: string | null;
  confidence: number;
  reasoning_trace: string;
  context_used: string[];
  status: MediationStatus;
  created_at: string;
  acted_at: string | null;
  dismissed_at: string | null;
}

export interface MediationFeedbackEntity {
  id: string;
  intervention_id: string;
  user_id: string;
  rating: MediationFeedbackRating;
  comment: string | null;
  created_at: string;
}

/**
 * Scoped context snapshot provided to the mediation reasoning engine.
 * STRICT PRIVACY INVARIANT: Raw private journals and personal context models
 * are NEVER included in this snapshot. Only consented relationship context,
 * high-level interaction rhythms, and explicitly shared summaries are present.
 */
export interface MediationContextSnapshot {
  connection_id: string;
  requester_id: string;
  recipient_id: string;
  caller_user_id: string;
  caller_role: 'requester' | 'recipient';
  status: 'accepted' | 'pending' | 'declined' | 'blocked' | 'dissolved';
  is_modeling_permitted: boolean; // Both requester_allows_modeling and recipient_allows_modeling
  relationship_rhythms: {
    shared_topics: string[];
    interaction_count: number;
    last_interaction_at?: string;
    reciprocity_balance?: number; // 0.0 - 1.0 (0.5 is perfectly balanced)
    days_since_first_connected: number;
  };
  consented_shared_snapshots: Array<{
    grant_id: string;
    grantor_id: string;
    grant_type: string;
    title_summary?: string;
    shared_at: string;
    is_sensitive: boolean;
  }>;
  recent_relationship_events: Array<{
    event_type: string;
    actor_id?: string;
    created_at: string;
    summary?: string;
  }>;
  active_intervention_count: number;
}

/**
 * Output format produced by the Anthropic Claude Haiku 4.5 mediation engine.
 */
export interface MediationDecision {
  action: MediationInterventionType;
  visibility: MediationVisibility;
  target_user_id?: string | null;
  content?: string;
  bridging_question?: string;
  confidence: number;
  reasoning_trace: string;
  context_used: string[];
  should_persist: boolean;
}

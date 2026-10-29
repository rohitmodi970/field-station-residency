/**
 * Force V2 — Agent & Context Canonical Contract
 * Defines the strict boundary between Context Retrieval and Agent Reasoning.
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

import type {
  UserContextModelEntity,
  ExplicitFact,
  ObservedPattern,
  AgentInference,
  UnresolvedThread,
  BehavioralPattern,
  PersonalityAssessment,
  InteractionEventEntity,
  UserSocialProfileEntity,
} from './context-schemas';

/**
 * Minimum confidence floor required for the agent to actively intervene or speak.
 * Below this threshold, the agent must stay silent (action = 'silence').
 */
export const MIN_SPEAKING_CONFIDENCE_THRESHOLD = 0.55;
export const HIGH_CONFIDENCE_THRESHOLD = 0.80;

/**
 * Permitted actions the reasoning engine can output.
 */
export type AgentActionType =
  | 'respond'                // Direct conversational reply
  | 'question'               // High-leverage clarifying question
  | 'reflect'                // Longitudinal observation or synthesis
  | 'nudge'                  // Gentle reminder or check-in on an unresolved thread
  | 'silence'                // Deliberate non-intervention (confidence low or timing inappropriate)
  | 'real_world_suggestion'; // Suggesting walk, meal, friend, conversation, or offline action

/**
 * Classification of context grounding source.
 */
export type ContextSourceDistinction = 'explicit' | 'observed' | 'inferred';

/**
 * Context Snapshot provided to the reasoning engine for an interaction.
 */
export interface UserContextSnapshot {
  user_id: string;
  identity: {
    full_name: string;
    location?: string;
    primary_email: string;
  };
  onboarding_model: UserContextModelEntity['initial_model'];
  personality_model: PersonalityAssessment | null;
  recent_interactions: InteractionEventEntity[];
  active_threads: UnresolvedThread[];
  behavioral_patterns: BehavioralPattern[];
  current_context: {
    current_time_iso: string;
    time_of_day: 'morning' | 'afternoon' | 'evening' | 'night';
    recent_activity_summary?: string;
    location_label?: string;
  };
  explicit_facts: ExplicitFact[];
  observed_patterns: ObservedPattern[];
  agent_inferences: AgentInference[];
  social_enrichment_profiles?: UserSocialProfileEntity[];
  /** Lightweight summaries of accepted Force connections (no private model leakage) */
  relationship_connections?: RelationshipConnectionSummary[];
  permissions: {
    allowed_sources: string[];
    allow_relationship_modeling: boolean;
  };
  vektori_context?: string;
  historical_memories?: Array<{ text: string; score?: number; source?: string }>;
}

export interface RealWorldActionSuggestion {
  action_type: 'walk' | 'call_friend' | 'take_break' | 'meal' | 'custom';
  title: string;
  description: string;
  estimated_minutes?: number;
  target_person?: string;
  suggested_prompt?: string;
}

/**
 * Structured decision produced by the agent reasoning engine.
 */
export interface AgentDecision {
  action: AgentActionType;
  content?: string;                                // Spoken / displayed content (null if silence)
  confidence: number;                              // 0.0 to 1.0
  reasoning_trace: string;                         // Internal reasoning explaining why this action was chosen
  context_used: string[];                          // Context fact/inference IDs referenced
  source_distinction: ContextSourceDistinction;
  real_world_action?: RealWorldActionSuggestion;   // Structured offline action when action is real_world_suggestion
  should_persist: {
    new_facts?: Array<{
      fact: string;
      category: ExplicitFact['category'];
      confidence: number;
      source_label?: string;
    }>;
    new_inferences?: Array<{
      inference: string;
      premise: string;
      confidence: number;
    }>;
    new_observed_patterns?: Array<{
      pattern: string;
      domain: ObservedPattern['domain'];
      confidence: number;
    }>;
    resolved_thread_ids?: string[];
    new_thread?: {
      topic: string;
      context: string;
      priority: 'low' | 'medium' | 'high';
    };
  };
}

/**
 * Contract for Day-1 Onboarding Synthesis
 */
export interface OnboardingSynthesisRequest {
  user_id: string;
  user_name: string;
  location?: string;
  onboarding_answers: Record<string, { prompt: string; answer: string }>;
  social_profiles_data: Array<{
    platform: string;
    url?: string;
    extracted_text?: string;
    insights?: Record<string, unknown>;
  }>;
}

export interface OnboardingSynthesisResponse {
  narrative_reflection: string;
  source_badges: string[];
  key_explicit_facts: Array<{ fact: string; category: ExplicitFact['category']; source: string }>;
  initial_inferences: Array<{ inference: string; premise: string; confidence: number }>;
  initial_threads: Array<{ topic: string; context: string; priority: 'low' | 'medium' | 'high' }>;
  is_zero_signal_fallback: boolean;
}

/**
 * Lightweight relationship summary surfaced in UserContextSnapshot.
 * Contains ONLY what the agent needs to reference a connection — never private model data.
 */
export interface RelationshipConnectionSummary {
  connection_id: string;
  partner_name: string;
  partner_id: string;
  status: 'accepted' | 'pending';
  is_modeling_permitted: boolean;
  shared_topics?: string[];
  last_interaction_at?: string;
}

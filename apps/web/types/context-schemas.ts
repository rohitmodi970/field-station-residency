/**
 * Force V2 — Context Schemas
 * Canonical data schemas for user context, tri-part memory tracking,
 * behavioral models, and longitudinal interaction events.
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

export type SourceType =
  | 'user_explicit'
  | 'onboarding_q1'
  | 'onboarding_q2'
  | 'onboarding_q3'
  | 'onboarding_q4'
  | 'onboarding_q5'
  | 'onairos_import'
  | 'onairos_inferred'
  | 'exa_search'
  | 'proxycurl_linkedin'
  | 'firecrawl_site'
  | 'github_api'
  | 'tinyfish_agent'
  | 'messaging_inferred'
  | 'journal_entry'
  | 'contextual_observation';

/**
 * An explicit fact stated directly by the user or verified via primary links.
 */
export interface ExplicitFact {
  id: string;
  fact: string;
  category: 'identity' | 'career' | 'relationship' | 'interest' | 'value' | 'routine' | 'other';
  source: SourceType;
  source_url?: string;
  source_label?: string; // e.g. "LinkedIn", "Your answer to Q2", "rohitmodi.dev"
  verified_by_user: boolean;
  confidence: number; // 0.0 - 1.0 (1.0 for direct user statements)
  created_at: string;
  updated_at?: string;
}

/**
 * A pattern observed across multiple interactions or temporal events.
 */
export interface ObservedPattern {
  id: string;
  pattern: string;
  domain: 'communication' | 'work_habits' | 'emotional_rhythm' | 'decision_making' | 'focus_periods';
  observation_count: number;
  confidence: number; // 0.0 - 1.0
  first_observed_at: string;
  last_observed_at: string;
  supporting_event_ids: string[];
}

/**
 * An inference or deduction made by the reasoning agent.
 * CRITICAL RULE: Inferences are strictly distinguished from facts and never become facts silently.
 */
export interface AgentInference {
  id: string;
  inference: string;
  premise: string; // Why the agent concluded this
  confidence: number; // 0.0 - 1.0
  is_confirmed: boolean | null; // null = pending review, true = user confirmed, false = user refuted
  confirmed_at?: string;
  refuted_at?: string;
  refuted_reason?: string;
  created_at: string;
}

/**
 * An open, unresolved thought, decision, or thread the user is navigating.
 */
export interface UnresolvedThread {
  id: string;
  topic: string;
  initial_context: string;
  status: 'active' | 'resolved' | 'dormant' | 'abandoned';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  last_referenced_at: string;
  resolved_at?: string;
  resolution_note?: string;
}

/**
 * Specific recurring behavioral patterns used for agent timing/interventions.
 */
export interface BehavioralPattern {
  key: string;
  title: string;
  description: string;
  recurrence_cadence?: 'daily' | 'weekly' | 'situational';
  optimal_intervention_window?: string; // e.g. "morning_before_work", "late_evening"
}

/**
 * Standard Big Five Psychometric Trait Scores (0.0 to 1.0)
 * Inferred via Onairos cross-platform behavioral footprint
 */
export interface BigFiveTraits {
  openness: number;          // 0.0 - 1.0 (exploratory vs routine)
  conscientiousness: number;  // 0.0 - 1.0 (structured vs relaxed)
  extraversion: number;       // 0.0 - 1.0 (social vs solitary)
  agreeableness: number;      // 0.0 - 1.0 (warm vs challenging)
  neuroticism: number;        // 0.0 - 1.0 (emotional volatility vs stability)
}

/**
 * Force Personality & Cognitive Style Model
 */
export interface PersonalityAssessment {
  cognitive_style?: 'systematic' | 'intuitive' | 'analytical' | 'narrative' | 'visual';
  core_values: string[];
  communication_preference?: 'direct_concise' | 'exploratory' | 'reflective' | 'action_oriented';
  relational_style?: string;
  synthesis_summary?: string;
  raw_traits?: Record<string, unknown>;
  big_five?: BigFiveTraits;
  sentiment_signals?: Array<{ topic: string; sentiment: number }>;
  source?: 'onairos' | 'journal_synthesis' | 'manual';
  confidence?: number;
}

/**
 * Answers to the 5 Onboarding Conversational Questions
 */
export interface OnboardingQuestionAnswer {
  question_id: 'q1_current_state' | 'q2_values' | 'q3_relationships' | 'q4_current_thread' | 'q5_aspiration';
  question_prompt: string;
  raw_answer: string;
  chips_selected?: string[];
  answered_at: string;
  emotional_temperature?: 'neutral' | 'energized' | 'heavy' | 'uncertain' | 'optimistic';
}

export type OnboardingAnswersMap = Partial<
  Record<OnboardingQuestionAnswer['question_id'], OnboardingQuestionAnswer>
>;

/**
 * External Data Consents Map
 */
export interface ExternalDataConsent {
  platform: 'linkedin' | 'twitter' | 'github' | 'website' | 'instagram' | 'exa_web_search' | 'notion' | 'onairos';
  consented: boolean;
  consented_at: string;
  revoked_at?: string;
  handle_or_url?: string;
  approved_scopes?: string[];
}

export type ExternalDataConsentsMap = Partial<
  Record<ExternalDataConsent['platform'], ExternalDataConsent>
>;

/**
 * The core User Context Model (Supabase: public.user_context_model)
 */
export interface UserContextModelEntity {
  id: string;
  user_id: string;
  onboarding_answers: OnboardingAnswersMap;
  initial_model: {
    narrative_reflection: string;
    generated_at: string;
    source_badges: string[];
    is_zero_signal_fallback?: boolean;
  } | null;
  current_model: Record<string, unknown> | null;
  model_history: Array<{
    version: number;
    initial_model: Record<string, unknown> | null;
    current_model: Record<string, unknown> | null;
    onboarding_completed_at: string | null;
    archived_at: string;
  }>;
  personality_assessment: PersonalityAssessment | null;
  explicit_facts: ExplicitFact[];
  observed_patterns: ObservedPattern[];
  agent_inferences: AgentInference[];
  corrections: Array<{
    id: string;
    original_claim: string;
    user_correction: string;
    corrected_at: string;
  }>;
  unresolved_threads: UnresolvedThread[];
  active_intentions: string[];
  external_data_consents: ExternalDataConsentsMap;
  support_prompt_shown_at: string | null;
  onairos_jwt?: string | null;
  onairos_connected_at?: string | null;
  onairos_token_expires_at?: string | null;
  onairos_payload?: Record<string, unknown> | null;
  model_version: number;
  last_synthesis_at: string | null;
  onboarding_step: number;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Onairos Consented Persona Ingest Contract
 */
export interface OnairosIngestPayload {
  token?: string;
  approved?: string[];
  apiResponse?: {
    personality?: Partial<BigFiveTraits> | Record<string, unknown>;
    archetype?: string;
    user_summary?: string;
    positive_traits?: Record<string, number | { score: number; emoji?: string; evidence?: string }>;
    traits_to_improve?: Record<string, number | { score: number; emoji?: string; evidence?: string }>;
    nudges?: Array<{ text: string }>;
    sentiment?: Array<{ topic: string; sentiment: number }> | Record<string, number>;
    interests?: string[];
    source_platforms?: string[];
    [key: string]: unknown;
  };
}

/**
 * Social Profile Ingestion Entity (Supabase: public.user_social_profiles)
 */
export interface UserSocialProfileEntity {
  id: string;
  user_id: string;
  platform: 'linkedin' | 'twitter' | 'instagram' | 'facebook' | 'notion' | 'github' | 'website' | 'blog' | 'exa_web_search' | 'other';
  handle?: string;
  profile_url?: string;
  enrichment_tool?: 'exa' | 'apify_linkedin' | 'apify_twitter' | 'apify_instagram' | 'apify_facebook' | 'proxycurl' | 'firecrawl' | 'github_api' | 'tinyfish' | 'notion_oauth' | 'apify';
  consent_given: boolean;
  consent_given_at?: string;
  consent_revoked_at?: string;
  fetch_status: 'pending' | 'fetching' | 'completed' | 'partial' | 'failed' | 'revoked';
  raw_data?: Record<string, unknown>;
  extracted_insights?: {
    summary?: string;
    key_claims?: Array<{ claim: string; confidence: number }>;
    topics?: string[];
    raw_bio?: string;
    source_url?: string;
  };
  fetch_error?: string;
  last_fetched_at?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Longitudinal Interaction Event (Supabase: public.interaction_events)
 */
export interface InteractionEventEntity {
  id: string;
  user_id: string;
  event_type: 'message' | 'journal' | 'location' | 'calendar' | 'enrichment_discovery' | 'agent_nudge';
  event_data: Record<string, unknown>;
  source: 'messaging' | 'web_app' | 'external_api' | 'agent' | 'enrichment_engine';
  processed: boolean;
  processed_at?: string;
  created_at: string;
}

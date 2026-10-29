/**
 * Force V2 — Persistence & Feedback Contract
 * Defines how model updates, user corrections, feedback loops,
 * and safety events are persisted in the database.
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

import type { ExplicitFact, AgentInference, UnresolvedThread } from './context-schemas';

/**
 * Model Correction Payload submitted from the Reflection Screen (Step 5)
 */
export interface ModelCorrectionPayload {
  user_id: string;
  claim_id?: string;
  original_claim: string;
  user_correction: string;
  action: 'modify' | 'remove' | 'flag_inaccurate';
  corrected_at: string;
}

/**
 * Feedback capture after an agent interaction or reflection
 */
export interface InteractionFeedbackPayload {
  user_id: string;
  interaction_id?: string;
  feedback_type: 'accurate_and_helpful' | 'inaccurate' | 'too_intrusive' | 'poor_timing' | 'irrelevant';
  rating?: number; // 1 to 5
  user_comment?: string;
  created_at: string;
}

/**
 * Capture-time distress safety event payload (Step 3 Safety Net)
 * Deliberately captures minimal tracking data: timestamp and support note delivery.
 */
export interface DistressSafetyEventPayload {
  user_id: string;
  question_id: string;
  support_prompt_shown_at: string;
  resource_link_clicked?: boolean;
}

/**
 * Social enrichment fetch update payload (Step 4 Discovery Feed)
 */
export interface SocialProfileFetchUpdate {
  user_id: string;
  platform: string;
  status: 'pending' | 'fetching' | 'completed' | 'partial' | 'failed' | 'revoked';
  raw_data?: Record<string, unknown>;
  extracted_insights?: {
    summary?: string;
    key_claims?: Array<{ claim: string; confidence: number; source_url?: string }>;
    topics?: string[];
  };
  fetch_error?: string;
  retry_count?: number;
}

/**
 * Database update instruction for applying agent decisions to `user_context_model`
 */
export interface ContextModelMutation {
  user_id: string;
  add_explicit_facts?: ExplicitFact[];
  add_inferences?: AgentInference[];
  add_threads?: UnresolvedThread[];
  resolve_thread_ids?: string[];
  increment_model_version?: boolean;
  updated_personality_traits?: Record<string, unknown>;
}

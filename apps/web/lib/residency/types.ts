// apps/web/lib/residency/types.ts
// Canonical TypeScript contracts for Force Dhun Residency (V1.1 Specification)

export type ResidencyNodeCategory = 'person' | 'intent_problem' | 'theme_approach';

export type EdgeFamily = 'structural' | 'resident_connection';

export type StructuralEdgeType = 'person_has_intent' | 'intent_has_theme';

export type ResidentConnectionType =
  | 'shared_problem'
  | 'complementary_approach'
  | 'shared_exploration'
  | 'potential_contribution';

export type ResidencyEdgeType = StructuralEdgeType | ResidentConnectionType;

export interface ResidencyNextStep {
  text: string;
  why_it_may_help: string;
  status: 'suggested' | 'accepted' | 'edited' | 'dismissed';
}

export interface ResidencyContribution {
  can_offer: string[];
  seeking: string[];
}

export interface ResidencyProvenance {
  intent: string[];
  problem: string[];
  approach: string[];
  archetype?: string[];
  positive_traits?: string[];
  user_summary?: string[];
  top_traits_explanation?: string[];
  nudges?: string[];
  current_frontier?: string[];
  contribution?: string[];
}

export interface ResidencyWordAllocation {
  total_words: number;
  intent_pct: number;
  problem_pct: number;
  frontier_pct: number;
  dominant_category: 'intent' | 'problem' | 'open question';
  dominant_pct: number;
}

export interface ResidencyRawAnswer {
  text: string;
  audio_duration?: string;
  audio_url?: string;
}

export interface ResidencyTrait {
  trait: string;
  score: number;
  evidence?: string;
}

export interface ResidencyNudge {
  text: string;
}

export interface ResidencyIntentSnapshot {
  id: string;
  user_id: string;
  user_name?: string;
  avatar_url?: string;
  cohort_id: string;
  // Core synthesized intent fields
  intent: string;
  problem: string;
  approach: string[];
  // Onairos persona intelligence fields (replacing current_frontier and contribution)
  archetype?: string | null;
  positive_traits?: Record<string, number> | ResidencyTrait[];
  user_summary?: string | null;
  top_traits_explanation?: string | null;
  nudges?: ResidencyNudge[] | string[];
  onairos_metadata?: {
    total_items_analyzed?: number;
    items_sampled?: number;
    chunks_processed?: number;
    total_chunks?: number;
    coverage?: string;
    platform_breakdown?: Record<string, { summary?: string }>;
  };
  // Optional legacy fields for backwards compatibility
  current_frontier?: string;
  contribution?: ResidencyContribution;
  next_step?: ResidencyNextStep;
  provenance: ResidencyProvenance;
  status: 'draft' | 'pending_review' | 'user_approved' | 'rejected';
  sharing_consent: boolean;
  social_links?: Record<string, string>;
  public_findings?: Array<{
    id: string;
    label: string;
    text: string;
    sources: Array<{ title: string; url: string }>;
  }>;
  onairos_connected?: boolean;
  normalized_onairos_context?: Record<string, any> | any;
  raw_onairos_payload?: any;
  raw_answers?: Record<string, ResidencyRawAnswer>;
  word_allocation?: ResidencyWordAllocation;
  user_feedback?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ResidencyGraphNode {
  id: string;
  type: ResidencyNodeCategory;
  label: string;
  summary?: string;
  owner_user_id?: string;
  metadata?: {
    avatar_url?: string;
    social_links?: Record<string, string>;
    can_offer?: string[];
    seeking?: string[];
    openness?: number;
    conscientiousness?: number;
    cognitive_style?: string;
  };
}

export interface ResidencyGraphEdge {
  id: string;
  source: string;
  target: string;
  family: EdgeFamily;
  type: ResidencyEdgeType;
  strength?: number;
  why_connected?: string;
  what_to_explore?: string;
  evidence_refs?: string[];
  is_manually_verified?: boolean;
}

export interface ResidencyGraphData {
  cohort_id: string;
  nodes: ResidencyGraphNode[];
  edges: ResidencyGraphEdge[];
}

export interface ConnectionDetail {
  connection_id: string;
  relationship_type: ResidentConnectionType;
  source_resident: { id: string; name: string; avatar_url?: string };
  target_resident: { id: string; name: string; avatar_url?: string };
  why_connected: string;
  what_to_explore: string;
  evidence: {
    source_excerpt: string;
    target_excerpt: string;
  };
}

export interface OnairosNormalizedContext {
  positive_traits: Array<{ trait: string; score: number; evidence?: string }>;
  user_summary?: string;
  top_traits_explanation?: string;
  archetype?: string;
  nudges?: Array<{ text: string }> | string[];
  metadata?: {
    total_items_analyzed?: number;
    items_sampled?: number;
    chunks_processed?: number;
    total_chunks?: number;
    coverage?: string;
    platform_breakdown?: Record<string, { summary?: string }>;
  };
  source_platforms: string[];
  coverage_status: string;
}

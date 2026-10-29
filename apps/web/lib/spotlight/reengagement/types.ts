/**
 * Re-engagement Strategy Types
 * 
 * Types specific to the re-engagement insight generation system.
 */

import type { 
  Urgency, 
  ReengagementData, 
  SpotlightInsight,
  ReengagementStrategy as StrategyType 
} from '../types';

// ============================================
// STRATEGY INTERFACE
// ============================================

/**
 * Interface that all re-engagement strategies must implement.
 */
export interface ReengagementStrategyHandler {
  /** Unique identifier for the strategy */
  readonly type: StrategyType;
  
  /** Human-readable name for logging/debugging */
  readonly name: string;
  
  /** Priority mapping by urgency level (1 = highest priority) */
  readonly priorities: Record<Urgency, number>;
  
  /** 
   * Check if this strategy can generate an insight given current data.
   * Returns false if data requirements aren't met.
   */
  canGenerate(data: ReengagementData): boolean;
  
  /**
   * Generate the insight. Should only be called if canGenerate returns true.
   * Returns null if generation fails for any reason.
   */
  generate(data: ReengagementData): SpotlightInsight | null;
}

// ============================================
// STRATEGY SELECTION
// ============================================

export interface StrategySelectionResult {
  /** Selected strategy that generated the insight */
  strategy: StrategyType;
  /** The generated insight */
  insight: SpotlightInsight;
  /** Why this strategy was selected */
  reasoning: string;
  /** Alternative strategies that could have been used */
  alternatives: StrategyType[];
}

export interface StrategySelectionOptions {
  /** Urgency level determines which strategies are prioritized */
  urgency: Urgency;
  /** Previously shown strategy types to avoid repetition */
  recentlyShown?: StrategyType[];
  /** Maximum number of insights to generate */
  maxInsights?: number;
  /** Force specific strategy (for testing) */
  forceStrategy?: StrategyType;
}

// ============================================
// DATA FETCHER TYPES
// ============================================

export interface ReengagementDataInput {
  userId: string;
  lookbackDays?: number;
}

export interface WritingPatternRow {
  created_at: string;
  word_count: number;
}

export interface PositiveEntryRow {
  created_at: string;
  sentiment: number;
  topics: string[] | null;
}

export interface UserStatsRow {
  current_streak: number;
  longest_streak: number;
  total_entries: number;
  total_analyses: number;
  last_entry_at: string | null;
}

// ============================================
// INSIGHT TEMPLATES
// ============================================

export interface InsightTemplate {
  titleTemplate: string;
  bodyTemplate: string;
  icon: string;
  actionLabel?: string;
  actionTarget?: string;
}

export type TemplateVariables = Record<string, string | number>;

/**
 * Helper to fill in template variables.
 * e.g., fillTemplate("Hello {{name}}", { name: "World" }) => "Hello World"
 */
export function fillTemplate(template: string, vars: TemplateVariables): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key]?.toString() ?? `{{${key}}}`;
  });
}

// ============================================
// CONSTANTS
// ============================================

/** Minimum data requirements for each strategy */
export const STRATEGY_REQUIREMENTS = {
  low_effort_prompt: {
    minEntries: 0,
    minDaysInactive: 1,
  },
  pattern_trigger: {
    minEntries: 5, // Need enough data for pattern detection
    minDaysInactive: 2,
  },
  progress_reminder: {
    minEntries: 1,
    minUnanalyzed: 1,
  },
  achievement_highlight: {
    minEntries: 5,
    minStreak: 3,
  },
  nostalgia_hook: {
    minEntries: 10,
    minTopics: 1,
  },
  gamification_nudge: {
    minEntries: 1,
  },
  mood_callback: {
    minEntries: 5,
    requiresPositiveEntry: true,
  },
} as const;

/** Days to consider an insight "recently shown" */
export const RECENTLY_SHOWN_DAYS = 7;

/** Maximum insights to return from strategy selector */
export const DEFAULT_MAX_INSIGHTS = 2;

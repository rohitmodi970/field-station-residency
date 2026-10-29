/**
 * AI Spotlight Activity Score Algorithm V2 - Constants
 * 
 * All algorithm parameters are centralized here for easy tuning.
 */

// ============================================
// EXPONENTIAL DECAY PARAMETERS
// ============================================

/** 
 * Decay constant (λ) for time-weighted scoring.
 * λ = 0.1 gives half-life ≈ 7 days
 * decay(t) = e^(-λ × t)
 */
export const DECAY_LAMBDA = 0.1;

/** Expected entries per week for normalization */
export const EXPECTED_ENTRIES_PER_WEEK = 3;

/** Maximum days to look back for activity */
export const MAX_LOOKBACK_DAYS = 30;

// ============================================
// CORE METRIC WEIGHTS
// ============================================

/** Weights for final raw score calculation */
export const METRIC_WEIGHTS = {
  baseActivity: 0.35,
  engagementDepth: 0.35,
  consistencyIndex: 0.30,
} as const;

/** Weights for engagement depth components */
export const ENGAGEMENT_WEIGHTS = {
  analysisRate: 0.50,
  wordDepth: 0.35,
  editEffort: 0.15,
} as const;

/** Weights for consistency index components */
export const CONSISTENCY_WEIGHTS = {
  activeDaysCoverage: 0.60,
  streakHealth: 0.40,
} as const;

// ============================================
// NORMALIZATION THRESHOLDS
// ============================================

/** Word count for full wordDepth score (1.0) */
export const WORD_DEPTH_TARGET = 300;

/** Edit count for full editEffort score (1.0) */
export const EDIT_EFFORT_TARGET = 3;

// ============================================
// MOMENTUM PARAMETERS
// ============================================

/** Momentum multiplier bounds */
export const MOMENTUM = {
  min: 0.8,
  max: 1.2,
  velocityWeight: 0.6,
  accelerationWeight: 0.4,
  scaleFactor: 0.2,
} as const;

/** Thresholds for trend detection */
export const TREND_THRESHOLDS = {
  rising: 0.15,
  declining: -0.15,
} as const;

// ============================================
// RECENCY BOOST TIERS
// ============================================

/** Recency boost values by hours since last activity */
export const RECENCY_BOOSTS = {
  tier1_hours: 24,
  tier1_boost: 0.10,
  tier2_hours: 48,
  tier2_boost: 0.05,
  tier3_hours: 72,
  tier3_boost: 0.02,
  default_boost: 0.00,
} as const;

// ============================================
// STREAK BONUS
// ============================================

/** Streak bonus multiplier for log2 scaling */
export const STREAK_BONUS_MULTIPLIER = 0.05;

// ============================================
// MICRO-SIGNAL ADJUSTMENTS
// ============================================

export const MICRO_SIGNALS = {
  wordIncrease: {
    threshold: 1.2, // 20% increase
    adjustment: 0.02,
  },
  wordDecrease: {
    threshold: 0.8, // 20% decrease
    adjustment: -0.01,
  },
  analysisIncrease: {
    threshold: 0.2, // 20% rate increase
    adjustment: 0.03,
  },
  analysisDecrease: {
    threshold: 0.2, // 20% rate decrease
    adjustment: -0.02,
  },
  timeShift: {
    hoursThreshold: 4, // 4 hour shift
    adjustment: 0.01,
  },
} as const;

/** Maximum total micro-signal adjustment */
export const MAX_MICRO_SIGNAL_ADJUST = 0.05;

// ============================================
// BLEND RATIO THRESHOLDS
// ============================================

/** Score thresholds for blend transitions */
export const BLEND_THRESHOLDS = {
  level1: 0.25, // 100% waitlist
  level2: 0.50, // 75/25
  level3: 0.70, // 50/50
  level4: 0.85, // 25/75
  // above 0.85: 0/100
} as const;

/** Days inactive thresholds for re-engagement urgency */
export const REENGAGEMENT_THRESHOLDS = {
  mild: 3,      // 3-7 days: mild
  moderate: 7,  // 7-14 days: moderate
  critical: 14, // 14+ days: critical
} as const;

// ============================================
// RE-ENGAGEMENT STRATEGY PRIORITIES
// ============================================

export const REENGAGEMENT_PRIORITIES = {
  MILD: [
    'low_effort_prompt',
    'pattern_trigger',
    'progress_reminder',
  ],
  MODERATE: [
    'achievement_highlight',
    'nostalgia_hook',
    'gamification_nudge',
  ],
  CRITICAL: [
    'mood_callback',
    'achievement_highlight',
    'low_effort_prompt',
  ],
} as const;

// ============================================
// CACHE SETTINGS
// ============================================

/** Default cache TTL in milliseconds (6 hours) */
export const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Minimum time between cache refreshes (5 minutes) */
export const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// ============================================
// MILESTONE VALUES
// ============================================

export const ENTRY_MILESTONES = [10, 25, 50, 100, 250, 500, 1000] as const;
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;

// ============================================
// ALIASES FOR BACKWARDS COMPATIBILITY
// ============================================

/** Component weights (alias for METRIC_WEIGHTS) */
export const COMPONENT_WEIGHTS = {
  BASE_ACTIVITY: METRIC_WEIGHTS.baseActivity,
  ENGAGEMENT_DEPTH: METRIC_WEIGHTS.engagementDepth,
  CONSISTENCY_INDEX: METRIC_WEIGHTS.consistencyIndex,
} as const;

/** Score bounds */
export const SCORE_BOUNDS = {
  MIN: 0,
  MAX: 1,
} as const;

/** Urgency thresholds based on days inactive and score */
export const URGENCY_THRESHOLDS = {
  MILD_DAYS: REENGAGEMENT_THRESHOLDS.mild,
  MODERATE_DAYS: REENGAGEMENT_THRESHOLDS.moderate,
  CRITICAL_DAYS: REENGAGEMENT_THRESHOLDS.critical,
  MILD_SCORE: 0.4,
  MODERATE_SCORE: 0.25,
  CRITICAL_SCORE: 0.1,
} as const;

/** Cache configuration */
export const CACHE_CONFIG = {
  TTL_MS: DEFAULT_CACHE_TTL_MS,
  MIN_REFRESH_MS: MIN_REFRESH_INTERVAL_MS,
} as const;

/** Decay constants */
export const DECAY_CONSTANTS = {
  LAMBDA: DECAY_LAMBDA,
  HALF_LIFE_DAYS: Math.log(2) / DECAY_LAMBDA, // ~6.93 days
} as const;

/** Re-engagement strategies by urgency */
export const REENGAGEMENT_STRATEGIES = {
  MILD: REENGAGEMENT_PRIORITIES.MILD,
  MODERATE: REENGAGEMENT_PRIORITIES.MODERATE,
  CRITICAL: REENGAGEMENT_PRIORITIES.CRITICAL,
} as const;

/**
 * Spotlight - AI-Powered Personalization Engine
 * 
 * This module calculates user activity scores and determines the optimal
 * blend of content sources (waitlist, journal, re-engagement) for each user.
 * 
 * @example
 * ```ts
 * import { calculateActivityScore, validateActivityData } from '@/lib/spotlight';
 * 
 * const data = validateActivityData({
 *   journalCount: 15,
 *   analysisCount: 10,
 *   currentStreak: 5,
 *   daysSinceLastEntry: 1,
 *   // ... other metrics
 * });
 * 
 * const result = calculateActivityScore(data);
 * console.log(result.score); // 0.65
 * console.log(result.blendRatios); // { waitlist: 0.15, journal: 0.75, reengagement: 0.10 }
 * ```
 */

// Main calculator
export {
  calculateActivityScore,
  hasSignificantChange,
  calculateScoreDelta,
  getScoreInterpretation,
  createDefaultInput,
  validateInput,
} from './activityScore';

// Blend logic
export {
  calculateBlendRatios,
  determineUrgency,
  selectReengagementStrategies,
  normalizeBlendRatios,
  getBlendDescription,
} from './blend';

// Types
export type {
  ActivityScoreResult,
  ActivityScoreInput,
  ScoreBreakdown,
  Trend,
  Urgency,
  BlendRatios,
  JournalEntry,
  WaitlistData,
  UserOnboardingData,
  ReengagementData,
  SpotlightInsight,
  SpotlightCacheData,
  ActivitySnapshot,
} from './types';

// Constants (for configuration/testing)
export {
  COMPONENT_WEIGHTS,
  SCORE_BOUNDS,
  BLEND_THRESHOLDS,
  URGENCY_THRESHOLDS,
  DECAY_CONSTANTS,
  CACHE_CONFIG,
  REENGAGEMENT_STRATEGIES,
} from './constants';

// Individual metrics (for testing/debugging)
export { calculateBaseActivity } from './metrics/baseActivity';
export { calculateEngagementDepth } from './metrics/engagementDepth';
export { calculateConsistencyIndex } from './metrics/consistencyIndex';

// Individual modifiers (for testing/debugging)
export { calculateMomentum } from './modifiers/momentum';
export { calculateRecencyBoost } from './modifiers/recency';
export { calculateStreakBonus } from './modifiers/streak';
export { calculateMicroSignals } from './modifiers/microSignals';

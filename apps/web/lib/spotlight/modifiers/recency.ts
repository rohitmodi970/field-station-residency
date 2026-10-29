/**
 * Recency Boost Calculator
 * 
 * Provides a score boost based on hours since last activity.
 * Encourages recent engagement without punishing brief breaks.
 * 
 * Tiers:
 * - ≤24h: +0.10
 * - ≤48h: +0.05
 * - ≤72h: +0.02
 * - >72h: +0.00
 */

import { RECENCY_BOOSTS } from '../constants';

export interface RecencyBoostResult {
  /** Recency boost value (0-0.10) */
  boost: number;
  /** Hours since last activity */
  hoursSinceActivity: number;
  /** Which tier the user falls into */
  tier: 'tier1' | 'tier2' | 'tier3' | 'none';
}

/**
 * Calculate recency boost based on last activity time.
 * 
 * @param lastActivityAt - Timestamp of last journal entry or analysis
 * @param now - Reference time (defaults to now)
 * @returns RecencyBoostResult with boost value and tier
 */
export function calculateRecencyBoost(
  lastActivityAt: Date | null | undefined,
  now: Date = new Date()
): RecencyBoostResult {
  // No activity = no boost
  if (!lastActivityAt) {
    return {
      boost: RECENCY_BOOSTS.default_boost,
      hoursSinceActivity: Infinity,
      tier: 'none',
    };
  }

  const hoursSinceActivity = (now.getTime() - lastActivityAt.getTime()) / (1000 * 60 * 60);

  // Determine tier and boost
  if (hoursSinceActivity <= RECENCY_BOOSTS.tier1_hours) {
    return {
      boost: RECENCY_BOOSTS.tier1_boost,
      hoursSinceActivity,
      tier: 'tier1',
    };
  } else if (hoursSinceActivity <= RECENCY_BOOSTS.tier2_hours) {
    return {
      boost: RECENCY_BOOSTS.tier2_boost,
      hoursSinceActivity,
      tier: 'tier2',
    };
  } else if (hoursSinceActivity <= RECENCY_BOOSTS.tier3_hours) {
    return {
      boost: RECENCY_BOOSTS.tier3_boost,
      hoursSinceActivity,
      tier: 'tier3',
    };
  }

  return {
    boost: RECENCY_BOOSTS.default_boost,
    hoursSinceActivity,
    tier: 'none',
  };
}

/**
 * Get the most recent activity timestamp from multiple sources.
 * 
 * @param lastEntryAt - Last journal entry timestamp
 * @param lastAnalysisAt - Last analysis request timestamp
 * @returns Most recent timestamp, or null if none
 */
export function getMostRecentActivity(
  lastEntryAt: Date | null | undefined,
  lastAnalysisAt: Date | null | undefined
): Date | null {
  if (!lastEntryAt && !lastAnalysisAt) return null;
  if (!lastEntryAt) return lastAnalysisAt ?? null;
  if (!lastAnalysisAt) return lastEntryAt;
  
  return lastEntryAt > lastAnalysisAt ? lastEntryAt : lastAnalysisAt;
}

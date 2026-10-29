/**
 * Activity Score Calculator
 * 
 * Main entry point for calculating user activity scores.
 * Combines base metrics and modifiers into a final score.
 */

import {
  ActivityScoreResult,
  ScoreBreakdown,
  ActivityScoreInput,
  Trend,
  Urgency,
  JournalEntry,
  ActivitySnapshot,
} from './types';
import {
  METRIC_WEIGHTS,
  SCORE_BOUNDS,
} from './constants';
import { calculateBaseActivity } from './metrics/baseActivity';
import { calculateEngagementDepth } from './metrics/engagementDepth';
import { calculateConsistencyIndex } from './metrics/consistencyIndex';
import { calculateMomentum } from './modifiers/momentum';
import { calculateRecencyBoost } from './modifiers/recency';
import { calculateStreakBonus } from './modifiers/streak';
import { calculateMicroSignals } from './modifiers/microSignals';
import { determineUrgency } from './blend';

/**
 * Calculate the complete activity score for a user
 */
export function calculateActivityScore(
  input: ActivityScoreInput
): ActivityScoreResult {
  const startTime = Date.now();
  const now = new Date();
  
  const { 
    journals, 
    currentStreak, 
    longestStreak, 
    accountAgeDays,
  } = input;

  // Calculate base metrics
  const baseActivityResult = calculateBaseActivity(journals, accountAgeDays, now);
  const engagementResult = calculateEngagementDepth(journals);
  const consistencyResult = calculateConsistencyIndex(
    journals, 
    currentStreak, 
    longestStreak, 
    accountAgeDays
  );

  // Calculate modifiers
  const snapshots = buildSnapshots(journals, accountAgeDays);
  const momentumResult = calculateMomentum(snapshots);
  
  const lastEntryAt = journals.length > 0 && journals[0]
    ? journals.reduce((latest, j) => j.createdAt > latest ? j.createdAt : latest, journals[0].createdAt)
    : null;
  const recencyResult = calculateRecencyBoost(lastEntryAt, now);
  
  const streakResult = calculateStreakBonus(currentStreak, longestStreak);
  
  // Split journals for micro-signals
  const recentJournals = journals.filter(j => {
    const daysAgo = (now.getTime() - j.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo <= 7;
  });
  const baselineJournals = journals.filter(j => {
    const daysAgo = (now.getTime() - j.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo > 7 && daysAgo <= 30;
  });
  const microSignalsResult = calculateMicroSignals(recentJournals, baselineJournals);

  // Calculate weighted base score
  const rawScore = 
    (baseActivityResult.score * METRIC_WEIGHTS.baseActivity) +
    (engagementResult.score * METRIC_WEIGHTS.engagementDepth) +
    (consistencyResult.score * METRIC_WEIGHTS.consistencyIndex);

  // Apply modifiers
  let adjustedScore = rawScore * momentumResult.multiplier;
  adjustedScore += recencyResult.boost;
  adjustedScore += streakResult.bonus;
  adjustedScore += microSignalsResult.adjustment;

  // Clamp to valid range
  const finalScore = Math.max(
    SCORE_BOUNDS.MIN,
    Math.min(SCORE_BOUNDS.MAX, adjustedScore)
  );

  // Round to 2 decimal places
  const score = Math.round(finalScore * 100) / 100;

  // Determine trend from momentum
  const trend: Trend = momentumResult.trend;

  // Calculate days inactive
  const daysInactive = lastEntryAt 
    ? Math.floor((now.getTime() - lastEntryAt.getTime()) / (1000 * 60 * 60 * 24))
    : accountAgeDays;

  // Determine urgency
  const urgency: Urgency = determineUrgency(score, trend, daysInactive);

  // Build breakdown
  const breakdown: ScoreBreakdown = {
    baseActivity: Math.round(baseActivityResult.score * 100) / 100,
    engagementDepth: Math.round(engagementResult.score * 100) / 100,
    consistencyIndex: Math.round(consistencyResult.score * 100) / 100,
    momentumMultiplier: Math.round(momentumResult.multiplier * 100) / 100,
    recencyBoost: Math.round(recencyResult.boost * 100) / 100,
    streakBonus: Math.round(streakResult.bonus * 100) / 100,
    microSignalAdjust: Math.round(microSignalsResult.adjustment * 100) / 100,
    rawScore: Math.round(rawScore * 100) / 100,
    adjustedScore: Math.round(adjustedScore * 100) / 100,
  };

  const computationMs = Date.now() - startTime;

  return {
    score,
    breakdown,
    trend,
    urgency,
    calculatedAt: now,
    computationMs,
  };
}

/**
 * Build activity snapshots from journals for momentum calculation
 */
function buildSnapshots(journals: JournalEntry[], accountAgeDays: number): ActivitySnapshot[] {
  const now = new Date();
  const snapshots: ActivitySnapshot[] = [];
  const maxDays = Math.min(accountAgeDays, 30);

  for (let daysAgo = 0; daysAgo < maxDays; daysAgo++) {
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    
    // Count journals for this day
    const dayJournals = journals.filter(j => {
      const jDateStr = j.createdAt.toISOString().split('T')[0];
      return jDateStr === dateStr;
    });

    const dayAnalyses = dayJournals.filter(j => j.hasAnalysis).length;

    // Simple score based on activity
    const dayScore = Math.min(1, (dayJournals.length * 0.5) + (dayAnalyses * 0.3));

    snapshots.push({
      date,
      score: dayScore,
      journalCount: dayJournals.length,
      analysisCount: dayAnalyses,
    });
  }

  return snapshots;
}

/**
 * Quick score calculation for cache invalidation checks
 * Returns true if score has likely changed significantly
 */
export function hasSignificantChange(
  oldInput: ActivityScoreInput,
  newInput: ActivityScoreInput
): boolean {
  // Check for obvious changes
  if (newInput.journals.length !== oldInput.journals.length) {
    return true;
  }
  if (newInput.currentStreak !== oldInput.currentStreak) {
    return true;
  }

  // Check for new journals
  const oldNewestId = oldInput.journals[0]?.id;
  const newNewestId = newInput.journals[0]?.id;
  if (oldNewestId !== newNewestId) {
    return true;
  }

  return false;
}

/**
 * Calculate score delta for comparison
 */
export function calculateScoreDelta(
  oldResult: ActivityScoreResult,
  newResult: ActivityScoreResult
): {
  delta: number;
  percentChange: number;
  trendChanged: boolean;
  urgencyChanged: boolean;
} {
  const delta = newResult.score - oldResult.score;
  const percentChange = oldResult.score > 0 
    ? (delta / oldResult.score) * 100 
    : 0;

  return {
    delta: Math.round(delta * 100) / 100,
    percentChange: Math.round(percentChange * 10) / 10,
    trendChanged: newResult.trend !== oldResult.trend,
    urgencyChanged: newResult.urgency !== oldResult.urgency,
  };
}

/**
 * Get score interpretation for display
 */
export function getScoreInterpretation(score: number): {
  level: 'new' | 'growing' | 'active' | 'power';
  label: string;
  description: string;
} {
  if (score < 0.2) {
    return {
      level: 'new',
      label: 'Getting Started',
      description: 'Just beginning your journaling journey',
    };
  }
  if (score < 0.4) {
    return {
      level: 'growing',
      label: 'Building Momentum',
      description: 'Developing a journaling habit',
    };
  }
  if (score < 0.7) {
    return {
      level: 'active',
      label: 'Active Writer',
      description: 'Regular journaling practice established',
    };
  }
  return {
    level: 'power',
    label: 'Power User',
    description: 'Highly engaged with consistent practice',
  };
}

/**
 * Create default input for new users
 */
export function createDefaultInput(accountAgeDays: number = 0): ActivityScoreInput {
  return {
    journals: [],
    currentStreak: 0,
    longestStreak: 0,
    accountAgeDays,
  };
}

/**
 * Validate and sanitize input
 */
export function validateInput(input: Partial<ActivityScoreInput>): ActivityScoreInput {
  return {
    journals: input.journals ?? [],
    onboarding: input.onboarding,
    waitlist: input.waitlist,
    sessions: input.sessions,
    currentStreak: Math.max(0, input.currentStreak ?? 0),
    longestStreak: Math.max(0, input.longestStreak ?? 0),
    accountAgeDays: Math.max(0, input.accountAgeDays ?? 0),
  };
}

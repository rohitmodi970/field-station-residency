/**
 * Streak Bonus Calculator
 * 
 * Provides logarithmic bonus for maintaining writing streaks.
 * Uses log2 scaling to reward consistency without overpowering other factors.
 * 
 * Formula: streakBonus = 0.05 × log₂(streak + 1)
 */

import { STREAK_BONUS_MULTIPLIER, STREAK_MILESTONES } from '../constants';

export interface StreakBonusResult {
  /** Streak bonus value */
  bonus: number;
  /** Current streak length in days */
  currentStreak: number;
  /** User's peak/longest streak */
  longestStreak: number;
  /** Next milestone to achieve */
  nextMilestone: number | null;
  /** Days until next milestone */
  daysToMilestone: number | null;
  /** Whether user just hit a milestone */
  justHitMilestone: boolean;
}

/**
 * Calculate streak bonus using logarithmic scaling.
 * 
 * @param currentStreak - Current consecutive days of writing
 * @param longestStreak - User's all-time longest streak
 * @returns StreakBonusResult with bonus and milestone info
 */
export function calculateStreakBonus(
  currentStreak: number,
  longestStreak: number = 0
): StreakBonusResult {
  // Ensure non-negative values
  const streak = Math.max(0, currentStreak);
  const peak = Math.max(0, longestStreak);

  // Calculate logarithmic bonus: 0.05 × log₂(streak + 1)
  // log₂(1) = 0, so 0-day streak gives 0 bonus
  // log₂(2) = 1, so 1-day streak gives 0.05 bonus
  // log₂(8) = 3, so 7-day streak gives 0.15 bonus
  const bonus = STREAK_BONUS_MULTIPLIER * Math.log2(streak + 1);

  // Find next milestone
  const nextMilestone = STREAK_MILESTONES.find(m => m > streak) ?? null;
  const daysToMilestone = nextMilestone !== null ? nextMilestone - streak : null;

  // Check if user just hit a milestone
  const streakMilestones: readonly number[] = STREAK_MILESTONES;
  const justHitMilestone = streakMilestones.includes(streak) && streak > 0;

  return {
    bonus,
    currentStreak: streak,
    longestStreak: peak,
    nextMilestone,
    daysToMilestone,
    justHitMilestone,
  };
}

/**
 * Get motivational message based on streak status.
 */
export function getStreakMessage(result: StreakBonusResult): string | null {
  if (result.justHitMilestone) {
    return `${result.currentStreak}-day streak milestone!`;
  }
  
  if (result.daysToMilestone === 1) {
    return `Almost there! 1 more day to ${result.nextMilestone}-day streak`;
  }
  
  if (result.daysToMilestone && result.daysToMilestone <= 3) {
    return `${result.daysToMilestone} days to ${result.nextMilestone}-day milestone`;
  }
  
  if (result.currentStreak > 0 && result.currentStreak === result.longestStreak) {
    return `You're at your longest streak!`;
  }
  
  return null;
}

/**
 * Calculate streak recovery potential.
 * Returns how impactful getting back on track would be.
 */
export function getStreakRecoveryImpact(
  daysInactive: number,
  previousStreak: number
): 'high' | 'medium' | 'low' {
  // Recently broke a long streak = high impact recovery
  if (daysInactive <= 3 && previousStreak >= 7) {
    return 'high';
  }
  
  // Recently broke any streak = medium impact
  if (daysInactive <= 7 && previousStreak >= 3) {
    return 'medium';
  }
  
  return 'low';
}

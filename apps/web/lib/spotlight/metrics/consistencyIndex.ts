/**
 * Consistency Index Calculator
 * 
 * Measures habit formation through:
 * - activeDaysCoverage: unique active days / total days
 * - streakHealth: current streak / longest streak
 */

import { CONSISTENCY_WEIGHTS, MAX_LOOKBACK_DAYS } from '../constants';
import type { JournalEntry } from '../types';

export interface ConsistencyIndexResult {
  /** Final consistency index score (0-1) */
  score: number;
  /** Ratio of days with entries vs total days */
  activeDaysCoverage: number;
  /** Current streak health relative to peak */
  streakHealth: number;
  /** Number of unique days with entries */
  uniqueActiveDays: number;
}

/**
 * Get unique dates (YYYY-MM-DD) from journal entries.
 */
function getUniqueDates(journals: JournalEntry[]): Set<string> {
  const dates = new Set<string>();
  for (const journal of journals) {
    const parts = journal.createdAt.toISOString().split('T');
    const dateStr = parts[0];
    if (dateStr) {
      dates.add(dateStr);
    }
  }
  return dates;
}

/**
 * Calculate consistency index from journal entries and streak data.
 * 
 * Formula:
 * consistencyIndex = 
 *   (activeDaysCoverage × 0.60) +
 *   (streakHealth × 0.40)
 * 
 * @param journals - Array of journal entries
 * @param currentStreak - User's current writing streak in days
 * @param longestStreak - User's all-time longest streak
 * @param accountAgeDays - Days since account creation
 * @returns ConsistencyIndexResult with score and breakdown
 */
export function calculateConsistencyIndex(
  journals: JournalEntry[],
  currentStreak: number,
  longestStreak: number,
  accountAgeDays: number
): ConsistencyIndexResult {
  // Calculate active days coverage
  const uniqueDates = getUniqueDates(journals);
  const uniqueActiveDays = uniqueDates.size;
  
  // Use min of account age or max lookback for normalization
  const totalDays = Math.max(1, Math.min(accountAgeDays, MAX_LOOKBACK_DAYS));
  const activeDaysCoverage = Math.min(1, uniqueActiveDays / totalDays);
  
  // Calculate streak health (current vs peak)
  // Handle case where longest streak is 0
  const streakHealth = longestStreak > 0 
    ? Math.min(1, currentStreak / longestStreak)
    : currentStreak > 0 ? 1 : 0;
  
  // Calculate weighted score
  const score = 
    (activeDaysCoverage * CONSISTENCY_WEIGHTS.activeDaysCoverage) +
    (streakHealth * CONSISTENCY_WEIGHTS.streakHealth);
  
  return {
    score: Math.min(1, Math.max(0, score)),
    activeDaysCoverage,
    streakHealth,
    uniqueActiveDays,
  };
}

/**
 * Calculate current streak from journal entries.
 * A streak requires entries on consecutive days.
 */
export function calculateCurrentStreak(
  journals: JournalEntry[],
  now: Date = new Date()
): number {
  if (journals.length === 0) return 0;
  
  // Get unique dates sorted descending
  const uniqueDates = Array.from(getUniqueDates(journals)).sort().reverse();
  
  if (uniqueDates.length === 0) return 0;
  
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  
  // Streak must include today or yesterday
  const mostRecent = uniqueDates[0];
  if (mostRecent !== today && mostRecent !== yesterday) {
    return 0;
  }
  
  // Count consecutive days
  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const currentDate = uniqueDates[i - 1];
    const previousDate = uniqueDates[i];
    
    if (!currentDate || !previousDate) break;
    
    const current = new Date(currentDate);
    const previous = new Date(previousDate);
    
    const diffDays = Math.round(
      (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

/**
 * Get entries per week for a time period.
 */
export function getEntriesPerWeek(
  journals: JournalEntry[],
  days: number,
  now: Date = new Date()
): number {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const recentJournals = journals.filter(j => j.createdAt >= cutoff);
  const weeks = days / 7;
  return weeks > 0 ? recentJournals.length / weeks : 0;
}

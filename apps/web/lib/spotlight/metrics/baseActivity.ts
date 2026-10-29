/**
 * Base Activity Score Calculator
 * 
 * Uses exponential decay to weight recent entries more heavily.
 * decay(days) = e^(-λ × days) where λ = 0.1 (half-life ≈ 7 days)
 */

import { DECAY_LAMBDA, EXPECTED_ENTRIES_PER_WEEK, MAX_LOOKBACK_DAYS } from '../constants';
import type { JournalEntry } from '../types';

/**
 * Calculate exponential decay factor for a given number of days ago.
 * @param daysAgo - Number of days since the entry
 * @returns Decay factor between 0 and 1
 */
export function calculateDecay(daysAgo: number): number {
  return Math.exp(-DECAY_LAMBDA * daysAgo);
}

/**
 * Calculate days difference between a date and now.
 */
function getDaysAgo(entryDate: Date, now: Date = new Date()): number {
  const diffMs = now.getTime() - entryDate.getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
}

export interface BaseActivityResult {
  /** Final base activity score (0-1) */
  score: number;
  /** Sum of decayed entry values */
  decayedSum: number;
  /** Expected entries for normalization */
  expectedEntries: number;
  /** Entries within lookback period */
  entriesInPeriod: number;
}

/**
 * Calculate base activity score using time-decayed entry frequency.
 * 
 * Formula: baseActivity = Σ(decay(daysAgo)) / expectedEntries
 * 
 * @param journals - Array of journal entries
 * @param accountAgeDays - Days since account creation
 * @param now - Reference date for calculations (defaults to now)
 * @returns BaseActivityResult with score and breakdown
 */
export function calculateBaseActivity(
  journals: JournalEntry[],
  accountAgeDays: number,
  now: Date = new Date()
): BaseActivityResult {
  // Filter to entries within lookback period
  const lookbackDays = Math.min(accountAgeDays, MAX_LOOKBACK_DAYS);
  const cutoffDate = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  
  const recentJournals = journals.filter(j => j.createdAt >= cutoffDate);
  
  // Calculate sum of decayed entry values
  let decayedSum = 0;
  for (const journal of recentJournals) {
    const daysAgo = getDaysAgo(journal.createdAt, now);
    decayedSum += calculateDecay(daysAgo);
  }
  
  // Calculate expected entries based on time period
  // If account is newer than lookback, adjust expectations
  const weeksInPeriod = lookbackDays / 7;
  const expectedEntries = Math.max(1, weeksInPeriod * EXPECTED_ENTRIES_PER_WEEK);
  
  // Normalize score to 0-1 range
  const rawScore = decayedSum / expectedEntries;
  const score = Math.min(1, Math.max(0, rawScore));
  
  return {
    score,
    decayedSum,
    expectedEntries,
    entriesInPeriod: recentJournals.length,
  };
}

/**
 * Get decay factor at specific day intervals (for debugging/visualization).
 */
export function getDecayTable(): Record<number, number> {
  return {
    0: calculateDecay(0),   // 1.000
    1: calculateDecay(1),   // 0.905
    3: calculateDecay(3),   // 0.741
    7: calculateDecay(7),   // 0.497
    14: calculateDecay(14), // 0.247
    30: calculateDecay(30), // 0.050
  };
}

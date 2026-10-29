/**
 * Engagement Depth Score Calculator
 * 
 * Measures quality and feature adoption:
 * - analysisRate: How often user requests AI analysis
 * - wordDepth: Normalized word count (300 words = 1.0)
 * - editEffort: Shows user cares about quality
 */

import { ENGAGEMENT_WEIGHTS, WORD_DEPTH_TARGET, EDIT_EFFORT_TARGET } from '../constants';
import type { JournalEntry } from '../types';

export interface EngagementDepthResult {
  /** Final engagement depth score (0-1) */
  score: number;
  /** Percentage of entries with AI analysis */
  analysisRate: number;
  /** Normalized average word count (capped at 1) */
  wordDepth: number;
  /** Normalized average edit count (capped at 1) */
  editEffort: number;
}

/**
 * Calculate engagement depth score from journal entries.
 * 
 * Formula:
 * engagementDepth = 
 *   (analysisRate × 0.50) +
 *   (wordDepth × 0.35) +
 *   (editEffort × 0.15)
 * 
 * @param journals - Array of journal entries with word counts and analysis flags
 * @returns EngagementDepthResult with score and component breakdown
 */
export function calculateEngagementDepth(journals: JournalEntry[]): EngagementDepthResult {
  if (journals.length === 0) {
    return {
      score: 0,
      analysisRate: 0,
      wordDepth: 0,
      editEffort: 0,
    };
  }
  
  // Calculate analysis rate (% of entries with AI analysis)
  const entriesWithAnalysis = journals.filter(j => j.hasAnalysis).length;
  const analysisRate = entriesWithAnalysis / journals.length;
  
  // Calculate word depth (avg words / target, capped at 1)
  const totalWords = journals.reduce((sum, j) => sum + j.wordCount, 0);
  const avgWords = totalWords / journals.length;
  const wordDepth = Math.min(1, avgWords / WORD_DEPTH_TARGET);
  
  // Calculate edit effort (avg edits / target, capped at 1)
  const totalEdits = journals.reduce((sum, j) => sum + (j.editCount ?? 0), 0);
  const avgEdits = totalEdits / journals.length;
  const editEffort = Math.min(1, avgEdits / EDIT_EFFORT_TARGET);
  
  // Calculate weighted score
  const score = 
    (analysisRate * ENGAGEMENT_WEIGHTS.analysisRate) +
    (wordDepth * ENGAGEMENT_WEIGHTS.wordDepth) +
    (editEffort * ENGAGEMENT_WEIGHTS.editEffort);
  
  return {
    score: Math.min(1, Math.max(0, score)),
    analysisRate,
    wordDepth,
    editEffort,
  };
}

/**
 * Get analysis rate for recent entries only.
 * Useful for micro-signal detection.
 */
export function getRecentAnalysisRate(
  journals: JournalEntry[],
  days: number,
  now: Date = new Date()
): number {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const recentJournals = journals.filter(j => j.createdAt >= cutoff);
  
  if (recentJournals.length === 0) return 0;
  
  const withAnalysis = recentJournals.filter(j => j.hasAnalysis).length;
  return withAnalysis / recentJournals.length;
}

/**
 * Get average word count for recent entries only.
 * Useful for micro-signal detection.
 */
export function getRecentAvgWordCount(
  journals: JournalEntry[],
  days: number,
  now: Date = new Date()
): number {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const recentJournals = journals.filter(j => j.createdAt >= cutoff);
  
  if (recentJournals.length === 0) return 0;
  
  const totalWords = recentJournals.reduce((sum, j) => sum + j.wordCount, 0);
  return totalWords / recentJournals.length;
}

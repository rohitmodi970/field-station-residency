/**
 * Micro-Signal Adjustments Calculator
 * 
 * Detects subtle behavioral changes to catch engagement shifts early:
 * - Word count changes (±20%)
 * - Analysis rate changes (±20%)
 * - Writing time shifts (4+ hours)
 * 
 * Total adjustment clamped to ±0.05
 */

import { MICRO_SIGNALS, MAX_MICRO_SIGNAL_ADJUST } from '../constants';
import type { JournalEntry } from '../types';

export interface MicroSignalsResult {
  /** Total micro-signal adjustment (-0.05 to +0.05) */
  adjustment: number;
  /** Individual signal contributions */
  signals: {
    wordCountSignal: number;
    analysisRateSignal: number;
    timeShiftSignal: number;
  };
  /** Detected behavioral changes */
  changes: string[];
}

/**
 * Calculate micro-signal adjustments by comparing recent behavior to baseline.
 * 
 * @param recentJournals - Journals from last 7 days
 * @param baselineJournals - Journals from 7-30 days ago
 * @returns MicroSignalsResult with total adjustment and breakdown
 */
export function calculateMicroSignals(
  recentJournals: JournalEntry[],
  baselineJournals: JournalEntry[]
): MicroSignalsResult {
  const changes: string[] = [];
  let totalAdjustment = 0;

  // Need data for comparison
  if (recentJournals.length === 0 || baselineJournals.length === 0) {
    return {
      adjustment: 0,
      signals: { wordCountSignal: 0, analysisRateSignal: 0, timeShiftSignal: 0 },
      changes: [],
    };
  }

  // 1. Word count signal
  const recentAvgWords = avgWordCount(recentJournals);
  const baselineAvgWords = avgWordCount(baselineJournals);
  const wordCountSignal = calculateWordCountSignal(recentAvgWords, baselineAvgWords, changes);
  totalAdjustment += wordCountSignal;

  // 2. Analysis rate signal
  const recentAnalysisRate = analysisRate(recentJournals);
  const baselineAnalysisRate = analysisRate(baselineJournals);
  const analysisRateSignal = calculateAnalysisRateSignal(
    recentAnalysisRate, 
    baselineAnalysisRate,
    changes
  );
  totalAdjustment += analysisRateSignal;

  // 3. Time shift signal (writing at different hours)
  const timeShiftSignal = calculateTimeShiftSignal(recentJournals, baselineJournals, changes);
  totalAdjustment += timeShiftSignal;

  // Clamp total adjustment
  const clampedAdjustment = Math.min(
    MAX_MICRO_SIGNAL_ADJUST,
    Math.max(-MAX_MICRO_SIGNAL_ADJUST, totalAdjustment)
  );

  return {
    adjustment: clampedAdjustment,
    signals: {
      wordCountSignal,
      analysisRateSignal,
      timeShiftSignal,
    },
    changes,
  };
}

/**
 * Calculate average word count for a set of journals.
 */
function avgWordCount(journals: JournalEntry[]): number {
  if (journals.length === 0) return 0;
  const total = journals.reduce((sum, j) => sum + j.wordCount, 0);
  return total / journals.length;
}

/**
 * Calculate analysis rate (% with analysis).
 */
function analysisRate(journals: JournalEntry[]): number {
  if (journals.length === 0) return 0;
  const withAnalysis = journals.filter(j => j.hasAnalysis).length;
  return withAnalysis / journals.length;
}

/**
 * Word count change signal.
 */
function calculateWordCountSignal(
  recent: number,
  baseline: number,
  changes: string[]
): number {
  if (baseline === 0) return 0;
  
  const ratio = recent / baseline;
  
  if (ratio >= MICRO_SIGNALS.wordIncrease.threshold) {
    changes.push(`Writing more detailed entries (+${Math.round((ratio - 1) * 100)}%)`);
    return MICRO_SIGNALS.wordIncrease.adjustment;
  }
  
  if (ratio <= MICRO_SIGNALS.wordDecrease.threshold) {
    changes.push(`Writing shorter entries (${Math.round((ratio - 1) * 100)}%)`);
    return MICRO_SIGNALS.wordDecrease.adjustment;
  }
  
  return 0;
}

/**
 * Analysis rate change signal.
 */
function calculateAnalysisRateSignal(
  recent: number,
  baseline: number,
  changes: string[]
): number {
  const diff = recent - baseline;
  
  if (diff >= MICRO_SIGNALS.analysisIncrease.threshold) {
    changes.push('Requesting more AI insights');
    return MICRO_SIGNALS.analysisIncrease.adjustment;
  }
  
  if (diff <= -MICRO_SIGNALS.analysisDecrease.threshold) {
    changes.push('Requesting fewer AI insights');
    return MICRO_SIGNALS.analysisDecrease.adjustment;
  }
  
  return 0;
}

/**
 * Time shift signal (changed writing schedule).
 */
function calculateTimeShiftSignal(
  recentJournals: JournalEntry[],
  baselineJournals: JournalEntry[],
  changes: string[]
): number {
  const recentAvgHour = avgWritingHour(recentJournals);
  const baselineAvgHour = avgWritingHour(baselineJournals);
  
  if (recentAvgHour === null || baselineAvgHour === null) return 0;
  
  // Calculate hour difference (handle day wraparound)
  let hourDiff = Math.abs(recentAvgHour - baselineAvgHour);
  if (hourDiff > 12) hourDiff = 24 - hourDiff;
  
  if (hourDiff >= MICRO_SIGNALS.timeShift.hoursThreshold) {
    changes.push(`Changed writing time (${formatHour(baselineAvgHour)} → ${formatHour(recentAvgHour)})`);
    return MICRO_SIGNALS.timeShift.adjustment;
  }
  
  return 0;
}

/**
 * Calculate average writing hour.
 */
function avgWritingHour(journals: JournalEntry[]): number | null {
  if (journals.length === 0) return null;
  
  // Convert hours to unit circle coordinates for proper averaging
  let sinSum = 0;
  let cosSum = 0;
  
  for (const journal of journals) {
    const hour = journal.createdAt.getHours();
    const radians = (hour / 24) * 2 * Math.PI;
    sinSum += Math.sin(radians);
    cosSum += Math.cos(radians);
  }
  
  const avgRadians = Math.atan2(sinSum / journals.length, cosSum / journals.length);
  let avgHour = (avgRadians / (2 * Math.PI)) * 24;
  if (avgHour < 0) avgHour += 24;
  
  return avgHour;
}

/**
 * Format hour for display.
 */
function formatHour(hour: number): string {
  const rounded = Math.round(hour);
  const h = rounded % 12 || 12;
  const ampm = rounded < 12 ? 'AM' : 'PM';
  return `${h}${ampm}`;
}

/**
 * Split journals into recent and baseline periods.
 */
export function splitJournalsByPeriod(
  journals: JournalEntry[],
  recentDays: number = 7,
  now: Date = new Date()
): { recent: JournalEntry[]; baseline: JournalEntry[] } {
  const recentCutoff = new Date(now.getTime() - recentDays * 24 * 60 * 60 * 1000);
  const baselineCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const recent = journals.filter(j => j.createdAt >= recentCutoff);
  const baseline = journals.filter(j => j.createdAt < recentCutoff && j.createdAt >= baselineCutoff);
  
  return { recent, baseline };
}

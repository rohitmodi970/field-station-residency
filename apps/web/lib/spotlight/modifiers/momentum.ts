/**
 * Momentum Modifier Calculator
 * 
 * Detects if user activity is trending up or down by comparing
 * recent week's score to previous week's score.
 * 
 * momentum = 1.0 + (scaleFactor × (velocityWeight × v + accelerationWeight × a))
 * Clamped to [0.8, 1.2]
 */

import { MOMENTUM, TREND_THRESHOLDS } from '../constants';
import type { ActivityTrend, ActivitySnapshot } from '../types';

export interface MomentumResult {
  /** Final momentum multiplier (0.8 - 1.2) */
  multiplier: number;
  /** Score velocity (week-over-week change) */
  velocity: number;
  /** Score acceleration (change in velocity) */
  acceleration: number;
  /** Detected trend direction */
  trend: ActivityTrend;
}

/**
 * Calculate momentum multiplier from activity snapshots.
 * 
 * Uses up to 3 weeks of data to calculate velocity and acceleration.
 * 
 * @param snapshots - Daily activity snapshots, sorted newest first
 * @returns MomentumResult with multiplier and components
 */
export function calculateMomentum(snapshots: ActivitySnapshot[]): MomentumResult {
  // Need at least 2 weeks of data for meaningful momentum
  if (snapshots.length < 7) {
    return {
      multiplier: 1.0,
      velocity: 0,
      acceleration: 0,
      trend: 'stable',
    };
  }

  // Get average scores for recent periods
  const week1Score = getAverageScore(snapshots, 0, 7);   // Days 0-6 (this week)
  const week2Score = getAverageScore(snapshots, 7, 14); // Days 7-13 (last week)
  const week3Score = getAverageScore(snapshots, 14, 21); // Days 14-20 (2 weeks ago)

  // Calculate velocity (week-over-week change)
  const velocity = week2Score > 0 ? (week1Score - week2Score) / week2Score : 0;

  // Calculate acceleration (change in velocity)
  let acceleration = 0;
  if (week3Score > 0 && week2Score > 0) {
    const prevVelocity = (week2Score - week3Score) / week3Score;
    acceleration = velocity - prevVelocity;
  }

  // Calculate momentum component
  const momentumComponent = 
    (MOMENTUM.velocityWeight * velocity) + 
    (MOMENTUM.accelerationWeight * acceleration);

  // Scale and clamp
  const rawMultiplier = 1.0 + (MOMENTUM.scaleFactor * momentumComponent);
  const multiplier = Math.min(MOMENTUM.max, Math.max(MOMENTUM.min, rawMultiplier));

  // Determine trend
  const trend = determineTrend(velocity);

  return {
    multiplier,
    velocity,
    acceleration,
    trend,
  };
}

/**
 * Calculate average activity score for a date range within snapshots.
 * 
 * @param snapshots - Snapshots sorted newest first
 * @param startDay - Start day (0 = today)
 * @param endDay - End day (exclusive)
 */
function getAverageScore(
  snapshots: ActivitySnapshot[],
  startDay: number,
  endDay: number
): number {
  const relevantSnapshots = snapshots.slice(startDay, endDay);
  
  if (relevantSnapshots.length === 0) return 0;
  
  const sum = relevantSnapshots.reduce((acc, s) => acc + s.score, 0);
  return sum / relevantSnapshots.length;
}

/**
 * Determine activity trend from velocity.
 */
function determineTrend(velocity: number): ActivityTrend {
  if (velocity > TREND_THRESHOLDS.rising) {
    return 'rising';
  } else if (velocity < TREND_THRESHOLDS.declining) {
    return 'declining';
  }
  return 'stable';
}

/**
 * Quick trend detection from limited data.
 * Use when full snapshots aren't available.
 */
export function quickTrendDetection(
  recentEntryCount: number,
  previousEntryCount: number
): ActivityTrend {
  if (previousEntryCount === 0) {
    return recentEntryCount > 0 ? 'rising' : 'stable';
  }
  
  const changeRatio = (recentEntryCount - previousEntryCount) / previousEntryCount;
  
  if (changeRatio > TREND_THRESHOLDS.rising) {
    return 'rising';
  } else if (changeRatio < TREND_THRESHOLDS.declining) {
    return 'declining';
  }
  return 'stable';
}

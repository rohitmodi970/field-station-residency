/**
 * Blend Ratio Calculator
 * 
 * Determines the mix of waitlist, journal, and re-engagement content
 * based on user's activity score and trend.
 */

import {
  BlendRatios,
  Trend,
  Urgency,
} from './types';
import {
  BLEND_THRESHOLDS,
  REENGAGEMENT_THRESHOLDS,
} from './constants';

/**
 * Calculate blend ratios based on activity score and trend
 */
export function calculateBlendRatios(
  activityScore: number,
  trend: Trend = 'stable',
  daysInactive: number = 0
): BlendRatios {
  // Determine urgency level for re-engagement
  const urgency = determineUrgency(activityScore, trend, daysInactive);
  
  // Get base blend based on activity score
  let waitlist: number;
  let journal: number;
  let reengagement: number;
  
  if (activityScore < BLEND_THRESHOLDS.level1) {
    // New/inactive user - heavy waitlist
    waitlist = 0.8;
    journal = 0.1;
    reengagement = 0.1;
  } else if (activityScore < BLEND_THRESHOLDS.level2) {
    // Growing user - balanced mix
    waitlist = 0.4;
    journal = 0.5;
    reengagement = 0.1;
  } else if (activityScore < BLEND_THRESHOLDS.level3) {
    // Active user - journal-heavy
    waitlist = 0.15;
    journal = 0.75;
    reengagement = 0.1;
  } else {
    // Power user - almost all journal
    waitlist = 0.05;
    journal = 0.9;
    reengagement = 0.05;
  }
  
  // Adjust for declining trend
  if (trend === 'declining') {
    const reengagementBoost = getReengagementBoost(urgency);
    reengagement = Math.min(0.6, reengagement + reengagementBoost);
    
    // Reduce others proportionally
    const remaining = 1 - reengagement;
    const originalSum = waitlist + journal;
    waitlist = (waitlist / originalSum) * remaining;
    journal = (journal / originalSum) * remaining;
  }
  
  // Adjust for rising trend
  if (trend === 'rising') {
    // Boost journal, reduce waitlist
    const journalBoost = 0.1;
    journal = Math.min(0.95, journal + journalBoost);
    waitlist = Math.max(0, waitlist - journalBoost);
    
    // Ensure sum is 1
    const sum = waitlist + journal + reengagement;
    if (sum !== 1) {
      const factor = 1 / sum;
      waitlist *= factor;
      journal *= factor;
      reengagement *= factor;
    }
  }
  
  // Normalize to ensure sum = 1
  const total = waitlist + journal + reengagement;
  return {
    waitlist: Math.round((waitlist / total) * 100) / 100,
    journal: Math.round((journal / total) * 100) / 100,
    reengagement: Math.round((reengagement / total) * 100) / 100,
  };
}

/**
 * Determine urgency level for re-engagement
 */
export function determineUrgency(
  activityScore: number,
  trend: Trend,
  daysInactive: number
): Urgency {
  // Check days inactive first (most direct signal)
  if (daysInactive >= REENGAGEMENT_THRESHOLDS.critical) {
    return 'critical';
  }
  if (daysInactive >= REENGAGEMENT_THRESHOLDS.moderate) {
    return 'moderate';
  }
  if (daysInactive >= REENGAGEMENT_THRESHOLDS.mild) {
    return 'mild';
  }
  
  // Check activity score combined with trend
  if (trend === 'declining') {
    if (activityScore < 0.1) {
      return 'critical';
    }
    if (activityScore < 0.25) {
      return 'moderate';
    }
    if (activityScore < 0.4) {
      return 'mild';
    }
  }
  
  // Check for steep decline (comparing to trend)
  if (trend === 'declining' && activityScore < 0.5) {
    return 'mild';
  }
  
  return 'none';
}

/**
 * Get re-engagement boost based on urgency
 */
function getReengagementBoost(urgency: Urgency): number {
  switch (urgency) {
    case 'critical':
      return 0.4;
    case 'moderate':
      return 0.25;
    case 'mild':
      return 0.15;
    default:
      return 0;
  }
}

/**
 * Select appropriate re-engagement strategies based on urgency
 */
export function selectReengagementStrategies(
  urgency: Urgency,
  userData: {
    peakStreak?: number;
    totalEntries?: number;
    hasUnanalyzedEntries?: boolean;
    lastPositiveTopic?: string;
    entriesToMilestone?: number;
    writingPatternMatch?: boolean;
  }
): string[] {
  const strategies: string[] = [];
  
  switch (urgency) {
    case 'critical':
      // Most aggressive re-engagement
      strategies.push('gentle_nudge');
      if (userData.lastPositiveTopic) {
        strategies.push('positive_reflection');
      }
      if (userData.hasUnanalyzedEntries) {
        strategies.push('unanalyzed_prompt');
      }
      break;
      
    case 'moderate':
      // Balanced approach
      if (userData.peakStreak && userData.peakStreak > 3) {
        strategies.push('streak_reminder');
      }
      if (userData.entriesToMilestone && userData.entriesToMilestone <= 5) {
        strategies.push('milestone_proximity');
      }
      if (userData.writingPatternMatch) {
        strategies.push('pattern_callback');
      }
      strategies.push('gentle_nudge');
      break;
      
    case 'mild':
      // Light touch
      if (userData.entriesToMilestone && userData.entriesToMilestone <= 3) {
        strategies.push('milestone_proximity');
      }
      if (userData.hasUnanalyzedEntries) {
        strategies.push('unanalyzed_prompt');
      }
      break;
      
    case 'none':
    default:
      // No re-engagement needed
      break;
  }
  
  return strategies;
}

/**
 * Calculate effective blend with clamping and validation
 */
export function normalizeBlendRatios(ratios: BlendRatios): BlendRatios {
  // Ensure all values are between 0 and 1
  const waitlist = Math.max(0, Math.min(1, ratios.waitlist));
  const journal = Math.max(0, Math.min(1, ratios.journal));
  const reengagement = Math.max(0, Math.min(1, ratios.reengagement));
  
  // Normalize to sum to 1
  const total = waitlist + journal + reengagement;
  
  if (total === 0) {
    // Default to balanced if all zero
    return { waitlist: 0.33, journal: 0.34, reengagement: 0.33 };
  }
  
  return {
    waitlist: Math.round((waitlist / total) * 100) / 100,
    journal: Math.round((journal / total) * 100) / 100,
    reengagement: Math.round((reengagement / total) * 100) / 100,
  };
}

/**
 * Get blend description for debugging/logging
 */
export function getBlendDescription(ratios: BlendRatios): string {
  const { waitlist, journal, reengagement } = ratios;
  
  if (waitlist >= 0.7) {
    return 'New user mode - onboarding focused';
  }
  if (journal >= 0.7) {
    return 'Active user mode - journal insights focused';
  }
  if (reengagement >= 0.4) {
    return 'Re-engagement mode - win-back focused';
  }
  if (waitlist >= 0.3 && journal >= 0.3) {
    return 'Transitioning user - balanced content';
  }
  
  return 'Standard blend';
}

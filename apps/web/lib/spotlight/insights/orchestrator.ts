/**
 * Insight Orchestrator
 * 
 * Coordinates insight generation from multiple sources (journal, waitlist)
 * and blends them based on user activity score and engagement level.
 */

import { generateJournalInsights } from './journal-generator';
import { generateWaitlistInsights } from './waitlist-generator';
import { calculateBlendRatios } from '../blend';
import type { SpotlightInsight, BlendRatios } from '../types';
import type { InsightOrchestratorOptions } from './types';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_OPTIONS: Required<InsightOrchestratorOptions> = {
  maxTotalInsights: 5,
  enableJournalInsights: true,
  enableWaitlistInsights: true,
  enableAIEnhancement: false,
  aiProvider: 'claude',
  forceRefresh: false,
};

// Minimum thresholds for including each insight type
const INSIGHT_BLEND_THRESHOLDS = {
  // Activity score threshold below which we include waitlist insights
  lowActivityThreshold: 0.3,
  // Activity score threshold above which we reduce waitlist insights
  highActivityThreshold: 0.7,
};

// ============================================
// HELPERS
// ============================================

function determineInsightDistribution(
  activityScore: number,
  blendRatios: BlendRatios,
  maxInsights: number
): { journalCount: number; waitlistCount: number } {
  // For very low activity, prioritize waitlist/onboarding insights
  if (activityScore < INSIGHT_BLEND_THRESHOLDS.lowActivityThreshold) {
    const waitlistCount = Math.ceil(maxInsights * 0.7);
    const journalCount = maxInsights - waitlistCount;
    return { journalCount, waitlistCount };
  }
  
  // For high activity, prioritize journal insights
  if (activityScore > INSIGHT_BLEND_THRESHOLDS.highActivityThreshold) {
    const journalCount = Math.ceil(maxInsights * 0.8);
    const waitlistCount = maxInsights - journalCount;
    return { journalCount, waitlistCount };
  }
  
  // Medium activity - blend based on ratios
  // Use journal vs waitlist ratio from blend ratios
  const journalRatio = blendRatios.journal;
  const journalCount = Math.round(maxInsights * journalRatio);
  const waitlistCount = maxInsights - journalCount;
  
  return { journalCount, waitlistCount };
}

function mergeAndPrioritize(
  journalInsights: SpotlightInsight[],
  waitlistInsights: SpotlightInsight[],
  maxTotal: number
): SpotlightInsight[] {
  // Combine all insights
  const allInsights = [...journalInsights, ...waitlistInsights];
  
  // Sort by priority (descending)
  allInsights.sort((a, b) => b.priority - a.priority);
  
  // Take top N, but ensure diversity (at least 1 of each type if available)
  const result: SpotlightInsight[] = [];
  let journalAdded = 0;
  let waitlistAdded = 0;
  
  // First pass: ensure at least one of each type if available
  for (const insight of allInsights) {
    if (result.length >= maxTotal) break;
    
    if (insight.type === 'journal' && journalAdded === 0) {
      result.push(insight);
      journalAdded++;
    } else if (insight.type === 'waitlist' && waitlistAdded === 0) {
      result.push(insight);
      waitlistAdded++;
    }
  }
  
  // Second pass: fill remaining slots by priority
  for (const insight of allInsights) {
    if (result.length >= maxTotal) break;
    if (!result.includes(insight)) {
      result.push(insight);
    }
  }
  
  return result;
}

// ============================================
// MAIN ORCHESTRATOR
// ============================================

export interface OrchestratedInsights {
  insights: SpotlightInsight[];
  metadata: {
    activityScore: number;
    blendRatios: BlendRatios;
    journalInsightCount: number;
    waitlistInsightCount: number;
    generatedAt: string;
  };
}

export async function orchestrateInsights(
  userId: string,
  options?: InsightOrchestratorOptions,
  precomputedActivityScore?: number
): Promise<OrchestratedInsights> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Use precomputed activity score or default to medium activity
  // Full activity score calculation requires ActivityScoreInput which needs journal data
  // This is typically done at the API level, so we accept precomputed scores
  const activityScore = precomputedActivityScore ?? 0.5;
  const blendRatios = calculateBlendRatios(activityScore);
  
  // Determine how many insights to request from each source
  const distribution = determineInsightDistribution(
    activityScore,
    blendRatios,
    opts.maxTotalInsights
  );
  
  // Generate insights in parallel
  const [journalInsights, waitlistInsights] = await Promise.all([
    opts.enableJournalInsights
      ? generateJournalInsights(userId, {
          maxInsights: distribution.journalCount + 2, // Request extras for better selection
          useAI: opts.enableAIEnhancement,
          aiProvider: opts.aiProvider,
        })
      : Promise.resolve([]),
    opts.enableWaitlistInsights
      ? generateWaitlistInsights(userId, {
          maxInsights: distribution.waitlistCount + 2,
          useAI: opts.enableAIEnhancement,
          aiProvider: opts.aiProvider,
        })
      : Promise.resolve([]),
  ]);
  
  // Merge and prioritize
  const insights = mergeAndPrioritize(
    journalInsights,
    waitlistInsights,
    opts.maxTotalInsights
  );
  
  return {
    insights,
    metadata: {
      activityScore,
      blendRatios,
      journalInsightCount: insights.filter(i => i.type === 'journal').length,
      waitlistInsightCount: insights.filter(i => i.type === 'waitlist').length,
      generatedAt: new Date().toISOString(),
    },
  };
}

// ============================================
// CONVENIENCE EXPORTS
// ============================================

export { generateJournalInsights } from './journal-generator';
export { generateWaitlistInsights } from './waitlist-generator';

export default orchestrateInsights;

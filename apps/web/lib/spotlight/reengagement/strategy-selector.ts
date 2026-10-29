/**
 * Strategy Selector
 * 
 * Intelligently selects which re-engagement strategies to use
 * based on urgency, user data, and recent history.
 */

import type { ReengagementData, SpotlightInsight, Urgency, ReengagementStrategy } from '../types';
import type { 
  ReengagementStrategyHandler, 
  StrategySelectionResult, 
  StrategySelectionOptions 
} from './types';
import { DEFAULT_MAX_INSIGHTS } from './types';
import { ALL_STRATEGIES } from './strategies';

// ============================================
// SELECTOR LOGIC
// ============================================

interface RankedStrategy {
  handler: ReengagementStrategyHandler;
  priority: number;
  canGenerate: boolean;
}

/**
 * Rank strategies based on urgency and whether they can generate.
 */
function rankStrategies(
  data: ReengagementData,
  urgency: Urgency,
  recentlyShown: string[] = []
): RankedStrategy[] {
  return ALL_STRATEGIES.map(handler => {
    const canGenerate = handler.canGenerate(data);
    let priority = handler.priorities[urgency];
    
    // Penalize recently shown strategies
    if (recentlyShown.includes(handler.type)) {
      priority += 10; // Lower priority (higher number)
    }
    
    return {
      handler,
      priority,
      canGenerate,
    };
  })
  .filter(s => s.canGenerate) // Only keep strategies that can generate
  .sort((a, b) => a.priority - b.priority); // Sort by priority (lower is better)
}

/**
 * Select the best strategies and generate insights.
 */
export function selectStrategies(
  data: ReengagementData,
  options: StrategySelectionOptions
): StrategySelectionResult[] {
  const {
    urgency,
    recentlyShown = [],
    maxInsights = DEFAULT_MAX_INSIGHTS,
    forceStrategy,
  } = options;

  // If forcing a specific strategy
  if (forceStrategy) {
    const handler = ALL_STRATEGIES.find(s => s.type === forceStrategy);
    if (handler && handler.canGenerate(data)) {
      const insight = handler.generate(data);
      if (insight) {
        return [{
          strategy: handler.type,
          insight,
          reasoning: `Forced strategy: ${handler.name}`,
          alternatives: [],
        }];
      }
    }
    // Forced strategy can't generate, fall through to normal selection
  }

  const ranked = rankStrategies(data, urgency, recentlyShown);
  
  if (ranked.length === 0) {
    return [];
  }

  const results: StrategySelectionResult[] = [];
  const usedStrategies = new Set<string>();

  for (const { handler } of ranked) {
    if (results.length >= maxInsights) break;
    if (usedStrategies.has(handler.type)) continue;

    const insight = handler.generate(data);
    if (insight) {
      // Update priority based on urgency
      insight.priority = handler.priorities[urgency];
      
      const alternatives = ranked
        .filter(r => !usedStrategies.has(r.handler.type) && r.handler.type !== handler.type)
        .slice(0, 3)
        .map(r => r.handler.type);

      results.push({
        strategy: handler.type,
        insight,
        reasoning: buildReasoning(handler, urgency, data),
        alternatives,
      });

      usedStrategies.add(handler.type);
    }
  }

  return results;
}

/**
 * Build explanation for why a strategy was selected.
 */
function buildReasoning(
  handler: ReengagementStrategyHandler,
  urgency: Urgency,
  data: ReengagementData
): string {
  const parts: string[] = [];
  
  parts.push(`${handler.name} selected for ${urgency} urgency.`);
  
  switch (handler.type) {
    case 'low_effort_prompt':
      parts.push(`User inactive for ${data.daysInactive} days - low friction approach.`);
      break;
    case 'achievement_highlight':
      if (data.peakStreak >= 7) {
        parts.push(`Has impressive ${data.peakStreak}-day streak history.`);
      } else {
        parts.push(`Has ${data.totalEntries} total entries to celebrate.`);
      }
      break;
    case 'pattern_trigger':
      parts.push(`Detected writing patterns to leverage.`);
      break;
    case 'nostalgia_hook':
      if (data.favoriteTopics.length > 0) {
        parts.push(`Has favorite topics: ${data.favoriteTopics.slice(0, 2).join(', ')}.`);
      }
      break;
    case 'gamification_nudge':
      if (data.currentStreak > 0) {
        parts.push(`Active ${data.currentStreak}-day streak at risk.`);
      } else {
        parts.push(`Previous ${data.peakStreak}-day streak to beat.`);
      }
      break;
    case 'progress_reminder':
      if (data.unanalyzedCount > 0) {
        parts.push(`Has ${data.unanalyzedCount} unanalyzed entries.`);
      }
      if (data.draftCount > 0) {
        parts.push(`Has ${data.draftCount} drafts.`);
      }
      break;
    case 'mood_callback':
      if (data.lastPositiveEntry) {
        parts.push(`Has positive entry to reference.`);
      }
      break;
  }

  return parts.join(' ');
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Get a single best insight for the given urgency.
 */
export function getBestInsight(
  data: ReengagementData,
  urgency: Urgency,
  recentlyShown?: ReengagementStrategy[]
): SpotlightInsight | null {
  const results = selectStrategies(data, {
    urgency,
    recentlyShown,
    maxInsights: 1,
  });
  
  return results[0]?.insight ?? null;
}

/**
 * Get multiple insights, typically for the spotlight panel.
 */
export function getReengagementInsights(
  data: ReengagementData,
  urgency: Urgency,
  options?: {
    maxInsights?: number;
    recentlyShown?: ReengagementStrategy[];
  }
): SpotlightInsight[] {
  const results = selectStrategies(data, {
    urgency,
    maxInsights: options?.maxInsights ?? DEFAULT_MAX_INSIGHTS,
    recentlyShown: options?.recentlyShown,
  });
  
  return results.map(r => r.insight);
}

/**
 * Check which strategies can generate for given data.
 */
export function getAvailableStrategies(data: ReengagementData): ReengagementStrategy[] {
  return ALL_STRATEGIES
    .filter(s => s.canGenerate(data))
    .map(s => s.type);
}

// ============================================
// AI-ENHANCED GENERATION
// ============================================

import type { AIGeneratorOptions } from './ai-generator';

export interface AIEnhancedOptions extends StrategySelectionOptions {
  /** Use AI to generate personalized messages */
  useAI?: boolean;
  /** AI generation options */
  aiOptions?: AIGeneratorOptions;
  /** Recent entry snippets for AI context */
  snippets?: string[];
}

/**
 * Get insights with optional AI enhancement.
 * Falls back to static templates if AI is unavailable or fails.
 */
export async function getEnhancedInsights(
  data: ReengagementData,
  options: AIEnhancedOptions
): Promise<SpotlightInsight[]> {
  const {
    urgency,
    recentlyShown = [],
    maxInsights = DEFAULT_MAX_INSIGHTS,
    useAI = false,
    aiOptions = {},
    snippets = [],
  } = options;

  // First, select strategies using priority ranking
  const ranked = rankStrategies(data, urgency, recentlyShown);
  const selectedStrategies = ranked.slice(0, maxInsights).map(r => r.handler.type);

  if (!useAI || selectedStrategies.length === 0) {
    // Use static generation
    return getReengagementInsights(data, urgency, {
      maxInsights,
      recentlyShown,
    });
  }

  // Use AI generation
  try {
    const { generateMultipleWithAI } = await import('./ai-generator');
    
    const results = await generateMultipleWithAI(
      selectedStrategies,
      data,
      aiOptions,
      snippets
    );

    return results.map(r => r.insight);
    
  } catch (error) {
    console.error('[Strategy Selector] AI generation failed, using static:', error);
    
    // Fallback to static
    return getReengagementInsights(data, urgency, {
      maxInsights,
      recentlyShown,
    });
  }
}

/**
 * Get a single AI-enhanced insight.
 */
export async function getEnhancedBestInsight(
  data: ReengagementData,
  urgency: Urgency,
  options?: {
    useAI?: boolean;
    aiOptions?: AIGeneratorOptions;
    snippets?: string[];
    recentlyShown?: ReengagementStrategy[];
  }
): Promise<SpotlightInsight | null> {
  const insights = await getEnhancedInsights(data, {
    urgency,
    maxInsights: 1,
    useAI: options?.useAI ?? false,
    aiOptions: options?.aiOptions,
    snippets: options?.snippets,
    recentlyShown: options?.recentlyShown,
  });

  return insights[0] ?? null;
}

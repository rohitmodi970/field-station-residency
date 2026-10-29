/**
 * Re-engagement Module
 * 
 * Exports the complete re-engagement system for generating
 * personalized insights to bring inactive users back.
 */

// Types
export * from './types';

// Data fetching
export { fetchReengagementData } from './data-fetcher';

// Strategy selection
export {
  selectStrategies,
  getBestInsight,
  getReengagementInsights,
  getAvailableStrategies,
  // AI-enhanced
  getEnhancedInsights,
  getEnhancedBestInsight,
} from './strategy-selector';

// AI generation
export {
  generateWithAI,
  generateMultipleWithAI,
  type AIGeneratorOptions,
  type AIGenerationResult,
} from './ai-generator';

// AI prompts (for customization)
export {
  buildFullPrompt,
  buildContextSummary,
  SYSTEM_PROMPT,
} from './ai-prompts';

// Individual strategies (for testing/direct use)
export {
  ALL_STRATEGIES,
  getStrategy,
  lowEffortPromptStrategy,
  achievementHighlightStrategy,
  patternTriggerStrategy,
  nostalgiaHookStrategy,
  gamificationNudgeStrategy,
  progressReminderStrategy,
  moodCallbackStrategy,
} from './strategies';

// ============================================
// MAIN ENTRY POINT
// ============================================

import { createClient } from '@/utils/supabase/server';
import type { ReengagementData, SpotlightInsight, Urgency, ReengagementStrategy } from '../types';
import { fetchReengagementData } from './data-fetcher';
import { getReengagementInsights } from './strategy-selector';

export interface GenerateReengagementOptions {
  userId: string;
  urgency: Urgency;
  maxInsights?: number;
  recentlyShown?: ReengagementStrategy[];
}

/**
 * Main function to generate re-engagement insights for a user.
 * 
 * This fetches user data and applies the strategy selection algorithm
 * to generate personalized re-engagement prompts.
 * 
 * @example
 * ```ts
 * const insights = await generateReengagementInsights({
 *   userId: 'user-123',
 *   urgency: 'moderate',
 *   maxInsights: 2,
 * });
 * ```
 */
export async function generateReengagementInsights(
  options: GenerateReengagementOptions
): Promise<SpotlightInsight[]> {
  const { userId, urgency, maxInsights = 2, recentlyShown } = options;

  // Skip if no urgency
  if (urgency === 'none') {
    return [];
  }

  const supabase = await createClient();

  // Fetch user's re-engagement data
  const data = await fetchReengagementData(supabase, { userId });

  // Generate insights using strategy selector
  return getReengagementInsights(data, urgency, {
    maxInsights,
    recentlyShown,
  });
}

/**
 * Get re-engagement data for debugging/display purposes.
 */
export async function getReengagementDataForUser(
  userId: string
): Promise<ReengagementData> {
  const supabase = await createClient();
  return fetchReengagementData(supabase, { userId });
}

// ============================================
// AI-ENHANCED GENERATION
// ============================================

import { getEnhancedInsights } from './strategy-selector';
import { fetchEntrySnippets } from './ai-server';
import type { AIGeneratorOptions } from './ai-generator';

export interface GenerateAIReengagementOptions extends GenerateReengagementOptions {
  /** Use AI for personalized message generation */
  useAI?: boolean;
  /** AI generation options */
  aiOptions?: AIGeneratorOptions;
}

/**
 * Generate re-engagement insights with optional AI enhancement.
 * 
 * When useAI is true, uses Claude to generate personalized messages
 * based on the user's journal history and patterns.
 * 
 * @example
 * ```ts
 * // With AI enhancement
 * const insights = await generateAIReengagementInsights({
 *   userId: 'user-123',
 *   urgency: 'moderate',
 *   useAI: true,
 *   aiOptions: { provider: 'claude', temperature: 0.8 },
 * });
 * 
 * // Without AI (uses static templates, same as generateReengagementInsights)
 * const insights = await generateAIReengagementInsights({
 *   userId: 'user-123',
 *   urgency: 'moderate',
 *   useAI: false,
 * });
 * ```
 */
export async function generateAIReengagementInsights(
  options: GenerateAIReengagementOptions
): Promise<SpotlightInsight[]> {
  const { 
    userId, 
    urgency, 
    maxInsights = 2, 
    recentlyShown,
    useAI = false,
    aiOptions = {},
  } = options;

  // Skip if no urgency
  if (urgency === 'none') {
    return [];
  }

  const supabase = await createClient();

  // Fetch user's re-engagement data
  const data = await fetchReengagementData(supabase, { userId });

  // Fetch snippets for AI context if using AI
  let snippets: string[] = [];
  if (useAI) {
    try {
      snippets = await fetchEntrySnippets(supabase, userId, 5);
    } catch (error) {
      console.warn('[Reengagement] Failed to fetch snippets:', error);
    }
  }

  // Generate insights with optional AI
  return getEnhancedInsights(data, {
    urgency,
    maxInsights,
    recentlyShown,
    useAI,
    aiOptions,
    snippets,
  });
}

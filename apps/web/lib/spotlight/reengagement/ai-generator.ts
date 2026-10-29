/**
 * AI-Enhanced Re-engagement Generator
 * 
 * Uses LLMs to generate personalized, context-aware re-engagement
 * messages based on user's journal history and patterns.
 */

import { v4 as uuid } from 'uuid';
import type { ReengagementData, SpotlightInsight, ReengagementStrategy } from '../types';
import type { AIGeneratedMessage } from './ai-prompts';
import { buildFullPrompt } from './ai-prompts';
import { getStrategy } from './strategies';
import { executeLLMRequest } from '@/lib/llm/llmService';

// ============================================
// TYPES
// ============================================

export interface AIGeneratorOptions {
  /** LLM provider to use */
  provider?: 'claude' | 'gemini' | 'openai';
  /** Temperature for generation (0-1) */
  temperature?: number;
  /** Whether to include recent entry snippets for context */
  includeSnippets?: boolean;
  /** Maximum snippets to include */
  maxSnippets?: number;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether to fallback to static templates on AI failure */
  fallbackToStatic?: boolean;
}

export interface AIGenerationResult {
  insight: SpotlightInsight;
  source: 'ai' | 'static';
  generationMs: number;
  reasoning?: string;
}

const DEFAULT_OPTIONS: Required<AIGeneratorOptions> = {
  provider: 'claude',
  temperature: 0.8,
  includeSnippets: true,
  maxSnippets: 3,
  timeout: 10000,
  fallbackToStatic: true,
};

// ============================================
// AI GENERATION
// ============================================

/**
 * Generate a re-engagement insight using AI.
 */
export async function generateWithAI(
  strategy: ReengagementStrategy,
  data: ReengagementData,
  options: AIGeneratorOptions = {},
  snippets?: string[]
): Promise<AIGenerationResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  
  try {
    // Build the prompt
    const prompt = buildFullPrompt(
      strategy,
      data,
      opts.includeSnippets ? snippets?.slice(0, opts.maxSnippets) : undefined
    );
    
    // Call the LLM API
    const response = await callLLMAPI(prompt, opts);
    
    if (!response.text || response.error) {
      throw new Error(response.error || 'Empty response from LLM');
    }
    
    // Parse the AI response
    const parsed = parseAIResponse(response.text);
    
    if (!parsed) {
      throw new Error('Failed to parse AI response');
    }
    
    // Build the insight
    const insight = buildInsightFromAI(parsed, strategy);
    
    return {
      insight,
      source: 'ai',
      generationMs: Date.now() - startTime,
      reasoning: parsed.reasoning,
    };
    
  } catch (error) {
    console.error(`[AI Generator] Error for ${strategy}:`, error);
    
    // Fallback to static generation if enabled
    if (opts.fallbackToStatic) {
      const staticInsight = generateStaticFallback(strategy, data);
      return {
        insight: staticInsight,
        source: 'static',
        generationMs: Date.now() - startTime,
        reasoning: `AI failed, used static template: ${(error as Error).message}`,
      };
    }
    
    throw error;
  }
}

/**
 * Call the LLM API endpoint.
 */
async function callLLMAPI(
  prompt: string,
  options: Required<AIGeneratorOptions>
): Promise<{ text: string; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);
  
  try {
    const data = await executeLLMRequest({
      prompt,
      provider: options.provider,
      options: {
        temperature: options.temperature,
      },
    });
    
    clearTimeout(timeoutId);
    return { text: data.text || '' };
    
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      throw new Error('LLM request timed out');
    }
    throw error;
  }
}

/**
 * Parse the AI response JSON.
 */
function parseAIResponse(text: string): AIGeneratedMessage | null {
  try {
    // Try to extract JSON from potential markdown code blocks
    let jsonStr = text.trim();
    
    // Remove markdown code fences if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1]!.trim();
    }
    
    // Try to find JSON object if there's surrounding text
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }
    
    const parsed = JSON.parse(jsonStr);
    
    // Validate required fields
    if (!parsed.title || !parsed.body) {
      console.warn('[AI Generator] Missing required fields:', parsed);
      return null;
    }
    
    return {
      title: String(parsed.title).slice(0, 100),
      body: String(parsed.body).slice(0, 300),
      icon: String(parsed.icon || '✨').slice(0, 4),
      actionLabel: String(parsed.actionLabel || 'Continue').slice(0, 30),
      tone: parsed.tone,
      reasoning: parsed.reasoning,
    };
    
  } catch (error) {
    console.error('[AI Generator] Failed to parse response:', error, text);
    return null;
  }
}

/**
 * Build a SpotlightInsight from AI-generated content.
 */
function buildInsightFromAI(
  message: AIGeneratedMessage,
  strategy: ReengagementStrategy
): SpotlightInsight {
  return {
    id: uuid(),
    type: 'reengagement',
    strategyType: strategy,
    title: message.title,
    body: message.body,
    icon: message.icon,
    actionLabel: message.actionLabel,
    actionTarget: getActionTarget(strategy),
    priority: 1, // AI-generated insights get high priority
  };
}

/**
 * Get action target URL for a strategy.
 */
function getActionTarget(strategy: ReengagementStrategy): string {
  const targets: Record<ReengagementStrategy, string> = {
    // Core re-engagement strategies
    low_effort_prompt: '/journal/new?mode=quick',
    achievement_highlight: '/journal/new',
    pattern_trigger: '/journal/new',
    nostalgia_hook: '/journal/new',
    gamification_nudge: '/journal/new',
    progress_reminder: '/journal?filter=unanalyzed',
    mood_callback: '/journal/new?mode=mood',
    // Journal insight strategies
    journal_sentiment: '/journal/new',
    journal_trend: '/journal/new',
    journal_topic: '/journal/new',
    journal_stress: '/journal/new?mode=mood',
    journal_emotion: '/journal/new?mode=mood',
    journal_growth: '/journal/new',
    journal_pattern: '/journal/new',
    journal_insight: '/journal/new',
    // Waitlist insight strategies
    waitlist_welcome: '/dashboard',
    waitlist_goal: '/dashboard',
    waitlist_interest: '/dashboard',
    waitlist_milestone: '/dashboard',
    waitlist_momentum: '/dashboard',
    waitlist_feature: '/dashboard',
    waitlist_reengagement: '/dashboard',
    waitlist_onboarding: '/dashboard',
  };
  return targets[strategy] || '/journal/new';
}

/**
 * Fallback to static template generation.
 */
function generateStaticFallback(
  strategy: ReengagementStrategy,
  data: ReengagementData
): SpotlightInsight {
  const handler = getStrategy(strategy);
  
  if (handler && handler.canGenerate(data)) {
    const insight = handler.generate(data);
    if (insight) return insight;
  }
  
  // Ultimate fallback
  return {
    id: uuid(),
    type: 'reengagement',
    strategyType: strategy,
    title: "Ready to write?",
    body: "Your journal is waiting. Even a quick note can help you reconnect.",
    icon: "✍️",
    actionLabel: "Start Writing",
    actionTarget: "/journal/new",
    priority: 5,
  };
}

// ============================================
// BATCH GENERATION
// ============================================

/**
 * Generate multiple insights with AI, with smart batching.
 */
export async function generateMultipleWithAI(
  strategies: ReengagementStrategy[],
  data: ReengagementData,
  options: AIGeneratorOptions = {},
  snippets?: string[]
): Promise<AIGenerationResult[]> {
  const results: AIGenerationResult[] = [];
  
  // Generate in parallel with Promise.allSettled for resilience
  const promises = strategies.map(strategy =>
    generateWithAI(strategy, data, options, snippets)
  );
  
  const settled = await Promise.allSettled(promises);
  
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]!;
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      // Even if AI failed and fallback was disabled, try static
      const staticInsight = generateStaticFallback(strategies[i]!, data);
      results.push({
        insight: staticInsight,
        source: 'static',
        generationMs: 0,
        reasoning: `Generation failed: ${result.reason}`,
      });
    }
  }
  
  return results;
}

// ============================================
// SERVER-SIDE GENERATION (for API routes)
// ============================================

/**
 * Generate insights server-side using direct LLM calls.
 * 
 * For server-side generation in API routes, import from './ai-server' directly:
 * @example
 * ```ts
 * import { generateWithClaude } from '@/lib/spotlight/reengagement/ai-server';
 * import { buildFullPrompt } from '@/lib/spotlight/reengagement/ai-prompts';
 * 
 * const prompt = buildFullPrompt(strategy, data, snippets);
 * const response = await generateWithClaude(prompt);
 * ```
 * 
 * This function uses the /api/llm endpoint for broader compatibility.
 */
export async function generateWithAIServer(
  strategy: ReengagementStrategy,
  data: ReengagementData,
  snippets?: string[],
  options: AIGeneratorOptions = {}
): Promise<AIGenerationResult> {
  // For server-side, we still use the API route approach
  // which is compatible with both server and client environments
  return generateWithAI(strategy, data, options, snippets);
}

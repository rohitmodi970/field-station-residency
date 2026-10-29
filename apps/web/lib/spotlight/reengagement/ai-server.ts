/**
 * Server-side AI Generation
 * 
 * Direct LLM calls for use in API routes.
 * This module should only be imported server-side.
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================
// TYPES
// ============================================

export interface ClaudeOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const DEFAULT_MAX_TOKENS = 500;

// ============================================
// CLAUDE GENERATION
// ============================================

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Generate text using Claude directly (server-side only).
 */
export async function generateWithClaude(
  prompt: string,
  options: ClaudeOptions = {}
): Promise<string> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: options.model || DEFAULT_MODEL,
    max_tokens: options.maxTokens || DEFAULT_MAX_TOKENS,
    temperature: options.temperature ?? 0.8,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extract text from response
  const textBlock = response.content.find(block => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Claude response');
  }

  return textBlock.text;
}

/**
 * Generate multiple messages in a single API call (batch).
 * More efficient when generating multiple re-engagement options.
 */
export async function generateBatchWithClaude(
  prompts: { strategy: string; prompt: string }[],
  options: ClaudeOptions = {}
): Promise<Map<string, string>> {
  const client = getAnthropicClient();

  // Combine prompts into a single batch request
  const combinedPrompt = `Generate re-engagement messages for the following strategies. 
Respond with a JSON object where keys are strategy names and values are the message objects.

${prompts.map((p, i) => `
=== STRATEGY ${i + 1}: ${p.strategy} ===
${p.prompt}
`).join('\n')}

Respond with JSON only:
{
  "${prompts[0]?.strategy}": { "title": "...", "body": "...", "icon": "...", "actionLabel": "..." },
  ...
}`;

  const response = await client.messages.create({
    model: options.model || DEFAULT_MODEL,
    max_tokens: (options.maxTokens || DEFAULT_MAX_TOKENS) * prompts.length,
    temperature: options.temperature ?? 0.8,
    messages: [
      {
        role: 'user',
        content: combinedPrompt,
      },
    ],
  });

  const textBlock = response.content.find(block => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text content in Claude response');
  }

  // Parse the batch response
  const results = new Map<string, string>();

  try {
    let jsonStr = textBlock.text.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    for (const [strategy, message] of Object.entries(parsed)) {
      results.set(strategy, JSON.stringify(message));
    }
  } catch (error) {
    console.error('[AI Server] Failed to parse batch response:', error);
    // Return individual prompts for retry
  }

  return results;
}

// ============================================
// SNIPPET FETCHER (for context)
// ============================================

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fetch recent entry snippets for AI context.
 * Only fetches the first ~100 chars of each entry.
 */
export async function fetchEntrySnippets(
  supabase: SupabaseClient,
  userId: string,
  limit = 5
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AI Server] Failed to fetch snippets:', error);
      return [];
    }

    return (data || [])
      .map(entry => {
        const content = entry.content || '';
        // Take first 150 chars, truncate at word boundary
        if (content.length <= 150) return content;
        const truncated = content.slice(0, 150);
        const lastSpace = truncated.lastIndexOf(' ');
        return lastSpace > 100
          ? truncated.slice(0, lastSpace) + '...'
          : truncated + '...';
      })
      .filter(s => s.length > 0);

  } catch (error) {
    console.error('[AI Server] Snippet fetch error:', error);
    return [];
  }
}

/**
 * Fetch user's recent topics from analysis.
 */
export async function fetchRecentTopics(
  supabase: SupabaseClient,
  userId: string,
  limit = 10
): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('analysis_result')
      .eq('user_id', userId)
      .not('analysis_result', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AI Server] Failed to fetch topics:', error);
      return [];
    }

    const topicSet = new Set<string>();

    for (const entry of data || []) {
      const analysis = entry.analysis_result;
      if (analysis?.topics) {
        for (const topic of analysis.topics) {
          if (typeof topic === 'string' && topic.length > 0) {
            topicSet.add(topic.toLowerCase());
          }
        }
      }
    }

    return Array.from(topicSet).slice(0, 10);

  } catch (error) {
    console.error('[AI Server] Topics fetch error:', error);
    return [];
  }
}

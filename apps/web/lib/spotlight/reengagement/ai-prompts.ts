/**
 * AI Prompts for Re-engagement Generation
 * 
 * These prompts guide the LLM to generate personalized,
 * contextual re-engagement messages.
 */

import type { ReengagementData, ReengagementStrategy } from '../types';

// ============================================
// SYSTEM PROMPT
// ============================================

export const SYSTEM_PROMPT = `You are a supportive journaling companion. Your goal is to gently encourage users to return to their journaling practice without being pushy or guilt-inducing.

Guidelines:
- Be warm, understanding, and encouraging
- Reference specific details from their history when available
- Keep messages concise (title: 5-10 words, body: 1-2 sentences max)
- Use their own language/topics when possible
- Never guilt-trip or use negative language about their absence
- Focus on the value of continuing, not the loss of stopping
- Be conversational, not corporate or generic

You must respond with valid JSON only.`;

// ============================================
// CONTEXT BUILDER
// ============================================

export interface AIGenerationContext {
  strategy: ReengagementStrategy;
  data: ReengagementData;
  recentEntrySnippets?: string[];
  recentTopics?: string[];
}

/**
 * Build a context summary for the AI prompt.
 */
export function buildContextSummary(data: ReengagementData): string {
  const parts: string[] = [];
  
  parts.push(`Days since last entry: ${data.daysInactive}`);
  parts.push(`Total entries: ${data.totalEntries}`);
  parts.push(`Peak streak: ${data.peakStreak} days`);
  parts.push(`Current streak: ${data.currentStreak} days`);
  
  if (data.favoriteTopics.length > 0) {
    parts.push(`Favorite topics: ${data.favoriteTopics.slice(0, 5).join(', ')}`);
  }
  
  if (data.lastPositiveEntry) {
    const daysAgo = Math.ceil(
      (Date.now() - data.lastPositiveEntry.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    parts.push(`Last positive entry: ${daysAgo} days ago, about "${data.lastPositiveEntry.topTopic}"`);
  }
  
  if (data.writingPatterns.mostActiveDay) {
    parts.push(`Usually writes on: ${data.writingPatterns.mostActiveDay}s`);
  }
  
  if (data.unanalyzedCount > 0) {
    parts.push(`Unanalyzed entries: ${data.unanalyzedCount}`);
  }
  
  if (data.entriesToNextMilestone <= 5) {
    parts.push(`Entries to next milestone: ${data.entriesToNextMilestone}`);
  }
  
  return parts.join('\n');
}

// ============================================
// STRATEGY-SPECIFIC PROMPTS
// ============================================

export function getStrategyPrompt(
  strategy: ReengagementStrategy,
  data: ReengagementData,
  snippets?: string[]
): string {
  const context = buildContextSummary(data);
  const snippetText = snippets?.length 
    ? `\n\nRecent entry snippets:\n${snippets.map(s => `"${s}"`).join('\n')}`
    : '';
  
  const baseInstruction = `
USER CONTEXT:
${context}${snippetText}

Generate a re-engagement message for this journaling app user.
`;

  switch (strategy) {
    case 'low_effort_prompt':
      return `${baseInstruction}
STRATEGY: Low Effort Prompt
Goal: Create a gentle, low-pressure invitation to write just a little bit.
Focus: Reduce friction, emphasize that even one sentence counts.
Tone: Warm, no pressure, understanding.

Generate a message that makes starting to write feel effortless.`;

    case 'achievement_highlight':
      return `${baseInstruction}
STRATEGY: Achievement Highlight  
Goal: Celebrate their past accomplishments to motivate return.
Focus: Their ${data.peakStreak}-day streak, ${data.totalEntries} entries, or approaching ${data.totalEntries + data.entriesToNextMilestone} milestone.
Tone: Celebratory, proud, encouraging.

Generate a message that makes them feel accomplished and ready to continue.`;

    case 'pattern_trigger':
      return `${baseInstruction}
STRATEGY: Pattern Trigger
Goal: Leverage their established writing habits.
Focus: They typically write on ${data.writingPatterns.mostActiveDay || 'certain days'}, around ${data.writingPatterns.mostActiveHour ?? 'their usual time'}.
Tone: Familiar, routine-focused, gentle reminder.

Generate a message that connects to their natural writing rhythm.`;

    case 'nostalgia_hook':
      return `${baseInstruction}
STRATEGY: Nostalgia Hook
Goal: Create emotional connection to their past entries.
Focus: Their favorite topics (${data.favoriteTopics.slice(0, 3).join(', ')}) or positive moments.
Tone: Reflective, curious, warm.

Generate a message that makes them want to revisit or continue their story.`;

    case 'gamification_nudge':
      return `${baseInstruction}
STRATEGY: Gamification Nudge
Goal: Tap into their competitive or achievement-oriented side.
Focus: ${data.currentStreak > 0 ? `Protect their ${data.currentStreak}-day streak` : `Beat their ${data.peakStreak}-day record`}.
Tone: Energetic, challenge-oriented, playful.

Generate a message that sparks their motivation through achievement.`;

    case 'progress_reminder':
      return `${baseInstruction}
STRATEGY: Progress Reminder
Goal: Highlight unfinished work that could benefit from attention.
Focus: ${data.unanalyzedCount} unanalyzed entries waiting for insights.
Tone: Curious, opportunity-focused.

Generate a message that creates intrigue about what insights await them.`;

    case 'mood_callback':
      return `${baseInstruction}
STRATEGY: Mood Callback
Goal: Connect emotionally by referencing their past feelings.
Focus: ${data.lastPositiveEntry ? `Their positive entry about "${data.lastPositiveEntry.topTopic}"` : 'Checking in on how they\'re feeling'}.
Tone: Empathetic, caring, emotionally attuned.

Generate a message that creates emotional resonance and invites them to share.`;

    default:
      return `${baseInstruction}
STRATEGY: General Re-engagement
Goal: Gently invite them back to journaling.
Tone: Warm, welcoming, no pressure.

Generate a message that makes them feel welcome to return.`;
  }
}

// ============================================
// RESPONSE FORMAT
// ============================================

export const RESPONSE_FORMAT = `
Respond with JSON in exactly this format:
{
  "title": "Short attention-grabbing title (5-10 words)",
  "body": "Brief supportive message (1-2 sentences max)",
  "icon": "Single relevant emoji",
  "actionLabel": "Button text (2-4 words)",
  "tone": "How the message should feel",
  "reasoning": "Brief explanation of your approach"
}`;

export interface AIGeneratedMessage {
  title: string;
  body: string;
  icon: string;
  actionLabel: string;
  tone?: string;
  reasoning?: string;
}

// ============================================
// FULL PROMPT BUILDER
// ============================================

export function buildFullPrompt(
  strategy: ReengagementStrategy,
  data: ReengagementData,
  snippets?: string[]
): string {
  return `${SYSTEM_PROMPT}

${getStrategyPrompt(strategy, data, snippets)}

${RESPONSE_FORMAT}`;
}

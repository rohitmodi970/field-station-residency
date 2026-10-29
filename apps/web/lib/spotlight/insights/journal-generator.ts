/**
 * Journal Insights Generator
 * 
 * Generates personalized insights from user's analyzed journal entries.
 * Uses aggregated data from recent analyses to surface patterns, trends, and suggestions.
 */

import { createAdminClient } from '@/utils/supabase/admin';
import type { SpotlightInsight } from '../types';
import type { 
  JournalAnalysisData, 
  AggregatedJournalData, 
  JournalInsightOptions,
  JournalInsightTemplate 
} from './types';
import { maybeRewriteInsightsWithLLM, sanitizeInsightCopy } from './copy-style';

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_OPTIONS: Required<JournalInsightOptions> = {
  maxInsights: 3,
  lookbackDays: 14,
  minEntries: 3,
  useAI: false,
  aiProvider: 'claude',
};

// ============================================
// INSIGHT TEMPLATES
// ============================================

const JOURNAL_INSIGHT_TEMPLATES: JournalInsightTemplate[] = [
  // Positive sentiment insight
  {
    id: 'sentiment-positive',
    type: 'sentiment',
    condition: (data) => data.avgSentiment > 0.3 && data.entryCount >= 3,
    generate: (data) => ({
      title: 'Your mood is trending positive',
      body: `Your recent ${data.entryCount} entries show ${Math.round(((data.avgSentiment + 1) / 2) * 100)}% positive sentiment. Keep capturing these good moments.`,
      icon: 'S',
      priority: 70,
      strategyType: 'journal_sentiment' as const,
      actionLabel: 'Write about today',
      actionTarget: '/journal/new',
    }),
    priority: 70,
  },
  
  // Negative sentiment insight (supportive)
  {
    id: 'sentiment-support',
    type: 'sentiment',
    condition: (data) => data.avgSentiment < -0.2 && data.entryCount >= 3,
    generate: () => ({
      title: 'This week has been challenging',
      body: `Your entries reflect some difficult times. Journaling through tough periods can help process emotions. You're doing great by showing up.`,
      icon: 'C',
      priority: 85,
      strategyType: 'journal_sentiment' as const,
      actionLabel: 'Reflect on today',
      actionTarget: '/journal/new',
    }),
    priority: 85,
  },

  // Sentiment improving
  {
    id: 'sentiment-improving',
    type: 'sentiment',
    condition: (data) => data.sentimentTrend === 'improving' && data.entryCount >= 5,
    generate: () => ({
      title: 'Your mood is improving',
      body: `Your recent entries show your sentiment trending upward. Whatever you're doing, it seems to be working.`,
      icon: 'T',
      priority: 75,
      strategyType: 'journal_trend' as const,
      actionLabel: 'Keep the momentum',
      actionTarget: '/journal/new',
    }),
    priority: 75,
  },

  // Recurring topic insight
  {
    id: 'topic-recurring',
    type: 'topic',
    condition: (data) => data.topTopics.length > 0 && data.topTopics[0]!.count >= 3,
    generate: (data) => {
      const top = data.topTopics[0]!;
      const sentimentLabel = top.avgSentiment > 0.2 ? 'positively' : top.avgSentiment < -0.2 ? 'with mixed feelings' : 'neutrally';
      return {
        title: `"${capitalize(top.topic)}" keeps coming up`,
        body: `You've written about ${top.topic} ${top.count} times recently, mostly ${sentimentLabel}. This seems important to you.`,
        icon: 'R',
        priority: 65,
        strategyType: 'journal_topic' as const,
        actionLabel: 'Explore deeper',
        actionTarget: '/journal/new',
      };
    },
    priority: 65,
  },

  // Stress level high
  {
    id: 'stress-high',
    type: 'stress',
    condition: (data) => data.avgStressLevel > 0.6,
    generate: () => ({
      title: 'Your stress levels seem elevated',
      body: `Your recent entries indicate higher than usual stress. Consider trying some calming activities or reflecting on what's causing tension.`,
      icon: 'H',
      priority: 80,
      strategyType: 'journal_stress' as const,
      actionLabel: 'Explore stress relief',
      actionTarget: '/journal/new?prompt=stress',
    }),
    priority: 80,
  },

  // Stress decreasing
  {
    id: 'stress-decreasing',
    type: 'stress',
    condition: (data) => data.stressTrend === 'decreasing' && data.avgStressLevel < 0.4,
    generate: () => ({
      title: 'Stress levels are well managed',
      body: `Your stress indicators have been trending down. Keep doing what you're doing - it's working.`,
      icon: 'L',
      priority: 60,
      strategyType: 'journal_stress' as const,
      actionLabel: 'Celebrate progress',
      actionTarget: '/journal/new',
    }),
    priority: 60,
  },

  // Dominant emotion insight
  {
    id: 'emotion-dominant',
    type: 'emotion',
    condition: (data) => data.dominantEmotions.length > 0 && data.dominantEmotions[0]!.frequency >= 3,
    generate: (data) => {
      const emotion = data.dominantEmotions[0]!;
      const icon = getEmotionGlyph(emotion.emotion);
      return {
        title: `${capitalize(emotion.emotion)} has been prominent`,
        body: `This emotion appeared in ${emotion.frequency} of your recent entries with ${Math.round(emotion.avgIntensity * 100)}% intensity on average.`,
        icon,
        priority: 55,
        strategyType: 'journal_emotion' as const,
        actionLabel: 'Reflect on this',
        actionTarget: '/journal/new',
      };
    },
    priority: 55,
  },

  // Growth areas detected
  {
    id: 'growth-areas',
    type: 'growth',
    condition: (data) => data.growthAreas.length >= 2,
    generate: (data) => ({
      title: 'Growth areas are emerging',
      body: `Your journal reveals focus on: ${data.growthAreas.slice(0, 3).join(', ')}. These are great areas to nurture.`,
      icon: 'G',
      priority: 50,
      strategyType: 'journal_growth' as const,
      actionLabel: 'Set a goal',
      actionTarget: '/journal/new',
    }),
    priority: 50,
  },

  // Pattern: consistent journaling
  {
    id: 'pattern-consistent',
    type: 'pattern',
    condition: (data) => data.entryCount >= 7,
    generate: (data) => ({
      title: `${data.entryCount} entries this period`,
      body: `You've been journaling consistently. This habit is building valuable self-awareness.`,
      icon: 'P',
      priority: 45,
      strategyType: 'journal_pattern' as const,
      actionLabel: 'Keep it up',
      actionTarget: '/journal/new',
    }),
    priority: 45,
  },

  // Key insight surfacing
  {
    id: 'aggregated-insight',
    type: 'pattern',
    condition: (data) => data.aggregatedInsights.length > 0,
    generate: (data) => ({
      title: 'Insight from your entries',
      body: data.aggregatedInsights[0] || 'Your journaling is revealing interesting patterns.',
      icon: 'I',
      priority: 72,
      strategyType: 'journal_insight' as const,
      actionLabel: 'Explore more',
      actionTarget: '/journal/new',
    }),
    priority: 72,
  },
];

// ============================================
// HELPERS
// ============================================

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getEmotionGlyph(emotion: string): string {
  const glyphMap: Record<string, string> = {
    joy: 'J',
    happiness: 'H',
    excitement: 'E',
    gratitude: 'G',
    love: 'L',
    peace: 'P',
    calm: 'C',
    sadness: 'S',
    anxiety: 'A',
    stress: 'T',
    anger: 'R',
    frustration: 'F',
    fear: 'F',
    worry: 'W',
    hope: 'O',
    confidence: 'D',
    curiosity: 'Q',
    surprise: 'U',
  };
  return glyphMap[emotion.toLowerCase()] || 'E';
}

function generateInsightId(template: JournalInsightTemplate): string {
  return `journal-${template.id}-${Date.now()}`;
}

// ============================================
// DATA AGGREGATION
// ============================================

export async function fetchJournalAnalysisData(
  userId: string,
  lookbackDays: number
): Promise<JournalAnalysisData[]> {
  const adminClient = createAdminClient();
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  // Note: journal_analyses stores encrypted data in result_encrypted/result_iv
  // We can only access basic metadata without decryption
  // For now, we count analyzed entries and provide generic insights
  
  const { data: analyses, error } = await adminClient
    .from('journal_analyses')
    .select(`
      id,
      journal_id,
      analysis_type,
      word_count,
      created_at,
      journals!inner (
        user_id,
        created_at
      )
    `)
    .eq('journals.user_id', userId)
    .gte('created_at', cutoffDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !analyses) {
    console.error('[Journal Generator] Failed to fetch analyses:', error);
    return [];
  }

  // Since analyses are encrypted, we can only provide basic metadata-based insights
  // Return lightweight data based on what we can access
  return analyses.map((a: Record<string, unknown>) => ({
    // We don't have access to sentiment without decryption, but we have entry count
    overallSentiment: undefined,
    topics: undefined,
    emotionalPatterns: undefined,
    stressIndicators: undefined,
    keyInsights: undefined,
    // Track that an analysis exists
    _hasAnalysis: true,
    _wordCount: a.word_count as number | undefined,
  }));
}

export function aggregateJournalData(analyses: JournalAnalysisData[]): AggregatedJournalData {
  const entryCount = analyses.length;
  
  // Sentiment aggregation
  const sentiments = analyses
    .filter(a => a.overallSentiment?.score !== undefined)
    .map(a => a.overallSentiment!.score);
  const avgSentiment = sentiments.length > 0 
    ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length 
    : 0;
  
  // Sentiment trend (compare first half to second half)
  let sentimentTrend: 'improving' | 'stable' | 'declining' = 'stable';
  if (sentiments.length >= 4) {
    const mid = Math.floor(sentiments.length / 2);
    const firstHalf = sentiments.slice(mid).reduce((a, b) => a + b, 0) / (sentiments.length - mid);
    const secondHalf = sentiments.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const diff = secondHalf - firstHalf;
    if (diff > 0.15) sentimentTrend = 'improving';
    else if (diff < -0.15) sentimentTrend = 'declining';
  }

  // Topic aggregation
  const topicMap = new Map<string, { count: number; sentimentSum: number }>();
  for (const a of analyses) {
    for (const t of a.topics || []) {
      const existing = topicMap.get(t.topic.toLowerCase()) || { count: 0, sentimentSum: 0 };
      existing.count++;
      existing.sentimentSum += t.sentiment;
      topicMap.set(t.topic.toLowerCase(), existing);
    }
  }
  const topTopics = Array.from(topicMap.entries())
    .map(([topic, data]) => ({
      topic,
      count: data.count,
      avgSentiment: data.sentimentSum / data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Emotion aggregation
  const emotionMap = new Map<string, { frequency: number; intensitySum: number }>();
  for (const a of analyses) {
    for (const e of a.emotionalPatterns?.primaryEmotions || []) {
      const existing = emotionMap.get(e.emotion.toLowerCase()) || { frequency: 0, intensitySum: 0 };
      existing.frequency++;
      existing.intensitySum += e.intensity;
      emotionMap.set(e.emotion.toLowerCase(), existing);
    }
  }
  const dominantEmotions = Array.from(emotionMap.entries())
    .map(([emotion, data]) => ({
      emotion,
      frequency: data.frequency,
      avgIntensity: data.intensitySum / data.frequency,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 3);

  // Stress aggregation
  const stressLevels = analyses
    .filter(a => a.stressIndicators?.level !== undefined)
    .map(a => a.stressIndicators!.level);
  const avgStressLevel = stressLevels.length > 0
    ? stressLevels.reduce((a, b) => a + b, 0) / stressLevels.length
    : 0;
  
  // Stress trend
  let stressTrend: 'increasing' | 'stable' | 'decreasing' = 'stable';
  if (stressLevels.length >= 4) {
    const mid = Math.floor(stressLevels.length / 2);
    const firstHalf = stressLevels.slice(mid).reduce((a, b) => a + b, 0) / (stressLevels.length - mid);
    const secondHalf = stressLevels.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const diff = secondHalf - firstHalf;
    if (diff > 0.1) stressTrend = 'increasing';
    else if (diff < -0.1) stressTrend = 'decreasing';
  }

  // Growth areas and insights
  const growthAreas = Array.from(
    new Set(analyses.flatMap(a => a.growthIndicators?.areas || []))
  ).slice(0, 5);
  
  const aggregatedInsights = analyses
    .flatMap(a => a.keyInsights || [])
    .filter(Boolean)
    .slice(0, 3);

  // Recurring themes from topics
  const recurringThemes = topTopics
    .filter(t => t.count >= 2)
    .map(t => t.topic)
    .slice(0, 5);

  return {
    entryCount,
    avgSentiment,
    sentimentTrend,
    topTopics,
    dominantEmotions,
    recurringThemes,
    avgStressLevel,
    stressTrend,
    growthAreas,
    aggregatedInsights,
  };
}

// ============================================
// MAIN GENERATOR
// ============================================

export async function generateJournalInsights(
  userId: string,
  options?: JournalInsightOptions
): Promise<SpotlightInsight[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Fetch and aggregate data
  const analyses = await fetchJournalAnalysisData(userId, opts.lookbackDays);
  
  if (analyses.length < opts.minEntries) {
    return []; // Not enough data
  }

  const aggregated = aggregateJournalData(analyses);

  // Check if we have meaningful data (sentiment, topics, etc.)
  // If analyses are encrypted and we only have metadata, use fallback insights
  const hasMeaningfulData = aggregated.topTopics.length > 0 || 
    aggregated.dominantEmotions.length > 0 ||
    aggregated.avgSentiment !== 0;

  if (!hasMeaningfulData && analyses.length > 0) {
    // Provide fallback insights based on entry count only
    return generateFallbackInsights(analyses.length, opts.maxInsights);
  }

  // Find matching templates
  const matchingTemplates = JOURNAL_INSIGHT_TEMPLATES
    .filter(template => template.condition(aggregated))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, opts.maxInsights);

  // Generate insights
  const insights: SpotlightInsight[] = matchingTemplates.map(template => ({
    ...template.generate(aggregated),
    id: generateInsightId(template),
    type: 'journal' as const,
  }));

  const sanitizedInsights = insights.map(sanitizeInsightCopy);

  return maybeRewriteInsightsWithLLM(sanitizedInsights, {
    useAI: opts.useAI,
    aiProvider: opts.aiProvider,
  }, {
    segment: 'journal',
    facts: [
      `entryCount=${aggregated.entryCount}`,
      `sentimentTrend=${aggregated.sentimentTrend}`,
      `stressTrend=${aggregated.stressTrend}`,
      `topTopics=${aggregated.topTopics.slice(0, 2).map(t => t.topic).join('|') || 'none'}`,
    ],
  });
}

/**
 * Fallback insights when detailed analysis data is not available
 * (e.g., when analyses are encrypted)
 */
function generateFallbackInsights(entryCount: number, maxInsights: number): SpotlightInsight[] {
  const insights: SpotlightInsight[] = [];

  if (entryCount >= 3) {
    insights.push({
      id: `journal-active-${Date.now()}`,
      type: 'journal',
      title: `You've analyzed ${entryCount} entries recently`,
      body: 'Your journaling practice is building valuable insights. Keep it up!',
      icon: 'A',
      priority: 60,
      strategyType: 'journal_pattern' as const,
      actionLabel: 'Write today',
      actionTarget: '/journal/new',
    });
  }

  if (entryCount >= 5) {
    insights.push({
      id: `journal-consistent-${Date.now()}`,
      type: 'journal',
      title: 'Consistency is key',
      body: 'Regular journaling helps track patterns over time. Your recent entries show great commitment.',
      icon: 'C',
      priority: 55,
      strategyType: 'journal_trend' as const,
      actionLabel: 'Continue writing',
      actionTarget: '/journal/new',
    });
  }

  if (entryCount >= 7) {
    insights.push({
      id: `journal-milestone-${Date.now()}`,
      type: 'journal',
      title: `${entryCount} entries analyzed`,
      body: 'You\'re building a rich record of your thoughts and feelings. Each entry adds to your self-understanding.',
      icon: 'M',
      priority: 65,
      strategyType: 'journal_growth' as const,
      actionLabel: 'Explore journals',
      actionTarget: '/journal',
    });
  }

  return insights.slice(0, maxInsights);
}

export default generateJournalInsights;

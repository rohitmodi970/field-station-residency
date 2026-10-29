/**
 * Spotlight Insights - Type Definitions
 * 
 * Types for journal-based and waitlist-based insight generation.
 */

import type { SpotlightInsight, InsightType } from '../types';

// ============================================
// JOURNAL ANALYSIS TYPES
// ============================================

export interface JournalAnalysisData {
  /** Sentiment score (-1 to 1) */
  overallSentiment?: {
    score: number;
    label: string;
  };
  /** Primary emotions detected */
  emotionalPatterns?: {
    primaryEmotions: Array<{
      emotion: string;
      intensity: number;
    }>;
    emotionalArc?: string;
  };
  /** Topics mentioned */
  topics?: Array<{
    topic: string;
    sentiment: number;
    relevance?: number;
  }>;
  /** Key insights from analysis */
  keyInsights?: string[];
  /** Suggested actions */
  suggestedActions?: string[];
  /** Stress indicators */
  stressIndicators?: {
    level: number;
    triggers?: string[];
  };
  /** Growth patterns */
  growthIndicators?: {
    areas: string[];
    progress?: string;
  };
}

export interface AggregatedJournalData {
  /** Number of entries analyzed */
  entryCount: number;
  /** Average sentiment over period */
  avgSentiment: number;
  /** Sentiment trend direction */
  sentimentTrend: 'improving' | 'stable' | 'declining';
  /** Most frequent topics */
  topTopics: Array<{ topic: string; count: number; avgSentiment: number }>;
  /** Dominant emotions */
  dominantEmotions: Array<{ emotion: string; frequency: number; avgIntensity: number }>;
  /** Recurring themes */
  recurringThemes: string[];
  /** Average stress level */
  avgStressLevel: number;
  /** Stress trend */
  stressTrend: 'increasing' | 'stable' | 'decreasing';
  /** Growth areas mentioned */
  growthAreas: string[];
  /** Key insights across entries */
  aggregatedInsights: string[];
}

// ============================================
// WAITLIST/ONBOARDING TYPES
// ============================================

export interface WaitlistInsightData {
  /** User's name */
  name?: string;
  /** User's goals */
  goals?: string[];
  /** User's interests */
  interests?: string[];
  /** Energy level response */
  energyLevel?: string;
  /** Commitment level */
  commitment?: boolean;
  /** User's reflection text */
  reflection?: string;
  /** Days since signup */
  daysSinceSignup: number;
  /** Has started journaling */
  hasStartedJournaling?: boolean;
  /** Number of entries */
  entryCount: number;
  /** Whether profile is complete */
  profileComplete?: boolean;
}

// ============================================
// INSIGHT GENERATION OPTIONS
// ============================================

export interface JournalInsightOptions {
  /** Maximum insights to generate */
  maxInsights?: number;
  /** Time period in days */
  lookbackDays?: number;
  /** Minimum entries needed */
  minEntries?: number;
  /** Include AI-generated insights */
  useAI?: boolean;
  /** AI provider */
  aiProvider?: 'claude' | 'gemini' | 'openai';
}

export interface WaitlistInsightOptions {
  /** Maximum insights to generate */
  maxInsights?: number;
  /** Personalization level */
  personalizationLevel?: 'basic' | 'moderate' | 'high';
  /** Include goal-based prompts */
  includeGoalPrompts?: boolean;
  /** Include onboarding insights */
  includeOnboarding?: boolean;
  /** Use AI enhancement */
  useAI?: boolean;
  /** AI provider */
  aiProvider?: 'claude' | 'gemini' | 'openai';
}

export interface InsightOrchestratorOptions {
  /** Maximum total insights */
  maxTotalInsights?: number;
  /** Enable journal-based insights */
  enableJournalInsights?: boolean;
  /** Enable waitlist-based insights */
  enableWaitlistInsights?: boolean;
  /** Enable AI enhancement */
  enableAIEnhancement?: boolean;
  /** AI provider */
  aiProvider?: 'claude' | 'gemini' | 'openai';
  /** Force refresh (bypass cache) */
  forceRefresh?: boolean;
}

// ============================================
// INSIGHT TEMPLATES
// ============================================

export interface JournalInsightTemplate {
  id: string;
  type: 'sentiment' | 'topic' | 'emotion' | 'stress' | 'growth' | 'pattern';
  condition: (data: AggregatedJournalData) => boolean;
  generate: (data: AggregatedJournalData) => Omit<SpotlightInsight, 'id' | 'type'>;
  priority: number;
}

export interface WaitlistInsightTemplate {
  id: string;
  category: 'welcome' | 'goal' | 'motivation' | 'tip' | 'encouragement';
  condition: (data: WaitlistInsightData) => boolean;
  generate: (data: WaitlistInsightData) => Omit<SpotlightInsight, 'id' | 'type'>;
  priority: number;
}

// ============================================
// RESULT TYPES
// ============================================

export interface InsightGenerationResult {
  insights: SpotlightInsight[];
  source: InsightType;
  generatedAt: Date;
  metadata?: {
    dataPoints?: number;
    aiEnhanced?: boolean;
    processingMs?: number;
  };
}

export interface OrchestratedInsightsResult {
  insights: SpotlightInsight[];
  sources: {
    waitlist: number;
    journal: number;
    reengagement: number;
  };
  blendRatios: {
    waitlist: number;
    journal: number;
    reengagement: number;
  };
  generatedAt: Date;
  processingMs: number;
}

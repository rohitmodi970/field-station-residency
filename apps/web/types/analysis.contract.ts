// Shared analysis contract definitions (Phase 1 SSOT foundation)

export const ANALYSIS_CATEGORIES = [
  'text_single',
  'text_multi',
  'sentiment_quick',
  'audio_emotion',
  'audio_voice',
  'embeddings_graph',
  'insights_records',
] as const;

export type AnalysisCategory = (typeof ANALYSIS_CATEGORIES)[number];

export const SINGLE_ENTRY_ANALYSIS_TYPES = ['sentiment', 'textual', 'combined'] as const;
export type SingleEntryAnalysisType = (typeof SINGLE_ENTRY_ANALYSIS_TYPES)[number];

export const MULTI_ENTRY_ANALYSIS_TYPES = [
  'sentiment',
  'topics',
  'goals',
  'mood',
  'wordCloud',
  'socialInteractions',
  'activities',
  'timeAllocation',
  'all',
] as const;
export type MultiEntryAnalysisType = (typeof MULTI_ENTRY_ANALYSIS_TYPES)[number];

export const ANALYSIS_TIMEFRAMES = ['day', 'week', 'month', 'custom'] as const;
export type AnalysisTimeframe = (typeof ANALYSIS_TIMEFRAMES)[number];

export const LLM_PROVIDERS = ['gemini', 'openai', 'claude'] as const;
export type LLMProvider = (typeof LLM_PROVIDERS)[number];

export const AUDIO_EMOTION_PROVIDERS = ['imentiv', 'hume'] as const;
export type AudioEmotionProviderType = (typeof AUDIO_EMOTION_PROVIDERS)[number];

export interface NormalizedAnalysisResult {
  category: AnalysisCategory;
  summary?: string;
  sentiment?: {
    score?: number;
    label?: 'positive' | 'negative' | 'neutral';
    confidence?: number;
  };
  topics?: string[];
  keywords?: string[];
  metadata?: Record<string, unknown>;
}

export function isSingleEntryAnalysisType(value: unknown): value is SingleEntryAnalysisType {
  return typeof value === 'string' && (SINGLE_ENTRY_ANALYSIS_TYPES as readonly string[]).includes(value);
}

export function isMultiEntryAnalysisType(value: unknown): value is MultiEntryAnalysisType {
  return typeof value === 'string' && (MULTI_ENTRY_ANALYSIS_TYPES as readonly string[]).includes(value);
}

export function isAnalysisTimeframe(value: unknown): value is AnalysisTimeframe {
  return typeof value === 'string' && (ANALYSIS_TIMEFRAMES as readonly string[]).includes(value);
}

export function isLLMProvider(value: unknown): value is LLMProvider {
  return typeof value === 'string' && (LLM_PROVIDERS as readonly string[]).includes(value);
}

export function isAudioEmotionProvider(value: unknown): value is AudioEmotionProviderType {
  return typeof value === 'string' && (AUDIO_EMOTION_PROVIDERS as readonly string[]).includes(value);
}


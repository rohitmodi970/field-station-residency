// filename: humeParserUtils.ts
// Improved/defensive helpers for transforming Hume Expression Measurement outputs.

import type { UnifiedTranscriptEntry, AnalysisResults } from '@/services/hume/AnalysisService';

/**
 * Extract a simple transcript string from unified transcript entries.
 * - trims whitespace
 * - collapses multiple spaces/newlines
 */
export function extractSimpleTranscript(unified: UnifiedTranscriptEntry[] = []): string {
  if (!Array.isArray(unified) || unified.length === 0) return '';
  return unified
    .map(entry => (entry?.text ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Aggregate raw emotion entries into a map { name -> totalScore }.
 * Accepts an array of { name, score } items and will sum duplicate emotion names.
 */
export function aggregateEmotions(
  raw: Array<{ name: string; score?: number }> = []
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of raw || []) {
    if (!e || !e.name) continue;
    const name = String(e.name).toLowerCase();
    const score = typeof e.score === 'number' && !Number.isNaN(e.score) ? e.score : 0;
    map[name] = (map[name] || 0) + score;
  }
  return map;
}

/**
 * Get top emotions by score from an aggregated map
 */
export function getTopEmotions(
  emotions: Record<string, number> = {},
  limit: number = 10
): Array<{ name: string; score: number }> {
  return Object.entries(emotions)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Calculate emotion distribution percentages
 */
export function calculateEmotionDistribution(
  emotions: Record<string, number> = {}
): {
  positive: number;
  neutral: number;
  negative: number;
  emotions: Record<string, number>;
} {
  // Define emotion categories
  const positiveEmotions = new Set([
    'joy', 'happiness', 'excitement', 'contentment', 'satisfaction',
    'pride', 'amusement', 'relief', 'hope', 'optimism'
  ]);
  
  const negativeEmotions = new Set([
    'sadness', 'anger', 'fear', 'anxiety', 'disgust', 'contempt',
    'frustration', 'disappointment', 'shame', 'guilt', 'worry'
  ]);

  let positiveScore = 0;
  let negativeScore = 0;
  let neutralScore = 0;
  let totalScore = 0;

  Object.entries(emotions || {}).forEach(([name, score]) => {
    const lowerName = String(name).toLowerCase();
    const numeric = typeof score === 'number' && !Number.isNaN(score) ? score : 0;

    if (Array.from(positiveEmotions).some(e => lowerName.includes(e))) {
      positiveScore += numeric;
    } else if (Array.from(negativeEmotions).some(e => lowerName.includes(e))) {
      negativeScore += numeric;
    } else {
      neutralScore += numeric;
    }

    totalScore += numeric;
  });

  // If totalScore is zero (no emotions) fall back to 1 to avoid division by zero,
  // but return zeros for all categories.
  if (totalScore <= 0) {
    return {
      positive: 0,
      neutral: 0,
      negative: 0,
      emotions,
    };
  }

  const positive = positiveScore / totalScore;
  const neutral = neutralScore / totalScore;
  const negative = negativeScore / totalScore;

  return {
    positive,
    neutral,
    negative,
    emotions,
  };
}

/**
 * Format analysis results for frontend consumption
 */
export function formatAnalysisForFrontend(
  analysis: AnalysisResults
): {
  transcript: string;
  emotions: Record<string, number>;
  emotionDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topEmotions: Array<{ name: string; score: number }>;
  topics: Array<{ terms: Array<{ term: string; probability: number }> }>;
  speakers: string[];
  summary: AnalysisResults['summary'];
} {
  // Defensive guards in case analysis is missing fields
  const transcript = typeof analysis?.transcript === 'string' ? analysis.transcript : '';
  // `analysis.emotions` may be already aggregated or a raw map - assume it's a map
  const emotionsMap: Record<string, number> = analysis?.emotions && typeof analysis.emotions === 'object'
    ? analysis.emotions
    : {};

  const emotionDist = calculateEmotionDistribution(emotionsMap);
  const topEmotions = getTopEmotions(emotionsMap, 10);

  const topics = Array.isArray(analysis?.topics) ? analysis.topics : [];
  const speakers = Array.isArray(analysis?.speakers)
    ? analysis.speakers.filter(s => typeof s === 'string' && s.trim().length > 0)
    : [];

  return {
    transcript,
    emotions: emotionsMap,
    emotionDistribution: {
      positive: emotionDist.positive,
      neutral: emotionDist.neutral,
      negative: emotionDist.negative,
    },
    topEmotions,
    topics,
    speakers,
    summary: analysis?.summary ?? null,
  };
}

/**
 * Create time-series data for emotions over time.
 * - Accepts UnifiedTranscriptEntry[] (each entry may contain multiple emotion arrays).
 * - For each entry, aggregates matching emotionName from all model groups and averages them.
 * - Returns an array sorted ascending by time.
 */
export function createEmotionTimeSeries(
  unified: UnifiedTranscriptEntry[] = [],
  emotionName: string
): Array<{ time: number; value: number }> {
  if (!Array.isArray(unified) || !emotionName) return [];

  const series: Array<{ time: number; value: number }> = unified.map(entry => {
    const time = (entry?.time?.begin ?? entry?.time ?? 0) as number;
    // Collect candidate emotion scores from possible places (languageEmotions/prosodyEmotions/burstEmotions)
    const rawEmotions: Array<{ name: string; score?: number }> = [
      ...(Array.isArray(entry?.languageEmotions) ? entry.languageEmotions : []),
      ...(Array.isArray(entry?.prosodyEmotions) ? entry.prosodyEmotions : []),
      ...(Array.isArray(entry?.burstEmotions) ? entry.burstEmotions : []),
    ];

    // find all matching emotions and average their scores
    const matches = rawEmotions
      .filter(e => e && typeof e.name === 'string' && e.name.toLowerCase() === emotionName.toLowerCase())
      .map(e => (typeof e.score === 'number' && !Number.isNaN(e.score) ? e.score : 0));

    const value = matches.length > 0
      ? matches.reduce((s, v) => s + v, 0) / matches.length
      : 0;

    return { time: Number(time || 0), value };
  });

  // Sort by time ascending and filter out NaN times
  return series
    .filter(pt => Number.isFinite(pt.time))
    .sort((a, b) => a.time - b.time);
}

/**
 * Helper: build an aggregated emotion map from a UnifiedTranscriptEntry[].
 * This is useful if you want a global emotion map to feed `calculateEmotionDistribution`.
 */
export function buildGlobalEmotionMap(unified: UnifiedTranscriptEntry[] = []) {
  const aggregate: Record<string, number> = {};

  for (const entry of unified || []) {
    const allEmotions = [
      ...(Array.isArray(entry?.languageEmotions) ? entry.languageEmotions : []),
      ...(Array.isArray(entry?.prosodyEmotions) ? entry.prosodyEmotions : []),
      ...(Array.isArray(entry?.burstEmotions) ? entry.burstEmotions : []),
    ];

    const local = aggregateEmotions(allEmotions);
    for (const [name, score] of Object.entries(local)) {
      aggregate[name] = (aggregate[name] || 0) + score;
    }
  }

  return aggregate;
}

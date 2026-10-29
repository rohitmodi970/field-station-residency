"use client";
/* eslint-disable */

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Upload, Music, FileText, BarChart2, Loader2, Users, Clock, Play, Pause } from "lucide-react";
import axios from 'axios';
import { AudioVisualizations } from "@/components/audio-analysis/AudioVisualizations";
import { AudioRecorder } from "@/components/audio-analysis/AudioRecorder";
import TextAnalysisTabs from '@/components/audio-analysis/TextAnalysisTabs';
import EmotionTab from '@/components/voiceAnalysis/EmotionTab';
import TextTab from '@/components/voiceAnalysis/TextTab';
import { aggregateToEnrichedEmotions, getSentimentFromEnriched, ENRICHED_EMOTION_EMOJI, ENRICHED_EMOTION_GRADIENT, EnrichedEmotion, mapToBasicEmotion, BasicEmotion } from '@/utilities/emotionMapping';
import { useVault } from '@/hooks/useVault';
import { getAllJournalEntriesWithStatus } from '@/utilities/journal-data';
import { MediaItem } from '@/types/vault';
import { useAiDecryption } from '@/utils/encryption/useAiDecryption';

// Legacy Deepgram + Gemini interface
interface LegacyAnalysisResults {
  metadata: {
    filename: string;
    filesize: number;
    timestamp: string;
  };
  deepgram: {
    transcript: string;
    confidence: number;
    sentiment: {
      positive: number;
      neutral: number;
      negative: number;
      overall: string;
      score: number;
    };
    topics: string[];
    keywords: string[];
    summary: string;
  };
  gemini: {
    summary: string;
    keyPoints: string[];
    insights: string[];
    emotions: {
      primary: string;
      secondary: string[];
      intensity: number;
    };
    speechPatterns: {
      pace: string;
      clarity: number;
      confidence: number;
    };
    recommendations: string[];
    lifeInsights: {
      shortTerm: string[];
      longTerm: string[];
      actionableSteps: string[];
      mindsetShifts: string[];
    };
    textAnalysis?: {
      coreValues: any;
    };
    visualizationData: {
      emotionDistribution: {
        labels: string[];
        values: number[];
      };
      topicRelevance: {
        labels: string[];
        values: number[];
      };
      speechMetrics: {
        labels: string[];
        values: number[];
      };
      insightCategories: {
        labels: string[];
        values: number[];
      };
      recommendationPriority: {
        labels: string[];
        values: number[];
      };
      mindMap?: any;
      energyPatterns?: any;
      growthInsights?: any;
    };
  };
}

// Hume analysis interface
interface HumeAnalysisResults {
  transcript: string;
  unifiedTranscript: Array<{
    text: string;
    time: { begin: number; end: number };
    speaker: string;
    languageEmotions: Array<{ name: string; score: number }>;
    prosodyEmotions: Array<{ name: string; score: number }>;
    burstEmotions: Array<{ name: string; score: number }>;
  }>;
  speakers: string[];
  emotions: Record<string, number>;
  basicEmotions?: Record<string, number>;
  enrichedEmotions?: Record<string, number>;
  topics: Array<{
    terms: Array<{ term: string; probability: number }>;
  }>;
  keywords?: string[];
  summary: {
    totalDuration: number;
    speakerCount: number;
    emotionDistribution: Record<string, number>;
    basicEmotionDistribution?: Record<string, number>;
    enrichedEmotionDistribution?: Record<string, number>;
    topTopics: string[];
  };
}

interface HumeJobStatus {
  jobId: string;
  humeJobId: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  sourceUrl: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  rawStatus?: string | null;
  rawReason?: string | null;
  statusMessage?: string;
  elapsedSeconds?: number;
  hasResults: boolean;
  analysis?: HumeAnalysisResults;
}

type AnalysisResults = LegacyAnalysisResults | { type: 'hume'; data: HumeAnalysisResults; metadata: { filename: string; filesize: number; timestamp: string } };

interface AnalysisHistoryEntry {
  id: string;
  date: string;
  filename: string;
  summary: string;
  analysis: AnalysisResults;
}

type AudioLibrarySource = 'saved' | 'journal';

interface AudioLibraryItem {
  id: string;
  source: AudioLibrarySource;
  title: string;
  sourceUrl: string;
  createdAt?: string;
  duration?: number;
  fileName?: string;
  mimeType?: string;
  journalId?: string;
  journalTitle?: string;
}

const MAX_HISTORY_ITEMS = 20;

type SixEmotionName = 'happiness' | 'sadness' | 'disgust' | 'anger' | 'fear' | 'surprise';
type SixEmotionScores = Record<SixEmotionName, number>;

function createHistoryEntryId(filename: string, timestamp: string): string {
  const randomPart = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${filename}-${timestamp}-${randomPart}`;
}

function dedupeHistoryEntries(entries: AnalysisHistoryEntry[]): AnalysisHistoryEntry[] {
  const seen = new Set<string>();
  const unique: AnalysisHistoryEntry[] = [];

  for (const entry of entries) {
    const key = `${entry.id}::${entry.filename}::${entry.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }

  return unique;
}

// Type guard to check if result is legacy (Deepgram/Gemini)
function isLegacyResult(result: AnalysisResults): result is LegacyAnalysisResults {
  return !('type' in result) || result.type !== 'hume';
}

type DemoEmotion = {
  name: string;
  value: number;
};

type DemoPersonalitySignal = {
  name: string;
  explanation: string;
};

type DemoClimate = {
  label: string;
  icon: string;
  colorClass: string;
  note: string;
};

type DemoCompass = {
  x: number;
  y: number;
  focus: string;
  guidance: string;
};

type DemoInsights = {
  dominantEmotion: DemoEmotion;
  emotionalMix: DemoEmotion[];
  polarity: {
    positive: number;
    neutral: number;
    negative: number;
    narrative: string;
  };
  themes: string[];
  insightSummary: string;
  reflectionInsight: string;
  personalitySignals: DemoPersonalitySignal[];
  timeline: Array<{ timeRange: string; emotion: string }>;
  contextStats: {
    durationSeconds: number;
    speakerCount: number;
    transcriptLength: number;
  };
  enrichedTop: Array<{ name: EnrichedEmotion; value: number }>;
  sixFromEnriched: Array<{ name: string; value: number; contributors: EnrichedEmotion[] }>;
  moments: Array<{ timeRange: string; text: string; signal: string; category: string }>;
  nextSteps: string[];
  climate: DemoClimate;
  compass: DemoCompass;
};

const SIX_EMOTION_ORDER = ['happiness', 'sadness', 'disgust', 'anger', 'fear', 'surprise'] as const;
const ENRICHED_TO_SIX: Record<EnrichedEmotion, SixEmotionName> = {
  [EnrichedEmotion.HAPPINESS]: 'happiness',
  [EnrichedEmotion.LOVE_WARMTH]: 'happiness',
  [EnrichedEmotion.WONDER]: 'surprise',
  [EnrichedEmotion.SERENITY]: 'happiness',
  [EnrichedEmotion.CURIOSITY]: 'surprise',
  [EnrichedEmotion.SURPRISE]: 'surprise',
  [EnrichedEmotion.SADNESS]: 'sadness',
  [EnrichedEmotion.ANXIETY]: 'fear',
  [EnrichedEmotion.FEAR]: 'fear',
  [EnrichedEmotion.FRUSTRATION]: 'anger',
  [EnrichedEmotion.DISCOMFORT]: 'disgust',
  [EnrichedEmotion.DISGUST]: 'disgust',
};



const SIX_EMOTION_THEME: Record<SixEmotionName, { emoji: string; gradient: string }> = {
  happiness: { emoji: 'Sun', gradient: 'from-amber-400 to-orange-500' },
  sadness: { emoji: 'Rain', gradient: 'from-blue-500 to-indigo-500' },
  anger: { emoji: 'Fire', gradient: 'from-red-500 to-rose-500' },
  fear: { emoji: 'Storm', gradient: 'from-violet-500 to-purple-600' },
  disgust: { emoji: 'Fog', gradient: 'from-lime-500 to-emerald-600' },
  surprise: { emoji: 'Spark', gradient: 'from-cyan-400 to-sky-500' },
};

function normalizeBasicEmotionName(name: string): string {
  const key = name.trim().toLowerCase();
  if (key === 'joy') return 'happiness';
  return key;
}

function isSixEmotionName(name: string): name is SixEmotionName {
  return (SIX_EMOTION_ORDER as readonly string[]).includes(name);
}

function toSixEmotionPercentages(result: HumeAnalysisResults): SixEmotionScores {
  const fromBasic = result.basicEmotions || {};
  const normalized: SixEmotionScores = {
    happiness: 0,
    sadness: 0,
    disgust: 0,
    anger: 0,
    fear: 0,
    surprise: 0,
  };

  for (const [name, rawScore] of Object.entries(fromBasic)) {
    const mapped = normalizeBasicEmotionName(name);
    if (isSixEmotionName(mapped)) {
      normalized[mapped] += Number(rawScore) || 0;
    }
  }

  const total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    normalized.happiness = 1;
    return normalized;
  }

  for (const key of Object.keys(normalized) as SixEmotionName[]) {
    normalized[key] = normalized[key] / total;
  }

  return normalized;
}

function extractString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value
      .map((item) => extractString(item))
      .filter(Boolean)
      .join(' ');
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.transcript === 'string') return obj.transcript;
    if (typeof obj.summary === 'string') return obj.summary;
    if (typeof obj.content === 'string') return obj.content;
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

function titleCase(input: string): string {
  return input
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function deriveThemes(result: HumeAnalysisResults): string[] {
  const terms = (result.topics || [])
    .flatMap((topic) => (topic.terms || []).map((term) => (typeof term?.term === 'string' ? term.term.toLowerCase() : '')))
    .filter(Boolean);
  const transcript = extractString(result.transcript).toLowerCase();

  const has = (candidates: string[]) =>
    candidates.some((candidate) => transcript.includes(candidate) || terms.some((term) => term.includes(candidate)));

  const themes: string[] = [];

  if (has(['overload', 'too much', 'noise', 'clutter', 'overwhelmed', 'information'])) {
    themes.push('Information overload');
  }
  if (has(['media', 'platform', 'channels', 'feeds', 'fragmented', 'scattered'])) {
    themes.push('Media fragmentation');
  }
  if (has(['build', 'create', 'solution', 'system', 'approach', 'improve'])) {
    themes.push('Desire for better systems');
  }
  if (has(['decision', 'choice', 'explore', 'option', 'direction'])) {
    themes.push('Active decision exploration');
  }
  if (has(['future', 'next', 'plan', 'goal', 'vision'])) {
    themes.push('Future-oriented thinking');
  }

  if (themes.length < 3) {
    const fallback = terms
      .filter((term) => term.length > 3)
      .slice(0, 6)
      .map((term) => titleCase(term.replace(/[_-]/g, ' ')));
    for (const term of fallback) {
      if (themes.length >= 3) break;
      const candidate = `${term} focus`;
      if (!themes.includes(candidate)) themes.push(candidate);
    }
  }

  return themes.slice(0, 3);
}

function derivePersonalitySignals(result: HumeAnalysisResults, six: SixEmotionScores): DemoPersonalitySignal[] {
  const transcript = extractString(result.transcript).toLowerCase();
  const hasAny = (words: string[]) => words.some((word) => transcript.includes(word));

  const signals: DemoPersonalitySignal[] = [];

  if (hasAny(['why', 'how', 'explore', 'idea', 'question', 'curious']) || six.surprise > 0.18 || six.happiness > 0.28) {
    signals.push({
      name: 'Curiosity',
      explanation: 'Your reflection suggests exploratory thinking and interest in possibilities.'
    });
  }

  if (hasAny(['because', 'system', 'process', 'pattern', 'structure', 'underlying'])) {
    signals.push({
      name: 'Analytical Thinking',
      explanation: 'You tend to break ideas into causes, systems, and underlying patterns.'
    });
  }

  if (hasAny(['feel', 'emotion', 'sensitive', 'impact', 'hurt', 'care']) || (six.sadness + six.fear + six.disgust) > 0.45) {
    signals.push({
      name: 'Emotional Sensitivity',
      explanation: 'Your language and tone show awareness of emotional nuance and impact.'
    });
  }

  if (hasAny(['will', 'commit', 'decide', 'build', 'ship', 'make it']) || six.anger > 0.22) {
    signals.push({
      name: 'Determination',
      explanation: 'There are clear signals of drive and commitment in how you frame next steps.'
    });
  }

  if (signals.length === 0) {
    signals.push({
      name: 'Idea Exploration',
      explanation: 'Your reflection indicates active thinking and openness to new directions.'
    });
  }

  return signals.slice(0, 3);
}

function basicEmotionToSixName(basic: BasicEmotion): string {
  if (basic === BasicEmotion.JOY) return 'happiness';
  return basic.toLowerCase();
}

function deriveEmotionTimeline(result: HumeAnalysisResults): Array<{ timeRange: string; emotion: string }> {
  const entries = result.unifiedTranscript || [];
  if (entries.length === 0) return [];

  const totalDuration = result.summary?.totalDuration || entries[entries.length - 1]?.time?.end || 0;
  if (totalDuration <= 0) return [];

  const bucketCount = Math.min(4, Math.max(2, Math.ceil(totalDuration / 10)));
  const bucketSize = totalDuration / bucketCount;
  const buckets: SixEmotionScores[] = Array.from({ length: bucketCount }, () => ({
    happiness: 0,
    sadness: 0,
    disgust: 0,
    anger: 0,
    fear: 0,
    surprise: 0,
  }));

  for (const entry of entries) {
    const begin = entry.time?.begin ?? 0;
    const index = Math.min(bucketCount - 1, Math.floor(begin / bucketSize));
    const allEmotions = [
      ...(entry.languageEmotions || []),
      ...(entry.prosodyEmotions || []),
      ...(entry.burstEmotions || []),
    ];

    for (const emotion of allEmotions) {
      const basic = mapToBasicEmotion(emotion.name);
      const mapped = basicEmotionToSixName(basic);
      const bucket = buckets[index];
      if (bucket && isSixEmotionName(mapped)) {
        bucket[mapped] += emotion.score || 0;
      }
    }
  }

  return buckets.map((bucket, index) => {
    const dominant = Object.entries(bucket).sort((a, b) => b[1] - a[1])[0]?.[0] || 'happiness';
    const start = Math.round(index * bucketSize);
    const end = Math.round((index + 1) * bucketSize);
    return {
      timeRange: `${start}-${end}s`,
      emotion: dominant,
    };
  });
}

function deriveEnrichedTop(result: HumeAnalysisResults): Array<{ name: EnrichedEmotion; value: number }> {
  const enriched = result.enrichedEmotions || aggregateToEnrichedEmotions(result.emotions || {});
  return Object.entries(enriched)
    .map(([name, value]) => ({ name: name as EnrichedEmotion, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value)
    .filter((row) => row.value > 0)
    .slice(0, 8);
}

function deriveSixFromEnriched(result: HumeAnalysisResults): Array<{ name: string; value: number; contributors: EnrichedEmotion[] }> {
  const enriched = result.enrichedEmotions || aggregateToEnrichedEmotions(result.emotions || {});
  const totals: SixEmotionScores = {
    happiness: 0,
    sadness: 0,
    disgust: 0,
    anger: 0,
    fear: 0,
    surprise: 0,
  };
  const contributors: Record<SixEmotionName, EnrichedEmotion[]> = {
    happiness: [],
    sadness: [],
    disgust: [],
    anger: [],
    fear: [],
    surprise: [],
  };

  for (const [name, value] of Object.entries(enriched)) {
    const typed = name as EnrichedEmotion;
    const mapped = ENRICHED_TO_SIX[typed];
    if (!mapped) continue;
    totals[mapped] += Number(value) || 0;
    if (!contributors[mapped].includes(typed)) {
      contributors[mapped].push(typed);
    }
  }

  const total = Object.values(totals).reduce((sum, value) => sum + value, 0) || 1;
  return Object.entries(totals)
    .map(([name, value]) => ({
      name,
      value: value / total,
      contributors: contributors[name as SixEmotionName] || [],
    }))
    .sort((a, b) => b.value - a.value);
}

function deriveNextSteps(dominant: string, polarity: DemoInsights['polarity'], themes: string[]): string[] {
  const topTheme = themes[0] || 'your priorities';
  if (dominant === 'fear' || dominant === 'sadness' || polarity.negative >= 45) {
    return [
      `Name one concrete stress trigger around ${topTheme} and write a 2-line plan to reduce it this week.`,
      'Re-record a 60-second reflection focused on one thing you can control right now.',
      'Use a slower speaking pace for 30 seconds to reduce emotional overload and improve clarity.',
    ];
  }
  if (dominant === 'anger' || dominant === 'disgust') {
    return [
      `Convert frustration about ${topTheme} into one specific boundary or decision by end of day.`,
      'Before your next recording, do a quick reset: 3 deep breaths and one sentence of intention.',
      'Track one moment where tone softens; reinforce that pattern in tomorrow\'s reflection.',
    ];
  }
  if (dominant === 'surprise') {
    return [
      `Capture the new insight around ${topTheme} as a shortlist: keep, change, start.`,
      'Follow up with a second recording focused on commitment, not exploration.',
      'Pick one idea and schedule a 20-minute action block today.',
    ];
  }

  return [
    `Use your current momentum around ${topTheme} to define one measurable milestone for this week.`,
    'Repeat the strongest phrase from this reflection as your daily intent statement.',
    'Record another short check-in tomorrow and compare whether positive emotion stays stable.',
  ];
}

function deriveClimate(dominant: string, polarity: DemoInsights['polarity']): DemoClimate {
  if (dominant === 'fear' || dominant === 'sadness' || polarity.negative >= 50) {
    return {
      label: 'Heavy Weather',
      icon: 'Thunder',
      colorClass: 'from-violet-500 to-indigo-600',
      note: 'Strong stress energy detected. Prioritize emotional reset before deep decisions.',
    };
  }
  if (dominant === 'anger' || dominant === 'disgust') {
    return {
      label: 'High Pressure',
      icon: 'Volcano',
      colorClass: 'from-red-500 to-orange-600',
      note: 'Intensity is high. Channel this into boundaries, not reaction loops.',
    };
  }
  if (dominant === 'surprise') {
    return {
      label: 'Shifting Winds',
      icon: 'Aurora',
      colorClass: 'from-cyan-500 to-blue-600',
      note: 'Your narrative is in transition. Convert insights into one concrete commitment.',
    };
  }
  return {
    label: 'Clear Momentum',
    icon: 'Sunrise',
    colorClass: 'from-emerald-500 to-teal-600',
    note: 'Constructive emotional tone. Excellent moment for strategic action.',
  };
}

function deriveCompass(six: SixEmotionScores, themes: string[]): DemoCompass {
  const clarity = Math.max(0, (six.happiness + six.surprise) - (six.fear + six.sadness));
  const pressure = Math.max(0, (six.anger + six.fear + six.disgust) - six.happiness * 0.5);
  const x = Math.max(-1, Math.min(1, clarity * 1.6 - 0.4));
  const y = Math.max(-1, Math.min(1, 0.8 - pressure * 1.8));

  if (x >= 0 && y >= 0) {
    return {
      x,
      y,
      focus: 'Commit & Execute',
      guidance: `You have enough clarity around ${themes[0] || 'your direction'} to lock one decision today.`,
    };
  }
  if (x < 0 && y >= 0) {
    return {
      x,
      y,
      focus: 'Explore & Reframe',
      guidance: `Explore alternatives around ${themes[0] || 'your current challenge'} before committing.`,
    };
  }
  if (x >= 0 && y < 0) {
    return {
      x,
      y,
      focus: 'Stabilize Then Execute',
      guidance: 'Confidence exists, but emotional pressure is high. Do a reset and then decide.',
    };
  }
  return {
    x,
    y,
    focus: 'Pause & Decompress',
    guidance: 'Both clarity and emotional steadiness are low. Process first, then evaluate options.',
  };
}

function deriveMoments(result: HumeAnalysisResults): Array<{ timeRange: string; text: string; signal: string; category: string }> {
  const rows = (result.unifiedTranscript || [])
    .filter((entry) => extractString(entry.text).trim().length > 0)
    .map((entry) => {
      const all = [
        ...(entry.languageEmotions || []),
        ...(entry.prosodyEmotions || []),
        ...(entry.burstEmotions || []),
      ];
      const strongest = all.sort((a, b) => (b?.score || 0) - (a?.score || 0))[0];
      const begin = Math.max(0, Math.round(entry.time?.begin || 0));
      const end = Math.max(begin, Math.round(entry.time?.end || begin));
      const category = strongest ? basicEmotionToSixName(mapToBasicEmotion(strongest.name)) : 'happiness';
      return {
        timeRange: `${begin}-${end}s`,
        text: trimText(entry.text, 160),
        signal: strongest?.name || 'Neutral',
        category,
        score: strongest?.score || 0,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return rows.map(({ timeRange, text, signal, category }) => ({ timeRange, text, signal, category }));
}

function buildDemoInsights(result: HumeAnalysisResults): DemoInsights {
  const six = toSixEmotionPercentages(result);
  const emotionalMix = SIX_EMOTION_ORDER
    .map((name) => ({ name, value: six[name] || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const dominantEmotion = emotionalMix[0] || { name: 'happiness', value: 0 };
  const positive = Math.round((six.happiness || 0) * 100);
  const neutral = Math.round((six.surprise || 0) * 100);
  const negative = Math.max(0, 100 - positive - neutral);

  const polarityNarrative =
    negative > positive + 10
      ? 'Your reflection leans slightly negative emotionally, which often signals tension with your current situation.'
      : positive > negative + 10
        ? 'Your reflection leans positive emotionally, suggesting momentum and openness in your thinking.'
        : 'Your reflection is emotionally mixed, suggesting both possibility and tension are present at the same time.';

  const themes = deriveThemes(result);
  const secondaryEmotion = emotionalMix[1]?.name || 'surprise';
  const insightSummary = `Your reflection sounds ${dominantEmotion.name} and ${secondaryEmotion}, with a clear focus on ${themes[0] || 'what matters most to you'}.`;
  const reflectionInsight = `You seem to be thinking deeply about ${themes.join(', ').toLowerCase()}. The emotional mix suggests you are not just reacting, but actively trying to make sense of your next direction.`;
  const personalitySignals = derivePersonalitySignals(result, six);
  const timeline = deriveEmotionTimeline(result);
  const enrichedTop = deriveEnrichedTop(result);
  const sixFromEnriched = deriveSixFromEnriched(result);
  const moments = deriveMoments(result);
  const climate = deriveClimate(dominantEmotion.name, {
    positive,
    neutral,
    negative,
    narrative: polarityNarrative,
  });
  const compass = deriveCompass(six, themes);
  const nextSteps = deriveNextSteps(dominantEmotion.name, {
    positive,
    neutral,
    negative,
    narrative: polarityNarrative,
  }, themes);
  const rawTranscript = extractString(result.transcript);
  const contextStats = {
    durationSeconds: Math.round(result.summary?.totalDuration || 0),
    speakerCount: result.summary?.speakerCount || (result.speakers || []).length || 1,
    transcriptLength: rawTranscript.trim().split(/\s+/).filter(Boolean).length,
  };

  return {
    dominantEmotion,
    emotionalMix,
    polarity: {
      positive,
      neutral,
      negative,
      narrative: polarityNarrative,
    },
    themes,
    insightSummary,
    reflectionInsight,
    personalitySignals,
    timeline,
    contextStats,
    enrichedTop,
    sixFromEnriched,
    moments,
    nextSteps,
    climate,
    compass,
  };
}

function trimText(value: unknown, maxLength: number): string {
  const safe = extractString(value).trim();
  if (safe.length <= maxLength) return safe;
  return `${safe.slice(0, maxLength)}...`;
}

function formatLibraryDate(value?: string): string {
  if (!value) return 'Unknown date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatLibraryDuration(value?: number): string | null {
  if (!value || value <= 0) return null;
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function compactUnifiedTranscript(data: HumeAnalysisResults['unifiedTranscript']) {
  return (data || []).slice(0, 120).map((entry) => ({
    ...entry,
    text: trimText(entry.text, 180),
    languageEmotions: (entry.languageEmotions || []).sort((a, b) => (b?.score || 0) - (a?.score || 0)).slice(0, 3),
    prosodyEmotions: (entry.prosodyEmotions || []).sort((a, b) => (b?.score || 0) - (a?.score || 0)).slice(0, 2),
    burstEmotions: (entry.burstEmotions || []).sort((a, b) => (b?.score || 0) - (a?.score || 0)).slice(0, 2),
  }));
}

function compactAnalysisForHistory(result: AnalysisResults): AnalysisResults {
  if (!isLegacyResult(result)) {
    const compact: AnalysisResults = {
      type: 'hume',
      metadata: result.metadata,
      data: {
        ...result.data,
        transcript: trimText(result.data.transcript, 6000),
        unifiedTranscript: compactUnifiedTranscript(result.data.unifiedTranscript),
        speakers: (result.data.speakers || []).slice(0, 8),
        topics: (result.data.topics || []).slice(0, 8).map((topic) => ({
          terms: (topic.terms || []).slice(0, 5),
        })),
        keywords: (result.data.keywords || []).slice(0, 15),
      },
    };
    return compact;
  }

  return {
    ...result,
    deepgram: {
      ...result.deepgram,
      transcript: trimText(result.deepgram.transcript, 4000),
      topics: (result.deepgram.topics || []).slice(0, 10),
      keywords: (result.deepgram.keywords || []).slice(0, 12),
      summary: trimText(result.deepgram.summary, 500),
    },
    gemini: {
      ...result.gemini,
      summary: trimText(result.gemini.summary, 900),
      keyPoints: (result.gemini.keyPoints || []).slice(0, 8).map((p) => trimText(p, 180)),
      insights: (result.gemini.insights || []).slice(0, 8).map((p) => trimText(p, 220)),
      recommendations: (result.gemini.recommendations || []).slice(0, 8).map((p) => trimText(p, 220)),
      lifeInsights: {
        shortTerm: (result.gemini.lifeInsights?.shortTerm || []).slice(0, 6),
        longTerm: (result.gemini.lifeInsights?.longTerm || []).slice(0, 6),
        actionableSteps: (result.gemini.lifeInsights?.actionableSteps || []).slice(0, 6),
        mindsetShifts: (result.gemini.lifeInsights?.mindsetShifts || []).slice(0, 6),
      },
      visualizationData: {
        emotionDistribution: {
          labels: (result.gemini.visualizationData?.emotionDistribution?.labels || []).slice(0, 8),
          values: (result.gemini.visualizationData?.emotionDistribution?.values || []).slice(0, 8),
        },
        topicRelevance: {
          labels: (result.gemini.visualizationData?.topicRelevance?.labels || []).slice(0, 8),
          values: (result.gemini.visualizationData?.topicRelevance?.values || []).slice(0, 8),
        },
        speechMetrics: {
          labels: (result.gemini.visualizationData?.speechMetrics?.labels || []).slice(0, 8),
          values: (result.gemini.visualizationData?.speechMetrics?.values || []).slice(0, 8),
        },
        insightCategories: {
          labels: (result.gemini.visualizationData?.insightCategories?.labels || []).slice(0, 8),
          values: (result.gemini.visualizationData?.insightCategories?.values || []).slice(0, 8),
        },
        recommendationPriority: {
          labels: (result.gemini.visualizationData?.recommendationPriority?.labels || []).slice(0, 8),
          values: (result.gemini.visualizationData?.recommendationPriority?.values || []).slice(0, 8),
        },
        mindMap: result.gemini.visualizationData?.mindMap,
        energyPatterns: result.gemini.visualizationData?.energyPatterns,
        growthInsights: result.gemini.visualizationData?.growthInsights,
      },
    },
  };
}



const AudioAnalysisPage = () => {
  const { decryptAudio } = useAiDecryption();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Keep for backward compatibility
  const [isUploadLoading, setIsUploadLoading] = useState(false);
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [audioLibrary, setAudioLibrary] = useState<AudioLibraryItem[]>([]);
  const [audioLibraryLoading, setAudioLibraryLoading] = useState(false);
  const [audioLibraryError, setAudioLibraryError] = useState<string | null>(null);
  const [audioLibraryFilter, setAudioLibraryFilter] = useState<'all' | 'journal' | 'saved'>('all');
  const [selectedAudioItem, setSelectedAudioItem] = useState<AudioLibraryItem | null>(null);
  const [showAllAudioItems, setShowAllAudioItems] = useState(false);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<HumeJobStatus | null>(null);
  const [useHume, setUseHume] = useState(true); // Toggle between Hume and Deepgram
  const [activeTab, setActiveTab] = useState<string>("history");
  const [emotionFocus, setEmotionFocus] = useState<string>('all');
  const [recordingAudioUrl, setRecordingAudioUrl] = useState<string | null>(null);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [currentAudioTitle, setCurrentAudioTitle] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const [recordingTranscript, setRecordingTranscript] = useState<string>('');
  const analysisFileRef = useRef<File | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingAttemptsRef = useRef<number>(0);
  const pollingErrorCountRef = useRef<number>(0);
  const POLLING_MAX_ATTEMPTS = 450; // ~15 minutes at 2s interval for long Hume queue delays
  const { fetchMedia } = useVault();

  // Load history from Supabase on mount
  useEffect(() => {
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/analysis/audio/history?limit=${MAX_HISTORY_ITEMS}`);
        if (res.ok) {
          const data = await res.json();
          const rawHistory = data.history || [];
          const decryptedHistory = await Promise.all(
            rawHistory.map(async (row: any) => {
              const fields = await decryptAudio(row);
              const analysis = (fields.results || row.analysis || row.results) as any;
              return {
                ...row,
                summary: fields.summary || row.summary || (analysis?.type === 'hume' ? analysis.data?.summary?.topTopics?.join(', ') : 'Voice Reflection'),
                analysis,
              };
            })
          );
          const deduped = dedupeHistoryEntries(decryptedHistory).slice(0, MAX_HISTORY_ITEMS);
          setHistory(deduped);
        }
      } catch (err) {
        console.warn('[AudioAnalysis] Failed to load history:', err);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recordingAudioUrl && recordingAudioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(recordingAudioUrl);
      }
    };
  }, [recordingAudioUrl]);

  useEffect(() => {
    setEmotionFocus('all');
  }, [analysisResults]);

  useEffect(() => {
    let isMounted = true;

    const loadAudioLibrary = async () => {
      setAudioLibraryLoading(true);
      setAudioLibraryError(null);

      try {
        const [savedResult, journalResult] = await Promise.allSettled([
          fetchMedia({ folder: 'mydrive', media_type: 'audio', limit: 200 }),
          getAllJournalEntriesWithStatus(),
        ]);

        const savedMedia: MediaItem[] =
          savedResult.status === 'fulfilled' ? savedResult.value || [] : [];
        const journalEntries =
          journalResult.status === 'fulfilled' ? journalResult.value.entries || [] : [];

        if (savedResult.status === 'rejected' && journalResult.status === 'rejected') {
          throw new Error('Failed to load audio library');
        }

        const savedItems: AudioLibraryItem[] = savedMedia
          .filter((media) => media.public_url)
          .map((media) => ({
            id: `saved-${media.id}`,
            source: 'saved',
            title: media.file_name || 'Saved recording',
            sourceUrl: media.public_url,
            createdAt: media.created_at,
            duration: media.duration,
            fileName: media.file_name,
            mimeType: media.mime_type,
          }));

        let journalItems: AudioLibraryItem[] = journalEntries.flatMap((entry) =>
          (entry.mediaUrl?.audio || []).map((audioUrl: string, index: number) => ({
            id: `journal-${entry.journalId || entry.id}-audio-${index}`,
            source: 'journal',
            title: entry.title || 'Journal voice note',
            sourceUrl: audioUrl,
            createdAt: entry.date || entry.timestamp,
            journalId: entry.journalId || entry.id,
            journalTitle: entry.title || undefined,
          }))
        );

        // Auto-refresh signed URLs for journal items: batch by journalId and request fresh signed URLs
        try {
          const uniqueJournalIds = Array.from(new Set(journalItems.map((i) => String(i.journalId)).filter(Boolean)));
          if (uniqueJournalIds.length > 0) {
            const fetches = await Promise.allSettled(
              uniqueJournalIds.map((jid) => fetch(`/api/journals/media?journal_id=${encodeURIComponent(jid)}&media_type=audio`))
            );

            const journalMediaMap: Record<string, any[]> = {};

            const isFulfilled = (r: PromiseSettledResult<Response> | undefined): r is PromiseFulfilledResult<Response> => {
              return !!r && r.status === 'fulfilled';
            };

            for (let idx = 0; idx < uniqueJournalIds.length; idx++) {
              const jid = uniqueJournalIds[idx];
              if (!jid) continue;
              const res = fetches[idx];
              if (isFulfilled(res) && res.value && res.value.ok) {
                try {
                  const json = await res.value.json();
                  journalMediaMap[jid] = json?.media || [];
                } catch (e) {
                  journalMediaMap[jid] = [];
                }
              } else {
                journalMediaMap[jid] = [];
              }
            }

            // Map over journalItems and replace sourceUrl where a matching signed_url exists
            journalItems = journalItems.map((item) => {
              const jid = String(item.journalId || '');
              const mediaList = journalMediaMap[jid] || [];
              if (mediaList.length === 0) return item;

              // try to match by filename or createdAt, otherwise take first
              let matched: any = null;
              if (item.fileName) matched = mediaList.find((m: any) => (m.file_name || '') === item.fileName);
              if (!matched && item.createdAt) matched = mediaList.find((m: any) => (m.created_at || m.date || '') === item.createdAt);
              if (!matched) matched = mediaList[0];

              const freshUrl = matched?.signed_url || matched?.signedUrl || matched?.public_url || null;
              if (freshUrl) {
                return { ...item, sourceUrl: freshUrl, fileName: matched?.file_name || item.fileName, mimeType: matched?.mime_type || item.mimeType };
              }
              return item;
            });
          }
        } catch (e) {
          console.warn('[AudioAnalysis] failed to auto-refresh journal signed URLs', e);
        }

        const combined = [...journalItems, ...savedItems].sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });

        if (isMounted) {
          setAudioLibrary(combined);
        }
      } catch (err: any) {
        if (isMounted) {
          setAudioLibraryError(err?.message || 'Failed to load saved recordings');
        }
      } finally {
        if (isMounted) {
          setAudioLibraryLoading(false);
        }
      }
    };

    loadAudioLibrary();

    return () => {
      isMounted = false;
    };
  }, [fetchMedia]);

  useEffect(() => {
    if (!selectedAudioItem) return;
    const matchesFilter = audioLibraryFilter === 'all' || selectedAudioItem.source === audioLibraryFilter;
    if (!matchesFilter) {
      setSelectedAudioItem(null);
    }
  }, [audioLibraryFilter, selectedAudioItem]);

  // Save a new analysis to history (optimistic update + Supabase persistence)
  const saveToHistory = async (result: AnalysisResults) => {
    const isHume = 'type' in result && result.type === 'hume';
    const compactResult = compactAnalysisForHistory(result);
    const entry: AnalysisHistoryEntry = {
      id: createHistoryEntryId(result.metadata.filename, result.metadata.timestamp),
      date: result.metadata.timestamp,
      filename: result.metadata.filename,
      summary: isHume
        ? result.data.summary?.topTopics?.join(', ') || 'Hume Analysis'
        : isLegacyResult(result) ? result.gemini.summary : 'Analysis',
      analysis: compactResult,
    };
    // Optimistic local update so the UI responds immediately
    setHistory((prev) => dedupeHistoryEntries([entry, ...prev]).slice(0, MAX_HISTORY_ITEMS));
    // Persist to Supabase
    try {
      await fetch('/api/analysis/audio/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_id: entry.id,
          filename: entry.filename,
          date: entry.date,
          summary: entry.summary,
          results: entry.analysis,
        }),
      });
    } catch (err) {
      console.warn('[AudioAnalysis] Failed to persist history to server:', err);
    }
  };

  // Poll for job status
  const pollJobStatus = async (jobId: string, audioId?: string) => {
    // safety: increment attempts and stop if we've polled too many times
    pollingAttemptsRef.current += 1;
    const elapsedSeconds = pollingAttemptsRef.current * 2; // 2s interval
    
    if (pollingAttemptsRef.current > POLLING_MAX_ATTEMPTS) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setError(`Job analysis is taking longer than expected (${(elapsedSeconds / 60).toFixed(1)} minutes). Please retry in a moment.`);
      setIsLoading(false);
      setIsUploadLoading(false);
      setIsRecordingLoading(false);
      return;
    }
    try {
      // Try Imentiv polling endpoint first, then Hume fallback if needed
      let response;
      try {
        response = await axios.get<HumeJobStatus>(
          `/api/analysis/audio/imentiv?jobId=${encodeURIComponent(jobId)}${audioId ? `&audioId=${encodeURIComponent(audioId)}` : ''}`
        );
      } catch (imentivPollErr: any) {
        if (imentivPollErr?.response?.status === 404 || imentivPollErr?.response?.status === 500) {
          response = await axios.get<HumeJobStatus>(
            `/api/analysis/audio/hume?jobId=${encodeURIComponent(jobId)}${audioId ? `&humeJobId=${encodeURIComponent(audioId)}` : ''}`
          );
        } else {
          throw imentivPollErr;
        }
      }

      pollingErrorCountRef.current = 0;
      setJobStatus(response.data);

      if (response.data.status === 'COMPLETED' && response.data.analysis) {
        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        pollingAttemptsRef.current = 0;

        // Set results
        const activeFile = analysisFileRef.current;
        setAnalysisResults({
          type: 'hume',
          data: response.data.analysis,
          metadata: {
            filename: activeFile?.name || 'audio.mp3',
            filesize: activeFile?.size || 0,
            timestamp: response.data.completedAt || new Date().toISOString()
          }
        });
        setActiveTab("text");

        setIsLoading(false);
        setIsUploadLoading(false);
        setIsRecordingLoading(false);
        void saveToHistory({
          type: 'hume',
          data: response.data.analysis,
          metadata: {
            filename: activeFile?.name || 'audio.mp3',
            filesize: activeFile?.size || 0,
            timestamp: response.data.completedAt || new Date().toISOString()
          }
        });
      } else if (response.data.status === 'FAILED') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        pollingAttemptsRef.current = 0;
        const failedMessage = response.data.errorMessage || 'Audio analysis failed';
        setError(failedMessage);
        setIsLoading(false);
        setIsUploadLoading(false);
        setIsRecordingLoading(false);
      }
    } catch (err: any) {
      console.error('Error polling job status:', err);
      const status = err?.response?.status;
      const isNetworkError = !err?.response && (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error');

      if (status === 401) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsLoading(false);
        setIsUploadLoading(false);
        setIsRecordingLoading(false);
        setError('Your session expired while polling analysis status. Please sign in again and retry.');
        return;
      }

      if (isNetworkError) {
        pollingErrorCountRef.current += 1;
        if (pollingErrorCountRef.current >= 8) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setIsLoading(false);
          setIsUploadLoading(false);
          setIsRecordingLoading(false);
          setError('Network connection was interrupted while fetching analysis updates. Please check your connection and retry.');
        }
      }
    }
  };

  // Start polling for job status
  const startPolling = (jobId: string, audioId?: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollingAttemptsRef.current = 0;
    pollingErrorCountRef.current = 0;

    pollJobStatus(jobId, audioId);

    pollingIntervalRef.current = setInterval(() => {
      pollJobStatus(jobId, audioId);
    }, 3000);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setSelectedAudioItem(null);
      setError(null);
    }
  };

  const handleSelectAudioItem = async (item: AudioLibraryItem) => {
    setSelectionLoading(true);
    try {
      setError(null);

      if (item.source === 'journal' && !item.sourceUrl && item.journalId) {
        try {
          const mediaRes = await fetch(`/api/journals/media?journal_id=${encodeURIComponent(item.journalId)}&media_type=audio`);
          if (mediaRes.ok) {
            const mediaJson = await mediaRes.json();
            const mediaList = mediaJson?.media || [];
            let matched: any = null;
            if (item.fileName) matched = mediaList.find((m: any) => (m.file_name || '') === item.fileName);
            if (!matched && item.createdAt) matched = mediaList.find((m: any) => (m.created_at || m.date || '') === item.createdAt);
            if (!matched && mediaList.length > 0) matched = mediaList[0];

            if (matched) {
              const freshUrl = matched?.signed_url || matched?.signedUrl || matched?.public_url || null;
              if (freshUrl) {
                const updated: AudioLibraryItem = {
                  ...item,
                  sourceUrl: freshUrl,
                  fileName: matched.file_name || item.fileName,
                  mimeType: matched.mime_type || item.mimeType,
                };
                setSelectedAudioItem(updated);
                setFile(null);
                if (!showAllAudioItems) setShowAllAudioItems(true);
                return;
              }
            }
          }
        } catch (err) {
          console.warn('[AudioAnalysis] Failed to refresh journal signed URL on selection', err);
        }

        setError('Selected recording has no source URL and could not be refreshed.');
        setSelectedAudioItem(item);
        setFile(null);
        if (!showAllAudioItems) setShowAllAudioItems(true);
        return;
      }

      setSelectedAudioItem(item);
      setFile(null);
      if (!showAllAudioItems) {
        setShowAllAudioItems(true);
      }
    } finally {
      setSelectionLoading(false);
    }
  };

  const refreshAudioItem = async (item: AudioLibraryItem) => {
    try {
      setAudioLibraryLoading(true);
      setError(null);

      if (item.source === 'journal' && item.journalId) {
        const mediaRes = await fetch(`/api/journals/media?journal_id=${encodeURIComponent(item.journalId)}&media_type=audio`);
        if (mediaRes.ok) {
          const mediaJson = await mediaRes.json();
          const mediaList = mediaJson?.media || [];
          let matched: any = null;
          if (item.fileName) matched = mediaList.find((m: any) => (m.file_name || '') === item.fileName);
          if (!matched && item.createdAt) matched = mediaList.find((m: any) => (m.created_at || m.date || '') === item.createdAt);
          if (!matched && mediaList.length > 0) matched = mediaList[0];

          if (matched) {
            const freshUrl = matched?.signed_url || matched?.signedUrl || matched?.public_url || null;
            if (freshUrl) {
              setAudioLibrary((prev) => prev.map((a) => (a.id === item.id ? { ...a, sourceUrl: freshUrl, fileName: matched.file_name || a.fileName, mimeType: matched.mime_type || a.mimeType } : a)));
              if (selectedAudioItem?.id === item.id) {
                setSelectedAudioItem((prev) => prev ? { ...prev, sourceUrl: freshUrl, fileName: matched.file_name || prev.fileName, mimeType: matched.mime_type || prev.mimeType } : prev);
              }
              setError(null);
              return true;
            }
          }
        }
        setError('Could not refresh journal recording URL.');
        return false;
      }

      if (item.source === 'saved') {
        try {
          const refreshed = await fetchMedia({ folder: 'mydrive', media_type: 'audio', limit: 200 });
          const found = (refreshed || []).find((m: any) => `saved-${m.id}` === item.id || m.file_name === item.fileName);
          if (found && found.public_url) {
            setAudioLibrary((prev) => prev.map((a) => (a.id === item.id ? { ...a, sourceUrl: found.public_url, fileName: found.file_name || a.fileName, mimeType: found.mime_type || a.mimeType } : a)));
            if (selectedAudioItem?.id === item.id) {
              setSelectedAudioItem((prev) => prev ? { ...prev, sourceUrl: found.public_url, fileName: found.file_name || prev.fileName, mimeType: found.mime_type || prev.mimeType } : prev);
            }
            setError(null);
            return true;
          }
        } catch (err) {
          console.warn('[AudioAnalysis] refresh saved item failed', err);
        }
        setError('Could not refresh saved recording URL.');
        return false;
      }

      return false;
    } finally {
      setAudioLibraryLoading(false);
    }
  };

  const handleAudioPlaybackError = async (url?: string) => {
    if (!url) {
      setError('Playback failed: no audio URL available.');
      return;
    }

    try {
      const resp = await fetch(url, { method: 'GET', cache: 'no-store' });
      if (!resp.ok) {
        setError(`Playback failed: server returned ${resp.status}. The URL may be expired.`);
        return;
      }
      const ct = (resp.headers.get('content-type') || '').toLowerCase();
      if (!ct.startsWith('audio/') && ct !== 'application/octet-stream') {
        setError(`Playback failed: resource is not audio (content-type: ${ct || 'unknown'}).`);
        return;
      }

      setError('Playback failed for unknown reason. Check browser console for CORS errors.');
    } catch (err) {
      setError('Playback failed: possible CORS restriction or expired signed URL. Check DevTools Network/Console.');
    }
  };

  const playAudioUrl = async (url?: string, title?: string) => {
    if (!url) {
      setError('No audio URL to play');
      return;
    }

    try {
      if (!audioPlayerRef.current) {
        audioPlayerRef.current = document.createElement('audio');
        audioPlayerRef.current.crossOrigin = 'anonymous';
        audioPlayerRef.current.preload = 'metadata';
        audioPlayerRef.current.addEventListener('ended', () => setIsPlaying(false));
        audioPlayerRef.current.addEventListener('play', () => setIsPlaying(true));
        audioPlayerRef.current.addEventListener('pause', () => setIsPlaying(false));
      }

      if (currentAudioUrl !== url) {
        audioPlayerRef.current.src = url;
        setCurrentAudioUrl(url);
        setCurrentAudioTitle(title || null);
      }

      if (audioPlayerRef.current.paused) {
        await audioPlayerRef.current.play();
        setIsPlaying(true);
      } else {
        audioPlayerRef.current.pause();
        setIsPlaying(false);
      }
      setError(null);
    } catch (err) {
      console.warn('playAudioUrl error', err);
      handleAudioPlaybackError(url);
    }
  };

  const resolveAnalysisFile = async () => {
    if (file) return file;
    if (!selectedAudioItem) return null;

    try {
      setSelectionLoading(true);
      if (!selectedAudioItem.sourceUrl) {
        throw new Error('Selected recording has no source URL');
      }

      const response = await fetch(selectedAudioItem.sourceUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Unable to load selected audio (network error)');
      }

      const contentType = (response.headers.get('content-type') || '').toLowerCase();

      if (!contentType.startsWith('audio/') && contentType !== 'application/octet-stream') {
        if (selectedAudioItem.journalId) {
          try {
            const mediaRes = await fetch(`/api/journals/media?journal_id=${encodeURIComponent(selectedAudioItem.journalId)}&media_type=audio`);
            if (mediaRes.ok) {
              const mediaJson = await mediaRes.json();
              const mediaList = mediaJson?.media || [];
              let matched: any = null;
              if (selectedAudioItem.fileName) {
                matched = mediaList.find((m: any) => (m.file_name || '').toString() === selectedAudioItem.fileName);
              }
              if (!matched && selectedAudioItem.createdAt) {
                matched = mediaList.find((m: any) => (m.created_at || m.date || '').toString() === selectedAudioItem.createdAt);
              }
              if (!matched && mediaList.length > 0) matched = mediaList[0];

              const freshUrl = matched?.signed_url || matched?.signedUrl || matched?.public_url || null;
              if (freshUrl) {
                const updated = { ...selectedAudioItem, sourceUrl: freshUrl, fileName: matched?.file_name || selectedAudioItem.fileName, mimeType: matched?.mime_type || selectedAudioItem.mimeType };
                setSelectedAudioItem(updated);
                const retryRes = await fetch(freshUrl, { cache: 'no-store' });
                if (retryRes.ok) {
                  const retryContentType = (retryRes.headers.get('content-type') || '').toLowerCase();
                  if (retryContentType.startsWith('audio/') || retryContentType === 'application/octet-stream') {
                    const blobRetry = await retryRes.blob();
                    const fileName = updated.fileName || `${updated.title || 'voice-note'}.wav`;
                    const mimeType = updated.mimeType || blobRetry.type || 'audio/wav';
                    const resolvedFile = new File([blobRetry], fileName, { type: mimeType });
                    setFile(resolvedFile);
                    return resolvedFile;
                  }
                }
              }
            }
          } catch (e) {
            console.warn('[AudioAnalysis] failed to refresh journal media signed URL', e);
          }
        }

        let snippet = '';
        try {
          const text = await response.clone().text();
          snippet = text.slice(0, 300).replace(/\s+/g, ' ').trim();
        } catch (e) {
          // ignore
        }
        throw new Error(
          `Selected audio URL returned unsupported content-type: ${contentType || 'unknown'}. This commonly means the signed URL expired or redirected to an HTML error page.${snippet ? ` Response snippet: ${snippet}` : ''}`
        );
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error('Downloaded audio is empty or could not be read.');
      }

      const fileName = selectedAudioItem.fileName || `${selectedAudioItem.title || 'voice-note'}.wav`;
      const mimeType = selectedAudioItem.mimeType || blob.type || 'audio/wav';
      const resolvedFile = new File([blob], fileName, { type: mimeType });
      setFile(resolvedFile);
      return resolvedFile;
    } finally {
      setSelectionLoading(false);
    }
  };

  const handleAnalyze = async () => {
    let analysisFile: File | null = null;
    try {
      analysisFile = await resolveAnalysisFile();
    } catch (err: any) {
      setError(err?.message || 'Unable to prepare the selected audio');
      return;
    }
    if (!analysisFile) {
      setError('Please select an audio file first');
      return;
    }
    analysisFileRef.current = analysisFile;

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (analysisFile.size > MAX_FILE_SIZE) {
      setError(`File too large (${(analysisFile.size / 1024 / 1024).toFixed(1)}MB). Maximum file size is 50MB. Please use a shorter recording or compress the audio.`);
      return;
    }

    setIsUploadLoading(true);
    setIsLoading(true);
    setError(null);
    setJobStatus(null);
    setAnalysisResults(null);

    // Primary AI Emotion Analysis Flow (Imentiv with Hume fallback)
    if (useHume) {
      try {
        const VERCEL_BODY_LIMIT = 4.5 * 1024 * 1024; // 4.5MB
        const usePresignedUpload = analysisFile.size > VERCEL_BODY_LIMIT;

        let jobId: string;
        let audioId: string;

        if (usePresignedUpload) {
          console.log(`Using presigned upload for ${(analysisFile.size / 1024 / 1024).toFixed(1)}MB file`);
          
          // Step 1: Get presigned upload URL
          const presignedResponse = await axios.post<{
            uploadUrl: string;
            filePath: string;
            token: string;
            path: string;
          }>(
            '/api/analysis/audio/presigned-upload',
            {
              fileName: analysisFile.name,
              fileSize: analysisFile.size,
              mimeType: analysisFile.type,
            }
          );

          const { uploadUrl, filePath } = presignedResponse.data;

          // Step 2: Upload file directly to Supabase Storage
          await axios.put(uploadUrl, analysisFile, {
            headers: {
              'Content-Type': analysisFile.type,
              'x-upsert': 'true',
            },
          });

          console.log(`File uploaded to: ${filePath}`);

          // Step 3: Start emotion analysis from uploaded file
          const analysisResponse = await axios.post<{
            jobId: string;
            audioId?: string;
            humeJobId?: string;
            provider?: string;
            status: string;
            message: string;
          }>(
            '/api/analysis/audio/start-from-upload',
            {
              filePath,
              fileName: analysisFile.name,
              mimeType: analysisFile.type,
            }
          );

          jobId = analysisResponse.data.jobId;
          audioId = analysisResponse.data.audioId || analysisResponse.data.humeJobId || jobId;
        } else {
          // Use direct upload for smaller files
          const formData = new FormData();
          formData.append('audioFile', analysisFile);
          formData.append('title', analysisFile.name);

          let response;
          try {
            response = await axios.post<{
              jobId: string;
              audioId?: string;
              humeJobId?: string;
              provider?: string;
              status: string;
              message: string;
            }>(
              '/api/analysis/audio/imentiv',
              formData,
              { headers: { 'Content-Type': 'multipart/form-data' } }
            );
          } catch (imentivUploadErr: any) {
            console.warn('Imentiv endpoint upload fallback:', imentivUploadErr);
            response = await axios.post<{
              jobId: string;
              audioId?: string;
              humeJobId?: string;
              status: string;
              message: string;
            }>(
              '/api/analysis/audio/hume',
              formData,
              { headers: { 'Content-Type': 'multipart/form-data' } }
            );
          }

          jobId = response.data.jobId;
          audioId = response.data.audioId || response.data.humeJobId || jobId;
        }


        // Job queued, start polling
        setJobStatus({
          jobId,
          humeJobId: audioId,
          status: 'QUEUED',
          sourceUrl: '',
          createdAt: new Date().toISOString(),
          hasResults: false,
        });
        startPolling(jobId, audioId);
      } catch (err: any) {
        console.error('Audio analysis error:', err);
        
        let errorMessage = 'Failed to start audio analysis';
        if (err?.response?.status === 500) {
          const serverError = err?.response?.data?.error || err?.response?.data?.message;
          errorMessage = `Server configuration or processing error: ${serverError || 'Please check API key configuration.'}`;
        } else if (err?.response?.status === 401) {
          errorMessage = 'Authentication required. Please log in again.';
        } else if (err?.response?.status === 400) {
          errorMessage = err?.response?.data?.error || 'Invalid audio file format.';
        } else {
          errorMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to start audio analysis';
        }
        
        setError(errorMessage);
        setIsLoading(false);
        setIsUploadLoading(false);
      }
      return;
    }


    // Legacy Deepgram flow
    try {
      // Read file and decode to AudioBuffer in browser
      const arrayBuffer = await analysisFile.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decoded = await audioContext.decodeAudioData(arrayBuffer);

      // Resample to 16kHz mono PCM and slice into ≤30s chunks
      const targetSampleRate = 16000;
      const numChannels = 1;
      const chunkDurationSec = 30;
      const totalSamples = decoded.length;
      const sourceSampleRate = decoded.sampleRate;
      const sourceData = decoded.getChannelData(0);

      const seconds = totalSamples / sourceSampleRate;
      const chunksCount = Math.ceil(seconds / chunkDurationSec);

      const partials: any[] = [];

      for (let i = 0; i < chunksCount; i++) {
        const startTime = i * chunkDurationSec;
        const endTime = Math.min((i + 1) * chunkDurationSec, seconds);
        const startSample = Math.floor(startTime * sourceSampleRate);
        const endSample = Math.floor(endTime * sourceSampleRate);

        const slice = sourceData.subarray(startSample, endSample);

        // Resample slice to 16kHz mono
        const resampledLength = Math.floor((slice.length / sourceSampleRate) * targetSampleRate);
        const resampled = new Float32Array(resampledLength);
        for (let j = 0; j < resampledLength; j++) {
          const t = j / targetSampleRate;
          const srcIndex = t * sourceSampleRate;
          const i0 = Math.floor(srcIndex);
          const i1 = Math.min(i0 + 1, slice.length - 1);
          const frac = srcIndex - i0;
          const v0 = slice[i0] || 0;
          const v1 = slice[i1] || 0;
          resampled[j] = v0 + (v1 - v0) * frac;
        }

        // Encode to 16-bit PCM WAV (mono, 16kHz)
        const wavBuffer = (() => {
          const bytesPerSample = 2;
          const blockAlign = numChannels * bytesPerSample;
          const dataSize = resampled.length * blockAlign;
          const bufferSize = 44 + dataSize;
          const ab = new ArrayBuffer(bufferSize);
          const view = new DataView(ab);
          const writeString = (offset: number, s: string) => {
            for (let k = 0; k < s.length; k++) view.setUint8(offset + k, s.charCodeAt(k));
          };
          writeString(0, 'RIFF');
          view.setUint32(4, 36 + dataSize, true);
          writeString(8, 'WAVE');
          writeString(12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, numChannels, true);
          view.setUint32(24, targetSampleRate, true);
          view.setUint32(28, targetSampleRate * blockAlign, true);
          view.setUint16(32, blockAlign, true);
          view.setUint16(34, 16, true);
          writeString(36, 'data');
          view.setUint32(40, dataSize, true);
          let offset = 44;
          for (let n = 0; n < resampled.length; n++) {
            const s = Math.max(-1, Math.min(1, resampled[n] || 0));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
          }
          return ab;
        })();

        const chunkBlob = new Blob([wavBuffer], { type: 'audio/wav' });
        const form = new FormData();
        form.append('audioChunk', chunkBlob, `chunk_${i.toString().padStart(3, '0')}.wav`);

        try {
          const resp = await axios.post<{ hume: any }>(
            '/api/analysis/audio/chunk',
            form,
            {
              headers: { 'Content-Type': 'multipart/form-data' },
              timeout: 120000, // 2 minute timeout per chunk
            }
          );

          // Check for errors in response
          if ('error' in resp.data && resp.data.error) {
            console.error(`Chunk ${i} error:`, resp.data.error);
            throw new Error(`Chunk ${i + 1} error: ${resp.data.error}`);
          }
          
          // Now pushing the entire hume analysis result
          partials.push(resp.data.hume);
        } catch (chunkErr: any) {
          const chunkErrorMsg = chunkErr?.response?.data?.error || chunkErr?.response?.data?.message || chunkErr?.message || `Failed to process chunk ${i + 1}`;
          console.error(`Chunk ${i} processing error:`, chunkErrorMsg);
          throw new Error(`Audio chunk ${i + 1}/${chunksCount} failed: ${chunkErrorMsg}`);
        }
      }

      // Aggregate chunks into single analysis (Hume format) - same as recording handler
      const firstChunk = partials[0] || {};
      
      // Combine transcripts from all chunks
      const transcript = partials.map(p => p.transcript || '').join(' ').trim();
      
      if (!transcript) {
        throw new Error('No transcript generated from audio chunks');
      }
      
      // Aggregate emotions from all chunks
      const allEmotions: Record<string, number[]> = {};
      const allBasicEmotions: Record<string, number[]> = {};
      
      partials.forEach((chunk: any) => {
        if (chunk.emotions) {
          Object.entries(chunk.emotions).forEach(([emotion, score]) => {
            if (!allEmotions[emotion]) allEmotions[emotion] = [];
            allEmotions[emotion].push(score as number);
          });
        }
        if (chunk.basicEmotions) {
          Object.entries(chunk.basicEmotions).forEach(([emotion, score]) => {
            if (!allBasicEmotions[emotion]) allBasicEmotions[emotion] = [];
            allBasicEmotions[emotion].push(score as number);
          });
        }
      });
      
      // Average emotions across chunks
      const emotions: Record<string, number> = {};
      Object.entries(allEmotions).forEach(([emotion, scores]) => {
        emotions[emotion] = scores.reduce((a, b) => a + b, 0) / scores.length;
      });
      
      const basicEmotions: Record<string, number> = {};
      Object.entries(allBasicEmotions).forEach(([emotion, scores]) => {
        basicEmotions[emotion] = scores.reduce((a, b) => a + b, 0) / scores.length;
      });

      // Compute enriched 12-category emotions from the averaged detailed emotions
      const enrichedEmotions = aggregateToEnrichedEmotions(emotions);
      
      // Combine other fields
      const speakers = Array.from(new Set(partials.flatMap((p: any) => p.speakers || [])));
      const topics = partials[0]?.topics || [];
      
      // Extract keywords from topics
      const keywords = topics.flatMap((topic: any) => 
        topic.terms ? topic.terms.slice(0, 3).map((t: any) => t.term) : []
      ).slice(0, 10);
      
      // Calculate total duration from unified transcript
      const unifiedTranscript = partials.flatMap((p: any) => p.unifiedTranscript || []);
      const totalDuration = unifiedTranscript.length > 0 
        ? Math.max(...unifiedTranscript.map((u: any) => u.time?.end || 0))
        : 0;
      
      // Extract top topics
      const topTopics = topics.slice(0, 3).map((topic: any) => {
        if (topic.terms && topic.terms.length > 0) {
          return topic.terms[0].term;
        }
        return typeof topic === 'string' ? topic : 'Unknown';
      });
      
      // Create Hume-format result
      const humeResult = {
        type: 'hume' as const,
        data: {
          transcript,
          unifiedTranscript,
          speakers,
          emotions,
          basicEmotions,
          enrichedEmotions,
          topics,
          keywords,
          summary: {
            totalDuration,
            speakerCount: speakers.length,
            emotionDistribution: emotions,
            basicEmotionDistribution: basicEmotions,
            enrichedEmotionDistribution: enrichedEmotions,
            topTopics,
          },
        },
        metadata: {
          filename: analysisFile.name,
          filesize: analysisFile.size,
          timestamp: new Date().toISOString(),
        }
      };

      setAnalysisResults(humeResult);
      // Switch to analysis tab to show results
      setActiveTab("text");
      await saveToHistory(humeResult);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to analyze audio file';
      setError(errorMessage);
      console.error('Analysis error:', {
        message: err?.message,
        response: err?.response?.data,
        status: err?.response?.status,
      });
    } finally {
      setIsLoading(false);
      setIsUploadLoading(false);
    }
  };

  const handleRecordingComplete = async (audioBlob: Blob) => {
    setIsRecordingLoading(true);
    setIsLoading(true);
    setError(null);
    setRecordingTranscript('');
    setSelectedAudioItem(null);
    analysisFileRef.current = null;

    if (recordingAudioUrl && recordingAudioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(recordingAudioUrl);
    }
    setRecordingAudioUrl(URL.createObjectURL(audioBlob));

    try {
      // Decode recording
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decoded = await audioContext.decodeAudioData(arrayBuffer);

      // Parameters
      const targetSampleRate = 16000;
      const numChannels = 1;
      const chunkDurationSec = 30;
      const totalSamples = decoded.length;
      const sourceSampleRate = decoded.sampleRate;
      const sourceData = decoded.getChannelData(0);
      const seconds = totalSamples / sourceSampleRate;
      const chunksCount = Math.ceil(seconds / chunkDurationSec);

      const partials: any[] = [];

      for (let i = 0; i < chunksCount; i++) {
        const startTime = i * chunkDurationSec;
        const endTime = Math.min((i + 1) * chunkDurationSec, seconds);
        const startSample = Math.floor(startTime * sourceSampleRate);
        const endSample = Math.floor(endTime * sourceSampleRate);
        const slice = sourceData.subarray(startSample, endSample);

        // Linear resample to 16k mono
        const resampledLength = Math.floor((slice.length / sourceSampleRate) * targetSampleRate);
        const resampled = new Float32Array(resampledLength);
        for (let j = 0; j < resampledLength; j++) {
          const t = j / targetSampleRate;
          const srcIndex = t * sourceSampleRate;
          const i0 = Math.floor(srcIndex);
          const i1 = Math.min(i0 + 1, slice.length - 1);
          const frac = srcIndex - i0;
          const v0 = slice[i0] || 0;
          const v1 = slice[i1] || 0;
          resampled[j] = v0 + (v1 - v0) * frac;
        }

        // Encode to wav
        const wavBuffer = (() => {
          const bytesPerSample = 2;
          const blockAlign = numChannels * bytesPerSample;
          const dataSize = resampled.length * blockAlign;
          const bufferSize = 44 + dataSize;
          const ab = new ArrayBuffer(bufferSize);
          const view = new DataView(ab);
          const writeString = (offset: number, s: string) => { for (let k = 0; k < s.length; k++) view.setUint8(offset + k, s.charCodeAt(k)); };
          writeString(0, 'RIFF');
          view.setUint32(4, 36 + dataSize, true);
          writeString(8, 'WAVE');
          writeString(12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, numChannels, true);
          view.setUint32(24, targetSampleRate, true);
          view.setUint32(28, targetSampleRate * blockAlign, true);
          view.setUint16(32, blockAlign, true);
          view.setUint16(34, 16, true);
          writeString(36, 'data');
          view.setUint32(40, dataSize, true);
          let offset = 44;
          for (let n = 0; n < resampled.length; n++) {
            const s = Math.max(-1, Math.min(1, resampled[n] || 0));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            offset += 2;
          }
          return ab;
        })();

        const chunkBlob = new Blob([wavBuffer], { type: 'audio/wav' });
        const form = new FormData();
        form.append('audioChunk', chunkBlob, `chunk_${i.toString().padStart(3, '0')}.wav`);
        const resp = await axios.post<{ hume: any }>(
          '/api/analysis/audio/chunk',
          form,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        partials.push(resp.data.hume);
      }

      // Aggregate chunks into single analysis (Hume format)
      // Since each chunk now returns full AnalysisService results, we'll use the first chunk's structure
      const firstChunk = partials[0] || {};
      
      // Combine transcripts from all chunks
      const transcript = partials.map(p => p.transcript || '').join(' ').trim();
      setRecordingTranscript(transcript);
      
      // Aggregate emotions from all chunks
      const allEmotions: Record<string, number[]> = {};
      const allBasicEmotions: Record<string, number[]> = {};
      
      partials.forEach((chunk: any) => {
        // Aggregate detailed emotions
        if (chunk.emotions) {
          Object.entries(chunk.emotions).forEach(([emotion, score]) => {
            if (!allEmotions[emotion]) allEmotions[emotion] = [];
            allEmotions[emotion].push(score as number);
          });
        }
        // Aggregate basic emotions
        if (chunk.basicEmotions) {
          Object.entries(chunk.basicEmotions).forEach(([emotion, score]) => {
            if (!allBasicEmotions[emotion]) allBasicEmotions[emotion] = [];
            allBasicEmotions[emotion].push(score as number);
          });
        }
      });
      
      // Average emotions across chunks
      const emotions: Record<string, number> = {};
      Object.entries(allEmotions).forEach(([emotion, scores]) => {
        emotions[emotion] = scores.reduce((a, b) => a + b, 0) / scores.length;
      });
      
      const basicEmotions: Record<string, number> = {};
      Object.entries(allBasicEmotions).forEach(([emotion, scores]) => {
        basicEmotions[emotion] = scores.reduce((a, b) => a + b, 0) / scores.length;
      });

      // Compute enriched 12-category emotions from the averaged detailed emotions
      const enrichedEmotions = aggregateToEnrichedEmotions(emotions);
      
      // Combine other fields
      const speakers = Array.from(new Set(partials.flatMap((p: any) => p.speakers || [])));
      const topics = partials[0]?.topics || [];
      
      // Extract keywords from topics (since AnalysisService doesn't return keywords separately)
      const keywords = topics.flatMap((topic: any) => 
        topic.terms ? topic.terms.slice(0, 3).map((t: any) => t.term) : []
      ).slice(0, 10);
      
      // Calculate total duration from unified transcript
      const unifiedTranscript = partials.flatMap((p: any) => p.unifiedTranscript || []);
      const totalDuration = unifiedTranscript.length > 0 
        ? Math.max(...unifiedTranscript.map((u: any) => u.time?.end || 0))
        : 0;
      
      // Extract top topics
      const topTopics = topics.slice(0, 3).map((topic: any) => {
        if (topic.terms && topic.terms.length > 0) {
          return topic.terms[0].term;
        }
        return typeof topic === 'string' ? topic : 'Unknown';
      });
      
      // Create Hume-format result
      const humeResult = {
        type: 'hume' as const,
        data: {
          transcript,
          unifiedTranscript,
          speakers,
          emotions,
          basicEmotions,
          enrichedEmotions,
          topics,
          keywords,
          summary: {
            totalDuration,
            speakerCount: speakers.length,
            emotionDistribution: emotions,
            basicEmotionDistribution: basicEmotions,
            enrichedEmotionDistribution: enrichedEmotions,
            topTopics,
          },
        },
        metadata: {
          filename: 'recording.wav',
          filesize: audioBlob.size,
          timestamp: new Date().toISOString(),
        }
      };

      setAnalysisResults(humeResult);
      // Switch to analysis tab to show results
      setActiveTab("text");
      await saveToHistory(humeResult);
    } catch (err) {
      setError('Failed to analyze audio recording. Please try again.');
      console.error('Analysis error:', err);
    } finally {
      setIsLoading(false);
      setIsRecordingLoading(false);
    }
  };

  // Load a history entry as the current analysis
  const handleLoadHistory = (entry: AnalysisHistoryEntry) => {
    setAnalysisResults(entry.analysis);
    setError(null);
    setActiveTab("text"); // Switch to text tab to show the analysis
  };

  const filteredAudioLibrary = audioLibrary.filter((item) => {
    if (audioLibraryFilter === 'all') return true;
    return item.source === audioLibraryFilter;
  });

  const visibleAudioItems = showAllAudioItems
    ? filteredAudioLibrary
    : filteredAudioLibrary.slice(0, 8);

  return (
    <section className="analysis-audio-theme space-y-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-[#e5abc6]/65! bg-[#fff6fb]/95! hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="text-2xl font-semibold text-[#4f1636]">Add a Voice Memory</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-full max-w-md">
                      <label
                        htmlFor="audio-upload"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#e7b4cb] rounded-lg cursor-pointer hover:bg-[#ffeef7] transition-colors duration-200"
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 mb-4 text-[#c02673]" />
                          <p className="mb-2 text-sm text-[#7a2d55]">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-[#9a3c6d]">MP3, WAV, or M4A (MAX. 25MB)</p>
                        </div>
                        <input
                          id="audio-upload"
                          type="file"
                          className="hidden"
                          accept="audio/*"
                          onChange={handleFileChange}
                        />
                      </label>
                    </div>
                    {file && (
                      <div className="text-sm text-[#7a2d55] flex items-center gap-2">
                        <Music className="w-4 h-4" />
                        Selected memory: {file.name}
                      </div>
                    )}
                    {!file && selectedAudioItem && (
                      <div className="text-sm text-[#7a2d55] flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Music className="w-4 h-4" />
                          Selected from library: {selectedAudioItem.title}
                        </div>
                        {selectedAudioItem.source === 'journal' && (
                          <span className="text-xs text-[#8f3563]">
                            From Journal: {selectedAudioItem.journalTitle || formatLibraryDate(selectedAudioItem.createdAt)}
                          </span>
                        )}
                      </div>
                    )}
                    <Button
                      onClick={handleAnalyze}
                      disabled={(!file && !selectedAudioItem) || isUploadLoading || selectionLoading}
                      className="w-full max-w-md border border-[#b63573]/40 bg-linear-to-r from-[#db2777] to-[#ec4899] hover:from-[#be185d] hover:to-[#db2777] text-white transition-all duration-200"
                    >
                      {isUploadLoading || selectionLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          {selectionLoading ? 'Preparing audio...' : jobStatus ? 'Processing...' : 'Analyzing...'}
                        </div>
                      ) : (
                        'Reveal Voice Story'
                      )}
                    </Button>
                    {error && (
                      <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
                        {error}
                      </div>
                    )}
                    {jobStatus && jobStatus.status !== 'COMPLETED' && jobStatus.status !== 'FAILED' && (
                      <Card className="w-full max-w-md mt-4 border-[#e5abc6]/65! bg-[#fff1f8]!">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin text-[#c02673]" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-[#4f1636]">Job Status: {jobStatus.status}</p>
                              <p className="text-xs text-[#9a3c6d] mt-1">
                                {jobStatus.status === 'QUEUED' && !jobStatus.statusMessage && 'Waiting to start processing...'}
                                {jobStatus.status === 'QUEUED' && jobStatus.statusMessage && jobStatus.statusMessage}
                                {jobStatus.status === 'IN_PROGRESS' && 'Analyzing voice patterns and emotions...'}
                              </p>
                              {jobStatus.elapsedSeconds && jobStatus.elapsedSeconds > 30 && (
                                <div className="mt-2 text-xs bg-[#ffe7f3] px-2 py-1 rounded">
                                  <p className="text-[#7a2d55]">
                                    ⏱️ Processing time: {Math.floor(jobStatus.elapsedSeconds / 60)}m {Math.floor(jobStatus.elapsedSeconds % 60)}s
                                  </p>
                                  {jobStatus.elapsedSeconds > 120 && (
                                    <p className="text-amber-700 mt-1">
                                      ⚠️ Hume API is experiencing high load. This may take several minutes.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      
                    )}
                  </div>
                </CardContent>
              </Card>

              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                isAnalyzing={isRecordingLoading}
              />

              <Card className="md:col-span-2 border-[#e5abc6]/65! bg-[#fff6fb]/95! hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="text-2xl font-semibold text-[#4f1636]">Pick From Your Voice Library</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {(['all', 'journal', 'saved'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setAudioLibraryFilter(filter)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${audioLibraryFilter === filter ? 'bg-[#c02673] text-white' : 'bg-[#f7e6ef] text-[#7a2d55] hover:bg-[#f2d6e6]'}`}
                      >
                        {filter === 'all' ? 'All' : filter === 'journal' ? 'Journal' : 'Saved'}
                      </button>
                    ))}
                  </div>

                  {audioLibraryLoading ? (
                    <div className="text-[#a24575] animate-pulse">Loading your recordings...</div>
                  ) : audioLibraryError ? (
                    <div className="text-sm text-[#8f3563] bg-[#fff1f8] border border-[#f0c2d8] rounded-xl px-4 py-3">
                      {audioLibraryError}
                    </div>
                  ) : visibleAudioItems.length === 0 ? (
                    <div className="text-[#8f3563]">No saved voice notes yet.</div>
                  ) : (
                    <div className="max-h-72 md:max-h-144 overflow-auto pr-2">
                      <ul className="space-y-3">
                        {visibleAudioItems.map((item) => {
                        const isSelected = selectedAudioItem?.id === item.id;
                        const durationLabel = formatLibraryDuration(item.duration);
                        return (
                          <li
                            key={item.id}
                            className={`rounded-2xl border px-4 py-3 transition ${isSelected ? 'border-[#c02673] bg-[#ffeef7]' : 'border-[#edd2dc] bg-white/80 hover:border-[#d8a2b7]'}`}
                            onClick={() => handleSelectAudioItem(item)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                handleSelectAudioItem(item);
                              }
                            }}
                          >
                            <div className="flex flex-col gap-2 text-left">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-[#4f1636]">{item.title}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${item.source === 'journal' ? 'bg-[#f6dbea] text-[#8a2c5b]' : 'bg-[#ead9c8] text-[#6f4a2e]'}`}>
                                  {item.source === 'journal' ? 'Journal' : 'Saved'}
                                </span>
                                {isSelected && (
                                  <span className="rounded-full bg-[#c02673] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Selected</span>
                                )}
                              </div>
                              <div className="text-xs text-[#8f3563] flex flex-wrap items-center gap-2">
                                <span>{formatLibraryDate(item.createdAt)}</span>
                                {durationLabel && <span>· {durationLabel}</span>}
                                {/* {item.fileName && <span>· {item.fileName}</span>} */}
                              </div>
                              {item.source === 'journal' && item.journalId && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-xs text-[#7a2d55]">
                                    From Journal: {item.journalTitle || formatLibraryDate(item.createdAt)}
                                  </div>
                                  <Link
                                  
                                    href={`/journal/${item.journalId}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-2 px-3 py-1 text-sm font-semibold rounded-md bg-[#fbeff4] text-[#b21f57] hover:bg-[#f5d9e8]"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    Open journal
                                  </Link>
                                </div>
                              )}
                              <div className="relative">
                                {item.sourceUrl?.trim() ? (
                                  <div className="rounded-xl border border-[#f0cfe0] bg-white/90 p-2" onClick={(event) => event.stopPropagation()}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <audio
                                          src={item.sourceUrl.trim()}
                                          controls
                                          className="w-full"
                                          crossOrigin="anonymous"
                                          preload="none"
                                          onError={() => handleAudioPlaybackError(item.sourceUrl)}
                                          onPlay={() => setError(null)}
                                        />
                                      </div>
                                      <div className="ml-3 shrink-0">
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); playAudioUrl(item.sourceUrl, item.title); }}
                                          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#f3e7ea] text-[#9b2b5a] hover:bg-[#f1d7e0]"
                                        >
                                          {currentAudioUrl === item.sourceUrl && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-[#f0cfe0] bg-white/90 p-2 text-sm text-[#8f3563] flex items-center justify-between">
                                    <div>No preview available</div>
                                    <div className="ml-3">
                                      <button
                                        type="button"
                                        onClick={async (e) => { e.stopPropagation(); await refreshAudioItem(item); }}
                                        className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#fdeff6] text-[#ae1f55] text-xs font-semibold hover:bg-[#f7dfe8]"
                                      >
                                        Refresh URL
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                      </ul>
                    </div>
                  )}

                  {filteredAudioLibrary.length > 8 && (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => setShowAllAudioItems((prev) => !prev)}
                        className="text-sm font-semibold text-[#c02673] hover:text-[#a81e63]"
                      >
                        {showAllAudioItems
                          ? 'Show fewer recordings'
                          : `Show all ${filteredAudioLibrary.length} recordings`}
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 rounded-2xl border border-[#efc6da] bg-[#fff1f8]/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-[#7a2d55]">
                      {selectedAudioItem
                        ? `Ready to analyze: ${selectedAudioItem.title}`
                        : 'Select a recording to enable analysis.'}
                    </div>
                    <Button
                      onClick={handleAnalyze}
                      disabled={!selectedAudioItem || isUploadLoading || selectionLoading}
                      className="w-full sm:w-auto border border-[#b63573]/40 bg-linear-to-r from-[#db2777] to-[#ec4899] hover:from-[#be185d] hover:to-[#db2777] text-white transition-all duration-200"
                    >
                      {isUploadLoading || selectionLoading ? 'Preparing...' : 'Analyze Selected'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Sticky player footer */}
              {currentAudioUrl && (
                <div className="fixed left-4 right-4 bottom-4 z-50 md:relative md:bottom-auto">
                  <div className="mx-auto max-w-3xl rounded-lg border bg-white/95 p-3 shadow-lg flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold text-[#4f1636]">{currentAudioTitle || 'Playing audio'}</div>
                      <div className="text-xs text-[#7a2d55]">{currentAudioUrl ? 'Local preview' : ''}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={async () => { if (audioPlayerRef.current) { if (audioPlayerRef.current.paused) { await audioPlayerRef.current.play(); } else { audioPlayerRef.current.pause(); } } }}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#f3e7ea] text-[#9b2b5a] hover:bg-[#f1d7e0]"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <audio ref={(el) => { if (el) audioPlayerRef.current = el; }} src={currentAudioUrl || undefined} className="hidden" controls />
                    </div>
                  </div>
                </div>
              )}

              {(recordingAudioUrl || recordingTranscript) && (
                <Card className="md:col-span-2 border-[#e5abc6]/65! bg-[#fff6fb]/95! shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl font-semibold text-[#4f1636]">Latest Recording Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {recordingAudioUrl && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <audio
                            src={recordingAudioUrl}
                            controls
                            className="w-full"
                            preload="none"
                            onError={() => handleAudioPlaybackError(recordingAudioUrl || undefined)}
                            onPlay={() => setError(null)}
                          />
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => playAudioUrl(recordingAudioUrl, 'Latest recording')}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#fdeff2] text-[#a71f55] hover:bg-[#f7dfe8]"
                          >
                            {currentAudioUrl === recordingAudioUrl && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="rounded-2xl border border-[#efb6cf]/70 bg-[#fff1f8]/90 p-4 text-sm text-[#5c1f3b]">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#8a2c5b]">Transcript</p>
                      <p className="mt-2 whitespace-pre-wrap">
                        {recordingTranscript || 'Transcript will appear after analysis completes.'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Tabs defaultValue="history" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6 flex w-full flex-wrap items-center gap-2 rounded-2xl border border-[#d8c2b2]/70 bg-[#fff8f2]/92 p-2 shadow-sm">
                {analysisResults && (
                    <TabsTrigger value="text" className="rounded-xl border border-transparent px-3 py-2 text-xs text-[#6f5a4b] sm:text-sm data-[state=active]:border-[#a78974] data-[state=active]:bg-[#f1e4d8] data-[state=active]:text-[#4a382d] data-[state=active]:shadow-none">
                    <FileText className="w-4 h-4 mr-2" />
                    Insight Summary
                  </TabsTrigger>
                )}
                {analysisResults && !('type' in analysisResults && analysisResults.type === 'hume') && (
                    <TabsTrigger value="features" className="rounded-xl border border-transparent px-3 py-2 text-xs text-[#6f5a4b] sm:text-sm data-[state=active]:border-[#a78974] data-[state=active]:bg-[#f1e4d8] data-[state=active]:text-[#4a382d] data-[state=active]:shadow-none">
                    <Music className="w-4 h-4 mr-2" />
                    Audio Features
                  </TabsTrigger>
                )}
                {analysisResults && !('type' in analysisResults && analysisResults.type === 'hume') && (
                    <TabsTrigger value="visual" className="rounded-xl border border-transparent px-3 py-2 text-xs text-[#6f5a4b] sm:text-sm data-[state=active]:border-[#a78974] data-[state=active]:bg-[#f1e4d8] data-[state=active]:text-[#4a382d] data-[state=active]:shadow-none">
                    <BarChart2 className="w-4 h-4 mr-2" />
                    Visualization
                  </TabsTrigger>
                )}
                <TabsTrigger value="history" className="min-w-40 rounded-xl border border-transparent px-3 py-2 text-sm font-medium text-[#6f5a4b] data-[state=active]:border-[#a78974] data-[state=active]:bg-[#f1e4d8] data-[state=active]:text-[#4a382d] data-[state=active]:shadow-none">
                  <Upload className="w-4 h-4 mr-2" />
                  Memory Trail
                </TabsTrigger>
              </TabsList>

                {analysisResults && (
                  <TabsContent value="text">
                    {('type' in analysisResults && analysisResults.type === 'hume') ? (
                    <Card className="border-[#e5abc6]/65! bg-[#fff6fb]/95! hover:shadow-lg transition-shadow duration-300">
                      <CardHeader>
                        <CardTitle className="text-2xl font-semibold">Voice Reflection Insights</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const demo = buildDemoInsights(analysisResults.data);
                          return (
                            <div className="space-y-6">
                              <div className="rounded-2xl border bg-linear-to-r from-blue-50 via-cyan-50 to-emerald-50 p-5 shadow-sm transition-all duration-300 hover:shadow-md dark:from-blue-900/20 dark:via-cyan-900/20 dark:to-emerald-900/20">
                                <p className="text-sm font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Insight Summary</p>
                                <p className="mt-2 text-base leading-relaxed text-gray-800 dark:text-gray-100">{demo.insightSummary}</p>
                              </div>

                              <div className="rounded-2xl border bg-white/80 p-4 shadow-sm backdrop-blur dark:bg-gray-900/30">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Focus Emotion</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    onClick={() => setEmotionFocus('all')}
                                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${emotionFocus === 'all' ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'}`}
                                  >
                                    All signals
                                  </button>
                                  {demo.emotionalMix.map((emotion) => (
                                    <button
                                      key={emotion.name}
                                      onClick={() => setEmotionFocus(emotion.name)}
                                      className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${emotionFocus === emotion.name ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-200 dark:hover:bg-cyan-900/50'}`}
                                    >
                                      {emotion.name}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-2xl border bg-linear-to-br from-slate-50 via-sky-50 to-cyan-50 p-5 shadow-sm dark:from-slate-900/40 dark:via-sky-900/20 dark:to-cyan-900/20">
                                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                  <div>
                                    <p className="text-sm font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Visual Emotion Map</p>
                                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Hume's 12 categories are grouped into 6 dominant emotions to simplify the pattern.</p>
                                  </div>
                                  {(() => {
                                    const topThree = demo.sixFromEnriched.slice(0, 3);
                                    const slices = topThree.length > 0
                                      ? topThree.map((item) => `${Math.round(item.value * 100)}%`).join(', ')
                                      : '100%';
                                    const first = topThree[0]?.value || 0;
                                    const second = topThree[1]?.value || 0;
                                    const wheel = topThree.length > 0
                                      ? `conic-gradient(#06b6d4 0 ${slices.split(', ')[0]}, #3b82f6 0 ${topThree[1] ? `${Math.round((first + second) * 100)}%` : '100%'}, #8b5cf6 0 100%)`
                                      : 'conic-gradient(#94a3b8 0 100%)';
                                    return (
                                      <div className="relative h-24 w-24 rounded-full border-4 border-white/80 shadow-inner dark:border-gray-800" style={{ background: wheel }}>
                                        <div className="absolute inset-4 rounded-full bg-white dark:bg-gray-900" />
                                      </div>
                                    );
                                  })()}
                                </div>

                                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                                  {demo.sixFromEnriched
                                    .filter((emotion) => emotionFocus === 'all' || emotion.name === emotionFocus)
                                    .map((emotion) => (
                                    <div key={emotion.name} className="rounded-xl border border-cyan-100 bg-white/80 p-3 dark:border-cyan-900/40 dark:bg-gray-900/40">
                                      <div className="mb-2 flex items-center justify-between text-sm">
                                        <span className="font-semibold capitalize text-gray-800 dark:text-gray-100">{emotion.name}</span>
                                        <span className="font-bold text-cyan-700 dark:text-cyan-300">{Math.round(emotion.value * 100)}%</span>
                                      </div>
                                      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                                        <div className="h-2 rounded-full bg-linear-to-r from-cyan-500 via-blue-500 to-indigo-500" style={{ width: `${Math.round(emotion.value * 100)}%` }} />
                                      </div>
                                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        From: {emotion.contributors.slice(0, 3).join(', ') || 'N/A'}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <div className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-900/40">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Emotion Climate</p>
                                  <div className={`mt-3 rounded-xl bg-linear-to-r p-4 text-white ${demo.climate.colorClass}`}>
                                    <p className="text-xs uppercase tracking-wider opacity-80">{demo.climate.icon}</p>
                                    <p className="mt-1 text-2xl font-bold">{demo.climate.label}</p>
                                  </div>
                                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{demo.climate.note}</p>
                                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                    {demo.sixFromEnriched.slice(0, 3).map((item) => {
                                      const emotionName = isSixEmotionName(item.name) ? item.name : 'happiness';
                                      const theme = SIX_EMOTION_THEME[emotionName];
                                      return (
                                        <div key={item.name} className="rounded-lg border bg-gray-50 p-2 dark:bg-gray-800/60">
                                          <p className="text-[11px] uppercase tracking-wide text-gray-500">{theme.emoji}</p>
                                          <p className="text-xs font-semibold capitalize text-gray-800 dark:text-gray-100">{item.name}</p>
                                          <p className="text-sm font-bold text-gray-900 dark:text-white">{Math.round(item.value * 100)}%</p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-900/40">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Emotion Orbit Lab</p>
                                  <div className="relative mt-4 h-72 overflow-hidden rounded-2xl border bg-linear-to-br from-indigo-50 via-sky-50 to-cyan-50 dark:from-indigo-900/30 dark:via-sky-900/20 dark:to-cyan-900/20">
                                    <div className="absolute left-6 top-6 h-16 w-16 rounded-full bg-cyan-300/40 blur-xl animate-pulse" />
                                    <div className="absolute right-10 top-10 h-12 w-12 rounded-full bg-fuchsia-300/40 blur-lg animate-pulse" style={{ animationDelay: '300ms' }} />
                                    <div className="absolute bottom-10 left-14 h-14 w-14 rounded-full bg-indigo-300/40 blur-xl animate-pulse" style={{ animationDelay: '700ms' }} />

                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="relative h-56 w-56">
                                        <div className="absolute inset-4 rounded-full border border-dashed border-cyan-300/70 dark:border-cyan-600/50" style={{ animation: 'spin 18s linear infinite' }} />
                                        <div className="absolute inset-10 rounded-full border border-dashed border-indigo-300/70 dark:border-indigo-600/50" style={{ animation: 'spin 24s linear infinite reverse' }} />

                                        {demo.sixFromEnriched.slice(0, 6).map((item, index) => {
                                          const angle = (index / 6) * Math.PI * 2 - Math.PI / 2;
                                          const radius = 92;
                                          const x = Math.round(Math.cos(angle) * radius);
                                          const y = Math.round(Math.sin(angle) * radius);
                                          return (
                                            <div
                                              key={`orbit-${item.name}`}
                                              className="absolute"
                                              style={{ left: '50%', top: '50%', transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                                            >
                                              <div className="rounded-full border bg-white/95 px-3 py-1 text-[11px] font-semibold capitalize text-gray-800 shadow dark:bg-gray-900/90 dark:text-gray-100">
                                                {item.name}
                                              </div>
                                              <p className="mt-1 text-center text-[10px] font-bold text-cyan-700 dark:text-cyan-300">{Math.round(item.value * 100)}%</p>
                                            </div>
                                          );
                                        })}

                                        <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-white bg-linear-to-br from-cyan-500 to-indigo-600 text-white shadow-xl dark:border-gray-900">
                                          <p className="text-[10px] uppercase tracking-wider opacity-90">Dominant</p>
                                          <p className="text-xs font-bold capitalize">{demo.dominantEmotion.name}</p>
                                          <p className="text-[11px] font-semibold">{Math.round(demo.dominantEmotion.value * 100)}%</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-gray-100">Trajectory: {demo.compass.focus}</p>
                                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{demo.compass.guidance}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div className="rounded-xl border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Dominant Emotion</p>
                                  <p className="mt-2 text-xl font-semibold capitalize text-gray-900 dark:text-gray-100">
                                    {demo.dominantEmotion.name} ({Math.round(demo.dominantEmotion.value * 100)}%)
                                  </p>
                                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                    Your voice most strongly conveyed {demo.dominantEmotion.name} in this reflection.
                                  </p>
                                </div>

                                <div className="rounded-xl border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Emotional Balance</p>
                                  <div className="mt-3 space-y-2 text-sm">
                                    <div className="flex items-center justify-between"><span>Positive</span><span className="font-semibold">{demo.polarity.positive}%</span></div>
                                    <div className="flex items-center justify-between"><span>Neutral</span><span className="font-semibold">{demo.polarity.neutral}%</span></div>
                                    <div className="flex items-center justify-between"><span>Negative</span><span className="font-semibold">{demo.polarity.negative}%</span></div>
                                  </div>
                                  <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{demo.polarity.narrative}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="rounded-xl border bg-linear-to-br from-fuchsia-50 to-pink-50 p-4 dark:from-fuchsia-900/20 dark:to-pink-900/20">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Reflection Length</p>
                                  <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{demo.contextStats.durationSeconds}s</p>
                                </div>
                                <div className="rounded-xl border bg-linear-to-br from-cyan-50 to-blue-50 p-4 dark:from-cyan-900/20 dark:to-blue-900/20">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Detected Speakers</p>
                                  <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{demo.contextStats.speakerCount}</p>
                                </div>
                                <div className="rounded-xl border bg-linear-to-br from-amber-50 to-orange-50 p-4 dark:from-amber-900/20 dark:to-orange-900/20">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Words Captured</p>
                                  <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{demo.contextStats.transcriptLength}</p>
                                </div>
                              </div>

                              <div className="rounded-xl border p-5 transition-all duration-300 hover:shadow-md">
                                <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Emotional Signals (Top 5)</p>
                                <div className="mt-4 space-y-3">
                                  {demo.emotionalMix
                                    .filter((emotion) => emotionFocus === 'all' || emotion.name === emotionFocus)
                                    .map((emotion) => (
                                    <div key={emotion.name}>
                                      <div className="mb-1 flex items-center justify-between text-sm">
                                        <span className="capitalize font-medium">{emotion.name}</span>
                                        <span>{Math.round(emotion.value * 100)}%</span>
                                      </div>
                                      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                                        <div
                                          className="h-2 rounded-full bg-linear-to-r from-blue-500 to-cyan-500"
                                          style={{ width: `${Math.round(emotion.value * 100)}%` }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {demo.enrichedTop.length > 0 && (
                                <div className="rounded-xl border p-5">
                                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Deep Emotion Lens</p>
                                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {demo.enrichedTop.map((item) => (
                                      <div key={item.name} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                                        <div className="mb-2 flex items-center justify-between text-sm">
                                          <span className="font-medium">
                                            {ENRICHED_EMOTION_EMOJI[item.name]} {item.name}
                                          </span>
                                          <span>{Math.round(item.value * 100)}%</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                                          <div
                                            className={`h-2 rounded-full bg-linear-to-r ${ENRICHED_EMOTION_GRADIENT[item.name]}`}
                                            style={{ width: `${Math.round(item.value * 100)}%` }}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div className="rounded-xl border p-5 transition-all duration-300 hover:shadow-md">
                                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Themes Detected</p>
                                  <ul className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-200">
                                    {demo.themes.map((theme) => (
                                      <li key={theme}>• {theme}</li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="rounded-xl border p-5 transition-all duration-300 hover:shadow-md">
                                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Personality Signals</p>
                                  <div className="mt-3 space-y-3 text-sm text-gray-700 dark:text-gray-200">
                                    {demo.personalitySignals.map((signal) => (
                                      <div key={signal.name}>
                                        <p className="font-semibold">{signal.name}</p>
                                        <p className="text-gray-600 dark:text-gray-300">{signal.explanation}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-xl border bg-amber-50 p-5 dark:bg-amber-900/20">
                                <p className="text-sm font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Reflection Insight</p>
                                <p className="mt-2 text-sm leading-relaxed text-gray-800 dark:text-gray-100">{demo.reflectionInsight}</p>
                              </div>

                              <div className="rounded-xl border bg-linear-to-br from-emerald-50 to-lime-50 p-5 dark:from-emerald-900/20 dark:to-lime-900/20">
                                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">What To Do Next</p>
                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                  {demo.nextSteps.map((step, index) => (
                                    <div key={index} className="rounded-lg border border-emerald-100 bg-white/90 p-3 dark:border-emerald-900/40 dark:bg-gray-900/40">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">Step {index + 1}</p>
                                      <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">{step}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {demo.timeline.length > 0 && (
                                <div className="rounded-xl border p-5">
                                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Emotional Timeline</p>
                                  <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-200">
                                    {demo.timeline
                                      .filter((item) => emotionFocus === 'all' || item.emotion === emotionFocus)
                                      .map((item) => (
                                      <div key={item.timeRange} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
                                        <span>{item.timeRange}</span>
                                        <span className="capitalize font-medium">{item.emotion}</span>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="mt-4 rounded-xl border bg-linear-to-r from-white to-sky-50 p-4 dark:from-gray-900/40 dark:to-sky-900/20">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Momentum Track</p>
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                      {demo.timeline
                                        .filter((item) => emotionFocus === 'all' || item.emotion === emotionFocus)
                                        .map((item, index, filtered) => {
                                          const theme = SIX_EMOTION_THEME[isSixEmotionName(item.emotion) ? item.emotion : 'happiness'];
                                          return (
                                            <React.Fragment key={`${item.timeRange}-${item.emotion}-chip`}>
                                              <div className={`rounded-full bg-linear-to-r px-3 py-1 text-xs font-semibold text-white ${theme.gradient}`}>
                                                {item.timeRange} · {item.emotion}
                                              </div>
                                              {index < filtered.length - 1 && <span className="text-gray-400">→</span>}
                                            </React.Fragment>
                                          );
                                        })}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {demo.moments.length > 0 && (
                                <div className="rounded-xl border p-5">
                                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">High-Signal Voice Moments</p>
                                  <div className="mt-3 space-y-3">
                                    {demo.moments
                                      .filter((moment) => emotionFocus === 'all' || moment.category === emotionFocus)
                                      .map((moment, index) => (
                                      <div key={`${moment.timeRange}-${index}`} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
                                        <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                                          <span>{moment.timeRange}</span>
                                          <span className="font-medium text-blue-600 capitalize dark:text-blue-300">{moment.signal} · {moment.category}</span>
                                        </div>
                                        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">"{moment.text}"</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <details className="rounded-xl border p-5">
                                <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-gray-500">Transcript Drilldown</summary>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                                  {extractString(analysisResults.data.transcript)}
                                </p>
                              </details>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  ) : isLegacyResult(analysisResults) ? (
                    <>
                      <Card className="hover:shadow-lg transition-shadow duration-300">
                        <CardHeader>
                          <CardTitle className="text-2xl font-semibold">Text Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-8">
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                              <h3 className="font-semibold mb-2 text-lg">Transcript</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                {analysisResults.deepgram.transcript}
                              </p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                              <h3 className="font-semibold mb-2 text-lg">Summary</h3>
                              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                                {analysisResults.gemini.summary}
                              </p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                              <h3 className="font-semibold mb-2 text-lg">Key Points</h3>
                              <ul className="list-disc list-inside space-y-2">
                                {analysisResults.gemini.keyPoints.map((point: string, index: number) => (
                                  <li key={index} className="text-sm text-gray-600 dark:text-gray-300">
                                    {point}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                              <h3 className="font-semibold mb-2 text-lg">Topics</h3>
                              <div className="flex flex-wrap gap-2">
                                {analysisResults.deepgram.topics.map((topic: string, index: number) => (
                                  <span
                                    key={index}
                                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium"
                                  >
                                    {topic}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                                <h3 className="font-semibold mb-2 text-lg">Sentiment Analysis</h3>
                                <div className="space-y-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">Positive</span>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                      <div className="flex-1 sm:w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                        <div 
                                          className="h-full bg-green-500 rounded-full" 
                                          style={{ width: `${analysisResults.deepgram.sentiment.positive * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-sm font-medium">
                                        {(analysisResults.deepgram.sentiment.positive * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">Neutral</span>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                      <div className="flex-1 sm:w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                        <div 
                                          className="h-full bg-blue-500 rounded-full" 
                                          style={{ width: `${analysisResults.deepgram.sentiment.neutral * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-sm font-medium">
                                        {(analysisResults.deepgram.sentiment.neutral * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">Negative</span>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                      <div className="flex-1 sm:w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                        <div 
                                          className="h-full bg-red-500 rounded-full" 
                                          style={{ width: `${analysisResults.deepgram.sentiment.negative * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-sm font-medium">
                                        {(analysisResults.deepgram.sentiment.negative * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                                <h3 className="text-lg font-semibold mb-2">Speech Patterns</h3>
                                <div className="space-y-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">Confidence</span>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                      <div className="flex-1 sm:w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                        <div 
                                          className="h-full bg-blue-500 rounded-full" 
                                          style={{ width: `${analysisResults.deepgram.confidence * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-sm font-medium">
                                        {(analysisResults.deepgram.confidence * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">Clarity</span>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                      <div className="flex-1 sm:w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                        <div 
                                          className="h-full bg-green-500 rounded-full" 
                                          style={{ width: `${analysisResults.gemini.speechPatterns.clarity * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-sm font-medium">
                                        {(analysisResults.gemini.speechPatterns.clarity * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                                <h3 className="text-lg font-semibold mb-2">Emotional Analysis</h3>
                                <div className="space-y-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">Emotional Intensity</span>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                      <div className="flex-1 sm:w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                        <div 
                                          className="h-full bg-purple-500 rounded-full" 
                                          style={{ width: `${analysisResults.gemini.emotions.intensity * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-sm font-medium">
                                        {(analysisResults.gemini.emotions.intensity * 100).toFixed(1)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      {analysisResults.gemini?.textAnalysis?.coreValues && (
                        <TextAnalysisTabs coreValues={analysisResults.gemini.textAnalysis.coreValues} />
                      )}
                    </>
                  ) : null}
                  </TabsContent>
                )}

                {analysisResults && ('type' in analysisResults && analysisResults.type === 'hume') && (
                  <>
                    <TabsContent value="emotions">
                      <Card className="hover:shadow-lg transition-shadow duration-300">
                        <CardHeader>
                          <CardTitle className="text-2xl font-semibold">Emotion Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <EmotionTab emotions={analysisResults.data.emotions} basicEmotions={analysisResults.data.basicEmotions} enrichedEmotions={analysisResults.data.enrichedEmotions} />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="visual">
                      <Card className="hover:shadow-lg transition-shadow duration-300">
                        <CardHeader>
                          <CardTitle className="text-2xl font-semibold">Visualizations</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Enriched Emotions (12 Categories) - Primary Display */}
                            {(() => {
                              const enriched = analysisResults.data.enrichedEmotions || (analysisResults.data.emotions ? aggregateToEnrichedEmotions(analysisResults.data.emotions) : null);
                              if (!enriched) return null;
                              return (
                                <div className="bg-linear-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-6 rounded-lg border-2 border-purple-200 dark:border-purple-700">
                                  <h3 className="font-semibold mb-4 text-lg flex items-center gap-2">
                                    <span className="text-2xl">🎭</span>
                                    Emotion Categories
                                  </h3>
                                  <div className="space-y-2">
                                    {Object.entries(enriched)
                                      .sort(([, a], [, b]) => (b as number) - (a as number))
                                      .filter(([, score]) => (score as number) > 0)
                                      .map(([emotion, score]) => (
                                        <div key={emotion} className="flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded">
                                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                            <span className="text-lg">{ENRICHED_EMOTION_EMOJI[emotion as EnrichedEmotion] || ''}</span>
                                            {emotion}
                                          </span>
                                          <div className="flex items-center gap-2 w-full sm:w-48">
                                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                              <div
                                                className={`h-3 rounded-full bg-linear-to-r ${ENRICHED_EMOTION_GRADIENT[emotion as EnrichedEmotion] || 'from-purple-500 to-pink-500'}`}
                                                style={{ width: `${((score as number) * 100).toFixed(0)}%` }}
                                              />
                                            </div>
                                            <span className="text-sm font-bold w-12 text-right">
                                              {((score as number) * 100).toFixed(0)}%
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              );
                            })()}


                            {/* Topics Visualization */}
                            {analysisResults.data.topics && analysisResults.data.topics.length > 0 && (
                              <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                                <h3 className="font-semibold mb-4 text-lg">Topic Distribution</h3>
                                <div className="space-y-3">
                                  {analysisResults.data.topics.slice(0, 5).map((topic: any, index: number) => {
                                    const terms = Array.isArray(topic?.terms) ? topic.terms : [];
                                    const totalProb = terms.reduce((sum: number, term: any) => sum + (Number(term?.probability) || 0), 0);
                                    const topicTitle = topic?.name || topic?.topic || `Topic ${index + 1}`;
                                    return (
                                      <div key={index} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {topicTitle}
                                          </span>
                                          {totalProb > 0 && (
                                            <span className="text-xs text-gray-500">
                                              {(totalProb * 100).toFixed(0)}% relevance
                                            </span>
                                          )}
                                        </div>
                                        {terms.length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {terms.slice(0, 3).map((term: any, i: number) => (
                                              <span
                                                key={i}
                                                className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded"
                                              >
                                                {typeof term === 'string' ? term : term?.term || term?.name || ''}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}


                            {/* Speaker Distribution */}
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                              <h3 className="font-semibold mb-4 text-lg">Speaker Activity</h3>
                              <div className="space-y-3">
                                {analysisResults.data.speakers && analysisResults.data.speakers.length > 0 ? (
                                  analysisResults.data.speakers.map((speaker, index) => {
                                    const speakerEntries = (analysisResults.data.unifiedTranscript || []).filter(
                                      e => e.speaker === speaker
                                    );
                                    const speakerDuration = speakerEntries.reduce(
                                      (sum, e) => sum + ((e.time?.end || 0) - (e.time?.begin || 0)), 0
                                    );
                                    const totalDuration = analysisResults.data.summary?.totalDuration || 0;
                                    const percentage = totalDuration > 0 ? (speakerDuration / totalDuration) * 100 : 0;
                                    
                                    return (
                                      <div key={speaker} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {speaker}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            {percentage.toFixed(1)}% of time
                                          </span>
                                        </div>
                                        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                          <div
                                            className="h-2 rounded-full bg-linear-to-r from-blue-500 to-purple-500"
                                            style={{ width: `${percentage}%` }}
                                          />
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-gray-500 text-sm">No speaker data available</p>
                                )}
                              </div>
                            </div>


                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="speakers">
                      <Card className="hover:shadow-lg transition-shadow duration-300">
                        <CardHeader>
                          <CardTitle className="text-2xl font-semibold">Speaker Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-6">
                            {analysisResults.data.speakers && analysisResults.data.speakers.length > 0 && (
                              <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                                <h3 className="font-semibold mb-4 text-lg">Speakers Detected</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {analysisResults.data.speakers.map((speaker, index) => (
                                    <div key={speaker} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-linear-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                                          {index + 1}
                                        </div>
                                        <div>
                                          <p className="font-medium text-gray-900 dark:text-gray-100">{speaker}</p>
                                          <p className="text-sm text-gray-500">Speaker {index + 1}</p>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {analysisResults.data.topics && analysisResults.data.topics.length > 0 && (
                              <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                                <h3 className="font-semibold mb-4 text-lg">Topics</h3>
                                <div className="flex flex-wrap gap-2">
                                  {analysisResults.data.topics.map((topic: any, index: number) => {
                                    const terms = Array.isArray(topic?.terms) ? topic.terms : [];
                                    return (
                                      <div key={index} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm">
                                        <p className="text-sm font-medium mb-1">{topic?.name || topic?.topic || `Topic ${index + 1}`}</p>
                                        {terms.length > 0 && (
                                          <div className="flex flex-wrap gap-1">
                                            {terms.slice(0, 5).map((term: any, i: number) => {
                                              const termText = typeof term === 'string' ? term : term?.term || term?.name || '';
                                              const prob = term?.probability !== undefined ? ` (${(Number(term.probability) * 100).toFixed(0)}%)` : '';
                                              return (
                                                <span
                                                  key={i}
                                                  className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded"
                                                >
                                                  {termText}{prob}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                              <h3 className="font-semibold mb-4 text-lg">Summary</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                                  <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
                                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                    {(analysisResults.data.summary?.totalDuration || 0).toFixed(1)}s
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                                  <p className="text-sm text-gray-500 dark:text-gray-400">Speakers</p>
                                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                    {analysisResults.data.summary?.speakerCount || (analysisResults.data.speakers?.length || 1)}
                                  </p>
                                </div>
                                {(() => {
                                  const enriched = analysisResults.data.enrichedEmotions || (analysisResults.data.emotions ? aggregateToEnrichedEmotions(analysisResults.data.emotions) : null);
                                  if (!enriched) return null;
                                  const dominant = Object.entries(enriched)
                                    .sort(([, a], [, b]) => (b as number) - (a as number))[0];
                                  return dominant ? (
                                    <div className="bg-linear-to-br from-purple-100 to-blue-100 dark:from-purple-900/40 dark:to-blue-900/40 p-4 rounded-lg shadow-sm">
                                      <p className="text-sm text-gray-600 dark:text-gray-300">Dominant Emotion</p>
                                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                        {ENRICHED_EMOTION_EMOJI[dominant[0] as EnrichedEmotion] || ''} {dominant[0]}
                                      </p>
                                    </div>
                                  ) : null;
                                })()}
                                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                                  <p className="text-sm text-gray-500 dark:text-gray-400">Detailed Emotions</p>
                                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                    {analysisResults.data.emotions ? Object.keys(analysisResults.data.emotions).length : 0}
                                  </p>
                                </div>
                              </div>
                            </div>

                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </>
                )}

                {analysisResults && isLegacyResult(analysisResults) && (
                  <>
                    <TabsContent value="features">
                  <Card className="hover:shadow-lg transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="text-2xl font-semibold">Audio Features</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-8">
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                          <h3 className="font-semibold mb-4 text-lg">Audio Metadata</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm text-gray-500 dark:text-gray-400">File Name</p>
                                <p className="font-medium text-gray-900 dark:text-gray-100">{analysisResults.metadata.filename}</p>
                              </div>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm text-gray-500 dark:text-gray-400">File Size</p>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {(analysisResults.metadata.filesize / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                              <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Analysis Time</p>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {new Date(analysisResults.metadata.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm text-gray-500 dark:text-gray-400">Confidence</p>
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                  {Math.round(analysisResults.deepgram.confidence * 100)}%
                                </p>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-2">
                                <div
                                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                                  style={{ width: `${analysisResults.deepgram.confidence * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                          <h3 className="font-semibold mb-4 text-lg">Speech Analysis</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Pace</p>
                              <p className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                                {analysisResults.gemini.speechPatterns.pace}
                              </p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Clarity</p>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {Math.round(analysisResults.gemini.speechPatterns.clarity * 100)}%
                              </p>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-2">
                                <div
                                  className="bg-green-600 h-2.5 rounded-full transition-all duration-500"
                                  style={{ width: `${analysisResults.gemini.speechPatterns.clarity * 100}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Confidence</p>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {Math.round(analysisResults.gemini.speechPatterns.confidence * 100)}%
                              </p>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mt-2">
                                <div
                                  className="bg-purple-600 h-2.5 rounded-full transition-all duration-500"
                                  style={{ width: `${analysisResults.gemini.speechPatterns.confidence * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                          <h3 className="font-semibold mb-4 text-lg">Emotions</h3>
                          <div className="space-y-6">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Primary Emotion</p>
                              <p className="font-medium text-gray-900 dark:text-gray-100 capitalize mb-2">
                                {analysisResults.gemini.emotions.primary}
                              </p>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                <div
                                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                                  style={{ width: `${analysisResults.gemini.emotions.intensity * 100}%` }}
                                ></div>
                              </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Secondary Emotions</p>
                              <div className="flex flex-wrap gap-2">
                                {analysisResults.gemini.emotions.secondary.map((emotion: string, index: number) => (
                                  <span
                                    key={index}
                                    className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-sm font-medium capitalize"
                                  >
                                    {emotion}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                          <h3 className="font-semibold mb-4 text-lg">Insights</h3>
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                            <ul className="list-disc list-inside space-y-2">
                              {analysisResults.gemini.insights.map((insight: string, index: number) => (
                                <li key={index} className="text-sm text-gray-600 dark:text-gray-300">
                                  {insight}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-lg">
                          <h3 className="font-semibold mb-4 text-lg">Recommendations</h3>
                          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                            <ul className="list-disc list-inside space-y-2">
                              {analysisResults.gemini.recommendations.map((recommendation: string, index: number) => (
                                <li key={index} className="text-sm text-gray-600 dark:text-gray-300">
                                  {recommendation}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="visual">
                  {analysisResults.gemini?.visualizationData?.mindMap &&
                   analysisResults.gemini?.visualizationData?.energyPatterns &&
                   analysisResults.gemini?.visualizationData?.growthInsights ? (
                    <AudioVisualizations 
                      analysisResults={{
                        deepgram: {
                          confidence: analysisResults.deepgram.confidence,
                          sentiment: {
                            overall: analysisResults.deepgram.sentiment.overall,
                            score: analysisResults.deepgram.sentiment.score
                          }
                        },
                        gemini: {
                          emotions: {
                            intensity: analysisResults.gemini.emotions.intensity
                          },
                          speechPatterns: {
                            clarity: analysisResults.gemini.speechPatterns.clarity,
                            confidence: analysisResults.gemini.speechPatterns.confidence
                          },
                          visualizationData: {
                            emotionDistribution: analysisResults.gemini.visualizationData.emotionDistribution,
                            topicRelevance: analysisResults.gemini.visualizationData.topicRelevance,
                            speechMetrics: analysisResults.gemini.visualizationData.speechMetrics,
                            insightCategories: analysisResults.gemini.visualizationData.insightCategories,
                            recommendationPriority: analysisResults.gemini.visualizationData.recommendationPriority,
                            mindMap: analysisResults.gemini.visualizationData.mindMap,
                            energyPatterns: analysisResults.gemini.visualizationData.energyPatterns,
                            growthInsights: analysisResults.gemini.visualizationData.growthInsights
                          }
                        }
                      }} 
                    />
                  ) : (
                    <Card className="p-6">
                      <CardContent>
                        <p className="text-center text-gray-500">
                          Visualization data is incomplete or not available for this analysis.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
                </>
                )}
{/* History  */}
                <TabsContent value="history">
                  <Card className="border-[#e5abc6]/65! bg-[#fff6fb]/95! hover:shadow-lg transition-shadow duration-300">
                    <CardHeader>
                      <CardTitle className="text-2xl font-semibold text-[#4f1636]">Memory Trail</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {historyLoading ? (
                        <div className="text-[#a24575] animate-pulse">Loading history…</div>
                      ) : history.length === 0 ? (
                        <div className="text-[#8f3563]">No previous analyses found.</div>
                      ) : (
                        <ul className="divide-y divide-[#e5d0b7]">
                          {history.map((entry, index) => (
                            <li key={`${entry.id}-${index}`} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                              <div className="flex-1">
                                <div className="font-semibold text-[#7a2d55]">{entry.filename}</div>
                                <div className="text-xs text-[#a24575]">{new Date(entry.date).toLocaleString()}</div>
                                <div className="text-sm text-[#612145] mt-1 line-clamp-2">{entry.summary}</div>
                              </div>
                              <button
                                className="bg-[#c02673] text-white px-4 py-2 rounded font-semibold text-sm hover:bg-[#a81e63] transition w-full sm:w-32 shrink-0"
                                onClick={() => handleLoadHistory(entry)}
                              >
                                Load Analysis
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
    </section>
  );
};

export default AudioAnalysisPage; 
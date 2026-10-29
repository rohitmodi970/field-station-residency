// apps/web/types/audioAnalysis.contract.ts
// Provider-independent Audio & Emotion Analysis Schema

import { BasicEmotion, EnrichedEmotion } from '@/utilities/emotionMapping';

export type AudioEmotionProviderType = 'imentiv' | 'hume';

export type AudioJobStatus = 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface AudioJobSubmissionParams {
  userId: string;
  fileBuffer?: Buffer;
  fileName?: string;
  sourceUrl?: string;
  contentType?: string;
  title?: string;
  description?: string;
  webhookToken?: string;
  speakerDiarization?: boolean;
  textEmotionAnalysis?: boolean;
  language?: string;
  startMillis?: number;
  endMillis?: number;
}

export interface ProviderJobSubmissionResult {
  jobId: string; // Force internal UUID
  providerJobId: string; // Imentiv audio_id or Hume job_id
  provider: AudioEmotionProviderType;
  status: AudioJobStatus;
  sourceUrl: string;
  createdAt: string;
}

export interface NormalizedSegmentEmotion {
  name: string;
  score: number;
}

export interface NormalizedTimeRange {
  beginMillis: number;
  endMillis: number;
  beginSeconds: number;
  endSeconds: number;
}

export interface NormalizedSpeechSegment {
  id: string | number;
  time: NormalizedTimeRange;
  speakerId: string | number;
  speakerName?: string;
  text: string;
  rawEmotions: Record<string, number>;
  basicEmotions: Record<BasicEmotion, number>;
  enrichedEmotions: Record<EnrichedEmotion, number>;
  dominantBasicEmotion?: BasicEmotion;
  dominantEnrichedEmotion?: EnrichedEmotion;
}

export interface NormalizedSpeakerAnalysis {
  id: string | number;
  name: string;
  segmentCount: number;
  totalDurationSeconds: number;
  rawEmotions: Record<string, number>;
  basicEmotions: Record<BasicEmotion, number>;
  enrichedEmotions: Record<EnrichedEmotion, number>;
  dominantBasicEmotion?: BasicEmotion;
  dominantEnrichedEmotion?: EnrichedEmotion;
}

export interface NormalizedEmotionTimelinePoint {
  timeSeconds: number;
  durationSeconds: number;
  speakerId: string | number;
  speakerName?: string;
  text?: string;
  basicEmotions: Record<BasicEmotion, number>;
  enrichedEmotions: Record<EnrichedEmotion, number>;
  dominantBasic?: BasicEmotion;
  dominantEnriched?: EnrichedEmotion;
  valence: number; // -1 to 1 (negative to positive)
  arousal: number; // 0 to 1 (calm to high energy)
}

export interface NormalizedKeyMoment {
  id: string | number;
  timeRange: NormalizedTimeRange;
  type: 'peak_emotion' | 'emotional_shift' | 'high_intensity' | 'vulnerable_moment';
  title: string;
  description: string;
  quote?: string;
  speakerName?: string;
  emotion: {
    basic?: BasicEmotion;
    enriched?: EnrichedEmotion;
    emoji?: string;
    intensity: number;
  };
}

export interface NormalizedTopicCluster {
  id: string | number;
  label: string;
  terms: Array<{ term: string; probability: number }>;
  correlatedEmotions: Array<{ emotion: EnrichedEmotion; score: number; emoji: string }>;
  sentenceCount: number;
}

export interface NormalizedAudioAnalysisResult {
  provider: AudioEmotionProviderType;
  providerJobId: string;
  internalJobId?: string;
  title?: string;
  description?: string;
  transcript: string;
  durationSeconds: number;
  speakerCount: number;
  speakers: NormalizedSpeakerAnalysis[];
  segments: NormalizedSpeechSegment[];
  timeline: NormalizedEmotionTimelinePoint[];
  keyMoments: NormalizedKeyMoment[];
  topicClusters: NormalizedTopicCluster[];
  rawEmotions: Record<string, number>;
  basicEmotions: Record<BasicEmotion, number>;
  enrichedEmotions: Record<EnrichedEmotion, number>;
  dominantBasicEmotion?: { emotion: BasicEmotion; score: number } | null;
  dominantEnrichedEmotion?: { emotion: EnrichedEmotion; score: number; emoji: string } | null;
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
    overall: 'positive' | 'negative' | 'neutral';
    score: number;
  };
  topics: Array<{ term: string; probability: number }>;
  summary: {
    totalDuration: number;
    speakerCount: number;
    topTopics: string[];
    dominantMood: string;
    textSummary?: string;
    emotionDistribution: Record<string, number>;
    basicEmotionDistribution: Record<BasicEmotion, number>;
    enrichedEmotionDistribution: Record<EnrichedEmotion, number>;
  };
  rawPayload?: unknown;
}


export interface ProviderJobStatusResult {
  jobId: string;
  providerJobId: string;
  provider: AudioEmotionProviderType;
  status: AudioJobStatus;
  sourceUrl?: string;
  createdAt?: string;
  completedAt?: string | null;
  errorMessage?: string | null;
  hasResults: boolean;
  analysis?: NormalizedAudioAnalysisResult | null;
}

/**
 * Provider-agnostic interface that any audio emotion analysis service implements.
 */
export interface AudioEmotionProvider {
  readonly name: AudioEmotionProviderType;

  /**
   * Submit audio file or URL to the provider for asynchronous analysis
   */
  submitAudio(params: AudioJobSubmissionParams): Promise<ProviderJobSubmissionResult>;

  /**
   * Check processing status of a job
   */
  checkJobStatus(providerJobId: string, internalJobId?: string): Promise<ProviderJobStatusResult>;

  /**
   * Fetch and normalize completed analysis results from the provider
   */
  getAnalysisResults(providerJobId: string, rawData?: unknown): Promise<NormalizedAudioAnalysisResult>;
}

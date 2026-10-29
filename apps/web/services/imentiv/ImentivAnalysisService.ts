// apps/web/services/imentiv/ImentivAnalysisService.ts
// Day 3: Emotion Mapping & Analysis Pipeline
// Maps Imentiv audio emotions and 28 text emotions to Force's 6 basic + 12 enriched emotion models,
// computes emotion timelines, detects peak moments / emotional shifts, and extracts topic clusters.

import {
  BasicEmotion,
  EnrichedEmotion,
  ENRICHED_EMOTION_EMOJI,
  ENRICHED_EMOTION_VALENCE,
  ENRICHED_EMOTION_AROUSAL,
  getDominantEmotion,
  getDominantEnrichedEmotion,
  getSentimentFromEnriched,
} from '@/utilities/emotionMapping';

import {
  NormalizedAudioAnalysisResult,
  NormalizedEmotionTimelinePoint,
  NormalizedKeyMoment,
  NormalizedSpeakerAnalysis,
  NormalizedSpeechSegment,
  NormalizedTopicCluster,
} from '@/types/audioAnalysis.contract';
import {
  ImentivAudioDetailsResponse,
  ImentivEmotionScores,
  ImentivMultimodalAnalyticsResponse,
} from '@/types/imentiv.contract';

// ─────────────────────────────────────────────────────────────
// 1. Emotion Mapping Tables (Audio + 28 Text Emotions)
// ─────────────────────────────────────────────────────────────

export const IMENTIV_TO_ENRICHED_MAP: Record<string, EnrichedEmotion> = {
  // Positive / Upbeat
  joy: EnrichedEmotion.HAPPINESS,
  happy: EnrichedEmotion.HAPPINESS,
  'joy/happy': EnrichedEmotion.HAPPINESS,
  amusement: EnrichedEmotion.HAPPINESS,
  excitement: EnrichedEmotion.HAPPINESS,
  optimism: EnrichedEmotion.HAPPINESS,
  pride: EnrichedEmotion.HAPPINESS,
  triumph: EnrichedEmotion.HAPPINESS,
  enthusiasm: EnrichedEmotion.HAPPINESS,

  // Love & Connection
  love: EnrichedEmotion.LOVE_WARMTH,
  caring: EnrichedEmotion.LOVE_WARMTH,
  admiration: EnrichedEmotion.LOVE_WARMTH,
  gratitude: EnrichedEmotion.LOVE_WARMTH,
  approval: EnrichedEmotion.LOVE_WARMTH,
  romance: EnrichedEmotion.LOVE_WARMTH,
  adoration: EnrichedEmotion.LOVE_WARMTH,

  // Wonder & Awe
  awe: EnrichedEmotion.WONDER,
  amazement: EnrichedEmotion.WONDER,
  desire: EnrichedEmotion.WONDER,
  realization: EnrichedEmotion.WONDER,

  // Serenity & Calm
  calm: EnrichedEmotion.SERENITY,
  calmness: EnrichedEmotion.SERENITY,
  relief: EnrichedEmotion.SERENITY,
  contentment: EnrichedEmotion.SERENITY,
  neutral: EnrichedEmotion.SERENITY,

  // Curiosity & Mental Engagement
  curiosity: EnrichedEmotion.CURIOSITY,
  interest: EnrichedEmotion.CURIOSITY,
  contemplation: EnrichedEmotion.CURIOSITY,
  concentration: EnrichedEmotion.CURIOSITY,

  // Surprise
  surprise: EnrichedEmotion.SURPRISE,
  shock: EnrichedEmotion.SURPRISE,

  // Sadness & Loss
  sad: EnrichedEmotion.SADNESS,
  sadness: EnrichedEmotion.SADNESS,
  disappointment: EnrichedEmotion.SADNESS,
  grief: EnrichedEmotion.SADNESS,
  remorse: EnrichedEmotion.SADNESS,

  // Anxiety & Stress
  nervousness: EnrichedEmotion.ANXIETY,
  anxiety: EnrichedEmotion.ANXIETY,
  worry: EnrichedEmotion.ANXIETY,
  tenseness: EnrichedEmotion.ANXIETY,

  // Fear & Threat
  fear: EnrichedEmotion.FEAR,
  horror: EnrichedEmotion.FEAR,
  panic: EnrichedEmotion.FEAR,

  // Frustration & Anger
  anger: EnrichedEmotion.FRUSTRATION,
  angry: EnrichedEmotion.FRUSTRATION,
  annoyance: EnrichedEmotion.FRUSTRATION,
  irritation: EnrichedEmotion.FRUSTRATION,

  // Discomfort & Unease
  embarrassment: EnrichedEmotion.DISCOMFORT,
  confusion: EnrichedEmotion.DISCOMFORT,
  disapproval: EnrichedEmotion.DISCOMFORT,
  shame: EnrichedEmotion.DISCOMFORT,
  guilt: EnrichedEmotion.DISCOMFORT,
  awkwardness: EnrichedEmotion.DISCOMFORT,

  // Disgust & Aversion
  disgust: EnrichedEmotion.DISGUST,
  contempt: EnrichedEmotion.DISGUST,
  repulsion: EnrichedEmotion.DISGUST,
  aversion: EnrichedEmotion.DISGUST,
};

export const IMENTIV_TO_BASIC_MAP: Record<string, BasicEmotion> = {
  // Joy
  joy: BasicEmotion.JOY,
  happy: BasicEmotion.JOY,
  'joy/happy': BasicEmotion.JOY,
  amusement: BasicEmotion.JOY,
  excitement: BasicEmotion.JOY,
  optimism: BasicEmotion.JOY,
  pride: BasicEmotion.JOY,
  love: BasicEmotion.JOY,
  caring: BasicEmotion.JOY,
  admiration: BasicEmotion.JOY,
  gratitude: BasicEmotion.JOY,
  approval: BasicEmotion.JOY,
  calm: BasicEmotion.JOY,
  calmness: BasicEmotion.JOY,
  relief: BasicEmotion.JOY,
  contentment: BasicEmotion.JOY,
  neutral: BasicEmotion.JOY,
  curiosity: BasicEmotion.JOY,
  interest: BasicEmotion.JOY,

  // Sadness
  sad: BasicEmotion.SADNESS,
  sadness: BasicEmotion.SADNESS,
  disappointment: BasicEmotion.SADNESS,
  grief: BasicEmotion.SADNESS,
  remorse: BasicEmotion.SADNESS,
  embarrassment: BasicEmotion.SADNESS,
  confusion: BasicEmotion.SADNESS,
  disapproval: BasicEmotion.SADNESS,

  // Anger
  anger: BasicEmotion.ANGER,
  angry: BasicEmotion.ANGER,
  annoyance: BasicEmotion.ANGER,
  irritation: BasicEmotion.ANGER,

  // Fear
  fear: BasicEmotion.FEAR,
  anxiety: BasicEmotion.FEAR,
  nervousness: BasicEmotion.FEAR,
  worry: BasicEmotion.FEAR,
  panic: BasicEmotion.FEAR,
  horror: BasicEmotion.FEAR,

  // Surprise
  surprise: BasicEmotion.SURPRISE,
  shock: BasicEmotion.SURPRISE,
  awe: BasicEmotion.SURPRISE,
  amazement: BasicEmotion.SURPRISE,
  realization: BasicEmotion.SURPRISE,

  // Disgust
  disgust: BasicEmotion.DISGUST,
  contempt: BasicEmotion.DISGUST,
  repulsion: BasicEmotion.DISGUST,
  aversion: BasicEmotion.DISGUST,
};

export { ENRICHED_EMOTION_VALENCE, ENRICHED_EMOTION_AROUSAL };

function extractTranscriptText(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string') return item.trim();
        if (typeof item === 'object') {
          const rec = item as Record<string, unknown>;
          return String(rec.text || rec.segment || rec.sentence || rec.transcript || rec.word || '').trim();
        }
        return '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj.text === 'string' && obj.text.trim()) return obj.text.trim();
    if (typeof obj.transcript === 'string' && obj.transcript.trim()) return obj.transcript.trim();
    if (Array.isArray(obj.segments)) return extractTranscriptText(obj.segments);
    if (Array.isArray(obj.sentences)) return extractTranscriptText(obj.sentences);
    if (Array.isArray(obj.transcript)) return extractTranscriptText(obj.transcript);
    if (Array.isArray(obj.words)) return extractTranscriptText(obj.words);
    if (typeof obj.summary === 'string' && obj.summary.trim()) return obj.summary.trim();
    if (typeof obj.description === 'string' && obj.description.trim()) return obj.description.trim();
  }
  return '';
}

export class ImentivAnalysisService {

  /**
   * Map any raw Imentiv emotion name to Force's BasicEmotion
   */
  mapToBasicEmotion(emotionName: string): BasicEmotion {
    const key = (emotionName || '').toLowerCase().trim();
    if (IMENTIV_TO_BASIC_MAP[key]) return IMENTIV_TO_BASIC_MAP[key];

    if (key.includes('joy') || key.includes('happy') || key.includes('love') || key.includes('calm')) return BasicEmotion.JOY;
    if (key.includes('sad') || key.includes('grief') || key.includes('disappoint')) return BasicEmotion.SADNESS;
    if (key.includes('ang') || key.includes('annoy') || key.includes('frustrat')) return BasicEmotion.ANGER;
    if (key.includes('fear') || key.includes('anx') || key.includes('nerv') || key.includes('worr')) return BasicEmotion.FEAR;
    if (key.includes('surpris') || key.includes('shock') || key.includes('amaz')) return BasicEmotion.SURPRISE;
    if (key.includes('disgust') || key.includes('contempt')) return BasicEmotion.DISGUST;

    return BasicEmotion.JOY;
  }

  /**
   * Map any raw Imentiv emotion name to Force's EnrichedEmotion
   */
  mapToEnrichedEmotion(emotionName: string): EnrichedEmotion {
    const key = (emotionName || '').toLowerCase().trim();
    if (IMENTIV_TO_ENRICHED_MAP[key]) return IMENTIV_TO_ENRICHED_MAP[key];

    if (key.includes('joy') || key.includes('happy') || key.includes('excit') || key.includes('pride')) return EnrichedEmotion.HAPPINESS;
    if (key.includes('love') || key.includes('care') || key.includes('grat') || key.includes('admir')) return EnrichedEmotion.LOVE_WARMTH;
    if (key.includes('awe') || key.includes('amaz') || key.includes('desire')) return EnrichedEmotion.WONDER;
    if (key.includes('calm') || key.includes('relief') || key.includes('peace') || key.includes('neutral')) return EnrichedEmotion.SERENITY;
    if (key.includes('curio') || key.includes('interest')) return EnrichedEmotion.CURIOSITY;
    if (key.includes('surpris') || key.includes('shock')) return EnrichedEmotion.SURPRISE;
    if (key.includes('sad') || key.includes('grief') || key.includes('disappoint')) return EnrichedEmotion.SADNESS;
    if (key.includes('anx') || key.includes('nerv') || key.includes('worr')) return EnrichedEmotion.ANXIETY;
    if (key.includes('fear') || key.includes('panic') || key.includes('terror')) return EnrichedEmotion.FEAR;
    if (key.includes('ang') || key.includes('annoy') || key.includes('irrit')) return EnrichedEmotion.FRUSTRATION;
    if (key.includes('embarrass') || key.includes('confus') || key.includes('disapprov')) return EnrichedEmotion.DISCOMFORT;
    if (key.includes('disgust') || key.includes('contempt') || key.includes('repuls')) return EnrichedEmotion.DISGUST;

    return EnrichedEmotion.DISCOMFORT;
  }

  /**
   * Aggregate raw emotion score map to Force's 6 basic emotions
   */
  aggregateToBasicEmotions(rawScores: ImentivEmotionScores): Record<BasicEmotion, number> {
    const sums: Record<BasicEmotion, number> = {
      [BasicEmotion.JOY]: 0,
      [BasicEmotion.SADNESS]: 0,
      [BasicEmotion.ANGER]: 0,
      [BasicEmotion.FEAR]: 0,
      [BasicEmotion.SURPRISE]: 0,
      [BasicEmotion.DISGUST]: 0,
    };

    Object.entries(rawScores || {}).forEach(([name, score]) => {
      if (typeof score === 'number' && score > 0) {
        const basic = this.mapToBasicEmotion(name);
        sums[basic] += score;
      }
    });

    const total = Object.values(sums).reduce((a, b) => a + b, 0);
    const result = { ...sums };
    if (total > 0) {
      Object.keys(result).forEach((k) => {
        result[k as BasicEmotion] = Number((result[k as BasicEmotion] / total).toFixed(4));
      });
    }
    return result;
  }

  /**
   * Aggregate raw emotion score map to Force's 12 enriched emotions
   */
  aggregateToEnrichedEmotions(rawScores: ImentivEmotionScores): Record<EnrichedEmotion, number> {
    const sums: Record<EnrichedEmotion, number> = {
      [EnrichedEmotion.HAPPINESS]: 0,
      [EnrichedEmotion.LOVE_WARMTH]: 0,
      [EnrichedEmotion.WONDER]: 0,
      [EnrichedEmotion.SERENITY]: 0,
      [EnrichedEmotion.CURIOSITY]: 0,
      [EnrichedEmotion.SURPRISE]: 0,
      [EnrichedEmotion.SADNESS]: 0,
      [EnrichedEmotion.ANXIETY]: 0,
      [EnrichedEmotion.FEAR]: 0,
      [EnrichedEmotion.FRUSTRATION]: 0,
      [EnrichedEmotion.DISCOMFORT]: 0,
      [EnrichedEmotion.DISGUST]: 0,
    };

    Object.entries(rawScores || {}).forEach(([name, score]) => {
      if (typeof score === 'number' && score > 0) {
        const enriched = this.mapToEnrichedEmotion(name);
        sums[enriched] += score;
      }
    });

    const total = Object.values(sums).reduce((a, b) => a + b, 0);
    const result = { ...sums };
    if (total > 0) {
      Object.keys(result).forEach((k) => {
        result[k as EnrichedEmotion] = Number((result[k as EnrichedEmotion] / total).toFixed(4));
      });
    }
    return result;
  }

  /**
   * Build timeline points with valence and arousal metrics
   */
  buildTimeline(segments: NormalizedSpeechSegment[]): NormalizedEmotionTimelinePoint[] {
    return segments.map((seg) => {
      const durationSeconds = Math.max(0.1, seg.time.endSeconds - seg.time.beginSeconds);

      // Compute valence from enriched emotions
      let valenceWeightedSum = 0;
      let arousalWeightedSum = 0;
      let weightTotal = 0;

      Object.entries(seg.enrichedEmotions).forEach(([emotionKey, score]) => {
        const emo = emotionKey as EnrichedEmotion;
        const val = ENRICHED_EMOTION_VALENCE[emo] ?? 0;
        const aro = ENRICHED_EMOTION_AROUSAL[emo] ?? 0.5;
        valenceWeightedSum += val * score;
        arousalWeightedSum += aro * score;
        weightTotal += score;
      });

      const valence = weightTotal > 0 ? Number((valenceWeightedSum / weightTotal).toFixed(3)) : 0;
      const arousal = weightTotal > 0 ? Number((arousalWeightedSum / weightTotal).toFixed(3)) : 0.5;

      return {
        timeSeconds: seg.time.beginSeconds,
        durationSeconds: Number(durationSeconds.toFixed(2)),
        speakerId: seg.speakerId,
        speakerName: seg.speakerName,
        text: seg.text,
        basicEmotions: seg.basicEmotions,
        enrichedEmotions: seg.enrichedEmotions,
        dominantBasic: seg.dominantBasicEmotion,
        dominantEnriched: seg.dominantEnrichedEmotion,
        valence,
        arousal,
      };
    });
  }

  /**
   * Detect Key Moments (Peaks, Emotional Shifts, Turning Points)
   */
  detectKeyMoments(
    segments: NormalizedSpeechSegment[],
    timeline: NormalizedEmotionTimelinePoint[]
  ): NormalizedKeyMoment[] {
    const keyMoments: NormalizedKeyMoment[] = [];
    if (segments.length === 0) return keyMoments;

    // 1. Peak Positive Moments
    let maxPosScore = 0;
    let maxPosSegment: NormalizedSpeechSegment | null = null;

    // 2. Peak Vulnerable / Negative Moments
    let maxNegScore = 0;
    let maxNegSegment: NormalizedSpeechSegment | null = null;

    segments.forEach((seg) => {
      const posScore =
        (seg.enrichedEmotions[EnrichedEmotion.HAPPINESS] || 0) +
        (seg.enrichedEmotions[EnrichedEmotion.LOVE_WARMTH] || 0) +
        (seg.enrichedEmotions[EnrichedEmotion.WONDER] || 0);

      const negScore =
        (seg.enrichedEmotions[EnrichedEmotion.ANXIETY] || 0) +
        (seg.enrichedEmotions[EnrichedEmotion.FRUSTRATION] || 0) +
        (seg.enrichedEmotions[EnrichedEmotion.SADNESS] || 0) +
        (seg.enrichedEmotions[EnrichedEmotion.FEAR] || 0);

      if (posScore > maxPosScore && posScore > 0.3) {
        maxPosScore = posScore;
        maxPosSegment = seg;
      }
      if (negScore > maxNegScore && negScore > 0.3) {
        maxNegScore = negScore;
        maxNegSegment = seg;
      }
    });

    if (maxPosSegment) {
      const seg: NormalizedSpeechSegment = maxPosSegment;
      const domEnriched = seg.dominantEnrichedEmotion || EnrichedEmotion.HAPPINESS;
      keyMoments.push({
        id: 'peak_positive',
        timeRange: seg.time,
        type: 'peak_emotion',
        title: `Peak ${domEnriched}`,
        description: `Highest positive emotional resonance observed during this moment.`,
        quote: seg.text,
        speakerName: seg.speakerName,
        emotion: {
          basic: seg.dominantBasicEmotion,
          enriched: domEnriched,
          emoji: ENRICHED_EMOTION_EMOJI[domEnriched] || '✨',
          intensity: Number(maxPosScore.toFixed(3)),
        },
      });
    }

    if (maxNegSegment && maxNegSegment !== maxPosSegment) {
      const seg: NormalizedSpeechSegment = maxNegSegment;
      const domEnriched = seg.dominantEnrichedEmotion || EnrichedEmotion.ANXIETY;
      keyMoments.push({
        id: 'peak_vulnerable',
        timeRange: seg.time,
        type: 'vulnerable_moment',
        title: `Emotional Intensity (${domEnriched})`,
        description: `Heightened emotional vulnerability or intensity expressed here.`,
        quote: seg.text,
        speakerName: seg.speakerName,
        emotion: {
          basic: seg.dominantBasicEmotion,
          enriched: domEnriched,
          emoji: ENRICHED_EMOTION_EMOJI[domEnriched] || '💭',
          intensity: Number(maxNegScore.toFixed(3)),
        },
      });
    }

    // 3. Emotional Shift Detection (Transitions)
    for (let i = 1; i < timeline.length; i++) {
      const prev = timeline[i - 1];
      const curr = timeline[i];
      if (!prev || !curr) continue;

      const valenceDelta = curr.valence - prev.valence;
      if (Math.abs(valenceDelta) >= 0.6) {
        const isUpward = valenceDelta > 0;
        const seg = segments[i] || segments[i - 1];
        if (!seg) continue;

        keyMoments.push({
          id: `shift_${i}`,
          timeRange: seg.time,
          type: 'emotional_shift',
          title: isUpward ? 'Positive Turnaround' : 'Emotional Dip',
          description: isUpward
            ? `Shifted from ${prev.dominantEnriched || 'tension'} towards ${curr.dominantEnriched || 'relief'}.`
            : `Transitioned into ${curr.dominantEnriched || 'unease'} from ${prev.dominantEnriched || 'calm'}.`,
          quote: curr.text || prev.text,
          speakerName: curr.speakerName,
          emotion: {
            basic: curr.dominantBasic,
            enriched: curr.dominantEnriched,
            emoji: curr.dominantEnriched ? ENRICHED_EMOTION_EMOJI[curr.dominantEnriched] : '🔄',
            intensity: Number(Math.abs(valenceDelta).toFixed(2)),
          },
        });
        break; // Limit to 1 major shift moment
      }
    }

    return keyMoments;
  }

  /**
   * Topic Extraction & Thematic Clustering with Emotion Correlation
   */
  async extractTopicClusters(
    segments: NormalizedSpeechSegment[],
    transcript: string
  ): Promise<{
    topics: Array<{ term: string; probability: number }>;
    topicClusters: NormalizedTopicCluster[];
  }> {
    const sentences = transcript
      .split(/[.!?\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);

    if (sentences.length === 0) {
      return { topics: [], topicClusters: [] };
    }

    const numberOfTopics = Math.min(4, Math.max(1, Math.floor(sentences.length / 3)));
    const termsPerTopic = 6;

    let rawTopics: Array<Array<{ term: string; probability: number }>> = [];

    // Attempt dynamic LDA
    try {
      const ldaModule: any = await import('lda');
      const lda: any = ldaModule && (ldaModule.default || ldaModule);
      if (typeof lda === 'function') {
        const ldaResult = lda(sentences, numberOfTopics, termsPerTopic, ['en']);
        if (Array.isArray(ldaResult)) {
          rawTopics = ldaResult.map((topic: any) =>
            (Array.isArray(topic) ? topic : []).map((t: any) => ({
              term: t?.term || t?.word || String(t),
              probability: Number(t?.probability || t?.value || 0.1),
            }))
          );
        }
      }
    } catch {
      // Fallback heuristic keyword extraction
      const stopWords = new Set([
        'about', 'above', 'after', 'again', 'against', 'all', 'also', 'and', 'any', 'are',
        'because', 'been', 'before', 'being', 'between', 'both', 'but', 'could', 'did', 'does',
        'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has',
        'have', 'having', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
        'into', 'its', 'itself', 'just', 'more', 'most', 'myself', 'only', 'other', 'our',
        'ours', 'ourselves', 'out', 'over', 'own', 'same', 'should', 'some', 'such', 'than',
        'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
        'they', 'this', 'those', 'through', 'too', 'under', 'until', 'very', 'was', 'were',
        'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would',
        'you', 'your', 'yours', 'yourself', 'yourselves',
      ]);

      const wordCounts = new Map<string, number>();
      const words = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);

      words.forEach((w) => {
        if (w.length > 3 && !stopWords.has(w)) {
          wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
        }
      });

      const sorted = Array.from(wordCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);

      const totalCount = sorted.reduce((sum, [, count]) => sum + count, 0) || 1;
      const terms = sorted.map(([term, count]) => ({
        term,
        probability: Number((count / totalCount).toFixed(3)),
      }));

      rawTopics = [terms.slice(0, 6), terms.slice(6, 12)].filter((t) => t.length > 0);
    }

    // Build Topic Clusters correlated with emotions
    const topicClusters: NormalizedTopicCluster[] = [];
    const flattenedTopics: Array<{ term: string; probability: number }> = [];

    rawTopics.forEach((terms, idx) => {
      if (!terms || terms.length === 0) return;

      const topTerms = terms.slice(0, 3).map((t) => t.term);
      const label = topTerms.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' & ');

      // Find segments matching terms in this topic
      const matchingSegments = segments.filter((seg) =>
        terms.some((t) => seg.text.toLowerCase().includes(t.term.toLowerCase()))
      );

      // Aggregate emotions in matching segments
      const emoSum: Record<EnrichedEmotion, number> = {
        [EnrichedEmotion.HAPPINESS]: 0,
        [EnrichedEmotion.LOVE_WARMTH]: 0,
        [EnrichedEmotion.WONDER]: 0,
        [EnrichedEmotion.SERENITY]: 0,
        [EnrichedEmotion.CURIOSITY]: 0,
        [EnrichedEmotion.SURPRISE]: 0,
        [EnrichedEmotion.SADNESS]: 0,
        [EnrichedEmotion.ANXIETY]: 0,
        [EnrichedEmotion.FEAR]: 0,
        [EnrichedEmotion.FRUSTRATION]: 0,
        [EnrichedEmotion.DISCOMFORT]: 0,
        [EnrichedEmotion.DISGUST]: 0,
      };

      const sourceSegments = matchingSegments.length > 0 ? matchingSegments : segments;
      sourceSegments.forEach((seg) => {
        Object.entries(seg.enrichedEmotions).forEach(([emo, score]) => {
          emoSum[emo as EnrichedEmotion] += score;
        });
      });

      const total = Object.values(emoSum).reduce((a, b) => a + b, 0) || 1;
      const correlatedEmotions = Object.entries(emoSum)
        .map(([emo, sum]) => ({
          emotion: emo as EnrichedEmotion,
          score: Number((sum / total).toFixed(3)),
          emoji: ENRICHED_EMOTION_EMOJI[emo as EnrichedEmotion] || '✨',
        }))
        .filter((item) => item.score > 0.05)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      topicClusters.push({
        id: idx + 1,
        label,
        terms,
        correlatedEmotions,
        sentenceCount: sourceSegments.length,
      });

      terms.forEach((t) => {
        if (!flattenedTopics.some((existing) => existing.term === t.term)) {
          flattenedTopics.push(t);
        }
      });
    });

    return {
      topics: flattenedTopics.slice(0, 15),
      topicClusters,
    };
  }

  /**
   * Normalize an Imentiv audio response with Day 3 enhancements:
   * Timelines, Key Moments, Topic Clusters, Speaker Diarization, and 12-Enriched / 6-Basic emotion maps.
   */
  processImentivResults(
    audioDetails: ImentivAudioDetailsResponse,
    multimodal?: ImentivMultimodalAnalyticsResponse | null
  ): NormalizedAudioAnalysisResult {
    const audioId = audioDetails.id || multimodal?.audio_id || 'unknown';

    // 1. Merge Raw Emotions (Weighted combination)
    const rawAudioEmotions: ImentivEmotionScores =
      audioDetails.average_audio_emotions ||
      multimodal?.emotion_analysis?.overall?.audio ||
      {};

    const rawTextEmotions: ImentivEmotionScores =
      multimodal?.emotion_analysis?.overall?.text || {};

    const mergedRawEmotions: Record<string, number> = {};
    Object.entries(rawAudioEmotions).forEach(([k, v]) => {
      mergedRawEmotions[k.toLowerCase()] = (mergedRawEmotions[k.toLowerCase()] || 0) + (typeof v === 'number' ? v : 0);
    });
    Object.entries(rawTextEmotions).forEach(([k, v]) => {
      mergedRawEmotions[k.toLowerCase()] = (mergedRawEmotions[k.toLowerCase()] || 0) + (typeof v === 'number' ? v : 0);
    });

    // 2. Aggregate Basic & Enriched Emotions
    const basicEmotions = this.aggregateToBasicEmotions(mergedRawEmotions);
    const enrichedEmotions = this.aggregateToEnrichedEmotions(mergedRawEmotions);

    const dominantBasic = getDominantEmotion(basicEmotions);
    const dominantEnriched = getDominantEnrichedEmotion(enrichedEmotions);
    const sentiment = getSentimentFromEnriched(enrichedEmotions);

    // 3. Process Segments
    const segments: NormalizedSpeechSegment[] = [];
    const rawSegments =
      audioDetails.segment_audio_emotions ||
      (audioDetails as any).segments ||
      (Array.isArray((audioDetails as any).transcript) ? (audioDetails as any).transcript : []) ||
      [];
    const textSegments = audioDetails.segment_text_emotions || [];

    const totalSegmentCount = Math.max(rawSegments.length, textSegments.length);
    for (let i = 0; i < totalSegmentCount; i++) {
      const audioSeg = rawSegments[i] || {};
      const textSeg = textSegments[i] || {};

      const startMillis = Number(audioSeg.start_millis ?? textSeg.start_millis ?? i * 2000);
      const endMillis = Number(audioSeg.end_millis ?? textSeg.end_millis ?? startMillis + 2000);

      const segmentRawEmotions: ImentivEmotionScores = {
        ...(audioSeg.emotions || {}),
        ...(textSeg.emotions || {}),
      };

      const segBasic = this.aggregateToBasicEmotions(segmentRawEmotions);
      const segEnriched = this.aggregateToEnrichedEmotions(segmentRawEmotions);

      const segDomBasic = getDominantEmotion(segBasic)?.emotion;
      const segDomEnriched = getDominantEnrichedEmotion(segEnriched)?.emotion;

      const speakerId = String(audioSeg.speaker_id ?? 'speaker_1');
      const text = String(
        audioSeg.text ||
        audioSeg.segment ||
        audioSeg.sentence ||
        textSeg.sentence ||
        textSeg.text ||
        textSeg.segment ||
        ''
      ).trim();

      segments.push({
        id: i + 1,
        time: {
          beginMillis: startMillis,
          endMillis,
          beginSeconds: Number((startMillis / 1000).toFixed(2)),
          endSeconds: Number((endMillis / 1000).toFixed(2)),
        },
        speakerId,
        speakerName: typeof speakerId === 'number' ? `Speaker ${speakerId}` : speakerId,
        text,
        rawEmotions: segmentRawEmotions,
        basicEmotions: segBasic,
        enrichedEmotions: segEnriched,
        dominantBasicEmotion: segDomBasic,
        dominantEnrichedEmotion: segDomEnriched,
      });
    }

    // 4. Construct Transcript (guaranteed to be string)
    let transcript = segments.map((s) => s.text).filter(Boolean).join(' ').trim();
    if (!transcript) {
      transcript = extractTranscriptText(
        (audioDetails as any)?.transcript ||
        (audioDetails as any)?.text ||
        audioDetails.summary ||
        multimodal?.description
      );
    }

    // 5. Speaker Analysis
    const speakerMap = new Map<string, NormalizedSpeakerAnalysis>();
    const registeredSpeakers = audioDetails.speakers || multimodal?.detected_speakers || [];

    registeredSpeakers.forEach((spk) => {
      const id = String(spk.speaker_id);
      speakerMap.set(id, {
        id,
        name: spk.name || `Speaker ${spk.speaker_id}`,
        segmentCount: 0,
        totalDurationSeconds: 0,
        rawEmotions: {},
        basicEmotions: {
          [BasicEmotion.JOY]: 0,
          [BasicEmotion.SADNESS]: 0,
          [BasicEmotion.ANGER]: 0,
          [BasicEmotion.FEAR]: 0,
          [BasicEmotion.SURPRISE]: 0,
          [BasicEmotion.DISGUST]: 0,
        },
        enrichedEmotions: {
          [EnrichedEmotion.HAPPINESS]: 0,
          [EnrichedEmotion.LOVE_WARMTH]: 0,
          [EnrichedEmotion.WONDER]: 0,
          [EnrichedEmotion.SERENITY]: 0,
          [EnrichedEmotion.CURIOSITY]: 0,
          [EnrichedEmotion.SURPRISE]: 0,
          [EnrichedEmotion.SADNESS]: 0,
          [EnrichedEmotion.ANXIETY]: 0,
          [EnrichedEmotion.FEAR]: 0,
          [EnrichedEmotion.FRUSTRATION]: 0,
          [EnrichedEmotion.DISCOMFORT]: 0,
          [EnrichedEmotion.DISGUST]: 0,
        },
      });
    });

    segments.forEach((seg) => {
      const spkId = String(seg.speakerId);
      if (!speakerMap.has(spkId)) {
        speakerMap.set(spkId, {
          id: spkId,
          name: seg.speakerName || `Speaker ${spkId}`,
          segmentCount: 0,
          totalDurationSeconds: 0,
          rawEmotions: {},
          basicEmotions: { ...seg.basicEmotions },
          enrichedEmotions: { ...seg.enrichedEmotions },
        });
      }
      const spk = speakerMap.get(spkId)!;
      spk.segmentCount += 1;
      spk.totalDurationSeconds += Math.max(0, seg.time.endSeconds - seg.time.beginSeconds);
    });

    const speakers = Array.from(speakerMap.values());
    const durationSeconds = Number(audioDetails.audio_duration || multimodal?.duration || 0);

    // 6. Build Emotion Timeline
    const timeline = this.buildTimeline(segments);

    // 7. Detect Key Moments & Transitions
    const keyMoments = this.detectKeyMoments(segments, timeline);

    // 8. Topics & Topic Clusters
    const fallbackTopics: Array<{ term: string; probability: number }> = [];
    if (dominantEnriched) {
      fallbackTopics.push({ term: dominantEnriched.emotion, probability: dominantEnriched.score });
    }
    if (dominantBasic) {
      fallbackTopics.push({ term: dominantBasic.emotion, probability: dominantBasic.score });
    }

    const topicClusters: NormalizedTopicCluster[] = [];
    if (dominantEnriched) {
      topicClusters.push({
        id: 1,
        label: dominantEnriched.emotion,
        terms: fallbackTopics,
        correlatedEmotions: [
          {
            emotion: dominantEnriched.emotion,
            score: dominantEnriched.score,
            emoji: ENRICHED_EMOTION_EMOJI[dominantEnriched.emotion] || '✨',
          },
        ],
        sentenceCount: segments.length,
      });
    }

    const topTopics = fallbackTopics.map((t) => t.term);
    const dominantMood = dominantEnriched?.emotion || 'Balanced';

    return {
      provider: 'imentiv',
      providerJobId: audioId,
      title: audioDetails.title || multimodal?.title || 'Audio Emotion Analysis',
      description: multimodal?.description,
      transcript,
      durationSeconds,
      speakerCount: Math.max(speakers.length, 1),
      speakers,
      segments,
      timeline,
      keyMoments,
      topicClusters,
      rawEmotions: mergedRawEmotions,
      basicEmotions,
      enrichedEmotions,
      dominantBasicEmotion: dominantBasic,
      dominantEnrichedEmotion: dominantEnriched
        ? {
            emotion: dominantEnriched.emotion,
            score: dominantEnriched.score,
            emoji: ENRICHED_EMOTION_EMOJI[dominantEnriched.emotion] || '✨',
          }
        : null,
      sentiment: {
        positive: sentiment.positive,
        negative: sentiment.negative,
        neutral: sentiment.neutral,
        overall: sentiment.overall as 'positive' | 'negative' | 'neutral',
        score: sentiment.score,
      },
      topics: fallbackTopics,
      summary: {
        totalDuration: durationSeconds,
        speakerCount: Math.max(speakers.length, 1),
        topTopics,
        dominantMood,
        textSummary: audioDetails.summary,
        emotionDistribution: mergedRawEmotions,
        basicEmotionDistribution: basicEmotions,
        enrichedEmotionDistribution: enrichedEmotions,
      },
      rawPayload: {
        audioDetails,
        multimodal,
      },
    };
  }
}

export const imentivAnalysisService = new ImentivAnalysisService();

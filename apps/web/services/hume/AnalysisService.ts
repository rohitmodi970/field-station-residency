/**
 * AnalysisService - Processes Hume prediction data and performs topic modeling
 * 
 * This service:
 * 1. Parses and correlates data from language, prosody, and burst models
 * 2. Creates a unified transcript with time-stamped emotions
 * 3. Performs LDA topic modeling on the transcript
 * 4. Maps detailed Hume emotions to 6 basic emotion categories
 */

import { aggregateToBasicEmotions, aggregateToEnrichedEmotions, BasicEmotion, EnrichedEmotion } from '@/utilities/emotionMapping';

// LDA will be imported dynamically when needed

// Type definitions for Hume prediction structure
interface Emotion {
  name: string;
  score: number;
}

interface TimeRange {
  begin: number;
  end: number;
}

interface LanguagePrediction {
  text: string;
  time: TimeRange;
  emotions: Emotion[];
}

interface ProsodyPrediction {
  time: TimeRange;
  emotions: Emotion[];
}

interface BurstPrediction {
  time: TimeRange;
  emotions: Emotion[];
}

interface GroupedPrediction {
  id: string; // Speaker ID (e.g., "SPEAKER_00")
  predictions: (LanguagePrediction | ProsodyPrediction | BurstPrediction)[];
}

interface ModelResults {
  metadata: any;
  grouped_predictions: GroupedPrediction[];
  // Hume sometimes returns camelCase keys
  groupedPredictions?: GroupedPrediction[];
}

interface HumePredictions {
  results?: {
    predictions?: Array<{
      models?: {
        language?: ModelResults;
        prosody?: ModelResults;
        burst?: ModelResults;
      };
    }>;
  };
}

export interface UnifiedTranscriptEntry {
  text: string;
  time: TimeRange;
  speaker: string;
  languageEmotions: Emotion[];
  prosodyEmotions: Emotion[];
  burstEmotions: Emotion[];
}

export interface AnalysisResults {
  transcript: string;
  unifiedTranscript: UnifiedTranscriptEntry[];
  speakers: string[];
  emotions: Record<string, number>;
  basicEmotions: Record<BasicEmotion, number>;
  enrichedEmotions: Record<EnrichedEmotion, number>;
  topics: Array<{
    terms: Array<{ term: string; probability: number }>;
  }>;
  summary: {
    totalDuration: number;
    speakerCount: number;
    emotionDistribution: Record<string, number>;
    basicEmotionDistribution: Record<BasicEmotion, number>;
    enrichedEmotionDistribution: Record<EnrichedEmotion, number>;
    topTopics: string[];
  };
}

export class AnalysisService {
  /**
   * Process Hume predictions and generate analysis
   */
  async processPredictions(predictions: any): Promise<AnalysisResults> {
    try {
      if (!predictions) {
        throw new Error('Predictions object is null or undefined');
      }

      // Debug: Log the structure of predictions to understand format
      console.log('[AnalysisService] Processing predictions...');
      console.log('[AnalysisService] Predictions type:', typeof predictions);
      console.log('[AnalysisService] Is array:', Array.isArray(predictions));
      
      if (Array.isArray(predictions)) {
        console.log('[AnalysisService] Array length:', predictions.length);
        if (predictions.length > 0) {
          console.log('[AnalysisService] First array item:', {
            keys: Object.keys(predictions[0] || {}).slice(0, 15),
            hasModels: !!predictions[0]?.models,
            hasLanguage: !!predictions[0]?.language,
            hasProsody: !!predictions[0]?.prosody,
            hasBurst: !!predictions[0]?.burst,
            sample: JSON.stringify(predictions[0]).substring(0, 300)
          });
        }
      } else {
        console.log('[AnalysisService] Object keys:', Object.keys(predictions as any).slice(0, 15));
      }

      const parsed = this.parsePredictions(predictions);
      const unified = this.correlateData(parsed);
      if (!parsed.language) {
        console.log('[AnalysisService] Using fallback unified transcript (language model missing)');
      }
      
      // Perform topic modeling with error handling
      let topics: AnalysisResults['topics'] = [];
      try {
        topics = await this.performTopicModeling(unified);
      } catch (topicErr) {
        console.warn('[AnalysisService] Topic modeling failed:', topicErr instanceof Error ? topicErr.message : String(topicErr));
        // Continue without topics
      }

      let emotions = this.aggregateEmotions(unified);
      // If language model produced no unified transcript, attempt to aggregate from available models
      if (Object.keys(emotions).length === 0) {
        emotions = this.aggregateEmotionsFromModels(parsed);
      }
      const speakers = this.extractSpeakers(parsed);
      const transcript = this.extractFullTranscript(unified);

      // Map detailed Hume emotions to 6 basic emotion categories
      const basicEmotions = aggregateToBasicEmotions(emotions);
      // Map to 12 enriched emotion categories
      const enrichedEmotions = aggregateToEnrichedEmotions(emotions);

      console.log(`[AnalysisService] Processed predictions: ${speakers.length} speakers, ${unified.length} transcript entries, ${Object.keys(emotions).length} detailed emotions, ${Object.keys(basicEmotions).filter(k => basicEmotions[k as BasicEmotion] > 0).length} basic emotions, ${Object.keys(enrichedEmotions).filter(k => enrichedEmotions[k as EnrichedEmotion] > 0).length} enriched emotions detected`);

      return {
        transcript,
        unifiedTranscript: unified,
        speakers,
        emotions,
        basicEmotions,
        enrichedEmotions,
        topics,
        summary: {
          totalDuration: this.calculateDuration(unified),
          speakerCount: speakers.length,
          emotionDistribution: emotions,
          basicEmotionDistribution: basicEmotions,
          enrichedEmotionDistribution: enrichedEmotions,
          topTopics: topics.slice(0, 5).flatMap(t => t.terms.map(term => term.term)),
        },
      };
    } catch (error) {
      console.error('[AnalysisService] Error processing predictions:', error instanceof Error ? error.message : String(error));
      // Return minimal valid result structure to prevent downstream errors
      return {
        transcript: '',
        unifiedTranscript: [],
        speakers: [],
        emotions: {},
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
        topics: [],
        summary: {
          totalDuration: 0,
          speakerCount: 0,
          emotionDistribution: {},
          basicEmotionDistribution: {
            [BasicEmotion.JOY]: 0,
            [BasicEmotion.SADNESS]: 0,
            [BasicEmotion.ANGER]: 0,
            [BasicEmotion.FEAR]: 0,
            [BasicEmotion.SURPRISE]: 0,
            [BasicEmotion.DISGUST]: 0,
          },
          enrichedEmotionDistribution: {
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
          topTopics: [],
        },
      };
    }
  }

  /**
   * Parse Hume prediction structure
   * Handles multiple possible response formats from Hume API
   */
  private parsePredictions(predictions: any): {
    language: ModelResults | null;
    prosody: ModelResults | null;
    burst: ModelResults | null;
  } {
    try {
      // Validate predictions structure
      if (!predictions || typeof predictions !== 'object') {
        console.warn('[AnalysisService] Predictions is not a valid object');
        return { language: null, prosody: null, burst: null };
      }

      // Debug: show top-level snippet (safe stringify)
      try {
        const snippet = JSON.stringify(predictions, (_, value) => typeof value === 'bigint' ? value.toString() : value).slice(0, 1000);
        console.log('[AnalysisService] Raw predictions snippet:', snippet);
      } catch (err) {
        console.log('[AnalysisService] Raw predictions keys:', Object.keys(predictions).slice(0, 20));
      }

      // If predictions is an array, extract the first element
      let predictionItem = predictions;
      if (Array.isArray(predictions)) {
        console.log('[AnalysisService] Predictions is an array, extracting first element');
        if (predictions.length === 0) {
          console.warn('[AnalysisService] Predictions array is empty');
          return { language: null, prosody: null, burst: null };
        }
        predictionItem = predictions[0];
      }

      console.log('[AnalysisService] Processing prediction item:', {
        hasModels: !!predictionItem?.models,
        hasLanguage: !!predictionItem?.language,
        hasProsody: !!predictionItem?.prosody,
        hasBurst: !!predictionItem?.burst,
        keys: Object.keys(predictionItem || {}).slice(0, 10),
      });

      // Extract models object - could be at different locations
      let models: any = null;

      // Priority 1: predictions.models (most common)
      if (predictionItem?.models) {
        console.log('[AnalysisService] Found models at predictionItem.models');
        models = predictionItem.models;
      }
      // Priority 2: predictions itself is the models object (has language/prosody/burst)
      else if (predictionItem?.language || predictionItem?.prosody || predictionItem?.burst) {
        console.log('[AnalysisService] Prediction item itself is the models object');
        models = predictionItem;
      }
      // Priority 3: nested predictions.results.predictions
      else if (predictionItem?.results?.predictions?.[0]?.models) {
        console.log('[AnalysisService] Found models at nested results.predictions[0].models');
        models = predictionItem.results.predictions[0].models;
      }

      // Priority 4: try to find models in any child object (handles numeric-keyed / array-like responses)
      if (!models && typeof predictionItem === 'object') {
        // If object has numeric string keys (e.g., { '0': {...} }) treat as array-like
        const keys = Object.keys(predictionItem);
        for (const k of keys) {
          try {
            const candidate = (predictionItem as any)[k];
            if (candidate?.models) {
              console.log(`[AnalysisService] Found models under numeric/key '${k}'`);
              models = candidate.models;
              break;
            }
            if (candidate?.language || candidate?.prosody || candidate?.burst) {
              console.log(`[AnalysisService] Found models-like structure under key '${k}'`);
              models = candidate;
              break;
            }
          } catch (e) {
            // ignore
          }
        }
      }

      // Priority 5: check values one level deeper
      if (!models && typeof predictionItem === 'object') {
        const values = Object.values(predictionItem) as any[];
        for (const v of values) {
          if (!v || typeof v !== 'object') continue;
          const vAny = v as any;
          if (vAny?.models) {
            console.log('[AnalysisService] Found models in nested value');
            models = vAny.models;
            break;
          }
          if (vAny?.language || vAny?.prosody || vAny?.burst) {
            console.log('[AnalysisService] Found models-like structure in nested value');
            models = vAny;
            break;
          }
        }
      }

      // Priority 6: deep search for models/language/prosody/burst keys
      if (!models && typeof predictionItem === 'object') {
        const deepFind = (obj: any, depth = 0): any | null => {
          if (!obj || typeof obj !== 'object' || depth > 3) return null;
          if (obj.models) return obj.models;
          if (obj.language || obj.prosody || obj.burst) return obj;
          for (const k of Object.keys(obj)) {
            try {
              const v = obj[k];
              const found = deepFind(v, depth + 1);
              if (found) return found;
            } catch (e) {
              // ignore
            }
          }
          return null;
        };

        const deepModels = deepFind(predictionItem, 0);
        if (deepModels) {
          console.log('[AnalysisService] Found models via deep search');
          models = deepModels;
        }
      }
      if (!models || typeof models !== 'object') {
        console.warn('[AnalysisService] No models found in prediction item', {
          hasPredictionModels: !!predictionItem?.models,
          hasDirectLanguage: !!predictionItem?.language,
          hasDirectProsody: !!predictionItem?.prosody,
          hasDirectBurst: !!predictionItem?.burst,
          predictItemKeys: Object.keys(predictionItem || {}).slice(0, 10),
        });
        return { language: null, prosody: null, burst: null };
      }

      // Extract each model with validation
      let language: ModelResults | null = null;
      let prosody: ModelResults | null = null;
      let burst: ModelResults | null = null;

      if (models.language) {
        language = this.validateModelResults(models.language, 'language');
      }
      if (models.prosody) {
        prosody = this.validateModelResults(models.prosody, 'prosody');
      }
      if (models.burst) {
        burst = this.validateModelResults(models.burst, 'burst');
      }

      console.log('[AnalysisService] Parsed models:', {
        hasLanguage: !!language,
        hasProsody: !!prosody,
        hasBurst: !!burst,
        languageGroups: language?.grouped_predictions?.length || 0,
        prosodyGroups: prosody?.grouped_predictions?.length || 0,
        burstGroups: burst?.grouped_predictions?.length || 0,
      });

      return {
        language,
        prosody,
        burst,
      };
    } catch (error) {
      console.error('[AnalysisService] Error parsing predictions:', error instanceof Error ? error.message : String(error));
      return {
        language: null,
        prosody: null,
        burst: null,
      };
    }
  }

  /**
   * Validate ModelResults structure
   */
  private validateModelResults(model: any, modelName: string): ModelResults | null {
    if (!model || typeof model !== 'object') {
      console.warn(`[AnalysisService] ${modelName} model is not a valid object`);
      return null;
    }

    // Hume sometimes returns camelCase keys (groupedPredictions). Accept both.
    if (!Array.isArray(model.grouped_predictions)) {
      if (Array.isArray((model as any).groupedPredictions)) {
        // Normalize camelCase -> snake_case to make downstream code simpler
        (model as any).grouped_predictions = (model as any).groupedPredictions;
        console.log(`[AnalysisService] Normalized ${modelName} groupedPredictions -> grouped_predictions`);
      }
    }

    if (!Array.isArray(model.grouped_predictions)) {
      console.warn(`[AnalysisService] ${modelName} model has no grouped_predictions array`);
      return null;
    }

    return model as ModelResults;
  }

  /**
   * Correlate data from language, prosody, and burst models
   * 
   * This creates a unified transcript where each word has associated
   * emotions from all three models.
   */
  private correlateData(parsed: {
    language: ModelResults | null;
    prosody: ModelResults | null;
    burst: ModelResults | null;
  }): UnifiedTranscriptEntry[] {
    const unified: UnifiedTranscriptEntry[] = [];

    if (!parsed.language) {
      console.warn('[AnalysisService] Language model is null, attempting fallback transcript from prosody/burst');

      // If language is missing, try creating a minimal transcript from prosody or burst grouped predictions.
      // This ensures UI visualizations (emotions / durations) have something to show even when ASR/text is absent.
      const fallback: UnifiedTranscriptEntry[] = [];

      // Build from prosody predictions (utterance-level) if available
      if (parsed.prosody?.grouped_predictions) {
        parsed.prosody.grouped_predictions.forEach(group => {
          const speakerId = group?.id || 'unknown';
          (group.predictions || []).forEach((p: any) => {
            if (!p || !p.time) return;
            fallback.push({
              text: '',
              time: p.time,
              speaker: speakerId,
              languageEmotions: [],
              prosodyEmotions: Array.isArray(p.emotions) ? p.emotions : [],
              burstEmotions: [],
            });
          });
        });
      }

      // Build from burst predictions (overlapping energetic/emotional tokens)
      if (parsed.burst?.grouped_predictions) {
        parsed.burst.grouped_predictions.forEach(group => {
          const speakerId = group?.id || 'unknown';
          (group.predictions || []).forEach((p: any) => {
            if (!p || !p.time) return;
            // If there is already a fallback covering the same start/end, merge emotions
            const overlap = fallback.findIndex(f => f.time.begin === p.time.begin && f.time.end === p.time.end && f.speaker === speakerId);
            const burstEmotions = Array.isArray(p.emotions) ? p.emotions : [];
            if (overlap >= 0) {
              // Merge burst emotions
              if (fallback[overlap]) {
                fallback[overlap].burstEmotions = [...fallback[overlap].burstEmotions, ...burstEmotions];
              }
            } else {
              fallback.push({
                text: '',
                time: p.time,
                speaker: speakerId,
                languageEmotions: [],
                prosodyEmotions: [],
                burstEmotions,
              });
            }
          });
        });
      }

      // Sort by start time
      fallback.sort((a, b) => a.time.begin - b.time.begin);
      console.log(`[AnalysisService] Fallback unified transcript entries: ${fallback.length}`);
      return fallback;
    }

    // Iterate through each speaker
    for (const speakerGroup of parsed.language.grouped_predictions || []) {
      if (!speakerGroup || !speakerGroup.id) {
        console.warn('[AnalysisService] Speaker group missing ID');
        continue;
      }

      const speakerId = speakerGroup.id;

      // Iterate through language predictions (word-level)
      for (const langPred of speakerGroup.predictions as LanguagePrediction[]) {
        if (!langPred || !langPred.time) {
          console.warn('[AnalysisService] Language prediction missing time or data');
          continue;
        }

        const wordTime = langPred.time;

        // Find matching prosody prediction (utterance-level)
        const prosodyPred = this.findMatchingProsody(
          parsed.prosody,
          speakerId,
          wordTime
        );

        // Find matching burst predictions (overlapping time ranges)
        const burstPreds = this.findMatchingBursts(
          parsed.burst,
          speakerId,
          wordTime
        );

        unified.push({
          text: langPred.text || '',
          time: wordTime,
          speaker: speakerId,
          languageEmotions: (langPred.emotions && Array.isArray(langPred.emotions)) ? langPred.emotions : [],
          prosodyEmotions: (prosodyPred?.emotions && Array.isArray(prosodyPred.emotions)) ? prosodyPred.emotions : [],
          burstEmotions: burstPreds.flatMap(b => (b.emotions && Array.isArray(b.emotions)) ? b.emotions : []),
        });
      }
    }

    return unified;
  }

  /**
   * Find prosody prediction that contains the given time range
   */
  private findMatchingProsody(
    prosody: ModelResults | null,
    speakerId: string,
    timeRange: TimeRange
  ): ProsodyPrediction | null {
    if (!prosody) return null;

    const speakerGroup = prosody.grouped_predictions?.find(g => g.id === speakerId);
    if (!speakerGroup) return null;

    // Find prosody prediction whose time range contains the word time
    return (speakerGroup.predictions as ProsodyPrediction[]).find(p => {
      return (
        p.time.begin <= timeRange.begin &&
        p.time.end >= timeRange.end
      );
    }) || null;
  }

  /**
   * Find burst predictions that overlap with the given time range
   */
  private findMatchingBursts(
    burst: ModelResults | null,
    speakerId: string,
    timeRange: TimeRange
  ): BurstPrediction[] {
    if (!burst) return [];

    const speakerGroup = burst.grouped_predictions?.find(g => g.id === speakerId);
    if (!speakerGroup) return [];

    // Find burst predictions that overlap with the word time
    return (speakerGroup.predictions as BurstPrediction[]).filter(p => {
      return !(
        p.time.end < timeRange.begin ||
        p.time.begin > timeRange.end
      );
    });
  }

  /**
   * Extract full transcript text
   */
  private extractFullTranscript(unified: UnifiedTranscriptEntry[]): string {
    return unified.map(entry => entry.text).join(' ');
  }

  /**
   * Extract unique speaker IDs
   */
  private extractSpeakers(parsed: {
    language: ModelResults | null;
    prosody: ModelResults | null;
    burst: ModelResults | null;
  }): string[] {
    const speakers = new Set<string>();

    [parsed.language, parsed.prosody, parsed.burst].forEach(model => {
      if (model?.grouped_predictions) {
        model.grouped_predictions.forEach(group => {
          speakers.add(group.id);
        });
      }
    });

    return Array.from(speakers);
  }

  /**
   * Aggregate emotions from all models
   */
  private aggregateEmotions(unified: UnifiedTranscriptEntry[]): Record<string, number> {
    const emotionScores: Record<string, number[]> = {};

    unified.forEach(entry => {
      // Aggregate language emotions
      entry.languageEmotions.forEach(emotion => {
        if (!emotionScores[emotion.name]) {
          emotionScores[emotion.name] = [];
        }
        (emotionScores[emotion.name] ??= []).push(emotion.score);
      });

      // Aggregate prosody emotions
      entry.prosodyEmotions.forEach(emotion => {
        (emotionScores[emotion.name] ??= []).push(emotion.score);
      });

      // Aggregate burst emotions
      entry.burstEmotions.forEach(emotion => {
        (emotionScores[emotion.name] ??= []).push(emotion.score);
      });
    });

    // Calculate average scores
    const aggregated: Record<string, number> = {};
    Object.keys(emotionScores).forEach(emotion => {
      const scores = emotionScores[emotion];
      if (scores && scores.length > 0) {
        aggregated[emotion] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      }
    });

    return aggregated;
  }

  /**
   * Aggregate emotions directly from provided models if there is no unified transcript
   */
  private aggregateEmotionsFromModels(parsed: {
    language: ModelResults | null;
    prosody: ModelResults | null;
    burst: ModelResults | null;
  }): Record<string, number> {
    const scores: Record<string, number[]> = {};

    const handleEmotionArray = (arr: any[]) => {
      if (!Array.isArray(arr)) return;
      arr.forEach(e => {
        if (!e || !e.name || typeof e.score !== 'number') return;
        if (!scores[e.name]) scores[e.name] = [];
        (scores[e.name] ??= []).push(e.score);
      });
    };

    // Collect across language/prosody/burst group predictions
    [parsed.language, parsed.prosody, parsed.burst].forEach(model => {
      if (!model || !Array.isArray(model.grouped_predictions)) return;
      model.grouped_predictions.forEach(group => {
        if (!Array.isArray(group.predictions)) return;
        group.predictions.forEach((p: any) => {
          if (Array.isArray(p.emotions)) {
            handleEmotionArray(p.emotions);
          }
        });
      });
    });

    const aggregated: Record<string, number> = {};
    Object.keys(scores).forEach(k => {
      const arr = scores[k];
      if (Array.isArray(arr) && arr.length > 0) {
        aggregated[k] = arr.reduce((a, b) => a + b, 0) / arr.length;
      }
    });

    return aggregated;
  }

  /**
   * Perform LDA topic modeling on the transcript
   */
  private async performTopicModeling(unified: UnifiedTranscriptEntry[]): Promise<Array<{
    terms: Array<{ term: string; probability: number }>;
  }>> {
    const transcript = this.extractFullTranscript(unified);

    // Split transcript into sentences for LDA
    const sentences = transcript
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10); // Filter out very short sentences

    if (sentences.length === 0) {
      return [];
    }

    // Define LDA parameters
    const numberOfTopics = Math.min(5, Math.max(2, Math.floor(sentences.length / 3)));
    const termsPerTopic = 10;
    const language = 'en';

    try {
      // Dynamically import LDA (handles both CommonJS and ES modules)
      let ldaModule: any;
      try {
        ldaModule = await import('lda');
      } catch (impErr) {
        console.error('[AnalysisService] Failed to import lda module:', impErr);
        throw impErr;
      }

      const lda: any = (ldaModule && (ldaModule.default || ldaModule));

      // Run LDA algorithm
      const ldaResult: any = lda(sentences, numberOfTopics, termsPerTopic, [language]);

      // Transform LDA result to our format
      return (Array.isArray(ldaResult) ? ldaResult : []).map((topic: any) => ({
        terms: (Array.isArray(topic) ? topic : []).map((term: any) => ({
          term: term?.term || term?.word || String(term),
          probability: term?.probability || term?.value || 0,
        })),
      }));
    } catch (error) {
      console.error('LDA topic modeling error:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Calculate total duration from unified transcript
   */
  private calculateDuration(unified: UnifiedTranscriptEntry[]): number {
    if (unified.length === 0) return 0;

    const lastEntry = unified[unified.length - 1];
    if (!lastEntry || !lastEntry.time) return 0;
    return lastEntry.time.end;
  }
}


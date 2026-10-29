// apps/web/utilities/HumeAudioProcess.ts
import { uploadToSupabaseStorage, getSignedUrl, BUCKETS, deleteFromSupabaseStorage } from '@/utils/supabase/storage';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import {
  extractSimpleTranscript,
  buildGlobalEmotionMap,
  formatAnalysisForFrontend,
  createEmotionTimeSeries,
} from '@/utilities/humeDataParser';
import type { UnifiedTranscriptEntry } from '@/services/hume/AnalysisService';

// ---------- Types ----------
export interface LanguageConfig {
  language?: string | null;
  granularity?: 'word' | 'sentence' | 'passage' | string;
  identify_speakers?: boolean;
  enable_sections?: boolean;
}

export interface HumeWordTimestamp {
  text: string;
  time: { begin: number; end: number };
  confidence?: number;
}

export interface HumePhonemeTimestamp {
  text: string;
  time: { begin: number; end: number };
}

export interface HumeProcessResult {
  transcript: string;
  confidence: number;
  sentiment: { overall: string; score: number };
  topics: string[];
  keywords: string[];
  summary: string;
  wordTimestamps?: HumeWordTimestamp[];
  phonemeTimestamps?: HumePhonemeTimestamp[] | undefined;
  unified?: UnifiedTranscriptEntry[];
  frontend?: any;
  error?: string;
  errorCode?: 'HUME_CREDITS_EXHAUSTED' | 'HUME_JOB_FAILED' | 'HUME_JOB_TIMEOUT' | 'HUME_API_ERROR';
  statusCode?: number;
}

// ---------- Constants ----------
const HUME_BASE = 'https://api.hume.ai/v0';

// ---------- Helpers ----------
/** Use the globally available fetch (Node 18+ / Next.js). No node-fetch fallback. */
function getFetch(): typeof fetch {
  // @ts-ignore
  return fetch;
}

function extractFirstPredictionNode(predictions: any): any {
  if (!predictions) return null;

  if (predictions?.results?.predictions?.[0]) {
    return predictions.results.predictions[0];
  }

  if (predictions?.predictions?.[0]) {
    return predictions.predictions[0];
  }

  if (Array.isArray(predictions)) {
    const first = predictions[0];
    if (!first) return null;
    if (first?.results?.predictions?.[0]) {
      return first.results.predictions[0];
    }
    if (first?.predictions?.[0]) {
      return first.predictions[0];
    }
    return first;
  }

  return predictions;
}

function classifyHumeError(error: unknown): { message: string; errorCode: NonNullable<HumeProcessResult['errorCode']>; statusCode: number } {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes('exhausted credit balance') ||
    lower.includes('credit balance is too low') ||
    lower.includes('insufficient credit') ||
    lower.includes('insufficient credits') ||
    lower.includes('quota') ||
    lower.includes('billing')
  ) {
    return {
      message: 'Hume credit balance is exhausted. Please top up your Hume account and try again.',
      errorCode: 'HUME_CREDITS_EXHAUSTED',
      statusCode: 402,
    };
  }

  if (lower.includes('timeout')) {
    return {
      message: 'Hume analysis timed out while processing the audio file.',
      errorCode: 'HUME_JOB_TIMEOUT',
      statusCode: 504,
    };
  }

  return {
    message: rawMessage || 'Hume audio processing failed.',
    errorCode: 'HUME_JOB_FAILED',
    statusCode: 502,
  };
}

function createHumeFailureResult(message: string, errorCode: NonNullable<HumeProcessResult['errorCode']>, statusCode: number): HumeProcessResult {
  return {
    transcript: 'Error processing audio with Hume API',
    confidence: 0,
    sentiment: { overall: 'neutral', score: 0 },
    topics: [],
    keywords: [],
    summary: 'Processing error occurred',
    error: message,
    errorCode,
    statusCode,
  };
}

/**
 * Convert Hume REST predictions -> UnifiedTranscriptEntry[]
 * Flexible handling for common Hume shapes.
 */
function convertPredictionsToUnified(predictions: any): UnifiedTranscriptEntry[] {
  if (!predictions) return [];

  const firstPred = extractFirstPredictionNode(predictions);

  const languageModel = firstPred?.models?.language || firstPred?.language || null;
  const prosodyModel = firstPred?.models?.prosody || firstPred?.prosody || null;
  const burstModel = firstPred?.models?.burst || firstPred?.burst || null;
  const grouped =
    languageModel?.grouped_predictions ||
    languageModel?.predictions ||
    prosodyModel?.grouped_predictions ||
    prosodyModel?.predictions ||
    burstModel?.grouped_predictions ||
    burstModel?.predictions ||
    null;

  const unified: UnifiedTranscriptEntry[] = [];
  let candidates: any[] = [];

  if (grouped && Array.isArray(grouped)) {
    candidates = grouped;
  } else {
    const fallback = Array.isArray(predictions)
      ? predictions.flatMap((item: any) => item?.results?.predictions || item?.predictions || [])
      : (predictions?.results?.predictions || predictions?.predictions || []);
    for (const p of fallback) {
      const lm = p?.models?.language || p?.language;
      const pm = p?.models?.prosody || p?.prosody;
      const bm = p?.models?.burst || p?.burst;
      if (lm?.grouped_predictions) candidates.push(...lm.grouped_predictions);
      else if (lm?.predictions) candidates.push(...lm.predictions);
      else if (pm?.grouped_predictions) candidates.push(...pm.grouped_predictions);
      else if (pm?.predictions) candidates.push(...pm.predictions);
      else if (bm?.grouped_predictions) candidates.push(...bm.grouped_predictions);
      else if (bm?.predictions) candidates.push(...bm.predictions);
    }
  }

  for (const group of candidates) {
    if (group?.predictions && Array.isArray(group.predictions)) {
      const speakerId = group.id ?? undefined;
      for (const p of group.predictions) {
        if (!p) continue;
        const text = String(p?.text ?? '').trim();
        const begin = Number(p?.time?.begin ?? p?.start ?? 0);
        const end = Number(p?.time?.end ?? p?.end ?? 0);
        if (!text) continue;
        unified.push({
          speakerId,
          text,
          time: { begin, end },
          languageEmotions: Array.isArray(p?.emotions) ? p.emotions : [],
          prosodyEmotions: Array.isArray(p?.prosody_emotions)
            ? p.prosody_emotions
            : (Array.isArray(p?.emotions) ? p.emotions : []),
          burstEmotions: Array.isArray(p?.burst_emotions) ? p.burst_emotions : [],
        } as unknown as UnifiedTranscriptEntry);
      }
    } else if (Array.isArray(group)) {
      for (const p of group) {
        if (!p) continue;
        const text = String(p?.text ?? '').trim();
        const begin = Number(p?.time?.begin ?? p?.start ?? 0);
        const end = Number(p?.time?.end ?? p?.end ?? 0);
        if (!text) continue;
        unified.push({
          text,
          time: { begin, end },
          languageEmotions: Array.isArray(p?.emotions) ? p.emotions : [],
          prosodyEmotions: Array.isArray(p?.prosody_emotions)
            ? p.prosody_emotions
            : (Array.isArray(p?.emotions) ? p.emotions : []),
          burstEmotions: Array.isArray(p?.burst_emotions) ? p.burst_emotions : [],
        } as unknown as UnifiedTranscriptEntry);
      }
    } else {
      const p = group;
      if (!p) continue;
      const text = String(p?.text ?? '').trim();
      const begin = Number(p?.time?.begin ?? p?.start ?? 0);
      const end = Number(p?.time?.end ?? p?.end ?? 0);
      if (!text) continue;
      unified.push({
        text,
        time: { begin, end },
        languageEmotions: Array.isArray(p?.emotions) ? p.emotions : [],
        prosodyEmotions: Array.isArray(p?.prosody_emotions)
          ? p.prosody_emotions
          : (Array.isArray(p?.emotions) ? p.emotions : []),
        burstEmotions: Array.isArray(p?.burst_emotions) ? p.burst_emotions : [],
      } as unknown as UnifiedTranscriptEntry);
    }
  }

  return unified.filter(u => u && u.text && u.text.trim().length > 0);
}

// ---------- Hume REST helpers ----------
/**
 * Create Hume batch job.
 * IMPORTANT: for your Hume API version we send models.language as an object (not an array).
 * Also request prosody and burst explicitly and enable transcription.
 */
async function createHumeJob(fileUrl: string, languageConfig: LanguageConfig, humeApiKey: string) {
  const fetchImpl = getFetch();
  const body = {
    urls: [fileUrl],
    models: {
      language: languageConfig, // single object expected by this API version
      prosody: {},               // request prosody model
      burst: {},                 // request vocal burst model
    },
    notify: false,
  };

  // Helpful debug (trim very long URL in production)
  console.debug('[Hume] create job payload keys:', { modelKeys: Object.keys(body.models), languageConfig });

  const res = await fetchImpl(`${HUME_BASE}/batch/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hume-Api-Key': humeApiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to create Hume job: ${res.status} ${res.statusText} ${text}`);
  }

  const json = await res.json();
  const jobId = json?.job_id || json?.id || json?.jobId;
  if (!jobId) throw new Error('Hume job created but no job id returned');
  return { jobId, raw: json };
}

/** Get Hume job status */
async function getHumeJobStatus(jobId: string, humeApiKey: string) {
  const fetchImpl = getFetch();
  const res = await fetchImpl(`${HUME_BASE}/batch/jobs/${jobId}`, {
    method: 'GET',
    headers: { 'X-Hume-Api-Key': humeApiKey },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to get Hume job status: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

/** Get Hume job predictions */
async function getHumeJobPredictions(jobId: string, humeApiKey: string) {
  const fetchImpl = getFetch();
  const res = await fetchImpl(`${HUME_BASE}/batch/jobs/${jobId}/predictions`, {
    method: 'GET',
    headers: { 'X-Hume-Api-Key': humeApiKey },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to get Hume job predictions: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

// ---------- Main processing functions ----------
/** Process an audio file path using Hume */
export const processWithHume = async (
  filePath: string,
  userId?: string,
  includePhonemes: boolean = false
): Promise<HumeProcessResult> => {
  try {
    const humeApiKey = process.env.HUME_API_KEY || process.env.HUME_AI_API_KEY;
    if (!humeApiKey) {
      console.warn('HUME_API_KEY not set - returning fallback');
      return {
        transcript: 'Transcription unavailable - API key not configured',
        confidence: 0,
        sentiment: { overall: 'neutral', score: 0 },
        topics: [],
        keywords: [],
        summary: 'Summary unavailable',
      };
    }

    // Read file
    const fileBuffer = await fs.promises.readFile(filePath);
    const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'audio.mp3';

    // Upload to Supabase and get signed URL
    let uploadedPath: string | null = null;
    let fileUrl: string;
    if (userId) {
      const uploadResult = await uploadToSupabaseStorage(
        userId,
        fileBuffer,
        `temp-${uuidv4()}-${fileName}`,
        'audio',
        { bucket: BUCKETS.USERS_CLOUD, makePublic: false }
      );
      uploadedPath = uploadResult.path;
      // 300s expiry (adjust if needed). Hume must be able to GET this.
      fileUrl = await getSignedUrl(uploadResult.bucket, uploadResult.path, 300);
      console.log('[Hume] Signed URL (will be used by Hume):', fileUrl);
    } else {
      throw new Error('userId is required for Hume transcription');
    }

    // Language config
    const languageConfig: LanguageConfig = { granularity: 'word', identify_speakers: true };

    // Create job
    const { jobId } = await createHumeJob(fileUrl, languageConfig, humeApiKey);
    console.log(`[Hume] Job created: ${jobId}`);

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60;
    let jobComplete = false;
    let predictions: any = null;

    while (!jobComplete && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      const statusResponse = await getHumeJobStatus(jobId, humeApiKey);
      const status =
        statusResponse?.state?.status ||
        statusResponse?.status ||
        statusResponse?.job?.status ||
        statusResponse?.job_status;
      console.log(`[Hume] Job status: ${status}`);

      if (String(status).toUpperCase() === 'COMPLETED' || status === 'COMPLETED') {
        jobComplete = true;
        predictions = await getHumeJobPredictions(jobId, humeApiKey);
      } else if (String(status).toUpperCase() === 'FAILED' || status === 'FAILED') {
        throw new Error(`Hume job failed: ${JSON.stringify(statusResponse)}`);
      }
      attempts++;
    }

    if (!jobComplete) throw new Error('Hume job timeout - processing took too long');

    // Clean up uploaded file
    if (uploadedPath && userId) {
      try {
        await deleteFromSupabaseStorage(BUCKETS.USERS_CLOUD, uploadedPath);
        console.log('✅ File deleted:', uploadedPath);
      } catch (e) {
        console.warn('Failed to delete temporary file:', e);
      }
    }

    // Convert predictions to unified entries
    const unified = convertPredictionsToUnified(predictions);

    if (!unified || unified.length === 0) {
      console.warn('[Hume] converted unified empty — raw predictions:', JSON.stringify(predictions).slice(0, 1000));
      return processHumePredictions(predictions, includePhonemes);
    }

    // Build analysis
    const transcript = extractSimpleTranscript(unified);
    const emotionsMap = buildGlobalEmotionMap(unified);

    // Keywords/topics
    const words = transcript.toLowerCase().split(/\s+/);
    const stopWords = ['the','and','is','in','to','a','of','with','for','on','at','by','this','that'];
    const wordFreq: Record<string, number> = {};
    words.forEach(w => {
      const clean = w.replace(/[^\w]/g, '');
      if (clean.length > 4 && !stopWords.includes(clean)) wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    });
    const keywords = Object.entries(wordFreq).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k])=>k);
    const topics = keywords.slice(0,5);
    const sentences = transcript.split(/[.!?]+/).filter(s=>s.trim().length>0);
    const summary = sentences.slice(0,2).join('. ').trim() + (sentences.length > 2 ? '...' : '');

    // Sentiment from emotionsMap
    const positiveEmotions = ['joy','happiness','excitement','contentment','calmness','satisfaction'];
    const negativeEmotions = ['sadness','anger','fear','disgust','contempt','anxiety','frustration'];
    let pos = 0, neg = 0, neu = 0;
    for (const [name, score] of Object.entries(emotionsMap)) {
      const n = name.toLowerCase();
      if (positiveEmotions.some(e => n.includes(e))) pos += score;
      else if (negativeEmotions.some(e => n.includes(e))) neg += score;
      else neu += score;
    }
    const total = pos + neg + neu;
    let overallSentiment = 'neutral';
    let sentimentScore = 0;
    if (total > 0) {
      if (pos > neg && pos > neu) { overallSentiment = 'positive'; sentimentScore = pos / total; }
      else if (neg > pos && neg > neu) { overallSentiment = 'negative'; sentimentScore = neg / total; }
      else { overallSentiment = 'neutral'; sentimentScore = neu / total; }
    }

    // Frontend-friendly payload
    const frontend = formatAnalysisForFrontend({
      transcript,
      emotions: emotionsMap,
      topics: topics.map(t => ({ terms: [{ term: t, probability: 1 }] })),
      speakers: Array.from(new Set(unified.map(u => (u as any).speakerId).filter(Boolean))) as string[],
      summary,
    } as any);

    const wordTimestamps: HumeWordTimestamp[] = unified.map(u => ({
      text: u.text,
      time: { begin: u.time?.begin ?? 0, end: u.time?.end ?? 0 },
      confidence: (u as any).languageEmotions && (u as any).languageEmotions.length > 0
        ? ((u as any).languageEmotions.reduce((s: number, e: any) => s + (e.score || 0), 0) / (u as any).languageEmotions.length)
        : undefined,
    }));

    return {
      transcript,
      confidence: 0,
      sentiment: { overall: overallSentiment, score: sentimentScore },
      topics,
      keywords,
      summary,
      wordTimestamps,
      phonemeTimestamps: includePhonemes ? [] : undefined,
      unified,
      frontend,
    };
  } catch (err: unknown) {
    const failure = classifyHumeError(err);
    console.error('Error processing with Hume:', failure.message);
    return createHumeFailureResult(failure.message, failure.errorCode, failure.statusCode);
  }
};

/** Process buffer variant */
export const processBufferWithHume = async (
  audioBuffer: Buffer,
  userId: string,
  fileName: string = 'audio.mp3',
  includePhonemes: boolean = false
): Promise<HumeProcessResult> => {
  try {
    const humeApiKey = process.env.HUME_API_KEY || process.env.HUME_AI_API_KEY;
    if (!humeApiKey) throw new Error('HUME_API_KEY not set');
    if (!userId) throw new Error('userId is required');

    console.log(`Calling Hume API with buffer size: ${audioBuffer.length} bytes`);

    const uploadResult = await uploadToSupabaseStorage(
      userId,
      audioBuffer,
      `temp-${uuidv4()}-${fileName}`,
      'audio',
      { bucket: BUCKETS.USERS_CLOUD, makePublic: false }
    );

    const fileUrl = await getSignedUrl(uploadResult.bucket, uploadResult.path, 300);
    console.log('[Hume] Signed URL (buffer variant):', fileUrl);

    console.log("[Hume] Signed URL (for debugging):", fileUrl);

    const languageConfig: LanguageConfig = { granularity: 'word', identify_speakers: true };

    const { jobId } = await createHumeJob(fileUrl, languageConfig, humeApiKey);
    console.log(`[Hume] Job created: ${jobId}`);

    let attempts = 0;
    const maxAttempts = 60;
    let jobComplete = false;
    let predictions: any = null;

    while (!jobComplete && attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 2000));
      const statusResponse = await getHumeJobStatus(jobId, humeApiKey);
      const status =
        statusResponse?.state?.status ||
        statusResponse?.status ||
        statusResponse?.job?.status ||
        statusResponse?.job_status;
      console.log(`[Hume] Job status: ${status}`);

      if (String(status).toUpperCase() === 'COMPLETED' || status === 'COMPLETED') {
        jobComplete = true;
        predictions = await getHumeJobPredictions(jobId, humeApiKey);
      } else if (String(status).toUpperCase() === 'FAILED' || status === 'FAILED') {
        throw new Error(`Hume job failed: ${JSON.stringify(statusResponse)}`);
      }
      attempts++;
    }

    if (!jobComplete) throw new Error('Hume job timeout - processing took too long');

    try {
      await deleteFromSupabaseStorage(uploadResult.bucket, uploadResult.path);
    } catch (e) {
      console.warn('Failed to clean up temporary file:', e);
    }

    const unified = convertPredictionsToUnified(predictions);
    if (!unified || unified.length === 0) {
      console.warn('[Hume] converted unified empty in buffer variant — falling back to legacy parser');
      console.log('[Hume] Raw predictions structure:', JSON.stringify(predictions, null, 2).slice(0, 2000));
      return processHumePredictions(predictions, includePhonemes);
    }

    // reuse same assembly logic
    const transcript = extractSimpleTranscript(unified);
    const emotionsMap = buildGlobalEmotionMap(unified);
    const words = transcript.toLowerCase().split(/\s+/);
    const stopWords = ['the','and','is','in','to','a','of','with','for','on','at','by','this','that'];
    const wordFreq: Record<string, number> = {};
    words.forEach(w => {
      const clean = w.replace(/[^\w]/g, '');
      if (clean.length > 4 && !stopWords.includes(clean)) wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    });
    const keywords = Object.entries(wordFreq).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k])=>k);
    const topics = keywords.slice(0,5);
    const sentences = transcript.split(/[.!?]+/).filter(s=>s.trim().length>0);
    const summary = sentences.slice(0,2).join('. ').trim() + (sentences.length > 2 ? '...' : '');
    const positiveEmotions = ['joy','happiness','excitement','contentment','calmness','satisfaction'];
    const negativeEmotions = ['sadness','anger','fear','disgust','contempt','anxiety','frustration'];
    let pos = 0, neg = 0, neu = 0;
    for (const [name, score] of Object.entries(emotionsMap)) {
      const n = name.toLowerCase();
      if (positiveEmotions.some(e => n.includes(e))) pos += score;
      else if (negativeEmotions.some(e => n.includes(e))) neg += score;
      else neu += score;
    }
    const total = pos + neg + neu;
    let overallSentiment = 'neutral';
    let sentimentScore = 0;
    if (total > 0) {
      if (pos > neg && pos > neu) { overallSentiment = 'positive'; sentimentScore = pos / total; }
      else if (neg > pos && neg > neu) { overallSentiment = 'negative'; sentimentScore = neg / total; }
      else { overallSentiment = 'neutral'; sentimentScore = neu / total; }
    }

    const frontend = formatAnalysisForFrontend({
      transcript,
      emotions: emotionsMap,
      topics: topics.map(t => ({ terms: [{ term: t, probability: 1 }] })),
      speakers: Array.from(new Set(unified.map(u => (u as any).speakerId).filter(Boolean))) as string[],
      summary,
    } as any);

    const wordTimestamps: HumeWordTimestamp[] = unified.map(u => ({
      text: u.text,
      time: { begin: u.time?.begin ?? 0, end: u.time?.end ?? 0 },
      confidence: (u as any).languageEmotions && (u as any).languageEmotions.length > 0
        ? ((u as any).languageEmotions.reduce((s: number, e: any) => s + (e.score || 0), 0) / (u as any).languageEmotions.length)
        : undefined,
    }));

    return {
      transcript,
      confidence: 0,
      sentiment: { overall: overallSentiment, score: sentimentScore },
      topics,
      keywords,
      summary,
      wordTimestamps,
      phonemeTimestamps: includePhonemes ? [] : undefined,
      unified,
      frontend,
    };

  } catch (err: unknown) {
    const failure = classifyHumeError(err);
    console.error('Error processing buffer with Hume:', failure.message);
    return createHumeFailureResult(failure.message, failure.errorCode, failure.statusCode);
  }
};

// ---------- Legacy/defensive fallback parser ----------
function processHumePredictions(predictions: any, includePhonemes: boolean = false): HumeProcessResult {
  console.log('[Hume] processHumePredictions called');
  
  // Try multiple paths to find the first prediction node
  const firstPrediction = extractFirstPredictionNode(predictions) || predictions;
  
  const models = firstPrediction?.models || firstPrediction || {};
  const parsedTranscriptModel: any =
    models.language ||
    models.Language ||
    models.prosody ||
    models.Prosody ||
    models.burst ||
    models.Burst ||
    null;

  console.log('[Hume] parsedTranscriptModel structure:', {
    hasGroupedPredictions: !!parsedTranscriptModel?.grouped_predictions,
    hasPredictions: !!parsedTranscriptModel?.predictions,
    keys: parsedTranscriptModel ? Object.keys(parsedTranscriptModel).slice(0, 10) : []
  });

  const wordTimestamps: HumeWordTimestamp[] = [];
  let fullTranscript = '';
  let totalConfidence = 0;
  let wordCount = 0;

  if (parsedTranscriptModel?.grouped_predictions) {
    for (const speakerGroup of parsedTranscriptModel.grouped_predictions) {
      if (!speakerGroup?.predictions) continue;
      for (const pred of speakerGroup.predictions) {
        if (!pred || !pred.text) continue;
        const confidenceEstimate = pred.emotions && pred.emotions.length > 0
          ? pred.emotions.reduce((sum: number, e: any) => sum + (e.score || 0), 0) / pred.emotions.length
          : 0.9;

        wordTimestamps.push({
          text: pred.text,
          time: { begin: pred.time?.begin ?? 0, end: pred.time?.end ?? 0 },
          confidence: confidenceEstimate,
        });

        fullTranscript += pred.text + ' ';
        totalConfidence += confidenceEstimate;
        wordCount++;
      }
    }
  }

  const averageConfidence = wordCount > 0 ? totalConfidence / wordCount : 0;

  const allEmotions: Array<{ name: string; score: number }> = [];
  if (parsedTranscriptModel?.grouped_predictions) {
    for (const speakerGroup of parsedTranscriptModel.grouped_predictions) {
      for (const pred of speakerGroup.predictions || []) {
        if (pred.emotions) {
          allEmotions.push(...pred.emotions.map((e: any) => ({ name: e.name, score: e.score || 0 })));
        }
      }
    }
  }

  const positiveEmotions = ['joy', 'happiness', 'excitement', 'contentment', 'calmness'];
  const negativeEmotions = ['sadness', 'anger', 'fear', 'disgust', 'contempt', 'anxiety'];

  let positiveScore = 0, negativeScore = 0, neutralScore = 0;
  allEmotions.forEach(emotion => {
    const n = (emotion.name || '').toLowerCase();
    if (positiveEmotions.some(e => n.includes(e))) positiveScore += emotion.score;
    else if (negativeEmotions.some(e => n.includes(e))) negativeScore += emotion.score;
    else neutralScore += emotion.score;
  });

  const totalScore = positiveScore + negativeScore + neutralScore;
  let overallSentiment = 'neutral', sentimentScore = 0;
  if (totalScore > 0) {
    if (positiveScore > negativeScore && positiveScore > neutralScore) { overallSentiment = 'positive'; sentimentScore = positiveScore / totalScore; }
    else if (negativeScore > positiveScore && negativeScore > neutralScore) { overallSentiment = 'negative'; sentimentScore = negativeScore / totalScore; }
    else { overallSentiment = 'neutral'; sentimentScore = neutralScore / totalScore; }
  }

  const words = fullTranscript.toLowerCase().split(/\s+/);
  const stopWords = ['the','and','is','in','to','a','of','with','for','on','at','by','this','that'];
  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    const cleanWord = word.replace(/[^\w]/g, '');
    if (cleanWord.length > 4 && !stopWords.includes(cleanWord)) {
      wordFreq[cleanWord] = (wordFreq[cleanWord] || 0) + 1;
    }
  });

  const keywords = Object.entries(wordFreq).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([w])=>w);
  const topics = keywords.slice(0,5);
  const sentences = fullTranscript.split(/[.!?]+/).filter(s=>s.trim().length>0);
  const summary = sentences.slice(0,2).join('. ').trim() + (sentences.length > 2 ? '...' : '');

  return {
    transcript: fullTranscript.trim(),
    confidence: averageConfidence,
    sentiment: { overall: overallSentiment, score: sentimentScore },
    topics,
    keywords,
    summary,
    wordTimestamps,
    phonemeTimestamps: includePhonemes ? [] : undefined,
  };
}

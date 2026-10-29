import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { uploadToSupabaseStorage, getSignedUrl, BUCKETS, deleteFromSupabaseStorage } from '@/utils/supabase/storage';
import { AnalysisService } from '@/services/hume/AnalysisService';
import { isImentivConfigured } from '@/config/imentiv.config';
import { imentivClient } from '@/services/imentiv/ImentivClient';
import { imentivAnalysisService } from '@/services/imentiv/ImentivAnalysisService';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('audioChunk') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No audio chunk provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log(`Processing audio chunk: ${file.name}, size: ${buffer.length} bytes`);

    // ───────────────────────────────────────────────
    // 1. Imentiv Chunk Processing (Default if configured)
    // ───────────────────────────────────────────────
    if (isImentivConfigured()) {
      try {
        const uploadResponse = await imentivClient.uploadAudio({
          title: `chunk-${Date.now()}`,
          audio_file: buffer,
          speaker_diarization: true,
          text_emotion_analysis: true,
        });

        const audioId = uploadResponse.id;
        console.log(`[Chunk] Imentiv audio uploaded: ${audioId}`);

        let attempts = 0;
        const maxAttempts = 30; // 30 * 2s = 60s
        let isDone = false;
        let audioDetails: any = null;

        while (!isDone && attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 2000));
          audioDetails = await imentivClient.getAudioDetails(audioId);
          const currentStatus = (audioDetails.status || '').toUpperCase();
          console.log(`[Chunk] Imentiv status: ${currentStatus}`);

          if (currentStatus === 'COMPLETED') {
            isDone = true;
          } else if (currentStatus === 'FAILED') {
            throw new Error('Imentiv chunk processing failed');
          }
          attempts++;
        }

        if (!isDone || !audioDetails) {
          throw new Error('Imentiv chunk processing timeout');
        }

        const multimodal = await imentivClient.getMultimodalAnalytics(audioId).catch(() => null);
        const normalized = imentivAnalysisService.processImentivResults(audioDetails, multimodal);

        return NextResponse.json({
          provider: 'imentiv',
          hume: {
            transcript: normalized.transcript,
            emotions: normalized.rawEmotions,
            basicEmotions: normalized.basicEmotions,
            enrichedEmotions: normalized.enrichedEmotions,
            topics: normalized.topics.map((t) => ({ terms: [t] })),
            summary: {
              totalDuration: normalized.durationSeconds,
              speakerCount: normalized.speakerCount,
              emotionDistribution: normalized.rawEmotions,
              basicEmotionDistribution: normalized.basicEmotions,
              enrichedEmotionDistribution: normalized.enrichedEmotions,
              topTopics: normalized.summary.topTopics,
            },
            unifiedTranscript: normalized.segments.map((s) => ({
              text: s.text,
              time: { begin: s.time.beginSeconds, end: s.time.endSeconds },
              speaker: String(s.speakerId),
              languageEmotions: Object.entries(s.rawEmotions).map(([name, score]) => ({ name, score })),
              prosodyEmotions: Object.entries(s.rawEmotions).map(([name, score]) => ({ name, score })),
              burstEmotions: [],
            })),
            speakers: normalized.speakers.map((s) => s.name),
          },
          analysis: normalized,
        });
      } catch (imentivErr) {
        console.warn('[Chunk] Imentiv error, checking for Hume fallback:', imentivErr);
      }
    }

    // ───────────────────────────────────────────────
    // 2. Hume Chunk Processing Fallback
    // ───────────────────────────────────────────────
    const humeApiKey = process.env.HUME_API_KEY || process.env.HUME_AI_API_KEY;
    if (!humeApiKey) {
      return NextResponse.json(
        {
          message: 'Audio analysis provider not configured',
          error: 'Neither Imentiv nor Hume API key is configured',
          hume: {
            transcript: '',
            confidence: 0,
            sentiment: { overall: 'neutral', score: 0 },
            topics: [],
            keywords: [],
            summary: '',
            wordTimestamps: [],
          },
        },
        { status: 500 }
      );
    }

    // Upload to Supabase Storage and get signed URL
    const uploadResult = await uploadToSupabaseStorage(
      user.id,
      buffer,
      `temp-${uuidv4()}-${file.name}`,
      'audio',
      { bucket: BUCKETS.USERS_CLOUD, makePublic: false }
    );

    const fileUrl = await getSignedUrl(uploadResult.bucket, uploadResult.path, 300);
    console.log('[Chunk] Signed URL:', fileUrl);

    // Create Hume batch job
    const HUME_BASE = 'https://api.hume.ai/v0';
    const body = {
      urls: [fileUrl],
      models: {
        language: { granularity: 'word', identify_speakers: true },
        prosody: {},
        burst: {},
      },
      notify: false,
    };

    const createRes = await fetch(`${HUME_BASE}/batch/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hume-Api-Key': humeApiKey,
      },
      body: JSON.stringify(body),
    });

    if (!createRes.ok) {
      const text = await createRes.text().catch(() => '');
      throw new Error(`Failed to create Hume job: ${createRes.status} ${text}`);
    }

    const createJson = await createRes.json();
    const jobId = createJson?.job_id || createJson?.id;
    console.log(`[Chunk] Hume job created: ${jobId}`);

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60;
    let jobComplete = false;
    let predictions: any = null;

    while (!jobComplete && attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`${HUME_BASE}/batch/jobs/${jobId}`, {
        method: 'GET',
        headers: { 'X-Hume-Api-Key': humeApiKey },
      });

      const statusJson = await statusRes.json();
      const status = statusJson?.state?.status || statusJson?.status;

      if (String(status).toUpperCase() === 'COMPLETED') {
        jobComplete = true;
        const predRes = await fetch(`${HUME_BASE}/batch/jobs/${jobId}/predictions`, {
          method: 'GET',
          headers: { 'X-Hume-Api-Key': humeApiKey },
        });
        predictions = await predRes.json();
      } else if (String(status).toUpperCase() === 'FAILED') {
        throw new Error(`Hume job failed: ${JSON.stringify(statusJson)}`);
      }
      attempts++;
    }

    if (!jobComplete) {
      throw new Error('Hume job timeout');
    }

    // Clean up temporary file
    try {
      await deleteFromSupabaseStorage(uploadResult.bucket, uploadResult.path);
    } catch (e) {
      console.warn('Failed to delete temporary chunk file:', e);
    }

    // Process predictions using AnalysisService
    const analysisService = new AnalysisService();
    const analysisResults = await analysisService.processPredictions(predictions);

    return NextResponse.json({ provider: 'hume', hume: analysisResults });
  } catch (error: unknown) {
    console.error('Chunk processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        message: 'Error processing chunk',
        error: errorMessage,
        hume: {
          transcript: '',
          confidence: 0,
          sentiment: { overall: 'neutral', score: 0 },
          topics: [],
          keywords: [],
          summary: '',
          wordTimestamps: [],
        },
      },
      { status: 500 }
    );
  }
}




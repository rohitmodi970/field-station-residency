/**
 * New Hume-based audio analysis endpoint
 * 
 * This endpoint implements the webhook-based architecture:
 * 1. Uploads audio to S3
 * 2. Initiates Hume batch job with webhook callback
 * 3. Returns job ID immediately (202 Accepted)
 * 4. Results are processed asynchronously via webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { IngestService } from '@/services/hume/IngestService';
import { AnalysisService } from '@/services/hume/AnalysisService';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';
import { v4 as uuidv4 } from 'uuid';
import { validateAudioFile, normalizeAudioMimeType } from '@/utilities/audioValidation';
import { isImentivConfigured } from '@/config/imentiv.config';
import { imentivIngestService } from '@/services/imentiv/ImentivIngestService';
import { imentivClient } from '@/services/imentiv/ImentivClient';
import { imentivAnalysisService } from '@/services/imentiv/ImentivAnalysisService';


function normalizeHumeStatus(status: unknown): 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' {
  const value = String(status || '').toUpperCase();

  if (['COMPLETED', 'COMPLETE', 'SUCCEEDED', 'SUCCESS'].includes(value)) {
    return 'COMPLETED';
  }

  if (['FAILED', 'FAILURE', 'ERROR', 'CANCELLED', 'CANCELED', 'EXPIRED', 'REJECTED'].includes(value)) {
    return 'FAILED';
  }

  if (['IN_PROGRESS', 'RUNNING', 'PROCESSING', 'EXECUTING', 'STARTED'].includes(value)) {
    return 'IN_PROGRESS';
  }

  return 'QUEUED';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

function isRetryablePredictionsError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('not ready') ||
    lower.includes('not found') ||
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('timeout') ||
    lower.includes('temporar') ||
    lower.includes('try again') ||
    lower.includes('in progress')
  );
}

function isTerminalPredictionsError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('invalid api key') ||
    lower.includes('invalid job')
  );
}

/**
 * POST /api/audio-analysis/hume
 * 
 * Initiates asynchronous audio analysis using Hume Expression Measurement API
 * 
 * Form data:
 * - audioFile: File to analyze
 * 
 * Returns:
 * {
 *   jobId: string (internal job ID),
 *   humeJobId: string (Hume job ID),
 *   status: "QUEUED",
 *   sourceUrl: string (S3 URL)
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }
    const { user, supabase } = authResult;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('audioFile') as File | null;

    // Validate audio file with detailed error handling
    const validationError = validateAudioFile(file);
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: 'audioFile is required' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const normalizedMimeType = normalizeAudioMimeType(file.type);
    const webhookToken = uuidv4();
    const webhookBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';


    // ───────────────────────────────────────────────
    // 1. Imentiv Provider Ingestion (Default if configured)
    // ───────────────────────────────────────────────
    if (isImentivConfigured()) {
      try {
        const imentivResult = await imentivIngestService.ingestAudio({
          userId: user.id,
          fileBuffer,
          fileName: file.name,
          title: file.name,
          contentType: normalizedMimeType,
          webhookToken,
        });

        const { createAdminClient } = await import('@/utils/supabase/admin');
        const adminClient = createAdminClient();
        await adminClient.from('audio_jobs').insert({
          id: imentivResult.jobId,
          job_id: imentivResult.jobId,
          hume_job_id: imentivResult.providerJobId,
          provider_job_id: imentivResult.providerJobId,
          provider: 'imentiv',
          status: imentivResult.status,
          source_url: imentivResult.sourceUrl,
          callback_url: `${webhookBaseUrl}/api/jobs/webhook?token=${webhookToken}&provider=imentiv`,
          user_id: user.id,
          created_by: user.id,
        });

        console.log(`[POST /api/audio-analysis/hume] Routed to Imentiv: Job ${imentivResult.jobId} (Imentiv ID: ${imentivResult.providerJobId})`);

        return NextResponse.json(
          {
            jobId: imentivResult.jobId,
            humeJobId: imentivResult.providerJobId,
            audioId: imentivResult.providerJobId,
            provider: 'imentiv',
            status: 'QUEUED',
            sourceUrl: imentivResult.sourceUrl,
            createdAt: imentivResult.createdAt,
            message: 'Audio analysis job queued successfully with Imentiv',
          },
          { status: 202 }
        );
      } catch (imentivErr) {
        console.error('[POST /api/audio-analysis/hume] Imentiv ingestion error:', imentivErr);
      }
    }

    // ───────────────────────────────────────────────
    // 2. Hume Fallback Ingestion
    // ───────────────────────────────────────────────
    const humeApiKey = process.env.HUME_API_KEY || process.env.HUME_AI_API_KEY;
    if (!humeApiKey) {
      return NextResponse.json(
        { error: 'Neither IMENTIV_API_KEY nor HUME_API_KEY is configured' },
        { status: 500 }
      );
    }

    // Initialize ingest service (uses Supabase Storage, not S3)
    const ingestService = new IngestService({
      humeApiKey,
      userId: user.id,
      webhookBaseUrl,
    });

    let result;
    try {
      result = await ingestService.ingestAudioFile(
        fileBuffer,
        file.name,
        normalizedMimeType,
        webhookToken
      );

      if (!result || !result.jobId || !result.humeJobId) {
        throw new Error('Ingest service returned invalid response');
      }

      console.log(`[POST /api/audio-analysis/hume] Job created: ${result.jobId} (Hume: ${result.humeJobId})`);
    } catch (ingestErr) {
      console.error('[POST /api/audio-analysis/hume] Ingestion error:', ingestErr instanceof Error ? ingestErr.message : String(ingestErr));
      return NextResponse.json(
        { 
          error: 'Failed to ingest audio file',
          message: ingestErr instanceof Error ? ingestErr.message : 'Unknown error'
        },
        { status: 500 }
      );
    }


    // Store job in database
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const adminClient = createAdminClient();
    const { error: dbError } = await adminClient
      .from('audio_jobs')
      .insert({
        id: result.jobId,
        job_id: result.jobId, // Ensure job_id is always set
        hume_job_id: result.humeJobId,
        status: result.status,
        source_url: result.sourceUrl,
        callback_url: `${webhookBaseUrl}/api/jobs/webhook?token=${webhookToken}`,
        user_id: user.id,
        created_by: user.id,
      });

    if (dbError) {
      console.error('Error storing job in database:', dbError);

      // Progressive fallback strategy:
      // 1) Try inserting minimal required fields only: id, hume_job_id, status, source_url
      // 2) If that fails, try an even smaller insert (id + hume_job_id + status) only if necessary
      // This avoids referencing optional columns (callback_url, user_id, created_by)
      // which some PostgREST schema caches may not have yet.
      try {
        const fallbackMinimal = await adminClient
          .from('audio_jobs')
          .insert({
            id: result.jobId,
            job_id: result.jobId,
            hume_job_id: result.humeJobId,
            status: result.status,
            source_url: result.sourceUrl,
          });

        if (!fallbackMinimal.error) {
          console.log('Fallback minimal DB insert successful (no callback_url, no user fields)');
        } else {
          console.warn('Fallback minimal insert failed:', fallbackMinimal.error);

          // If minimal insert failed, attempt the smallest allowed payload.
          // Note: hume_job_id is NOT NULL in schema, so we must include it.
          try {
            const fallbackSmall = await adminClient
              .from('audio_jobs')
              .insert({
                id: result.jobId,
                job_id: result.jobId,
                hume_job_id: result.humeJobId,
                status: result.status,
              });

            if (!fallbackSmall.error) {
              console.log('Fallback small DB insert successful (no source_url)');
            } else {
              console.error('Fallback small insert failed:', fallbackSmall.error);
            }
          } catch (smallErr) {
            console.error('Fallback small insert threw error:', smallErr);
          }
        }
      } catch (retryErr) {
        console.error('Fallback minimal insert threw error:', retryErr);
      }

      // Continue anyway - job is started with Hume. The webhook will attempt
      // to find the job by `hume_job_id` and update results when available.
    }

    // Return 202 Accepted (async processing)
    return NextResponse.json(
      {
        jobId: result.jobId,
        humeJobId: result.humeJobId,
        status: result.status,
        sourceUrl: result.sourceUrl,
        message: 'Audio analysis job queued. Results will be available when processing completes.',
      },
      { status: 202 }
    );

  } catch (error: unknown) {
    console.error('[POST /api/audio-analysis/hume] Audio analysis error:', error);
    console.error('[POST /api/audio-analysis/hume] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Log environment variable status for debugging
    console.error('[POST /api/audio-analysis/hume] Environment check:', {
      hasHumeApiKey: !!(process.env.HUME_API_KEY || process.env.HUME_AI_API_KEY),
      hasHumeSecret: !!(process.env.HUME_SECRET || process.env.HUME_AI_SECRET),
      hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
    
    return NextResponse.json(
      {
        error: 'Failed to initiate audio analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
        // Include error type for better debugging
        errorType: error instanceof Error ? error.constructor.name : typeof error,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/audio-analysis/hume?jobId=xxx
 * 
 * Check status of an audio analysis job.
 * If the job is still QUEUED and has been waiting >20 seconds, poll Hume directly
 * as a fallback to detect completion without relying solely on webhooks.
 */
// Improvements for GET /api/audio-analysis/hume

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');
    const humeJobIdFromQuery = searchParams.get('humeJobId');

    if (!jobId && !humeJobIdFromQuery) {
      return NextResponse.json({ error: 'jobId or humeJobId parameter is required' }, { status: 400 });
    }

    const pollHumeDirectly = async (humeJobId: string, fallbackJobId?: string, createdAt?: string) => {
      const humeApiKey = process.env.HUME_API_KEY || process.env.HUME_AI_API_KEY;
      if (!humeApiKey) {
        return NextResponse.json({ error: 'HUME_API_KEY is not configured' }, { status: 500 });
      }

      const { HumeClient } = await import('hume');
      const humeClient = new HumeClient({ apiKey: humeApiKey });

      const humeJob = await humeClient.expressionMeasurement.batch.getJobDetails(humeJobId);
      const rawStatus = (humeJob as any)?.state?.status || (humeJob as any)?.status;
      const rawReason =
        (humeJob as any)?.state?.message ||
        (humeJob as any)?.state?.reason ||
        (humeJob as any)?.message ||
        null;
      const normalizedStatus = normalizeHumeStatus(rawStatus);

      if (normalizedStatus === 'COMPLETED') {
        const predictions = await humeClient.expressionMeasurement.batch.getJobPredictions(humeJobId);
        if (!predictions) {
          return NextResponse.json({
            jobId: fallbackJobId || humeJobId,
            humeJobId,
            status: 'IN_PROGRESS',
            sourceUrl: '',
            createdAt: createdAt || new Date().toISOString(),
            completedAt: null,
            errorMessage: 'Hume completed processing but predictions are not ready yet. Retrying automatically.',
            hasResults: false,
          });
        }

        const analysisService = new AnalysisService();
        const analysis = await analysisService.processPredictions(predictions);

        return NextResponse.json({
          jobId: fallbackJobId || humeJobId,
          humeJobId,
          status: 'COMPLETED',
          rawStatus: rawStatus || null,
          rawReason,
          sourceUrl: '',
          createdAt: createdAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          errorMessage: null,
          hasResults: true,
          analysis,
        });
      }

      if (normalizedStatus === 'FAILED') {
        return NextResponse.json({
          jobId: fallbackJobId || humeJobId,
          humeJobId,
          status: 'FAILED',
          rawStatus: rawStatus || null,
          rawReason,
          sourceUrl: '',
          createdAt: createdAt || new Date().toISOString(),
          completedAt: new Date().toISOString(),
          errorMessage: `Hume job failed with status: ${String(rawStatus)}`,
          hasResults: false,
        });
      }

      return NextResponse.json({
        jobId: fallbackJobId || humeJobId,
        humeJobId,
        status: normalizedStatus,
        rawStatus: rawStatus || null,
        rawReason,
        sourceUrl: '',
        createdAt: createdAt || new Date().toISOString(),
        completedAt: null,
        errorMessage: null,
        hasResults: false,
      });
    };

    const { createAdminClient } = await import('@/utils/supabase/admin');
    const adminClient = createAdminClient();
    let job: any = null;
    let fetchError: any = null;

    if (jobId) {
      const result = await adminClient
        .from('audio_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .single();
      job = result.data;
      fetchError = result.error;
    }

    if (fetchError || !job) {
      if (humeJobIdFromQuery) {
        if (isImentivConfigured()) {
          try {
            const audioDetails = await imentivClient.getAudioDetails(humeJobIdFromQuery);
            const imentivStatus = (audioDetails.status || '').toLowerCase();
            if (imentivStatus === 'completed' || imentivStatus === 'done' || imentivStatus === 'complete') {
              const multimodal = await imentivClient.getMultimodalAnalytics(humeJobIdFromQuery).catch(() => null);
              const normalized = imentivAnalysisService.processImentivResults(audioDetails, multimodal);
              return NextResponse.json({
                jobId: jobId || humeJobIdFromQuery,
                humeJobId: humeJobIdFromQuery,
                status: 'COMPLETED',
                sourceUrl: '',
                createdAt: new Date().toISOString(),
                completedAt: new Date().toISOString(),
                hasResults: true,
                analysis: {
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
              });
            }
          } catch {
            // fallback to Hume
          }
        }
        return await pollHumeDirectly(humeJobIdFromQuery, jobId || undefined);
      }
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // If job was submitted to Imentiv, poll Imentiv
    const isImentivJob = job.provider === 'imentiv' || (!job.provider && isImentivConfigured());
    const imentivAudioId = job.provider_job_id || job.hume_job_id;

    if (isImentivJob && imentivAudioId && (job.status === 'QUEUED' || job.status === 'IN_PROGRESS')) {
      try {
        const audioDetails = await imentivClient.getAudioDetails(imentivAudioId);
        const imentivStatus = (audioDetails.status || '').toLowerCase();
        console.log(`[GET /api/audio-analysis/hume] Imentiv poll status: ${imentivStatus}`);

        if (imentivStatus === 'completed' || imentivStatus === 'done' || imentivStatus === 'complete') {
          const multimodal = await imentivClient.getMultimodalAnalytics(imentivAudioId).catch(() => null);
          const normalized = imentivAnalysisService.processImentivResults(audioDetails, multimodal);

          const legacyAnalysis = {
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
          };

          await adminClient.from('audio_jobs').update({
            status: 'COMPLETED',
            analysis_results: legacyAnalysis,
            completed_at: new Date().toISOString(),
          }).eq('id', jobId);

          return NextResponse.json({
            jobId: job.id,
            humeJobId: imentivAudioId,
            audioId: imentivAudioId,
            provider: 'imentiv',
            status: 'COMPLETED',
            sourceUrl: job.source_url,
            createdAt: job.created_at,
            completedAt: new Date().toISOString(),
            hasResults: true,
            analysis: legacyAnalysis,
          });
        } else if (imentivStatus === 'failed' || imentivStatus === 'error') {
          await adminClient.from('audio_jobs').update({
            status: 'FAILED',
            error_message: 'Imentiv audio analysis failed',
          }).eq('id', jobId);

          return NextResponse.json({
            jobId: job.id,
            humeJobId: imentivAudioId,
            status: 'FAILED',
            errorMessage: 'Imentiv audio analysis failed',
            hasResults: false,
          });
        }
      } catch (imentivPollErr) {
        console.warn('[GET /api/audio-analysis/hume] Imentiv poll error:', imentivPollErr);
      }
    }


    // Calculate elapsed time for status messages and polling logic
    const createdTime = job.created_at ? new Date(job.created_at).getTime() : Date.now();
    const nowTime = Date.now();
    const elapsedSeconds = (nowTime - createdTime) / 1000;

    // Enhanced fallback polling with better throttling
    if ((job.status === 'QUEUED' || job.status === 'IN_PROGRESS') && job.created_at) {

      // Only start fallback polling after 30 seconds (not 20)
      if (elapsedSeconds > 20 && job.hume_job_id) {
        const POLL_THROTTLE_SECONDS = 15;
        const lastPolledAt = job.last_polled_at ? new Date(job.last_polled_at).getTime() : 0;
        const sinceLastPolled = (nowTime - lastPolledAt) / 1000;

        if (lastPolledAt && sinceLastPolled < POLL_THROTTLE_SECONDS) {
          // Return current state without polling
          return NextResponse.json({
            jobId: job.id,
            humeJobId: job.hume_job_id,
            status: job.status,
            sourceUrl: job.source_url,
            createdAt: job.created_at,
            completedAt: job.completed_at,
            errorMessage: job.error_message,
            hasResults: !!job.analysis_results,
            ...(job.analysis_results && { analysis: job.analysis_results }),
            // Add polling hint for client
            pollingHint: {
              nextPollAfter: lastPolledAt + (POLL_THROTTLE_SECONDS * 1000),
              estimatedWaitSeconds: Math.max(0, POLL_THROTTLE_SECONDS - sinceLastPolled)
            }
          });
        }

        // Mark poll timestamp
        try {
          await adminClient
            .from('audio_jobs')
            .update({ last_polled_at: new Date().toISOString() })
            .eq('id', jobId);
        } catch (markErr) {
          console.warn(`[GET] Could not update last_polled_at:`, markErr);
        }

        try {
          const humeApiKey = process.env.HUME_API_KEY || process.env.HUME_AI_API_KEY;
          if (!humeApiKey) {
            console.warn('[GET] HUME_API_KEY not configured');
          } else {
            const { HumeClient } = await import('hume');
            const humeClient = new HumeClient({ apiKey: humeApiKey });

            console.log(`[GET] Fallback polling Hume job ${job.hume_job_id} (elapsed: ${elapsedSeconds.toFixed(1)}s)`);
            
            const humeJob = await humeClient.expressionMeasurement.batch.getJobDetails(
              job.hume_job_id
            );

            if (!humeJob || typeof humeJob !== 'object') {
              throw new Error('Invalid Hume API response');
            }

            const rawHumeStatus = (humeJob as any)?.state?.status || (humeJob as any)?.status;
            const rawHumeReason =
              (humeJob as any)?.state?.message ||
              (humeJob as any)?.state?.reason ||
              (humeJob as any)?.error?.message ||
              (humeJob as any)?.message ||
              null;

            if (!rawHumeStatus) {
              throw new Error('Could not determine job status');
            }

            const normalizedStatus = normalizeHumeStatus(rawHumeStatus);
            console.log(`[GET] Hume status: ${rawHumeStatus} -> ${normalizedStatus}`);

            if (normalizedStatus !== job.status && (normalizedStatus === 'QUEUED' || normalizedStatus === 'IN_PROGRESS')) {
              try {
                await adminClient
                  .from('audio_jobs')
                  .update({ status: normalizedStatus })
                  .eq('id', jobId);
                job.status = normalizedStatus;
              } catch (statusUpdateErr) {
                console.warn('[GET] Could not update intermediate job status:', statusUpdateErr);
              }
            }

            if (normalizedStatus === 'COMPLETED') {
              try {
                const predictions = await humeClient.expressionMeasurement.batch.getJobPredictions(
               
                  job.hume_job_id
                );
                if (!predictions) {
                  throw new Error('Empty predictions response');
                }

                // Parse with AnalysisService
                let analysisResults: any;
                try {
                  const analysisService = new AnalysisService();
                  analysisResults = await analysisService.processPredictions(predictions);
                } catch (parseErr) {
                  console.error('[GET] Parsing error:', parseErr);
                  analysisResults = {
                    transcript: 'Analysis complete',
                    unifiedTranscript: [],
                    emotions: {},
                    topics: [],
                    speakers: [],
                    summary: { topTopics: [], emotionDistribution: {} },
                    rawPredictions: predictions,
                  };
                }

                // Update database
                const { error: updateErr } = await adminClient
                  .from('audio_jobs')
                  .update({
                    status: 'COMPLETED',
                    completed_at: new Date().toISOString(),
                    results_payload: predictions,
                    analysis_results: analysisResults,
                  })
                  .eq('id', jobId);

                if (updateErr) {
                  console.error('[GET] DB update error:', updateErr);
                  // Try minimal update
                  await adminClient
                    .from('audio_jobs')
                    .update({
                      status: 'COMPLETED',
                      completed_at: new Date().toISOString(),
                      results_payload: predictions,
                    })
                    .eq('id', jobId);
                }

                return NextResponse.json({
                  jobId: job.id,
                  humeJobId: job.hume_job_id,
                  status: 'COMPLETED',
                  sourceUrl: job.source_url,
                  createdAt: job.created_at,
                  completedAt: new Date().toISOString(),
                  errorMessage: null,
                  hasResults: true,
                  analysis: analysisResults,
                });
              } catch (predErr) {
                const predictionErrorMessage = getErrorMessage(predErr);
                console.error('[GET] Predictions error:', predictionErrorMessage);

                if (isRetryablePredictionsError(predictionErrorMessage) || !isTerminalPredictionsError(predictionErrorMessage)) {
                  try {
                    await adminClient
                      .from('audio_jobs')
                      .update({
                        status: 'IN_PROGRESS',
                        error_message: `Hume reported COMPLETED but predictions are not yet retrievable: ${predictionErrorMessage}`,
                      })
                      .eq('id', jobId);
                    job.status = 'IN_PROGRESS';
                    job.error_message = `Predictions not ready yet: ${predictionErrorMessage}`;
                  } catch (updateRetryableErr) {
                    console.warn('[GET] Failed to persist retryable predictions error:', updateRetryableErr);
                  }

                  return NextResponse.json({
                    jobId: job.id,
                    humeJobId: job.hume_job_id,
                    status: 'IN_PROGRESS',
                    sourceUrl: job.source_url,
                    createdAt: job.created_at,
                    completedAt: null,
                    errorMessage: `Results are still being finalized by Hume. ${predictionErrorMessage}`,
                    statusMessage: 'Hume processing is complete, but result retrieval is still in progress. Retrying automatically.',
                    hasResults: false,
                  });
                }

                await adminClient
                  .from('audio_jobs')
                  .update({
                    status: 'FAILED',
                    completed_at: new Date().toISOString(),
                    error_message: `Failed to retrieve Hume predictions: ${predictionErrorMessage}`,
                  })
                  .eq('id', jobId);

                return NextResponse.json({
                  jobId: job.id,
                  humeJobId: job.hume_job_id,
                  status: 'FAILED',
                  sourceUrl: job.source_url,
                  createdAt: job.created_at,
                  completedAt: new Date().toISOString(),
                  errorMessage: `Failed to retrieve Hume predictions: ${predictionErrorMessage}`,
                  hasResults: false,
                });
              }
            } else if (normalizedStatus === 'FAILED') {
              const enrichedFailureMessage = rawHumeReason
                ? `Hume job failed: ${String(rawHumeReason)}`
                : `Hume job failed with status: ${String(rawHumeStatus)}`;

              await adminClient
                .from('audio_jobs')
                .update({
                  status: 'FAILED',
                  completed_at: new Date().toISOString(),
                  error_message: enrichedFailureMessage,
                })
                .eq('id', jobId);

              return NextResponse.json({
                jobId: job.id,
                humeJobId: job.hume_job_id,
                status: 'FAILED',
                rawStatus: rawHumeStatus || null,
                rawReason: rawHumeReason,
                sourceUrl: job.source_url,
                createdAt: job.created_at,
                completedAt: new Date().toISOString(),
                errorMessage: enrichedFailureMessage,
                hasResults: false,
              });
            }
          }
        } catch (fallbackErr) {
          console.warn('[GET] Fallback polling failed:', fallbackErr);
          // Don't fail the request - return current state
        }
      }
    }

    // Generate status message for long-running jobs
    let statusMessageText: string | undefined;
    if (elapsedSeconds > 60) {
      statusMessageText = `Job has been processing for ${Math.floor(elapsedSeconds / 60)} minute(s). Hume API may be experiencing delays.`;
    }
    if (job.status === 'QUEUED' && elapsedSeconds > 240) {
      statusMessageText = 'Still queued after several minutes. We are actively checking Hume status in the background.';
    }
    if (job.status === 'IN_PROGRESS' && elapsedSeconds > 480) {
      statusMessageText = 'Still in progress after several minutes. This usually means Hume is overloaded or the file is complex/long.';
    }

    // If job already failed and message is generic, enrich from live Hume details when possible.
    if (job.status === 'FAILED' && job.hume_job_id && (!job.error_message || String(job.error_message).includes('with status: FAILED'))) {
      try {
        const humeApiKey = process.env.HUME_API_KEY || process.env.HUME_AI_API_KEY;
        if (humeApiKey) {
          const { HumeClient } = await import('hume');
          const humeClient = new HumeClient({ apiKey: humeApiKey });
          const humeJob = await humeClient.expressionMeasurement.batch.getJobDetails(job.hume_job_id);
          const rawReason =
            (humeJob as any)?.state?.message ||
            (humeJob as any)?.state?.reason ||
            (humeJob as any)?.error?.message ||
            (humeJob as any)?.message ||
            null;
          const rawStatus = (humeJob as any)?.state?.status || (humeJob as any)?.status || 'FAILED';

          if (rawReason) {
            const enrichedFailureMessage = `Hume job failed: ${String(rawReason)}`;
            job.error_message = enrichedFailureMessage;
            await adminClient
              .from('audio_jobs')
              .update({ error_message: enrichedFailureMessage })
              .eq('id', job.id);
          }

          (job as any).raw_hume_status = rawStatus;
          (job as any).raw_hume_reason = rawReason;
        }
      } catch (enrichErr) {
        console.warn('[GET] Could not enrich failed job reason from Hume:', enrichErr);
      }
    }

    // Return current job state
    // Use the previously declared elapsedSeconds variable
    return NextResponse.json({
      jobId: job.id,
      humeJobId: job.hume_job_id,
      status: job.status,
      sourceUrl: job.source_url,
      createdAt: job.created_at,
      completedAt: job.completed_at,
      errorMessage: job.error_message,
      rawStatus: (job as any).raw_hume_status || null,
      rawReason: (job as any).raw_hume_reason || null,
      statusMessage: statusMessageText,
      elapsedSeconds: elapsedSeconds && elapsedSeconds > 0 ? elapsedSeconds : undefined,
      hasResults: !!job.analysis_results,
      ...(job.analysis_results && { analysis: job.analysis_results }),
    });

  } catch (error: unknown) {
    console.error('[GET] Error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch job status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


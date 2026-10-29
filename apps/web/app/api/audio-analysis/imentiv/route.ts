/**
 * Imentiv-based audio analysis endpoint
 * 
 * This endpoint implements the Imentiv Emotion Intelligence API pipeline:
 * 1. Accepts audio file or source URL
 * 2. Uploads audio to Supabase Storage if file buffer is supplied
 * 3. Initiates Imentiv batch job via POST /v2/audios with webhook callback
 * 4. Stores job in audio_jobs table
 * 5. Returns job ID immediately (202 Accepted)
 * 6. Results are processed asynchronously via webhook or direct GET polling fallback
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { validateAudioFile, normalizeAudioMimeType } from '@/utilities/audioValidation';
import { isImentivConfigured, getImentivConfig } from '@/config/imentiv.config';
import { imentivIngestService } from '@/services/imentiv/ImentivIngestService';
import { imentivClient } from '@/services/imentiv/ImentivClient';
import { imentivAnalysisService } from '@/services/imentiv/ImentivAnalysisService';
import { v4 as uuidv4 } from 'uuid';

function normalizeImentivStatus(status: unknown): 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' {
  const value = String(status || '').toUpperCase().trim();

  if (['COMPLETED', 'COMPLETE', 'SUCCEEDED', 'SUCCESS', 'PROCESSED'].includes(value)) {
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

/**
 * POST /api/audio-analysis/imentiv
 * 
 * Initiates asynchronous audio analysis using Imentiv API
 * 
 * Form data:
 * - audioFile: File to analyze (optional if mediaUrl provided)
 * - mediaUrl: URL to audio file (optional if audioFile provided)
 * - title: Title for audio recording (optional)
 * - description: Description (optional)
 * - speakerDiarization: boolean (default true)
 * - textEmotionAnalysis: boolean (default true)
 * - language: string (default 'en')
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    if (!isImentivConfigured()) {
      return NextResponse.json(
        { error: 'IMENTIV_API_KEY is not configured on the server' },
        { status: 500 }
      );
    }

    const config = getImentivConfig();
    const contentType = request.headers.get('content-type') || '';

    let fileBuffer: Buffer | undefined;
    let fileName: string | undefined;
    let mimeType: string | undefined;
    let mediaUrl: string | undefined;
    let title: string = 'Audio Recording';
    let description: string | undefined;
    let speakerDiarization = true;
    let textEmotionAnalysis = true;
    let language = config.defaultLanguage;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('audioFile') as File | null;
      mediaUrl = (formData.get('mediaUrl') as string) || undefined;
      title = (formData.get('title') as string) || file?.name || 'Audio Recording';
      description = (formData.get('description') as string) || undefined;
      language = (formData.get('language') as string) || config.defaultLanguage;

      if (formData.has('speakerDiarization')) {
        speakerDiarization = formData.get('speakerDiarization') === 'true';
      }
      if (formData.has('textEmotionAnalysis')) {
        textEmotionAnalysis = formData.get('textEmotionAnalysis') === 'true';
      }

      if (file) {
        const validationError = validateAudioFile(file);
        if (validationError) {
          return NextResponse.json({ error: validationError }, { status: 400 });
        }
        const arrayBuffer = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
        fileName = file.name;
        mimeType = normalizeAudioMimeType(file.type);
      }
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      mediaUrl = body.mediaUrl || body.sourceUrl;
      title = body.title || 'Audio Recording';
      description = body.description;
      speakerDiarization = body.speakerDiarization ?? true;
      textEmotionAnalysis = body.textEmotionAnalysis ?? true;
      language = body.language || config.defaultLanguage;
    }

    if (!fileBuffer && !mediaUrl) {
      return NextResponse.json(
        { error: 'Either audioFile or mediaUrl is required' },
        { status: 400 }
      );
    }

    const webhookToken = uuidv4();

    // Ingest audio via ImentivIngestService
    const result = await imentivIngestService.ingestAudio({
      userId: user.id,
      fileBuffer,
      fileName,
      contentType: mimeType,
      sourceUrl: mediaUrl,
      title,
      description,
      webhookToken,
      speakerDiarization,
      textEmotionAnalysis,
      language,
    });

    // Store in Supabase audio_jobs table
    const adminClient = createAdminClient();
    const callbackUrl = `${config.webhookBaseUrl}/api/jobs/webhook?token=${webhookToken}&provider=imentiv`;

    const { error: dbError } = await adminClient.from('audio_jobs').insert({
      id: result.jobId,
      job_id: result.jobId,
      hume_job_id: result.providerJobId, // Kept for backward compatibility
      provider_job_id: result.providerJobId,
      provider: 'imentiv',
      status: result.status,
      source_url: result.sourceUrl,
      callback_url: callbackUrl,
      user_id: user.id,
      created_by: user.id,
    });

    if (dbError) {
      console.warn('[POST /api/audio-analysis/imentiv] Primary DB insert warning, trying fallback:', dbError);
      try {
        await adminClient.from('audio_jobs').insert({
          id: result.jobId,
          job_id: result.jobId,
          hume_job_id: result.providerJobId,
          status: result.status,
          source_url: result.sourceUrl,
          user_id: user.id,
          created_by: user.id,
        });

      } catch (fallbackErr) {
        console.error('[POST /api/audio-analysis/imentiv] Fallback insert error:', fallbackErr);
      }
    }

    return NextResponse.json(
      {
        jobId: result.jobId,
        audioId: result.providerJobId,
        providerJobId: result.providerJobId,
        provider: 'imentiv',
        status: result.status,
        sourceUrl: result.sourceUrl,
        message: 'Imentiv audio analysis job queued successfully.',
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    console.error('[POST /api/audio-analysis/imentiv] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initiate Imentiv audio analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/audio-analysis/imentiv?jobId=xxx&audioId=xxx
 * 
 * Check status of an Imentiv audio analysis job with direct polling fallback.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get('jobId');
    const audioIdFromQuery = searchParams.get('audioId') || searchParams.get('imentivAudioId') || searchParams.get('providerJobId');

    if (!jobId && !audioIdFromQuery) {
      return NextResponse.json(
        { error: 'jobId or audioId parameter is required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    let job: any = null;

    if (jobId) {
      const result = await adminClient
        .from('audio_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .single();
      job = result.data;
    }

    if (!job && audioIdFromQuery) {
      const result = await adminClient
        .from('audio_jobs')
        .select('*')
        .or(`provider_job_id.eq.${audioIdFromQuery},hume_job_id.eq.${audioIdFromQuery}`)
        .eq('user_id', user.id)
        .single();
      job = result.data;
    }

    const targetAudioId = job?.provider_job_id || job?.hume_job_id || audioIdFromQuery;

    // If job already COMPLETED and results exist, return them immediately
    if (job?.status === 'COMPLETED' && job?.analysis_results) {
      return NextResponse.json({
        jobId: job.id,
        audioId: targetAudioId,
        provider: 'imentiv',
        status: 'COMPLETED',
        sourceUrl: job.source_url,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        errorMessage: null,
        hasResults: true,
        analysis: job.analysis_results,
      });
    }

    // Direct Imentiv polling fallback
    if (targetAudioId && isImentivConfigured()) {
      try {
        console.log(`[GET /api/audio-analysis/imentiv] Polling Imentiv API for audio ${targetAudioId}`);
        const audioDetails = await imentivClient.getAudioDetails(targetAudioId);
        const rawStatus = audioDetails.status;
        const normalizedStatus = normalizeImentivStatus(rawStatus);

        if (normalizedStatus === 'COMPLETED') {
          const multimodal = await imentivClient.getMultimodalAnalytics(targetAudioId).catch((err) => {
            console.warn('[GET /api/audio-analysis/imentiv] Multimodal analytics retrieval warning:', err);
            return null;
          });

          const normalizedAnalysis = imentivAnalysisService.processImentivResults(
            audioDetails,
            multimodal
          );

          if (job?.id) {
            await adminClient
              .from('audio_jobs')
              .update({
                status: 'COMPLETED',
                completed_at: new Date().toISOString(),
                results_payload: { audioDetails, multimodal },
                analysis_results: normalizedAnalysis,
              })
              .eq('id', job.id);
          }

          return NextResponse.json({
            jobId: job?.id || targetAudioId,
            audioId: targetAudioId,
            provider: 'imentiv',
            status: 'COMPLETED',
            rawStatus,
            sourceUrl: job?.source_url || audioDetails.url || '',
            createdAt: job?.created_at || audioDetails.created_at,
            completedAt: new Date().toISOString(),
            errorMessage: null,
            hasResults: true,
            analysis: normalizedAnalysis,
          });
        }

        if (normalizedStatus === 'FAILED') {
          const errorMsg = `Imentiv analysis failed with status: ${rawStatus}`;
          if (job?.id) {
            await adminClient
              .from('audio_jobs')
              .update({
                status: 'FAILED',
                completed_at: new Date().toISOString(),
                error_message: errorMsg,
              })
              .eq('id', job.id);
          }

          return NextResponse.json({
            jobId: job?.id || targetAudioId,
            audioId: targetAudioId,
            provider: 'imentiv',
            status: 'FAILED',
            rawStatus,
            sourceUrl: job?.source_url || '',
            createdAt: job?.created_at,
            completedAt: new Date().toISOString(),
            errorMessage: errorMsg,
            hasResults: false,
          });
        }

        return NextResponse.json({
          jobId: job?.id || targetAudioId,
          audioId: targetAudioId,
          provider: 'imentiv',
          status: normalizedStatus,
          rawStatus,
          sourceUrl: job?.source_url || '',
          createdAt: job?.created_at || audioDetails.created_at,
          completedAt: null,
          errorMessage: null,
          hasResults: false,
        });
      } catch (pollError) {
        console.warn('[GET /api/audio-analysis/imentiv] Polling error:', pollError);
      }
    }

    if (!job) {
      return NextResponse.json({ error: 'Audio job not found' }, { status: 404 });
    }

    return NextResponse.json({
      jobId: job.id,
      audioId: targetAudioId,
      provider: job.provider || 'imentiv',
      status: job.status,
      sourceUrl: job.source_url,
      createdAt: job.created_at,
      completedAt: job.completed_at,
      errorMessage: job.error_message,
      hasResults: Boolean(job.analysis_results),
      ...(job.analysis_results && { analysis: job.analysis_results }),
    });
  } catch (error: unknown) {
    console.error('[GET /api/audio-analysis/imentiv] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Imentiv job status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

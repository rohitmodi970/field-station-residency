import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getSignedUrl, BUCKETS } from '@/utils/supabase/storage';
import { v4 as uuidv4 } from 'uuid';
import { normalizeAudioMimeType } from '@/utilities/audioValidation';
import { isImentivConfigured, getImentivConfig } from '@/config/imentiv.config';
import { imentivIngestService } from '@/services/imentiv/ImentivIngestService';

/**
 * POST /api/audio-analysis/start-from-upload
 * 
 * Start audio emotion analysis from a file already uploaded to Supabase Storage.
 * Supports Imentiv (default) and Hume.
 * 
 * Request body:
 * {
 *   filePath: string,
 *   fileName: string,
 *   mimeType: string,
 *   provider?: 'imentiv' | 'hume'
 * }
 * 
 * Returns:
 * {
 *   jobId: string,
 *   audioId?: string,
 *   humeJobId?: string,
 *   provider: 'imentiv' | 'hume',
 *   status: "QUEUED"
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

    const body = await request.json();
    const { filePath, fileName, mimeType, provider: requestedProvider } = body;

    if (!filePath || !fileName || !mimeType) {
      return NextResponse.json(
        { error: 'filePath, fileName, and mimeType are required' },
        { status: 400 }
      );
    }

    // Verify file belongs to user
    if (!filePath.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { error: 'Unauthorized access to file' },
        { status: 403 }
      );
    }

    const activeProvider = requestedProvider || (isImentivConfigured() ? 'imentiv' : 'hume');
    console.log(`[Start Analysis] Processing ${fileName} from ${filePath} (Provider: ${activeProvider})`);

    // Get signed URL for the uploaded file (valid for 24 hours)
    const signedUrl = await getSignedUrl(BUCKETS.USERS_CLOUD, filePath, 86400);
    const webhookToken = uuidv4();
    const adminClient = createAdminClient();

    // ───────────────────────────────────────────────
    // 1. Imentiv Ingestion
    // ───────────────────────────────────────────────
    if (activeProvider === 'imentiv') {
      if (!isImentivConfigured()) {
        return NextResponse.json(
          { error: 'IMENTIV_API_KEY is not configured' },
          { status: 500 }
        );
      }

      const imentivConfig = getImentivConfig();
      const callbackUrl = `${imentivConfig.webhookBaseUrl}/api/jobs/webhook?token=${webhookToken}&provider=imentiv`;

      const result = await imentivIngestService.ingestAudio({
        userId: user.id,
        sourceUrl: signedUrl,
        fileName,
        title: fileName,
        webhookToken,
        speakerDiarization: true,
        textEmotionAnalysis: true,
      });

      const { error: dbError } = await adminClient.from('audio_jobs').insert({
        id: result.jobId,
        job_id: result.jobId,
        hume_job_id: result.providerJobId, // Kept for compatibility
        provider_job_id: result.providerJobId,
        provider: 'imentiv',
        status: result.status,
        source_url: result.sourceUrl,
        callback_url: callbackUrl,
        user_id: user.id,
        created_by: user.id,
      });

      if (dbError) {
        console.warn('[Start Analysis] Primary DB insert warning, attempting fallback:', dbError);
        try {
          await adminClient.from('audio_jobs').insert({
            id: result.jobId,
            job_id: result.jobId,
            hume_job_id: result.providerJobId,
            status: result.status,
            source_url: result.sourceUrl,
          });
        } catch (fallbackErr) {
          console.error('[Start Analysis] Fallback insert error:', fallbackErr);
        }
      }

      return NextResponse.json(
        {
          jobId: result.jobId,
          audioId: result.providerJobId,
          providerJobId: result.providerJobId,
          provider: 'imentiv',
          status: 'QUEUED',
          message: 'Audio analysis job queued successfully with Imentiv',
        },
        { status: 202 }
      );
    }

    // ───────────────────────────────────────────────
    // 2. Hume Ingestion Fallback
    // ───────────────────────────────────────────────
    const humeApiKey = process.env.HUME_API_KEY || process.env.HUME_AI_API_KEY;
    const webhookBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';

    if (!humeApiKey) {
      return NextResponse.json(
        { error: 'HUME_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const { IngestService } = await import('@/services/hume/IngestService');
    const ingestService = new IngestService({
      humeApiKey,
      userId: user.id,
      webhookBaseUrl,
    });

    const normalizedMimeType = normalizeAudioMimeType(mimeType);
    const result = await ingestService.ingestAudioFromUrl(
      signedUrl,
      filePath,
      fileName,
      normalizedMimeType,
      webhookToken
    );

    if (!result || !result.jobId || !result.humeJobId) {
      throw new Error('Hume Ingest service returned invalid response');
    }

    const callbackUrl = `${webhookBaseUrl}/api/jobs/webhook?token=${webhookToken}`;
    await adminClient.from('audio_jobs').insert({
      id: result.jobId,
      job_id: result.jobId,
      hume_job_id: result.humeJobId,
      provider_job_id: result.humeJobId,
      provider: 'hume',
      status: result.status,
      source_url: result.sourceUrl,
      callback_url: callbackUrl,
      user_id: user.id,
      created_by: user.id,
    });

    return NextResponse.json(
      {
        jobId: result.jobId,
        humeJobId: result.humeJobId,
        providerJobId: result.humeJobId,
        provider: 'hume',
        status: 'QUEUED',
        message: 'Audio analysis job queued successfully with Hume',
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    console.error('[Start Analysis] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to start audio analysis',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


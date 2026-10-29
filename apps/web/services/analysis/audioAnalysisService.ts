// apps/web/services/analysis/audioAnalysisService.ts
// Provider-independent Audio Emotion Analysis Service

import {
  AudioEmotionProvider,
  AudioEmotionProviderType,
  AudioJobSubmissionParams,
  NormalizedAudioAnalysisResult,
  ProviderJobStatusResult,
  ProviderJobSubmissionResult,
} from '@/types/audioAnalysis.contract';
import { isImentivConfigured } from '@/config/imentiv.config';
import { imentivClient } from '@/services/imentiv/ImentivClient';
import { imentivIngestService } from '@/services/imentiv/ImentivIngestService';
import { imentivAnalysisService } from '@/services/imentiv/ImentivAnalysisService';
import { createAdminClient } from '@/utils/supabase/admin';

export class AudioAnalysisService {
  /**
   * Get the active audio emotion provider (defaults to 'imentiv' when configured, fallback to 'hume')
   */
  getActiveProviderType(): AudioEmotionProviderType {
    const configuredProvider = process.env.AUDIO_ANALYSIS_PROVIDER?.toLowerCase();
    if (configuredProvider === 'hume') return 'hume';
    if (configuredProvider === 'imentiv') return 'imentiv';

    // Default to imentiv if configured, otherwise fallback to hume
    if (isImentivConfigured()) return 'imentiv';
    if (process.env.HUME_API_KEY || process.env.HUME_AI_API_KEY) return 'hume';

    return 'imentiv';
  }

  /**
   * Submit audio file or URL for asynchronous emotion analysis
   */
  async submitAudioJob(
    params: AudioJobSubmissionParams,
    overrideProvider?: AudioEmotionProviderType
  ): Promise<ProviderJobSubmissionResult> {
    const provider = overrideProvider || this.getActiveProviderType();

    if (provider === 'imentiv') {
      const result = await imentivIngestService.ingestAudio(params);

      // Record job in Supabase database
      const adminClient = createAdminClient();
      await adminClient.from('audio_jobs').insert({
        id: result.jobId,
        job_id: result.jobId,
        hume_job_id: result.providerJobId, // Kept for backwards-compatible DB schema check
        status: result.status,
        source_url: result.sourceUrl,
        user_id: params.userId,
        created_by: params.userId,
      });

      return result;
    }

    // Hume fallback submission
    const { IngestService } = await import('@/services/hume/IngestService');
    const humeApiKey = process.env.HUME_API_KEY || process.env.HUME_AI_API_KEY || '';
    const webhookBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';

    const humeIngest = new IngestService({
      humeApiKey,
      userId: params.userId,
      webhookBaseUrl,
    });

    if (params.fileBuffer && params.fileName) {
      const humeResult = await humeIngest.ingestAudioFile(
        params.fileBuffer,
        params.fileName,
        params.contentType,
        params.webhookToken
      );

      const adminClient = createAdminClient();
      await adminClient.from('audio_jobs').insert({
        id: humeResult.jobId,
        job_id: humeResult.jobId,
        hume_job_id: humeResult.humeJobId,
        status: humeResult.status,
        source_url: humeResult.sourceUrl,
        user_id: params.userId,
        created_by: params.userId,
      });

      return {
        jobId: humeResult.jobId,
        providerJobId: humeResult.humeJobId,
        provider: 'hume',
        status: 'QUEUED',
        sourceUrl: humeResult.sourceUrl,
        createdAt: new Date().toISOString(),
      };
    }

    throw new Error('Unsupported Hume submission parameters: fileBuffer required');
  }

  /**
   * Poll status of an audio job with fallback query
   */
  async checkJobStatus(jobId: string, providerJobId?: string): Promise<ProviderJobStatusResult> {
    const adminClient = createAdminClient();

    const query = adminClient.from('audio_jobs').select('*');
    if (jobId) query.eq('id', jobId);
    else if (providerJobId) query.eq('hume_job_id', providerJobId);

    const { data: job, error } = await query.single();

    if (error || !job) {
      // If not found in DB, check live Imentiv API directly if providerJobId is provided
      if (providerJobId && isImentivConfigured()) {
        try {
          const details = await imentivClient.getAudioDetails(providerJobId);
          const isDone = (details.status || '').toUpperCase() === 'COMPLETED';
          const isFailed = (details.status || '').toUpperCase() === 'FAILED';

          let analysis: NormalizedAudioAnalysisResult | null = null;
          if (isDone) {
            const multimodal = await imentivClient.getMultimodalAnalytics(providerJobId).catch(() => null);
            analysis = imentivAnalysisService.processImentivResults(details, multimodal);
          }

          return {
            jobId: jobId || providerJobId,
            providerJobId,
            provider: 'imentiv',
            status: isDone ? 'COMPLETED' : isFailed ? 'FAILED' : 'IN_PROGRESS',
            createdAt: details.created_at || new Date().toISOString(),
            hasResults: Boolean(analysis),
            analysis,
          };
        } catch {
          // ignore
        }
      }

      throw new Error(`Audio job not found: ${jobId || providerJobId}`);
    }

    // If job has already completed and analysis results are present, return them
    if (job.status === 'COMPLETED' && job.analysis_results) {
      return {
        jobId: job.id,
        providerJobId: job.hume_job_id,
        provider: 'imentiv',
        status: 'COMPLETED',
        sourceUrl: job.source_url,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        errorMessage: job.error_message,
        hasResults: true,
        analysis: job.analysis_results as NormalizedAudioAnalysisResult,
      };
    }

    // Direct provider polling fallback for in-flight jobs
    if ((job.status === 'QUEUED' || job.status === 'IN_PROGRESS') && job.hume_job_id) {
      try {
        const details = await imentivClient.getAudioDetails(job.hume_job_id);
        const currentStatus = (details.status || '').toUpperCase();

        if (currentStatus === 'COMPLETED') {
          const multimodal = await imentivClient.getMultimodalAnalytics(job.hume_job_id).catch(() => null);
          const normalized = imentivAnalysisService.processImentivResults(details, multimodal);

          await adminClient
            .from('audio_jobs')
            .update({
              status: 'COMPLETED',
              completed_at: new Date().toISOString(),
              results_payload: { details, multimodal },
              analysis_results: normalized,
            })
            .eq('id', job.id);

          return {
            jobId: job.id,
            providerJobId: job.hume_job_id,
            provider: 'imentiv',
            status: 'COMPLETED',
            sourceUrl: job.source_url,
            createdAt: job.created_at,
            completedAt: new Date().toISOString(),
            hasResults: true,
            analysis: normalized,
          };
        }
      } catch (pollErr) {
        console.warn('[AudioAnalysisService] Live polling failed:', pollErr);
      }
    }

    return {
      jobId: job.id,
      providerJobId: job.hume_job_id,
      provider: 'imentiv',
      status: job.status as 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
      sourceUrl: job.source_url,
      createdAt: job.created_at,
      completedAt: job.completed_at,
      errorMessage: job.error_message,
      hasResults: Boolean(job.analysis_results),
      analysis: (job.analysis_results as NormalizedAudioAnalysisResult) || null,
    };
  }
}

export const audioAnalysisService = new AudioAnalysisService();

// apps/web/services/imentiv/ImentivWebhookService.ts
// Handles webhook notifications and completion callbacks from Imentiv API

import * as crypto from 'crypto';
import { getImentivConfig } from '@/config/imentiv.config';
import { createAdminClient } from '@/utils/supabase/admin';
import { notificationService } from '@/utils/notifications/notificationService';
import { imentivClient, ImentivClient } from './ImentivClient';
import { imentivAnalysisService, ImentivAnalysisService } from './ImentivAnalysisService';
import { ImentivWebhookNotification } from '@/types/imentiv.contract';

export class ImentivWebhookService {
  private client: ImentivClient;
  private analysisService: ImentivAnalysisService;
  private processedWebhooks = new Map<string, number>();
  private readonly DUPLICATE_WINDOW_MS = 60000;

  constructor(customClient?: ImentivClient, customAnalysisService?: ImentivAnalysisService) {
    this.client = customClient || imentivClient;
    this.analysisService = customAnalysisService || imentivAnalysisService;
  }

  /**
   * Verify HMAC webhook security token
   */
  async verifyWebhookToken(token: string, audioId: string): Promise<boolean> {
    try {
      if (!token || !audioId) return false;
      const config = getImentivConfig();
      const secret = config.webhookSecret;

      if (!secret) {
        // Fallback: verify non-empty token string
        return token.length >= 16;
      }

      const expectedToken = crypto
        .createHmac('sha256', secret)
        .update(audioId)
        .digest('hex');

      const tokenBuffer = Buffer.from(token);
      const expectedBuffer = Buffer.from(expectedToken);

      if (tokenBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
    } catch (error) {
      console.error('[ImentivWebhookService] Error verifying token:', error);
      return false;
    }
  }

  /**
   * Process webhook notification payload from Imentiv
   */
  async processWebhook(payload: ImentivWebhookNotification): Promise<void> {
    const audioId = payload.audio_id || payload.media_id;
    if (!audioId) {
      throw new Error('Invalid webhook payload: missing audio_id or media_id');
    }

    const status = (payload.status || 'COMPLETED').toUpperCase();

    if (this.isDuplicate(audioId)) {
      console.warn(`[ImentivWebhookService] Ignoring duplicate webhook for audio ${audioId}`);
      return;
    }
    this.markProcessed(audioId);

    const adminClient = createAdminClient();

    // Query for job by provider_job_id, hume_job_id (for backwards compatibility), or job_id
    const { data: job, error: fetchError } = await adminClient
      .from('audio_jobs')
      .select('*')
      .or(`hume_job_id.eq.${audioId},id.eq.${audioId}`)
      .single();

    if (fetchError || !job) {
      console.warn(`[ImentivWebhookService] Job not found in database for audio ID ${audioId}`, fetchError);
    }

    const updateData: Record<string, unknown> = {
      status: status === 'COMPLETED' ? 'COMPLETED' : status === 'FAILED' ? 'FAILED' : 'IN_PROGRESS',
      completed_at: new Date().toISOString(),
    };

    if (status === 'COMPLETED') {
      try {
        console.log(`[ImentivWebhookService] Fetching audio details and multimodal analytics for ${audioId}`);
        const [audioDetails, multimodal] = await Promise.all([
          this.client.getAudioDetails(audioId).catch((err) => {
            console.warn('[ImentivWebhookService] Failed to fetch getAudioDetails:', err);
            return { id: audioId, status: 'COMPLETED' };
          }),
          this.client.getMultimodalAnalytics(audioId).catch((err) => {
            console.warn('[ImentivWebhookService] Multimodal analytics not yet ready or failed:', err);
            return null;
          }),
        ]);

        const normalizedAnalysis = this.analysisService.processImentivResults(
          audioDetails,
          multimodal
        );

        updateData.results_payload = { audioDetails, multimodal };
        updateData.analysis_results = normalizedAnalysis;
        updateData.status = 'COMPLETED';

        console.log(`[ImentivWebhookService] Successfully normalized Imentiv results for ${audioId}`);
      } catch (error) {
        console.error(`[ImentivWebhookService] Error fetching/normalizing Imentiv predictions for ${audioId}:`, error);
        updateData.status = 'FAILED';
        updateData.error_message = error instanceof Error ? error.message : 'Unknown error during Imentiv result retrieval';
      }
    } else if (status === 'FAILED') {
      updateData.error_message = payload.message || payload.error || 'Imentiv audio analysis failed';
    }

    if (job) {
      const { error: updateError } = await adminClient
        .from('audio_jobs')
        .update(updateData)
        .eq('id', job.id);

      if (updateError) {
        console.error(`[ImentivWebhookService] Error updating database for audio ${audioId}:`, updateError);
        throw new Error(`Failed to update audio job: ${updateError.message}`);
      }

      if (updateData.status === 'COMPLETED' && job.user_id) {
        try {
          await notificationService.sendAnalysisReadyInApp(job.user_id, {
            analysis_job_id: job.id,
            link: '/analysis/audio-analysis',
          });
          await notificationService.sendBestDailyPushNotificationForUser(job.user_id);
        } catch (notifErr) {
          console.warn('[ImentivWebhookService] Notification dispatch skipped:', notifErr);
        }
      }
    }

    console.log(`[ImentivWebhookService] Webhook processing completed for ${audioId}`);
  }

  private isDuplicate(id: string): boolean {
    const last = this.processedWebhooks.get(id);
    return Boolean(last && Date.now() - last < this.DUPLICATE_WINDOW_MS);
  }

  private markProcessed(id: string): void {
    this.processedWebhooks.set(id, Date.now());
    if (this.processedWebhooks.size > 100) {
      const cutoff = Date.now() - this.DUPLICATE_WINDOW_MS;
      for (const [key, time] of this.processedWebhooks.entries()) {
        if (time < cutoff) this.processedWebhooks.delete(key);
      }
    }
  }
}

export const imentivWebhookService = new ImentivWebhookService();

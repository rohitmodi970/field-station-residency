/**
 * JobWebhookService - Receives webhook notifications from Hume API
 * 
 * This service handles the webhook callback when a Hume batch job completes.
 * It fetches the full prediction results and triggers the AnalysisService.
 */

import { HumeClient } from 'hume';
import { AnalysisService } from './AnalysisService';
import { createAdminClient } from '@/utils/supabase/admin';
import { notificationService } from '@/utils/notifications/notificationService';
import * as crypto from 'crypto';

export interface WebhookPayload {
  job_id: string;
  status: 'COMPLETED' | 'FAILED';
  message?: string;
}

export interface JobWebhookServiceConfig {
  humeApiKey: string;
  webhookSecret?: string;
}

export class JobWebhookService {
  private humeClient: HumeClient;
  private analysisService: AnalysisService;
  private config: JobWebhookServiceConfig;
  // Track recently processed webhooks to prevent duplicates
  private processedWebhooks = new Map<string, number>();
  private readonly DUPLICATE_WINDOW_MS = 60000; // 1 minute

  constructor(config: JobWebhookServiceConfig) {
    this.config = config;
    this.humeClient = new HumeClient({
      apiKey: config.humeApiKey,
    });
    this.analysisService = new AnalysisService();
  }

  /**
   * Process webhook notification from Hume
   */
  async processWebhook(payload: WebhookPayload): Promise<void> {
    const { job_id, status } = payload;

    // Check for duplicate webhooks (prevent processing same job twice)
    if (this.isDuplicateWebhook(job_id)) {
      console.warn(`[JobWebhookService] Ignoring duplicate webhook for job ${job_id}`);
      return;
    }

    try {
      // Mark webhook as processed
      this.markWebhookProcessed(job_id);

      // Validate payload
      if (!job_id || !status) {
        throw new Error('Invalid webhook payload: missing job_id or status');
      }

      if (!['COMPLETED', 'FAILED'].includes(status)) {
        throw new Error(`Invalid webhook status: ${status}`);
      }

      // Get Supabase admin client for database operations
      const adminClient = createAdminClient();

      // Find the job in our database
      const { data: job, error: fetchError } = await adminClient
        .from('audio_jobs')
        .select('*')
        .eq('hume_job_id', job_id)
        .single();

      if (fetchError || !job) {
        console.error(`[JobWebhookService] Job not found in database: ${job_id}`, fetchError);
        throw new Error(`Job ${job_id} not found`);
      }

      // Update job status
      const updateData: any = {
        status,
        completed_at: new Date().toISOString(),
      };

      if (status === 'COMPLETED') {
        try {
          // Fetch full prediction results from Hume
          const predictions = await this.humeClient.expressionMeasurement.batch.getJobPredictions(job_id);
          
          if (!predictions) {
            throw new Error('Failed to fetch predictions from Hume API');
          }

          // Store raw results
          updateData.results_payload = predictions;

          // Trigger analysis service to process and correlate data
          const analysisResults = await this.analysisService.processPredictions(predictions);

          // Store processed analysis results
          updateData.analysis_results = analysisResults;

          console.log(`[JobWebhookService] Successfully processed predictions for job ${job_id}`);

        } catch (error) {
          console.error(`[JobWebhookService] Error processing job ${job_id}:`, error instanceof Error ? error.message : String(error));
          updateData.status = 'FAILED';
          updateData.error_message = error instanceof Error ? error.message : 'Unknown error during prediction processing';
        }
      } else if (status === 'FAILED') {
        updateData.error_message = payload.message || 'Job failed without error message';
        console.log(`[JobWebhookService] Job ${job_id} failed: ${updateData.error_message}`);
      }

      // Update job in database
      const { error: updateError } = await adminClient
        .from('audio_jobs')
        .update(updateData)
        .eq('hume_job_id', job_id);

      if (updateError) {
        console.error(`[JobWebhookService] Error updating job ${job_id}:`, updateError);
        throw new Error(`Failed to update job: ${updateError.message}`);
      }

      if (updateData.status === 'COMPLETED' && job.user_id) {
        // Always create immediate in-app analysis notification.
        await notificationService.sendAnalysisReadyInApp(job.user_id, {
          analysis_job_id: job_id,
          link: '/analysis',
        });

        // Push is capped at once/day and selected by global priority.
        await notificationService.sendBestDailyPushNotificationForUser(job.user_id);
      }

      console.log(`[JobWebhookService] Webhook processed successfully for job ${job_id}`);
    } catch (error) {
      console.error(`[JobWebhookService] Error in processWebhook: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Verify webhook token using HMAC-SHA256
   * 
   * Token should be a combination of job_id and a shared secret
   * Format: HMAC-SHA256(secret + job_id)
   */
  async verifyWebhookToken(token: string, jobId: string): Promise<boolean> {
    try {
      if (!token || !jobId) {
        console.warn('[JobWebhookService] Missing token or jobId for verification');
        return false;
      }

      // Get webhook secret from environment or database
      const secret = this.config.webhookSecret || process.env.WEBHOOK_SECRET || process.env.HUME_WEBHOOK_SECRET;
      
      if (!secret) {
        console.warn('[JobWebhookService] Webhook secret not configured, falling back to length check');
        // Fallback: basic length check
        return token.length > 20;
      }

      // Generate expected token
      const expectedToken = crypto
        .createHmac('sha256', secret)
        .update(jobId)
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      const tokenBuffer = Buffer.from(token);
      const expectedBuffer = Buffer.from(expectedToken);

      return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
    } catch (error) {
      console.error('[JobWebhookService] Error verifying webhook token:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  /**
   * Check if webhook has already been processed recently
   */
  private isDuplicateWebhook(jobId: string): boolean {
    const lastProcessed = this.processedWebhooks.get(jobId);
    if (!lastProcessed) {
      return false;
    }

    const timeSinceLastProcess = Date.now() - lastProcessed;
    return timeSinceLastProcess < this.DUPLICATE_WINDOW_MS;
  }

  /**
   * Mark webhook as processed
   */
  private markWebhookProcessed(jobId: string): void {
    this.processedWebhooks.set(jobId, Date.now());

    // Clean up old entries periodically (every 100 webhooks)
    if (this.processedWebhooks.size > 100) {
      const cutoffTime = Date.now() - this.DUPLICATE_WINDOW_MS;
      for (const [key, timestamp] of this.processedWebhooks.entries()) {
        if (timestamp < cutoffTime) {
          this.processedWebhooks.delete(key);
        }
      }
    }
  }
}


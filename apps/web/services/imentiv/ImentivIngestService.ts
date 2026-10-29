// apps/web/services/imentiv/ImentivIngestService.ts
// Handles audio ingestion, storage upload, and Imentiv analysis job submission

import { v4 as uuidv4 } from 'uuid';
import { getImentivConfig } from '@/config/imentiv.config';
import { uploadToSupabaseStorage, getSignedUrl, BUCKETS } from '@/utils/supabase/storage';
import { imentivClient, ImentivClient } from './ImentivClient';
import {
  AudioJobSubmissionParams,
  ProviderJobSubmissionResult,
} from '@/types/audioAnalysis.contract';

export class ImentivIngestService {
  private client: ImentivClient;

  constructor(customClient?: ImentivClient) {
    this.client = customClient || imentivClient;
  }

  /**
   * Upload audio buffer to Supabase Storage and retrieve signed URL
   */
  async uploadToStorage(
    userId: string,
    fileBuffer: Buffer,
    fileName: string
  ): Promise<string> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('File buffer is empty');
    }
    if (!fileName || fileName.trim().length === 0) {
      throw new Error('File name is required');
    }

    const uniqueFileName = `${uuidv4()}-${fileName}`;
    const uploadResult = await uploadToSupabaseStorage(
      userId,
      fileBuffer,
      uniqueFileName,
      'audio',
      {
        bucket: BUCKETS.USERS_CLOUD,
        makePublic: false,
      }
    );

    if (!uploadResult || !uploadResult.path) {
      throw new Error('Supabase audio storage upload failed: no path returned');
    }

    // 24-hour signed URL
    const signedUrl = await getSignedUrl(uploadResult.bucket, uploadResult.path, 86400);
    if (!signedUrl) {
      throw new Error('Failed to generate signed URL for uploaded audio file');
    }

    return signedUrl;
  }

  /**
   * Ingest audio file or URL and submit to Imentiv API
   */
  async ingestAudio(params: AudioJobSubmissionParams): Promise<ProviderJobSubmissionResult> {
    const config = getImentivConfig();
    const internalJobId = uuidv4();
    const webhookToken = params.webhookToken || uuidv4();
    const callbackUrl = `${config.webhookBaseUrl}/api/jobs/webhook?token=${webhookToken}&provider=imentiv`;

    let sourceUrl = params.sourceUrl;

    // If file buffer provided without a sourceUrl, upload to Supabase storage first
    if (params.fileBuffer && !sourceUrl && params.fileName) {
      console.log(`[ImentivIngestService] Uploading audio to storage for user ${params.userId}: ${params.fileName}`);
      sourceUrl = await this.uploadToStorage(params.userId, params.fileBuffer, params.fileName);
    }

    console.log(`[ImentivIngestService] Submitting audio to Imentiv (Title: ${params.title || params.fileName})`);

    const response = await this.client.uploadAudio({
      title: params.title || params.fileName || 'Audio Recording',
      description: params.description,
      audio_file: params.fileBuffer ? params.fileBuffer : undefined,
      media_url: sourceUrl,
      callback_url: callbackUrl,
      speaker_diarization: params.speakerDiarization ?? true,
      text_emotion_analysis: params.textEmotionAnalysis ?? true,
      language: params.language || config.defaultLanguage,
      start_millis: params.startMillis,
      end_millis: params.endMillis,
    });

    if (!response || !response.id) {
      throw new Error('Imentiv audio upload returned invalid response');
    }

    console.log(`[ImentivIngestService] Imentiv job submitted successfully. Imentiv Audio ID: ${response.id}`);

    return {
      jobId: internalJobId,
      providerJobId: response.id,
      provider: 'imentiv',
      status: 'QUEUED',
      sourceUrl: sourceUrl || response.media_source_url || '',
      createdAt: response.created_at || new Date().toISOString(),
    };
  }
}

export const imentivIngestService = new ImentivIngestService();

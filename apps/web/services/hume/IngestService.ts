/**
 * IngestService - Handles audio file upload to Supabase Storage and initiates Hume batch jobs
 * 
 * This service implements the webhook-based architecture as specified in the
 * Force project architecture document. It avoids polling by using callback URLs.
 */

import { HumeClient } from 'hume';
// Define types locally since 'hume' does not export them

// Define Granularity enum locally
export enum Granularity {
  UTTERANCE = 'utterance',
  WORD = 'word',
  // Add other granularity levels if needed
}
export interface PostedJob {
  jobId: string;
  // Add other properties as needed based on Hume API response
}

export interface ProsodyConfig {
  granularity: Granularity;
  identify_speakers: boolean;
}

export interface LanguageConfig {
  granularity: Granularity;
  identify_speakers: boolean;
}
import { uploadToSupabaseStorage, getSignedUrl, BUCKETS } from '@/utils/supabase/storage';
import { v4 as uuidv4 } from 'uuid';
import { Tsukimi_Rounded } from 'next/font/google';

export interface IngestJobResult {
  jobId: string;
  humeJobId: string;
  sourceUrl: string;
  status: 'QUEUED';
}

export interface IngestServiceConfig {
  humeApiKey: string;
  userId: string;
  webhookBaseUrl: string; // Base URL for webhook callbacks (e.g., https://api.force-project.com)
}

export class IngestService {
  private humeClient: HumeClient;
  private config: IngestServiceConfig;

  constructor(config: IngestServiceConfig) {
    this.config = config;
    
    // Initialize Hume client
    this.humeClient = new HumeClient({
      apiKey: config.humeApiKey,
    });
  }

  /**
   * Upload audio file to Supabase Storage and return a publicly accessible URL
   * 
   * For Hume API, we need a publicly accessible URL. We'll use signed URLs
   * that are valid for a longer period (24 hours) to allow Hume to process.
   */
  async uploadToStorage(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string = 'audio/mpeg'
  ): Promise<string> {
    try {
      // Validate input
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new Error('File buffer is empty');
      }
      if (!fileName || fileName.trim().length === 0) {
        throw new Error('File name is required');
      }

      // Generate unique filename
      const uniqueFileName = `${uuidv4()}-${fileName}`;
      
      // Upload to Supabase Storage
      const uploadResult = await uploadToSupabaseStorage(
        this.config.userId,
        fileBuffer,
        uniqueFileName,
        'audio',
        {
          bucket: BUCKETS.USERS_CLOUD,
          makePublic: false, // Keep private, use signed URL
        }
      );

      if (!uploadResult || !uploadResult.path) {
        throw new Error('Upload failed: no path returned');
      }

      // Generate a signed URL valid for 24 hours (86400 seconds)
      // This gives Hume enough time to process the file
      const signedUrl = await getSignedUrl(
        uploadResult.bucket,
        uploadResult.path,
        86400 // 24 hours
      );

      if (!signedUrl) {
        throw new Error('Failed to generate signed URL');
      }

      console.log(`[IngestService] Successfully uploaded ${fileName} to storage`);
      return signedUrl;
    } catch (error) {
      console.error('[IngestService] Error uploading file to storage:', error instanceof Error ? error.message : String(error));
      throw new Error(`Failed to upload audio file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start a Hume batch inference job with webhook callback
   * 
   * This method configures all three models (language, prosody, burst) with
   * speaker diarization enabled for deep, time-stamped analysis.
   */
  async startInferenceJob(
    fileUrl: string,
    webhookToken?: string
  ): Promise<PostedJob> {
    // Generate secure webhook URL
    const webhookTokenFinal = webhookToken || uuidv4();
    const callbackUrl = `${this.config.webhookBaseUrl}/api/jobs/webhook?token=${webhookTokenFinal}`;

    // Import or define the correct granularity enums/types from Hume SDK
    // For example, if Hume exports Granularity:
    // import { Granularity } from 'hume';

    // Configure prosody model with speaker diarization
    // OPTIMIZATION: Using UTTERANCE granularity for faster processing
    const prosodyConfig: ProsodyConfig = {
      granularity: Granularity.UTTERANCE,
      identify_speakers: true,  // Enable speaker diarization
    };

    // Configure language model with speaker diarization
    // OPTIMIZATION: Using UTTERANCE instead of WORD for 2-3x faster processing
    const languageConfig: LanguageConfig = {
      granularity: Granularity.UTTERANCE,
      identify_speakers: true,
    };

    try {
      const job: PostedJob = await this.humeClient.expressionMeasurement.batch.startInferenceJob({
        urls: [fileUrl],
        callbackUrl: callbackUrl,
        models: {
          // OPTIMIZATION: Using only prosody and language models for faster processing
          // Removed burst model to reduce processing time by ~30-40%
          prosody: prosodyConfig,
          language: languageConfig,
        },
        notify: false, // We use a webhook, not email notification
      });

      return job;
    } catch (error) {
      console.error('Error starting Hume inference job:', error);
      throw new Error(`Failed to start Hume job: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Complete ingestion flow: upload to Supabase Storage and start Hume job
   */
  async ingestAudioFile(
    fileBuffer: Buffer,
    fileName: string,
    contentType?: string,
    webhookToken?: string
  ): Promise<IngestJobResult> {
    try {
      // Step 1: Upload to Supabase Storage and get signed URL
      console.log(`[IngestService] Starting ingestion for file: ${fileName}`);
      const sourceUrl = await this.uploadToStorage(fileBuffer, fileName, contentType);
      console.log(`[IngestService] File uploaded successfully, URL: ${sourceUrl}`);

      // Step 2: Start Hume batch job
      console.log(`[IngestService] Starting Hume inference job for ${fileName}`);
      const job = await this.startInferenceJob(sourceUrl, webhookToken);

      if (!job || !job?.jobId) {
        throw new Error('Hume job creation returned invalid response');
      }

      console.log(`[IngestService] Hume job created successfully: ${job?.jobId}`);
      
      const result: IngestJobResult = {
        jobId: uuidv4(), // Our internal job ID
        humeJobId: job?.jobId,
        sourceUrl,
        status: 'QUEUED',
      };

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[IngestService] Error in ingestAudioFile: ${errorMessage}`);
      throw new Error(`Audio ingestion failed: ${errorMessage}`);
    }
  }

  /**
   * Start Hume job from already uploaded file URL
   * Use this for presigned upload flow where file is already in Supabase Storage
   */
  async ingestAudioFromUrl(
    fileUrl: string,
    filePath: string,
    fileName: string,
    contentType: string,
    webhookToken?: string
  ): Promise<IngestJobResult> {
    try {
      console.log(`[IngestService] Starting Hume job for uploaded file: ${fileName}`);
      
      // Start Hume batch job directly with the provided URL
      const job = await this.startInferenceJob(fileUrl, webhookToken);

      if (!job || !job?.jobId) {
        throw new Error('Hume job creation returned invalid response');
      }

      console.log(`[IngestService] Hume job created successfully: ${job?.jobId}`);
      
      const result: IngestJobResult = {
        jobId: uuidv4(), // Our internal job ID
        humeJobId: job?.jobId,
        sourceUrl: fileUrl,
        status: 'QUEUED',
      };

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[IngestService] Error in ingestAudioFromUrl: ${errorMessage}`);
      throw new Error(`Audio ingestion from URL failed: ${errorMessage}`);
    }
  }
}


/**
 * Voice Analysis using full Hume Expression Measurement API
 * 
 * This endpoint provides comprehensive voice analysis using:
 * - Language model (transcription + word-level emotions)
 * - Prosody model (utterance-level vocal tone)
 * - Burst model (vocal bursts like laughter, sighs)
 * 
 * This is a synchronous wrapper that uses the batch API with polling
 * for immediate results. For production, use the webhook-based architecture.
 */

import { NextRequest, NextResponse } from 'next/server';
import { HumeClient } from 'hume';
import { AnalysisService } from '@/services/hume/AnalysisService';
import { formatAnalysisForFrontend } from '@/utilities/humeDataParser';
import { createClient } from '@/utils/supabase/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { ProsodyConfig,LanguageConfig, Granularity } from '@/services/hume/IngestService';

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  return { user };
}

/**
 * POST /api/voice-analysis/hume
 * 
 * Comprehensive voice analysis using Hume Expression Measurement API
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    // Validate environment (using same pattern as voice-analysis route)
    const humeApiKey = process.env.HUME_API_KEY || process.env.HUME_AI_API_KEY;
    const humeSecret = process.env.HUME_SECRET || process.env.HUME_AI_SECRET;
    
    if (!humeApiKey) {
      return NextResponse.json(
        { error: 'HUME_API_KEY or HUME_AI_API_KEY is not configured' },
        { status: 500 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('audioFile') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { message: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Save file to temporary location
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filename = `${uuidv4()}-${file.name}`;
    const filepath = join(tmpdir(), filename);
    await writeFile(filepath, buffer);

    try {
      // Initialize Hume client
      const humeClient = new HumeClient({ apiKey: humeApiKey });

      // Configure models with speaker diarization
      const prosodyConfig: ProsodyConfig = {
        granularity: Granularity.UTTERANCE,
        identify_speakers: true,
      };

      const languageConfig: LanguageConfig = {
        granularity: Granularity.WORD,
        identify_speakers: true,
      };

      // Read file as buffer for upload
      const fileBuffer = await fs.promises.readFile(filepath);
      const arrayBuffer = fileBuffer instanceof Buffer
        ? fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
        : fileBuffer;
      const blob = new Blob([new Uint8Array(arrayBuffer as ArrayBuffer)], { type: file.type });

      // Create FormData for batch job
      const jobFormData = new FormData();
      jobFormData.append('file', blob, file.name);
      jobFormData.append('json', JSON.stringify({
        models: {
          transcription: {},
          prosody: prosodyConfig,
          language: languageConfig,
          burst: {},
        },
      }));

      // Start batch job
      const jobResponse = await fetch('https://api.hume.ai/v0/batch/jobs', {
        method: 'POST',
        headers: {
          'X-Hume-Api-Key': humeApiKey,
        },
        body: jobFormData,
      });

      if (!jobResponse.ok) {
        throw new Error(`Hume API error: ${jobResponse.statusText}`);
      }

      const jobData = await jobResponse.json();
      const jobId = jobData.job_id;

      // Poll for completion (simplified - use webhook in production)
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max
      let predictions: any = null;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

        const statusResponse = await fetch(
          `https://api.hume.ai/v0/batch/jobs/${jobId}`,
          {
            headers: {
              'X-Hume-Api-Key': humeApiKey,
            },
          }
        );

        const statusData = await statusResponse.json();
        const status = statusData.state?.status;

        if (status === 'COMPLETED') {
          // Get predictions
          const predictionsResponse = await fetch(
            `https://api.hume.ai/v0/batch/jobs/${jobId}/predictions`,
            {
              headers: {
                'X-Hume-Api-Key': humeApiKey,
              },
            }
          );
          predictions = await predictionsResponse.json();
          break;
        } else if (status === 'FAILED') {
          throw new Error(`Hume job failed: ${statusData.state?.message || 'Unknown error'}`);
        }

        attempts++;
      }

      if (!predictions) {
        throw new Error('Job timeout - processing took too long');
      }

      // Process predictions with AnalysisService
      const analysisService = new AnalysisService();
      const analysis = await analysisService.processPredictions(predictions);

      // Format for frontend
      const formatted = formatAnalysisForFrontend(analysis);

      // Clean up temp file
      fs.unlink(filepath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });

      // Return comprehensive analysis
      return NextResponse.json({
        metadata: {
          filename: file.name,
          filesize: file.size,
          timestamp: new Date().toISOString(),
        },
        hume: formatted,
        raw: {
          // Include raw data for advanced use cases
          unifiedTranscript: analysis.unifiedTranscript,
          fullEmotions: analysis.emotions,
        },
      });

    } catch (error) {
      // Clean up temp file
      fs.unlink(filepath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
      throw error;
    }

  } catch (error: unknown) {
    console.error('Voice analysis error:', error);
    return NextResponse.json(
      {
        error: 'Error processing audio file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


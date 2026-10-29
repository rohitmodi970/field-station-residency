/**
 * Webhook endpoint for Hume and Imentiv batch job completion notifications
 * 
 * This endpoint receives POST requests from Imentiv / Hume APIs when an audio job completes.
 * It routes to the appropriate service based on provider or payload shape.
 */

import { NextRequest, NextResponse } from 'next/server';
import { JobWebhookService } from '@/services/hume/JobWebhookService';
import { imentivWebhookService } from '@/services/imentiv/ImentivWebhookService';

// Initialize Hume webhook service
const getHumeWebhookService = () => {
  const humeApiKey = process.env.HUME_API_KEY || process.env.HUME_AI_API_KEY;
  if (!humeApiKey) {
    throw new Error('HUME_API_KEY or HUME_AI_API_KEY is not configured');
  }
  return new JobWebhookService({ humeApiKey });
};

/**
 * POST /api/jobs/webhook
 * 
 * Receives webhook notifications from Imentiv or Hume APIs
 * 
 * Query params:
 * - token: Security token for webhook verification
 * - provider: 'imentiv' | 'hume' (optional)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    const providerQuery = searchParams.get('provider')?.toLowerCase();

    let payload: Record<string, any>;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const isImentiv =
      providerQuery === 'imentiv' ||
      Boolean(payload.audio_id || payload.media_id || payload.text_id);

    // ───────────────────────────────────────────────
    // 1. Imentiv Webhook Processing
    // ───────────────────────────────────────────────
    if (isImentiv) {
      const audioId = payload.audio_id || payload.media_id || payload.text_id;
      if (!audioId) {
        return NextResponse.json(
          { error: 'Invalid Imentiv webhook payload: missing audio_id' },
          { status: 400 }
        );
      }

      if (token) {
        const isValid = await imentivWebhookService.verifyWebhookToken(token, audioId);
        if (!isValid) {
          console.warn(`[Webhook] Invalid token for Imentiv audio ${audioId}`);
          return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 });
        }
      }

      await imentivWebhookService.processWebhook({
        audio_id: audioId,
        status: payload.status || 'COMPLETED',
        message: payload.message || payload.error,
      });

      return NextResponse.json({
        success: true,
        provider: 'imentiv',
        message: 'Imentiv webhook processed successfully',
      });
    }

    // ───────────────────────────────────────────────
    // 2. Hume Webhook Processing (Backwards compatibility)
    // ───────────────────────────────────────────────
    if (!payload.job_id || !payload.status) {
      return NextResponse.json(
        {
          error: 'Invalid webhook payload',
          details: 'Missing job_id or status',
        },
        { status: 400 }
      );
    }

    if (!token) {
      return NextResponse.json({ error: 'Missing webhook token' }, { status: 401 });
    }

    const humeWebhookService = getHumeWebhookService();
    const isValid = await humeWebhookService.verifyWebhookToken(token, payload.job_id);

    if (!isValid) {
      console.warn(`[Webhook] Invalid token for Hume job ${payload.job_id}`);
      return NextResponse.json({ error: 'Invalid webhook token' }, { status: 401 });
    }

    await humeWebhookService.processWebhook({
      job_id: payload.job_id,
      status: payload.status,
      message: payload.message,
    });

    return NextResponse.json({
      success: true,
      provider: 'hume',
      message: 'Hume webhook processed successfully',
    });
  } catch (error: unknown) {
    console.error('[Webhook] Processing error:', error instanceof Error ? error.message : String(error));

    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jobs/webhook
 * 
 * Health check endpoint
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    service: 'Audio Emotion Analysis Webhook Receiver (Imentiv & Hume)',
  });
}



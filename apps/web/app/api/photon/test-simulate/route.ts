/**
 * Photon Simulation Test API
 * Purpose: Dedicated interactive test harness for Shriyanshi & QA to simulate incoming
 * WhatsApp, iMessage, and Telegram text, voice notes, and photos without requiring live carrier webhooks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processPhotonPayload, type PhotonPayload } from '@/lib/photon/webhook';
import { getOutboundLog, clearOutboundLog } from '@/lib/photon/outboundClient';

export const runtime = 'nodejs';

export async function GET() {
  const outboundLog = getOutboundLog();
  return NextResponse.json({
    ok: true,
    service: 'Force Photon Social Brain Simulator',
    status: 'ready',
    instructions: {
      description:
        'POST a JSON payload to simulate an inbound WhatsApp or iMessage message from a physical device.',
      samplePayload: {
        platform: 'whatsapp',
        phone: '+919876543210',
        senderName: 'Shriyanshi',
        text: 'Felt really drained after the product meeting with Rohit today. Need to rethink our launch pace.',
        contentType: 'text',
      },
      voiceSamplePayload: {
        platform: 'whatsapp',
        phone: '+919876543210',
        senderName: 'Shriyanshi',
        contentType: 'voice',
        voiceTranscript: 'Remember to review the Photon security specs with Srinjoy by Thursday noon, blocker is waiting for API keys',
      },
    },
    recentOutboundDispatches: outboundLog.slice(-10),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const platform = (body.platform || 'whatsapp').toLowerCase();
    const phone = body.phone || body.senderId || '+919876543210';
    const senderName = body.senderName || 'Tester';
    const contentType = body.contentType || (body.voiceTranscript ? 'voice' : 'text');
    const text = body.text || body.query || body.voiceTranscript || 'Hey Force!';
    const voiceTranscript = body.voiceTranscript;
    const mediaUrl = body.mediaUrl || body.imageUrl;
    const caption = body.caption;

    if (body.action === 'clear_logs') {
      clearOutboundLog();
      return NextResponse.json({ ok: true, cleared: true });
    }

    // Construct standard Photon / Spectrum incoming payload
    const simulatedMessageId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const simulatedPayload: PhotonPayload = {
      event: 'messages',
      id: `sim_webhook_${Date.now()}`,
      space: {
        id: `space_${phone.replace(/\D/g, '')}`,
        platform,
        phone,
      },
      message: {
        id: simulatedMessageId,
        timestamp: new Date().toISOString(),
        sender: {
          id: phone,
          platform,
          name: senderName,
        },
        content: {
          type: contentType,
          text: contentType === 'voice' ? undefined : text,
          transcript: voiceTranscript,
          url: mediaUrl,
          caption,
        },
      },
    };

    const processResult = await processPhotonPayload(simulatedPayload);

    // Retrieve the generated outbound message from the client ledger
    const outboundHistory = getOutboundLog();
    const lastDispatched = outboundHistory.find((entry) => entry.options.recipientId === phone) ||
      outboundHistory[outboundHistory.length - 1];

    return NextResponse.json(
      {
        ok: true,
        simulation: {
          platform,
          senderPhone: phone,
          senderName,
          contentType,
          inboundContent: text,
          userResolved: Boolean(processResult.userId),
          userId: processResult.userId || null,
          brainSideEffects: processResult.sideEffects || {},
          outboundReply: {
            text: processResult.replyText || lastDispatched?.formattedText || '',
            delivered: Boolean(processResult.replySent),
            platformNativeFormat: lastDispatched?.formattedText || '',
          },
          status: processResult.status,
        },
        fullResult: processResult,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Photon Simulation] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Simulation test failed',
      },
      { status: 500 }
    );
  }
}

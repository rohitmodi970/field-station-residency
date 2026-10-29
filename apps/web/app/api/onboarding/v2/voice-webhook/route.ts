import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * Force V2 — Vapi Voice Webhook Receiver
 * Listens for end-of-call transcript reports and automatically saves answers into user_context_model.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));
    const message = payload?.message;

    console.log(`🔔 [API:OnboardingV2:VoiceWebhook] Incoming Vapi webhook event: "${message?.type || 'unknown'}"`);

    if (message?.type === 'end-of-call-report') {
      const transcript = message.transcript || '';
      const summary = message.summary || '';
      const customerNumber = message.call?.customer?.number;

      console.log(`🎙️ [API:OnboardingV2:VoiceWebhook] Received call transcript for ${customerNumber} (${transcript.length} chars)`);

      // If user session/ID was passed in metadata, save to Supabase
      const userId = message.call?.assistantOverrides?.variableValues?.userId;

      if (userId) {
        console.log(`💾 [API:OnboardingV2:VoiceWebhook] Persisting voice call transcript for user ${userId}...`);
        const supabase = await createClient();
        await supabase
          .from('user_context_model')
          .update({
            onboarding_answers: {
              voice_call_transcript: {
                question_id: 'voice_call_transcript',
                question_prompt: 'Full Onboarding Phone Call Dialogue',
                raw_answer: transcript,
                answered_at: new Date().toISOString(),
              },
            },
            onboarding_step: 4,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        console.log(`✅ [API:OnboardingV2:VoiceWebhook] Successfully saved voice transcript to user_context_model for user ${userId}`);
      } else {
        console.warn(`⚠️ [API:OnboardingV2:VoiceWebhook] No userId found in call metadata (variableValues.userId)`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('❌ [API:OnboardingV2:VoiceWebhook] Error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

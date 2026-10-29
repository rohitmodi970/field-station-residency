import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * Force V2 — AI Voice Call Onboarding Trigger
 * Initiates an outbound phone call via Vapi.ai (bundling Deepgram + Cartesia + Claude 3.5 Haiku)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { phone_number, name } = body;

    if (!phone_number) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const maskedPhone = phone_number.replace(/(\d{2,3})\d+(\d{4})/, '$1****$2');
    const userName = name || user.user_metadata?.full_name?.split(' ')[0] || 'there';
    console.log(`📞 [API:OnboardingV2:VoiceCall] Initiating outbound call to ${maskedPhone} for user ${user.id} (${userName})`);

    const vapiApiKey = process.env.VAPI_API_KEY;

    if (!vapiApiKey) {
      console.warn('⚠️ [API:OnboardingV2:VoiceCall] VAPI_API_KEY is not configured in .env');
      return NextResponse.json({
        error: 'VAPI_API_KEY is not configured in environment. Sign up on vapi.ai to get $10 free testing credits.',
      }, { status: 500 });
    }

    // System prompt instructing the Voice Agent to conduct the 5-question onboarding dialogue
    const systemPrompt = `
You are Force, a calm, warm, and highly perceptive AI companion.
You are calling ${userName} for a 2-minute onboarding conversation to understand who they are, how they think, and what's on their mind.

CONVERSATION FLOW:
1. Warmly introduce yourself: "Hey ${userName}, this is Force. Instead of making you fill out forms on a screen, I just wanted to ask you a couple quick questions to get to know you."
2. Question 1 (Current state): "If someone asked how life's going right now — honestly — what would you say?"
3. Acknowledge their answer with genuine empathy (do not sound like a robot or customer service agent).
4. Question 2 (Values): "What's something you care deeply about that most people around you don't really get?"
5. Question 3 (Relationships): "Who's the first person you'd call if something really great happened to you?"
6. Question 4 (Unresolved thought): "What's one thing that keeps coming back to your mind lately — something you haven't fully figured out?"
7. Question 5 (Aspiration): "If Force could help you with one thing over the next month, what would be most useful?"
8. Wrap up: "Thank you so much ${userName}. I'm synthesizing your Day 1 model right now. You can check your Force dashboard whenever you're ready."

TONE GUIDELINES:
- Speak casually and warmly with natural human pauses.
- Keep your responses under 2-3 sentences so the user speaks 80% of the time.
- If the user discloses acute grief or burnout, acknowledge it with deep care.
`;

    // Outbound call to Vapi
    const response = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID, // Free phone number provisioned in Vapi dashboard
        customer: {
          number: phone_number,
          name: userName,
        },
        assistantOverrides: {
          variableValues: {
            userId: user.id,
            userName,
          },
        },
        assistant: {
          name: 'Force Onboarding Voice Companion',
          firstMessage: `Hey ${userName}, this is Force. Thanks for taking a moment to connect.`,
          transcriber: {
            provider: 'deepgram',
            model: 'nova-2',
            language: 'en',
          },
          model: {
            provider: 'anthropic',
            model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
            messages: [{ role: 'system', content: systemPrompt }],
          },
          voice: {
            provider: 'cartesia',
            voiceId: 'a0e99841-438c-4a64-b679-ae501e7d6091', // Warm conversational voice
          },
          endCallMessage: 'Talk to you soon. Have a wonderful day.',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ [API:OnboardingV2:VoiceCall] Error from Vapi API:', errText);
      return NextResponse.json({ error: `Vapi error: ${errText}` }, { status: 500 });
    }

    const callResult = await response.json();
    console.log(`✅ [API:OnboardingV2:VoiceCall] Call dispatched successfully! Call ID: ${callResult.id} (Status: ${callResult.status})`);

    return NextResponse.json({
      success: true,
      call_id: callResult.id,
      status: callResult.status,
      message: `Calling ${phone_number}...`,
    });
  } catch (err: any) {
    console.error('❌ [API:OnboardingV2:VoiceCall] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

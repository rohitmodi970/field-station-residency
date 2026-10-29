/**
 * Force V2 — 90-Second Voice Debrief API
 * "Process a conversation with a partner"
 *
 * Flow:
 * 1. User records ≤90 seconds of voice reflecting on a recent conversation with a connection
 * 2. Audio is transcribed via Deepgram/Imentiv (reuses existing /api/voice-transcript)
 * 3. Transcript + relationship context is fed to the reasoning engine
 * 4. Agent produces a grounded reflection on the interaction
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { buildUserContextSnapshot } from '@/lib/agent/v2/contextSnapshotService';
import { evaluateAgentDecision } from '@/lib/agent/v2/reasoningEngine';
import { buildRelationshipContextSnapshot } from '@/lib/agent/v2/relationshipContextService';
import { applyMemoryMutations } from '@/lib/agent/v2/memoryMutationService';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const audioFile = formData.get('audioFile') as File | null;
    const connectionId = formData.get('connectionId') as string | null;
    const partnerName = formData.get('partnerName') as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'audioFile is required' }, { status: 400 });
    }

    // Validate duration — max 90 seconds of audio
    const durationStr = formData.get('durationSeconds') as string | null;
    const duration = durationStr ? parseFloat(durationStr) : 0;
    if (duration > 100) {
      return NextResponse.json({ error: 'Voice debrief must be 90 seconds or less' }, { status: 400 });
    }

    // ── Step 1: Transcribe audio via existing voice-transcript API ──
    const transcriptFormData = new FormData();
    transcriptFormData.append('audioFile', audioFile);

    const origin = req.nextUrl.origin;
    const transcriptRes = await fetch(`${origin}/api/voice-transcript`, {
      method: 'POST',
      body: transcriptFormData,
      headers: {
        // Forward auth cookie for server-side auth
        cookie: req.headers.get('cookie') || '',
      },
    });

    if (!transcriptRes.ok) {
      const errBody = await transcriptRes.json().catch(() => ({ error: 'Transcription failed' }));
      console.error('[VoiceDebrief] Transcription failed:', errBody);
      return NextResponse.json(
        { error: errBody.error || 'Failed to transcribe voice debrief' },
        { status: 502 }
      );
    }

    const transcriptData = await transcriptRes.json();
    const transcript = (transcriptData.transcript || '').trim();

    if (!transcript || !transcriptData.transcriptDetected) {
      return NextResponse.json(
        {
          error: 'no_speech_detected',
          message: 'Force couldn\u2019t detect clear speech. Try recording again, closer to the microphone.',
        },
        { status: 422 }
      );
    }

    // ── Step 2: Build context snapshot with relationship bridge ──
    const snapshot = await buildUserContextSnapshot(
      supabase,
      user.id,
      { full_name: user.user_metadata?.full_name, email: user.email },
      { query: transcript, maxVectorResults: 3 }
    );

    if (!snapshot) {
      return NextResponse.json({ error: 'Could not build user context' }, { status: 500 });
    }

    // ── Step 3: Enrich with specific relationship context if connectionId provided ──
    let relationshipContext = '';
    if (connectionId) {
      const relResult = await buildRelationshipContextSnapshot(supabase, connectionId, user.id);
      if (relResult.permitted && relResult.snapshot) {
        const rel = relResult.snapshot;
        const sharedTopics = rel.shared_topics?.length
          ? `Shared topics: ${rel.shared_topics.join(', ')}.`
          : '';
        relationshipContext = `\nRelationship Context with ${partnerName || 'partner'}: Modeling is active. ${sharedTopics}`;
      }
    }

    // ── Step 4: Run reasoning engine with debrief trigger ──
    const debriefMessage = `[VOICE DEBRIEF — ${partnerName || 'a partner'}]
The user just recorded a ${Math.round(duration)}-second voice reflection about a recent conversation with ${partnerName || 'someone important to them'}.

Transcript of their reflection:
"${transcript}"
${relationshipContext}

Your task: Provide a grounded, perceptive reflection on what this conversation reveals. Notice patterns, emotional undertones, unresolved tensions, or growth. Be brief (2-4 sentences). If a thread is relevant, reference it. End with one perceptive question that deepens their understanding.`;

    const decision = await evaluateAgentDecision({
      snapshot,
      incomingMessage: debriefMessage,
    });

    const reflectionText =
      decision.content ||
      `I hear what you shared regarding your conversation with ${partnerName || 'your partner'}. It seems there is an important dynamic or unresolved thought still settling for you. What part of that exchange is lingering with you most right now?`;

    // ── Step 5: Persist interaction event ──
    await supabase.from('interaction_events').insert({
      user_id: user.id,
      source: 'user',
      event_type: 'voice_debrief',
      event_data: {
        transcript,
        duration_seconds: duration,
        partner_name: partnerName || null,
        connection_id: connectionId || null,
        agent_response: reflectionText,
        confidence: decision.confidence,
      },
    });

    // ── Step 6: Apply memory mutations to user_context_model ──
    try {
      await applyMemoryMutations(supabase, user.id, decision);
    } catch (memErr) {
      console.warn('[VoiceDebrief] Non-blocking error applying memory mutations:', memErr);
    }

    return NextResponse.json({
      transcript,
      sentiment: transcriptData.sentiment || null,
      reflection: reflectionText,
      action: decision.action,
      confidence: decision.confidence,
      reasoning_trace: decision.reasoning_trace,
      should_persist: decision.should_persist,
    });
  } catch (err: any) {
    console.error('[VoiceDebrief] Unexpected error:', err);
    return NextResponse.json(
      { error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

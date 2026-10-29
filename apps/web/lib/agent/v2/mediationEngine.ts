/**
 * Force V2 — Relationship Mediation & Bridging Engine
 * Evaluates relationship-level context between two connected users (A <-> B)
 * using Anthropic Claude Haiku 4.5.
 *
 * Invariants:
 * 1. Strictly enforces the 0.55 confidence floor (MIN_MEDIATION_CONFIDENCE_THRESHOLD).
 * 2. Generates constructive bridging questions and notices communication patterns.
 * 3. Never delivers judgmental AI verdicts, never takes sides.
 * 4. Never exposes private inner thoughts or unconsented journal entries.
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

import {
  MediationContextSnapshot,
  MediationDecision,
  MIN_MEDIATION_CONFIDENCE_THRESHOLD,
} from '@/types/mediation-schemas';

export interface MediationReasoningInput {
  snapshot: MediationContextSnapshot;
  triggerContext?: {
    type: 'shared_snapshot_added' | 'partner_checkin' | 'manual_request' | 'rhythm_evaluation';
    note?: string;
  };
}

const ANTHROPIC_MODELS = [
  process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',   // Fastest, cost-effective
];

export async function evaluateMediationDecision(
  input: MediationReasoningInput
): Promise<MediationDecision> {
  const { snapshot, triggerContext } = input;

  // 1. Guard against unpermitted modeling
  if (!snapshot.is_modeling_permitted || snapshot.status !== 'accepted') {
    return {
      action: 'silence',
      visibility: 'shared',
      confidence: 0,
      reasoning_trace: 'Mutual modeling consent is not active or connection is not accepted.',
      context_used: [],
      should_persist: false,
    };
  }

  // 2. Prevent cognitive overload (max 2 active interventions waiting)
  if (snapshot.active_intervention_count >= 2) {
    return {
      action: 'silence',
      visibility: 'shared',
      confidence: 0.50,
      reasoning_trace: 'Connection already has 2 active interventions. Suppressing to prevent cognitive overload.',
      context_used: [],
      should_persist: false,
    };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ [MediationEngine] ANTHROPIC_API_KEY not found. Returning safe silence.');
    return {
      action: 'silence',
      visibility: 'shared',
      confidence: 0,
      reasoning_trace: 'Anthropic API key not configured.',
      context_used: [],
      should_persist: false,
    };
  }

  // 3. Compile scoped context summary for mediation prompt
  const sharedTopics = snapshot.relationship_rhythms.shared_topics.length > 0
    ? snapshot.relationship_rhythms.shared_topics.map(t => `- ${t}`).join('\n')
    : '(no shared topics identified yet)';

  const sharedSnapshots = snapshot.consented_shared_snapshots.length > 0
    ? snapshot.consented_shared_snapshots.map(s => `- [${s.grant_type}]: ${s.title_summary || 'Reflection'}`).join('\n')
    : '(no shared journal snapshots currently shared)';

  const recentEvents = snapshot.recent_relationship_events.length > 0
    ? snapshot.recent_relationship_events.slice(0, 5).map(e => `- ${e.event_type} (${e.created_at})`).join('\n')
    : '(none)';

  const systemPrompt = `You are Force, an autonomous, deeply perceptive, calm, and grounded AI mediator and thinking companion for two connected people (Person A and Person B).
Your goal is to help this pair understand each other's perspective, notice recurring communication rhythms, and bridge unspoken friction without taking sides, without judging, and without delivering artificial "verdicts".

Core Principles:
1. Speak with calm depth, brevity, and emotional precision. No robotic bullet points, no unsolicited lecturing, no cheerful filler.
2. The Bridging Question Principle: If you notice a communication mismatch or recurring dilemma, offer a thoughtful question that invites mutual curiosity (e.g. "You two have both approached this decision from different paces — what would it look like to align on the timeline before the details?").
3. Epistemic Humility & Silence: If an intervention does not add high leverage or insight, or if confidence < 0.55, you MUST choose action "silence".
4. Never Blame or Take Sides: Both participants must always feel respected and understood.
5. Visibility Determination:
   - "shared": Both participants see the observation in their shared Partner Lounge.
   - "private_to_initiator": Suggestion visible only to the person who triggered the check.
   - "private_to_target": Suggestion intended only for the other partner.

Output Schema:
You must respond with ONLY a single, strictly valid JSON object matching this exact schema:
{
  "action": "bridging_question" | "pattern_reflection" | "friction_nudge" | "real_world_suggestion" | "silence",
  "visibility": "shared" | "private_to_initiator" | "private_to_target",
  "target_user_id": null,
  "content": "Short observation or reflection to share (null if action is silence)",
  "bridging_question": "A gentle question that helps the pair explore this together (null if silence)",
  "confidence": number between 0.0 and 1.0,
  "reasoning_trace": "Brief internal explanation of why you chose this action",
  "context_used": ["topics or events referenced"],
  "should_persist": true or false
}`;

  const userPrompt = `Connection Details:
- Connection ID: ${snapshot.connection_id}
- Requester ID: ${snapshot.requester_id}
- Recipient ID: ${snapshot.recipient_id}
- Caller User ID: ${snapshot.caller_user_id} (${snapshot.caller_role})
- Days Connected: ${snapshot.relationship_rhythms.days_since_first_connected}

Consented Shared Topics:
${sharedTopics}

Consented Shared Snapshots:
${sharedSnapshots}

Recent Relationship Events:
${recentEvents}

Trigger Context:
${triggerContext?.type || 'rhythm_evaluation'}: ${triggerContext?.note || 'Routine check for bridging moments.'}

Decide whether to intervene with a bridging question, pattern reflection, or remain silent (confidence >= 0.55 required).`;

  for (const model of ANTHROPIC_MODELS) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
        signal: AbortSignal.timeout(18000),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`⚠️ [MediationEngine] Anthropic ${model} failed (${response.status}):`, errText);
        continue;
      }

      const resData = await response.json();
      const rawText = resData.content?.[0]?.text?.trim() || '';

      const cleanJson = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(cleanJson) as MediationDecision;

      // Enforce the canonical Confidence Floor rule
      if (parsed.confidence < MIN_MEDIATION_CONFIDENCE_THRESHOLD) {
        console.log(`🔇 [MediationEngine] Confidence ${parsed.confidence} is below floor ${MIN_MEDIATION_CONFIDENCE_THRESHOLD}. Forcing silence.`);
        return {
          action: 'silence',
          visibility: 'shared',
          confidence: parsed.confidence,
          reasoning_trace: `Confidence (${parsed.confidence}) below 0.55 floor. Reverted to silence. Trace: ${parsed.reasoning_trace}`,
          context_used: parsed.context_used || [],
          should_persist: false,
        };
      }

      if (parsed.action === 'silence') {
        parsed.content = undefined;
        parsed.bridging_question = undefined;
        parsed.should_persist = false;
      } else {
        parsed.should_persist = true;
      }

      console.log(`✨ [MediationEngine] Decision via ${model}: action=${parsed.action}, confidence=${parsed.confidence}`);
      return parsed;
    } catch (err) {
      console.warn(`⚠️ [MediationEngine] Attempt failed with ${model}:`, err);
    }
  }

  // Graceful fallback if models time out or are unreachable
  return {
    action: 'silence',
    visibility: 'shared',
    confidence: 0.50,
    reasoning_trace: 'Fallback to safe silence due to model provider unavailability.',
    context_used: [],
    should_persist: false,
  };
}

// apps/web/lib/residency/intentSynthesizer.ts
// Synthesizes the 5-Field Intent Snapshot + 1 Next Step using executeLLMRequest with strict anti-hallucination guardrails

import { executeLLMRequest } from '../llm/llmService';
import type { ResidencyIntentSnapshot, OnairosNormalizedContext, ResidencyContribution } from './types';

export interface SynthesizerInput {
  userId: string;
  cohortId?: string;
  userName?: string;
  avatarUrl?: string;
  socialLinks?: Record<string, string>;
  publicFindings?: Array<{
    id: string;
    label: string;
    text: string;
    sources: Array<{ title: string; url: string }>;
  }>;
  answers:
    | string[]
    | {
        q1_intent?: string;
        q2_problem?: string;
        q3_blocker?: string;
        q1?: string;
        q2?: string;
        q3?: string;
        q1_current_state?: any;
        q2_values?: any;
        q3_relationships?: any;
        [key: string]: any;
      };
  rawAnswers?: Record<string, { text: string; audio_duration?: string; audio_url?: string }>;
  contributions?: {
    can_offer?: string[] | string;
    seeking?: string[] | string;
  };
  onairosContext?: OnairosNormalizedContext;
}

function sanitizeText(val: any): string {
  if (typeof val === 'string') return val.trim();
  if (!val) return '';
  if (val.raw_answer && typeof val.raw_answer === 'string') return val.raw_answer.trim();
  if (Array.isArray(val.chips_selected) && val.chips_selected.length > 0) return val.chips_selected.join(', ');
  return '';
}

function toArray(val: string[] | string | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
  return String(val)
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function synthesizeIntentSnapshot(
  input: SynthesizerInput
): Promise<Omit<ResidencyIntentSnapshot, 'id' | 'created_at' | 'updated_at'>> {
  const cohortId = input.cohortId || 'dhun-oct-2026';
  const name = input.userName || 'Resident';

  // Symmetrical Answer Normalization: handle both string[] and keyed object
  let q1Raw = '';
  let q2Raw = '';
  let q3Raw = '';

  if (Array.isArray(input.answers)) {
    q1Raw = sanitizeText(input.answers[0]);
    q2Raw = sanitizeText(input.answers[1]);
    q3Raw = sanitizeText(input.answers[2]);
  } else if (input.answers && typeof input.answers === 'object') {
    q1Raw = sanitizeText(input.answers.q1_intent || input.answers.q1 || input.answers.q1_current_state);
    q2Raw = sanitizeText(input.answers.q2_problem || input.answers.q2 || input.answers.q2_values);
    q3Raw = sanitizeText(input.answers.q3_blocker || input.answers.q3 || input.answers.q3_relationships);
  }

  // Also check input.rawAnswers if main answers were empty
  if (!q1Raw && input.rawAnswers?.q1?.text) q1Raw = sanitizeText(input.rawAnswers.q1.text);
  if (!q2Raw && input.rawAnswers?.q2?.text) q2Raw = sanitizeText(input.rawAnswers.q2.text);
  if (!q3Raw && input.rawAnswers?.q3?.text) q3Raw = sanitizeText(input.rawAnswers.q3.text);

  const canOffer = toArray(input.contributions?.can_offer);
  const seeking = toArray(input.contributions?.seeking);

  const onairos = input.onairosContext;
  const onairosTraits = (onairos?.positive_traits || []).map((t) => `${t.trait} (strength: ${t.score}%)`).join(', ');

  // Sparse input check (Honest Anti-Hallucination Guardrail)
  const isQ1Sparse = !q1Raw || /^(hey|hi|hello|nothing|none|test|idk)$/i.test(q1Raw.trim());
  const isQ2Sparse = !q2Raw || /^(hey|hi|hello|nothing|none|test|idk)$/i.test(q2Raw.trim());
  const isQ3Sparse = !q3Raw || /^(nothing|nothing comes to mind right now|none|not sure|idk)$/i.test(q3Raw.trim());

  let synthesizedData: any = null;

  // Only invoke LLM if resident provided real substantive input
  const hasSubstantiveContent = !isQ1Sparse || !isQ2Sparse || !isQ3Sparse;

  if (hasSubstantiveContent) {
    const prompt = `You are Force, the cognitive architect for the Dhun Residency.
Analyze this resident's onboarding survey answers and supporting authorized behavioral signals to synthesize an authentic Five-Field Intent Snapshot.

Resident Name: ${name}

Core Answers:
- Q1 (Desired outcome & why it matters): ${!isQ1Sparse ? q1Raw : '(Not answered yet)'}
- Q2 (Underlying problem, audience & rationale): ${!isQ2Sparse ? q2Raw : '(Not answered yet)'}
- Q3 (Biggest blocker / open question): ${!isQ3Sparse ? q3Raw : '(Not answered yet)'}

Optional Contribution Signals:
- Can offer: ${canOffer.join(', ') || '(Not specified)'}
- Seeking: ${seeking.join(', ') || '(Not specified)'}

Authorized Supporting Context (Onairos General Persona):
- Positive traits: ${onairosTraits || '(None)'}
- Archetype: ${onairos?.archetype || 'Builder'}
- Context summary: ${onairos?.user_summary || '(None)'}

Public Online Presence & Social Footprint (from user's connected links):
- Social Links: ${Object.entries(input.socialLinks || {}).filter(([_, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ') || '(None)'}
${input.publicFindings?.length ? `- Public Findings:\n${input.publicFindings.map(f => `  * ${f.label}: ${f.text} (sources: ${f.sources.map(s => s.title).join(', ')})`).join('\n')}` : '- Public Findings: (None)'}

CRITICAL RULES:
1. Ground every field in evidence. Prioritize explicit user answers over inferred signals. Use public social/technical footprint to ground the "approach" lenses in verified tools, frameworks, and domains.
2. "intent": 1-2 crisp sentences stating their active residency goal and personal motivation. If Q1 was not answered, return empty string "".
3. "problem": 1-2 crisp sentences capturing the underlying bottleneck or challenge. If Q2 was not answered, return empty string "".
4. "approach": An array of 2 to 4 specific technical choices, methods, or philosophical lenses. If no info, return empty array [].
5. "current_frontier": 1-2 sentences on their immediate active blocker or inquiry. If Q3 was not answered, return empty string "".
6. "contribution": Object with "can_offer" (array of concrete skills/insights) and "seeking" (array of feedback/help needed).
7. "next_step": Exactly ONE concrete action completable in 10-30 minutes starting with an active verb (e.g. Sketch, Audit, Prototype, Interview), plus "why_it_may_help" directly addressing their blocker.

Return strictly valid JSON with no markdown wrapping:
{
  "intent": string,
  "problem": string,
  "approach": string[],
  "current_frontier": string,
  "contribution": {
    "can_offer": string[],
    "seeking": string[]
  },
  "next_step": {
    "text": string,
    "why_it_may_help": string
  }
}`;

    try {
      const res = await executeLLMRequest({
        prompt,
        provider: process.env.DEFAULT_LLM_PROVIDER || 'claude',
        options: {
          rawPrompt: true,
          temperature: 0.3,
          maxTokens: 800,
        },
      });

      if (res?.text) {
        const text = res.text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          synthesizedData = JSON.parse(jsonMatch[0]);
        }
      }
    } catch (e: any) {
      console.warn('[IntentSynthesizer] executeLLMRequest notice:', e.message);
    }
  }

  // Word allocation analysis across raw answers
  const q1Words = !isQ1Sparse ? q1Raw.split(/\s+/).filter(Boolean).length : 0;
  const q2Words = !isQ2Sparse ? q2Raw.split(/\s+/).filter(Boolean).length : 0;
  const q3Words = !isQ3Sparse ? q3Raw.split(/\s+/).filter(Boolean).length : 0;
  const totalWords = q1Words + q2Words + q3Words;

  let intentPct = 0;
  let problemPct = 0;
  let frontierPct = 0;
  let dominantCategory: 'intent' | 'problem' | 'open question' = 'open question';
  let dominantPct = 0;

  if (totalWords > 0) {
    intentPct = Math.round((q1Words / totalWords) * 100);
    problemPct = Math.round((q2Words / totalWords) * 100);
    frontierPct = Math.max(0, 100 - intentPct - problemPct);

    if (intentPct >= problemPct && intentPct >= frontierPct) {
      dominantCategory = 'intent';
      dominantPct = intentPct;
    } else if (problemPct >= intentPct && problemPct >= frontierPct) {
      dominantCategory = 'problem';
      dominantPct = problemPct;
    } else {
      dominantCategory = 'open question';
      dominantPct = frontierPct;
    }
  }

  // Strict honest guardrail: If input is sparse, return empty string so UI renders "Force doesn't know this yet"
  const finalIntent = isQ1Sparse ? '' : (synthesizedData?.intent || q1Raw);
  const finalProblem = isQ2Sparse ? '' : (synthesizedData?.problem || q2Raw);
  const finalFrontier = isQ3Sparse ? '' : (synthesizedData?.current_frontier || q3Raw);

  let finalApproach: string[] = [];
  if (Array.isArray(synthesizedData?.approach) && synthesizedData.approach.length > 0) {
    finalApproach = synthesizedData.approach;
  } else if (!isQ1Sparse || !isQ2Sparse) {
    finalApproach = ['Iterative Prototyping', 'Verifiable Architecture'];
  }

  const finalContribution: ResidencyContribution = {
    can_offer: synthesizedData?.contribution?.can_offer?.length
      ? synthesizedData.contribution.can_offer
      : canOffer.length
      ? canOffer
      : [],
    seeking: synthesizedData?.contribution?.seeking?.length
      ? synthesizedData.contribution.seeking
      : seeking.length
      ? seeking
      : [],
  };

  const finalNextStep = {
    text:
      synthesizedData?.next_step?.text ||
      (!isQ3Sparse
        ? `Sketch 3 possible solutions for: ${q3Raw.slice(0, 50)} on paper.`
        : !isQ1Sparse
        ? 'Write down 1 concrete milestone for this week.'
        : ''),
    why_it_may_help:
      synthesizedData?.next_step?.why_it_may_help ||
      (!isQ3Sparse ? 'Clarifies scope and prevents over-engineering.' : 'Helps set your immediate focus.'),
    status: 'suggested' as const,
  };

  // Real raw answers with real audio clips (NO fake mock phrases)
  const rawAnswersObj: Record<string, any> = input.rawAnswers || {
    q1: { text: isQ1Sparse ? '' : q1Raw, audio_duration: '0:00' },
    q2: { text: isQ2Sparse ? '' : q2Raw, audio_duration: '0:00' },
    q3: { text: isQ3Sparse ? '' : q3Raw, audio_duration: '0:00' },
  };

  return {
    user_id: input.userId,
    user_name: name,
    avatar_url: input.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    social_links: input.socialLinks || { x: '', instagram: '', github: '', website: '' },
    cohort_id: cohortId,
    intent: finalIntent,
    problem: finalProblem,
    approach: finalApproach,
    // Onairos persona intelligence fields (replacing current_frontier and contribution)
    archetype: onairos?.archetype || 'Resident',
    positive_traits: onairos?.positive_traits || [],
    user_summary: onairos?.user_summary || '',
    top_traits_explanation: onairos?.top_traits_explanation || '',
    nudges: onairos?.nudges || [],
    onairos_metadata: onairos?.metadata || {
      platform_breakdown: {},
    },
    current_frontier: finalFrontier,
    contribution: finalContribution,
    next_step: finalNextStep,
    raw_answers: rawAnswersObj,
    word_allocation: {
      total_words: totalWords,
      intent_pct: intentPct,
      problem_pct: problemPct,
      frontier_pct: frontierPct,
      dominant_category: dominantCategory,
      dominant_pct: dominantPct,
    },
    provenance: {
      intent: !isQ1Sparse ? ['user_answer:q1'] : [],
      problem: !isQ2Sparse ? ['user_answer:q2'] : [],
      approach: [
        ...(finalApproach.length > 0 ? ['user_answer'] : []),
        ...(onairosTraits ? ['onairos:positive_traits'] : []),
        ...(input.publicFindings?.length || Object.keys(input.socialLinks || {}).some(k => input.socialLinks?.[k]) ? ['public:social'] : []),
      ],
      archetype: ['onairos:persona'],
      positive_traits: ['onairos:positive_traits'],
      user_summary: ['onairos:user_summary'],
      top_traits_explanation: ['onairos:top_traits_explanation'],
      nudges: ['onairos:nudges'],
      current_frontier: !isQ3Sparse ? ['user_answer:q3'] : [],
      contribution: ['user_explicit:offers_needs'],
    },
    public_findings: input.publicFindings,
    status: 'pending_review',
    sharing_consent: false,
  };
}

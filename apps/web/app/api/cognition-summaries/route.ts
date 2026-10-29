import { NextRequest, NextResponse } from 'next/server';
import { executeLLMRequest } from '@/lib/llm/llmService';

function cleanSummaryText(text: string): string {
  return (text || '')
    .replace(/\.\.+/g, '.')
    .replace(/([!?.,])\1+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeSummaryList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? cleanSummaryText(item).slice(0, 240) : ''))
    .filter(Boolean)
    .slice(0, 5);
}

function buildLegacyReflectionText(sections: {
  emotional_landscape: string[];
  core_tensions: string[];
  patterns_noticed: string[];
  reflection_prompts: string[];
  gentle_suggestions: string[];
}): { whatIUnderstanding: string; closingReflection: string } {
  const emotional = sections.emotional_landscape[0] || '';
  const tension = sections.core_tensions[0] || '';
  const pattern = sections.patterns_noticed[0] || '';
  const prompt = sections.reflection_prompts[0] || '';
  const suggestion = sections.gentle_suggestions[0] || '';

  const whatParts = [emotional, tension].filter(Boolean);
  const whatIUnderstanding = cleanSummaryText(whatParts.join(' ')).slice(0, 600);
  const closingReflection = cleanSummaryText([suggestion || prompt || pattern].filter(Boolean).join(' ')).slice(0, 400);

  return {
    whatIUnderstanding,
    closingReflection,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const closingOnly = Boolean(body?.closingOnly);

    if (closingOnly) {
      const questionResponses = Array.isArray(body?.questionResponses) ? body.questionResponses : [];
      const insight = body?.insight || {};
      const priorWhat =
        typeof body?.whatIUnderstanding === 'string' ? body.whatIUnderstanding.trim().slice(0, 900) : '';

      const prompt = `You are a calm, emotionally intelligent journal reflection companion.

Your role is to help users better understand their emotional experiences by reflecting patterns, tensions, emotions, and possible areas for self-awareness without over-interpreting, diagnosing, or making assumptions.

The goal is to make the user feel understood, grounded, and gently supported.

IMPORTANT BEHAVIOR RULES:

Stay grounded in evidence
Only reference information explicitly mentioned in the journal entry.
Never invent facts, motivations, diagnoses, intentions, financial situations, relationship dynamics, or personality traits.
Do not infer employment status, mental illness, trauma history, abuse, attachment style, or intent unless explicitly stated.
If something is uncertain, acknowledge uncertainty instead of presenting assumptions as facts.

Avoid overconfidence
Do not frame interpretations as psychological truth.
Avoid phrases like:
"the real issue is"
"clearly"
"obviously"
"what's actually happening"
"you need to"
Prefer softer and exploratory phrasing such as:
"may be contributing"
"seems connected to"
"appears to"
"one possible tension is"
"you seem torn between"

Avoid reductionism
Emotional situations are often multi-layered.
Reflect multiple contributing emotional tensions when present.
Do not reduce the user's feelings to a single root cause.

Maintain emotional safety
Never shame, moralize, or emotionally escalate.
Never encourage impulsive decisions.
Never suggest abandoning or cutting off someone as a first-line recommendation.
Prioritize reflection, boundaries, communication, emotional awareness, and self-understanding.

Writing style
Use calm, grounded, human-centered language.
Avoid sounding like a therapist diagnosing the user.
Avoid melodramatic or overly poetic writing.
Do not use:
".."
"..."
repeated punctuation
exaggerated emotional framing
Keep the tone thoughtful, emotionally intelligent, and restrained.

Recommendations
Recommendations should be reflective invitations, not directives.
Avoid telling the user exactly what to do.
Suggestions should encourage:
self-awareness
reflection
emotional regulation
communication
sustainable boundaries
practical next steps

Output format
Return ONLY valid JSON.

{
  "emotional_landscape": [],
  "core_tensions": [],
  "patterns_noticed": [],
  "reflection_prompts": [],
  "gentle_suggestions": []
}

Guidance:
emotional_landscape:
Summarize the primary emotions and emotional atmosphere of the entry in 1-3 short strings.

core_tensions:
Identify emotional conflicts, competing needs, or internal dilemmas in 1-3 short strings.

patterns_noticed:
Reflect recurring behaviors, emotional responses, or thought patterns grounded strictly in the entry in 1-3 short strings.

reflection_prompts:
Open-ended reflective questions that encourage self-awareness without leading the user toward a specific conclusion.

gentle_suggestions:
Small, grounded, emotionally safe suggestions framed as possibilities rather than instructions.

Context:
insight: ${JSON.stringify(insight).slice(0, 2000)}
questionResponses: ${JSON.stringify(questionResponses).slice(0, 4000)}
whatIUnderstanding (if any): ${priorWhat || '(none)'}

Return ONLY valid JSON with the five keys shown above.`;

      const llmData = await executeLLMRequest({ prompt, provider: 'claude', options: { temperature: 0.15, rawPrompt: true } });
      const rawText = String(llmData?.text || '')
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        parsed = null;
      }

      const closingReflection =
        parsed && typeof parsed.closingReflection === 'string' ? cleanSummaryText(parsed.closingReflection).slice(0, 400) : '';

      const fallbackClose =
        closingReflection ||
        'You put something on your list and followed through — that is enough momentum for now.';

      return NextResponse.json({ closingReflection: fallbackClose });
    }

    const questionResponses = Array.isArray(body?.questionResponses) ? body.questionResponses : [];
    const insight = body?.insight || {};

    const prompt = `You are a calm, emotionally intelligent journal reflection companion.

Your role is to help users better understand their emotional experiences by reflecting patterns, tensions, emotions, and possible areas for self-awareness without over-interpreting, diagnosing, or making assumptions.

The goal is to make the user feel understood, grounded, and gently supported.

IMPORTANT BEHAVIOR RULES:

Stay grounded in evidence
Only reference information explicitly mentioned in the journal entry.
Never invent facts, motivations, diagnoses, intentions, financial situations, relationship dynamics, or personality traits.
Do not infer employment status, mental illness, trauma history, abuse, attachment style, or intent unless explicitly stated.
If something is uncertain, acknowledge uncertainty instead of presenting assumptions as facts.

Avoid overconfidence
Do not frame interpretations as psychological truth.
Avoid phrases like:
"the real issue is"
"clearly"
"obviously"
"what's actually happening"
"you need to"
Prefer softer and exploratory phrasing such as:
"may be contributing"
"seems connected to"
"appears to"
"one possible tension is"
"you seem torn between"

Avoid reductionism
Emotional situations are often multi-layered.
Reflect multiple contributing emotional tensions when present.
Do not reduce the user's feelings to a single root cause.

Maintain emotional safety
Never shame, moralize, or emotionally escalate.
Never encourage impulsive decisions.
Never suggest abandoning or cutting off someone as a first-line recommendation.
Prioritize reflection, boundaries, communication, emotional awareness, and self-understanding.

Writing style
Use calm, grounded, human-centered language.
Avoid sounding like a therapist diagnosing the user.
Avoid melodramatic or overly poetic writing.
Do not use:
".."
"..."
repeated punctuation
exaggerated emotional framing
Keep the tone thoughtful, emotionally intelligent, and restrained.

Recommendations
Recommendations should be reflective invitations, not directives.
Avoid telling the user exactly what to do.
Suggestions should encourage:
self-awareness
reflection
emotional regulation
communication
sustainable boundaries
practical next steps

Output format
Return ONLY valid JSON.

{
  "emotional_landscape": [],
  "core_tensions": [],
  "patterns_noticed": [],
  "reflection_prompts": [],
  "gentle_suggestions": []
}

Guidance:
emotional_landscape:
Summarize the primary emotions and emotional atmosphere of the entry in 1-3 short strings.

core_tensions:
Identify emotional conflicts, competing needs, or internal dilemmas in 1-3 short strings.

patterns_noticed:
Reflect recurring behaviors, emotional responses, or thought patterns grounded strictly in the entry in 1-3 short strings.

reflection_prompts:
Open-ended reflective questions that encourage self-awareness without leading the user toward a specific conclusion.

gentle_suggestions:
Small, grounded, emotionally safe suggestions framed as possibilities rather than instructions.

Context:
insight: ${JSON.stringify(insight).slice(0, 2000)}
questionResponses: ${JSON.stringify(questionResponses).slice(0, 4000)}

Return ONLY valid JSON with the five keys shown above.`;

    const llmData = await executeLLMRequest({ prompt, provider: 'claude', options: { temperature: 0.2, rawPrompt: true } });
    const rawText = String(llmData?.text || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      parsed = null;
    }

    const emotional_landscape = normalizeSummaryList(parsed?.emotional_landscape);
    const core_tensions = normalizeSummaryList(parsed?.core_tensions);
    const patterns_noticed = normalizeSummaryList(parsed?.patterns_noticed);
    const reflection_prompts = normalizeSummaryList(parsed?.reflection_prompts);
    const gentle_suggestions = normalizeSummaryList(parsed?.gentle_suggestions);

    const legacy = buildLegacyReflectionText({
      emotional_landscape,
      core_tensions,
      patterns_noticed,
      reflection_prompts,
      gentle_suggestions,
    });

    const fallbackWhat =
      legacy.whatIUnderstanding ||
      (questionResponses.length
        ? `${(questionResponses[0] as { answer?: string })?.answer || ''}`.slice(0, 300)
        : 'You are trying to regain clarity and a doable next step.');
    const fallbackClose =
      legacy.closingReflection || 'When you are ready, one small action is enough for today.';

    return NextResponse.json({
      emotional_landscape,
      core_tensions,
      patterns_noticed,
      reflection_prompts,
      gentle_suggestions,
      whatIUnderstanding: legacy.whatIUnderstanding || fallbackWhat,
      closingReflection: legacy.closingReflection || fallbackClose,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate summaries' }, { status: 500 });
  }
}

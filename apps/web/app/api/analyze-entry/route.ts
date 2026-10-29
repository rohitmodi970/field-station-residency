import { NextRequest, NextResponse } from 'next/server';
import { executeLLMRequest } from '@/lib/llm/llmService';

type Mode = 'planning' | 'communication' | 'decision' | 'execution' | 'reset';

type LifeArea = 'work' | 'relationship' | 'family' | 'self' | 'health';

type Insight = {
  core: string;
  tension: string;
};

type Question = {
  id: string;
  question: string;
};

type AnalyzeEntryResponse = {
  insight: Insight;
  questions: Question[];
  mode: Mode;
  lifeAreas: LifeArea[];
  summary?: string;
};

function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && ['planning', 'communication', 'decision', 'execution', 'reset'].includes(value);
}

function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32) || 'question';
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Avoid mid-sentence cuts from a hard character cap — prefer a full clause or word boundary. */
function truncateQuestionForDisplay(raw: string, softMax = 200, hardMax = 280): string {
  const q = raw.trim();
  if (q.length <= softMax) return q;

  const slice = q.slice(0, hardMax);
  const punctIdx = Math.max(
    slice.lastIndexOf('.'),
    slice.lastIndexOf('?'),
    slice.lastIndexOf('!')
  );
  if (punctIdx >= 48) {
    return slice.slice(0, punctIdx + 1).trim();
  }

  const lastSpace = slice.lastIndexOf(' ', softMax);
  if (lastSpace > 48) {
    return `${slice.slice(0, lastSpace).trim()}…`;
  }

  return `${slice.trim()}…`;
}

function normalizeQuestion(value: unknown, fallbackId: string): Question | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const question = typeof item.question === 'string' ? item.question.trim() : '';
  if (!question) return null;

  const rawId = typeof item.id === 'string' ? item.id : fallbackId;
  return { id: sanitizeId(rawId), question: truncateQuestionForDisplay(question) };
}

function validateAndNormalizeQuestions(value: unknown): Question[] {
  if (!Array.isArray(value)) return [];

  const normalized: Question[] = [];
  const seenIds = new Set<string>();

  value.forEach((raw, index) => {
    const normalizedQuestion = normalizeQuestion(raw, `q${index + 1}`);
    if (!normalizedQuestion) return;

    let id = normalizedQuestion.id;
    if (seenIds.has(id)) {
      let suffix = 2;
      while (seenIds.has(`${id}_${suffix}`)) suffix += 1;
      id = `${id}_${suffix}`;
    }
    seenIds.add(id);

    normalized.push({ id, question: normalizedQuestion.question });
  });

  return normalized.slice(0, 4);
}

function getQuestionPayload(parsed: Record<string, unknown>): unknown {
  if (Array.isArray(parsed.questions)) return parsed.questions;

  const nestedCandidates = [parsed.output, parsed.data, parsed.result, parsed.payload];
  for (const candidate of nestedCandidates) {
    if (candidate && typeof candidate === 'object') {
      const nested = candidate as Record<string, unknown>;
      if (Array.isArray(nested.questions)) {
        return nested.questions;
      }
    }
  }

  return undefined;
}

function classifyMode(entry: string): Mode {
  const text = normalize(entry);
  if (!text) return 'planning';

  const communicationSignals = [
    'friend',
    'talk',
    'conversation',
    'argument',
    'fight',
    'issue with',
    'misunderstanding',
    'say to',
    'text them',
    'call them',
    'wedding',
    'relationship',
  ];

  const planningSignals = [
    'deadline',
    'plan',
    'schedule',
    'apply',
    'application',
    'submission',
    'prepare',
    'project',
    'organize',
    'trip',
    'event',
    'wedding',
    'todo',
  ];

  const hasCommunicationSignal = communicationSignals.some((token) => text.includes(token));
  const hasPlanningSignal = planningSignals.some((token) => text.includes(token));

  if (hasCommunicationSignal && !hasPlanningSignal) {
    return 'communication';
  }

  if (text.includes('issue with') || text.includes('problem with friend') || text.includes('fight')) {
    return 'communication';
  }

  return 'planning';
}

function extractTopic(entry: string): string {
  const text = normalize(entry);
  const words = text.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const useful = words.filter((word) => !['the', 'and', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'with', 'my', 'your', 'our', 'this', 'that', 'it', 'is', 'are', 'was', 'were', 'be'].includes(word));
  return useful.slice(0, 5).join(' ') || 'this situation';
}

function detectLifeAreas(entry: string): LifeArea[] {
  const text = normalize(entry);
  const areas: LifeArea[] = [];

  if (/\b(work|job|boss|colleague|project|deadline|meeting|promotion|team|client|career|office|meetings|projects)\b/.test(text)) {
    areas.push('work');
  }
  if (/\b(partner|girlfriend|boyfriend|spouse|marriage|romantic|date|dating|crush|love|relationship)\b/.test(text)) {
    areas.push('relationship');
  }
  const familyWords = [
    'mom',
    'dad',
    'mother',
    'father',
    'parent',
    'parents',
    'family',
    'sibling',
    'brother',
    'sister',
    'cousin',
    'grandparent',
    'grandmother',
    'grandfather',
    'kid',
    'kids',
    'child',
    'children',
    'son',
    'daughter',
  ];
  const familyHits = familyWords.filter((w) => new RegExp(`\\b${w}\\b`).test(text)).length;
  if (familyHits >= 2 || /\b(my|our)\s+(family|parent|parents|mom|dad|mother|father)\b/.test(text)) {
    areas.push('family');
  }
  if (/\b(feel|emotion|mind|identity|confidence|purpose|meaning|growth|learning|skill|hobby|passion|thinking|beliefs)\b/.test(text)) {
    areas.push('self');
  }
  if (/\b(health|exercise|sleep|fitness|diet|food|weight|doctor|illness|sick|tired|energy|stress|anxiety|depression|workout)\b/.test(text)) {
    areas.push('health');
  }

  return [...new Set(areas)];
}

function buildFallbackQuestions(entry: string, mode: Mode): Question[] {
  const topic = extractTopic(entry);
  const modeQuestions = mode === 'communication'
    ? [
        `What's the core request or boundary you need to express about ${topic}?`,
        'What fear or resistance are you anticipating from them?',
        'What does a successful outcome look like in concrete terms?',
      ]
    : [
        `What's your desired outcome for ${topic}?`,
        'What is the single biggest obstacle right now?',
        'What is one action you can take in the next 24 hours?',
      ];

  return modeQuestions.slice(0, 4).map((question, index) => ({ id: `q${index + 1}`, question }));
}

function fallbackEngine(entry: string): AnalyzeEntryResponse {
  const mode = classifyMode(entry);
  const insight: Insight = {
    core: `You are facing ${extractTopic(entry)} and need a clear next step.`,
    tension: mode === 'communication'
      ? 'The conversation is unclear.'
      : 'Too many things at once.',
  };
  const lifeAreas = detectLifeAreas(entry);
  const topic = extractTopic(entry);
  const summary = mode === 'communication'
    ? `This entry centers on ${topic} and involves unclear communication; it could help to name the request and next step.`
    : `This entry is focused on ${topic} with several competing demands; a small, concrete next step would help move things forward.`;

  return { insight, questions: buildFallbackQuestions(entry, mode), mode, lifeAreas, summary };
}

async function runLLMEngine(request: NextRequest, entry: string): Promise<AnalyzeEntryResponse> {
  // Generate insight from LLM only; questions are deterministic and derived from entry + insight.
  const mode = classifyMode(entry);
  const topic = extractTopic(entry);
  const lifeAreas = detectLifeAreas(entry);
  const prompt = `You are analyzing a journal entry for a high-performance cognition engine whose job is to help users think clearly, feel seen, and move forward with calm clarity.

Your job:
- Help the user understand what's actually happening (reality)
- Reflect their role in it without judgment (ownership)
- Clarify what they actually want (decision)
- Identify what's blocking action (constraint)

Context:
- Topic: ${topic}
- Mode: ${mode}
- Life areas: ${lifeAreas.length > 0 ? lifeAreas.join(', ') : 'none detected'}

Entry (first 5000 chars):
"""
${entry.slice(0, 5000)}
"""

Return ONLY valid JSON with NO markdown, code fences, or extra text. Shape:
{
  "insight": {
    "core": "A 2-4 sentence reflection on what's happening. Use reflective phrasing: 'It seems like...', 'You might be...', 'This pattern could be...' Avoid accusatory language. Make the user feel seen, not judged.",
    "tension": "One short phrase naming the central conflict or friction"
  },
  "summary": "2-3 sentence synthesis of the entry (optional)",
  "questions": [
    { "id": "q1_reality", "question": "Clear question about what's actually happening (complete sentence, ~220 chars max)", "priority": 1 },
    { "id": "q2_ownership", "question": "What's your role in this? (complete sentence, ~220 chars max)", "priority": 2 },
    { "id": "q3_decision", "question": "What do you actually want? (complete sentence, ~220 chars max)", "priority": 3 },
    { "id": "q4_constraint", "question": "What's blocking action? (complete sentence, ~220 chars max)", "priority": 4 }
  ]
}

Tone Rules:
- Reflective: "It seems like...", "You might be...", "This pattern could be..."
- Calm: Avoid urgency or pressure
- Honest: Name the real situation without softening
- Supportive: Like a good friend, not a critic
- Avoid: Accusatory language, absolute claims ("you are sabotaging"), assumptions about the user's life

Question Rules:
- Follow flow: Reality → Ownership → Decision → Constraint (adapt if needed)
- Each must lead to an actionable answer
- Keep them short, practical, specific to this entry
- No therapeutic jargon or abstraction

Return only JSON. No explanation.
`;

  const llmData = await executeLLMRequest({
    prompt,
    provider: 'claude',
    options: { temperature: 0.2, rawPrompt: true },
  });
  const rawText = String(llmData?.text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(rawText) as Record<string, unknown>;
  } catch (parseError) {
    console.warn('[analyze-entry] JSON parse failed for insight. Raw LLM text:', rawText);
    parsed = null;
  }

  const rawInsight = parsed && (parsed as Record<string, unknown>).insight && typeof (parsed as Record<string, unknown>).insight === 'object'
    ? (parsed as Record<string, unknown>).insight as Record<string, unknown>
    : {};

  const core = typeof rawInsight.core === 'string' && rawInsight.core.trim()
    ? rawInsight.core.trim().slice(0, 600)
    : fallbackEngine(entry).insight.core;
  const tension = typeof rawInsight.tension === 'string' && rawInsight.tension.trim()
    ? rawInsight.tension.trim().slice(0, 300)
    : fallbackEngine(entry).insight.tension;

  const rawSummary = parsed && typeof (parsed as Record<string, unknown>).summary === 'string'
    ? String((parsed as Record<string, unknown>).summary).trim()
    : '';
  const summary = rawSummary ? rawSummary.slice(0, 800) : '';

  // Try to extract questions returned by the LLM. If none or malformed, fall back to deterministic questions.
  const potentialQuestions = getQuestionPayload(parsed as Record<string, unknown>);
  let questions = validateAndNormalizeQuestions(potentialQuestions);

  if (!questions || questions.length === 0) {
    // Deterministically generate up to 4 fixed question types referencing the user's context as a safe fallback.
    function generateFixedQuestions(entryText: string): Question[] {
      const topic = extractTopic(entryText);
      const q: Question[] = [];

      q.push({ id: 'q1_reality', question: `In one sentence, state plainly what's happening with ${topic} right now.` });
      q.push({ id: 'q2_ownership', question: `What did you do or not do that has shaped this situation?` });
      q.push({ id: 'q3_decision', question: `Exactly what outcome do you want for ${topic} in the next 7 days?` });
      q.push({ id: 'q4_constraint', question: `What's the single constraint or habit you're avoiding that's stopping progress?` });

      return q.slice(0, 4);
    }

    questions = generateFixedQuestions(entry);
  }

  return {
    mode,
    insight: {
      core,
      tension,
    },
    questions,
    lifeAreas,
    summary,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const entry = typeof body?.entry === 'string' ? body.entry.trim() : '';

    if (!entry) {
      return NextResponse.json({ error: 'entry is required' }, { status: 400 });
    }

    try {
      const llmResult = await runLLMEngine(request, entry);
      return NextResponse.json(llmResult);
    } catch (llmError) {
      console.warn('[analyze-entry] LLM engine failed; using fallback:', llmError);
      return NextResponse.json(fallbackEngine(entry));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to analyze entry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

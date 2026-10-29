import { NextRequest, NextResponse } from 'next/server';
import { executeLLMRequest } from '@/lib/llm/llmService';

type Mode = 'planning' | 'communication' | 'decision' | 'execution' | 'reset';

type QuestionResponse = {
  id: string;
  question: string;
  answer: string;
};

export type GeneratedTask = {
  title: string;
  description?: string;
  subtasks: string[];
  estimated_time: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  suggested_deadline?: string;
  allocation?: 'focus_today' | 'also_today' | 'space_for_later';
  reasoning?: string;
};

type AnalyzeInsight = {
  core: string;
  tension: string;
};

type RebalanceInput = {
  rebalanceChoice?: 'reset' | 'move' | 'reach_out' | 'sit_with';
  rebalanceNotes?: string;
  whatIUnderstanding?: string;
  whereYourMindGoing?: string;
  closingReflection?: string;
};

function normalizeList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function parseSubtasks(raw?: string): string[] {
  if (!raw) return [];
  const segments = raw
    .split(/,|\n|;|\band\b/gi)
    .map((item) => item.trim())
    .filter(Boolean);

  if (segments.length === 0) return [];
  return segments.slice(0, 5);
}

function buildDefaultDeadline(offsetHours: number): string {
  const date = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  return date.toISOString();
}

function cleanTruncate(text: string, softMax = 180, hardMax = 260): string {
  const trimmed = text.trim();
  if (trimmed.length <= softMax) return trimmed;

  const slice = trimmed.slice(0, hardMax);
  const punctIdx = Math.max(
    slice.lastIndexOf('.'),
    slice.lastIndexOf('?'),
    slice.lastIndexOf('!'),
    slice.lastIndexOf(';')
  );
  if (punctIdx >= softMax * 0.6) {
    return slice.slice(0, punctIdx + 1).trim();
  }

  const lastSpace = slice.lastIndexOf(' ', softMax);
  if (lastSpace > softMax * 0.5) {
    return `${slice.slice(0, lastSpace).trim()}...`;
  }

  return `${slice.trim()}...`;
}

function cleanEstimatedTime(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '20m';
  const trimmed = value.trim();
  if (trimmed.length <= 40) return trimmed;
  const match = trimmed.match(/^([0-9]+\s*(?:m|min|mins|minutes|h|hr|hrs|hours)(?:\s*(?:per|\/)\s*[\w\s-]+)?)/i);
  if (match && match[1]) return match[1].trim();
  return cleanTruncate(trimmed, 35, 45);
}

function directTasksFromResponses(questionResponses: QuestionResponse[], priority: string | undefined): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];

  questionResponses.forEach((item, index) => {
    const answer = item.answer.trim();
    if (!answer) return;

    const taskTitle = answer.length <= 140 ? answer : cleanTruncate(answer, 140, 180);
    const subtasks = parseSubtasks(answer);

    const isFirst = index === 0;
    tasks.push({
      title: taskTitle,
      description: `Actionable step drawn from your reflection: "${cleanTruncate(answer, 240, 320)}"`,
      subtasks: subtasks.length > 0 ? subtasks : [answer],
      estimated_time: isFirst ? '20m' : '15m',
      priority: isFirst ? 'high' : index === 1 ? 'medium' : 'low',
      category: 'Personal',
      suggested_deadline: buildDefaultDeadline(isFirst ? 4 : 24 * index),
      allocation: isFirst ? 'focus_today' : index === 1 ? 'also_today' : 'space_for_later',
      reasoning: 'Derived directly from user reflection answers.',
    });
  });

  if (tasks.length === 0) {
    return [
      {
        title: 'Turn reflections into one grounded action',
        description: 'Take a moment to define the single most impactful next step from your current thoughts.',
        subtasks: ['Write down the clearest immediate next step', 'Schedule 15 minutes to complete it'],
        estimated_time: '15m',
        priority: 'medium',
        category: 'Personal',
        suggested_deadline: buildDefaultDeadline(6),
        allocation: 'focus_today',
        reasoning: 'Default starting task.',
      },
    ];
  }

  return tasks.slice(0, 6);
}

function normalizeTaskPriority(value: unknown): GeneratedTask['priority'] {
  if (value === 'high' || value === 'low' || value === 'medium') return value as GeneratedTask['priority'];
  return 'medium';
}

function normalizeAllocation(value: unknown): GeneratedTask['allocation'] {
  if (value === 'focus_today' || value === 'also_today' || value === 'space_for_later') {
    return value as GeneratedTask['allocation'];
  }
  return undefined;
}

function normalizeCategory(value: unknown, mode: Mode): string {
  const known = ['Work', 'Personal', 'Health', 'Career', 'Finance', 'Learning', 'Reflection', 'Relationship', 'Admin'];
  if (typeof value === 'string' && value.trim()) {
    const matched = known.find((k) => k.toLowerCase() === value.trim().toLowerCase());
    if (matched) return matched;
    return value.trim();
  }
  if (mode === 'communication') return 'Relationship';
  if (mode === 'reset') return 'Health';
  if (mode === 'planning' || mode === 'execution') return 'Work';
  return 'Personal';
}

function normalizeTaskOutput(items: unknown, mode: Mode): GeneratedTask[] {
  if (!Array.isArray(items)) return [];
  const normalized: GeneratedTask[] = [];
  const now = Date.now();

  for (let idx = 0; idx < items.length; idx++) {
    const raw = items[idx];
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    if (!title) continue;

    const subtasks = Array.isArray(item.subtasks)
      ? item.subtasks
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean)
          .slice(0, 6)
      : [];

    const description = typeof item.description === 'string' && item.description.trim()
      ? item.description.trim()
      : subtasks.length > 0
      ? subtasks.join(' | ')
      : `Step forward on ${title}`;

    let suggestedDeadline: string | undefined = undefined;
    if (typeof item.suggested_deadline === 'string' && item.suggested_deadline.trim()) {
      const d = new Date(item.suggested_deadline.trim());
      if (!Number.isNaN(d.getTime())) {
        suggestedDeadline = d.toISOString();
      }
    }
    if (!suggestedDeadline) {
      const hoursOffset = idx === 0 ? 4 : idx <= 2 ? 24 : 48;
      suggestedDeadline = new Date(now + hoursOffset * 60 * 60 * 1000).toISOString();
    }

    normalized.push({
      title: title.length <= 180 ? title : cleanTruncate(title, 180, 260),
      description: description.length <= 700 ? description : cleanTruncate(description, 600, 800),
      subtasks: subtasks.length > 0 ? subtasks : ['Define a clear first action'],
      estimated_time: cleanEstimatedTime(item.estimated_time),
      priority: normalizeTaskPriority(item.priority),
      category: normalizeCategory(item.category, mode),
      suggested_deadline: suggestedDeadline,
      allocation: normalizeAllocation(item.allocation) || (idx === 0 ? 'focus_today' : idx <= 2 ? 'also_today' : 'space_for_later'),
      reasoning: typeof item.reasoning === 'string'
        ? (item.reasoning.trim().length <= 300 ? item.reasoning.trim() : cleanTruncate(item.reasoning, 250, 350))
        : undefined,
    });
  }

  return normalized.slice(0, 8);
}

async function llmGenerateTasks(params: {
  request: NextRequest;
  mode: Mode;
  questionResponses: QuestionResponse[];
  insight?: AnalyzeInsight;
  rebalance?: RebalanceInput;
}): Promise<GeneratedTask[]> {
  const { request, mode, questionResponses, insight, rebalance } = params;
  const rebalanceDetails = rebalance || {};
  const rebalanceChoice = rebalanceDetails.rebalanceChoice || 'none';
  const rebalanceNotes = typeof rebalanceDetails.rebalanceNotes === 'string' ? rebalanceDetails.rebalanceNotes.trim() : '';
  const whatIUnderstanding = typeof rebalanceDetails.whatIUnderstanding === 'string' ? rebalanceDetails.whatIUnderstanding.trim() : '';
  const whereYourMindGoing = typeof rebalanceDetails.whereYourMindGoing === 'string' ? rebalanceDetails.whereYourMindGoing.trim() : '';
  const closingReflection = typeof rebalanceDetails.closingReflection === 'string' ? rebalanceDetails.closingReflection.trim() : '';
  
  const extraContext = [
    whatIUnderstanding ? `What I'm understanding: ${whatIUnderstanding}` : '',
    whereYourMindGoing ? `Where your mind is going: ${whereYourMindGoing}` : '',
    rebalanceChoice !== 'none' ? `Rebalance choice: ${rebalanceChoice}` : '',
    rebalanceNotes ? `Rebalance notes: ${rebalanceNotes}` : '',
    closingReflection ? `Closing reflection: ${closingReflection}` : '',
  ].filter(Boolean).join('\n');

  const nowIso = new Date().toISOString();
  const todayDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  const prompt = `You are a high-performance Cognition Engine task synthesizer powered by Claude. Your role is to convert a user's raw reflections, tensions, and journal insights into exceptionally clear, intelligent, and grounded tasks.

Current reference time: ${nowIso} (${todayDateStr})
Cognition Mode: ${mode}

Core Insight: ${insight?.core || '(none)'}
Tension: ${insight?.tension || '(none)'}

User reflection answers:
${questionResponses.map((q) => `Q: ${q.question}\nA: ${q.answer}`).join('\n\n')}

Cognition engine synthesis & rebalance notes:
${extraContext || '(none)'}

TASK SYNTHESIS REQUIREMENTS:
1. **Action-Oriented Titles**: 3 to 10 words. Direct, vivid, punchy, and specific. NEVER pack long run-on sentences, multi-part clauses, or numbered lists into the title. Keep the title concise (e.g. "Schedule 15-minute sync with team on start times"). Put extra context into 'description' and concrete steps into 'subtasks'.
2. **Rich, Empathetic Descriptions**: 1-2 articulate, complete sentences describing WHY this step matters right now and HOW to approach it calmly. Complete full thoughts without cutting off.
3. **Tactical Substeps**: 2 to 4 concrete, actionable micro-steps.
4. **Estimated Time**: Realistic duration string (e.g. "15m", "30m", "45m", "1h", "2h", or "10m/day"). Always use complete words, never leave hanging abbreviations or incomplete phrases.
5. **Smart Realistic Deadlines**:
   - For grounding / immediate reset tasks: today EOD (e.g. today 9:00 PM ISO).
   - For preparation / key communication / next-step tasks: tomorrow morning or afternoon (e.g. tomorrow 11:00 AM ISO).
   - For broader project / planning / reflection tasks: 2 to 4 days out.
   - Output valid ISO string for \`suggested_deadline\`.
6. **Intelligent Categorization**: Pick the best category: Work, Personal, Health, Career, Finance, Learning, Reflection, Relationship, Admin.
7. **Smart Priority**: "high" (the core blocker or relief point), "medium" (steady progression), or "low" (easy win / parked reflection).
8. **Task Allocation**:
   - Exactly ONE task should be \`allocation: "focus_today"\` (the primary focus).
   - 1-2 tasks as \`allocation: "also_today"\` (quick wins or immediate follow-ups).
   - Remaining tasks as \`allocation: "space_for_later"\` (longer horizon or reflection).

Return ONLY a valid JSON object:
{
  "tasks": [
    {
      "title": "Clear action title",
      "description": "Articulate explanation of why and how to execute this.",
      "subtasks": ["Step 1", "Step 2", "Step 3"],
      "estimated_time": "15m|30m|45m|1h|2h",
      "priority": "high|medium|low",
      "category": "Work|Personal|Health|Career|Finance|Learning|Reflection|Relationship|Admin",
      "suggested_deadline": "${nowIso}",
      "allocation": "focus_today|also_today|space_for_later",
      "reasoning": "Why this task is prioritized this way."
    }
  ]
}

Generate 2 to 4 distinct, high-impact tasks. Quality, clarity, and realism are essential.`;

  const llmData = await executeLLMRequest({
    prompt,
    provider: 'claude',
    options: { temperature: 0.2, rawPrompt: true },
  });

  const rawText = String(llmData?.text || '').trim();

  function tryExtractJson(text: string): unknown | null {
    let t = text.replace(/^```\w*/i, '').replace(/```$/i, '').trim();

    try {
      return JSON.parse(t);
    } catch (_) {}

    const firstBrace = t.indexOf('{');
    const lastBrace = t.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = t.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (_) {}
    }

    const firstBracket = t.indexOf('[');
    const lastBracket = t.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const candidate = t.slice(firstBracket, lastBracket + 1);
      try {
        return JSON.parse(candidate);
      } catch (_) {}
    }

    const tasksMatch = t.match(/"tasks"\s*:\s*(\[.*\])$/s);
    if (tasksMatch && tasksMatch[1]) {
      try {
        return JSON.parse(`{ "tasks": ${tasksMatch[1]} }`);
      } catch (_) {}
    }

    return null;
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = tryExtractJson(rawText) as Record<string, unknown> | null;
  } catch (err) {
    parsed = null;
  }

  if (!parsed) {
    console.error('[generate-tasks] Failed to parse LLM response. Raw output:', rawText);
    return directTasksFromResponses(questionResponses, 'medium');
  }

  const tasks = normalizeTaskOutput((parsed as any).tasks, mode);
  return tasks.length > 0 ? tasks : directTasksFromResponses(questionResponses, 'medium');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const mode = (body?.mode || 'planning') as Mode;
    const insight = body?.insight as AnalyzeInsight | undefined;
    const priority = typeof body?.priority === 'string' ? body.priority : undefined;
    const rebalance: RebalanceInput = {
      rebalanceChoice: typeof body?.rebalanceChoice === 'string' ? body.rebalanceChoice : undefined,
      rebalanceNotes: typeof body?.rebalanceNotes === 'string' ? body.rebalanceNotes : undefined,
      whatIUnderstanding: typeof body?.whatIUnderstanding === 'string' ? body.whatIUnderstanding : undefined,
      whereYourMindGoing: typeof body?.whereYourMindGoing === 'string' ? body.whereYourMindGoing : undefined,
      closingReflection: typeof body?.closingReflection === 'string' ? body.closingReflection : undefined,
    };
    const questionResponses = Array.isArray(body?.questionResponses)
      ? body.questionResponses as QuestionResponse[]
      : [];

    let tasks: GeneratedTask[] = [];
    try {
      tasks = await llmGenerateTasks({ request, mode, questionResponses, insight, rebalance });
    } catch (llmError) {
      console.warn('[generate-tasks] LLM generation failed; falling back to direct extraction:', llmError);
      tasks = directTasksFromResponses(questionResponses, priority);
    }

    return NextResponse.json({ tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate tasks';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

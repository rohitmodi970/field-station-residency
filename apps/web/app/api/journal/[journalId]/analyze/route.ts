// apps/web/app/api/journal/[journalId]/analyze/route.ts
// Runs LLM analysis on a single journal entry (client sends decrypted text)
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSingleEntryAnalysisType, SingleEntryAnalysisType } from '@/types/analysis.contract';
import { notificationService } from '@/utils/notifications/notificationService';
import { reminderScheduler } from '@/utils/notifications/reminderScheduler';
import { formatVektoriContext, searchVektoriMemory } from '@/utils/vektori/client';
import { forceMemoryService } from '@/lib/force-agent';

type TaskCandidate = {
  title: string;
  description?: string;
  due_at?: string | null;
  reminder_at?: string | null;
  priority?: 'high' | 'medium' | 'low';
  category?: 'health' | 'productivity' | 'social' | 'wellbeing';
  should_autocreate?: boolean;
  impact?: number;
  urgency?: number;
  effort?: number;
  type?: 'execution' | 'decision';
};

type AnalysisPayload = {
  recommendations?: Array<{ area?: string; suggestion?: string; rationale?: string }>;
  taskCandidates?: TaskCandidate[];
};
// Note: This endpoint is designed to be called after decrypting journal entry content on the client side, so it expects plaintext input and does not perform any decryption itself.
type NormalizedTaskCandidate = {
  title: string;
  description: string | null;
  dueAtIso: string | null;
  reminderAtIso: string | null;
  priority: 'high' | 'medium' | 'low';
  category: 'health' | 'productivity' | 'social' | 'wellbeing';
  impact: number;
  urgency: number;
  effort: number;
  type: 'execution' | 'decision';
};

const ALLOW_AUTO_CREATE_TODOS = process.env.ALLOW_AUTO_CREATE_TODOS === 'true';

function shouldCreateStandaloneReminder(candidate: NormalizedTaskCandidate): boolean {
  const text = `${candidate.title} ${candidate.description || ''}`;
  return isReminderLikeText(text) && Boolean(candidate.reminderAtIso || candidate.dueAtIso);
}

function normalizeCategory(input?: string): 'health' | 'productivity' | 'social' | 'wellbeing' {
  const value = (input || '').toLowerCase();
  if (value.includes('health') || value.includes('medicine') || value.includes('med')) return 'health';
  if (value.includes('work') || value.includes('focus') || value.includes('product')) return 'productivity';
  if (value.includes('social') || value.includes('relationship') || value.includes('meeting')) return 'social';
  return 'wellbeing';
}

function parseIsoOrNull(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeTaskTitleForDedupe(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toMinuteIsoOrNull(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setSeconds(0, 0);
  return date.toISOString();
}

function buildTaskDedupeKey(title: string, dueAt: string | null): string {
  const normalizedTitle = normalizeTaskTitleForDedupe(title);
  const dueMinute = toMinuteIsoOrNull(dueAt);
  return `${normalizedTitle}::${dueMinute || 'no_due'}`;
}

function isReminderLikeText(text: string): boolean {
  const hay = text.toLowerCase();
  return [
    'remind',
    'reminder',
    'alarm',
    'notify',
    'med',
    'medicine',
    'medication',
    'pill',
    'tablet',
    'supplement',
    'doctor',
    'appointment',
    'meeting',
    'call',
    'deadline',
    'due',
    'submit',
    'follow up',
    'renew',
    'payment',
    'bill',
    'interview',
    'exam',
    'event',
  ].some((token) => hay.includes(token));
}

function isLikelyDailyTaskText(text: string): boolean {
  const hay = text.toLowerCase();
  return [
    'daily',
    'every day',
    'everyday',
    'each day',
    'every morning',
    'every evening',
    'nightly',
    'med',
    'medicine',
    'medication',
    'pill',
    'dose',
  ].some((token) => hay.includes(token));
}

function rollForwardDailyIso(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  while (date.getTime() <= Date.now()) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString();
}

function inferNextIsoFromTimeText(text: string): string | null {
  const lower = text.toLowerCase();

  const twelveHour = lower.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (twelveHour) {
    const hourRaw = Number.parseInt(twelveHour[1] || '0', 10);
    const minuteRaw = Number.parseInt(twelveHour[2] || '0', 10);
    const meridiem = (twelveHour[3] || '').toLowerCase();

    if (hourRaw >= 1 && hourRaw <= 12 && minuteRaw >= 0 && minuteRaw <= 59) {
      let hour24 = hourRaw % 12;
      if (meridiem === 'pm') hour24 += 12;

      const now = new Date();
      const next = new Date(now);
      next.setHours(hour24, minuteRaw, 0, 0);
      if (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 1);
      }
      return next.toISOString();
    }
  }

  const twentyFourHour = lower.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFourHour) {
    const hour24 = Number.parseInt(twentyFourHour[1] || '0', 10);
    const minuteRaw = Number.parseInt(twentyFourHour[2] || '0', 10);
    if (hour24 >= 0 && hour24 <= 23 && minuteRaw >= 0 && minuteRaw <= 59) {
      const now = new Date();
      const next = new Date(now);
      next.setHours(hour24, minuteRaw, 0, 0);
      if (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 1);
      }
      return next.toISOString();
    }
  }

  return null;
}

function clampScoreDimension(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 3;
  return Math.min(5, Math.max(1, Math.round(value)));
}

function scoreTask(task: { impact?: number; urgency?: number; effort?: number }): number {
  const impact = task.impact ?? 3;
  const urgency = task.urgency ?? 3;
  const effort = task.effort ?? 3;

  const safeEffort = effort <= 0 ? 1 : effort;
  return (impact * urgency) / safeEffort;
}

async function autoCreateReminderArtifacts(params: {
  adminClient: any;
  userId: string;
  journalInternalId: string;
  analysis: AnalysisPayload;
}) {
  const { adminClient, userId, journalInternalId, analysis } = params;
  const rawCandidates = Array.isArray(analysis.taskCandidates)
    ? analysis.taskCandidates
    : [];

  const recommendationFallbacks: TaskCandidate[] = Array.isArray(analysis.recommendations)
    ? analysis.recommendations
      .map((rec) => {
        const now = new Date();
        const fallbackDue = new Date(now);
        fallbackDue.setHours(20, 0, 0, 0);
        if (fallbackDue <= now) fallbackDue.setDate(fallbackDue.getDate() + 1);

        const fallbackReminder = new Date(fallbackDue);
        fallbackReminder.setMinutes(fallbackReminder.getMinutes() - 30);

        return {
          title: rec.suggestion || '',
          description: rec.rationale || 'Reminder generated from your Story Lens analysis.',
          due_at: fallbackDue.toISOString(),
          reminder_at: fallbackReminder.toISOString(),
          priority: 'high',
          category: normalizeCategory(rec.area),
          should_autocreate: true,
          impact: 3,
          urgency: 3,
          effort: 3,
          type: 'execution',
        };
      })
    : [];

  const candidates = [...rawCandidates, ...recommendationFallbacks]
    .filter((c) => c.title)
    .filter((c) => c.should_autocreate !== false);

  if (candidates.length === 0) {
    return {
      createdCount: 0,
      primaryTodoId: null as string | null,
      primaryTitle: null as string | null,
      secondaryCount: 0,
    };
  }

  const nowTs = Date.now();
  const normalizedCandidates = candidates
    .map((candidate) => {
      const title = candidate.title.trim();
      if (!title) return null;

      const dueAtIso = parseIsoOrNull(candidate.due_at);
      let reminderAtIso = parseIsoOrNull(candidate.reminder_at);
      const candidateText = `${title} ${candidate.description || ''}`;
      const dailyLike = isLikelyDailyTaskText(candidateText);
      const reminderLike = isReminderLikeText(candidateText);

      // If the model omitted reminder_at but user intent contains an explicit clock time,
      // infer the next occurrence so reminders still get scheduled.
      if (!reminderAtIso && reminderLike) {
        reminderAtIso = inferNextIsoFromTimeText(candidateText);
      }

      const dueTs = dueAtIso ? new Date(dueAtIso).getTime() : null;
      const reminderTs = reminderAtIso ? new Date(reminderAtIso).getTime() : null;

      if (reminderTs && reminderTs <= nowTs) {
        reminderAtIso = dailyLike && reminderAtIso ? rollForwardDailyIso(reminderAtIso) : null;
      }

      if (dueTs && reminderAtIso) {
        const safeReminderTs = new Date(reminderAtIso).getTime();
        if (safeReminderTs >= dueTs) {
          const shifted = new Date(dueTs - 30 * 60 * 1000);
          reminderAtIso = shifted.getTime() > nowTs ? shifted.toISOString() : null;
        }
      }

      const normalized: NormalizedTaskCandidate = {
        title,
        description: candidate.description || null,
        dueAtIso,
        reminderAtIso,
        priority: candidate.priority || 'high',
        category: normalizeCategory(candidate.category),
        impact: clampScoreDimension(candidate.impact),
        urgency: clampScoreDimension(candidate.urgency),
        effort: clampScoreDimension(candidate.effort),
        type: candidate.type === 'decision' ? 'decision' : 'execution',
      };

      return normalized;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (normalizedCandidates.length === 0) {
    return {
      createdCount: 0,
      primaryTodoId: null as string | null,
      primaryTitle: null as string | null,
      secondaryCount: 0,
    };
  }

  const scoredTasks = normalizedCandidates
    .map((task) => ({
      ...task,
      score: scoreTask(task),
    }))
    .sort((a, b) => b.score - a.score);

  const taskCandidatesForInsert = scoredTasks.filter((task) => !shouldCreateStandaloneReminder(task));
  const standaloneReminderCandidates = scoredTasks.filter((task) => shouldCreateStandaloneReminder(task));

  const primaryTask = taskCandidatesForInsert[0] || null;
  const secondaryTasks = taskCandidatesForInsert.slice(1, 3);
  const remainingTasks = taskCandidatesForInsert.slice(3);
  const rankedTasks = [primaryTask, ...secondaryTasks, ...remainingTasks].filter(
    (task): task is NonNullable<typeof task> => Boolean(task)
  );

  const primaryTaskKey = primaryTask
    ? buildTaskDedupeKey(primaryTask.title, primaryTask.dueAtIso)
    : null;

  const { data: existingTodos } = await adminClient
    .from('ai_todos')
    .select('title,due_date')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress']);

  const existingKeys = new Set<string>(
    (existingTodos || []).map((todo: { title?: string | null; due_date?: string | null }) =>
      buildTaskDedupeKey(todo.title || '', parseIsoOrNull(todo.due_date || null))
    )
  );
  const existingTitleKeys = new Set<string>(
    (existingTodos || []).map((todo: { title?: string | null }) =>
      normalizeTaskTitleForDedupe(todo.title || '')
    )
  );
  const primaryKeyBlockedByExisting = Boolean(primaryTaskKey && existingKeys.has(primaryTaskKey));

  const createdKeys = new Set<string>();
  const createdTitleKeys = new Set<string>();
  const createdReminderKeys = new Set<string>();

  let primaryAssigned = false;
  let createdCount = 0;
  let primaryTodoId: string | null = null;
  let primaryTitle: string | null = null;

  for (const candidate of rankedTasks) {
    const dedupeKey = buildTaskDedupeKey(candidate.title, candidate.dueAtIso);
    const titleKey = normalizeTaskTitleForDedupe(candidate.title);
    if (
      existingKeys.has(dedupeKey)
      || createdKeys.has(dedupeKey)
      || existingTitleKeys.has(titleKey)
      || createdTitleKeys.has(titleKey)
    ) {
      continue;
    }

    const isPrimary = !primaryAssigned && (
      (primaryTaskKey ? dedupeKey === primaryTaskKey : true)
      || primaryKeyBlockedByExisting
    );

    if (!ALLOW_AUTO_CREATE_TODOS) {
      console.info('[StoryLens] Auto todo creation disabled; skipping creation for candidate:', candidate.title);
      createdKeys.add(dedupeKey);
      createdTitleKeys.add(titleKey);
      existingKeys.add(dedupeKey);
      existingTitleKeys.add(titleKey);
      continue;
    }

    const { data: action } = await adminClient
      .from('user_actions')
      .insert({
        user_id: userId,
        journal_id: journalInternalId,
        icon: candidate.category === 'health' ? '💊' : candidate.category === 'social' ? '📅' : '⏰',
        title: candidate.title,
        reason: candidate.description || 'Auto-created from Story Lens so Force can remind you in-app.',
        duration: 'Auto from analysis',
        category: candidate.category,
        status: 'active',
        accepted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    const { data: todo, error: todoError } = await adminClient
      .from('ai_todos')
      .insert({
        user_id: userId,
        title: candidate.title,
        description: candidate.description,
        priority: candidate.priority,
        status: 'pending',
        due_date: candidate.dueAtIso,
        category: candidate.category,
        is_manual: false,
        action_id: action?.id || null,
        journal_id: journalInternalId,
        source_type: 'action',
        reminder_at: candidate.reminderAtIso,
        is_primary: isPrimary,
      })
      .select('id,title,description')
      .single();

    if (todoError || !todo) {
      console.warn('[StoryLens] Failed to create auto todo:', todoError?.message);
      continue;
    }

    createdCount++;

    if (isPrimary) {
      primaryAssigned = true;
      primaryTodoId = todo.id;
      primaryTitle = todo.title;
    }

    createdKeys.add(dedupeKey);
    createdTitleKeys.add(titleKey);
    existingKeys.add(dedupeKey);
    existingTitleKeys.add(titleKey);

    if (candidate.reminderAtIso) {
      await reminderScheduler.schedule({
        userId,
        todoId: todo.id,
        actionId: action?.id,
        title: todo.title,
        body: todo.description || `Reminder: ${todo.title}`,
        reminderAt: new Date(candidate.reminderAtIso),
        reminderType: 'custom',
      });
    }
  }

  // Reminder-like candidates are created as standalone reminders, not todos.
  for (const reminderCandidate of standaloneReminderCandidates) {
    const baseReminderIso = reminderCandidate.reminderAtIso || reminderCandidate.dueAtIso;
    const scheduledMinuteIso = toMinuteIsoOrNull(baseReminderIso);
    if (!scheduledMinuteIso) {
      continue;
    }

    const reminderKey = buildTaskDedupeKey(reminderCandidate.title, scheduledMinuteIso);
    if (createdReminderKeys.has(reminderKey)) {
      continue;
    }

    const { data: existingReminder } = await adminClient
      .from('notifications')
      .select('id')
      .eq('recipient_id', userId)
      .eq('type', 'reminder')
      .eq('title', reminderCandidate.title)
      .eq('scheduled_for', scheduledMinuteIso)
      .in('status', ['queued', 'sent'])
      .limit(1)
      .maybeSingle();

    if (existingReminder?.id) {
      continue;
    }

    if (!ALLOW_AUTO_CREATE_TODOS) {
      console.info('[StoryLens] Auto reminder creation disabled; skipping reminder:', reminderCandidate.title);
      createdReminderKeys.add(reminderKey);
      continue;
    }

    await reminderScheduler.schedule({
      userId,
      title: reminderCandidate.title,
      body: reminderCandidate.description || `Reminder: ${reminderCandidate.title}`,
      reminderAt: new Date(scheduledMinuteIso),
      reminderType: 'custom',
      recurring: isLikelyDailyTaskText(`${reminderCandidate.title} ${reminderCandidate.description || ''}`)
        ? 'daily'
        : 'none',
    });

    createdReminderKeys.add(reminderKey);
  }

  return {
    createdCount,
    primaryTodoId,
    primaryTitle,
    secondaryCount: Math.max(0, createdCount - (primaryTodoId ? 1 : 0)),
  };
}

async function getAuthenticatedUser(req: NextRequest) {
  // Support Bearer token auth (mobile app)
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { error: 'Server misconfigured', status: 500 };
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { error: 'Unauthorized', status: 401 };
    }
    return { user };
  }

  // Fallback to cookie-based auth (web app)
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }
  return { user };
}

const LLM_CONFIG = {
  modelName: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
  maxTokens: 8192,
};

const SINGLE_ENTRY_ANALYSIS_LIMIT = 10;

function extractFirstJson(text: string): string | null {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1);
  }
  return null;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function formatLegacyKnowledgeContext(items: Array<{
  knowledge_type?: string | null;
  category?: string | null;
  content?: string | null;
  confidence?: number | null;
}>): string {
  if (!items.length) return '';

  const memories = items.filter((item) => item.knowledge_type === 'memory');
  const rawItems = items.filter((item) => item.knowledge_type === 'raw');
  const lines: string[] = [];

  if (memories.length > 0) {
    lines.push('LEGACY MEMORY (CURATED):');
    memories.forEach((item) => {
      const content = normalizeWhitespace(item.content || '');
      if (!content) return;
      lines.push(`- ${content}`);
    });
  }

  if (rawItems.length > 0) {
    lines.push('LEGACY MEMORY (RAW OBSERVATIONS):');
    rawItems.forEach((item) => {
      const content = normalizeWhitespace(item.content || '');
      if (!content) return;
      lines.push(`- ${content}`);
    });
  }

  return lines.join('\n').trim();
}

function dedupeContextLines(blocks: string[]): string {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const key = normalizeWhitespace(line.toLowerCase());
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(line);
    }
  }

  return deduped.join('\n').trim();
}

async function fetchStoryLensHistoricalContext(params: {
  userId: string;
  title: string;
  content: string;
  adminClient: SupabaseClient<any, any, any>;
}): Promise<string> {
  const { userId, title, content, adminClient } = params;

  const entryQuery = normalizeWhitespace(`${title} ${content}`);
  const broadQuery = 'values goals relationships routines stress triggers health work focus decisions';

  const [vektoriEntry, vektoriBroad, legacyKnowledge] = await Promise.all([
    searchVektoriMemory({
      userId,
      query: entryQuery,
      depth: 'l2',
      contextWindow: 12,
    }),
    searchVektoriMemory({
      userId,
      query: broadQuery,
      depth: 'l2',
      contextWindow: 12,
    }),
    adminClient
      .from('user_knowledge')
      .select('knowledge_type,category,content,confidence,last_seen_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('confidence', { ascending: false })
      .order('last_seen_at', { ascending: false })
      .limit(240),
  ]);

  const contextBlocks: string[] = [];

  const vektoriEntryContext = formatVektoriContext(vektoriEntry);
  if (vektoriEntryContext) {
    contextBlocks.push('VEKTORI MEMORY (ENTRY-RELEVANT):\n' + vektoriEntryContext);
  }

  const vektoriBroadContext = formatVektoriContext(vektoriBroad);
  if (vektoriBroadContext) {
    contextBlocks.push('VEKTORI MEMORY (GLOBAL USER CONTEXT):\n' + vektoriBroadContext);
  }

  const legacyRows = legacyKnowledge.data || [];
  if (legacyRows.length > 0) {
    const legacyContext = formatLegacyKnowledgeContext(legacyRows);
    if (legacyContext) {
      contextBlocks.push(legacyContext);
    }
  }

  if (contextBlocks.length === 0) {
    return '';
  }

  // Keep context broad but bounded to protect prompt budget.
  const deduped = dedupeContextLines(contextBlocks);
  const MAX_CONTEXT_CHARS = 18000;
  return deduped.length > MAX_CONTEXT_CHARS
    ? deduped.slice(0, MAX_CONTEXT_CHARS)
    : deduped;
}

function buildSingleEntryPrompt(
  title: string,
  content: string,
  analysisType: string,
  historicalContext?: string
): string {
  const entryText = `Title: ${title}\nContent: ${content}`;
  const historicalBlock = historicalContext
    ? `\nUSER HISTORICAL CONTEXT (memory across prior entries):\n${historicalContext}\n`
    : '';

  if (analysisType === 'sentiment') {
    return `
Analyze the following single journal entry for sentiment and emotional patterns:

${entryText}
${historicalBlock}

Provide a comprehensive sentiment analysis in JSON format:
{
  "overallSentiment": {
    "score": number,
    "label": "positive" | "negative" | "neutral",
    "confidence": number
  },
  "emotionalPatterns": {
    "primaryEmotions": [{ "emotion": string, "frequency": number, "intensity": number }],
    "secondaryEmotions": [{ "emotion": string, "frequency": number, "intensity": number }]
  },
  "insights": {
    "emotionalTriggers": [{ "trigger": string, "impact": number, "frequency": number }],
    "moodPatterns": [{ "pattern": string, "significance": string, "recommendation": string }]
  },
  "summary": string
}

Guidance:
- Use an empathetic, emotionally safe tone.
- Never recommend abandoning, discarding, or cutting off a person as a first-line recommendation.
- For interpersonal conflict, prioritize nuanced options first: boundaries, respectful conversation, support-seeking, and reflection.

Return ONLY valid JSON.`;
  }

  if (analysisType === 'textual') {
    return `
Analyze the following single journal entry for textual patterns and insights:

${entryText}
${historicalBlock}

Provide a comprehensive textual analysis in JSON format:
{
  "topics": [{ "topic": string, "frequency": number, "context": string[], "sentiment": number }],
  "writingPatterns": {
    "vocabulary": {
      "commonWords": string[],
      "uniqueWords": string[],
      "wordCategories": [{ "category": string, "percentage": number }]
    },
    "structure": {
      "averageLength": number,
      "paragraphPatterns": string[],
      "temporalReferences": { "present": number, "past": number, "future": number }
    }
  },
  "keyInsights": [{ "insight": string, "evidence": string[], "significance": string }],
  "recommendations": [{ "area": string, "suggestion": string, "rationale": string }],
  "summary": string
}

Guidance:
- Use an empathetic, emotionally safe tone.
- Never recommend abandoning, discarding, or cutting off a person as a first-line recommendation.
- For interpersonal conflict, prioritize nuanced options first: boundaries, respectful communication, support-seeking, and reflection.

Return ONLY valid JSON.`;
  }

  // Combined
  return `
You are an expert reflection coach analyzing ONE journal entry. Your job is to generate precise, useful, evidence-backed insight.

Analyze this journal entry:

${entryText}
${historicalBlock}

Provide a comprehensive analysis in JSON format that helps the person take action:

IMPORTANT GUIDELINES:
- Be empathetic, emotionally safe, and grounded in real-life nuance.
- Use "you" language, not "the user demonstrates"
- Be direct and concrete. Avoid vague motivational language.
- Every key insight must be backed by evidence from the entry itself.
- Use historical context to improve personalization and continuity, but never invent events not grounded in entry/historical memory.
- Make recommendations SPECIFIC and ACTIONABLE with time estimates
- Avoid abstract/clinical terms like "chakra", "dysregulation", "manifestation"
- Never suggest external reminders like "set a reminder in your phone"; assume Force can handle reminders in-app
- Focus on what they can DO, not just what you observe
- Never tell the person to discard, abandon, or cut off a person as a first-line recommendation.
- For relationship conflict, prioritize nuanced options first: boundaries, a calm conversation, support-seeking, and reflection before any separation advice.
- If meds/appointments/meetings with clear time are mentioned, include a reminder-first recommendation with explicit reminder time
- For meds with explicit time (e.g., 8 PM), the first recommendation should be reminder-oriented in Force (not habit-only wording)
- If evidence is weak, lower confidence and avoid over-claiming.
- No arbitrary claims. No psycho-babble. No spiritual filler.

{
  "summary": "2-3 sentences. What is happening now, what pressure/tension is visible, and what practical direction helps most this week.",
  "overallSentiment": {
    "score": number (-1 to 1),
    "label": "positive" | "negative" | "neutral",
    "confidence": number (0-1)
  },
  "emotionalPatterns": {
    "primaryEmotions": [{ "emotion": string, "frequency": number, "intensity": number (0-1) }],
    "secondaryEmotions": [{ "emotion": string, "frequency": number, "intensity": number (0-1) }]
  },
  "topics": [{ "topic": string (2-3 words, conversational), "sentiment": number (-1 to 1) }],
  "keyInsights": [{ 
    "insight": "Concrete pattern in plain language.",
    "evidence": ["Short quote/snippet from the entry", "Second snippet if useful"],
    "significance": "Why this matters in daily life this week.",
    "confidence": number (0-1)
  }],
  "recommendations": [{ 
    "area": "Sleep | Work-Life Balance | Relationships | Self-Care | Focus",
    "suggestion": "SPECIFIC ACTION they can take this week (e.g., 'Set a 10 PM wind-down alarm' not 'Optimize sleep hygiene')",
    "rationale": "Why this helps based on evidence in their entry.",
    "successSignal": "Observable sign this worked after 3-7 days"
  }],
  "taskCandidates": [{
    "title": "Task title Force should create",
    "description": "Optional details for the to-do",
    "due_at": "ISO timestamp or null",
    "reminder_at": "ISO timestamp or null",
    "priority": "high | medium | low",
    "category": "health | productivity | social | wellbeing",
    "should_autocreate": true,
    "impact": 1-5,
    "urgency": 1-5,
    "effort": 1-5,
    "type": "execution | decision"
  }]
}

TASK CANDIDATE RULES:
- Return 1-5 taskCandidates across reminder + strategic work when actionable
- Include at least one strategic/high-leverage task when relevant (e.g., writing, planning, pitch, decision-making)
- For any time-bound or forgettable commitment (meds, meetings, appointments, deadlines, payments, follow-ups), include at least one reminder taskCandidate with reminder_at set when inferable
- Use type="decision" for choose/decide tasks, type="execution" for do/build/send tasks
- Provide impact, urgency, effort (1-5). If uncertain, use 3.
- Prefer should_autocreate=true unless task is clearly unsafe/too vague
- Use ISO timestamps when timing is inferable; otherwise null
- Keep titles concrete, e.g. "Take evening medication", "Prepare for 3 PM team meeting"

INSIGHT QUALITY RULES:
- Return 3-5 keyInsights (not more) so the analysis has enough depth to be useful.
- Each keyInsight must include at least one evidence snippet copied/paraphrased from the entry text.
- Evidence snippets should be 4-16 words and clearly tied to the claim.
- Do not repeat the same idea across multiple insights.
- Do not include any insight that cannot be defended by text evidence.
SUMMARY GUIDANCE:
- Keep the summary at 3-4 sentences when the entry is substantial.
- Name the core situation, the visible tension, the likely consequence of staying stuck, and the clearest direction forward.
- Avoid one-line summaries unless the entry is very short.

EXAMPLES OF GOOD vs. BAD:
❌ BAD: "The individual demonstrates emotional dysregulation in interpersonal contexts"
✅ GOOD: "You snapped at Sarah and feel bad about it"

❌ BAD: "Implement circadian rhythm optimization protocols"
✅ GOOD: "Set a 10 PM alarm to start winding down for bed"

❌ BAD: "Set reminder in phone for meds"
✅ GOOD: "Set daily Force reminder for thyroid medication at 7:45 PM" with a taskCandidate that includes reminder_at
❌ BAD: "Pair your medication with a habit" (without a reminder step)
✅ GOOD: "Set a daily reminder for 7:45 PM, then pair it with your evening routine"

❌ BAD: "Foundation & stability indicators show compromise"
✅ GOOD: "You're stressed about work and it's affecting your sleep"

Return ONLY valid JSON with no markdown formatting.`;
}

/**
 * POST /api/journal/[journalId]/analyze
 * Body: { decrypted_title, decrypted_content, analysis_type }
 * Returns: { data: AnalysisResult, analysisType, model_used }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ journalId: string }> }
) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const { journalId } = await params;
    const body = await request.json();
    const {
      decrypted_title,
      decrypted_content,
      resolved_content,
      analysis_type: rawAnalysisType = 'combined',
    } = body;

    const analysisContent = resolved_content || decrypted_content || '';

    const analysis_type: SingleEntryAnalysisType = isSingleEntryAnalysisType(rawAnalysisType)
      ? rawAnalysisType
      : 'combined';

    if (!decrypted_title && !analysisContent) {
      return NextResponse.json({ error: 'Missing journal content for analysis' }, { status: 400 });
    }

    // Check analysis count limit (max 10)
    const adminClient = createAdminClient();

    const { data: journal, error: journalError } = await adminClient
      .from('journals')
      .select('id, analysis_count')
      .eq('journal_id', journalId)
      .eq('user_id', user.id)
      .single();

    if (journalError || !journal) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }

    const currentCount = journal.analysis_count || 0;
    if (currentCount >= SINGLE_ENTRY_ANALYSIS_LIMIT) {
      return NextResponse.json({
        error: 'Analysis limit reached',
        message: `You have reached the ${SINGLE_ENTRY_ANALYSIS_LIMIT} analysis limit for this journal entry.`,
        analysis_count: currentCount
      }, { status: 403 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not defined');
    }

    const memoryResult = await forceMemoryService.getMemoryContext(user.id, analysisContent, {
      mode: 'journal_analysis',
      title: decrypted_title || '',
      content: analysisContent,
    });

    const prompt = buildSingleEntryPrompt(
      decrypted_title || '',
      analysisContent,
      analysis_type,
      memoryResult.context
    );

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: LLM_CONFIG.modelName,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: LLM_CONFIG.maxTokens,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Claude API error');
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    if (!text) {
      throw new Error('No response from Claude API');
    }

    const jsonString = extractFirstJson(text);
    if (!jsonString) {
      throw new Error('Invalid JSON response from Claude API');
    }

    let parsedData: AnalysisPayload;
    try {
      parsedData = JSON.parse(jsonString);
    } catch {
      throw new Error('Failed to parse Claude response JSON');
    }

    // Force Agent synthesis path: asynchronously ingest distilled narrative & reflective insights into memory
    const analysisSummary = typeof (parsedData as any)?.summary === 'string' ? (parsedData as any).summary : undefined;
    const insightsList = Array.isArray((parsedData as any)?.keyInsights)
      ? (parsedData as any).keyInsights.map((k: any) => k?.insight).filter(Boolean)
      : undefined;

    void forceMemoryService.ingestJournalMessage(user.id, {
      journalId,
      title: decrypted_title || '',
      content: analysisContent,
      analysisSummary,
      insights: insightsList,
    });

    const taskDecisionResult = await autoCreateReminderArtifacts({
      adminClient,
      userId: user.id,
      journalInternalId: journal.id,
      analysis: parsedData,
    });

    // Always create immediate in-app analysis notification.
    await notificationService.sendAnalysisReadyInApp(user.id, {
      journal_id: journalId,
      link: '/analysis',
      created_task_count: taskDecisionResult.createdCount,
      primary_todo_id: taskDecisionResult.primaryTodoId,
      primary_task_title: taskDecisionResult.primaryTitle,
    });

    // High-signal in-app follow-up: notify only when a fresh primary task is created.
    if (taskDecisionResult.primaryTodoId && taskDecisionResult.primaryTitle) {
      const recentWindowStart = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

      const { data: existingPrimaryNotification } = await adminClient
        .from('notifications')
        .select('id')
        .eq('recipient_id', user.id)
        .eq('template_key', 'primary_task_focus_v1')
        .contains('data', { todo_id: taskDecisionResult.primaryTodoId })
        .gte('created_at', recentWindowStart)
        .limit(1)
        .maybeSingle();

      if (!existingPrimaryNotification?.id) {
        const secondaryText =
          taskDecisionResult.secondaryCount > 0
            ? ` Then tackle ${taskDecisionResult.secondaryCount} up next.`
            : '';

        await notificationService.send({
          recipientId: user.id,
          templateKey: 'primary_task_focus_v1',
          type: 'system',
          title: "Today's Focus is ready",
          body: `Start with: ${taskDecisionResult.primaryTitle}.${secondaryText}`,
          data: {
            journal_id: journalId,
            todo_id: taskDecisionResult.primaryTodoId,
            link: `/dashboard?tab=todos&highlight=${taskDecisionResult.primaryTodoId}`,
            is_primary_focus: true,
            secondary_count: taskDecisionResult.secondaryCount,
          },
          priority: 'high',
          channels: ['in_app'],
        });
      }
    }

    // Push is capped at once/day and selected by global priority.
    await notificationService.sendBestDailyPushNotificationForUser(user.id);

    return NextResponse.json({
      data: parsedData,
      analysis: parsedData,
      analysisType: analysis_type,
      model_used: LLM_CONFIG.modelName,
      memory_source: memoryResult.source,
    });
  } catch (error: any) {
    console.error('Single journal analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze journal', details: error.message },
      { status: 500 }
    );
  }
}

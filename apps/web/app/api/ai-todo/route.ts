// apps/web/app/api/ai-todo/route.ts
// AI-powered TODO list with Google Calendar integration

import { NextRequest, NextResponse } from 'next/server';
import { createClient, getAuthenticatedUser } from '@/utils/supabase/server';
import { reminderScheduler } from '@/utils/notifications/reminderScheduler';
import { forceMemoryService, forceAgentOrchestrator } from '@/lib/force-agent';
import { serverEncryptAiTodo } from '@/utils/encryption/aiDataEncryption';
import { parsePublicKeyFromDb } from '@/utils/encryption/hybridCrypto';
import { executeLLMRequest } from '@/lib/llm/llmService';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  attendees: number;
  isAllDay: boolean;
  htmlLink?: string;
}

interface AiTodo {
  id?: string;
  user_id?: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'done';
  due_date?: string;
  calendar_event_id?: string;
  calendar_event_title?: string;
  ai_reasoning?: string;
  category?: string;
  is_manual?: boolean;
  // New fields for action linking
  action_id?: string;
  journal_id?: string;
  source_type?: 'calendar' | 'action' | 'manual' | 'ai';
  reminder_at?: string;
  notification_id?: string;
  created_at?: string;
  updated_at?: string;
}

type GeneratedTaskInput = {
  title: string;
  description?: string;
  subtasks?: string[];
  estimated_time?: string;
  priority?: 'high' | 'medium' | 'low';
  due_date?: string | null;
  category?: string;
  suggested_deadline?: string;
  allocation?: 'focus_today' | 'also_today' | 'space_for_later';
  reasoning?: string;
};

type GeneratedTaskClassification = {
  title: string;
  type: 'one_time_task' | 'one_time_reminder' | 'daily_reminder';
  due_at: string | null;
  reminder_at: string | null;
  category: string;
  reasoning: string;
};

function cleanIso(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseEstimatedMinutes(input?: string): number {
  if (!input) return 45;
  const text = input.toLowerCase();
  const hours = text.match(/(\d+)\s*(h|hr|hrs|hour|hours)/i);
  const minutes = text.match(/(\d+)\s*(m|min|mins|minute|minutes)/i);

  const hourMinutes = hours?.[1] ? Number.parseInt(hours[1], 10) * 60 : 0;
  const minuteMinutes = minutes?.[1] ? Number.parseInt(minutes[1], 10) : 0;
  const total = hourMinutes + minuteMinutes;

  if (Number.isNaN(total) || total <= 0) return 45;
  return Math.min(8 * 60, total);
}

function inferReminderLikeText(text: string): boolean {
  return /\b(remind|reminder|daily|every day|every morning|every evening|notify|deadline|follow up|med|medicine|pill|meeting|call|appointment|submit|renew)\b/i.test(text);
}

async function classifyGeneratedTasksWithAI(params: {
  request: NextRequest;
  mode: string;
  responses: Record<string, unknown>;
  tasks: GeneratedTaskInput[];
  vektoriContext?: string;
}): Promise<GeneratedTaskClassification[]> {
  const { request, mode, responses, tasks, vektoriContext } = params;
  const nowIso = new Date().toISOString();

  const taskContext = tasks.map((task, index) => ({
    index,
    title: task.title,
    description: task.description || '',
    priority: task.priority || 'medium',
    category: task.category || '',
    estimated_time: task.estimated_time || '30m',
    subtasks: Array.isArray(task.subtasks) ? task.subtasks.slice(0, 6) : [],
    due_date: task.due_date || task.suggested_deadline || null,
  }));

  const prompt = `You classify and refine generated tasks from a Cognition Engine session for a modern task manager.

Current time (ISO): ${nowIso}
Cognition Mode: ${mode}
User responses JSON: ${JSON.stringify(responses).slice(0, 3000)}
Tasks JSON: ${JSON.stringify(taskContext)}

Relevant Vektori memory:
${vektoriContext || 'none'}

For each task classify and return:
- type:
  - "daily_reminder" for routines, habits, medication, or daily practices.
  - "one_time_reminder" for important time-sensitive commitments (calls, meetings, deadlines, specific follow-ups).
  - "one_time_task" for standard actionable items.
- due_at: realistic deadline ISO string (e.g. today 9pm, tomorrow afternoon, or 2-4 days out). If task already has a valid due_date in JSON, keep or refine it. NEVER set a deadline to just 5-10 minutes from now.
- reminder_at: ISO string or null. If reminder is needed, schedule it 1-2 hours before due_at or at a calm morning/evening slot (e.g. 9am or 6pm).
- category: Work, Personal, Health, Career, Finance, Learning, Reflection, Relationship, Admin.
- reasoning: 1 concise sentence explaining the allocation and value of this task.

Return ONLY JSON:
{
  "items": [
    {
      "title": "exact title",
      "type": "one_time_task|one_time_reminder|daily_reminder",
      "due_at": "ISO or null",
      "reminder_at": "ISO or null",
      "category": "Work|Personal|Health|Career|Finance|Learning|Reflection|Relationship|Admin",
      "reasoning": "short reason"
    }
  ]
}`;

  const llmData = await executeLLMRequest({
    prompt,
    provider: 'claude',
    options: { temperature: 0.2 },
  });

  const rawText = String(llmData?.text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed = JSON.parse(rawText) as { items?: GeneratedTaskClassification[] };
  return Array.isArray(parsed.items) ? parsed.items : [];
}

async function fetchVektoriTaskContext(userId: string, tasks: GeneratedTaskInput[]): Promise<string> {
  const query = tasks
    .map((task) => [task.title, task.description || '', ...(task.subtasks || [])].join(' '))
    .join(' ')
    .trim();

  if (!query) {
    return '';
  }

  const result = await forceMemoryService.getMemoryContext(userId, query.slice(0, 400), {
    mode: 'chat',
    depth: 'l1',
    contextWindow: 4,
  });

  return result.context;
}

// ─── GET: fetch user todos ─────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    const { data: todos, error } = await supabase
      .from('ai_todos')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      // Table may not exist yet — return empty
      console.warn('ai_todos table error:', error.message);
      return NextResponse.json({ todos: [] });
    }

    return NextResponse.json({ todos: todos ?? [] });
  } catch (err) {
    console.error('GET /api/ai-todo error:', err);
    return NextResponse.json({ todos: [] });
  }
}

// ─── POST: generate todos from calendar events OR add a manual todo ────────
export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    const body = await request.json();
    const { action } = body;

    // ── AI Task Generation via Force Agent Orchestrator (Section 6 contract) ──
    if (body.type === 'ai_task_generation' || action === 'generate_tasks' || (body.journalEntry && !action)) {
      const orchestratorResult = await forceAgentOrchestrator.handle({
        userId: user.id,
        type: 'ai_task_generation',
        entryText: body.journalEntry,
        query: body.query,
        systemContext: body.systemContext,
      });

      return NextResponse.json({
        tasks: orchestratorResult.tasks || [],
        memory_source: orchestratorResult.memorySource,
        usage: orchestratorResult.usage,
        message: orchestratorResult.message,
      });
    }

    // ── Manual todo ──────────────────────────────────────────────────────────
    if (action === 'add_manual') {
      const rawTitle = typeof body.title === 'string' ? body.title.trim() : '';
      if (!rawTitle) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
      }

      const { data: userData } = await supabase
        .from('users')
        .select('encryption_public_key')
        .eq('id', user.id)
        .single();
      const pubKey = parsePublicKeyFromDb(userData?.encryption_public_key);

      let todo: any = {
        user_id: user.id,
        priority: body.priority ?? 'medium',
        status: 'pending',
        due_date: body.due_date ?? null,
        is_manual: true,
        source_type: 'manual',
        reminder_at: body.reminder_at ?? null,
      };

      if (pubKey) {
        const enc = await serverEncryptAiTodo({
          title: rawTitle,
          description: body.description ?? null,
          category: body.category ?? 'Personal',
        }, pubKey);
        todo = {
          ...todo,
          title: rawTitle,
          description: body.description ?? null,
          category: body.category ?? 'Personal',
          ...enc,
        };
      } else {
        todo.title = rawTitle;
        todo.description = body.description ?? null;
        todo.category = body.category ?? 'Personal';
      }

      const { data, error } = await supabase.from('ai_todos').insert(todo).select().single();
      if (error) throw error;

      if (body.reminder_at && data) {
        try {
          const reminderDate = new Date(body.reminder_at);
          if (!Number.isNaN(reminderDate.getTime())) {
            await reminderScheduler.schedule({
              userId: user.id,
              todoId: data.id,
              title: rawTitle,
              body: body.description || `Don't forget: ${rawTitle}`,
              reminderAt: reminderDate,
              reminderType: 'custom',
            });
          }
        } catch (notifErr) {
          console.warn('Failed to schedule manual reminder notification:', notifErr);
          // Do not fail todo creation if reminder scheduling fails
        }
      }

      return NextResponse.json({ todo: data });
    }

    // ── Action-based todo (from JournalAnalysis) ────────────────────────────
    if (action === 'add_from_action') {
      const { 
        action_id, 
        journal_id, 
        title, 
        description, 
        priority, 
        due_date, 
        category,
        reminder_at,
        add_to_calendar,
        calendar_event_id,
      } = body;

      if (!action_id || !title) {
        return NextResponse.json({ error: 'action_id and title are required' }, { status: 400 });
      }

      // Check if this action already has a todo
      const { data: existingTodo } = await supabase
        .from('ai_todos')
        .select('id')
        .eq('action_id', action_id)
        .eq('user_id', user.id)
        .single();

      if (existingTodo) {
        return NextResponse.json({ 
          error: 'A todo already exists for this action', 
          existing_todo_id: existingTodo.id 
        }, { status: 409 });
      }

      // Fetch user's public key for encryption
      const { data: userData } = await supabase
        .from('users')
        .select('encryption_public_key')
        .eq('id', user.id)
        .single();
      
      const pubKey = parsePublicKeyFromDb(userData?.encryption_public_key);

      let todo: any = {
        user_id: user.id,
        priority: priority ?? 'medium',
        status: 'pending',
        due_date: due_date ?? null,
        is_manual: false,
        action_id,
        journal_id: journal_id ?? null,
        source_type: 'action',
        reminder_at: reminder_at ?? null,
        calendar_event_id: add_to_calendar ? calendar_event_id : null,
      };

      if (pubKey) {
        const enc = await serverEncryptAiTodo({
          title,
          description: description ?? null,
          category: category ?? 'Personal',
        }, pubKey);
        todo = {
          ...todo,
          title,
          description: description ?? null,
          category: category ?? 'Personal',
          ...enc,
        };
      } else {
        // Fallback for unencrypted users
        todo.title = title;
        todo.description = description ?? null;
        todo.category = category ?? 'Personal';
      }

      const { data, error } = await supabase.from('ai_todos').insert(todo).select().single();
      if (error) throw error;

      // If reminder_at is set, schedule a reminder notification
      if (reminder_at && data) {
        try {
          const reminderDate = new Date(reminder_at);
          if (!Number.isNaN(reminderDate.getTime())) {
            await reminderScheduler.schedule({
              userId: user.id,
              todoId: data.id,
              actionId: action_id,
              title,
              body: description || `Don't forget: ${title}`,
              reminderAt: reminderDate,
              reminderType: 'custom',
            });
          }
        } catch (notifErr) {
          console.warn('Failed to schedule reminder notification:', notifErr);
          // Don't fail the todo creation if notification fails
        }
      }

      return NextResponse.json({ todo: data });
    }

    // ── Generated tasks from cognition engine (persist directly) ───────────
    if (action === 'add_generated_tasks') {
      const mode = typeof body.mode === 'string' ? body.mode : 'planning';
      const responses = body.responses && typeof body.responses === 'object'
        ? body.responses as Record<string, unknown>
        : {};
      const tasks = Array.isArray(body.tasks)
        ? (body.tasks as GeneratedTaskInput[])
        : [];
      const insight = body.insight && typeof body.insight === 'object'
        ? (body.insight as { core: string; tension: string; consequence: string })
        : { core: '', tension: '', consequence: '' };
      let vektoriContext = '';

      try {
        vektoriContext = await fetchVektoriTaskContext(user.id, tasks);
      } catch (error) {
        console.warn('[ai-todo] Vektori task context lookup failed:', error);
      }

      if (tasks.length === 0) {
        return NextResponse.json({ todos: [], persisted: true, created: 0 });
      }

      let classified: GeneratedTaskClassification[] = [];
      try {
        classified = await classifyGeneratedTasksWithAI({ request, mode, responses, tasks, vektoriContext });
      } catch (error) {
        console.warn('[ai-todo] classification failed, applying heuristic fallback:', error);
      }

      const { data: userData } = await supabase
        .from('users')
        .select('encryption_public_key')
        .eq('id', user.id)
        .single();
      const pubKey = parsePublicKeyFromDb(userData?.encryption_public_key);

      const taskByTitle = new Map(tasks.map((task) => [task.title.trim().toLowerCase(), task]));
      const now = Date.now();
      
      // We must keep plaintext in memory to schedule reminders (since DB returns ciphertext)
      const plaintexts: { title: string; description: string | null; category: string; ai_reasoning: string }[] = [];

      const rowsToInsert = await Promise.all(tasks.map(async (task, index) => {
        const title = task.title.trim();
        const sourceTask = taskByTitle.get(title.toLowerCase()) || task;
        const match = classified.find((item) => item.title.trim().toLowerCase() === title.toLowerCase());

        const reminderLike = inferReminderLikeText(`${title} ${sourceTask.description || ''} ${(sourceTask.subtasks || []).join(' ')}`);
        const type = match?.type || (reminderLike ? 'one_time_reminder' : 'one_time_task');

        // Smart Due Date: Respect user-selected or Claude-suggested deadline first
        let dueDate: string | null = null;
        if (type !== 'daily_reminder') {
          if (sourceTask.due_date) {
            dueDate = cleanIso(sourceTask.due_date);
          } else if (match?.due_at) {
            dueDate = cleanIso(match.due_at);
          } else if (sourceTask.suggested_deadline) {
            dueDate = cleanIso(sourceTask.suggested_deadline);
          } else {
            // Intelligent fallback: today 9 PM for primary/focus task, tomorrow 2 PM for secondary, 2-3 days for later
            const offsetHours = sourceTask.allocation === 'focus_today' || index === 0 ? 4 : sourceTask.allocation === 'also_today' || index <= 2 ? 24 : 48;
            dueDate = new Date(now + offsetHours * 60 * 60 * 1000).toISOString();
          }
        }

        // Smart Reminder
        let reminderAt: string | null = null;
        if (type !== 'one_time_task') {
          if (match?.reminder_at) {
            reminderAt = cleanIso(match.reminder_at);
          } else if (dueDate) {
            // Schedule reminder 2 hours before due date, or 30 mins from now if imminent
            const dueTime = new Date(dueDate).getTime();
            const reminderTime = Math.max(now + 15 * 60 * 1000, dueTime - 2 * 60 * 60 * 1000);
            reminderAt = new Date(reminderTime).toISOString();
          }
        }

        // Build rich description combining thoughtful explanation and tactical steps
        let description: string | null = null;
        const subtasks = Array.isArray(sourceTask.subtasks)
          ? sourceTask.subtasks.filter(Boolean).slice(0, 6)
          : [];
        if (sourceTask.description && sourceTask.description.trim()) {
          const baseDesc = sourceTask.description.trim();
          const firstSubtask = subtasks[0];
          if (firstSubtask && !baseDesc.includes(firstSubtask)) {
            description = `${baseDesc} | Steps: ${subtasks.join(' • ')}`;
          } else {
            description = baseDesc;
          }
        } else if (subtasks.length > 0) {
          description = subtasks.join(' | ');
        }

        const category = (sourceTask.category || match?.category || 'Personal').toString();

        // Build ai_reasoning with cognition engine marker, mode, and insight
        const insightSummary = insight.core ? `Insight: ${insight.core.slice(0, 60)}` : '';
        const reasoningParts = [
          '[COGNITION_ENGINE]',
          `Mode: ${mode}`,
          sourceTask.allocation ? `Allocation: ${sourceTask.allocation}` : '',
          insightSummary,
          sourceTask.reasoning || match?.reasoning || `Generated from cognition mode: ${mode}`,
        ].filter(Boolean);
        const ai_reasoning = reasoningParts.join(' | ');

        // Save plaintext for reminder scheduling later
        plaintexts.push({ title, description, category, ai_reasoning });

        let row: any = {
          user_id: user.id,
          priority: sourceTask.priority || 'medium',
          status: 'pending' as const,
          due_date: dueDate,
          is_manual: false,
          source_type: 'ai' as const,
          reminder_at: reminderAt,
        };

        if (pubKey) {
          const enc = await serverEncryptAiTodo({ title, description, ai_reasoning, category }, pubKey);
          row = { ...row, title, description, ai_reasoning, category, ...enc };
        } else {
          row = { ...row, title, description, ai_reasoning, category };
        }
        return row;
      }));

      const { data: inserted, error: insertError } = await supabase
        .from('ai_todos')
        .insert(rowsToInsert)
        .select();

      if (insertError) {
        throw insertError;
      }

      for (let i = 0; i < (inserted || []).length; i++) {
        const todo = inserted![i];
        if (!todo.reminder_at) continue;

        try {
          const pt = plaintexts[i];
          if (!pt) continue;
          
          const classification = classified.find(
            (item) => item.title.trim().toLowerCase() === pt.title.toLowerCase()
          );

          await reminderScheduler.schedule({
            userId: user.id,
            todoId: todo.id,
            title: pt.title,
            body: pt.description || `Reminder: ${pt.title}`,
            reminderAt: new Date(todo.reminder_at),
            reminderType: 'custom',
            recurring: classification?.type === 'daily_reminder' ? 'daily' : 'none',
          });
        } catch (scheduleError) {
          console.warn('[ai-todo] failed to schedule generated reminder:', scheduleError);
        }
      }

      return NextResponse.json({
        todos: inserted || [],
        persisted: true,
        created: (inserted || []).length,
      });
    }

    // ── AI generation from calendar events ──────────────────────────────────
    const events: CalendarEvent[] = body.events ?? [];

    if (events.length === 0) {
      return NextResponse.json({ todos: [], message: 'No events to process' });
    }

    // Build context-rich prompt for Claude
    const now = new Date();
    const eventSummaries = events.map(e => {
      const start = new Date(e.start);
      const hoursUntil = Math.round((start.getTime() - now.getTime()) / 3600000);
      const daysUntil = Math.round(hoursUntil / 24);
      const urgency = hoursUntil < 24 ? 'TODAY' : hoursUntil < 48 ? 'TOMORROW' : `in ${daysUntil} days`;
      return `- "${e.title}" [${urgency}] | ${e.isAllDay ? 'All day' : `${start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`} | ${e.attendees > 1 ? `${e.attendees} attendees` : 'Solo'} ${e.location ? `| 📍 ${e.location}` : ''} ${e.description ? `| Context: ${e.description.slice(0, 150)}` : ''}`;
    }).join('\n');

    let vektoriCalendarContext = '';
    try {
      const result = await forceMemoryService.getMemoryContext(user.id, eventSummaries.slice(0, 500), {
        mode: 'chat',
        depth: 'l1',
        contextWindow: 4,
      });
      vektoriCalendarContext = result.context;
    } catch (error) {
      console.warn('[ai-todo] Vektori calendar context lookup failed:', error);
    }

    const prompt = `You are a smart personal assistant AI. Based on these upcoming calendar events, generate an actionable, prioritized task list to help the user prepare, execute, and follow up effectively.

TODAY IS: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}

UPCOMING CALENDAR EVENTS:
${eventSummaries}

RELEVANT VECTORI MEMORY:
${vektoriCalendarContext || 'none'}

Generate smart, specific, actionable tasks. For each task:
- Preparation tasks (before the event): research, materials, reminders
- Execution tasks (during): notes to take, decisions to make  
- Follow-up tasks (after): emails to send, next steps, deliverables
- Logistics: travel time, setup, specific timing

RULES:
- Only generate truly useful tasks, not obvious ones
- For meetings with multiple attendees: suggest agenda prep, bio research of key attendees
- For ALL DAY events: break into morning/afternoon tasks
- For events with locations: include travel/commute prep tasks
- If the context includes conflict with people, do not suggest abandoning or discarding people; generate nuanced tasks like preparing a calm conversation, boundary notes, or follow-up clarification.
- Assign realistic due_date (ISO string) — prep tasks should be BEFORE the event, follow-ups AFTER
- Category choices: Work, Personal, Health, Finance, Learning, Social, Travel, Admin
- Priority: "high" = urgent/important, "medium" = important, "low" = nice-to-do

Return ONLY valid JSON (no markdown, no explanation):
{
  "todos": [
    {
      "title": "Short actionable task title (max 60 chars)",
      "description": "Optional helpful detail or tip (1-2 sentences)",
      "priority": "high|medium|low",
      "due_date": "ISO 8601 datetime string",
      "calendar_event_id": "calendar event id this relates to or null",
      "calendar_event_title": "name of the event or null",
      "ai_reasoning": "One sentence: why this task matters",
      "category": "Work|Personal|Health|Finance|Learning|Social|Travel|Admin"
    }
  ]
}

Generate 3-8 high-quality tasks. Prioritize quality over quantity.`;

    // Call LLM directly
    const llmData = await executeLLMRequest({
      prompt,
      provider: 'claude',
      options: { temperature: 0.3 },
    });
    let rawText: string = llmData.text ?? '';

    // Strip markdown code fences if present
    rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

    let generated: { todos: AiTodo[] };
    try {
      generated = JSON.parse(rawText);
    } catch {
      console.error('Failed to parse LLM response:', rawText.slice(0, 300));
      return NextResponse.json({ error: 'AI returned invalid JSON', raw: rawText.slice(0, 200) }, { status: 500 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('encryption_public_key')
      .eq('id', user.id)
      .single();
    const pubKey = parsePublicKeyFromDb(userData?.encryption_public_key);

    // Persist to DB
    const todosToInsert = await Promise.all((generated.todos ?? []).map(async (t) => {
      let row: any = {
        user_id: user.id,
        priority: t.priority ?? 'medium',
        status: 'pending' as const,
        due_date: t.due_date ?? null,
        calendar_event_id: t.calendar_event_id ?? null,
        is_manual: false,
        source_type: 'ai' as const,
      };

      if (pubKey) {
        const enc = await serverEncryptAiTodo({
          title: t.title,
          description: t.description ?? null,
          ai_reasoning: t.ai_reasoning ?? null,
          category: t.category ?? 'Personal',
          calendar_event_title: t.calendar_event_title ?? null,
        }, pubKey);
        row = {
          ...row,
          title: t.title,
          description: t.description ?? null,
          ai_reasoning: t.ai_reasoning ?? null,
          category: t.category ?? 'Personal',
          calendar_event_title: t.calendar_event_title ?? null,
          ...enc,
        };
      } else {
        row = {
          ...row,
          title: t.title,
          description: t.description ?? null,
          ai_reasoning: t.ai_reasoning ?? null,
          category: t.category ?? 'Personal',
          calendar_event_title: t.calendar_event_title ?? null,
        };
      }
      return row;
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('ai_todos')
      .insert(todosToInsert)
      .select();

    if (insertError) {
      console.warn('DB insert error, returning without persistence:', insertError.message);
      // Return the generated todos without DB IDs so the client can still use them
      return NextResponse.json({ todos: generated.todos, persisted: false });
    }

    return NextResponse.json({ todos: inserted, persisted: true });
  } catch (err) {
    console.error('POST /api/ai-todo error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── PUT: update a todo (status, priority, title, etc.) ───────────────────
export async function PUT(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    let finalUpdates = { ...updates, updated_at: new Date().toISOString() };

    // If the client sent plaintext fields (legacy/unencrypted update), we should encrypt them
    // on the server if the user has a public key. (If they sent title_encrypted, it skips this).
    if (updates.title && !updates.title_encrypted && !updates.is_encrypted) {
      const { data: userData } = await supabase
        .from('users')
        .select('encryption_public_key')
        .eq('id', user.id)
        .single();
      const pubKey = parsePublicKeyFromDb(userData?.encryption_public_key);

      if (pubKey) {
        const enc = await serverEncryptAiTodo({
          title: updates.title,
          description: updates.description,
          ai_reasoning: updates.ai_reasoning,
          category: updates.category,
          calendar_event_title: updates.calendar_event_title,
        }, pubKey);
        
        finalUpdates = { ...finalUpdates, ...enc };
      }
    }

    const { data, error } = await supabase
      .from('ai_todos')
      .update(finalUpdates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ todo: data });
  } catch (err) {
    console.error('PUT /api/ai-todo error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── DELETE: remove a todo ─────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }
    const { user, supabase } = authResult;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clearAll') === 'true';
    const scope = searchParams.get('scope');

    if (clearAll) {
      const query = supabase.from('ai_todos').delete().eq('user_id', user.id);
      const { error } = scope === 'all'
        ? await query
        : await query.eq('status', 'done');
      if (error) throw error;
      return NextResponse.json({
        success: true,
        message: scope === 'all' ? 'Cleared all todos' : 'Cleared completed todos',
      });
    }

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await supabase.from('ai_todos').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/ai-todo error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

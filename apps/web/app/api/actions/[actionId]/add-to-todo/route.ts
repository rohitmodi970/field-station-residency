// apps/web/app/api/actions/[actionId]/add-to-todo/route.ts
// Create a todo linked to an action from JournalAnalysis

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { reminderScheduler } from '@/utils/notifications/reminderScheduler';
import { executeLLMRequest } from '@/lib/llm/llmService';

interface AddToTodoRequest {
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  due_date?: string;
  category?: string;
  reminder_at?: string;
  journal_id?: string;
  context_details?: string | null;
}

interface ActionRecord {
  id: string;
  title: string;
  reason: string | null;
  duration: string | null;
  category: string | null;
  journal_id: string | null;
}

interface GeneratedTodoPlan {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  due_date: string | null;
  reminder_at: string | null;
}

const MEDICATION_KEYWORDS = /\b(med|meds|medication|medicine|pill|tablet|dose|insulin|vitamin)\b/i;
const REMINDER_KEYWORDS = /\b(remind|reminder|alarm|notify|notification|appointment|meeting|call|deadline|due|submit|follow\s?up|renew|renewal|pay|payment|bill|prescription|refill|interview|exam|session|class|event|flight|check[-\s]?in)\b/i;
const TEMPORAL_HINTS = /\b(today|tonight|tomorrow|this morning|this afternoon|this evening|next week|next month|before|by\s+\d|at\s+\d|on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[\/\-.]\d{1,2}))\b/i;
const CLOCK_TIME_HINT = /\b(1[0-2]|0?[1-9])(?::[0-5]\d)?\s*(am|pm)\b|\b([01]?\d|2[0-3]):[0-5]\d\b/i;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAILY_TASK_HINTS = /\b(daily|every day|everyday|each day|every morning|every evening|nightly|morning|evening|med|meds|medication|medicine|pill|dose|tablet|meeting)\b/i;

function toUuidOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

function resolveJournalId(...candidates: Array<unknown>): string | null {
  for (const candidate of candidates) {
    const id = toUuidOrNull(candidate);
    if (id) return id;
  }
  return null;
}

function parseDurationMinutes(duration: string | null | undefined): number | null {
  if (!duration) return null;
  const lower = duration.toLowerCase();
  const match = lower.match(/(\d+)\s*(min|mins|minute|minutes|h|hr|hrs|hour|hours|day|days)/i);
  if (!match) return null;

  const rawValue = match[1];
  if (!rawValue) return null;
  const value = Number.parseInt(rawValue, 10);
  const unit = (match[2] || '').toLowerCase();

  if (Number.isNaN(value) || value <= 0) return null;
  if (unit.startsWith('day')) return value * 24 * 60;
  if (unit.startsWith('h')) return value * 60;
  return value;
}

function isMedicationAction(action: ActionRecord): boolean {
  return MEDICATION_KEYWORDS.test(`${action.title} ${action.reason || ''}`);
}

function isLikelyDailyAction(action: ActionRecord): boolean {
  return DAILY_TASK_HINTS.test(`${action.title} ${action.reason || ''} ${action.duration || ''}`);
}

function rollForwardDailyIso(value: string): string | null {
  const date = new Date(value);
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

function isReminderIntent(text: string): boolean {
  return REMINDER_KEYWORDS.test(text) || TEMPORAL_HINTS.test(text) || CLOCK_TIME_HINT.test(text);
}

function deriveReminderFromDueDate(dueIso: string | null): string | null {
  if (!dueIso) return null;
  const due = new Date(dueIso);
  if (Number.isNaN(due.getTime())) return null;

  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  if (diffMs <= 0) return null;

  const minutesBefore = diffMs <= 24 * 60 * 60 * 1000 ? 30 : 120;
  const reminder = new Date(due.getTime() - minutesBefore * 60 * 1000);

  if (reminder.getTime() <= now.getTime()) {
    const fallback = new Date(now.getTime() + 5 * 60 * 1000);
    return fallback.toISOString();
  }

  return reminder.toISOString();
}

async function refreshGoogleToken(connection: any, adminClient: any): Promise<string | null> {
  if (!connection?.refresh_token) {
    return null;
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      return null;
    }

    const tokens = await tokenResponse.json();
    const expiresAt = Date.now() + ((tokens.expires_in || 3600) * 1000);

    await adminClient
      .from('user_google_calendar_connections')
      .update({
        access_token: tokens.access_token,
        expires_at: expiresAt,
        expires_in: tokens.expires_in,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return tokens.access_token || null;
  } catch {
    return null;
  }
}

async function createGoogleCalendarReminderEvent(params: {
  userId: string;
  title: string;
  description: string | null;
  reminderAtIso: string;
  actionId: string;
  todoId: string;
}): Promise<{ created: boolean; eventId: string | null }> {
  const { userId, title, description, reminderAtIso, actionId, todoId } = params;

  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    const { data: connection } = await supabase
      .from('user_google_calendar_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!connection || !connection.is_active || !connection.sync_enabled) {
      return { created: false, eventId: null };
    }

    let accessToken = connection.access_token;
    if (connection.expires_at && connection.expires_at <= Date.now()) {
      const refreshed = await refreshGoogleToken(connection, adminClient);
      if (!refreshed) {
        return { created: false, eventId: null };
      }
      accessToken = refreshed;
    }

    const start = new Date(reminderAtIso);
    if (Number.isNaN(start.getTime())) {
      return { created: false, eventId: null };
    }
    const end = new Date(start.getTime() + 15 * 60 * 1000);

    const eventPayload = {
      summary: `Reminder: ${title}`,
      description: description || `Force reminder for: ${title}`,
      start: {
        dateTime: start.toISOString(),
        timeZone: connection.calendar_timezone || 'UTC',
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: connection.calendar_timezone || 'UTC',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 0 },
        ],
      },
      extendedProperties: {
        private: {
          source: 'force-reminder',
          action_id: actionId,
          todo_id: todoId,
        },
      },
    };

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    });

    if (!response.ok) {
      return { created: false, eventId: null };
    }

    const createdEvent = await response.json();
    const eventId = typeof createdEvent?.id === 'string' ? createdEvent.id : null;

    if (eventId) {
      await supabase
        .from('ai_todos')
        .update({
          calendar_event_id: eventId,
          calendar_event_title: createdEvent?.summary || `Reminder: ${title}`,
        })
        .eq('id', todoId)
        .eq('user_id', userId);
    }

    return { created: Boolean(eventId), eventId };
  } catch {
    return { created: false, eventId: null };
  }
}

function fallbackPlan(action: ActionRecord): GeneratedTodoPlan {
  const now = new Date();
  const durationMinutes = parseDurationMinutes(action.duration);
  const dueDate = new Date(now.getTime() + (durationMinutes ?? 8 * 60) * 60 * 1000);
  const meds = isMedicationAction(action);
  const reminder = meds
    ? new Date(Math.max(now.getTime() + 5 * 60 * 1000, dueDate.getTime() - 30 * 60 * 1000))
    : null;

  return {
    title: action.title,
    description: action.reason || `Take action on: ${action.title}`,
    priority: meds ? 'high' : 'medium',
    category: action.category || 'Personal',
    due_date: dueDate.toISOString(),
    reminder_at: reminder ? reminder.toISOString() : null,
  };
}

function cleanIso(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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
  return `${normalizeTaskTitleForDedupe(title)}::${toMinuteIsoOrNull(dueAt) || 'no_due'}`;
}

async function generateTodoPlan(
  request: NextRequest,
  action: ActionRecord,
  contextDetails?: string | null
): Promise<GeneratedTodoPlan> {
  const now = new Date();
  const contextBlock = contextDetails && contextDetails.trim().length > 0
    ? `\nUser follow-up details:\n${contextDetails.trim()}\n`
    : '';

  const prompt = `You are creating one actionable todo from a dashboard action in a wellness/productivity app.

Current time (ISO): ${now.toISOString()}
Action title: ${action.title}
Action reason: ${action.reason || 'N/A'}
Action duration hint: ${action.duration || 'N/A'}
Action category: ${action.category || 'Personal'}
${contextBlock}

Requirements:
- Output valid JSON only.
- Create one practical todo with automatic timing.
- If this looks like a time-bound or easy-to-forget commitment (meds, meetings, deadlines, payments, follow-ups), include reminder_at before due_date.
- due_date should be in the near future and realistic.
- reminder_at must be before due_date.
- If the action context includes interpersonal conflict, avoid harsh framing (no "cut them off" style advice); prefer balanced next steps like boundary-setting notes, conversation prep, and support check-ins.

Return this exact JSON shape:
{
  "title": "string",
  "description": "string",
  "priority": "high|medium|low",
  "category": "string",
  "due_date": "ISO datetime string or null",
  "reminder_at": "ISO datetime string or null"
}`;

  let llmData: any;
  try {
    llmData = await executeLLMRequest({
      prompt,
      provider: 'claude',
      options: { temperature: 0.2 },
    });
  } catch (err) {
    console.warn('[add-to-todo] LLM planning failed, using fallback plan:', err);
    return fallbackPlan(action);
  }
  const rawText = String(llmData?.text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(rawText) as Partial<GeneratedTodoPlan>;
    const priority = parsed.priority === 'high' || parsed.priority === 'low' ? parsed.priority : 'medium';
    const due = cleanIso(parsed.due_date);
    const reminder = cleanIso(parsed.reminder_at);
    const dailyLike = isLikelyDailyAction(action);

    // Ensure reminder is before due date and in future.
    const nowTs = Date.now();
    const dueTs = due ? new Date(due).getTime() : null;
    const reminderTs = reminder ? new Date(reminder).getTime() : null;

    const safeDue = dueTs && dueTs > nowTs ? due : null;
    let safeReminder =
      reminderTs && reminderTs > nowTs && (!dueTs || reminderTs < dueTs)
        ? reminder
        : null;

    if (!safeReminder && reminder && dailyLike) {
      const rolled = rollForwardDailyIso(reminder);
      const rolledTs = rolled ? new Date(rolled).getTime() : null;
      if (rolled && rolledTs && (!dueTs || rolledTs < dueTs || !safeDue)) {
        safeReminder = rolled;
      }
    }

    return {
      title: (parsed.title || action.title || 'Follow up').toString().slice(0, 120),
      description: (parsed.description || action.reason || `Take action on: ${action.title}`).toString(),
      priority,
      category: (parsed.category || action.category || 'Personal').toString(),
      due_date: safeDue,
      reminder_at: safeReminder,
    };
  } catch {
    return fallbackPlan(action);
  }
}

// ─── POST: Create a todo from an action ────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ actionId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { actionId } = await params;
    const body = (await request.json().catch(() => ({}))) as Partial<AddToTodoRequest> & { auto_generate?: boolean };

    // Verify the action exists and belongs to the user
    const { data: action, error: actionError } = await supabase
      .from('user_actions')
      .select('id, title, reason, duration, category, journal_id')
      .eq('id', actionId)
      .eq('user_id', user.id)
      .single();

    if (actionError || !action) {
      return NextResponse.json({ error: 'Action not found or access denied' }, { status: 404 });
    }

    // Check if a todo already exists for this action
    const { data: existingTodo } = await supabase
      .from('ai_todos')
      .select('id, title')
      .eq('action_id', actionId)
      .eq('user_id', user.id)
      .single();

    if (existingTodo) {
      return NextResponse.json({ 
        error: 'A todo already exists for this action',
        existing_todo: existingTodo,
      }, { status: 409 });
    }

    const actionRecord = action as ActionRecord;
    const contextDetails = typeof body.context_details === 'string' ? body.context_details.trim() : '';
    const shouldAutoGenerate = body.auto_generate !== false;
    const generated = shouldAutoGenerate ? await generateTodoPlan(request, actionRecord, contextDetails) : null;

    const inputDueDate = cleanIso(body.due_date);
    const inputReminderAt = cleanIso(body.reminder_at);

    const resolvedTitle = body.title || generated?.title || actionRecord.title;
    const generatedDescription = body.description ?? generated?.description ?? actionRecord.reason ?? null;
    const resolvedDescription = contextDetails
      ? `${generatedDescription || `Take action on: ${resolvedTitle}`}${generatedDescription?.includes(contextDetails) ? '' : `\n\nFollow-up details: ${contextDetails}`}`
      : generatedDescription;
    const resolvedPriority = body.priority ?? generated?.priority ?? 'medium';
    const resolvedDueDate = inputDueDate ?? generated?.due_date ?? null;
    const resolvedCategory = body.category ?? generated?.category ?? actionRecord.category ?? 'Personal';
    let resolvedReminderAt = inputReminderAt ?? generated?.reminder_at ?? null;
    const resolvedJournalId = resolveJournalId(body.journal_id, actionRecord.journal_id);
    const actionText = `${resolvedTitle} ${resolvedDescription || ''} ${actionRecord.reason || ''}`;
    const reminderIntent = isReminderIntent(actionText);

    if (!resolvedReminderAt && reminderIntent) {
      const inferredReminder = inferNextIsoFromTimeText(actionText);
      if (inferredReminder) {
        resolvedReminderAt = inferredReminder;
      }
    }

    if (!resolvedReminderAt && reminderIntent) {
      resolvedReminderAt = deriveReminderFromDueDate(resolvedDueDate);
    }


    if (!resolvedTitle) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    // Prevent duplicates from repeated one-click submissions.
    const candidateKey = buildTaskDedupeKey(resolvedTitle, resolvedDueDate);
    const { data: existingTodos } = await supabase
      .from('ai_todos')
      .select('id,title,due_date')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress']);

    const duplicateTodo = (existingTodos || []).find((todo) =>
      buildTaskDedupeKey(todo.title || '', cleanIso(todo.due_date || null)) === candidateKey
    );

    if (duplicateTodo) {
      return NextResponse.json({
        error: 'A similar todo already exists',
        existing_todo: duplicateTodo,
      }, { status: 409 });
    }

    // Create the todo
    const todoData = {
      user_id: user.id,
      title: resolvedTitle,
      description: resolvedDescription,
      priority: resolvedPriority,
      status: 'pending',
      due_date: resolvedDueDate,
      category: resolvedCategory,
      is_manual: false,
      action_id: actionId,
      journal_id: resolvedJournalId,
      source_type: 'action',
      reminder_at: resolvedReminderAt,
    };

    const { data: todo, error: todoError } = await supabase
      .from('ai_todos')
      .insert(todoData)
      .select()
      .single();

    if (todoError) {
      console.error('Failed to create todo:', todoError);
      return NextResponse.json({ error: 'Failed to create todo', details: todoError.message }, { status: 500 });
    }

    // Create reminder notification if reminder_at is set
    let notificationId: string | null = null;
    let calendarReminderEventId: string | null = null;
    if (resolvedReminderAt && todo) {
      try {
        const reminderDate = new Date(resolvedReminderAt);
        if (!Number.isNaN(reminderDate.getTime())) {
          const reminderResult = await reminderScheduler.schedule({
            userId: user.id,
            todoId: todo.id,
            actionId,
            title: resolvedTitle,
            body: resolvedDescription || `Don't forget: ${resolvedTitle}`,
            reminderAt: reminderDate,
            reminderType: 'custom',
          });

          if (reminderResult.success) {
            notificationId = reminderResult.notificationId;
          }

          const calendarReminderResult = await createGoogleCalendarReminderEvent({
            userId: user.id,
            title: resolvedTitle,
            description: resolvedDescription,
            reminderAtIso: resolvedReminderAt,
            actionId,
            todoId: todo.id,
          });

          if (calendarReminderResult.created) {
            calendarReminderEventId = calendarReminderResult.eventId;
          }
        }
      } catch (notifErr) {
        console.warn('Failed to schedule reminder notification:', notifErr);
        // Don't fail the todo creation if notification fails
      }
    }

    // Create link in action_todo_links table
    try {
      await supabase.from('action_todo_links').insert({
        action_id: actionId,
        todo_id: todo.id,
        user_id: user.id,
        link_type: 'direct',
      });
    } catch (linkErr) {
      console.warn('Failed to create action_todo_link:', linkErr);
      // Non-critical, don't fail
    }

    return NextResponse.json({
      success: true,
      todo: {
        ...todo,
        notification_id: notificationId,
        calendar_reminder_event_id: calendarReminderEventId,
      },
      notification_id: notificationId,
      calendar_reminder_event_id: calendarReminderEventId,
      calendar_reminder_created: Boolean(calendarReminderEventId),
      generated_fields: shouldAutoGenerate,
    });
  } catch (err) {
    console.error('POST /api/actions/[actionId]/add-to-todo error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── GET: Check if a todo exists for this action ───────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ actionId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { actionId } = await params;

    const { data: todo, error } = await supabase
      .from('ai_todos')
      .select('id, title, status, due_date, priority')
      .eq('action_id', actionId)
      .eq('user_id', user.id)
      .single();

    if (error || !todo) {
      return NextResponse.json({ exists: false, todo: null });
    }

    return NextResponse.json({ exists: true, todo });
  } catch (err) {
    console.error('GET /api/actions/[actionId]/add-to-todo error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

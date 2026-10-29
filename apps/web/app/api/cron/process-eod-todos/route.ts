// apps/web/app/api/cron/process-eod-todos/route.ts
// Vercel Cron job: notify users when non-scheduled, non-daily tasks remain open past 24h.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { notificationService } from '@/utils/notifications/notificationService';

const CRON_SECRET = process.env.CRON_SECRET;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type TodoRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done';
  due_date: string | null;
  reminder_at: string | null;
  created_at: string | null;
};

function isPastWindow(createdAt: string | null): boolean {
  if (!createdAt) return false;
  const ts = new Date(createdAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts >= WINDOW_MS;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const admin = createAdminClient();
    const windowStartIso = new Date(Date.now() - WINDOW_MS).toISOString();

    const { data: todos, error: todoError } = await admin
      .from('ai_todos')
      .select('id,user_id,title,description,status,due_date,reminder_at,created_at')
      .in('status', ['pending', 'in_progress'])
      .is('due_date', null)
      .is('reminder_at', null)
      .lte('created_at', windowStartIso)
      .limit(500);

    if (todoError) {
      throw todoError;
    }

    let scanned = 0;
    let sent = 0;
    let skippedDaily = 0;
    let skippedDuplicate = 0;
    let errors = 0;

    for (const todo of (todos || []) as TodoRow[]) {
      scanned += 1;

      if (!isPastWindow(todo.created_at)) {
        continue;
      }

      const taskText = `${todo.title || ''} ${todo.description || ''}`;
      if (notificationService.isLikelyDailyTask(taskText)) {
        skippedDaily += 1;
        continue;
      }

      const { data: dailyReminderLink } = await admin
        .from('notifications')
        .select('id')
        .eq('recipient_id', todo.user_id)
        .eq('type', 'reminder')
        .contains('data', { todo_id: todo.id, is_recurring_daily: true })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dailyReminderLink?.id) {
        skippedDaily += 1;
        continue;
      }

      const { data: existing } = await admin
        .from('notifications')
        .select('id')
        .eq('recipient_id', todo.user_id)
        .eq('template_key', 'todo_eod_missed_v1')
        .contains('data', { todo_id: todo.id })
        .gte('created_at', windowStartIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        skippedDuplicate += 1;
        continue;
      }

      const { error: sendError } = await notificationService.send({
        recipientId: todo.user_id,
        templateKey: 'todo_eod_missed_v1',
        type: 'system',
        title: 'Task still open past EOD',
        body: `\"${todo.title}\" was not completed by end of day. Please revisit or reschedule it.`,
        priority: 'high',
        channels: ['in_app'],
        data: {
          todo_id: todo.id,
          action_url: `/todo?highlight=${todo.id}`,
          source: 'eod_missed_sweep',
        },
      });

      if (sendError) {
        errors += 1;
      } else {
        sent += 1;
      }
    }

    return NextResponse.json({
      success: true,
      scanned,
      sent,
      skippedDaily,
      skippedDuplicate,
      errors,
      message: 'EOD task sweep completed',
    });
  } catch (err) {
    console.error('[ProcessEodTodos] Critical error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

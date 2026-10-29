// apps/web/utils/notifications/reminderScheduler.ts
// Specialized reminder scheduler for todos and actions

import { createAdminClient } from '@/utils/supabase/admin';
import { notificationService } from './notificationService';
import type { Notification, NotificationData } from '@/types/notifications';

interface ScheduleReminderParams {
  userId: string;
  todoId?: string;
  actionId?: string;
  title: string;
  body?: string;
  reminderAt: Date;
  reminderType?: 'before_due' | 'at_due' | 'custom';
  recurring?: 'daily' | 'none';
}

interface ReminderResult {
  success: boolean;
  notificationId: string | null;
  error: string | null;
}

interface UpdateReminderParams {
  notificationId: string;
  reminderAt?: Date;
  title?: string;
  body?: string;
}

/**
 * Reminder scheduler service for todos and actions
 */
export const reminderScheduler = {
  isLikelyDailyReminder(text?: string | null): boolean {
    if (!text) return false;
    return /\b(daily|every day|everyday|each day|every morning|every evening|nightly|med|meds|medication|medicine|pill|dose|tablet|supplement|insulin)\b/i.test(text);
  },

  rollForwardDaily(base: Date, now = new Date()): Date {
    const next = new Date(base);
    while (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  },

  /**
   * Schedule a reminder notification
   */
  async schedule(params: ScheduleReminderParams): Promise<ReminderResult> {
    const {
      userId,
      todoId,
      actionId,
      title,
      body,
      reminderAt,
      reminderType = 'custom',
      recurring,
    } = params;

    try {
      const inferredDaily = recurring === 'daily' || this.isLikelyDailyReminder(`${title} ${body || ''}`);
      const normalizedReminderAt = inferredDaily && reminderAt.getTime() <= Date.now()
        ? this.rollForwardDaily(reminderAt)
        : reminderAt;

      // Build notification data
      const data: NotificationData = {
        reminder_type: reminderType,
        scheduled_time: normalizedReminderAt.toISOString(),
        is_recurring_daily: inferredDaily,
      };

      if (todoId) {
        data.todo_id = todoId;
        data.action_url = `/dashboard?tab=todos&highlight=${todoId}`;
      }

      if (actionId) {
        data.action_id = actionId;
        data.action_url = `/dashboard?tab=actions&highlight=${actionId}`;
      }

      // Create scheduled notification
      const { notification, error } = await notificationService.scheduleReminder({
        recipientId: userId,
        remindAt: normalizedReminderAt.toISOString(),
        title,
        body: body || `Reminder for: ${title}`,
        data,
        type: 'reminder',
        priority: 'high',
      });

      if (error) {
        throw error;
      }

      // Link notification to todo if applicable
      if (notification && todoId) {
        const adminClient = createAdminClient();
        await adminClient
          .from('ai_todos')
          .update({
            notification_id: notification.id,
            reminder_at: normalizedReminderAt.toISOString(),
          })
          .eq('id', todoId);
      }

      return {
        success: true,
        notificationId: notification?.id || null,
        error: null,
      };
    } catch (err) {
      console.error('[ReminderScheduler] schedule error:', err);
      return {
        success: false,
        notificationId: null,
        error: err instanceof Error ? err.message : 'Failed to schedule reminder',
      };
    }
  },

  /**
   * Cancel a scheduled reminder
   */
  async cancel(notificationId: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const adminClient = createAdminClient();

      // Check if notification exists and is still scheduled
      const { data: notification, error: fetchError } = await adminClient
        .from('notifications')
        .select('id, status, data')
        .eq('id', notificationId)
        .single();

      if (fetchError || !notification) {
        return { success: false, error: 'Notification not found' };
      }

      if (notification.status !== 'queued') {
        return { success: false, error: 'Reminder has already been delivered' };
      }

      // Delete the notification and its deliveries
      await adminClient
        .from('notification_deliveries')
        .delete()
        .eq('notification_id', notificationId);

      await adminClient
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      // Remove reference from todo if linked
      const notificationData = notification.data as NotificationData | null;
      if (notificationData?.todo_id) {
        await adminClient
          .from('ai_todos')
          .update({
            notification_id: null,
            reminder_at: null,
          })
          .eq('id', notificationData.todo_id);
      }

      return { success: true, error: null };
    } catch (err) {
      console.error('[ReminderScheduler] cancel error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to cancel reminder',
      };
    }
  },

  /**
   * Update a scheduled reminder
   */
  async update(params: UpdateReminderParams): Promise<ReminderResult> {
    const { notificationId, reminderAt, title, body } = params;

    try {
      const adminClient = createAdminClient();

      // Check if notification exists and is still scheduled
      const { data: notification, error: fetchError } = await adminClient
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (fetchError || !notification) {
        return { success: false, notificationId: null, error: 'Notification not found' };
      }

      if (notification.status !== 'queued') {
        return { success: false, notificationId: null, error: 'Reminder has already been delivered' };
      }

      // Build update object
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (reminderAt) {
        updates.scheduled_for = reminderAt.toISOString();
        // Also update the data field
        const data = (notification.data as NotificationData) || {};
        data.scheduled_time = reminderAt.toISOString();
        updates.data = data;
      }

      if (title) {
        updates.title = title;
      }

      if (body) {
        updates.body = body;
      }

      // Update notification
      const { error: updateError } = await adminClient
        .from('notifications')
        .update(updates)
        .eq('id', notificationId);

      if (updateError) {
        throw updateError;
      }

      // Update todo reminder_at if linked
      if (reminderAt) {
        const notificationData = notification.data as NotificationData | null;
        if (notificationData?.todo_id) {
          await adminClient
            .from('ai_todos')
            .update({ reminder_at: reminderAt.toISOString() })
            .eq('id', notificationData.todo_id);
        }
      }

      return {
        success: true,
        notificationId,
        error: null,
      };
    } catch (err) {
      console.error('[ReminderScheduler] update error:', err);
      return {
        success: false,
        notificationId: null,
        error: err instanceof Error ? err.message : 'Failed to update reminder',
      };
    }
  },

  /**
   * Get reminder for a todo
   */
  async getForTodo(todoId: string): Promise<Notification | null> {
    try {
      const adminClient = createAdminClient();

      const { data: todo, error } = await adminClient
        .from('ai_todos')
        .select('notification_id')
        .eq('id', todoId)
        .single();

      if (error || !todo?.notification_id) {
        return null;
      }

      const { data: notification } = await adminClient
        .from('notifications')
        .select('*')
        .eq('id', todo.notification_id)
        .single();

      return notification as Notification | null;
    } catch {
      return null;
    }
  },

  /**
   * Schedule reminder relative to due date
   */
  async scheduleRelativeToDue(params: {
    userId: string;
    todoId: string;
    title: string;
    dueDate: Date;
    beforeMinutes: number; // e.g., 15, 30, 60, 1440 (1 day)
  }): Promise<ReminderResult> {
    const { userId, todoId, title, dueDate, beforeMinutes } = params;

    const reminderAt = new Date(dueDate.getTime() - beforeMinutes * 60 * 1000);

    // Don't schedule if reminder time is in the past
    if (reminderAt <= new Date()) {
      return {
        success: false,
        notificationId: null,
        error: 'Reminder time would be in the past',
      };
    }

    const timeLabel = this.getTimeLabel(beforeMinutes);
    const body = `Due ${timeLabel}: ${title}`;

    return this.schedule({
      userId,
      todoId,
      title: `Upcoming: ${title}`,
      body,
      reminderAt,
      reminderType: 'before_due',
    });
  },

  /**
   * Get human-readable time label
   */
  getTimeLabel(minutes: number): string {
    if (minutes < 60) {
      return `in ${minutes} minutes`;
    } else if (minutes === 60) {
      return 'in 1 hour';
    } else if (minutes < 1440) {
      const hours = Math.round(minutes / 60);
      return `in ${hours} hours`;
    } else if (minutes === 1440) {
      return 'in 1 day';
    } else {
      const days = Math.round(minutes / 1440);
      return `in ${days} days`;
    }
  },
};

export default reminderScheduler;

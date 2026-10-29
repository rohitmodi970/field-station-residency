// apps/web/utils/notifications/notificationService.ts
// Server-side notification service

import { createAdminClient } from '@/utils/supabase/admin';
import { dispatchNotificationChannels } from '@/utils/notifications/channelDispatcher';
import {
  isEmailDeliveryAvailable,
  shouldDeliverImportantTaskEmail,
} from '@/utils/notifications/channels/email';
import type {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationData,
  UserNotificationSettings,
} from '@/types/notifications';

interface SendNotificationParams {
  recipientId: string;
  templateKey?: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
  scheduledFor?: string;
  bypassUserPreferences?: boolean;
}

interface ScheduleReminderParams {
  recipientId: string;
  remindAt: string;
  title: string;
  body: string;
  data?: NotificationData;
  type?: NotificationType;
  priority?: NotificationPriority;
}

type DailyNotificationReason =
  | 'analysis_ready'
  | 'important_task_due'
  | 'agent_completed'
  | 'reengagement';

interface DailyNotificationCandidate {
  recipientId: string;
  reason: DailyNotificationReason;
  type: NotificationType;
  priority: NotificationPriority;
  templateKey: string;
  title: string;
  body: string;
  data?: NotificationData;
  channels?: NotificationChannel[];
}

interface DailySweepResult {
  scannedUsers: number;
  sent: number;
  skippedPushAlreadySent: number;
  skippedNoCandidate: number;
  skippedSuppressed: number;
  errors: number;
}

const DAILY_REENGAGEMENT_INACTIVE_DAYS = Number.parseInt(
  process.env.NOTIFICATION_REENGAGEMENT_INACTIVE_DAYS || '7',
  10
);

const DAILY_TASK_HINT_RE = /\b(daily|every day|everyday|each day|every morning|every evening|every night|morning|evening|nightly|night|med|meds|medication|medicine|pill|dose|tablet|supplement|insulin|meeting)\b/i;

function normalizeNotificationTypeForDb(type: NotificationType): string {
  switch (type) {
    case 'action':
      return 'system';
    case 'journal':
      return 'system';
    case 'reminder':
      return 'system';
    case 'achievement':
      return 'success';
    case 'social':
      return 'info';
    // Collaboration notification types → 'info'
    case 'collab_invite_received':
    case 'collab_invite_accepted':
    case 'collab_invite_declined':
    case 'collab_removed':
    case 'collab_role_changed':
    case 'collab_left':
    case 'collab_key_ready':
    case 'collab_ownership_transferred':
    case 'collab_key_reset_needed':
      return 'info';
    case 'system':
    default:
      return 'system';
  }
}

function isInvalidNotificationTypeEnumError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { code?: string; message?: string };
  return anyErr.code === '22P02' && (anyErr.message || '').includes('notification_type');
}

function normalizeUnknownError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === 'object') {
    const anyErr = err as { message?: string; code?: string; details?: string | null };
    const message = anyErr.message || anyErr.code || anyErr.details || 'Unknown error';
    return new Error(message);
  }
  return new Error(String(err || 'Unknown error'));
}

/**
 * Notification service for server-side operations
 */
export const notificationService = {
  isLikelyDailyTask(text?: string | null): boolean {
    if (!text) return false;
    return DAILY_TASK_HINT_RE.test(text);
  },

  rollDailyReminderForward(baseIso: string, now = new Date()): string | null {
    const base = new Date(baseIso);
    if (Number.isNaN(base.getTime())) return null;

    const next = new Date(base);
    while (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  },

  async ensureTodoReminderCoverage(recipientId: string): Promise<void> {
    try {
      const adminClient = createAdminClient();
      const now = new Date();

      const { data: todos } = await adminClient
        .from('ai_todos')
        .select('id,title,description,status,reminder_at,due_date,action_id,notification_id')
        .eq('user_id', recipientId)
        .in('status', ['pending', 'in_progress'])
        .limit(200);

      for (const todo of todos || []) {
        const title = String(todo.title || 'Task reminder');
        const description = typeof todo.description === 'string' ? todo.description : null;
        const taskText = `${title} ${description || ''}`;
        const isDaily = this.isLikelyDailyTask(taskText);

        const reminderAtIso = typeof todo.reminder_at === 'string' ? todo.reminder_at : null;
        const dueDateIso = typeof todo.due_date === 'string' ? todo.due_date : null;

        let nextReminderIso: string | null = null;
        if (reminderAtIso) {
          const reminderDate = new Date(reminderAtIso);
          if (!Number.isNaN(reminderDate.getTime()) && reminderDate.getTime() > now.getTime()) {
            nextReminderIso = reminderDate.toISOString();
          } else if (isDaily) {
            nextReminderIso = this.rollDailyReminderForward(reminderAtIso, now);
          }
        } else if (isDaily && dueDateIso) {
          nextReminderIso = this.rollDailyReminderForward(dueDateIso, now);
        }

        if (!nextReminderIso) {
          continue;
        }

        const { data: queuedReminder } = await adminClient
          .from('notifications')
          .select('id,scheduled_for')
          .eq('recipient_id', recipientId)
          .eq('status', 'queued')
          .contains('data', { todo_id: todo.id })
          .gte('scheduled_for', now.toISOString())
          .order('scheduled_for', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (queuedReminder?.id) {
          continue;
        }

        const reminderData: NotificationData = {
          todo_id: todo.id,
          action_id: typeof todo.action_id === 'string' ? todo.action_id : undefined,
          action_url: `/dashboard?tab=todos&highlight=${todo.id}`,
          scheduled_time: nextReminderIso,
          is_recurring_daily: isDaily,
        };

        const body = description || `Reminder for: ${title}`;
        const { notification, error } = await this.scheduleReminder({
          recipientId,
          remindAt: nextReminderIso,
          title,
          body,
          data: reminderData,
          type: 'reminder',
          priority: 'high',
        });

        if (error || !notification?.id) {
          continue;
        }

        await adminClient
          .from('ai_todos')
          .update({
            notification_id: notification.id,
            reminder_at: nextReminderIso,
          })
          .eq('id', todo.id)
          .eq('user_id', recipientId);
      }
    } catch (err) {
      console.error('[NotificationService] ensureTodoReminderCoverage error:', err);
    }
  },

  /**
   * Send a notification to a user
   * Handles channel preferences and inserts into database
   */
  async send(params: SendNotificationParams): Promise<{ notification: Notification | null; error: Error | null }> {
    const {
      recipientId,
      templateKey,
      type,
      title,
      body,
      data,
      priority = 'normal',
      channels = ['in_app'],
      scheduledFor,
      bypassUserPreferences = false,
    } = params;

    try {
      const adminClient = createAdminClient();
      const normalizedType = normalizeNotificationTypeForDb(type);

      // Get user's notification settings
      const settings = await this.getUserSettings(recipientId);
      const emailDeliveryAvailable = await isEmailDeliveryAvailable(recipientId);

      // Filter channels based on user preferences unless explicitly bypassed.
      const enabledChannels = bypassUserPreferences
        ? channels.filter((channel) => {
            if (channel === 'email' && !emailDeliveryAvailable) return false;
            return true;
          })
        : channels.filter((channel) => {
            if (channel === 'in_app' && !settings?.in_app_enabled) return false;
            if (channel === 'email' && !emailDeliveryAvailable) return false;
            if (channel === 'push' && !settings?.push_enabled) return false;
            if (channel === 'sms' && !settings?.sms_enabled) return false;
            return true;
          });

      // Check if this notification type is muted
      if (!bypassUserPreferences && (settings?.muted_types?.includes(type) || settings?.muted_types?.includes(normalizedType as NotificationType))) {
        return { notification: null, error: null }; // Silently skip
      }

      // Check quiet hours (only for non-urgent)
      if (!bypassUserPreferences && priority !== 'urgent' && settings?.quiet_start && settings?.quiet_end) {
        const now = new Date();
        const userTime = settings.time_zone
          ? new Date(now.toLocaleString('en-US', { timeZone: settings.time_zone }))
          : now;
        const currentTime = `${userTime.getHours().toString().padStart(2, '0')}:${userTime.getMinutes().toString().padStart(2, '0')}`;

        if (this.isInQuietHours(currentTime, settings.quiet_start, settings.quiet_end)) {
          // Skip notification during quiet hours (or queue for later)
          return { notification: null, error: null };
        }
      }

      let finalChannels = enabledChannels;

      // Cap push to once per user per day, but do not block in-app/email/sms notifications.
      if (finalChannels.includes('push')) {
        const pushAlreadySentToday = await this.hasPushNotificationToday(recipientId);
        if (pushAlreadySentToday) {
          finalChannels = finalChannels.filter((channel) => channel !== 'push');
        }
      }

      // If all channels are filtered out, skip
      if (finalChannels.length === 0) {
        return { notification: null, error: null };
      }

      const now = Date.now();
      const scheduledTimestamp = scheduledFor ? new Date(scheduledFor).getTime() : NaN;
      const isScheduled = Number.isFinite(scheduledTimestamp) && scheduledTimestamp > now;
      const normalizedScheduledFor = isScheduled ? new Date(scheduledTimestamp).toISOString() : null;

      // Insert notification. If enum typing drifts in DB, retry with `system` as a safe fallback.
      let notification: Notification | null = null;
      let insertError: unknown = null;

      const primaryInsert = await adminClient
        .from('notifications')
        .insert({
          recipient_id: recipientId,
          template_key: templateKey || null,
          type: normalizedType,
          title,
          body,
          data: data || null,
          priority,
          channels: finalChannels,
          status: isScheduled ? 'queued' : 'sent',
          scheduled_for: normalizedScheduledFor,
        })
        .select()
        .single();

      if (primaryInsert.error) {
        if (isInvalidNotificationTypeEnumError(primaryInsert.error) && normalizedType !== 'system') {
          const fallbackInsert = await adminClient
            .from('notifications')
            .insert({
              recipient_id: recipientId,
              template_key: templateKey || null,
              type: 'system',
              title,
              body,
              data: data || null,
              priority,
              channels: finalChannels,
              status: isScheduled ? 'queued' : 'sent',
              scheduled_for: normalizedScheduledFor,
            })
            .select()
            .single();

          if (fallbackInsert.error) {
            insertError = fallbackInsert.error;
          } else {
            notification = fallbackInsert.data as Notification;
          }
        } else {
          insertError = primaryInsert.error;
        }
      } else {
        notification = primaryInsert.data as Notification;
      }

      if (insertError || !notification) {
        throw (insertError || new Error('Notification insert returned no data'));
      }

      // Create delivery records for each channel
      if (notification && finalChannels.length > 0) {
        const deliveries = finalChannels.map((channel) => ({
          notification_id: notification.id,
          channel,
          status: isScheduled ? 'queued' : (channel === 'in_app' ? 'sent' : 'queued'),
        }));

        await adminClient.from('notification_deliveries').insert(deliveries);
      }

      if (!isScheduled && notification) {
        await dispatchNotificationChannels(notification, recipientId, finalChannels);
      }

      return { notification, error: null };
    } catch (err) {
      console.error('[NotificationService] Send error:', err);
      return { notification: null, error: normalizeUnknownError(err) };
    }
  },

  /**
   * Schedule a reminder notification for a future time
   */
  async scheduleReminder(params: ScheduleReminderParams): Promise<{ notification: Notification | null; error: Error | null }> {
    const {
      recipientId,
      remindAt,
      title,
      body,
      data,
      type = 'reminder',
      priority = 'high',
    } = params;

    return this.send({
      recipientId,
      templateKey: 'todo_reminder_v1',
      type,
      title,
      body,
      data: {
        ...(data || {}),
        reminder_at: remindAt,
      },
      priority,
      channels: ['in_app'],
      scheduledFor: remindAt,
    });
  },

  /**
   * Get user's notification settings
   */
  async getUserSettings(userId: string): Promise<UserNotificationSettings | null> {
    try {
      const adminClient = createAdminClient();

      const { data, error } = await adminClient
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found
        console.error('[NotificationService] Settings fetch error:', error);
        return null;
      }

      // Return default settings if none exist
      if (!data) {
        return {
          user_id: userId,
          in_app_enabled: true,
          email_enabled: false,
          push_enabled: false,
          sms_enabled: false,
          muted_types: [],
          quiet_start: null,
          quiet_end: null,
          time_zone: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      return data as UserNotificationSettings;
    } catch (err) {
      console.error('[NotificationService] getUserSettings error:', err);
      return null;
    }
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const adminClient = createAdminClient();

      const { error } = await adminClient
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('recipient_id', userId);

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const adminClient = createAdminClient();

      const { error } = await adminClient
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('recipient_id', userId)
        .eq('is_read', false);

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Dismiss a notification
   */
  async dismiss(notificationId: string, userId: string): Promise<boolean> {
    try {
      const adminClient = createAdminClient();

      const { error } = await adminClient
        .from('notifications')
        .update({
          is_dismissed: true,
          dismissed_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('recipient_id', userId);

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Process scheduled reminders that are due
   * Called by cron job
   */
  async processScheduledReminders(recipientId?: string): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      const adminClient = createAdminClient();

      if (recipientId) {
        await this.ensureTodoReminderCoverage(recipientId);
      }

      let query = adminClient
        .from('notifications')
        .select('*')
        .eq('status', 'queued')
        .not('scheduled_for', 'is', null)
        .lte('scheduled_for', new Date().toISOString())
        .limit(100);

      if (recipientId) {
        query = query.eq('recipient_id', recipientId);
      }

      const { data: dueReminders, error } = await query;

      if (error) throw error;

      if (!dueReminders || dueReminders.length === 0) {
        return { processed: 0, errors: 0 };
      }

      for (const reminder of dueReminders) {
        try {
          // Mark as sent once due reminder is released to channels
          await adminClient
            .from('notifications')
            .update({
              status: 'sent',
              updated_at: new Date().toISOString(),
            })
            .eq('id', reminder.id);

          const reminderChannels: NotificationChannel[] = Array.isArray(reminder.channels)
            ? (reminder.channels as NotificationChannel[])
            : ['in_app'];

          // Scheduled reminders are strictly in-app notifications. Never dispatch individual reminder emails.
          const channelsToDispatch = reminderChannels.filter(
            (channel) => channel !== 'email'
          );

          await dispatchNotificationChannels(
            reminder as Notification,
            reminder.recipient_id,
            channelsToDispatch
          );

          const reminderData = (reminder.data || {}) as NotificationData;
          const todoId = typeof reminderData.todo_id === 'string' ? reminderData.todo_id : null;
          if (todoId) {
            const { data: todo } = await adminClient
              .from('ai_todos')
              .select('id,user_id,title,description,status,reminder_at,action_id')
              .eq('id', todoId)
              .maybeSingle();

            if (todo?.id && (todo.status === 'pending' || todo.status === 'in_progress')) {
              const isDaily = Boolean(reminderData.is_recurring_daily)
                || this.isLikelyDailyTask(`${todo.title || ''} ${todo.description || ''}`);

              if (isDaily) {
                const baseReminderIso =
                  (typeof todo.reminder_at === 'string' && todo.reminder_at)
                  || (typeof reminder.scheduled_for === 'string' && reminder.scheduled_for)
                  || (typeof reminderData.reminder_at === 'string' ? reminderData.reminder_at : null);

                if (baseReminderIso) {
                  const nextReminderIso = this.rollDailyReminderForward(baseReminderIso, new Date(Date.now() + 1000));
                  if (nextReminderIso) {
                    const { data: alreadyQueued } = await adminClient
                      .from('notifications')
                      .select('id')
                      .eq('recipient_id', reminder.recipient_id)
                      .eq('status', 'queued')
                      .contains('data', { todo_id: todoId })
                      .gte('scheduled_for', new Date().toISOString())
                      .limit(1)
                      .maybeSingle();

                    if (!alreadyQueued?.id) {
                      const nextBody = (typeof todo.description === 'string' && todo.description)
                        ? todo.description
                        : `Reminder for: ${todo.title}`;

                      const { notification: nextNotification } = await this.scheduleReminder({
                        recipientId: reminder.recipient_id,
                        remindAt: nextReminderIso,
                        title: todo.title || reminder.title,
                        body: nextBody,
                        data: {
                          ...(reminderData || {}),
                          todo_id: todoId,
                          action_id: typeof todo.action_id === 'string' ? todo.action_id : reminderData.action_id,
                          action_url: `/dashboard?tab=todos&highlight=${todoId}`,
                          scheduled_time: nextReminderIso,
                          is_recurring_daily: true,
                        },
                        type: 'reminder',
                        priority: 'high',
                      });

                      if (nextNotification?.id) {
                        await adminClient
                          .from('ai_todos')
                          .update({
                            notification_id: nextNotification.id,
                            reminder_at: nextReminderIso,
                          })
                          .eq('id', todoId)
                          .eq('user_id', reminder.recipient_id);
                      }
                    }
                  }
                }
              }
            }
          }

          // TODO: Send push notification if applicable
          // const pushDelivery = await adminClient
          //   .from('notification_deliveries')
          //   .select('*')
          //   .eq('notification_id', reminder.id)
          //   .eq('channel', 'push')
          //   .single();
          // if (pushDelivery.data) {
          //   await this.sendPushNotification(reminder.recipient_id, reminder);
          // }

          processed++;
        } catch (err) {
          console.error(`[NotificationService] Error processing reminder ${reminder.id}:`, err);
          errors++;
        }
      }

      return { processed, errors };
    } catch (err) {
      console.error('[NotificationService] processScheduledReminders error:', err);
      return { processed, errors: errors + 1 };
    }
  },

  /**
   * Send analysis-ready as immediate in-app notification.
   * Push delivery remains governed by the daily push priority selector.
   */
  async sendAnalysisReadyInApp(recipientId: string, data?: NotificationData): Promise<{ notification: Notification | null; error: Error | null }> {
    return this.send({
      recipientId,
      templateKey: 'analysis_ready_v1',
      // Use system type so completion alerts are not suppressed when journal notifications are muted.
      type: 'system',
      title: 'Your latest analysis is ready',
      body: 'Open Force to review your new journal insight and next-step suggestions.',
      data,
      priority: 'urgent',
      channels: ['in_app'],
      // Analysis completion is a critical product signal and should always appear in-app.
      bypassUserPreferences: true,
    });
  },

  /**
   * Send Tinyfish completion as immediate in-app notification.
   * Push delivery remains governed by the daily push priority selector.
   */
  async sendAgentCompletedInApp(recipientId: string, data?: NotificationData): Promise<{ notification: Notification | null; error: Error | null }> {
    return this.send({
      recipientId,
      templateKey: 'agent_completed_v1',
      type: 'action',
      title: 'Tinyfish completed an action for you',
      body: 'Open Force to review what was completed and what to do next.',
      data,
      priority: 'normal',
      channels: ['in_app'],
    });
  },

  /**
   * Send at most one meaningful PUSH notification per user per day.
   * Priority order: analysis_ready > important_task_due > agent_completed > reengagement
   */
  async sendBestDailyPushNotificationForUser(recipientId: string): Promise<{ sent: boolean; reason: string }> {
    try {
      const pushAlreadySentToday = await this.hasPushNotificationToday(recipientId);
      if (pushAlreadySentToday) {
        return { sent: false, reason: 'push_already_sent_today' };
      }

      const candidate = await this.getDailyPriorityCandidate(recipientId);
      if (!candidate) {
        return { sent: false, reason: 'no_candidate' };
      }

      const { notification, error } = await this.send({
        recipientId: candidate.recipientId,
        templateKey: candidate.templateKey,
        type: candidate.type,
        title: candidate.title,
        body: candidate.body,
        data: {
          ...(candidate.data || {}),
          push_reason: candidate.reason,
        },
        priority: candidate.priority,
        channels: ['push'],
      });

      if (error) {
        return { sent: false, reason: `error:${error.message}` };
      }

      if (!notification) {
        return { sent: false, reason: 'suppressed_by_settings_or_quiet_hours' };
      }

      return { sent: true, reason: candidate.reason };
    } catch (err) {
      return { sent: false, reason: err instanceof Error ? err.message : 'unknown_error' };
    }
  },

  // Backward compatible alias.
  async sendBestDailyNotificationForUser(recipientId: string): Promise<{ sent: boolean; reason: string }> {
    return this.sendBestDailyPushNotificationForUser(recipientId);
  },

  async hasDailyDigestEmailToday(recipientId: string): Promise<boolean> {
    try {
      const adminClient = createAdminClient();
      const now = new Date();
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const { data: notification } = await adminClient
        .from('notifications')
        .select('id')
        .eq('recipient_id', recipientId)
        .eq('template_key', 'daily_important_tasks_digest_v1')
        .gte('created_at', dayStart.toISOString())
        .lt('created_at', dayEnd.toISOString())
        .limit(1)
        .maybeSingle();

      if (!notification?.id) {
        return false;
      }

      const { data: delivery } = await adminClient
        .from('notification_deliveries')
        .select('id')
        .eq('notification_id', notification.id)
        .eq('channel', 'email')
        .eq('status', 'sent')
        .limit(1)
        .maybeSingle();

      return Boolean(delivery?.id);
    } catch {
      return false;
    }
  },

  async getImportantTasksForDigest(recipientId: string) {
    try {
      const adminClient = createAdminClient();
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      const { data: todos, error } = await adminClient
        .from('ai_todos')
        .select('*')
        .eq('user_id', recipientId)
        .order('created_at', { ascending: false })
        .limit(150);

      if (error) {
        console.error('[NotificationService] getImportantTasksForDigest DB error:', error);
        return [];
      }

      if (!todos || todos.length === 0) {
        return [];
      }

      // Filter for unfinished tasks (status pending, in_progress, or null/empty)
      const unfinishedTodos = todos.filter((todo) => {
        const status = (todo.status || '').toLowerCase().trim();
        return status !== 'done' && status !== 'completed';
      });

      if (unfinishedTodos.length === 0) {
        return [];
      }

      // Sort with custom priority weighting:
      // 1. Primary tasks (is_primary = true)
      // 2. Overdue tasks (due_date < todayStart)
      // 3. Tasks due today
      // 4. High priority tasks
      // 5. Medium priority / other tasks
      const sortedTodos = [...unfinishedTodos].sort((a, b) => {
        // 1. Primary task first (if field exists)
        const aPrimary = Boolean(a.is_primary);
        const bPrimary = Boolean(b.is_primary);
        if (aPrimary !== bPrimary) return aPrimary ? -1 : 1;

        // Due date analysis
        const aDue = a.due_date ? new Date(a.due_date).getTime() : null;
        const bDue = b.due_date ? new Date(b.due_date).getTime() : null;

        const aOverdue = aDue !== null && aDue < todayStart;
        const bOverdue = bDue !== null && bDue < todayStart;
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

        // 3. High priority
        const aHigh = (a.priority || '').toLowerCase() === 'high';
        const bHigh = (b.priority || '').toLowerCase() === 'high';
        if (aHigh !== bHigh) return aHigh ? -1 : 1;

        // 4. Earlier due dates first (if both have due dates)
        if (aDue !== null && bDue !== null) {
          if (aDue !== bDue) return aDue - bDue;
        } else if (aDue !== null) {
          return -1;
        } else if (bDue !== null) {
          return 1;
        }

        // 5. More recently created first
        const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bCreated - aCreated;
      });

      // 1. Initial pass: build mapped tasks with smart heuristic extraction
      const mappedTasks = sortedTodos.slice(0, 50).map((t) => {
        const category = (t.category || '').trim() || 'Personal';
        let description = (t.description || '').trim();
        const reasoning = (t.ai_reasoning || '').trim();
        let title = (t.title || '').trim();

        // Check if title is missing or just category/generic fallback
        const isGeneric =
          !title ||
          title.toLowerCase() === category.toLowerCase() ||
          title.toLowerCase() === 'personal' ||
          title.toLowerCase() === 'task' ||
          title.toLowerCase() === 'untitled task' ||
          title.endsWith('Focus Task');

        if (isGeneric) {
          if (t.calendar_event_title && t.calendar_event_title.trim()) {
            title = t.calendar_event_title.trim();
          } else if (reasoning && reasoning.includes('[COGNITION_ENGINE]')) {
            const parts = reasoning.split('|').map((s: string) => s.trim());
            const meaningful = parts.filter(
              (p: string) =>
                p &&
                !p.startsWith('[COGNITION_ENGINE]') &&
                !p.startsWith('Mode:') &&
                !p.startsWith('Allocation:')
            );
            if (meaningful.length > 0) {
              const last = meaningful[meaningful.length - 1];
              title = last.startsWith('Insight:') ? last.replace('Insight:', '').trim() : last;
            }
          }
        }

        // If description has step list or clear sentence, extract title from it
        if (!title || title.toLowerCase() === category.toLowerCase() || title.toLowerCase() === 'personal' || title.endsWith('Focus Task')) {
          if (description && description.toLowerCase() !== category.toLowerCase() && description.toLowerCase() !== 'personal') {
            const cleanDesc = description.split(' | Steps: ')[0].split(' | ')[0].trim();
            title = cleanDesc.length > 60 ? cleanDesc.slice(0, 57) + '...' : cleanDesc;
          }
        }

        // If description is empty, check if reasoning has insight details
        if (!description && reasoning) {
          const parts = reasoning.split('|').map((s: string) => s.trim());
          const insight = parts.find((p: string) => p.startsWith('Insight:'));
          if (insight) {
            description = insight.replace('Insight:', '').trim();
          }
        }

        const needsRecovery =
          !title ||
          title.toLowerCase() === category.toLowerCase() ||
          title.toLowerCase() === 'personal' ||
          title.toLowerCase() === 'task' ||
          title.toLowerCase() === 'untitled task' ||
          title.endsWith('Focus Task');

        return {
          id: t.id,
          action_id: t.action_id || null,
          journal_id: t.journal_id || null,
          source_type: t.source_type || 'ai',
          title: title || `${category} Focus Task`,
          description: description || null,
          category,
          due_date: t.due_date || null,
          priority: t.priority || 'medium',
          is_primary: Boolean(t.is_primary),
          status: t.status || 'pending',
          ai_reasoning: reasoning || null,
          _needsRecovery: needsRecovery,
        };
      });

      // 2. Comprehensive Recovery: check notifications, reminder schedules, user_actions, and cognition_responses
      const tasksNeedingRecovery = mappedTasks.filter((t) => (t as any)._needsRecovery);
      if (tasksNeedingRecovery.length > 0) {
        try {
          const recoveryMap = new Map<string, { title: string; description?: string | null; category?: string | null }>();

          // A. Check recent digest notifications
          const { data: recentDigest } = await adminClient
            .from('notifications')
            .select('data')
            .eq('recipient_id', recipientId)
            .eq('template_key', 'daily_important_tasks_digest_v1')
            .order('created_at', { ascending: false })
            .limit(10);

          for (const row of recentDigest || []) {
            const digestTasks = (row.data as any)?.digest_tasks;
            if (!Array.isArray(digestTasks)) continue;
            for (const dt of digestTasks) {
              if (dt?.id && dt?.title && !dt.title.endsWith('Focus Task') && dt.title.toLowerCase() !== 'personal') {
                recoveryMap.set(dt.id, { title: dt.title, description: dt.description, category: dt.category });
              }
            }
          }

          // B. Check scheduled reminder notifications
          const { data: reminderNotifs } = await adminClient
            .from('notifications')
            .select('title, body, data')
            .eq('recipient_id', recipientId)
            .order('created_at', { ascending: false })
            .limit(50);

          for (const row of reminderNotifs || []) {
            const todoId = (row.data as any)?.todo_id;
            const actionId = (row.data as any)?.action_id;
            const notifTitle = (row.title || '').trim();
            const cleanTitle = notifTitle.replace(/^Reminder:\s*/i, '').replace(/^Reminder for:\s*/i, '').trim();

            if (cleanTitle && cleanTitle.toLowerCase() !== 'personal' && !cleanTitle.endsWith('Focus Task')) {
              if (todoId && !recoveryMap.has(todoId)) {
                recoveryMap.set(todoId, {
                  title: cleanTitle,
                  description: (row.body || '').replace(/^Reminder:\s*/i, '').replace(/^Don't forget:\s*/i, '').trim() || null,
                });
              }
              if (actionId) {
                for (const t of tasksNeedingRecovery) {
                  if (t.action_id === actionId && !recoveryMap.has(t.id)) {
                    recoveryMap.set(t.id, {
                      title: cleanTitle,
                      description: (row.body || '').replace(/^Reminder:\s*/i, '').trim() || null,
                    });
                  }
                }
              }
            }
          }

          // C. Check user_actions table if any task is linked to an action
          const actionIds = tasksNeedingRecovery.map((t) => t.action_id).filter(Boolean) as string[];
          if (actionIds.length > 0) {
            const { data: actions } = await adminClient
              .from('user_actions')
              .select('id, title, description, category')
              .in('id', actionIds);

            for (const action of actions || []) {
              if (action?.title && action.title.toLowerCase() !== 'personal') {
                for (const t of tasksNeedingRecovery) {
                  if (t.action_id === action.id && !recoveryMap.has(t.id)) {
                    recoveryMap.set(t.id, {
                      title: action.title,
                      description: action.description || null,
                      category: action.category || null,
                    });
                  }
                }
              }
            }
          }

          // D. Apply recovered data
          const updatedIds: string[] = [];
          for (const task of mappedTasks) {
            if ((task as any)._needsRecovery && recoveryMap.has(task.id)) {
              const recovered = recoveryMap.get(task.id)!;
              task.title = recovered.title;
              if (!task.description && recovered.description) {
                task.description = recovered.description;
              }
              if (recovered.category && (task.category === 'Personal' || !task.category)) {
                task.category = recovered.category;
              }
              (task as any)._needsRecovery = false;
              updatedIds.push(task.id);
            } else if ((task as any)._needsRecovery) {
              // Polish fallback title if still generic
              const cat = task.category || 'Personal';
              if (cat.toLowerCase() === 'work') {
                task.title = 'Review and advance priority work deliverables';
              } else if (cat.toLowerCase() === 'health') {
                task.title = 'Complete daily health & wellness routine';
              } else if (cat.toLowerCase() === 'career') {
                task.title = 'Progress on key career development milestones';
              } else if (cat.toLowerCase() === 'finance') {
                task.title = 'Review financial commitments and budgets';
              } else if (cat.toLowerCase() === 'learning') {
                task.title = 'Dedicated time for study and skill building';
              } else if (cat.toLowerCase() === 'reflection') {
                task.title = 'Mindful reflection & journaling check-in';
              } else if (cat.toLowerCase() === 'relationship') {
                task.title = 'Connect and follow up with key relationships';
              } else {
                task.title = 'Personal Focus & Next Key Action';
              }
              if (!task.description) {
                task.description = 'Structured action generated to help you maintain momentum today.';
              }
              updatedIds.push(task.id);
            }
          }

          // E. Persist recovered/refined plaintext to ai_todos so future cron runs read proper data directly
          if (updatedIds.length > 0) {
            Promise.allSettled(
              updatedIds.map((id) => {
                const task = mappedTasks.find((t) => t.id === id);
                if (!task) return Promise.resolve();
                return adminClient
                  .from('ai_todos')
                  .update({
                    title: task.title,
                    description: task.description,
                    category: task.category,
                  })
                  .eq('id', id)
                  .eq('user_id', recipientId);
              })
            ).catch(() => {/* fire-and-forget */});
          }
        } catch (recoveryErr) {
          console.warn('[NotificationService] Digest task recovery failed:', recoveryErr);
        }
      }

      // Clean up internal properties before returning
      return mappedTasks.map(({ _needsRecovery, action_id, journal_id, source_type, ...rest }: any) => rest);
    } catch (err) {
      console.error('[NotificationService] getImportantTasksForDigest error:', err);
      return [];
    }
  },

  async sendDailyImportantTasksDigestForUser(
    recipientId: string,
    options?: { bypassDailyLimit?: boolean; overrideTasks?: Array<{
      id: string;
      title: string;
      description?: string | null;
      due_date?: string | null;
      priority?: string | null;
      category?: string | null;
      allocation?: string | null;
      ai_reasoning?: string | null;
      is_primary?: boolean | null;
      status?: string | null;
    }> }
  ): Promise<{ sent: boolean; reason: string; taskCount?: number; recipient?: string | null; error?: string }> {
    try {
      if (!(await isEmailDeliveryAvailable(recipientId))) {
        return { sent: false, reason: 'email_unavailable' };
      }

      if (!options?.bypassDailyLimit && await this.hasDailyDigestEmailToday(recipientId)) {
        return { sent: false, reason: 'already_emailed_today' };
      }

      const tasks = options?.overrideTasks && options.overrideTasks.length > 0
        ? options.overrideTasks
        : await this.getImportantTasksForDigest(recipientId);
      if (tasks.length === 0) {
        return { sent: false, reason: 'no_tasks', taskCount: 0 };
      }

      const taskCount = tasks.length;
      const firstTask = tasks[0];
      const title = taskCount === 1
        ? 'Your unfinished task for today'
        : `Your ${taskCount} unfinished tasks for today`;
      const body = taskCount === 1 && firstTask
        ? `"${firstTask.title}" needs your attention today.`
        : `You have ${taskCount} unfinished tasks to focus on today.`;

      const { notification, error } = await this.send({
        recipientId,
        templateKey: 'daily_important_tasks_digest_v1',
        type: 'action',
        title,
        body,
        data: {
          link: '/dashboard?tab=todos',
          digest_tasks: tasks,
          task_count: taskCount,
        },
        priority: 'high',
        channels: ['email'],
        bypassUserPreferences: Boolean(options?.bypassDailyLimit),
      });

      if (error) {
        return { sent: false, reason: `error:${error.message}`, error: error.message };
      }

      if (!notification) {
        return { sent: false, reason: 'suppressed_by_settings' };
      }

      return { sent: true, reason: 'daily_digest_sent', taskCount };
    } catch (err) {
      return {
        sent: false,
        reason: err instanceof Error ? err.message : 'unknown_error',
        error: err instanceof Error ? err.message : 'unknown_error',
      };
    }
  },

  async runDailyImportantTasksDigestSweep(maxUsers = 500): Promise<{
    scannedUsers: number;
    sent: number;
    skippedNoTasks: number;
    skippedAlreadySent: number;
    skippedUnavailable: number;
    errors: number;
  }> {
    const result = {
      scannedUsers: 0,
      sent: 0,
      skippedNoTasks: 0,
      skippedAlreadySent: 0,
      skippedUnavailable: 0,
      errors: 0,
    };

    try {
      const adminClient = createAdminClient();

      // Collect user IDs from notification settings
      const { data: emailUsers } = await adminClient
        .from('user_notification_settings')
        .select('user_id')
        .eq('email_enabled', true)
        .limit(maxUsers);

      // Collect user IDs from active Gmail connections
      const { data: gmailUsers } = await adminClient
        .from('user_google_gmail_connections')
        .select('user_id')
        .eq('is_active', true)
        .limit(maxUsers);

      const targetUserIds = new Set<string>();
      for (const row of emailUsers || []) {
        if (row.user_id) targetUserIds.add(row.user_id);
      }
      for (const row of gmailUsers || []) {
        if (row.user_id) targetUserIds.add(row.user_id);
      }

      for (const userId of targetUserIds) {
        result.scannedUsers += 1;

        const sendResult = await this.sendDailyImportantTasksDigestForUser(userId);
        if (sendResult.sent) {
          result.sent += 1;
          continue;
        }

        if (sendResult.reason === 'no_tasks') {
          result.skippedNoTasks += 1;
          continue;
        }

        if (sendResult.reason === 'already_emailed_today') {
          result.skippedAlreadySent += 1;
          continue;
        }

        if (sendResult.reason === 'email_unavailable') {
          result.skippedUnavailable += 1;
          continue;
        }

        if (sendResult.reason.startsWith('error:')) {
          result.errors += 1;
        }
      }

      return result;
    } catch (err) {
      console.error('[NotificationService] runDailyImportantTasksDigestSweep error:', err);
      return { ...result, errors: result.errors + 1 };
    }
  },

  async hasImportantTaskEmailToday(recipientId: string, todoId: string): Promise<boolean> {
    try {
      const adminClient = createAdminClient();
      const now = new Date();
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const { data: notifications } = await adminClient
        .from('notifications')
        .select('id')
        .eq('recipient_id', recipientId)
        .contains('data', { todo_id: todoId })
        .gte('created_at', dayStart.toISOString())
        .lt('created_at', dayEnd.toISOString());

      const notificationIds = (notifications || []).map((row) => row.id).filter(Boolean);
      if (notificationIds.length === 0) {
        return false;
      }

      const { data: delivery } = await adminClient
        .from('notification_deliveries')
        .select('id')
        .in('notification_id', notificationIds)
        .eq('channel', 'email')
        .eq('status', 'sent')
        .limit(1)
        .maybeSingle();

      return Boolean(delivery?.id);
    } catch {
      return false;
    }
  },

  async sendImportantTaskDueEmailForUser(recipientId: string): Promise<{ sent: boolean; reason: string }> {
    // Redirect to daily digest to prevent individual ad-hoc emails from overriding the daily unfinished tasks digest
    return this.sendDailyImportantTasksDigestForUser(recipientId);
  },

  async runImportantTaskEmailSweep(maxUsers = 500): Promise<{
    scannedUsers: number;
    sent: number;
    skippedNoCandidate: number;
    skippedAlreadySent: number;
    skippedUnavailable: number;
    errors: number;
  }> {
    // Redirect to daily digest sweep
    const res = await this.runDailyImportantTasksDigestSweep(maxUsers);
    return {
      scannedUsers: res.scannedUsers,
      sent: res.sent,
      skippedNoCandidate: res.skippedNoTasks,
      skippedAlreadySent: res.skippedAlreadySent,
      skippedUnavailable: res.skippedUnavailable,
      errors: res.errors,
    };
  },

  /**
   * Daily sweep to enforce one meaningful push notification per user.
   */
  async runDailyPriorityPushSweep(maxUsers = 500): Promise<DailySweepResult> {
    const result: DailySweepResult = {
      scannedUsers: 0,
      sent: 0,
      skippedPushAlreadySent: 0,
      skippedNoCandidate: 0,
      skippedSuppressed: 0,
      errors: 0,
    };

    try {
      const adminClient = createAdminClient();
      const userIds = new Set<string>();

      const { data: settingUsers } = await adminClient
        .from('user_notification_settings')
        .select('user_id')
        .limit(maxUsers);

      for (const row of settingUsers || []) {
        if (row.user_id) userIds.add(row.user_id);
      }

      // Fallback if no explicit notification settings exist yet.
      if (userIds.size === 0) {
        const { data: users } = await adminClient
          .from('users')
          .select('id')
          .limit(maxUsers);

        for (const row of users || []) {
          if (row.id) userIds.add(row.id);
        }
      }

      for (const userId of userIds) {
        result.scannedUsers += 1;

        const sendResult = await this.sendBestDailyPushNotificationForUser(userId);

        if (sendResult.sent) {
          result.sent += 1;
          continue;
        }

        if (sendResult.reason === 'push_already_sent_today') {
          result.skippedPushAlreadySent += 1;
          continue;
        }

        if (sendResult.reason === 'no_candidate') {
          result.skippedNoCandidate += 1;
          continue;
        }

        if (sendResult.reason === 'suppressed_by_settings_or_quiet_hours') {
          result.skippedSuppressed += 1;
          continue;
        }

        result.errors += 1;
      }

      return result;
    } catch (err) {
      console.error('[NotificationService] runDailyPriorityPushSweep error:', err);
      return {
        ...result,
        errors: result.errors + 1,
      };
    }
  },

  // Backward compatible alias.
  async runDailyPrioritySweep(maxUsers = 500): Promise<DailySweepResult> {
    return this.runDailyPriorityPushSweep(maxUsers);
  },

  async hasPushNotificationToday(recipientId: string): Promise<boolean> {
    try {
      const adminClient = createAdminClient();
      const now = new Date();
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      const { data } = await adminClient
        .from('notifications')
        .select('id')
        .eq('recipient_id', recipientId)
        .contains('channels', ['push'])
        .gte('created_at', dayStart.toISOString())
        .lt('created_at', dayEnd.toISOString())
        .limit(1)
        .maybeSingle();

      return Boolean(data?.id);
    } catch {
      return false;
    }
  },

  // Backward compatible alias.
  async hasNotificationToday(recipientId: string): Promise<boolean> {
    return this.hasPushNotificationToday(recipientId);
  },

  async getDailyPriorityCandidate(recipientId: string): Promise<DailyNotificationCandidate | null> {
    const analysisCandidate = await this.getAnalysisReadyCandidate(recipientId);
    if (analysisCandidate) return analysisCandidate;

    const importantTaskCandidate = await this.getImportantTaskDueCandidate(recipientId);
    if (importantTaskCandidate) return importantTaskCandidate;

    const agentCandidate = await this.getAgentCompletedCandidate(recipientId);
    if (agentCandidate) return agentCandidate;

    const reengagementCandidate = await this.getReengagementCandidate(recipientId);
    if (reengagementCandidate) return reengagementCandidate;

    return null;
  },

  async getAnalysisReadyCandidate(recipientId: string): Promise<DailyNotificationCandidate | null> {
    try {
      const adminClient = createAdminClient();
      const analysisLookback = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const { data: latestJob } = await adminClient
        .from('audio_jobs')
        .select('hume_job_id, completed_at')
        .eq('user_id', recipientId)
        .eq('status', 'COMPLETED')
        .gte('completed_at', analysisLookback)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestJob?.hume_job_id) {
        return null;
      }

      // Avoid duplicate notification for the same analysis job.
      const { data: existing } = await adminClient
        .from('notifications')
        .select('id')
        .eq('recipient_id', recipientId)
        .eq('template_key', 'analysis_ready_v1')
        .contains('data', { analysis_job_id: latestJob.hume_job_id })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        return null;
      }

      return {
        recipientId,
        reason: 'analysis_ready',
        type: 'journal',
        priority: 'urgent',
        templateKey: 'analysis_ready_v1',
        title: 'Your latest analysis is ready',
        body: 'Open Force to review your new journal insight and next-step suggestions.',
        data: {
          analysis_job_id: latestJob.hume_job_id,
          link: '/analysis',
        },
      };
    } catch {
      return null;
    }
  },

  async getImportantTaskDueCandidate(recipientId: string): Promise<DailyNotificationCandidate | null> {
    try {
      const adminClient = createAdminClient();
      const now = new Date();
      const dueSoon = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const { data: todo } = await adminClient
        .from('ai_todos')
        .select('id, title, due_date')
        .eq('user_id', recipientId)
        .eq('priority', 'high')
        .in('status', ['pending', 'in_progress'])
        .not('due_date', 'is', null)
        .lte('due_date', dueSoon)
        .order('due_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!todo?.id) {
        return null;
      }

      const dueDate = todo.due_date ? new Date(todo.due_date) : null;
      const isOverdue = Boolean(dueDate && dueDate.getTime() < now.getTime());

      return {
        recipientId,
        reason: 'important_task_due',
        type: 'action',
        priority: 'high',
        templateKey: 'important_task_due_v1',
        title: isOverdue ? 'Important task overdue' : 'Important task due soon',
        body: `\"${todo.title}\" needs attention. Come back to Force to close the loop.`,
        data: {
          todo_id: todo.id,
          link: '/dashboard?tab=todos',
          overdue: isOverdue,
        },
      };
    } catch {
      return null;
    }
  },

  async getAgentCompletedCandidate(recipientId: string): Promise<DailyNotificationCandidate | null> {
    try {
      const adminClient = createAdminClient();
      const lookback = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

      const { data: knowledge } = await adminClient
        .from('user_knowledge')
        .select('id, content, last_seen_at')
        .eq('user_id', recipientId)
        .eq('knowledge_type', 'raw')
        .ilike('content', 'TinyFish completed registration%')
        .gte('last_seen_at', lookback)
        .order('last_seen_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!knowledge?.id) {
        return null;
      }

      const { data: recentAgentNotification } = await adminClient
        .from('notifications')
        .select('id')
        .eq('recipient_id', recipientId)
        .eq('template_key', 'agent_completed_v1')
        .gte('created_at', lookback)
        .limit(1)
        .maybeSingle();

      if (recentAgentNotification?.id) {
        return null;
      }

      return {
        recipientId,
        reason: 'agent_completed',
        type: 'action',
        priority: 'normal',
        templateKey: 'agent_completed_v1',
        title: 'Tinyfish completed an action for you',
        body: 'Open Force to review what was completed and what to do next.',
        data: {
          knowledge_id: knowledge.id,
          link: '/agent',
        },
      };
    } catch {
      return null;
    }
  },

  async getReengagementCandidate(recipientId: string): Promise<DailyNotificationCandidate | null> {
    try {
      const adminClient = createAdminClient();
      const inactivityDays = Number.isFinite(DAILY_REENGAGEMENT_INACTIVE_DAYS)
        ? DAILY_REENGAGEMENT_INACTIVE_DAYS
        : 7;

      const inactiveSince = new Date(Date.now() - inactivityDays * 24 * 60 * 60 * 1000);

      const { data: latestJournal } = await adminClient
        .from('journals')
        .select('created_at')
        .eq('user_id', recipientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestJournal?.created_at) {
        const latest = new Date(latestJournal.created_at);
        if (latest.getTime() >= inactiveSince.getTime()) {
          return null;
        }
      }

      const cooldownSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentReengagement } = await adminClient
        .from('notifications')
        .select('id')
        .eq('recipient_id', recipientId)
        .eq('template_key', 'reengagement_v1')
        .gte('created_at', cooldownSince)
        .limit(1)
        .maybeSingle();

      if (recentReengagement?.id) {
        return null;
      }

      return {
        recipientId,
        reason: 'reengagement',
        type: 'system',
        priority: 'low',
        templateKey: 'reengagement_v1',
        title: 'Your next meaningful entry is waiting',
        body: 'Come back to Force for one small check-in and a clearer next step.',
        data: {
          link: '/journal/new',
          inactive_days: inactivityDays,
        },
      };
    } catch {
      return null;
    }
  },

  /**
   * Check if current time is within quiet hours
   */
  isInQuietHours(currentTime: string, quietStart: string, quietEnd: string): boolean {
    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (quietStart > quietEnd) {
      return currentTime >= quietStart || currentTime < quietEnd;
    }
    return currentTime >= quietStart && currentTime < quietEnd;
  },

  /**
   * Render template with variables
   */
  renderTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  },
};

export default notificationService;

import { createAdminClient } from '@/utils/supabase/admin';
import type {
  DeliveryStatus,
  Notification,
  NotificationData,
  NotificationPriority,
} from '@/types/notifications';
import {
  sendDailyTasksDigestEmail,
  sendNotificationEmail,
} from '@/utilities/gmailSend';

const IMPORTANT_TASK_EMAIL_TEMPLATE_KEYS = new Set([
  'daily_important_tasks_digest_v1',
]);

export async function shouldDeliverImportantTaskEmail(params: {
  templateKey?: string | null;
  priority?: NotificationPriority;
  data?: NotificationData | null;
}): Promise<boolean> {
  if (params.templateKey && IMPORTANT_TASK_EMAIL_TEMPLATE_KEYS.has(params.templateKey)) {
    return true;
  }
  return false;
}

interface EmailDeliveryResult {
  success: boolean;
  status: DeliveryStatus;
  provider?: string;
  providerMessageId?: string;
  error?: string;
}

function getActionUrl(notification: Notification): string | undefined {
  const data = notification.data || {};
  if (typeof data.link === 'string' && data.link) {
    return data.link;
  }
  if (typeof data.action_url === 'string' && data.action_url) {
    return data.action_url;
  }
  return '/notifications';
}

export async function deliverEmail(
  notification: Notification,
  recipientId: string
): Promise<EmailDeliveryResult> {
  const adminClient = createAdminClient();

  try {
    let digestTasks = Array.isArray(notification.data?.digest_tasks)
      ? notification.data?.digest_tasks
      : null;

    const isTaskRelated =
      notification.template_key === 'daily_important_tasks_digest_v1' ||
      notification.template_key === 'important_task_due_v1' ||
      notification.template_key === 'todo_reminder_v1' ||
      notification.template_key === 'todo_eod_missed_v1' ||
      Boolean(notification.data?.todo_id) ||
      notification.title?.toLowerCase().includes('task');

    // If it is task-related, ALWAYS ensure we deliver the full list of unfinished tasks, never a single task alert!
    if (!digestTasks && isTaskRelated) {
      const { notificationService } = await import('@/utils/notifications/notificationService');
      const allUnfinishedTasks = await notificationService.getImportantTasksForDigest(recipientId);
      if (allUnfinishedTasks.length > 0) {
        digestTasks = allUnfinishedTasks;
      }
    }

    const result = digestTasks
      ? await sendDailyTasksDigestEmail({
          userId: recipientId,
          tasks: digestTasks as Array<{
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
          }>,
        })
      : isTaskRelated
        ? { success: true, provider: 'none' as const } // Silently skip if no unfinished tasks remain
        : await sendNotificationEmail({
            userId: recipientId,
            subject: notification.title,
            title: notification.title,
            body: notification.body,
            actionUrl: getActionUrl(notification),
          });

    if (!result.success) {
      await adminClient
        .from('notification_deliveries')
        .update({
          status: 'failed',
          provider: result.provider,
          error_message: result.error || 'Email delivery failed',
        })
        .eq('notification_id', notification.id)
        .eq('channel', 'email');

      return {
        success: false,
        status: 'failed',
        provider: result.provider,
        error: result.error,
      };
    }

    await adminClient
      .from('notification_deliveries')
      .update({
        status: 'sent',
        provider: result.provider,
        delivered_at: new Date().toISOString(),
      })
      .eq('notification_id', notification.id)
      .eq('channel', 'email');

    return {
      success: true,
      status: 'sent',
      provider: result.provider,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email delivery error';

    await adminClient
      .from('notification_deliveries')
      .update({
        status: 'failed',
        error_message: message,
      })
      .eq('notification_id', notification.id)
      .eq('channel', 'email');

    return {
      success: false,
      status: 'failed',
      error: message,
    };
  }
}

export async function isEmailDeliveryAvailable(userId: string): Promise<boolean> {
  const adminClient = createAdminClient();

  const { data: settings } = await adminClient
    .from('user_notification_settings')
    .select('email_enabled')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: gmailConn } = await adminClient
    .from('user_google_gmail_connections')
    .select('is_active')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  const emailEnabled = (settings?.email_enabled ?? false) || Boolean(gmailConn?.is_active);
  const smtpConfigured = Boolean(
    (process.env.SMTP_USER && process.env.SMTP_PASSWORD) ||
    (process.env.EMAIL_ADDRESS && process.env.EMAIL_PASSWORD)
  );

  return emailEnabled && smtpConfigured;
}

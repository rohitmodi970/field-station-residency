import type { Notification, NotificationChannel } from '@/types/notifications';
import { deliverEmail } from '@/utils/notifications/channels/email';
import { deliverInApp } from '@/utils/notifications/channels/inApp';

export async function dispatchNotificationChannels(
  notification: Notification,
  recipientId: string,
  channels: NotificationChannel[]
): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (channels.includes('in_app')) {
    tasks.push(deliverInApp(notification));
  }

  if (channels.includes('email')) {
    tasks.push(deliverEmail(notification, recipientId));
  }

  if (tasks.length === 0) {
    return;
  }

  await Promise.allSettled(tasks);
}

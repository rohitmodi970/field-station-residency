// apps/web/utils/notifications/channels/inApp.ts
// In-app notification delivery handler

import { createAdminClient } from '@/utils/supabase/admin';
import type { Notification, DeliveryStatus } from '@/types/notifications';

interface InAppDeliveryResult {
  success: boolean;
  status: DeliveryStatus;
  error?: string;
}

/**
 * Deliver an in-app notification
 * In-app notifications are delivered via database insertion which triggers
 * Supabase Realtime subscriptions
 */
export async function deliverInApp(notification: Notification): Promise<InAppDeliveryResult> {
  try {
    const adminClient = createAdminClient();

    // Mark notification as sent to align with DB enum values
    const { error } = await adminClient
      .from('notifications')
      .update({ status: 'sent' })
      .eq('id', notification.id);

    if (error) {
      throw error;
    }

    // Update the delivery record
    await adminClient
      .from('notification_deliveries')
      .update({
        status: 'sent',
        delivered_at: new Date().toISOString(),
      })
      .eq('notification_id', notification.id)
      .eq('channel', 'in_app');

    return {
      success: true,
      status: 'sent',
    };
  } catch (err) {
    console.error('[InAppChannel] Delivery error:', err);
    
    // Mark as failed
    try {
      const adminClient = createAdminClient();
      await adminClient
        .from('notification_deliveries')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
        })
        .eq('notification_id', notification.id)
        .eq('channel', 'in_app');
    } catch (updateErr) {
      console.error('[InAppChannel] Failed to update delivery status:', updateErr);
    }

    return {
      success: false,
      status: 'failed',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Check if in-app delivery is enabled for a user
 */
export async function isInAppEnabled(userId: string): Promise<boolean> {
  try {
    const adminClient = createAdminClient();
    
    const { data, error } = await adminClient
      .from('user_notification_settings')
      .select('in_app_enabled')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[InAppChannel] Error checking settings:', error);
      return true; // Default to enabled
    }

    // Default to enabled if no settings exist
    return data?.in_app_enabled ?? true;
  } catch {
    return true; // Default to enabled
  }
}

/**
 * Get undelivered in-app notifications for a user
 */
export async function getUndeliveredInAppNotifications(userId: string): Promise<Notification[]> {
  try {
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .eq('status', 'queued')
      .contains('channels', ['in_app'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []) as Notification[];
  } catch (err) {
    console.error('[InAppChannel] Error fetching undelivered:', err);
    return [];
  }
}

/**
 * Process and deliver queued in-app notifications
 */
export async function processQueuedInAppNotifications(): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  try {
    const adminClient = createAdminClient();
    const nowIso = new Date().toISOString();

    // Get queued notifications with in_app channel
    const { data: queuedNotifications, error } = await adminClient
      .from('notifications')
      .select('*')
      .eq('status', 'queued')
      .contains('channels', ['in_app'])
      .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
      .limit(100);

    if (error) throw error;

    if (!queuedNotifications || queuedNotifications.length === 0) {
      return { processed: 0, errors: 0 };
    }

    // Process each notification
    for (const notification of queuedNotifications) {
      const result = await deliverInApp(notification as Notification);
      if (result.success) {
        processed++;
      } else {
        errors++;
      }
    }
  } catch (err) {
    console.error('[InAppChannel] Process queue error:', err);
  }

  return { processed, errors };
}

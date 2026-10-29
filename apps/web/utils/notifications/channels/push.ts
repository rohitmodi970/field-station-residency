// apps/web/utils/notifications/channels/push.ts
// Web Push notification service using VAPID

import webpush from 'web-push';

// VAPID keys should be set in environment variables
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@forceapp.io';

// Initialize web-push with VAPID details
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface PushSubscription {
  id?: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

export interface PushResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  shouldRemove?: boolean;
  subscriptionId?: string;
}

class PushService {
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
    if (!this.isConfigured) {
      console.warn('[PushService] VAPID keys not configured. Push notifications will not work.');
    }
  }

  /**
   * Get the VAPID public key for client-side subscription
   */
  getPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  }

  /**
   * Check if push notifications are configured
   */
  isEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * Send a push notification to a single subscription
   */
  async sendPushNotification(
    subscription: PushSubscription,
    payload: PushPayload
  ): Promise<PushResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Push notifications not configured',
        subscriptionId: subscription.id,
      };
    }

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    try {
      const result = await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(payload),
        {
          TTL: 60 * 60, // 1 hour
          urgency: 'high',
        }
      );

      return {
        success: true,
        statusCode: result.statusCode,
        subscriptionId: subscription.id,
      };
    } catch (error: unknown) {
      const err = error as { statusCode?: number; message?: string };
      console.error('[PushService] Send error:', err);

      // Handle specific error codes
      const statusCode = err.statusCode;
      
      // 404 or 410 means the subscription is no longer valid
      const shouldRemove = statusCode === 404 || statusCode === 410;

      return {
        success: false,
        error: err.message || 'Unknown error',
        statusCode,
        shouldRemove,
        subscriptionId: subscription.id,
      };
    }
  }

  /**
   * Send push notifications to multiple subscriptions
   */
  async sendToMultiple(
    subscriptions: PushSubscription[],
    payload: PushPayload
  ): Promise<{
    successful: number;
    failed: number;
    results: PushResult[];
    subscriptionsToRemove: string[];
  }> {
    const results = await Promise.all(
      subscriptions.map((sub) => this.sendPushNotification(sub, payload))
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const subscriptionsToRemove = results
      .filter((r) => r.shouldRemove && r.subscriptionId)
      .map((r) => r.subscriptionId as string);

    return {
      successful,
      failed,
      results,
      subscriptionsToRemove,
    };
  }

  /**
   * Format a reminder notification payload
   */
  formatReminderPayload(options: {
    title: string;
    body: string;
    url?: string;
    notificationId?: string;
    todoId?: string;
    actionId?: string;
  }): PushPayload {
    return {
      title: options.title,
      body: options.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: options.notificationId || 'reminder',
      requireInteraction: true,
      vibrate: [200, 100, 200],
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
      data: {
        url: options.url || '/dashboard',
        notificationId: options.notificationId,
        todoId: options.todoId,
        actionId: options.actionId,
        type: 'reminder',
      },
    };
  }
}

export const pushService = new PushService();

// Client-side utilities
export const pushClient = {
  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 
      'serviceWorker' in navigator && 
      'PushManager' in window;
  },

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  },

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Push notifications not supported');
    }
    return await Notification.requestPermission();
  },

  /**
   * Register the service worker
   */
  async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    if (!this.isSupported()) {
      throw new Error('Service workers not supported');
    }
    return await navigator.serviceWorker.register('/sw.js');
  },

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscriptionJSON | null> {
    const permission = await this.requestPermission();
    if (permission !== 'granted') {
      return null;
    }

    const registration = await this.registerServiceWorker();
    
    // Get VAPID public key
    const response = await fetch('/api/push/vapid-key');
    const { publicKey } = await response.json();
    
    if (!publicKey) {
      throw new Error('VAPID public key not available');
    }

    // Convert VAPID key to Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
    });

    // Send subscription to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    });

    return subscription.toJSON();
  },

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<boolean> {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      // Notify server
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      
      await subscription.unsubscribe();
      return true;
    }
    
    return false;
  },

  /**
   * Get current push subscription
   */
  async getSubscription(): Promise<globalThis.PushSubscription | null> {
    if (!this.isSupported()) return null;
    
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  },
};

/**
 * Convert a base64 string to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

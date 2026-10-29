// apps/web/types/notifications.ts
// Notification system types

export type NotificationType = 
  | 'reminder'
  | 'action'
  | 'journal'
  | 'achievement'
  | 'system'
  | 'social'
  // ── Collaboration notification types ───────────────────────────
  | 'collab_invite_received'
  | 'collab_invite_accepted'
  | 'collab_invite_declined'
  | 'collab_removed'
  | 'collab_role_changed'
  | 'collab_left'
  | 'collab_key_ready'
  | 'collab_ownership_transferred'
  | 'collab_key_reset_needed';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms';

export type DeliveryStatus = 'queued' | 'sent' | 'failed' | 'cancelled' | 'bounced' | 'delivered' | 'sending' | 'skipped';

export interface Notification {
  id: string;
  recipient_id: string;
  template_key?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData | null;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  status: DeliveryStatus;
  is_read: boolean;
  read_at?: string | null;
  is_dismissed: boolean;
  dismissed_at?: string | null;
  scheduled_for?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationData {
  link?: string;
  action_id?: string;
  todo_id?: string;
  journal_id?: string;
  [key: string]: unknown;
}

export interface NotificationTemplate {
  id: string;
  key: string;
  type: NotificationType;
  default_title: string;
  default_body: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserNotificationSettings {
  user_id: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  muted_types: NotificationType[];
  quiet_start?: string | null;
  quiet_end?: string | null;
  time_zone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationDelivery {
  id: string;
  notification_id: string;
  channel: NotificationChannel;
  provider?: string | null;
  provider_msg_id?: string | null;
  status: DeliveryStatus;
  error_message?: string | null;
  attempted_at: string;
  delivered_at?: string | null;
}

// API Request/Response types
export interface CreateNotificationRequest {
  recipientId: string;
  templateKey?: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
  priority?: NotificationPriority;
  channels?: NotificationChannel[];
}

export interface NotificationListResponse {
  notifications: Notification[];
  unreadCount: number;
  total: number;
}

export interface ScheduleReminderRequest {
  remind_at: string; // ISO timestamp
  title: string;
  body: string;
  data?: NotificationData;
  type?: NotificationType;
  priority?: NotificationPriority;
}

export interface NotificationSettingsUpdate {
  in_app_enabled?: boolean;
  email_enabled?: boolean;
  push_enabled?: boolean;
  sms_enabled?: boolean;
  muted_types?: NotificationType[];
  quiet_start?: string | null;
  quiet_end?: string | null;
  time_zone?: string | null;
}

// Hook return type
export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

// ─── Visual Constants ─────────────────────────────────────────────────────────

export const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  reminder: '🔔',
  action: '⚡',
  journal: '📔',
  achievement: '🏆',
  system: '🔧',
  social: '👥',
  // Collaboration types
  collab_invite_received: '📩',
  collab_invite_accepted: '🤝',
  collab_invite_declined: '❌',
  collab_removed: '🚫',
  collab_role_changed: '🔄',
  collab_left: '👋',
  collab_key_ready: '🔑',
  collab_ownership_transferred: '👑',
  collab_key_reset_needed: '⚠️',
};

const collabColor = { bg: 'bg-violet-50', bgDark: 'bg-violet-900/20', border: 'border-violet-200', borderDark: 'border-violet-800/50', icon: 'text-violet-500' };
const collabWarnColor = { bg: 'bg-orange-50', bgDark: 'bg-orange-900/20', border: 'border-orange-200', borderDark: 'border-orange-800/50', icon: 'text-orange-500' };

export const NOTIFICATION_COLORS: Record<NotificationType, { bg: string; bgDark: string; border: string; borderDark: string; icon: string }> = {
  reminder: { bg: 'bg-purple-50', bgDark: 'bg-purple-900/20', border: 'border-purple-200', borderDark: 'border-purple-800/50', icon: 'text-purple-500' },
  action: { bg: 'bg-indigo-50', bgDark: 'bg-indigo-900/20', border: 'border-indigo-200', borderDark: 'border-indigo-800/50', icon: 'text-indigo-500' },
  journal: { bg: 'bg-amber-50', bgDark: 'bg-amber-900/20', border: 'border-amber-200', borderDark: 'border-amber-800/50', icon: 'text-amber-500' },
  achievement: { bg: 'bg-green-50', bgDark: 'bg-green-900/20', border: 'border-green-200', borderDark: 'border-green-800/50', icon: 'text-green-500' },
  system: { bg: 'bg-gray-50', bgDark: 'bg-gray-800/40', border: 'border-gray-200', borderDark: 'border-gray-700', icon: 'text-gray-500' },
  social: { bg: 'bg-pink-50', bgDark: 'bg-pink-900/20', border: 'border-pink-200', borderDark: 'border-pink-800/50', icon: 'text-pink-500' },
  // Collaboration types
  collab_invite_received: collabColor,
  collab_invite_accepted: collabColor,
  collab_invite_declined: collabWarnColor,
  collab_removed: collabWarnColor,
  collab_role_changed: collabColor,
  collab_left: collabColor,
  collab_key_ready: collabColor,
  collab_ownership_transferred: collabColor,
  collab_key_reset_needed: collabWarnColor,
};

export const PRIORITY_STYLES: Record<NotificationPriority, { dot: string; text: string }> = {
  low: { dot: 'bg-gray-300', text: 'text-gray-400' },
  normal: { dot: 'bg-blue-400', text: 'text-blue-500' },
  high: { dot: 'bg-orange-400', text: 'text-orange-500' },
  urgent: { dot: 'bg-red-500 animate-pulse', text: 'text-red-600 font-semibold' },
};

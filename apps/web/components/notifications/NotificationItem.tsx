// apps/web/components/notifications/NotificationItem.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Info, 
  Clock, 
  X,
  Trophy,
  BookOpen,
  Users,
  Zap,
  type LucideProps
} from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';
import type { Notification, NotificationType } from '@/types/notifications';
import { CompanionInteractiveCard } from '@/components/companion/CompanionInteractiveCard';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onClick?: (notification: Notification) => void;
  compact?: boolean;
}

const collabConfig = { icon: Users, color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.1)' };
const collabWarnConfig = { icon: Info, color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)' };

const typeConfig: Record<NotificationType, { icon: React.FC<LucideProps>; color: string; bgColor: string }> = {
  reminder: { icon: Clock, color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)' },
  action: { icon: Zap, color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.1)' },
  journal: { icon: BookOpen, color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.1)' },
  achievement: { icon: Trophy, color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)' },
  system: { icon: Info, color: '#6B7280', bgColor: 'rgba(107, 114, 128, 0.1)' },
  social: { icon: Users, color: '#EC4899', bgColor: 'rgba(236, 72, 153, 0.1)' },
  // Collaboration types
  collab_invite_received: collabConfig,
  collab_invite_accepted: collabConfig,
  collab_invite_declined: collabWarnConfig,
  collab_removed: collabWarnConfig,
  collab_role_changed: collabConfig,
  collab_left: collabConfig,
  collab_key_ready: collabConfig,
  collab_ownership_transferred: collabConfig,
  collab_key_reset_needed: collabWarnConfig,
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDismiss,
  onClick,
  compact = false,
}: NotificationItemProps) {
  const { isDarkMode } = useTheme();
  const config = typeConfig[notification.type] || typeConfig.system;
  const Icon = config.icon;

  const handleClick = () => {
    if (!notification.is_read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    if (onClick) {
      onClick(notification);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDismiss) {
      onDismiss(notification.id);
    }
  };

  const displayTimestamp =
    notification.type === 'reminder' && typeof notification.scheduled_for === 'string' && notification.scheduled_for
      ? notification.scheduled_for
      : notification.created_at;

  const isCompanionNudge = Boolean(notification.data?.is_companion_nudge);

  if (isCompanionNudge) {
    const threadId = (notification.data?.thread_id as string) || undefined;
    const userReply = (notification.data?.user_reply as string) || undefined;
    const instantReply = (notification.data?.instant_reply as string) || undefined;

    return (
      <div className="p-2">
        <CompanionInteractiveCard
          notificationId={notification.id}
          threadId={threadId}
          promptText={notification.body}
          initialUserReply={userReply}
          initialInstantReply={instantReply}
          compact={compact}
          onSuccess={() => {
            if (onMarkAsRead) {
              onMarkAsRead(notification.id);
            }
          }}
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`
        group relative flex items-start gap-3 p-3 rounded-lg cursor-pointer
        transition-all duration-200
        ${notification.is_read 
          ? isDarkMode ? 'bg-transparent hover:bg-white/5' : 'bg-transparent hover:bg-black/5'
          : isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-blue-50/50 hover:bg-blue-50'
        }
        ${compact ? 'py-2' : 'py-3'}
      `}
      onClick={handleClick}
    >
      {/* Unread indicator */}
      {!notification.is_read && (
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
          style={{ backgroundColor: config.color }}
        />
      )}

      {/* Icon */}
      <div
        className={`
          shrink-0 flex items-center justify-center rounded-full
          ${compact ? 'w-8 h-8' : 'w-10 h-10'}
        `}
        style={{ backgroundColor: config.bgColor }}
      >
        <Icon size={compact ? 16 : 20} style={{ color: config.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p 
          className={`
            font-medium truncate
            ${compact ? 'text-sm' : 'text-sm'}
            ${notification.is_read 
              ? isDarkMode ? 'text-gray-400' : 'text-gray-600'
              : isDarkMode ? 'text-white' : 'text-gray-900'
            }
          `}
        >
          {notification.title}
        </p>
        {!compact && (
          <p 
            className={`
              text-xs mt-0.5 line-clamp-2
              ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}
            `}
          >
            {notification.body}
          </p>
        )}
        <p 
          className={`
            text-xs mt-1
            ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}
          `}
        >
          {formatTimeAgo(displayTimestamp)}
        </p>
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={handleDismiss}
          className={`
            shrink-0 p-1 rounded-full opacity-0 group-hover:opacity-100
            transition-opacity duration-200
            ${isDarkMode 
              ? 'hover:bg-white/10 text-gray-400 hover:text-white' 
              : 'hover:bg-black/10 text-gray-400 hover:text-gray-600'
            }
          `}
        >
          <X size={14} />
        </button>
      )}
    </motion.div>
  );
}

export default NotificationItem;

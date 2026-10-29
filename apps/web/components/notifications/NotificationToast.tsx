// apps/web/components/notifications/NotificationToast.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Zap, BookOpen, Trophy, Info, Users, type LucideIcon } from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';
import { createClient } from '@/utils/supabase/client';
import type { Notification, NotificationType } from '@/types/notifications';
import { useRouter } from 'next/navigation';

interface ToastNotification extends Notification {
  toastId: string;
}

interface NotificationToastProviderProps {
  children: React.ReactNode;
  /** Auto-dismiss duration in milliseconds (default: 5000) */
  autoDismiss?: number;
  /** Maximum number of toasts to show at once */
  maxToasts?: number;
  /** Position of toasts */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

const collabConfig = { icon: Users, color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.15)' };
const collabWarnConfig = { icon: Info, color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.15)' };

const typeConfig: Record<NotificationType, { icon: LucideIcon; color: string; bgColor: string }> = {
  reminder: { icon: Clock, color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.15)' },
  action: { icon: Zap, color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.15)' },
  journal: { icon: BookOpen, color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.15)' },
  achievement: { icon: Trophy, color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.15)' },
  system: { icon: Info, color: '#6B7280', bgColor: 'rgba(107, 114, 128, 0.15)' },
  social: { icon: Users, color: '#EC4899', bgColor: 'rgba(236, 72, 153, 0.15)' },
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

// Position-based styles
const positionStyles = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-24 right-4', // Above FAB
  'bottom-left': 'bottom-24 left-4',
};

const positionAnimation = {
  'top-right': { x: 100, opacity: 0 },
  'top-left': { x: -100, opacity: 0 },
  'bottom-right': { x: 100, opacity: 0 },
  'bottom-left': { x: -100, opacity: 0 },
};

export function NotificationToastProvider({
  children,
  autoDismiss = 5000,
  maxToasts = 3,
  position = 'bottom-right',
}: NotificationToastProviderProps) {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const { isDarkMode } = useTheme();
  const router = useRouter();

  // Remove a toast
  const removeToast = useCallback((toastId: string) => {
    setToasts(prev => prev.filter(t => t.toastId !== toastId));
  }, []);

  // Add a new toast
  const addToast = useCallback((notification: Notification) => {
    const toastNotification: ToastNotification = {
      ...notification,
      toastId: `${notification.id}-${Date.now()}`,
    };

    setToasts(prev => {
      const newToasts = [toastNotification, ...prev];
      // Limit number of visible toasts
      return newToasts.slice(0, maxToasts);
    });

    // Auto-dismiss
    setTimeout(() => {
      removeToast(toastNotification.toastId);
    }, autoDismiss);
  }, [autoDismiss, maxToasts, removeToast]);

  // Handle toast click
  const handleToastClick = useCallback((notification: ToastNotification) => {
    removeToast(notification.toastId);
    
    // Navigate based on notification data
    if (notification.data?.link) {
      router.push(notification.data.link);
    } else if (notification.data?.journal_id) {
      router.push(`/journal/${notification.data.journal_id}`);
    } else if (notification.data?.action_id) {
      router.push('/dashboard');
    } else if (notification.data?.todo_id) {
      router.push('/tasks');
    }
  }, [router, removeToast]);

  // Listen for new notifications via Supabase Realtime
  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;

    const setupRealtime = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      channel = supabase
        .channel(`notification-toasts:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            addToast(newNotification);
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [addToast]);

  return (
    <>
      {children}
      
      {/* Toast Container */}
      <div 
        className={`fixed z-100 flex flex-col gap-2 pointer-events-none ${positionStyles[position]}`}
        style={{ maxWidth: '400px', width: 'calc(100vw - 2rem)' }}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => {
            const config = typeConfig[toast.type] || typeConfig.system;
            const Icon = config.icon;

            return (
              <motion.div
                key={toast.toastId}
                layout
                initial={positionAnimation[position]}
                animate={{ x: 0, opacity: 1 }}
                exit={{ ...positionAnimation[position], transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`
                  pointer-events-auto flex items-start gap-3 p-4 rounded-xl cursor-pointer
                  shadow-2xl border backdrop-blur-xl
                  ${isDarkMode 
                    ? 'bg-gray-900/95 border-white/10' 
                    : 'bg-white/95 border-gray-200'
                  }
                `}
                onClick={() => handleToastClick(toast)}
                whileHover={{ scale: 1.02, x: position.includes('right') ? -4 : 4 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Icon */}
                <div
                  className="shrink-0 flex items-center justify-center w-10 h-10 rounded-full"
                  style={{ backgroundColor: config.bgColor }}
                >
                  <Icon size={20} style={{ color: config.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-2">
                  <p className={`font-semibold text-sm truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {toast.title}
                  </p>
                  <p className={`text-xs mt-0.5 line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {toast.body}
                  </p>
                </div>

                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeToast(toast.toastId);
                  }}
                  className={`
                    shrink-0 p-1 rounded-full transition-colors
                    ${isDarkMode 
                      ? 'hover:bg-white/10 text-gray-500 hover:text-gray-300' 
                      : 'hover:bg-black/5 text-gray-400 hover:text-gray-600'
                    }
                  `}
                  aria-label="Dismiss notification"
                >
                  <X size={16} />
                </button>

                {/* Progress bar for auto-dismiss */}
                <motion.div
                  className="absolute bottom-0 left-0 h-0.5 rounded-b-xl"
                  style={{ backgroundColor: config.color }}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: autoDismiss / 1000, ease: 'linear' }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
}

// Export a hook for programmatically showing toasts (optional manual trigger)
// Note: Full context-based implementation can be added later if needed
export function useNotificationToast() {
  const showToast = useCallback((notification: Partial<Notification> & { title: string; body: string }) => {
    // This is a placeholder for manual toast triggering
    // In a full implementation, this would use a context to add toasts
    console.log('Manual notification toast:', notification.title, notification.body);
  }, []);

  return { showToast };
}

export default NotificationToastProvider;

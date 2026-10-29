// apps/web/hooks/useNotifications.ts
// Real-time notification hook with Supabase Realtime

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { Notification, NotificationListResponse } from '@/types/notifications';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseNotificationsOptions {
  limit?: number;
  autoRefresh?: boolean;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  total: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismiss: (notificationId: string) => Promise<void>;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

function dedupeNotificationsById(items: Notification[]): Notification[] {
  const seen = new Set<string>();
  const deduped: Notification[] = [];

  for (const item of items) {
    if (!item?.id || seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    deduped.push(item);
  }

  return deduped;
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const { limit = 20, autoRefresh = true } = options;
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const currentOffset = reset ? 0 : offset;
      const response = await fetch(`/api/notifications?limit=${limit}&offset=${currentOffset}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      const data: NotificationListResponse = await response.json();
      
      if (reset) {
        const deduped = dedupeNotificationsById(data.notifications);
        setNotifications(deduped);
        setOffset(deduped.length);
      } else {
        setNotifications(prev => {
          const next = dedupeNotificationsById([...prev, ...data.notifications]);
          setOffset(next.length);
          return next;
        });
      }
      
      setUnreadCount(data.unreadCount);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [limit, offset]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications(true);
  }, []);

  // Listen for local trigger updates (e.g. proactive nudge check or simulation)
  useEffect(() => {
    const handleRefresh = () => {
      void fetchNotifications(true);
    };

    window.addEventListener('force:refresh-notifications', handleRefresh);
    window.addEventListener('force:nudge-updated', handleRefresh);
    return () => {
      window.removeEventListener('force:refresh-notifications', handleRefresh);
      window.removeEventListener('force:nudge-updated', handleRefresh);
    };
  }, [fetchNotifications]);

  // Fetch unread count separately
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/unread-count');
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count || 0);
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    if (!autoRefresh) return;

    let isMounted = true;
    let activeChannel: RealtimeChannel | null = null;
    const supabase = createClient();

    const setupRealtime = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!isMounted || !user?.id) return;

        userIdRef.current = user.id;

        // Use a unique suffix (UUID + timestamp) to guarantee a fresh, isolated channel instance
        // even if multiple components mount in the exact same event loop tick.
        const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const channelName = `notifications:${user.id}:${uniqueId}`;

        // Ensure any pre-existing channel with this name is cleanly removed
        const existing = supabase.getChannels().find(
          (c) => c.topic === `realtime:${channelName}` || c.topic === channelName
        );
        if (existing) {
          await supabase.removeChannel(existing);
        }

        if (!isMounted) return;

        // Register ALL .on() handlers BEFORE calling .subscribe()
        const channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'notifications',
              filter: `recipient_id=eq.${user.id}`,
            },
            (payload) => {
              if (!isMounted) return;
              const newNotification = payload.new as Notification;
              if (newNotification.status === 'queued') return;
              setNotifications((prev) => {
                if (prev.some((n) => n.id === newNotification.id)) return prev;
                return [newNotification, ...prev];
              });
              setUnreadCount((prev) => prev + 1);
              setTotal((prev) => prev + 1);
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'notifications',
              filter: `recipient_id=eq.${user.id}`,
            },
            (payload) => {
              if (!isMounted) return;
              const updated = payload.new as Notification;
              setNotifications((prev) => {
                const existingIndex = prev.findIndex((n) => n.id === updated.id);
                if (existingIndex === -1) {
                  if (updated.status === 'queued') return prev;
                  return [updated, ...prev];
                }
                return prev.map((n) => (n.id === updated.id ? updated : n));
              });
              fetchUnreadCount();
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'notifications',
              filter: `recipient_id=eq.${user.id}`,
            },
            (payload) => {
              if (!isMounted) return;
              const deleted = payload.old as { id: string };
              setNotifications((prev) => prev.filter((n) => n.id !== deleted.id));
              setTotal((prev) => Math.max(0, prev - 1));
            }
          );

        // Subscribe only after all handlers are attached
        channel.subscribe();
        activeChannel = channel;
        channelRef.current = channel;
      } catch (err) {
        console.warn('[useNotifications] Realtime setup error:', err);
      }
    };

    void setupRealtime();

    return () => {
      isMounted = false;
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [autoRefresh, fetchUnreadCount]);


  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      // Optimistic update
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });

      if (!response.ok) {
        // Revert on failure
        await fetchNotifications(true);
        throw new Error('Failed to mark as read');
      }
    } catch (err) {
      console.error('Mark as read error:', err);
    }
  }, [fetchNotifications]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      // Optimistic update
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);

      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      });

      if (!response.ok) {
        await fetchNotifications(true);
        throw new Error('Failed to mark all as read');
      }
    } catch (err) {
      console.error('Mark all as read error:', err);
    }
  }, [fetchNotifications]);

  // Dismiss notification
  const dismiss = useCallback(async (notificationId: string) => {
    try {
      // Optimistic update
      const notification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setTotal(prev => Math.max(0, prev - 1));
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      const response = await fetch(`/api/notifications/${notificationId}/dismiss`, {
        method: 'POST',
      });

      if (!response.ok) {
        await fetchNotifications(true);
        throw new Error('Failed to dismiss');
      }
    } catch (err) {
      console.error('Dismiss error:', err);
    }
  }, [notifications, fetchNotifications]);

  // Load more
  const loadMore = useCallback(async () => {
    if (loading || notifications.length >= total) return;
    await fetchNotifications(false);
  }, [loading, notifications.length, total, fetchNotifications]);

  // Refetch
  const refetch = useCallback(async () => {
    setOffset(0);
    await fetchNotifications(true);
  }, [fetchNotifications]);

  const hasMore = notifications.length < total;

  return {
    notifications,
    unreadCount,
    total,
    loading,
    error,
    hasMore,
    markAsRead,
    markAllAsRead,
    dismiss,
    loadMore,
    refetch,
  };
}

// Hook for just the unread count (lightweight)
export function useUnreadNotificationCount(): { count: number; loading: boolean } {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch('/api/notifications/unread-count');
        if (response.ok) {
          const data = await response.json();
          setCount(data.count || 0);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchCount();

    // Set up realtime for count updates
    const setupRealtime = async () => {
      const supabase = createClient();

      let channel: RealtimeChannel | null = null;

      const subscribeForUser = (userId: string) => {
        if (channel) return;
        channel = supabase
        .channel(`notification-count:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${userId}`,
          },
          () => {
            fetchCount();
          }
        )
        .subscribe();
      };

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        subscribeForUser(user.id);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const userId = session?.user?.id;
        if (userId) {
          subscribeForUser(userId);
        }
      });

      return () => {
        subscription.unsubscribe();
        if (channel) {
          supabase.removeChannel(channel);
        }
      };
    };

    let cleanup: (() => void) | undefined;
    setupRealtime().then((fn) => {
      cleanup = fn;
    });

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  return { count, loading };
}

export default useNotifications;

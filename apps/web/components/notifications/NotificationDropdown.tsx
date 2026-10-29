// apps/web/components/notifications/NotificationDropdown.tsx
'use client';

import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, Settings, Loader2, ArrowRight, X } from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import type { Notification } from '@/types/notifications';
import Link from 'next/link';

type NavPosition = 'bottom' | 'left' | 'right';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  navPosition?: NavPosition;
}

// Position-based styles for dropdown
const getPositionStyles = (navPosition: NavPosition) => {
  switch (navPosition) {
    case 'left':
      return {
        className: 'left-full top-0 ml-2',
        initial: { opacity: 0, x: -10, scale: 0.95 },
        animate: { opacity: 1, x: 0, scale: 1 },
        exit: { opacity: 0, x: -10, scale: 0.95 },
      };
    case 'right':
      return {
        className: 'right-full top-0 mr-2',
        initial: { opacity: 0, x: 10, scale: 0.95 },
        animate: { opacity: 1, x: 0, scale: 1 },
        exit: { opacity: 0, x: 10, scale: 0.95 },
      };
    case 'bottom':
    default:
      return {
        className: 'right-0 bottom-full mb-2',
        initial: { opacity: 0, y: 10, scale: 0.95 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 10, scale: 0.95 },
      };
  }
};

const mobileSheetStyles = {
  initial: { opacity: 0, y: 24, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 24, scale: 0.98 },
};

export function NotificationDropdown({ isOpen, onClose, anchorRef, navPosition = 'bottom' }: NotificationDropdownProps) {
  const { isDarkMode, elementColors } = useTheme();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [floatingStyle, setFloatingStyle] = useState<React.CSSProperties | null>(null);
  
  const {
    notifications,
    unreadCount,
    loading,
    hasMore,
    markAsRead,
    markAllAsRead,
    dismiss,
    loadMore,
  } = useNotifications({ limit: 200, autoRefresh: false });

  // When dropdown opens, ensure we load all available notifications so user can see them
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    (async () => {
      // Keep loading pages until we've fetched everything or the component is closed
      try {
        while (!cancelled && hasMore && !loading) {
          // loadMore is safe to call repeatedly; the hook guards against excessive calls
          // eslint-disable-next-line no-await-in-loop
          await loadMore();
        }
      } catch (err) {
        // ignore - best effort
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, hasMore, loadMore, loading]);

  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(window.innerWidth < 768);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);

    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setFloatingStyle(null);
      return;
    }

    const updatePosition = () => {
      if (typeof window === 'undefined') {
        return;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 12;
      const width = Math.min(384, viewportWidth - padding * 2);
      const maxHeight = Math.min(544, viewportHeight - padding * 2);
      const anchorRect = anchorRef?.current?.getBoundingClientRect();

      if (isMobileViewport || !anchorRect) {
        setFloatingStyle({
          position: 'fixed',
          left: padding,
          right: padding,
          bottom: padding,
          width: `calc(100vw - ${padding * 2}px)`,
          maxWidth: `calc(100vw - ${padding * 2}px)`,
          maxHeight: `calc(100vh - ${padding * 2}px)`,
        });
        return;
      }

      if (navPosition === 'left') {
        const left = Math.min(Math.max(anchorRect.right + padding, padding), viewportWidth - width - padding);
        const top = Math.min(Math.max(anchorRect.top, padding), viewportHeight - maxHeight - padding);

        setFloatingStyle({
          position: 'fixed',
          left,
          top,
          width: `${width}px`,
          maxWidth: `calc(100vw - ${padding * 2}px)`,
          maxHeight: `${maxHeight}px`,
        });
        return;
      }

      if (navPosition === 'right') {
        const left = Math.min(Math.max(anchorRect.left - width - padding, padding), viewportWidth - width - padding);
        const top = Math.min(Math.max(anchorRect.top, padding), viewportHeight - maxHeight - padding);

        setFloatingStyle({
          position: 'fixed',
          left,
          top,
          width: `${width}px`,
          maxWidth: `calc(100vw - ${padding * 2}px)`,
          maxHeight: `${maxHeight}px`,
        });
        return;
      }

      const left = Math.min(Math.max(anchorRect.right - width, padding), viewportWidth - width - padding);
      const bottom = Math.max(padding, viewportHeight - anchorRect.top + padding);

      setFloatingStyle({
        position: 'fixed',
        left,
        bottom,
        width: `${width}px`,
        maxWidth: `calc(100vw - ${padding * 2}px)`,
        maxHeight: `${maxHeight}px`,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef, isMobileViewport, isOpen, navPosition]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        anchorRef?.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, anchorRef]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleNotificationClick = (notification: Notification) => {
    // Navigate based on notification data
    if (notification.data?.link) {
      window.location.href = notification.data.link;
    } else if (notification.data?.journal_id) {
      window.location.href = `/journal/${notification.data.journal_id}`;
    } else if (notification.data?.action_id) {
      window.location.href = '/dashboard';
    }
    onClose();
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasMore && !loading) {
      loadMore();
    }
  };

  const positionStyles = getPositionStyles(navPosition);
  const isMobileSheet = isMobileViewport;

  if (!isOpen || !floatingStyle) {
    return null;
  }

  const content = (
    <motion.div
      ref={dropdownRef}
      initial={isMobileSheet ? mobileSheetStyles.initial : positionStyles.initial}
      animate={isMobileSheet ? mobileSheetStyles.animate : positionStyles.animate}
      exit={isMobileSheet ? mobileSheetStyles.exit : positionStyles.exit}
      transition={{ duration: 0.15 }}
      className={`
        rounded-2xl shadow-2xl border overflow-hidden z-50 min-w-0
        ${isDarkMode
          ? 'bg-gray-950/95 border-gray-800 backdrop-blur-2xl text-gray-100'
          : 'bg-white/95 border-gray-200 backdrop-blur-2xl text-gray-900'
        }
      `}
      style={{
        ...floatingStyle,
        boxShadow: isDarkMode
          ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          : '0 25px 50px -12px rgba(0, 0, 0, 0.18)',
      }}
    >
      {/* Header */}
      <div
        className={`
          flex items-center justify-between px-4 py-3 border-b
          ${isDarkMode ? 'border-gray-800 bg-white/[0.02]' : 'border-gray-100 bg-black/[0.01]'}
        `}
      >
        <div className="flex items-center gap-2">
          <Bell size={18} className={isDarkMode ? 'text-white' : 'text-gray-900'} />
          <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Notifications
          </h3>
          {unreadCount > 0 && (
            <span
              className="px-2 py-0.5 text-xs font-medium rounded-full text-white"
              style={{ backgroundColor: elementColors?.accent || '#3B82F6' }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className={`
                p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors
                ${isDarkMode
                  ? 'hover:bg-white/10 text-gray-400 hover:text-white'
                  : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
                }
              `}
              title="Mark all as read"
            >
              <CheckCheck size={16} />
            </button>
          )}
          <Link
            href="/notifications"
            onClick={onClose}
            className={`
              p-1.5 rounded-lg transition-colors flex items-center gap-1.5 text-xs
              ${isDarkMode
                ? 'hover:bg-white/10 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }
            `}
            title="View all notifications"
          >
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/settings/notifications"
            onClick={onClose}
            className={`
              p-1.5 rounded-lg transition-colors
              ${isDarkMode
                ? 'hover:bg-white/10 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
              }
            `}
            title="Notification settings"
          >
            <Settings size={16} />
          </Link>
          <button
            onClick={onClose}
            className={`
              p-1.5 rounded-lg transition-colors ml-0.5
              ${isDarkMode
                ? 'hover:bg-white/15 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'
              }
            `}
            title="Close"
            aria-label="Close notifications"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div
        className="overflow-y-auto overscroll-contain"
        onScroll={handleScroll}
        style={{ maxHeight: isMobileSheet ? 'calc(100vh - 9rem)' : '30rem' }}
      >
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2
              size={24}
              className={`animate-spin ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
            />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Bell
              size={40}
              className={`mb-3 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}
            />
            <p className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
              No notifications yet
            </p>
            <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
              We'll notify you when something happens
            </p>
          </div>
        ) : (
          <div className="py-1">
            <AnimatePresence mode="popLayout">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDismiss={dismiss}
                  onClick={handleNotificationClick}
                />
              ))}
            </AnimatePresence>

            {loading && notifications.length > 0 && (
              <div className="flex items-center justify-center py-3">
                <Loader2
                  size={18}
                  className={`animate-spin ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div
          className={`
            px-4 py-3 border-t
            ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-100 bg-gray-50'}
          `}
        >
          <Link
            href="/notifications"
            onClick={onClose}
            className={`
              flex items-center justify-between px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200
              ${isDarkMode 
                ? 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 hover:text-blue-300' 
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700'
              }
            `}
          >
            <span>View all notifications</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </motion.div>
  );

  return (
    createPortal(
      <AnimatePresence>{isOpen ? content : null}</AnimatePresence>,
      document.body
    )
  );
}

export default NotificationDropdown;

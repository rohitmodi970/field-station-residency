// apps/web/components/notifications/NotificationBell.tsx
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/utilities/context/ThemeContext';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationDropdown } from './NotificationDropdown';

export type NavPosition = 'bottom' | 'left' | 'right';

interface NotificationBellProps {
  /** Size of the bell icon */
  size?: number;
  /** Custom class name for the button */
  className?: string;
  /** Show as compact version (smaller) */
  compact?: boolean;
  /** Position of the navbar (affects dropdown direction) */
  navPosition?: NavPosition;
}

export function NotificationBell({ 
  size = 22, 
  className = '',
  compact = false,
  navPosition = 'bottom'
}: NotificationBellProps) {
  const router = useRouter();
  const { isDarkMode, elementColors } = useTheme();
  const { unreadCount, refetch } = useNotifications({ autoRefresh: true });
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const prevUnreadCount = useRef(unreadCount);

  // Detect mobile screen width (< 768px)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prefetch notifications route for instant navigation
  useEffect(() => {
    try {
      router.prefetch('/notifications');
    } catch {}
  }, [router]);

  // Detect new notifications for pulse animation
  useEffect(() => {
    if (unreadCount > prevUnreadCount.current) {
      setHasNewNotification(true);
      // Reset pulse after animation
      const timer = setTimeout(() => setHasNewNotification(false), 2000);
      return () => clearTimeout(timer);
    }
    prevUnreadCount.current = unreadCount;
  }, [unreadCount]);

  const handleBellClick = (e: React.MouseEvent) => {
    const isSmallScreen = isMobile || (typeof window !== 'undefined' && window.innerWidth < 768);
    
    // On small devices, directly navigate to the dedicated notification page
    if (isSmallScreen) {
      setIsOpen(false);
      router.push('/notifications');
      return;
    }

    // On desktop, toggle dropdown
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    // Re-sync count/list when the user opens the bell.
    if (nextOpen) {
      void refetch();
    }

    setHasNewNotification(false);
  };

  const accentColor = elementColors?.accent || '#3B82F6';

  return (
    <div className="relative">
      <motion.button
        ref={bellRef}
        onClick={handleBellClick}
        className={`
          relative flex items-center justify-center
          ${compact ? 'w-9 h-9' : 'w-10 h-10'}
          rounded-full transition-all duration-200
          ${isDarkMode 
            ? 'hover:bg-white/10 text-gray-300 hover:text-white' 
            : 'hover:bg-black/5 text-gray-600 hover:text-gray-900'
          }
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          ${isDarkMode ? 'focus-visible:ring-blue-400' : 'focus-visible:ring-blue-500'}
          ${className}
        `}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {/* Bell Icon */}
        <Bell 
          size={size} 
          className={`
            transition-transform duration-200
            ${isOpen ? 'rotate-12' : ''}
          `}
        />

        {/* Unread count badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className={`
                absolute flex items-center justify-center
                ${compact ? '-top-0.5 -right-0.5 min-w-4 h-4 text-[9px]' : '-top-1 -right-1 min-w-5 h-5 text-[10px]'}
                px-1 font-bold text-white rounded-full shadow-lg
              `}
              style={{ backgroundColor: accentColor }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Pulse animation for new notifications */}
        <AnimatePresence>
          {hasNewNotification && (
            <motion.span
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, repeat: 2 }}
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
          )}
        </AnimatePresence>

        {/* Ring animation for unread notifications */}
        {unreadCount > 0 && !isOpen && (
          <span 
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ 
              backgroundColor: accentColor,
              animationDuration: '3s',
            }}
          />
        )}
      </motion.button>

      {/* Dropdown */}
      <NotificationDropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        anchorRef={bellRef}
        navPosition={navPosition}
      />
    </div>
  );
}

export default NotificationBell;

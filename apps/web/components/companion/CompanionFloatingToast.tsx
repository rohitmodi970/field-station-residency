'use client';

import React, { useState, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { ChevronDown, X } from 'lucide-react';
import { CompanionInteractiveCard, ForceMark } from './CompanionInteractiveCard';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export function CompanionFloatingToast() {
  const { notifications, markAsRead, dismiss } = useNotifications({ autoRefresh: true });
  const [expanded, setExpanded] = useState(false);
  const [dismissedLocally, setDismissedLocally] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // Helper to safely parse json data if stringified
  const parseData = (nData: any): Record<string, any> => {
    if (!nData) return {};
    if (typeof nData === 'string') {
      try {
        return JSON.parse(nData);
      } catch {
        return {};
      }
    }
    return nData;
  };

  // Find most recent unread companion nudge
  const activeNudge = notifications.find((n) => {
    const data = parseData(n.data);
    return (
      Boolean(data?.is_companion_nudge) &&
      !n.is_read &&
      !n.is_dismissed &&
      n.id !== dismissedLocally
    );
  });

  const activeData = activeNudge ? parseData(activeNudge.data) : {};

  // Auto-expand for 12 seconds on arrival, then minimize to pill
  useEffect(() => {
    if (activeNudge) {
      setExpanded(true);
      const timer = setTimeout(() => {
        setExpanded(false);
      }, 12000);
      return () => clearTimeout(timer);
    }
  }, [activeNudge?.id]);

  if (!activeNudge) {
    return null;
  }

  const handleDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const notifId = activeNudge.id;
    const threadId = activeData?.thread_id;
    setDismissedLocally(notifId);
    dismiss(notifId);

    try {
      await fetch('/api/agent/v2/nudge/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId: notifId,
          threadId,
          reason: 'manual_user_dismissal',
        }),
      });
    } catch (err) {
      console.warn('Failed to log nudge dismissal:', err);
    }
  };

  const handleSuccess = () => {
    markAsRead(activeNudge.id);
    // Keep visible with instant reply for 6 seconds, then collapse
    setTimeout(() => {
      setExpanded(false);
    }, 6000);
  };

  return (
    <div className="fixed bottom-20 sm:bottom-24 right-6 z-50 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeNudge.id + (expanded ? '-expanded' : '-pill')}
          initial={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 14, scale: 0.98 }
          }
          animate={
            shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: 1, y: 0, scale: 1 }
          }
          exit={
            shouldReduceMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 10, scale: 0.98 }
          }
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="pointer-events-auto flex justify-end"
        >
          {expanded ? (
            /* Expanded Card with Soft Ambient Glow */
            <div className="relative w-full max-w-[380px]">
              {/* CSS-only soft ambient warm glow behind the card (does not extend past shadow area) */}
              <div
                aria-hidden="true"
                className="absolute -inset-1 rounded-[32px] pointer-events-none blur-xl opacity-50 -z-10"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 50%, rgba(225, 175, 155, 0.35) 0%, rgba(241, 225, 218, 0.15) 60%, transparent 80%)',
                }}
              />

              <div className="relative rounded-3xl border border-ob-border bg-ob-raised shadow-[0_12px_40px_rgba(42,33,28,0.08),0_2px_8px_rgba(42,33,28,0.03)] overflow-hidden">
                {/* Clean quiet header */}
                <div className="flex items-center justify-between px-5 pt-3.5 pb-2.5 border-b border-ob-border/60 bg-ob-surface/40">
                  <div className="flex items-center gap-2">
                    <ForceMark className="w-4 h-4" />
                    <span className="text-xs font-medium text-ob-ink font-[family-name:var(--font-ob-body)]">
                      Force
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setExpanded(false)}
                      className="p-1 rounded-full text-ob-ink-muted hover:text-ob-clay hover:bg-ob-clay-soft/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-clay cursor-pointer"
                      title="Minimize"
                      aria-label="Minimize"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="p-1 rounded-full text-ob-ink-muted hover:text-ob-clay hover:bg-ob-clay-soft/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-clay cursor-pointer"
                      title="Dismiss"
                      aria-label="Dismiss"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Inner Interactive Card */}
                <CompanionInteractiveCard
                  notificationId={activeNudge.id}
                  threadId={activeData?.thread_id}
                  promptText={activeNudge.body}
                  initialUserReply={activeData?.user_reply}
                  initialInstantReply={activeData?.instant_reply}
                  onSuccess={handleSuccess}
                  compact={false}
                  embedded={true}
                  showHeader={false}
                />
              </div>
            </div>
          ) : (
            /* Minimized Pill Bar */
            <div className="relative max-w-[320px] w-full">
              {/* Soft ambient warm glow behind pill */}
              <div
                aria-hidden="true"
                className="absolute -inset-0.5 rounded-full pointer-events-none blur-md opacity-35 -z-10"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 50%, rgba(225, 175, 155, 0.45) 0%, transparent 75%)',
                }}
              />

              <div className="flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-full bg-ob-raised border border-ob-border shadow-[0_6px_22px_rgba(42,33,28,0.06),0_1px_4px_rgba(42,33,28,0.03)] transition-all font-[family-name:var(--font-ob-body)]">
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-clay rounded-full"
                  aria-label="Expand Force reflection"
                >
                  <ForceMark className="w-4 h-4 shrink-0" />
                  <span className="text-xs text-ob-ink-muted truncate font-normal">
                    {activeNudge.body}
                  </span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="text-xs font-medium text-ob-clay-strong hover:text-ob-clay hover:underline underline-offset-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-clay rounded"
                    aria-label="Reply to Force"
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="p-1 rounded-full text-ob-ink-faint hover:text-ob-clay hover:bg-ob-clay-soft/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-clay"
                    title="Dismiss"
                    aria-label="Dismiss"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default CompanionFloatingToast;

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellOff,
  X,
  Flame,
  BookOpen,
  Zap,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "@/utilities/context/ThemeContext";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  type: "streak" | "insight" | "reminder" | "milestone" | "system";
  title: string;
  body: string;
  time: string;
  read: boolean;
  actionPath?: string;
}

const TYPE_META: Record<
  Notification["type"],
  { icon: React.ReactNode; accent: string; bg: string }
> = {
  streak: {
    icon: <Flame className="w-4 h-4" />,
    accent: "#ad6d5a",
    bg: "rgba(173,109,90,0.12)",
  },
  insight: {
    icon: <Zap className="w-4 h-4" />,
    accent: "#5f9f93",
    bg: "rgba(95,159,147,0.12)",
  },
  reminder: {
    icon: <Calendar className="w-4 h-4" />,
    accent: "#8a6a58",
    bg: "rgba(138,106,88,0.12)",
  },
  milestone: {
    icon: <BookOpen className="w-4 h-4" />,
    accent: "#7a8f66",
    bg: "rgba(122,143,102,0.12)",
  },
  system: {
    icon: <Bell className="w-4 h-4" />,
    accent: "#6f4f43",
    bg: "rgba(111,79,67,0.12)",
  },
};

// ── Static placeholder notifications (UI-only for now) ──
const PLACEHOLDER_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "streak",
    title: "Keep it going!",
    body: "You're on a roll , write today to keep your streak alive.",
    time: "2h ago",
    read: false,
    actionPath: "/journal/new",
  },
  {
    id: "2",
    type: "insight",
    title: "New insight available",
    body: "AI detected a recurring theme in your recent entries.",
    time: "5h ago",
    read: false,
    actionPath: "/analysis",
  },
  {
    id: "3",
    type: "reminder",
    title: "Evening check-in",
    body: "Take a moment to reflect on your day before it ends.",
    time: "Yesterday",
    read: true,
    actionPath: "/journal/new",
  },
  {
    id: "4",
    type: "milestone",
    title: "10 entries milestone!",
    body: "You've written 10 journal entries. Amazing consistency!",
    time: "2 days ago",
    read: true,
  },
];

export default function NotificationPanel() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>(PLACEHOLDER_NOTIFICATIONS);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleTap = (n: Notification) => {
    markRead(n.id);
    if (n.actionPath) router.push(n.actionPath);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full min-w-0 rounded-(--radius-hero) border overflow-hidden"
      style={{
        background: isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(255,248,243,0.86)",
        borderColor: 'rgba(159,120,100,0.24)',
        maxWidth: '100%',
      }}
    >
      <div className="p-5 sm:p-6 lg:p-7">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-1">
          <button
            onClick={() => setOpen(!open)}
            className="flex min-w-0 items-center gap-2 group text-left"
          >
            <div className="relative">
              <Bell className="w-4 h-4 text-[#775247] group-hover:text-[#5b3e35] transition-colors" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#ad6d5a] text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </div>
            <h3
              className="text-base font-semibold"
              style={{ fontFamily: "var(--font-serif)", color: '#4f342b' }}
            >
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: "rgba(173,109,90,0.16)", color: "#6f4f43" }}
              >
                {unreadCount} new
              </span>
            )}
          </button>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[#775247] hover:text-[#5b3e35] transition-colors"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => setOpen(!open)}
              className="text-xs text-[#775247] hover:text-[#5b3e35] transition-colors flex items-center gap-0.5"
            >
              {open ? "Collapse" : "Expand"}
              <ChevronRight
                className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Collapsed preview — show latest unread */}
        {!open && unreadCount > 0 && (
          <p className="text-xs text-[#775247] mt-1 truncate max-w-full sm:max-w-[38rem]">
            {notifications.find((n) => !n.read)?.title} —{" "}
            {notifications.find((n) => !n.read)?.body}
          </p>
        )}

        {/* Expanded list */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2 max-h-[58vh] overflow-y-auto pr-1 sm:max-h-[68vh] lg:max-h-[32rem]">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <BellOff className="w-8 h-8 mb-2 opacity-40 text-[#9f6958]" />
                    <p className="text-sm font-medium text-[#4f342b]">All caught up!</p>
                    <p className="text-xs opacity-60">No notifications right now.</p>
                  </div>
                ) : (
                  notifications.map((n, i) => {
                    const meta = TYPE_META[n.type];
                    return (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 12, height: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: i * 0.04,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        onClick={() => handleTap(n)}
                        className={`relative group flex items-start gap-3 p-3 lg:p-4 rounded-xl border transition-all cursor-pointer ${
                          n.read
                            ? "border-border/20 opacity-60 hover:opacity-80"
                            : "border-border/40 hover:shadow-md hover:-translate-y-0.5"
                        }`}
                        style={{
                          background: n.read
                            ? isDarkMode
                              ? "rgba(255,255,255,0.01)"
                              : "rgba(255,245,237,0.55)"
                            : meta.bg,
                          borderColor: n.read ? 'rgba(159,120,100,0.15)' : 'rgba(159,120,100,0.24)',
                        }}
                      >
                        {/* Icon */}
                        <div
                          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                          style={{
                            background: `${meta.accent}18`,
                            color: meta.accent,
                          }}
                        >
                          {meta.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate">
                              {n.title}
                            </span>
                            {!n.read && (
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: meta.accent }}
                              />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                            {n.body}
                          </p>
                          <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                            {n.time}
                          </span>
                        </div>

                        {/* Dismiss */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismiss(n.id);
                          }}
                          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[#775247]/70 hover:text-[#5b3e35]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

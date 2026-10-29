"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, X, Clock, Target, ChevronDown, ChevronUp, ListTodo, Loader2 } from "lucide-react";
import { useTheme } from "@/utilities/context/ThemeContext";
import { announceTaskAdded } from "@/utils/notifications/taskAddedNotifier";

interface ActiveAction {
  id: string;
  icon: string;
  title: string;
  reason: string;
  duration: string;
  category: "health" | "productivity" | "social" | "wellbeing";
  status: "active" | "completed" | "dismissed";
  accepted_at: string;
  completed_at?: string;
  journal_id: string;
}

const CATEGORY_COLORS: Record<string, { accent: string; bg: string }> = {
  health:       { accent: "#5f9f93", bg: "rgba(95,159,147,0.14)" },
  productivity: { accent: "#ad6d5a", bg: "rgba(173,109,90,0.14)" },
  social:       { accent: "#8a6a58", bg: "rgba(138,106,88,0.14)" },
  wellbeing:    { accent: "#7a8f66", bg: "rgba(122,143,102,0.14)" },
};

interface ActionPillsProps {
  title?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export default function ActionPills({
  title,
  emptyTitle,
  emptyDescription,
}: ActionPillsProps) {
  const { isDarkMode } = useTheme();
  const [actions, setActions] = useState<ActiveAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [addingTodoId, setAddingTodoId] = useState<string | null>(null);
  const [todoAddedIds, setTodoAddedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/actions/active");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setActions(data.actions || []);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const markComplete = async (actionId: string) => {
    try {
      const res = await fetch(`/api/actions/${actionId}/complete`, { method: "POST" });
      if (res.ok) {
        setActions((prev) =>
          prev.map((a) =>
            a.id === actionId
              ? { ...a, status: "completed" as const, completed_at: new Date().toISOString() }
              : a
          )
        );
      }
    } catch {
      // silently fail
    }
  };

  const dismissAction = async (actionId: string) => {
    try {
      const res = await fetch(`/api/actions/${actionId}/dismiss`, { method: "POST" });
      if (res.ok) {
        setActions((prev) => prev.filter((a) => a.id !== actionId));
      }
    } catch {
      // silently fail
    }
  };

  const addToTodo = async (action: ActiveAction) => {
    if (addingTodoId === action.id || todoAddedIds.has(action.id)) return;

    setAddingTodoId(action.id);
    try {
      const res = await fetch(`/api/actions/${action.id}/add-to-todo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_generate: true }),
      });

      if (res.ok || res.status === 409) {
        if (res.ok) {
          const payload = await res.json().catch(() => ({}));
          const title = payload?.todo?.title || action.title;
          announceTaskAdded({ title, source: 'action' });
        }
        setTodoAddedIds((prev) => {
          const next = new Set(prev);
          next.add(action.id);
          return next;
        });
      }
    } catch {
      // silently fail
    } finally {
      setAddingTodoId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-(--radius-hero) border p-5 animate-pulse" style={{ borderColor: 'rgba(159,120,100,0.24)', background: 'rgba(255,248,243,0.78)' }}>
        <div className="h-4 w-28 bg-muted/40 rounded mb-3" />
        <div className="flex gap-2">
          <div className="h-9 w-32 bg-muted/40 rounded-full" />
          <div className="h-9 w-28 bg-muted/40 rounded-full" />
        </div>
      </div>
    );
  }

  const active = actions.filter((a) => a.status === "active");
  const completed = actions.filter((a) => a.status === "completed");

  if (active.length === 0 && completed.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-(--radius-hero) border border-dashed p-5"
        style={{ background: isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(255,248,243,0.86)", borderColor: 'rgba(159,120,100,0.24)' }}
      >
        <div className="flex items-center gap-3 text-[#7a5549]">
          <Target className="w-5 h-5 text-[#a06b5a]" />
          <div>
            <p className="text-sm font-medium text-[#4f342b]">{emptyTitle || 'No active actions'}</p>
            <p className="text-xs opacity-70">
              {emptyDescription || 'Analyze a journal entry to get personalized action suggestions.'}
            </p>
          </div>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-(--radius-hero) border overflow-hidden"
      style={{ background: isDarkMode ? "rgba(255,255,255,0.02)" : "#fff8f2", borderColor: 'rgba(159,120,100,0.24)' }}
    >
      <div className="p-5 sm:p-6 lg:p-7">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-base font-semibold flex items-center gap-2"
            style={{ fontFamily: 'var(--dashboard-heading-font, var(--font-serif))', letterSpacing: '0.035em', color: '#4f342b' }}
          >
            <Target className="w-4 h-4 text-[#9f6958]" />
            {title || 'Actions'}
            {active.length > 0 && (
              <span className="text-[10px] font-bold bg-[#f1e0d6] text-[#6c4a40] px-2 py-0.5 rounded-full">
                {active.length}
              </span>
            )}
          </h3>
          {completed.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-[#765247] hover:text-[#5b3e35] transition-colors"
            >
              {expanded ? "Hide" : `${completed.length} done`}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>

        {/* Active action pills */}
        <div className="flex flex-wrap gap-2">
          <AnimatePresence mode="popLayout">
            {active.map((action) => {
              const cat = CATEGORY_COLORS[action.category] ?? { accent: "#8B5CF6", bg: "rgba(139,92,246,0.08)" };
              return (
                <motion.div
                  key={action.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full border transition-all hover:shadow-md"
                  style={{
                    background: cat.bg,
                    borderColor: `${cat.accent}30`,
                  }}
                >
                  <span className="text-base">{action.icon}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold truncate max-w-35 lg:max-w-48">{action.title}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" /> {action.duration}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-0.5 ml-1">
                    <button
                      onClick={() => addToTodo(action)}
                      disabled={addingTodoId === action.id || todoAddedIds.has(action.id)}
                      className="w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110 text-[#765247]/70 hover:text-[#765247] disabled:opacity-50 disabled:hover:scale-100"
                      title={todoAddedIds.has(action.id) ? "Already in To-do" : "Add to To-do"}
                    >
                      {addingTodoId === action.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListTodo className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => markComplete(action.id)}
                      className="w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
                      style={{ color: "#7a8f66" }}
                      title="Mark done"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => dismissAction(action.id)}
                      className="w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110 text-muted-foreground hover:text-destructive"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Completed (expandable) */}
        <AnimatePresence>
          {expanded && completed.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border/30 flex flex-wrap gap-1.5">
                {completed.slice(0, 5).map((action) => (
                  <div
                    key={action.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs opacity-50"
                    style={{
                      background: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(247,236,228,0.82)",
                    }}
                  >
                    <CheckCircle2 className="w-3 h-3 text-[#7a8f66]" />
                    <span className="line-through truncate max-w-30">{action.title}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

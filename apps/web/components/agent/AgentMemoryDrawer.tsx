'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  X,
  Compass,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  MessageSquare,
  AlertCircle,
  Lightbulb,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface UnresolvedThread {
  id: string;
  topic: string;
  initial_context?: string;
  context?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'active' | 'resolved' | 'snoozed';
  last_referenced_at?: string;
}

interface AgentInference {
  id: string;
  inference: string;
  premise: string;
  confidence: number;
}

interface AgentMemoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectThread: (prompt: string, threadId?: string, threadTopic?: string) => void;
}

/**
 * Natural epistemic phrasing replacing clinical raw percentages
 */
function getEpistemicLabel(confidence: number): { label: string; badgeClass: string } {
  if (confidence >= 0.85) {
    return {
      label: 'Strong observation',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    };
  }
  if (confidence >= 0.70) {
    return {
      label: 'Noticed pattern',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    };
  }
  return {
    label: 'Working hypothesis',
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900/40 dark:text-stone-300 dark:border-stone-800',
  };
}

export function AgentMemoryDrawer({ isOpen, onClose, onSelectThread }: AgentMemoryDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<UnresolvedThread[]>([]);
  const [inferences, setInferences] = useState<AgentInference[]>([]);
  const [nudgesRemaining, setNudgesRemaining] = useState<number>(2);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [deletingPatternId, setDeletingPatternId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      void fetchMemoryState();
    }
  }, [isOpen]);

  const fetchMemoryState = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/v2/state');
      if (res.ok) {
        const data = await res.json();
        setThreads(data.active_threads || []);
        setInferences(data.agent_inferences || []);
        setNudgesRemaining(data.daily_nudges_remaining ?? 2);
      }
    } catch (err) {
      console.warn('Failed to load agent memory state:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveThread = async (threadId: string) => {
    setResolvingId(threadId);
    try {
      const res = await fetch('/api/agent/v2/quick-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          actionType: 'resolved',
          replyText: 'Marked as resolved from Memory drawer',
        }),
      });

      if (res.ok) {
        toast.success('Thread marked as resolved');
        // Update local list
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
      } else {
        toast.error('Could not update thread');
      }
    } catch {
      toast.error('Network error updating thread');
    } finally {
      setResolvingId(null);
    }
  };

  const handleDeletePattern = async (patternId: string) => {
    setDeletingPatternId(patternId);
    try {
      const res = await fetch('/api/agent/v2/pattern', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patternId }),
      });

      if (res.ok) {
        toast.success('Observed pattern removed from memory');
        setInferences((prev) => prev.filter((inf) => inf.id !== patternId));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('force:nudge-updated'));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Could not delete pattern');
      }
    } catch {
      toast.error('Network error deleting pattern');
    } finally {
      setDeletingPatternId(null);
    }
  };

  const handleTriggerCheck = async () => {
    setTriggerLoading(true);
    setTriggerStatus(null);
    try {
      const res = await fetch('/api/agent/v2/nudge/check', { method: 'POST' });
      const data = await res.json();

      if (data.result?.should_reach && data.result?.decision?.content) {
        setTriggerStatus('✨ Force surfaced a thoughtful reflection.');
        toast.success('Force generated a proactive reflection');
        void fetchMemoryState();
      } else {
        const reasonMap: Record<string, string> = {
          agent_chose_silence: 'Force chose silence (confidence below floor or no active tension to disturb).',
          daily_cap_reached: 'Daily limit reached (max 2 proactive reaches per day to preserve quiet).',
          cooldown_period_active: 'Cooldown active (must wait at least 4 hours between proactive nudges).',
          pending_nudge_still_active: 'An unread nudge is still waiting for you in the floating capsule.',
        };
        const message = reasonMap[data.result?.reason] || `Force chose silence (${data.result?.reason || 'quiet'}).`;
        setTriggerStatus(message);
        toast.info(message);
      }
    } catch {
      setTriggerStatus('Failed to evaluate proactive check.');
      toast.error('Failed to trigger check');
    } finally {
      setTriggerLoading(false);
      setTimeout(() => setTriggerStatus(null), 8000);
    }
  };

  const openThreads = threads.filter((t) => t.status === 'open' || t.status === 'active');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-xs"
          />

          {/* Slide-over panel */}
          <motion.aside
            initial={{ x: 360 }}
            animate={{ x: 0 }}
            exit={{ x: 360 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#E6DFD5] bg-[#FAF7F2] shadow-2xl font-sans"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#EAE3D9] bg-[#F5EFEB] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8f4d30] text-white shadow-xs">
                  <Brain size={16} />
                </div>
                <div>
                  <h3 className="font-serif text-base font-semibold text-[#2E2012]">Working Memory</h3>
                  <p className="text-xs text-[#7A5A3A]">What Force is currently holding in mind</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-[#7A5A3A] hover:bg-black/5 hover:text-[#2E2012] transition-colors cursor-pointer"
                title="Close Memory drawer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Diagnostic Banner if triggered */}
            {triggerStatus && (
              <div className="border-b border-[#8f4d30]/20 bg-[#8f4d30]/8 px-4 py-2.5 text-xs text-[#7A5A3A] flex items-start gap-2">
                <Sparkles size={14} className="text-[#8f4d30] mt-0.5 shrink-0" />
                <span className="leading-relaxed">{triggerStatus}</span>
              </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Section 1: Check in with Force */}
              <div className="rounded-xl border border-[#E6DFD5] bg-[#F5EFEB] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#2E2012] flex items-center gap-1.5">
                    <Compass size={14} className="text-[#8f4d30]" />
                    Check in with Force
                  </span>
                  <span className="text-[11px] text-[#7A5A3A]">
                    {nudgesRemaining} check-ins left today
                  </span>
                </div>
                <p className="text-xs text-[#7A5A3A] leading-relaxed">
                  Ask Force to evaluate your active threads and surface a reflection when you are ready.
                </p>
                <button
                  onClick={handleTriggerCheck}
                  disabled={triggerLoading || nudgesRemaining === 0}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-[#8f4d30] px-3 py-2 text-xs font-medium text-white hover:bg-[#723c24] disabled:opacity-50 transition-all cursor-pointer shadow-xs"
                >
                  {triggerLoading ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  <span>{triggerLoading ? 'Evaluating...' : 'Check now'}</span>
                </button>
              </div>

              {/* Section 2: Active Unresolved Threads */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-sm font-semibold text-[#2E2012] flex items-center gap-1.5">
                    <Clock size={14} className="text-[#8f4d30]" />
                    Active Threads ({openThreads.length})
                  </h4>
                </div>

                {loading ? (
                  <div className="py-6 text-center text-xs text-[#7A5A3A] flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-[#8f4d30]" />
                    Loading working memory...
                  </div>
                ) : openThreads.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#D7C8B8] bg-white/40 p-4 text-center space-y-1">
                    <CheckCircle2 size={18} className="mx-auto text-emerald-600" />
                    <p className="text-xs font-medium text-[#2E2012]">All threads clear</p>
                    <p className="text-[11px] text-[#7A5A3A]">
                      No unresolved dilemmas are currently open. When you share a decision in chat, Force holds it here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {openThreads.map((thread) => (
                      <div
                        key={thread.id}
                        className="rounded-xl border border-[#E6DFD5] bg-white/80 p-3.5 shadow-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-[#2E2012] leading-snug">
                            {thread.topic}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium border uppercase tracking-wider ${
                              thread.priority === 'high'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-stone-50 text-stone-600 border-stone-200'
                            }`}
                          >
                            {thread.priority}
                          </span>
                        </div>

                        {thread.context && (
                          <p className="text-[11px] text-[#7A5A3A] line-clamp-2 leading-relaxed">
                            {thread.context}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1 border-t border-[#EAE3D9]/60 text-[11px]">
                          <button
                            onClick={() => {
                              onSelectThread(`Let's reflect on this unresolved decision: "${thread.topic}"`, thread.id, thread.topic);
                              onClose();
                            }}
                            className="text-[#8f4d30] hover:text-[#723c24] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <MessageSquare size={12} />
                            <span>Discuss</span>
                          </button>
                          <button
                            onClick={() => handleResolveThread(thread.id)}
                            disabled={resolvingId === thread.id}
                            className="text-stone-500 hover:text-emerald-700 font-medium flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 size={12} />
                            <span>{resolvingId === thread.id ? 'Resolving...' : 'Mark Resolved'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3: Observed Thinking Patterns */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-sm font-semibold text-[#2E2012] flex items-center gap-1.5">
                    <Lightbulb size={14} className="text-[#8f4d30]" />
                    Observed Patterns ({inferences.length})
                  </h4>
                  <span className="text-[10px] text-[#8B7665] font-sans">
                    Tap delete to remove any pattern
                  </span>
                </div>

                {inferences.length === 0 ? (
                  <p className="text-xs text-[#7A5A3A] italic">
                    As you reflect and converse with Force, recurring thinking patterns and rhythms will appear here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {inferences.map((inf) => {
                      const epistemic = getEpistemicLabel(inf.confidence);
                      const isDeleting = deletingPatternId === inf.id;
                      return (
                        <div
                          key={inf.id}
                          className="group relative rounded-xl border border-[#E6DFD5] bg-white/60 p-3 space-y-1.5 hover:border-[#8f4d30]/30 hover:bg-white/80 transition-all"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${epistemic.badgeClass}`}
                            >
                              {epistemic.label}
                            </span>
                            <button
                              onClick={() => handleDeletePattern(inf.id)}
                              disabled={isDeleting}
                              title="Delete this observed pattern from memory"
                              aria-label="Delete observed pattern"
                              className="opacity-70 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-[#8B7665] hover:text-rose-600 hover:bg-rose-50 px-1.5 py-0.5 rounded transition-all cursor-pointer disabled:opacity-40"
                            >
                              {isDeleting ? (
                                <Loader2 size={11} className="animate-spin text-rose-500" />
                              ) : (
                                <Trash2 size={11} />
                              )}
                              <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                            </button>
                          </div>
                          <p className="text-xs text-[#2E2012] leading-relaxed">
                            {inf.inference}
                          </p>
                          {inf.premise && (
                            <p className="text-[10px] text-[#8B7665] italic">
                              Basis: {inf.premise}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

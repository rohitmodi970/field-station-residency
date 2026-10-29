'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Send,
  MessageSquare,
  Compass,
  CheckCircle2,
  Clock,
  Brain,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  ChevronRight,
  Shield,
  Layers,
  RefreshCw,
  X,
} from 'lucide-react';
import { useTheme } from '@/utilities/context/ThemeContext';

interface InteractionEvent {
  id: string;
  source: 'messaging' | 'web_app' | 'agent' | string;
  event_type: string;
  event_data: {
    text?: string;
    message?: string;
    action?: string;
    confidence?: number;
    source_distinction?: string;
    reasoning_trace?: string;
  };
  created_at: string;
}

interface UnresolvedThread {
  id: string;
  topic: string;
  context: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'resolved';
}

interface ExplicitFact {
  id: string;
  fact: string;
  category: string;
  source_label?: string;
}

interface AgentInference {
  id: string;
  inference: string;
  premise: string;
  confidence: number;
}

export default function ForceCompanionView() {
  const { elementColors, pageBackground } = useTheme();
  const [messages, setMessages] = useState<InteractionEvent[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeThreads, setActiveThreads] = useState<UnresolvedThread[]>([]);
  const [facts, setFacts] = useState<ExplicitFact[]>([]);
  const [inferences, setInferences] = useState<AgentInference[]>([]);
  const [nudgesRemaining, setNudgesRemaining] = useState<number>(2);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, string>>({});
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchState();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/agent/v2/state');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.recent_events || []);
        setActiveThreads(data.active_threads || []);
        setFacts(data.explicit_facts || []);
        setInferences(data.agent_inferences || []);
        setNudgesRemaining(data.daily_nudges_remaining ?? 2);
      }
    } catch (err) {
      console.error('Failed to load agent state:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputValue.trim();
    if (!text || loading) return;

    setInputValue('');
    setLoading(true);

    // Optimistic user message
    const tempUserEvent: InteractionEvent = {
      id: `temp-${Date.now()}`,
      source: 'web_app',
      event_type: 'message',
      event_data: { text },
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserEvent]);

    try {
      const res = await fetch('/api/agent/v2/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, source: 'web_app' }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.decision && data.decision.action !== 'silence' && data.decision.content) {
          const agentEvent: InteractionEvent = {
            id: data.agent_event_id || `agent-${Date.now()}`,
            source: 'agent',
            event_type: 'message',
            event_data: {
              text: data.decision.content,
              action: data.decision.action,
              confidence: data.decision.confidence,
              source_distinction: data.decision.source_distinction,
              reasoning_trace: data.decision.reasoning_trace,
            },
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, agentEvent]);
        }
        // Refresh memory and active threads
        fetchState();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (
    eventId: string,
    feedbackType: 'accurate_and_helpful' | 'inaccurate' | 'too_intrusive'
  ) => {
    setFeedbackGiven((prev) => ({ ...prev, [eventId]: feedbackType }));
    try {
      await fetch('/api/agent/v2/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interaction_id: eventId.startsWith('temp') ? undefined : eventId,
          feedback_type: feedbackType,
        }),
      });
    } catch (err) {
      console.error('Feedback error:', err);
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
        fetchState();
      } else {
        const reasonMap: Record<string, string> = {
          agent_chose_silence: 'Force chose silence (confidence below threshold or no immediate reason to interrupt).',
          daily_cap_reached: 'Daily limit reached (max 2 proactive reaches per day to preserve quiet).',
          cooldown_period_active: 'Cooldown active (must wait at least 4 hours between proactive nudges).',
        };
        setTriggerStatus(reasonMap[data.result?.reason] || 'Agent chose silence.');
      }
    } catch (err) {
      setTriggerStatus('Failed to evaluate proactive check.');
    } finally {
      setTriggerLoading(false);
      setTimeout(() => setTriggerStatus(null), 6000);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-muted-foreground">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#171311] p-2">
          <img src="/logo.svg" alt="Force" className="h-full w-full object-contain" />
        </div>
        <p className="text-sm">Opening Force...</p>
      </div>
    );
  }

  return (
    <div
      className="relative mx-auto flex h-[calc(100vh-5rem)] w-full max-w-7xl overflow-hidden rounded-2xl border border-black/10 shadow-sm dark:border-white/10"
      style={{ backgroundColor: pageBackground || elementColors.background, color: elementColors.text }}
    >
      {/* Main Conversation Column */}
      <div className="flex min-w-0 flex-1 flex-col bg-white/35 dark:bg-black/10">
        {/* Header */}
        <div className="z-10 flex items-center justify-between border-b border-border/70 bg-card/90 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-wide text-foreground">Force</h2>
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Companion
                </span>
              </div>
              <p className="text-xs text-muted-foreground">A quiet space to think things through.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground sm:flex">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>{nudgesRemaining} check-ins left today</span>
            </div>

            <button
              onClick={() => setMemoryOpen(!memoryOpen)}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Brain className="h-3.5 w-3.5 text-primary" />
              <span>Memory ({activeThreads.length})</span>
            </button>
          </div>
        </div>

        {/* Proactive Trigger Alert Banner if triggered */}
        {triggerStatus && (
          <div className="flex items-center justify-between border-b border-primary/15 bg-primary/5 px-6 py-2 text-xs text-primary">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="Force" className="h-3.5 w-3.5 rounded-sm bg-[#171311] p-0.5" />
              <span>{triggerStatus}</span>
            </div>
            <button onClick={() => setTriggerStatus(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center space-y-4 text-center text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted p-3 shadow-inner">
                <img src="/logo.svg" alt="Force" className="h-full w-full rounded-md bg-[#171311] p-1" />
              </div>
              <h3 className="text-base font-medium text-foreground">Start with a thought</h3>
              <p className="text-xs leading-relaxed">
                You don't need to write formatted diary entries. Share brief thoughts, unresolved decisions, or ask Force what patterns it has noticed about you.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.source !== 'agent';
              const text = msg.event_data?.text || msg.event_data?.message || '';
              const action = msg.event_data?.action;
              const confidence = msg.event_data?.confidence;
              const distinction = msg.event_data?.source_distinction;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-2xl ${
                    isUser ? 'ml-auto' : 'mr-auto'
                  }`}
                >
                  <div
                    className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-primary text-primary-foreground rounded-br-xs shadow-sm'
                        : 'bg-muted border border-border text-foreground rounded-bl-xs shadow-sm'
                    }`}
                  >
                    {text}
                  </div>

                  {/* Metadata & Feedback bar for Agent responses */}
                  {!isUser && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-xs text-muted-foreground">
                      {action && (
                        <span className="rounded border border-primary/20 bg-primary/10 px-2 py-0.5 capitalize text-primary">
                          {action.replace('_', ' ')}
                        </span>
                      )}

                      {confidence !== undefined && (
                        <span className="text-muted-foreground">
                          {Math.round(confidence * 100)}% confidence
                        </span>
                      )}

                      {distinction && (
                        <span className="capitalize text-muted-foreground">
                          · {distinction}
                        </span>
                      )}

                      {/* 1-Click Feedback */}
                      <div className="ml-auto flex items-center gap-1">
                        {feedbackGiven[msg.id] ? (
                          <span className="text-[11px] text-emerald-400 font-medium">Feedback recorded ✓</span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleFeedback(msg.id, 'accurate_and_helpful')}
                              title="Accurate & helpful"
                              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-emerald-500"
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleFeedback(msg.id, 'inaccurate')}
                              title="Inaccurate"
                              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-amber-500"
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleFeedback(msg.id, 'too_intrusive')}
                              title="Too intrusive"
                              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-red-500"
                            >
                              <AlertCircle className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="border-t border-border/70 bg-card/90 p-4 backdrop-blur-md">
          {/* Quick Prompts */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none text-xs">
            <button
              onClick={() => setInputValue("Here's an unresolved decision on my mind today: ")}
              className="whitespace-nowrap rounded-full border border-border bg-muted px-3 py-1 text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
            >
              💭 Open Decision...
            </button>
            <button
              onClick={() => setInputValue("What recurring patterns have you noticed in how I think?")}
              className="whitespace-nowrap rounded-full border border-border bg-muted px-3 py-1 text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
            >
              🔍 Reflect on my patterns
            </button>
            <button
              onClick={() => setInputValue("I resolved the decision I was working through.")}
              className="whitespace-nowrap rounded-full border border-border bg-muted px-3 py-1 text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
            >
              ✅ Close out a thread
            </button>
          </div>

          <form onSubmit={handleSendMessage} className="flex items-center gap-2 relative mt-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Talk to Force, share a thought, or update an ongoing thread..."
              disabled={loading}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              className="absolute right-2 flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Working Memory Sidebar / Drawer */}
      <div
        className={`${
          memoryOpen ? 'w-80 border-l border-slate-800/80' : 'w-0 border-none'
        } flex flex-col overflow-hidden bg-card transition-all duration-300`}
      >
        <div className="p-4 border-b border-slate-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Memory</h3>
          </div>
          <button
            onClick={() => setMemoryOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs">
          {/* Proactive Trigger Check Button */}
          <div className="space-y-2 rounded-xl border border-primary/15 bg-primary/5 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-primary">Check in with Force</span>
              <img src="/logo.svg" alt="Force" className="h-3.5 w-3.5 rounded-sm bg-[#171311] p-0.5" />
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Ask Force to look for a useful reflection when you are ready.
            </p>
            <button
              onClick={handleTriggerCheck}
              disabled={triggerLoading || nudgesRemaining === 0}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              {triggerLoading ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Compass className="w-3 h-3" />
              )}
              <span>Check now</span>
            </button>
          </div>

          {/* Active Unresolved Threads */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Active Threads ({activeThreads.length})
              </span>
            </div>
            {activeThreads.length === 0 ? (
              <p className="italic text-muted-foreground">No open threads yet.</p>
            ) : (
              <div className="space-y-2">
                {activeThreads.map((thread) => (
                  <div
                    key={thread.id}
                    className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{thread.topic}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${
                          thread.priority === 'high'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {thread.priority}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{thread.context}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Explicit Facts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Grounded Facts ({facts.length})
              </span>
            </div>
            {facts.length === 0 ? (
              <p className="italic text-muted-foreground">No explicit facts recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {facts.slice(-6).map((fact) => (
                  <div
                    key={fact.id}
                    className="rounded border border-border/70 bg-muted/50 p-2 text-[11px] text-foreground"
                  >
                    <span className="mr-1 capitalize text-muted-foreground">[{fact.category}]:</span>
                    {fact.fact}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agent Hypotheses */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Agent Hypotheses ({inferences.length})
              </span>
            </div>
            {inferences.length === 0 ? (
              <p className="italic text-muted-foreground">No inferences formed yet.</p>
            ) : (
              <div className="space-y-2">
                {inferences.slice(-4).map((infer) => (
                  <div
                    key={infer.id}
                    className="space-y-1 rounded-lg border border-primary/15 bg-primary/5 p-2.5 text-[11px] text-foreground"
                  >
                    <div className="flex items-center justify-between text-[10px] text-primary">
                      <span>Hypothesis</span>
                      <span>{Math.round(infer.confidence * 100)}%</span>
                    </div>
                    <p>{infer.inference}</p>
                    {infer.premise && (
                      <p className="text-[10px] text-muted-foreground">Premise: {infer.premise}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

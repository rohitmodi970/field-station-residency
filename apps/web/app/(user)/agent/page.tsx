'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Check,
  X,
  Sliders,
  ListTodo,
  ExternalLink,
  ArrowUp,
  Loader2,
  Plus,
  Trash2,
  BookOpen,
  Calendar,
  BarChart3,
  CheckSquare,
  Square,
  Search,
  MessageSquare,
  Mic,
  Brain,
  Compass,
  Radio,
  Layers,
  Lock,
  MousePointer,
  Activity,
  PanelLeft,
  ChevronRight,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { getAllJournalEntriesWithStatus } from '@/utilities/journal-data';
import { useAiDecryption } from '@/utils/encryption/useAiDecryption';
import { AgentMemoryDrawer } from '@/components/agent/AgentMemoryDrawer';
import { VoiceDebriefModal } from '@/components/agent/VoiceDebriefModal';
import { InterventionFeedbackBar } from '@/components/agent/InterventionFeedbackBar';
import { RealWorldActionCard } from '@/components/agent/RealWorldActionCard';
import { toast } from 'sonner';
import { AgentControlModal } from '@/components/agent/AgentControlModal';
import { TelegramConnectModal } from '@/components/agent/TelegramConnectModal';
import { ClaudeToolCall } from '@/components/agent/ClaudeToolCall';
import { generateSmartSemanticTitle, cleanAiGeneratedTitle } from '@/lib/force-agent/smartTitleCore';
import { useUserLocation } from '@/hooks/useUserLocation';

// Custom markdown components for Claude/Gemini-like typography
const markdownComponents = {
  p: ({ children }: any) => <p className="mb-3 last:mb-0 leading-relaxed text-[#241A14]">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-[#18110B]">{children}</strong>,
  em: ({ children }: any) => <em className="italic text-[#4A321E]">{children}</em>,
  ol: ({ children }: any) => <ol className="list-decimal pl-5 my-3 space-y-1.5 text-[#241A14]">{children}</ol>,
  ul: ({ children }: any) => <ul className="list-disc pl-5 my-3 space-y-1.5 text-[#241A14]">{children}</ul>,
  li: ({ children }: any) => <li className="leading-relaxed pl-1">{children}</li>,
  h1: ({ children }: any) => <h1 className="text-lg font-serif font-bold text-[#18110B] mt-4 mb-2">{children}</h1>,
  h2: ({ children }: any) => <h2 className="text-base font-serif font-semibold text-[#18110B] mt-3.5 mb-1.5">{children}</h2>,
  h3: ({ children }: any) => <h3 className="text-sm font-serif font-semibold text-[#18110B] mt-3 mb-1">{children}</h3>,
  code: ({ children }: any) => (
    <code className="rounded-md bg-[#EDE7DF] px-1.5 py-0.5 font-mono text-[13px] text-[#8F4D30] border border-[#DFDAD2]">
      {children}
    </code>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="rounded-r-xl border-l-3 border-[#8F4D30] bg-[#F7F3EE] py-2 px-3.5 text-[#4A321E] my-3 text-[14px] leading-relaxed shadow-2xs">
      {children}
    </blockquote>
  ),
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#8F4D30] font-medium underline underline-offset-2 hover:text-[#6E351E] transition-colors inline-flex items-center gap-0.5"
    >
      <span>{children}</span>
      <ExternalLink size={11} className="inline opacity-80" />
    </a>
  ),
};

const userMarkdownComponents = {
  p: ({ children }: any) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }: any) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }: any) => <em className="italic text-white/90">{children}</em>,
  ol: ({ children }: any) => <ol className="list-decimal pl-5 my-1.5 space-y-1">{children}</ol>,
  ul: ({ children }: any) => <ul className="list-disc pl-5 my-1.5 space-y-1">{children}</ul>,
  li: ({ children }: any) => <li className="leading-relaxed pl-0.5">{children}</li>,
};

// ── Force Dragonfly Brand Emblem ──
function ForceLogo({ className = "w-6 h-6", color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 206 156"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M85.3772 32.024L16.1691 18.3645C10.9033 17.3252 6 21.3553 6 26.7227C6 30.8625 8.97598 34.4031 13.0541 35.1152L72.9119 45.5665C76.784 46.2426 79.6096 49.6043 79.6096 53.535C79.6096 57.649 76.5216 61.1077 72.4339 61.5723L51.7716 63.9202C42.8656 64.9323 39.49 76.1065 46.3462 81.8801C48.8875 84.0202 52.311 84.7903 55.5239 83.9448L86.0883 75.9016C91.2213 74.5508 94.7989 69.9099 94.7989 64.6022V43.4869C94.7989 37.9062 90.8523 33.1046 85.3772 32.024Z"
        fill={color}
        stroke={color}
        strokeWidth="6"
      />
      <path
        d="M120.579 32.024L189.787 18.3645C195.053 17.3252 199.956 21.3553 199.956 26.7227C199.956 30.8625 196.98 34.4031 192.902 35.1152L133.044 45.5665C129.172 46.2426 126.346 49.6043 126.346 53.535C126.346 57.649 129.434 61.1077 133.522 61.5723L153.915 63.8896C162.691 64.8869 165.865 76.0069 158.939 81.4872C156.537 83.3876 153.391 84.069 150.418 83.3327L120.032 75.8074C114.819 74.5162 111.157 69.837 111.157 64.466V43.4869C111.157 37.9062 115.104 33.1046 120.579 32.024Z"
        fill={color}
        stroke={color}
        strokeWidth="6"
      />
      <path
        d="M102.979 5.8418H105.315C107.897 5.84184 109.989 7.9345 109.989 10.5156C109.989 13.0968 107.897 15.1894 105.315 15.1895H102.979C100.397 15.1894 98.3047 13.0968 98.3047 10.5156C98.3047 7.93448 100.397 5.84181 102.979 5.8418Z"
        fill={color}
        stroke={color}
        strokeWidth="6"
      />
      <path
        d="M111.157 143.714V66.5989C111.157 63.3724 113.773 60.7568 116.999 60.7568C120.226 60.7568 122.841 63.3724 122.841 66.5989V143.714C122.841 146.94 120.226 149.556 116.999 149.556C113.773 149.556 111.157 146.94 111.157 143.714Z"
        fill={color}
        stroke={color}
        strokeWidth="6"
      />
    </svg>
  );
}

interface ToolExecution {
  tool:
    | 'tinyfish'
    | 'task_generation'
    | 'reflective_synthesis'
    | 'memory_query'
    | 'journal_analysis'
    | 'journal_read'
    | 'journal_created'
    | 'todo_list'
    | 'todo_updated'
    | 'user_stats'
    | 'unsupported'
    | string;
  status: 'success' | 'running' | 'failed' | 'unsupported';
  title?: string;
  message?: string;
  data?: Record<string, any>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  memorySource?: string;
  toolExecution?: ToolExecution;
  interactionEventId?: string;
  toolExecutions?: ToolExecution[];
  timestamp: string;
  durationMs?: number;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ActiveBackgroundTask {
  id: string;
  originSessionId: string;
  originSessionTitle: string;
  taskType: string;
  goal: string;
  currentAction: string;

  status: 'idle' | 'running' | 'success' | 'failed' | 'needs_input';

  targetUrl?: string;
  streamingUrl?: string;
  steps: string[];
  outcome?: any;
  startedAt: string;
  updatedAt: string;
  messageId?: string;
}

const SESSIONS_STORAGE_KEY = 'force_agent_sessions_v1';
const ACTIVE_SESSION_STORAGE_KEY = 'force_agent_active_session_id';
const ACTIVE_BACKGROUND_TASK_STORAGE_KEY = 'force_agent_active_background_task_v1';

function getLoadingStageDescription(seconds: number, lastMsg?: string): string {
  const lower = (lastMsg || '').toLowerCase();
  const isSearchOrEvent =
    lower.includes('event') ||
    lower.includes('search') ||
    lower.includes('find') ||
    lower.includes('look up') ||
    lower.includes('sign up') ||
    lower.includes('register') ||
    lower.includes('near me');

  if (seconds < 2) {
    return isSearchOrEvent ? 'Checking location & local context...' : 'Thinking...';
  } else if (seconds < 5) {
    return isSearchOrEvent ? 'Searching the live web with Firecrawl...' : 'Executing autonomous tools...';
  } else if (seconds < 9) {
    return isSearchOrEvent ? 'Analyzing events and venues...' : 'Synthesizing response...';
  } else {
    return 'Formulating final recommendations...';
  }
}

export default function ForceAgentChatPage() {
  // Session states
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState(false);
  const [isDebriefOpen, setIsDebriefOpen] = useState(false);
  const [debriefConnections, setDebriefConnections] = useState<Array<{ id: string; name: string; partner_id: string }>>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [isControlModalOpen, setIsControlModalOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isLocationMenuOpen, setIsLocationMenuOpen] = useState(false);

  // Active cross-chat background task state (persisted across sessions and reloads)
  const [activeBackgroundTask, setActiveBackgroundTask] = useState<ActiveBackgroundTask | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(ACTIVE_BACKGROUND_TASK_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const updateActiveBackgroundTask = useCallback(
    (updater: (prev: ActiveBackgroundTask | null) => ActiveBackgroundTask | null) => {
      setActiveBackgroundTask((prev) => {
        const next = updater(prev);
        if (next) {
          try {
            localStorage.setItem(ACTIVE_BACKGROUND_TASK_STORAGE_KEY, JSON.stringify(next));
          } catch {}
        } else {
          try {
            localStorage.removeItem(ACTIVE_BACKGROUND_TASK_STORAGE_KEY);
          } catch {}
        }
        return next;
      });
    },
    []
  );

  // User live location state & permissions
  const {
    location,
    permissionState: locationPermission,
    isLoading: isLocationLoading,
    error: locationError,
    requestLocation,
    clearLocation,
    hasLocationAccess,
  } = useUserLocation();

  // Active messages & input state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<{ id: string; topic: string } | null>(null);
  const [isResolvingThread, setIsResolvingThread] = useState(false);
  const [loadingElapsedSeconds, setLoadingElapsedSeconds] = useState(0);

  // Live timer for active agent reflection
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isLoading) {
      setLoadingElapsedSeconds(0);
      interval = setInterval(() => {
        setLoadingElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setLoadingElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  // Client decrypted journals cache
  const [decryptedJournals, setDecryptedJournals] = useState<any[]>([]);

  // Client decrypted todos cache
  const [decryptedTodos, setDecryptedTodos] = useState<any[]>([]);
  const { decryptTodo } = useAiDecryption();

  // Load client decrypted todos on mount and sync with todo updates
  const loadClientTodos = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-todo');
      const data = await res.json();
      const rawTodos = data.todos ?? [];
      const decrypted = await Promise.all(
        rawTodos.map(async (row: any) => {
          const fields = await decryptTodo(row);
          return {
            ...row,
            title: (fields.title && fields.title.trim()) || (row.title && row.title.trim()) || '',
            description: (fields.description && fields.description.trim()) || row.description || null,
            category: fields.category || row.category || 'Personal',
          };
        })
      );
      const valid = decrypted.filter((t: any) => Boolean(t.title && t.title.trim()));
      setDecryptedTodos(valid);
    } catch (err) {
      console.warn('[ForceAgent] Could not load client decrypted todos:', err);
    }
  }, [decryptTodo]);

  useEffect(() => {
    loadClientTodos();
  }, [loadClientTodos]);

  useEffect(() => {
    const handler = () => loadClientTodos();
    window.addEventListener('force:todo-updated', handler);
    return () => window.removeEventListener('force:todo-updated', handler);
  }, [loadClientTodos]);

  // TinyFish active stream state (keyed by messageId)
  const [tinyfishStreams, setTinyfishStreams] = useState<
    Record<
      string,
      {
        status: 'idle' | 'running' | 'success' | 'failed' | 'needs_input';
        streamingUrl?: string;
        currentAction?: string;
        steps?: string[];
        outcome?: any;
        targetUrl?: string;
      }
    >
  >({});

  // Card interaction state
  const [addedCandidateTasks, setAddedCandidateTasks] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const activeSessionIdRef = useRef<string>(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const sessionsRef = useRef<ChatSession[]>(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const activeBackgroundTaskRef = useRef<ActiveBackgroundTask | null>(activeBackgroundTask);
  useEffect(() => {
    activeBackgroundTaskRef.current = activeBackgroundTask;
  }, [activeBackgroundTask]);

  // Autonomous continuous task completion tracking
  const attemptedUrlsRef = useRef<Set<string>>(new Set());
  const isAutonomousStoppedRef = useRef<boolean>(false);
  const autonomousAttemptCountRef = useRef<number>(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, tinyfishStreams]);

  // Load client decrypted journals on mount
  useEffect(() => {
    async function loadJournals() {
      try {
        const { entries } = await getAllJournalEntriesWithStatus();
        if (entries && entries.length > 0) {
          setDecryptedJournals(entries);
        }
      } catch (err) {
        console.warn('[ForceAgent] Could not load client decrypted journals:', err);
      }
    }
    loadJournals();
  }, []);

  // Load sessions from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
      const activeId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      if (stored) {
        const parsed: ChatSession[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let upgraded = false;
          const cleanedSessions = parsed.map((s) => {
            const firstUser = s.messages?.find((m) => m.role === 'user')?.content;
            const isLegacy =
              !s.title ||
              s.title === 'Action Planning' ||
              s.title === 'Event Registration' ||
              s.title === 'Reflection Analysis' ||
              s.title === 'New Conversation' ||
              s.title.endsWith('...');
            if (firstUser && isLegacy) {
              upgraded = true;
              return {
                ...s,
                title: generateSmartSemanticTitle(firstUser),
              };
            }
            return s;
          });

          if (upgraded) {
            try {
              localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(cleanedSessions));
            } catch {}
          }

          setSessions(cleanedSessions);
          const target = cleanedSessions.find((s) => s.id === activeId) || cleanedSessions[0];
          if (target) {
            setActiveSessionId(target.id);
            setMessages(target.messages || []);
            return;
          }
        }
      }
    } catch {}

    // Initialize brand new first session if none exists
    const newId = `session-${Date.now()}`;
    const initialSession: ChatSession = {
      id: newId,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    setSessions([initialSession]);
    setActiveSessionId(newId);
    setMessages([]);
  }, []);

  // Save sessions to localStorage whenever they change
  const persistSessions = useCallback((updatedSessions: ChatSession[], activeId?: string) => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(updatedSessions));
      if (activeId) {
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeId);
      }
    } catch (err) {
      console.warn('[ForceAgent] Failed to persist sessions:', err);
    }
  }, []);

  // Check URL query parameters for threadId (e.g. continuing from Companion reach)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paramThreadId = params.get('threadId');
    if (!paramThreadId) return;

    async function loadThreadDetails(id: string) {
      try {
        const res = await fetch('/api/agent/v2/state');
        if (res.ok) {
          const data = await res.json();
          const target = (data.active_threads || []).find((t: any) => t.id === id);
          if (target) {
            setActiveThread({ id: target.id, topic: target.topic });
            setActiveThreadId(target.id);
            setInput((prev) =>
              prev.trim() ? prev : `Let's reflect on this unresolved decision: "${target.topic}"`
            );
          } else {
            setActiveThread({ id, topic: 'Active Dilemma' });
            setActiveThreadId(id);
          }
        }
      } catch (err) {
        console.warn('[ForceAgent] Failed to resolve URL threadId:', err);
      }
    }

    void loadThreadDetails(paramThreadId);
  }, []);

  // Save Pattern Map & Cognition Engine analysis directly into advancedAnalysisHistory so it syncs with /analysis/advanced
  const savePatternMapToHistory = useCallback((data: any, title?: string): string | null => {
    if (!data) return null;
    try {
      const dates = Array.isArray(data.dates) && data.dates.length > 0 ? data.dates.join(' & ') : 'Recent Reflections';
      const entryTitle = title || `Pattern Map: ${dates}`;
      const summary = data.summary || data.reflectionSummary || 'Pattern Map analysis completed';

      const entryIds = Array.isArray(data.entryIds) && data.entryIds.length > 0
        ? data.entryIds
        : (Array.isArray(data.analyzedEntries) ? data.analyzedEntries.map((e: any) => e.journalId || e.id).filter(Boolean) : []);

      const compressedAnalysis = {
        entryIds,
        dates: Array.isArray(data.dates) ? data.dates : [],
        analyzedEntries: Array.isArray(data.analyzedEntries) ? data.analyzedEntries : [],
        keywords: Array.isArray(data.keywords) ? data.keywords : [],
        topicHierarchy: Array.isArray(data.topicHierarchy) ? data.topicHierarchy : [],
        keywordInsight: data.keywordInsight || data.topicInsight || '',
        topicHierarchyInsight: data.topicHierarchyInsight || data.topicInsight || '',
        healthWellnessInsight: data.healthWellnessInsight || data.energyWellbeingInsight || '',
        progressMetrics: data.progressMetrics || { focus: 85, clarity: 80, recovery: 75 },
        happinessSources: Array.isArray(data.happinessSources) ? data.happinessSources : [],
        mindmapInsight: data.mindmapInsight || null,
        mindmapClusters: Array.isArray(data.mindmapClusters) ? data.mindmapClusters : [],
        reflectionSummary: data.reflectionSummary || data.summary || '',
        lifePatterns: Array.isArray(data.lifePatterns) ? data.lifePatterns : [],
        energyWellbeingInsight: data.energyWellbeingInsight || '',
        growthEdge: data.growthEdge || '',
        weeklyInsight: data.weeklyInsight || '',
        vocabularyShifts: data.vocabularyShifts || { phases: [], insight: '' },
        majorMilestones: data.majorMilestones || { milestones: [], insight: '' },
        dailyRhythmPatterns: data.dailyRhythmPatterns || { blocks: [], insight: '' },
        emotionalTriggers: data.emotionalTriggers || [],
        energyLevelTracking: data.energyLevelTracking || [],
        goalProgressMetrics: data.goalProgressMetrics || [],
        socialInteractionImpact: data.socialInteractionImpact || [],
        sleepRestAnalysis: data.sleepRestAnalysis || [],
        creativeOutputLog: data.creativeOutputLog || [],
        stressIndicators: data.stressIndicators || [],
        gratitudeTracking: data.gratitudeTracking || [],
        moodInfluencers: data.moodInfluencers || [],
        metrics: data.metrics || [],
        emotionDistribution: data.emotionDistribution || [],
        flowData: data.flowData || { nodes: [], edges: [] },
        healthMetrics: data.healthMetrics || [],
        tenseUsage: data.tenseUsage || { present: 0, past: 0, future: 0 },
        wordChoiceCategories: data.wordChoiceCategories || [],
      };

      const historyId = `${entryTitle.replace(/\s+/g, '-')}-${Date.now()}`;
      const historyEntry = {
        id: historyId,
        date: new Date().toISOString(),
        title: entryTitle,
        summary,
        entryIds,
        dates: Array.isArray(data.dates) ? data.dates : [],
        analysis: compressedAnalysis,
      };

      const existing = localStorage.getItem('advancedAnalysisHistory');
      let historyList: any[] = [];
      if (existing) {
        try {
          historyList = JSON.parse(existing);
        } catch {}
      }
      const updated = [historyEntry, ...historyList.filter((h: any) => h.title !== entryTitle)].slice(0, 10);
      localStorage.setItem('advancedAnalysisHistory', JSON.stringify(updated));
      localStorage.setItem('advancedAnalysisActiveId', historyId);
      return historyId;
    } catch (err) {
      console.warn('[ForceAgent] Failed to save to advancedAnalysisHistory:', err);
      return null;
    }
  }, []);

  // Switch session
  const selectSession = (sessionId: string) => {
    const target = sessions.find((s) => s.id === sessionId);
    if (target) {
      setActiveSessionId(target.id);
      setMessages(target.messages || []);
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, target.id);
      setIsSidebarOpen(false);
    }
  };

  // Start new session
  const handleNewSession = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    setActiveSessionId(newId);
    setMessages([]);
    persistSessions(updated, newId);
    setIsSidebarOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  // Delete a session
  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter((s) => s.id !== sessionId);
    if (filtered.length === 0) {
      handleNewSession();
      return;
    }
    setSessions(filtered);
    if (activeSessionId === sessionId) {
      const nextActive = filtered[0];
      if (nextActive) {
        setActiveSessionId(nextActive.id);
        setMessages(nextActive.messages || []);
        persistSessions(filtered, nextActive.id);
      }
    } else {
      persistSessions(filtered, activeSessionId);
    }
  };

  // Generate a clean smart conversation title
  const generateTitle = (text: string): string => {
    return generateSmartSemanticTitle(text);
  };

  // Carry on the active background task from another session directly into this current chat
  const handleCarryOnTaskHere = () => {
    if (!activeBackgroundTask) return;
    const task = { ...activeBackgroundTask };
    const currentSession = sessionsRef.current.find((s) => s.id === activeSessionId);
    const currentSessionTitle = currentSession?.title || 'This Conversation';

    // If current conversation has no user messages, give it an intelligent title
    if (messages.length === 0) {
      const continuationTitle = `Carry On: ${task.goal.slice(0, 32)}`;
      setSessions((prevSessions) => {
        const updated = prevSessions.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              title: continuationTitle,
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        });
        persistSessions(updated, activeSessionId);
        return updated;
      });
    }

    // Insert user & assistant continuation message into current session
    const carryUserMsg: ChatMessage = {
      id: `msg-${Date.now()}-carry-user`,
      role: 'user',
      content: `Carry on the ongoing task from "${task.originSessionTitle}": ${task.goal}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const carryAssistantMsg: ChatMessage = {
      id: `msg-${Date.now()}-carry-assistant`,
      role: 'assistant',
      content: `I am carrying on your active task from **"${task.originSessionTitle}"**:\n\n> **Goal**: ${task.goal}\n\n**Current Status**: ${task.currentAction}\n\nI will continue all execution and next steps right here in this chat.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      toolExecution: task.targetUrl
        ? {
            tool: 'tinyfish',
            status: task.status === 'running' ? 'running' : 'success',
            title: task.goal,
            data: {
              url: task.targetUrl,
              eventUrl: task.targetUrl,
              taskType: task.taskType,
              goal: task.goal,
            },
          }
        : undefined,
    };

    // If the task has a live streaming state, link it to this message
    if (task.messageId && tinyfishStreams[task.messageId]) {
      const existing = tinyfishStreams[task.messageId];
      if (existing) {
        setTinyfishStreams((prev) => ({
          ...prev,
          [carryAssistantMsg.id]: existing,
        }));
      }
    } else if (task.targetUrl) {
      setTinyfishStreams((prev) => ({
        ...prev,
        [carryAssistantMsg.id]: {
          status: task.status,
          currentAction: task.currentAction,
          steps: task.steps,
          targetUrl: task.targetUrl,
          streamingUrl: task.streamingUrl,
          outcome: task.outcome,
        },
      }));
    // Update activeBackgroundTask origin to current session and bind new message ID
    updateActiveBackgroundTask((prev) =>
      prev
        ? {
            ...prev,
            originSessionId: activeSessionId,
            originSessionTitle: currentSessionTitle,
            messageId: carryAssistantMsg.id,
            updatedAt: new Date().toISOString(),
          }
        : null
    );

    const updatedCurrentMessages = [...messages, carryUserMsg, carryAssistantMsg];
    setMessages(updatedCurrentMessages);

    // Save updated messages into current session
    setSessions((prevSessions) => {
      const updated = prevSessions.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            updatedAt: new Date().toISOString(),
            messages: updatedCurrentMessages,
          };
        }
        return s;
      });
      persistSessions(updated, activeSessionId);
      return updated;
    });

    setTimeout(() => scrollToBottom(), 100);
  };

  // Handle clicking an analysis mode option in the chat card
  const handleSelectAnalysisMode = (mode: string, targetDates?: string[]) => {
    let modeText = '';
    const datesSuffix = targetDates && targetDates.length > 0 ? ` for ${targetDates.join(' and ')}` : '';
    if (mode === 'cognition_engine') {
      modeText = `Run cognition engine analysis${datesSuffix}`;
    } else if (mode === 'pattern_map') {
      modeText = `Run pattern map analysis${datesSuffix}`;
    } else if (mode === 'voice_analysis') {
      modeText = `Run voice analysis${datesSuffix}`;
    } else {
      modeText = `Analyze journals${datesSuffix}`;
    }
    handleSend(modeText);
  };

  // Handle user manual stop or abort of autonomous tasks
  const handleStopAutonomousTask = (userText?: string) => {
    isAutonomousStoppedRef.current = true;
    activeAbortControllerRef.current?.abort();
    setIsLoading(false);
    setTinyfishStreams((prev) => {
      const updated = { ...prev };
      for (const k of Object.keys(updated)) {
        const stream = updated[k];
        if (stream && stream.status === 'running') {
          updated[k] = {
            ...stream,
            status: 'failed',
            currentAction: 'Autonomous task stopped by user.',
          };
        }
      }
      return updated;
    });

    const stopUserMsg: ChatMessage | null = userText
      ? {
          id: `msg-${Date.now()}-user`,
          role: 'user',
          content: userText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      : null;

    const stopReplyMsg: ChatMessage = {
      id: `msg-${Date.now()}-stopped`,
      role: 'assistant',
      content:
        'I have stopped the autonomous search and registration process. Let me know whenever you would like to resume or try a different request!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => (stopUserMsg ? [...prev, stopUserMsg, stopReplyMsg] : [...prev, stopReplyMsg]));
  };

  // Handle sending a message
  const handleSend = async (overrideText?: string) => {
    const textToSend = (overrideText !== undefined ? overrideText : input).trim();
    if (!textToSend) return;

    // Check if user explicitly instructed to stop/cancel
    const isStopWord = /^\s*(stop|cancel|pause|abort|halt|stop\s+searching|hold\s+on|shut\s+up|please\s+stop)\b/i.test(
      textToSend
    );
    if (isStopWord) {
      if (overrideText === undefined) setInput('');
      handleStopAutonomousTask(textToSend);
      return;
    }

    if (isLoading) return;

    // If new user input (not an automated internal continuation), reset stop flag & counter
    if (overrideText === undefined) {
      isAutonomousStoppedRef.current = false;
      autonomousAttemptCountRef.current = 0;
    }

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (overrideText === undefined) setInput('');
    setIsLoading(true);

    // Immediately update session title in sidebar and top header if starting a new conversation
    if (messages.length === 0) {
      const immediateTitle = generateSmartSemanticTitle(textToSend);
      setSessions((prevSessions) => {
        const updated = prevSessions.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              title: immediateTitle,
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        });
        persistSessions(updated, activeSessionId);
        return updated;
      });
    }

    const sendStartTime = Date.now();
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    const previousSession = sessions.find((s) => s.id !== activeSessionId && s.messages && s.messages.length > 0);
    const lastUserInPrev = previousSession?.messages.filter((m) => m.role === 'user').slice(-1)[0]?.content;
    const lastAssistantInPrev = previousSession?.messages.filter((m) => m.role === 'assistant').slice(-1)[0]?.content;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          sessionId: activeSessionId,
          threadId: activeThread?.id || activeThreadId || undefined,
          decryptedJournals: decryptedJournals.map((j) => ({
            id: j.id || j.journalId,
            journalId: j.journalId || j.id,
            title: j.title || '',
            content: j.resolvedContent || j.content || '',
            date: j.date || j.display_date || j.created_at || '',
            mood: j.mood || null,
            tags: j.tags || [],
            hasVoice:
              Boolean(j.hasVoice) ||
              Boolean(j.voiceTranscript && j.voiceTranscript.trim()) ||
              (Array.isArray(j.mediaType) && j.mediaType.includes('audio')) ||
              (Array.isArray(j.mediaUrl?.audio) && j.mediaUrl.audio.length > 0) ||
              j.journalType === 'voice',
            voiceTranscript: j.voiceTranscript || '',
            mediaType: j.mediaType || [],
            audioUrls: j.mediaUrl?.audio || [],
            journalType: j.journalType || '',
          })),
          decryptedTodos: decryptedTodos.map((t) => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            status: t.status,
            category: t.category,
            due_date: t.due_date,
            created_at: t.created_at,
          })),
          location,
          userLocation: location,
          activeBackgroundTask: activeBackgroundTask
            ? {
                id: activeBackgroundTask.id,
                sourceSessionId: activeBackgroundTask.originSessionId,
                sourceSessionTitle: activeBackgroundTask.originSessionTitle,
                taskType: activeBackgroundTask.taskType,
                goal: activeBackgroundTask.goal,
                currentAction: activeBackgroundTask.currentAction,
                status: activeBackgroundTask.status,
                targetUrl: activeBackgroundTask.targetUrl,
                steps: activeBackgroundTask.steps,
                outcome: activeBackgroundTask.outcome,
              }
            : null,
          previousSessionContext: previousSession
            ? {
                previousSessionId: previousSession.id,
                previousSessionTitle: previousSession.title,
                lastUserMessage: lastUserInPrev,
                lastAssistantMessage: lastAssistantInPrev,
              }
            : null,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to process prompt' }));
        throw new Error(err.error || 'Server error');
      }

      const data = await response.json();

      // Automatically sync Pattern Map & Cognition analysis to advancedAnalysisHistory
      if (
        data.toolExecution?.tool === 'pattern_map_result' ||
        data.toolExecution?.tool === 'journal_analysis'
      ) {
        const savedId = savePatternMapToHistory(data.toolExecution.data, data.toolExecution.title);
        if (savedId && data.toolExecution?.data) {
          data.toolExecution.data.historyId = savedId;
        }
      }

      // Decrypt any todos returned in toolExecution or toolExecutions
      const allTools: ToolExecution[] =
        Array.isArray(data.toolExecutions) && data.toolExecutions.length > 0
          ? data.toolExecutions
          : data.toolExecution
          ? [data.toolExecution]
          : [];

      for (const t of allTools) {
        if (t.tool === 'todo_list' && Array.isArray(t.data?.todos)) {
          try {
            const decryptedList = await Promise.all(
              t.data.todos.map(async (row: any) => {
                const fields = await decryptTodo(row);
                return {
                  ...row,
                  title: (fields.title && fields.title.trim()) || (row.title && row.title.trim()) || '',
                };
              })
            );
            t.data.todos = decryptedList.filter((item: any) => Boolean(item.title && item.title.trim()));
          } catch {}
        }
      }

      const elapsedDurationMs = Date.now() - sendStartTime;
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: data.message || 'I have completed your request.',
        toolExecution: data.toolExecution,
        interactionEventId: data.interaction_id,
        toolExecutions: allTools.length > 0 ? allTools : undefined,
        durationMs: elapsedDurationMs,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      // Check all executed tools: if any browser task is running, launch TinyFish
      for (const t of allTools) {
        if (t.tool === 'tinyfish' && (t.status === 'running' || t.data?.url || t.data?.eventUrl)) {
          const targetUrl = t.data?.url || t.data?.eventUrl;
          if (targetUrl) {
            const isReg = t.data?.taskType === 'registration' || targetUrl.includes('lu.ma') || targetUrl.includes('luma');
            const initialAction = isReg
              ? `Opening event registration for ${getDomainLabel(targetUrl) || 'event'}...`
              : `Navigating to ${getDomainLabel(targetUrl) || targetUrl}...`;
            setTinyfishStreams((prev) => ({
              ...prev,
              [assistantMessage.id]: {
                status: 'running',
                currentAction: initialAction,
                steps: [initialAction],
                targetUrl,
              },
            }));
            void runTinyFishBrowserTask(assistantMessage.id, {
              url: targetUrl,
              eventUrl: targetUrl,
              goal: t.data?.goal,
              prompt: t.data?.prompt || textToSend,
              taskType: t.data?.taskType || 'registration',
              customAnswers: t.data?.customAnswers,
              phone: t.data?.phone,
            });
            break;
          }
        }
      }

      // Update sessions state & localStorage
      setSessions((prevSessions) => {
        const updated = prevSessions.map((s) => {
          if (s.id === activeSessionId) {
            const isFirst = s.messages.length === 0;
            const smartTitle =
              data.suggestedTitle && data.suggestedTitle.trim()
                ? cleanAiGeneratedTitle(data.suggestedTitle, textToSend)
                : isFirst || !s.title || s.title === 'New Conversation'
                ? generateTitle(textToSend)
                : s.title;

            return {
              ...s,
              title: smartTitle,
              updatedAt: new Date().toISOString(),
              messages: finalMessages,
            };
          }
          return s;
        });
        persistSessions(updated, activeSessionId);
        return updated;
      });
    } catch (error: any) {
      if (error.name === 'AbortError' || isAutonomousStoppedRef.current) {
        setIsLoading(false);
        return;
      }
      const errMessage: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `I encountered an issue processing that: ${error.message || 'Please try again'}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  // Toggle todo item directly from chat card
  const handleToggleTodo = async (todoId: string, currentStatus: string, messageId: string) => {
    const nextStatus = currentStatus === 'done' ? 'pending' : 'done';
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_todo',
          todoId,
          todoStatus: nextStatus,
        }),
      });

      // Notify other views like /todo
      window.dispatchEvent(new CustomEvent('force:todo-updated'));

      // Optimistically update message state
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId && msg.toolExecution?.data?.todos) {
            const updatedTodos = msg.toolExecution.data.todos.map((t: any) =>
              t.id === todoId ? { ...t, status: nextStatus } : t
            );
            return {
              ...msg,
              toolExecution: {
                ...msg.toolExecution,
                data: {
                  ...msg.toolExecution.data,
                  todos: updatedTodos,
                },
              },
            };
          }
          return msg;
        })
      );

      // Also update local decrypted todos state
      setDecryptedTodos((prev) =>
        prev.map((t) => (t.id === todoId ? { ...t, status: nextStatus } : t))
      );
    } catch (err) {
      console.warn('Failed to toggle todo:', err);
    }
  };

  // Resolve an active dilemma thread directly from chat
  const handleResolveActiveThread = async (targetThreadId?: string) => {
    const threadToResolve = targetThreadId || activeThread?.id || activeThreadId;
    if (!threadToResolve || isResolvingThread) return;

    setIsResolvingThread(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve_thread',
          threadId: threadToResolve,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve thread');
      }

      toast.success('Dilemma marked as resolved');

      // Append assistant confirmation message
      const threadLabel = activeThread?.topic || 'this dilemma';
      const resolutionMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: `✓ Marked **${threadLabel}** as resolved in your active memory.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => {
        const next = [...prev, resolutionMsg];
        setSessions((prevSessions) => {
          const updated = prevSessions.map((s) => {
            if (s.id === activeSessionId) {
              return {
                ...s,
                updatedAt: new Date().toISOString(),
                messages: next,
              };
            }
            return s;
          });
          persistSessions(updated, activeSessionId);
          return updated;
        });
        return next;
      });

      setActiveThread(null);
      setActiveThreadId(null);

      // Notify other parts of the app (e.g. notifications / drawer)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('force:nudge-updated'));
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not mark dilemma as resolved');
    } finally {
      setIsResolvingThread(false);
    }
  };

  // 1-click create task from candidate recommendation
  const handleAddCandidateTask = async (task: { title: string; priority?: string; category?: string }, key: string) => {
    try {
      await fetch('/api/ai-todo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_manual',
          title: task.title,
          priority: task.priority || 'medium',
          category: task.category || 'Personal',
        }),
      });
      setAddedCandidateTasks((prev) => ({ ...prev, [key]: true }));
    } catch (err) {
      console.warn('Failed to add candidate task:', err);
    }
  };

  function getDomainLabel(rawUrl?: string): string {
    if (!rawUrl) return 'the website';
    try {
      const parsed = new URL(rawUrl);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return (rawUrl || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || 'the website';
    }
  }

  // Run TinyFish autonomous browser task directly from within chat card
  const runTinyFishBrowserTask = async (
    messageId: string,
    options: {
      url?: string;
      eventUrl?: string;
      goal?: string;
      prompt?: string;
      taskType?: string;
      customAnswers?: Record<string, string>;
      phone?: string;
    },
    originSessionId?: string
  ) => {
    if (isAutonomousStoppedRef.current) return;
    const taskSessionId = originSessionId || activeSessionIdRef.current || activeSessionId;
    const originTitle =
      sessionsRef.current.find((s) => s.id === taskSessionId)?.title || 'Previous Chat';

    const targetUrl = options.url || options.eventUrl || '';
    if (targetUrl) {
      attemptedUrlsRef.current.add(targetUrl);
    }

    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    const initialStep = `Navigating to ${getDomainLabel(targetUrl) || targetUrl || 'web page'}...`;
    const initialGoal = options.goal || options.prompt || `Automate task on ${getDomainLabel(targetUrl)}`;

    // Sync to cross-chat background task state so other chats can observe or carry on
    updateActiveBackgroundTask(() => ({
      id: `task-${Date.now()}`,
      originSessionId: taskSessionId,
      originSessionTitle: originTitle,
      taskType: options.taskType || 'registration',
      goal: initialGoal,
      currentAction: initialStep,
      status: 'running',
      targetUrl,
      steps: [initialStep],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageId,
    }));

    setTinyfishStreams((prev) => ({
      ...prev,
      [messageId]: {
        status: 'running',
        currentAction: initialStep,
        steps: [initialStep],
        targetUrl,
      },
    }));

    // Helper to safely write messages into the owning session transcript without corrupting current active view
    const updateSessionMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      const currentTaskOwnerId =
        activeBackgroundTaskRef.current?.originSessionId || taskSessionId;

      if (activeSessionIdRef.current === currentTaskOwnerId) {
        setMessages(updater);
      }
      setSessions((prevSessions) => {
        const updated = prevSessions.map((s) => {
          if (s.id === currentTaskOwnerId) {
            return {
              ...s,
              messages: updater(s.messages || []),
              updatedAt: new Date().toISOString(),
            };
          }
          return s;
        });
        persistSessions(updated);
        return updated;
      });
    };

    try {
      const res = await fetch('/api/agent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          url: targetUrl,
          eventUrl: targetUrl,
          goal: options.goal,
          prompt: options.prompt,
          taskType: options.taskType,
          customAnswers: options.customAnswers,
          phone: options.phone,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const failAction = errData.error || 'Unable to complete browser automation task.';
        setTinyfishStreams((prev) => ({
          ...prev,
          [messageId]: {
            status: 'failed',
            currentAction: failAction,
          },
        }));
        updateActiveBackgroundTask((prev) =>
          prev
            ? {
                ...prev,
                status: 'failed',
                currentAction: failAction,
                updatedAt: new Date().toISOString(),
              }
            : null
        );
        return;
      }

      if (!res.body) throw new Error('No response stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;

          try {
            const event = JSON.parse(dataLine.replace('data: ', ''));

            setTinyfishStreams((prev) => {
              const cur = prev[messageId] || { status: 'running' as const, steps: [] };

              let newStatus: 'idle' | 'running' | 'success' | 'failed' | 'needs_input' = cur.status;
              let streamingUrl = cur.streamingUrl;
              let currentAction = cur.currentAction || 'Automating task...';
              let outcome = cur.outcome;
              const newSteps = [...(cur.steps || [])];

              const addStep = (stepText?: string) => {
                if (!stepText) return;
                const trimmed = stepText.trim();
                if (!trimmed) return;
                if (!newSteps.includes(trimmed)) {
                  newSteps.push(trimmed);
                }
              };

              if (event.type === 'STARTED') {
                addStep('Autonomous browser session started');
              }

              if (event.type === 'PROGRESS' && (event.purpose || event.message)) {
                currentAction = (event.purpose as string) || (event.message as string);
                addStep(currentAction);
              } else if (event.message) {
                currentAction = event.message;
                addStep(currentAction);
              }

              if (event.type === 'STREAMING_URL' && event.streamingUrl) {
                streamingUrl = event.streamingUrl;
              }

              if (event.type === 'COMPLETE') {
                const isSoldOut = Boolean(
                  event.status === 'CLASS_FULL' ||
                  event.result?.status === 'CLASS_FULL' ||
                  event.result?.category === 'sold_out' ||
                  (typeof event.result?.summary === 'string' && /sold\s*out|fully\s*booked|class\s*full|sales\s*ended|registration\s*(is\s*)?closed|event\s*(has\s*)?(already\s*)?ended|event\s*has\s*passed/i.test(event.result.summary)) ||
                  (typeof event.message === 'string' && /sold\s*out|fully\s*booked|class\s*full|sales\s*ended|registration\s*(is\s*)?closed|event\s*(has\s*)?(already\s*)?ended|event\s*has\s*passed/i.test(event.message))
                );
                const isLoginNeeded = !isSoldOut && (event.status === 'LOGIN_REQUIRED' || event.result?.status === 'LOGIN_REQUIRED');
                const isDataNeeded = !isSoldOut && (event.status === 'MISSING_DATA' || event.result?.status === 'MISSING_DATA');
                const isNeedsInput = isLoginNeeded || isDataNeeded;
                const isConfirmed = event.status === 'CONFIRMED' || event.result?.status === 'CONFIRMED' || Boolean(event.result?.confirmed);
                const isSuccess = event.status === 'SUCCESS' || isConfirmed || isSoldOut;

                const summaryText = (event.result?.summary || event.message || '') as string;
                newStatus = isNeedsInput ? 'needs_input' : 'success';
                currentAction = isSoldOut
                  ? (/sales\s*ended/i.test(summaryText) ? 'Ticket sales have ended.' : /event\s*(has\s*)?(already\s*)?ended|event\s*has\s*passed/i.test(summaryText) ? 'Event has already ended.' : 'Event tickets are currently sold out.')
                  : isConfirmed
                  ? 'Registration confirmed!'
                  : isNeedsInput
                  ? `Additional details needed on ${getDomainLabel(targetUrl)}`
                  : 'Completed availability check.';
                addStep(currentAction);
                outcome = {
                  ...(event.result || {}),
                  isSoldOut,
                  summary: event.result?.summary || event.message || (isSoldOut ? 'Tickets are currently sold out.' : 'Check completed.'),
                };

                // Update toolExecution status in messages so it doesn't spin
                const finalToolStatus = (isSuccess || isSoldOut) ? 'success' : isNeedsInput ? 'running' : 'failed';
                updateSessionMessages((prevMsgs) =>
                  prevMsgs.map((m) => {
                    if (m.id !== messageId) return m;
                    return {
                      ...m,
                      toolExecution: m.toolExecution
                        ? { ...m.toolExecution, status: finalToolStatus }
                        : undefined,
                      toolExecutions: m.toolExecutions?.map((t) =>
                        t.tool === 'tinyfish' ? { ...t, status: finalToolStatus } : t
                      ),
                    };
                  })
                );

                // Completion detection: check if confirmed or not
                if (isSoldOut) {
                  const domain = getDomainLabel(targetUrl) || 'the event page';
                  const summary =
                    event.result?.summary ||
                    `This event on ${domain} is currently sold out and no open registration tickets are available.`;

                  const isRegistrationTask =
                    options.taskType === 'registration' ||
                    /register|sign\s*up|rsvp|book/i.test(options.goal || options.prompt || '');

                  // If user hasn't commanded to stop, continue autonomously to find and register for an alternative
                  if (
                    isRegistrationTask &&
                    !isAutonomousStoppedRef.current &&
                    autonomousAttemptCountRef.current < 4
                  ) {
                    autonomousAttemptCountRef.current += 1;

                    // Search conversation messages for any unattempted candidates from web_search
                    let nextCandidate: { title?: string; url: string; snippet?: string } | null = null;
                    const currentMsgs = messagesRef.current || [];
                    for (const m of currentMsgs) {
                      const tools = m.toolExecutions || (m.toolExecution ? [m.toolExecution] : []);
                      for (const t of tools) {
                        if (t.tool === 'web_search' && Array.isArray(t.data?.results)) {
                          for (const res of t.data.results) {
                            if (res.url && !attemptedUrlsRef.current.has(res.url)) {
                              nextCandidate = res;
                              break;
                            }
                          }
                        }
                        if (nextCandidate) break;
                      }
                      if (nextCandidate) break;
                    }

                    if (nextCandidate) {
                      attemptedUrlsRef.current.add(nextCandidate.url);
                      const nextDomain = getDomainLabel(nextCandidate.url);
                      const nextTitle = nextCandidate.title || `AI Event on ${nextDomain}`;

                      const followUpMsg: ChatMessage = {
                        id: `msg-${Date.now()}-soldout-next`,
                        role: 'assistant',
                        content: `Tickets for **${domain}** are sold out or closed.\n\n> ${summary}\n\nSince your goal is to get registered, I am not stopping — checking the next open event: **${nextTitle}** (${nextDomain}) now to secure your spot.\n\n*(You can reply **"stop"** at any time to pause)*`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        toolExecution: {
                          tool: 'tinyfish',
                          status: 'running',
                          title: `Registration: ${nextTitle}`,
                          data: {
                            url: nextCandidate.url,
                            eventUrl: nextCandidate.url,
                            title: nextTitle,
                            taskType: 'registration',
                            prompt: `Register for ${nextTitle} at ${nextCandidate.url}`,
                          },
                        },
                      };

                      updateSessionMessages((prevMsgs) => [...prevMsgs, followUpMsg]);

                      setTimeout(() => {
                        if (!isAutonomousStoppedRef.current) {
                          const currentOwner =
                            activeBackgroundTaskRef.current?.originSessionId || taskSessionId;
                          void runTinyFishBrowserTask(
                            followUpMsg.id,
                            {
                              url: nextCandidate!.url,
                              eventUrl: nextCandidate!.url,
                              prompt: `Register for ${nextTitle}`,
                              taskType: 'registration',
                              customAnswers: options.customAnswers,
                              phone: options.phone,
                            },
                            currentOwner
                          );
                        }
                      }, 700);
                    } else {
                      // No more candidates in current search results, autonomously trigger alternative search
                      const followUpMsg: ChatMessage = {
                        id: `msg-${Date.now()}-soldout-search`,
                        role: 'assistant',
                        content: `Tickets for **${domain}** are sold out or closed.\n\n> ${summary}\n\nAll initial candidates from our search have been checked. I am not stopping — searching now for alternative upcoming AI events, meetups, and workshops in Chennai with open registration tickets to complete your sign-up.\n\n*(You can reply **"stop"** at any time to pause)*`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      };

                      updateSessionMessages((prevMsgs) => [...prevMsgs, followUpMsg]);

                      setTimeout(() => {
                        if (!isAutonomousStoppedRef.current) {
                          void handleSend(
                            'Find alternative upcoming AI events, meetups, and developer workshops in Chennai with open registration tickets and sign me up'
                          );
                        }
                      }, 800);
                    }
                  } else if (autonomousAttemptCountRef.current >= 4) {
                    const followUpMsg: ChatMessage = {
                      id: `msg-${Date.now()}-exhausted`,
                      role: 'assistant',
                      content: `I checked multiple AI events in Chennai, but currently all checked options have closed registration or sold out tickets:\n\n> ${summary}\n\nI have paused automatic attempts so you are not stuck. Would you like me to set a reminder to monitor when new tickets or future editions open up, or search in another city?`,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    };

                    updateSessionMessages((prevMsgs) => [...prevMsgs, followUpMsg]);
                  } else {
                    const followUpMsg: ChatMessage = {
                      id: `msg-${Date.now()}-soldout`,
                      role: 'assistant',
                      content: `I checked **${domain}**, but tickets for this event are currently **sold out**.\n\n> ${summary}\n\nWould you like me to look for alternative AI meetups, summits, or networking events happening in Chennai?`,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    };

                    updateSessionMessages((prevMsgs) => [...prevMsgs, followUpMsg]);
                  }
                } else if (isNeedsInput) {
                  const domain = getDomainLabel(targetUrl);
                  const reason =
                    event.result?.summary ||
                    event.result?.reason ||
                    event.message ||
                    `${domain} requires account credentials or additional personal data to book this session.`;

                  const followUpMsg: ChatMessage = {
                    id: `msg-${Date.now()}-followup`,
                    role: 'assistant',
                    content: `I reached the booking page on **${domain}**, but I couldn't complete the registration because ${
                      isLoginNeeded ? 'an account login or password is required' : 'required personal information is missing'
                    }.\n\n> **${reason}**\n\nPlease reply with your password, phone number, or login credentials in the chat (or use the form in the tool card above), and I will log in and finalize your booking!`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  };

                  updateSessionMessages((prevMsgs) => [...prevMsgs, followUpMsg]);
                }
              }

              // Update active background task on every event
              updateActiveBackgroundTask((prev) =>
                prev
                  ? {
                      ...prev,
                      status: newStatus === 'idle' ? 'running' : newStatus,
                      streamingUrl: streamingUrl || prev.streamingUrl,
                      currentAction,
                      outcome: outcome || prev.outcome,
                      steps: newSteps,
                      updatedAt: new Date().toISOString(),
                    }
                  : null
              );

              return {
                ...prev,
                [messageId]: {
                  status: newStatus,
                  streamingUrl,
                  currentAction,
                  outcome,
                  targetUrl: cur.targetUrl || targetUrl,
                },
              };
            });
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || isAutonomousStoppedRef.current) {
        setTinyfishStreams((prev) => ({
          ...prev,
          [messageId]: {
            status: 'failed',
            currentAction: 'Autonomous task stopped by user.',
          },
        }));
        updateActiveBackgroundTask((prev) =>
          prev
            ? {
                ...prev,
                status: 'failed',
                currentAction: 'Autonomous task stopped by user.',
                updatedAt: new Date().toISOString(),
              }
            : null
        );
        return;
      }
      setTinyfishStreams((prev) => ({
        ...prev,
        [messageId]: {
          status: 'failed',
          currentAction: 'Session ended with an error.',
        },
      }));
      updateActiveBackgroundTask((prev) =>
        prev
          ? {
              ...prev,
              status: 'failed',
              currentAction: 'Session ended with an error.',
              updatedAt: new Date().toISOString(),
            }
          : null
      );
    }
  };

  const runTinyFishRegistration = (messageId: string, eventUrl: string) =>
    runTinyFishBrowserTask(messageId, { url: eventUrl, eventUrl, taskType: 'registration' }, activeSessionIdRef.current);

  // Handle reflective offer affirmation or dismissal
  const handleOfferFeedback = async (offerId: string, status: 'accepted' | 'refined' | 'dismissed', messageId: string) => {
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'offer_feedback',
          offerId,
          feedbackStatus: status,
        }),
      });

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId && msg.toolExecution?.data) {
            return {
              ...msg,
              toolExecution: {
                ...msg.toolExecution,
                data: {
                  ...msg.toolExecution.data,
                  status,
                },
              },
            };
          }
          return msg;
        })
      );
    } catch (err) {
      console.warn('Failed to update offer feedback:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDebriefComplete = useCallback(
    ({ transcript, reflection, partnerName }: { transcript: string; reflection: string; partnerName: string }) => {
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: `🎙️ **Voice Debrief with ${partnerName}**\n\n"${transcript}"`,
        timestamp: new Date().toISOString(),
      };
      const agentMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}-agent`,
        role: 'assistant',
        content: reflection,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => {
        const next = [...prev, userMsg, agentMsg];
        setSessions((prevSessions) => {
          let updated = prevSessions;
          let targetSessionId = activeSessionId;
          if (activeSessionId && prevSessions.some((s) => s.id === activeSessionId)) {
            updated = prevSessions.map((s) =>
              s.id === activeSessionId
                ? { ...s, messages: next, updatedAt: new Date().toISOString() }
                : s
            );
          } else {
            targetSessionId = activeSessionId || `session-${Date.now()}`;
            const newSession: ChatSession = {
              id: targetSessionId,
              title: `Voice Debrief: ${partnerName}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              messages: next,
            };
            updated = [newSession, ...prevSessions];
            setActiveSessionId(targetSessionId);
          }
          persistSessions(updated, targetSessionId);
          return updated;
        });
        return next;
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('force:nudge-updated'));
      }
      toast.success('Voice debrief added to conversation');
    },
    [activeSessionId, persistSessions]
  );

  // Filtered session list
  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="flex h-screen w-full bg-[#FAF7F2] text-[#1F1A16] font-sans antialiased overflow-hidden selection:bg-[#8f4d30]/15 selection:text-[#8f4d30]">
      {/* ── Claude-Style Collapsible Sidebar ── */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-xs md:hidden"
            />

            {/* Sidebar drawer */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#E6DFD5] bg-[#F5EFEB] p-3.5 shadow-xl md:static md:z-auto md:shadow-none"
            >
              {/* Sidebar Header: Force Branding & Close */}
              <div className="flex items-center justify-between px-2 py-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8f4d30] text-[#FAF7F2] shadow-xs">
                    <ForceLogo className="w-4 h-4" color="#FAF7F2" />
                  </div>
                  <span className="font-serif text-lg font-semibold tracking-tight text-[#2E2012]">
                    Force
                  </span>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="rounded-lg p-1.5 text-[#7A5A3A] hover:bg-black/5 hover:text-[#2E2012] transition-colors cursor-pointer"
                  title="Close sidebar"
                >
                  <PanelLeft size={16} />
                </button>
              </div>

              {/* + Start New Chat (Claude-style) */}
              <button
                onClick={handleNewSession}
                className="mt-3.5 flex items-center justify-between w-full rounded-xl border border-[#E6DFD5] bg-white/80 px-3.5 py-2.5 text-sm font-medium text-[#2E2012] shadow-xs hover:border-[#8f4d30]/40 hover:bg-white transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Plus size={16} className="text-[#8f4d30]" />
                  <span>Start new chat</span>
                </div>
                <span className="text-[11px] font-mono text-[#8f4d30] opacity-0 group-hover:opacity-100 transition-opacity">
                  ⌘K
                </span>
              </button>

              {/* Search chats */}
              <div className="relative mt-3">
                <Search size={13} className="absolute left-3 top-2.5 text-[#A68664]" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full rounded-xl border border-[#E6DFD5] bg-white/60 py-1.5 pl-8 pr-3 text-xs text-[#2E2012] placeholder-[#A68664] focus:bg-white focus:outline-none focus:border-[#8f4d30]/60 transition-all"
                />
              </div>

              {/* Conversation History List */}
              <div className="mt-4 flex-1 overflow-y-auto space-y-1 pr-1">
                <div className="px-2 pb-1.5 text-[11px] font-medium text-[#8C7A6B] uppercase tracking-wider">
                  Recent
                </div>
                {filteredSessions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#8C7A6B]">No chats found</p>
                ) : (
                  filteredSessions.map((s) => {
                    const isActive = s.id === activeSessionId;
                    return (
                      <div
                        key={s.id}
                        onClick={() => selectSession(s.id)}
                        className={`group relative flex items-center justify-between rounded-xl px-3 py-2 text-xs cursor-pointer transition-all ${
                          isActive
                            ? 'bg-white border border-[#E6DFD5] font-semibold text-[#8f4d30] shadow-xs'
                            : 'text-[#5C3E21] hover:bg-white/60 hover:text-[#2E2012]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <MessageSquare size={13} className={isActive ? 'text-[#8f4d30]' : 'text-[#A68664]'} />
                          <span className="truncate">{s.title || 'New Conversation'}</span>
                          {activeBackgroundTask && activeBackgroundTask.originSessionId === s.id && activeBackgroundTask.status === 'running' && (
                            <span className="flex h-2 w-2 relative flex-shrink-0" title="Active background task running">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8f4d30] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8f4d30]"></span>
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          title="Delete chat"
                          className="opacity-0 group-hover:opacity-100 rounded p-1 text-zinc-400 hover:text-red-600 transition-opacity cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Sidebar Footer Navigation */}
              <div className="border-t border-[#E6DFD5] pt-3 mt-2 flex items-center justify-between text-xs text-[#7A5A3A]">
                <Link
                  href="/dashboard"
                  className="hover:text-[#2E2012] transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/journal"
                  className="hover:text-[#2E2012] transition-colors"
                >
                  Journals
                </Link>
                <Link
                  href="/todo"
                  className="hover:text-[#2E2012] transition-colors"
                >
                  To-Do
                </Link>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Chat Canvas ── */}
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        {/* Minimal Top Header */}
        <header className="flex h-13 flex-shrink-0 items-center justify-between border-b border-[#EAE3D9] bg-[#FAF7F2]/90 px-4 sm:px-6 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="rounded-lg p-1.5 text-[#7A5A3A] hover:bg-black/5 hover:text-[#2E2012] transition-colors cursor-pointer"
                title="Open sidebar"
              >
                <PanelLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-2 text-sm font-medium text-[#2E2012] truncate max-w-[240px] sm:max-w-md">
              <span className="truncate">{activeSession?.title || 'Force'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* ── User Location Access Pill & Popover ── */}
            <div className="relative">
              {hasLocationAccess && location ? (
                <button
                  type="button"
                  onClick={() => setIsLocationMenuOpen((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-200/90 bg-emerald-50/80 px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer shadow-xs"
                  title={`Live location active: ${location.city || 'Detected'} (${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}). Click for details.`}
                >
                  <MapPin size={13} className="text-emerald-600 flex-shrink-0" />
                  <span className="hidden md:inline font-medium truncate max-w-[130px]">
                    {location.city ? `${location.city}${location.region ? `, ${location.region}` : ''}` : 'Location Active'}
                  </span>
                  <span className="inline md:hidden font-medium">
                    {location.city || 'Location'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void requestLocation()}
                  disabled={isLocationLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-[#E6DFD5] bg-white/70 px-2.5 py-1.5 text-xs font-medium text-[#5C3E21] hover:bg-white hover:border-[#8f4d30]/40 transition-all cursor-pointer shadow-xs"
                  title={
                    locationPermission === 'denied'
                      ? 'Location access blocked in browser. Click to retry or enable in browser settings.'
                      : 'Give Force Agent access to your location for local context, weather, events, and scheduling'
                  }
                >
                  {isLocationLoading ? (
                    <Loader2 size={13} className="text-[#8f4d30] animate-spin flex-shrink-0" />
                  ) : (
                    <MapPin size={13} className={locationPermission === 'denied' ? 'text-amber-600' : 'text-[#A68664]'} />
                  )}
                  <span className="hidden sm:inline">
                    {isLocationLoading ? 'Locating...' : locationPermission === 'denied' ? 'Location Blocked' : 'Enable Location'}
                  </span>
                </button>
              )}

              {/* Location Details Popover */}
              {isLocationMenuOpen && location && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsLocationMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 rounded-xl border border-[#E6DFD5] bg-white p-3.5 shadow-lg z-50 text-xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-[#F0EDE8] pb-2">
                      <div className="flex items-center gap-1.5 font-semibold text-[#2E2012]">
                        <MapPin size={14} className="text-emerald-600" />
                        <span>Live Location Context</span>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-mono text-emerald-800">
                        Active
                      </span>
                    </div>

                    <div className="space-y-1.5 text-[#5C3E21]">
                      {location.city && (
                        <div>
                          <span className="text-[10px] text-[#A68664] uppercase block font-semibold">City / Area</span>
                          <span className="font-medium text-[#2E2012]">
                            {[location.city, location.region, location.country].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-[10px] text-[#A68664] uppercase block font-semibold">Coordinates</span>
                        <span className="font-mono text-[11px] text-[#2E2012]">
                          {location.latitude.toFixed(5)}°, {location.longitude.toFixed(5)}°
                        </span>
                        {location.accuracy && (
                          <span className="text-[#A68664] text-[10px] ml-1.5">(±{Math.round(location.accuracy)}m)</span>
                        )}
                      </div>
                      {location.timezone && (
                        <div>
                          <span className="text-[10px] text-[#A68664] uppercase block font-semibold">Timezone</span>
                          <span className="text-[#2E2012]">{location.timezone}</span>
                        </div>
                      )}
                      {location.formattedAddress && (
                        <div>
                          <span className="text-[10px] text-[#A68664] uppercase block font-semibold">Address</span>
                          <span className="text-[11px] text-[#7A5A3A] line-clamp-2">{location.formattedAddress}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-[#F0EDE8] pt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await requestLocation();
                        }}
                        disabled={isLocationLoading}
                        className="flex items-center gap-1 text-[11px] text-[#8f4d30] hover:underline cursor-pointer"
                      >
                        {isLocationLoading ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                        <span>Refresh</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clearLocation();
                          setIsLocationMenuOpen(false);
                        }}
                        className="text-[11px] text-red-600 hover:underline cursor-pointer"
                      >
                        Disable Access
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setIsTelegramModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#229ED9]/40 bg-[#229ED9]/10 px-2.5 py-1.5 text-xs font-medium text-[#0077B5] dark:text-[#2AABEE] hover:bg-[#229ED9]/20 transition-all cursor-pointer shadow-xs"
              title="Open Force Telegram Bot (@force_agent_bot_newbot)"
            >
              <Send size={13} className="text-[#229ED9]" />
              <span className="hidden sm:inline">Telegram Bot</span>
            </button>

            <button
              onClick={() => setIsControlModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#E6DFD5] bg-white/70 px-2.5 py-1.5 text-xs font-medium text-[#5C3E21] hover:bg-white hover:border-[#8f4d30]/40 transition-all cursor-pointer shadow-xs"
              title="Open Force Agent Control Center & Diagnostics"
            >
              <Activity size={14} className="text-[#8f4d30]" />
              <span className="hidden sm:inline">Control Center</span>
            </button>
            <button
              onClick={() => setIsMemoryOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#E6DFD5] bg-white/70 px-2.5 py-1.5 text-xs font-medium text-[#5C3E21] hover:bg-white hover:border-[#8f4d30]/40 transition-all cursor-pointer shadow-xs"
              title="View working memory and active threads"
            >
              <Brain size={14} className="text-[#8f4d30]" />
              <span className="hidden sm:inline">Memory</span>
            </button>
            <button
              onClick={() => {
                // Load connections on-demand when opening debrief
                if (debriefConnections.length === 0) {
                  fetch('/api/connections')
                    .then(r => r.json())
                    .then(data => {
                      const conns = (data.connections || []).filter((c: any) => c.status === 'accepted');
                      setDebriefConnections(
                        conns.map((c: any) => ({
                          id: c.id,
                          name: c.requester?.name || c.recipient?.name || 'Partner',
                          partner_id: c.requester?.id || c.recipient?.id || '',
                        }))
                      );
                    })
                    .catch(() => {});
                }
                setIsDebriefOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-[#E6DFD5] bg-white/70 px-2.5 py-1.5 text-xs font-medium text-[#5C3E21] hover:bg-white hover:border-[#8f4d30]/40 transition-all cursor-pointer shadow-xs"
              title="Record a 90-second voice debrief about a conversation"
            >
              <Mic size={14} className="text-[#8f4d30]" />
              <span className="hidden sm:inline">Debrief</span>
            </button>
            <button
              onClick={handleNewSession}
              className="flex items-center gap-1.5 rounded-lg border border-[#E6DFD5] bg-white/70 px-2.5 py-1.5 text-xs font-medium text-[#5C3E21] hover:bg-white hover:border-[#8f4d30]/40 transition-all cursor-pointer shadow-xs"
              title="Start a new chat"
            >
              <Plus size={14} className="text-[#8f4d30]" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </header>

        {/* ── Messages Reading Column (Centered like Claude) ── */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 scroll-smooth">
          <div className="mx-auto max-w-3xl flex flex-col space-y-6">
            {/* Cross-chat Active Task Continuity Banner */}
            {activeBackgroundTask && activeBackgroundTask.originSessionId !== activeSessionId && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-[#E6DFD5] bg-gradient-to-r from-[#FAF3EC] via-[#FDFBF7] to-[#FAF3EC] p-4 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8f4d30]/10 text-[#8f4d30] flex-shrink-0 mt-0.5">
                      {activeBackgroundTask.status === 'running' ? (
                        <Loader2 size={18} className="animate-spin text-[#8f4d30]" />
                      ) : (
                        <Sparkles size={18} className="text-[#8f4d30]" />
                      )}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8f4d30] bg-[#8f4d30]/10 px-2 py-0.5 rounded-full">
                          {activeBackgroundTask.status === 'running' ? 'Task in progress' : 'Ongoing task'}
                        </span>
                        <span className="text-xs text-[#7A5A3A]">
                          from <span className="font-semibold text-[#2E2012]">{activeBackgroundTask.originSessionTitle}</span>
                        </span>
                        {activeBackgroundTask.targetUrl && (
                          <span className="text-[10px] font-mono text-[#8C7A6B] bg-black/5 px-1.5 py-0.5 rounded truncate max-w-[140px]">
                            {getDomainLabel(activeBackgroundTask.targetUrl)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[#2E2012] truncate">
                        {activeBackgroundTask.goal}
                      </p>
                      <p className="text-xs text-[#7A5A3A] line-clamp-1">
                        Current step: {activeBackgroundTask.currentAction}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                    <button
                      onClick={handleCarryOnTaskHere}
                      className="flex items-center gap-1.5 rounded-xl bg-[#8f4d30] px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#783e25] transition-all cursor-pointer"
                    >
                      <Sparkles size={13} />
                      <span>Carry on here</span>
                      <ArrowRight size={13} />
                    </button>
                    <button
                      onClick={() => selectSession(activeBackgroundTask.originSessionId)}
                      className="flex items-center gap-1 rounded-xl border border-[#E6DFD5] bg-white px-3 py-2 text-xs font-medium text-[#5C3E21] hover:bg-[#F5EFEB] transition-all cursor-pointer"
                      title={`Switch to ${activeBackgroundTask.originSessionTitle}`}
                    >
                      <span>View original chat</span>
                    </button>
                    <button
                      onClick={() => {
                        handleStopAutonomousTask();
                        updateActiveBackgroundTask(() => null);
                      }}
                      className="rounded-xl p-2 text-[#A68664] hover:bg-black/5 hover:text-red-600 transition-colors cursor-pointer"
                      title="Dismiss task"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Claude-style Empty State */}
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="my-auto flex flex-col items-center justify-center py-12 text-center"
              >
                {/* Brand Emblem */}
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E6DFD5] bg-white text-[#8f4d30] shadow-sm">
                  <ForceLogo className="w-8 h-8" color="#8f4d30" />
                </div>

                {/* Serene Greeting */}
                <h1 className="mt-5 text-2xl sm:text-3xl font-serif font-normal text-[#2E2012] tracking-tight">
                  How can I help you reflect today?
                </h1>

                <p className="mt-2 max-w-md text-sm text-[#7A5A3A] leading-relaxed">
                  Reflect on your journal entries, explore patterns across dates, or organize your grounded priorities.
                </p>

                {/* 1-Click Continuation Card in Empty State */}
                {activeBackgroundTask && activeBackgroundTask.originSessionId !== activeSessionId && (
                  <div className="w-full mt-6 text-left">
                    <div
                      onClick={handleCarryOnTaskHere}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border-2 border-[#8f4d30]/30 bg-gradient-to-r from-[#FAF3EC] to-white p-4 shadow-sm hover:border-[#8f4d30] hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8f4d30] text-white flex-shrink-0 shadow-xs">
                          <Sparkles size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#8f4d30] uppercase tracking-wider">
                              Carry on active task
                            </span>
                            <span className="text-xs text-[#8C7A6B]">
                              (from "{activeBackgroundTask.originSessionTitle}")
                            </span>
                          </div>
                          <p className="text-sm font-medium text-[#2E2012] mt-0.5">
                            {activeBackgroundTask.goal}
                          </p>
                          <p className="text-xs text-[#7A5A3A] mt-0.5">
                            {activeBackgroundTask.currentAction}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className="text-xs font-semibold text-[#8f4d30] group-hover:underline flex items-center gap-1">
                          Continue in this chat <ArrowRight size={14} />
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Claude-style Starter Prompt Cards */}
                <div className="mt-8 grid w-full grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                  {[
                    {
                      title: 'Analyze reflections by date',
                      prompt: 'I want to analyze my journals from 29th August and 1st September',
                      desc: 'Compares emotional shifts, recurring tensions, and insights.',
                    },
                    {
                      title: 'Search memory & journals',
                      prompt: 'Search memory for my thoughts on morning routine and focus',
                      desc: 'Semantic retrieval across your reflections with synthesized evidence.',
                    },
                    {
                      title: 'Show active to-do list',
                      prompt: 'Show my tasks and to-do list',
                      desc: 'Check off active tasks or review upcoming focus items.',
                    },
                    {
                      title: 'Synthesize life patterns',
                      prompt: 'Run pattern map analysis for my recent reflections',
                      desc: 'Maps thematic clusters and immediate growth edge.',
                    },
                  ].map((card, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(card.prompt)}
                      className="group flex flex-col rounded-2xl border border-[#E6DFD5] bg-white/70 p-4 shadow-xs hover:border-[#8f4d30]/50 hover:bg-white hover:shadow-sm transition-all cursor-pointer text-left"
                    >
                      <span className="font-medium text-sm text-[#2E2012] group-hover:text-[#8f4d30] transition-colors">
                        {card.title}
                      </span>
                      <p className="mt-1 text-xs text-[#7A5A3A] leading-relaxed">
                        {card.desc}
                      </p>
                      <span className="mt-2.5 text-[11px] font-mono text-[#8f4d30] opacity-0 group-hover:opacity-100 transition-opacity">
                        "{card.prompt}" →
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Message Stream */}
            {messages.map((msg, index) => (
              <div
                key={msg.id}
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'user' ? (
                  // User Message Bubble
                  <div className="max-w-[85%] sm:max-w-[78%] rounded-2xl bg-[#8f4d30] px-4 py-3 text-[15px] leading-relaxed text-white shadow-xs">
                    <ReactMarkdown components={userMarkdownComponents}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  // Assistant Message (Claude-like flowing text & inline cards)
                  <div className="w-full space-y-3">
                    {/* Header: Force Avatar & Name */}
                    <div className="flex items-center gap-2 text-xs font-medium text-[#7A5A3A]">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#8f4d30]/10 text-[#8f4d30]">
                        <ForceLogo className="w-3.5 h-3.5" color="#8f4d30" />
                      </div>
                      <span className="font-serif font-semibold text-[#2E2012]">Force</span>
                      <span className="text-[11px] text-[#A68664]">· {msg.timestamp}</span>
                      {msg.durationMs && (
                        <span className="inline-flex items-center gap-1 rounded bg-[#EBE5DB]/80 px-1.5 py-0.5 text-[10px] font-mono text-[#78716C] border border-[#DFDAD2]">
                          <Clock size={10} className="text-[#8F4D30]" />
                          {(msg.durationMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>

                    {/* Assistant Message Body */}
                    <div className="text-[15px] leading-relaxed text-[#241A14] font-normal pl-7">
                      <ReactMarkdown components={markdownComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>

                    {/* Claude-style Minimalist Tool Call Pills (Chain of executed tools) */}
                    {msg.toolExecutions && msg.toolExecutions.length > 0 ? (
                      <div className="space-y-2">
                        {msg.toolExecutions.map((tExec, idx) => (
                          <ClaudeToolCall
                            key={`${msg.id}-tool-${idx}-${tExec.tool}`}
                            toolExecution={tExec}
                            messageId={msg.id}
                            tinyfishStream={tExec.tool === 'tinyfish' ? tinyfishStreams[msg.id] : undefined}
                            onRunTinyfish={(opts) => runTinyFishBrowserTask(msg.id, opts)}
                            onToggleTodo={(todoId, currentStatus) => handleToggleTodo(todoId, currentStatus, msg.id)}
                            onAddCandidateTask={handleAddCandidateTask}
                            addedCandidateTasks={addedCandidateTasks}
                            onSelectAnalysisMode={handleSelectAnalysisMode}
                            savePatternMapToHistory={savePatternMapToHistory}
                          />
                        ))}
                      </div>
                    ) : msg.toolExecution ? (
                      <ClaudeToolCall
                        toolExecution={msg.toolExecution}
                        messageId={msg.id}
                        tinyfishStream={tinyfishStreams[msg.id]}
                        onRunTinyfish={(opts) => runTinyFishBrowserTask(msg.id, opts)}
                        onToggleTodo={(todoId, currentStatus) => handleToggleTodo(todoId, currentStatus, msg.id)}
                        onAddCandidateTask={handleAddCandidateTask}
                        addedCandidateTasks={addedCandidateTasks}
                        onSelectAnalysisMode={handleSelectAnalysisMode}
                        savePatternMapToHistory={savePatternMapToHistory}
                      />
                    ) : null}

                    {/* ── TOOL EXECUTION WIDGET: Cognition Engine Analysis Result ── */}
                    {msg.toolExecution?.tool === 'journal_analysis' && msg.toolExecution.data && (
                      <div className="ml-7 mt-3 rounded-2xl border border-[#E6DFD5] bg-white p-4 sm:p-5 shadow-xs space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE3D9] pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-semibold text-sm text-[#2E2012]">
                              Cognition Engine Synthesis
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 border border-emerald-200">
                              <Check size={10} /> Saved to History
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[11px] text-[#7A5A3A]">
                              {msg.toolExecution.data.dates?.join(' & ') || 'Reflections'}
                            </span>
                            <Link
                              href="/analysis"
                              className="inline-flex items-center gap-1 rounded-lg border border-[#E6DFD5] bg-[#FAF7F2] px-2.5 py-1 text-[11px] font-medium text-[#8f4d30] hover:bg-white hover:border-[#8f4d30]/40 transition-all shadow-xs"
                            >
                              Open in Analysis <ExternalLink size={10} />
                            </Link>
                          </div>
                        </div>

                        {/* Emotional progression */}
                        {msg.toolExecution.data.emotionalShift && (
                          <div className="rounded-xl bg-[#FAF7F2] p-3 border border-[#E6DFD5]">
                            <span className="text-[11px] font-medium text-[#8C7A6B] uppercase tracking-wider block mb-1">
                              Emotional Trajectory
                            </span>
                            <p className="text-xs text-[#2E2012] font-medium leading-relaxed">
                              {msg.toolExecution.data.emotionalShift}
                            </p>
                          </div>
                        )}

                        {/* Core tensions / insights */}
                        {Array.isArray(msg.toolExecution.data.insights) && msg.toolExecution.data.insights.length > 0 && (
                          <div>
                            <span className="text-[11px] font-medium text-[#8C7A6B] uppercase tracking-wider block mb-2">
                              Core Observations
                            </span>
                            <div className="space-y-2">
                              {msg.toolExecution.data.insights.map((ins: any, i: number) => (
                                <div key={i} className="rounded-xl bg-[#FAF7F2] p-3 border border-[#E6DFD5] text-xs">
                                  <div className="font-medium text-[#2E2012]">{ins.title}</div>
                                  <p className="mt-1 text-[#5C3E21] leading-relaxed">{ins.observation}</p>
                                  {ins.quote && (
                                    <p className="mt-1.5 text-[11px] italic text-[#8C7A6B]">"{ins.quote}"</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actionable task candidates */}
                        {Array.isArray(msg.toolExecution.data.actionCandidates) && msg.toolExecution.data.actionCandidates.length > 0 && (
                          <div>
                            <span className="text-[11px] font-medium text-[#8C7A6B] uppercase tracking-wider block mb-2">
                              Actionable Tasks
                            </span>
                            <div className="space-y-2">
                              {msg.toolExecution.data.actionCandidates.map((cand: any, i: number) => {
                                const key = `${msg.id}-cand-${i}`;
                                const added = addedCandidateTasks[key];
                                return (
                                  <div key={i} className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF7F2] p-3 border border-[#E6DFD5]">
                                    <div className="truncate">
                                      <div className="font-medium text-xs text-[#2E2012] truncate">{cand.title}</div>
                                      <div className="text-[11px] text-[#7A5A3A] capitalize">{cand.priority} priority</div>
                                    </div>
                                    <button
                                      onClick={() => handleAddCandidateTask(cand, key)}
                                      disabled={added}
                                      className={`flex-shrink-0 inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                                        added
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-[#8f4d30] text-white hover:bg-[#723c24] cursor-pointer'
                                      }`}
                                    >
                                      {added ? <Check size={12} /> : <Plus size={12} />}
                                      <span>{added ? 'Added' : 'Add to List'}</span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── TOOL EXECUTION WIDGET: Pattern Map Analysis Result ── */}
                    {msg.toolExecution?.tool === 'pattern_map_result' && msg.toolExecution.data && (
                      <div className="ml-7 mt-3 rounded-2xl border border-[#E6DFD5] bg-white p-4 sm:p-5 shadow-xs space-y-4">
                        {/* Header with Title, Score & Action Link */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE3D9] pb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-semibold text-sm text-[#2E2012]">
                              Pattern Map Atlas
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 border border-emerald-200">
                              <Check size={10} /> Saved to History
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[11px] text-[#7A5A3A] font-medium">
                              Score: {msg.toolExecution.data.sentimentScore || 78}/100
                            </span>
                            <Link
                              href={`/analysis/advanced?id=${encodeURIComponent(msg.toolExecution.data.historyId || '')}&open=latest`}
                              onClick={() => {
                                if (msg.toolExecution?.data?.historyId) {
                                  localStorage.setItem('advancedAnalysisActiveId', msg.toolExecution.data.historyId);
                                } else {
                                  const savedId = savePatternMapToHistory(msg.toolExecution?.data, msg.toolExecution?.title);
                                  if (savedId) {
                                    localStorage.setItem('advancedAnalysisActiveId', savedId);
                                  }
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#E6DFD5] bg-[#FAF7F2] px-2.5 py-1 text-[11px] font-medium text-[#8f4d30] hover:bg-white hover:border-[#8f4d30]/40 transition-all shadow-xs"
                            >
                              Open Full Atlas <ExternalLink size={10} />
                            </Link>
                          </div>
                        </div>

                        {/* Weekly Takeaway (from original Pattern Map section) */}
                        {msg.toolExecution.data.weeklyInsight && (
                          <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-3.5 text-xs text-amber-950">
                            <span className="font-semibold text-amber-900 block mb-0.5">
                              💡 This Week's Takeaway
                            </span>
                            <p className="leading-relaxed font-medium">
                              {msg.toolExecution.data.weeklyInsight}
                            </p>
                          </div>
                        )}

                        {/* Thematic Focus / Topic Intersection Insight */}
                        {msg.toolExecution.data.topicInsight && (
                          <div className="rounded-xl bg-[#FAF7F2] p-3 border border-[#E6DFD5] text-xs">
                            <span className="text-[11px] font-medium text-[#8C7A6B] uppercase tracking-wider block mb-1">
                              Thematic Focus
                            </span>
                            <p className="text-[#2E2012] leading-relaxed">
                              {msg.toolExecution.data.topicInsight}
                            </p>
                          </div>
                        )}

                        {/* Thematic Anchors / Keywords (Fixed empty labels) */}
                        {Array.isArray(msg.toolExecution.data.keywords) && msg.toolExecution.data.keywords.length > 0 && (
                          <div>
                            <span className="text-[11px] font-medium text-[#8C7A6B] uppercase tracking-wider block mb-2">
                              Thematic Anchors ({msg.toolExecution.data.keywords.length})
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.toolExecution.data.keywords.map((kw: any, i: number) => {
                                const label = kw.text || kw.tag || (typeof kw === 'string' ? kw : 'Reflection');
                                const val = kw.value || kw.strength;
                                return (
                                  <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-[#FAF7F2] border border-[#E6DFD5] px-2.5 py-1 text-xs text-[#5C3E21]">
                                    <span className="font-medium text-[#2E2012]">{label}</span>
                                    {val ? <span className="text-[10px] text-[#8C7A6B] font-mono">({val})</span> : null}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Topic Hierarchy */}
                        {Array.isArray(msg.toolExecution.data.topicHierarchy) && msg.toolExecution.data.topicHierarchy.length > 0 && (
                          <div>
                            <span className="text-[11px] font-medium text-[#8C7A6B] uppercase tracking-wider block mb-2">
                              Topic Hierarchy
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#5C3E21]">
                              {msg.toolExecution.data.topicHierarchy.map((topic: string, i: number, arr: string[]) => (
                                <React.Fragment key={i}>
                                  <span className="rounded-lg bg-[#FAF7F2] border border-[#E6DFD5] px-2.5 py-1 font-medium text-[#2E2012]">
                                    {topic}
                                  </span>
                                  {i < arr.length - 1 && (
                                    <ChevronRight size={13} className="text-[#A68664]" />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Mindmap Clusters & Cognitive Flow */}
                        {Array.isArray(msg.toolExecution.data.mindmapClusters) && msg.toolExecution.data.mindmapClusters.length > 0 && (
                          <div>
                            <span className="text-[11px] font-medium text-[#8C7A6B] uppercase tracking-wider block mb-2">
                              Mindmap Clusters & Cognitive Flow
                            </span>
                            <div className="space-y-2.5">
                              {msg.toolExecution.data.mindmapClusters.map((cluster: any, i: number) => (
                                <div key={i} className="rounded-xl bg-[#FAF7F2] p-3.5 border border-[#E6DFD5] text-xs">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-serif font-bold text-[#2E2012]">
                                      {cluster.clusterTitle || cluster.theme}
                                    </span>
                                    <span className="text-[10px] uppercase font-mono text-[#8f4d30] bg-[#8f4d30]/10 px-1.5 py-0.5 rounded">
                                      Cluster {i + 1}
                                    </span>
                                  </div>
                                  {Array.isArray(cluster.patternFlow) && cluster.patternFlow.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-[#7A5A3A] my-1 font-mono">
                                      {cluster.patternFlow.map((step: string, sIdx: number) => (
                                        <React.Fragment key={sIdx}>
                                          <span className="bg-white px-2 py-0.5 rounded border border-[#E6DFD5] text-[#2E2012]">
                                            {step}
                                          </span>
                                          {sIdx < cluster.patternFlow.length - 1 && (
                                            <span className="text-[#8f4d30]">→</span>
                                          )}
                                        </React.Fragment>
                                      ))}
                                    </div>
                                  )}
                                  {cluster.insight && (
                                    <p className="mt-1 text-[#5C3E21] leading-relaxed italic">
                                      "{cluster.insight}"
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Life Patterns (Stage 3: Mirror → Meaning → Movement from original section) */}
                        {Array.isArray(msg.toolExecution.data.lifePatterns) && msg.toolExecution.data.lifePatterns.length > 0 && (
                          <div>
                            <span className="text-[11px] font-medium text-[#8C7A6B] uppercase tracking-wider block mb-2">
                              Life Patterns (Mirror → Meaning → Movement)
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                              {msg.toolExecution.data.lifePatterns.map((pattern: any, idx: number) => (
                                <div key={idx} className="rounded-xl bg-[#FAF7F2] p-3 border border-[#E6DFD5] text-xs space-y-2">
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#8f4d30] block">
                                      Mirror
                                    </span>
                                    <p className="text-[#2E2012] mt-0.5 leading-relaxed">{pattern.mirror}</p>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#8f4d30] block">
                                      Meaning
                                    </span>
                                    <p className="text-[#5C3E21] mt-0.5 leading-relaxed">{pattern.meaning}</p>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#8f4d30] block">
                                      Movement
                                    </span>
                                    <p className="text-[#2E2012] mt-0.5 italic leading-relaxed">{pattern.movement}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Growth Edge & Energy/Wellbeing side by side */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                          {msg.toolExecution.data.growthEdge && (
                            <div className="rounded-xl bg-gradient-to-br from-rose-50 to-white border border-rose-100 p-3">
                              <span className="font-semibold text-rose-800 block mb-1">
                                🌱 Growth Edge
                              </span>
                              <p className="text-[#2E2012] leading-relaxed">
                                {msg.toolExecution.data.growthEdge}
                              </p>
                            </div>
                          )}
                          {msg.toolExecution.data.energyWellbeingInsight && (
                            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 p-3">
                              <span className="font-semibold text-emerald-800 block mb-1">
                                ⚡ Energy & Wellbeing
                              </span>
                              <p className="text-[#2E2012] leading-relaxed">
                                {msg.toolExecution.data.energyWellbeingInsight}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Happiness / Restoration Sources */}
                        {Array.isArray(msg.toolExecution.data.happinessSources) && msg.toolExecution.data.happinessSources.length > 0 && (
                          <div>
                            <span className="text-[11px] font-medium text-[#8C7A6B] uppercase tracking-wider block mb-2">
                              Joy & Restoration Anchors
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {msg.toolExecution.data.happinessSources.map((h: any, i: number) => (
                                <div key={i} className="rounded-xl bg-[#FAF7F2] p-3 border border-[#E6DFD5]">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-[#2E2012]">{h.source}</span>
                                    <span className="text-[10px] font-mono text-[#8f4d30]">{h.strength}% strength</span>
                                  </div>
                                  {h.quote && (
                                    <p className="text-[11px] italic text-[#7A5A3A]">"{h.quote}"</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── TOOL EXECUTION WIDGET: Voice Analysis Result ── */}
                    {msg.toolExecution?.tool === 'voice_analysis_result' && msg.toolExecution.data && (
                      <div className="ml-7 mt-3 rounded-2xl border border-purple-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                          <span className="font-serif font-semibold text-sm text-[#2E2012]">
                            Voice & Acoustic Signals
                          </span>
                          <span className="text-[11px] text-purple-900">
                            Cadence: {msg.toolExecution.data.speechCadenceWPM} WPM
                          </span>
                        </div>

                        {/* Vocal emotion meters */}
                        {Array.isArray(msg.toolExecution.data.vocalSentiments) && (
                          <div className="grid grid-cols-3 gap-2 text-center">
                            {msg.toolExecution.data.vocalSentiments.map((s: any, i: number) => (
                              <div key={i} className="rounded-xl bg-purple-50/50 p-2.5 border border-purple-100">
                                <div className="text-[10px] text-purple-800">{s.emotion}</div>
                                <div className="font-medium text-sm text-[#2E2012] mt-0.5">{s.percentage}%</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Spoken harmony synthesis */}
                        {msg.toolExecution.data.harmonySynthesis && (
                          <div className="rounded-xl bg-purple-50/40 p-3 border border-purple-100 text-xs">
                            <span className="text-[10px] font-medium text-purple-900 uppercase tracking-wider block mb-1">
                              Vocal Harmony
                            </span>
                            <p className="text-[#2E2012] leading-relaxed font-normal">
                              {msg.toolExecution.data.harmonySynthesis}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── TOOL EXECUTION WIDGET: Semantic Memory Search Result ── */}
                    {(msg.toolExecution?.tool === 'memory_search_result' || (msg.toolExecution?.tool === 'memory_query' && msg.toolExecution.data?.memories)) && msg.toolExecution.data && (
                      <div className="ml-7 mt-3 rounded-2xl border border-[#E6DFD5] bg-white p-4 sm:p-5 shadow-xs space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAE3D9] pb-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#FAF7F2] text-[#8f4d30] border border-[#E6DFD5]">
                              <Search size={13} />
                            </span>
                            <span className="font-serif font-semibold text-sm text-[#2E2012]">
                              Memory Recollection
                            </span>
                            {msg.toolExecution.data.query && (
                              <span className="rounded-full bg-[#FAF7F2] px-2 py-0.5 text-[11px] font-medium text-[#7A5A3A] border border-[#E6DFD5]">
                                "{msg.toolExecution.data.query}"
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-[#8C7A6B]">
                            {Array.isArray(msg.toolExecution.data.memories) ? msg.toolExecution.data.memories.length : 0} recalled
                          </span>
                        </div>

                        {/* Direct Synthesized Answer Card */}
                        {msg.toolExecution.data.answer && (
                          <div className="rounded-xl bg-[#FAF7F2] p-3.5 border border-[#E6DFD5] text-xs">
                            <span className="text-[10px] font-medium text-[#8f4d30] uppercase tracking-wider block mb-1">
                              Recollection Summary
                            </span>
                            <p className="text-[#2E2012] leading-relaxed font-normal">
                              {msg.toolExecution.data.answer}
                            </p>
                          </div>
                        )}

                        {/* Search Term Synonyms */}
                        {Array.isArray(msg.toolExecution.data.searchTerms) && msg.toolExecution.data.searchTerms.length > 1 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[#8C7A6B]">
                            <span className="font-medium">Context anchors:</span>
                            {msg.toolExecution.data.searchTerms.slice(0, 5).map((term: string, idx: number) => (
                              <span key={idx} className="rounded-md bg-[#FAF7F2] px-1.5 py-0.5 border border-[#E6DFD5] text-[#7A5A3A]">
                                {term}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Ranked Memory Source Reflections */}
                        {Array.isArray(msg.toolExecution.data.memories) && msg.toolExecution.data.memories.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[11px] font-medium text-[#8C7A6B] uppercase tracking-wider block">
                              Source Reflections
                            </span>
                            <div className="grid grid-cols-1 gap-2">
                              {msg.toolExecution.data.memories.map((mem: any, idx: number) => (
                                <div
                                  key={mem.journalId || idx}
                                  className="rounded-xl border border-[#E6DFD5] bg-[#FAF7F2]/60 hover:bg-[#FAF7F2] hover:border-[#8f4d30]/50 p-3 transition-colors"
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <Link
                                      href={`/journal/${mem.journalId}`}
                                      className="font-medium text-xs text-[#2E2012] hover:text-[#8f4d30] hover:underline flex items-center gap-1.5 truncate"
                                    >
                                      <BookOpen size={13} className="text-[#8f4d30] flex-shrink-0" />
                                      <span className="truncate">{mem.title || 'Untitled Entry'}</span>
                                      <ExternalLink size={11} className="text-[#8C7A6B] flex-shrink-0" />
                                    </Link>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      {mem.date && (
                                        <span className="text-[10px] text-[#8C7A6B]">
                                          {mem.date.slice(0, 10)}
                                        </span>
                                      )}
                                      <span className="rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                                        {Math.round((mem.relevance || 0.8) * 100)}% match
                                      </span>
                                    </div>
                                  </div>
                                  {mem.summary && (
                                    <p className="text-[11px] text-[#5C4533] leading-relaxed mb-1">
                                      {mem.summary}
                                    </p>
                                  )}
                                  {mem.highlight && (
                                    <p className="text-[10px] italic text-[#8C7A6B] border-l-2 border-[#8f4d30]/30 pl-2">
                                      "{mem.highlight}"
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── TOOL EXECUTION WIDGET: Interactive To-Do List Card ── */}
                    {msg.toolExecution?.tool === 'todo_list' && msg.toolExecution.data?.todos && (
                      <div className="ml-7 mt-3 rounded-2xl border border-[#E6DFD5] bg-white p-4 shadow-xs">
                        <div className="flex items-center justify-between border-b border-[#EAE3D9] pb-2.5">
                          <span className="font-serif font-semibold text-sm text-[#2E2012]">
                            Active Tasks
                          </span>
                          <Link
                            href="/todo"
                            className="text-xs text-[#8f4d30] hover:underline flex items-center gap-1"
                          >
                            Open List →
                          </Link>
                        </div>

                        {(() => {
                          const validTodos = (Array.isArray(msg.toolExecution.data.todos) ? msg.toolExecution.data.todos : [])
                            .filter((t: any) => Boolean(t.title && String(t.title).trim()));

                          if (validTodos.length === 0) {
                            return (
                              <div className="py-4 text-center text-xs text-[#7A5A3A]">
                                No active tasks currently on your list.
                              </div>
                            );
                          }

                          return (
                            <div className="mt-3 space-y-1.5 max-h-60 overflow-y-auto pr-1">
                              {validTodos.map((todo: any, idx: number) => {
                                const isDone = todo.status === 'done';
                                const priority = (todo.priority || 'medium').toLowerCase();
                                return (
                                  <div
                                    key={todo.id || `todo-${idx}`}
                                    onClick={() => handleToggleTodo(todo.id, todo.status, msg.id)}
                                    className={`flex items-center justify-between gap-2.5 rounded-xl p-2.5 border cursor-pointer transition-all ${
                                      isDone
                                        ? 'bg-zinc-50 border-zinc-200 text-zinc-400 line-through'
                                        : 'bg-[#FAF7F2] border-[#E6DFD5] text-[#2E2012] hover:border-[#8f4d30]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0 truncate">
                                      {isDone ? (
                                        <CheckSquare size={14} className="text-emerald-600 flex-shrink-0" />
                                      ) : (
                                        <Square size={14} className="text-[#A68664] flex-shrink-0" />
                                      )}
                                      <span className="truncate text-xs font-medium">{todo.title}</span>
                                    </div>
                                    <span
                                      className={`flex-shrink-0 text-[10px] uppercase font-medium px-1.5 py-0.5 rounded ${
                                        priority === 'high'
                                          ? 'bg-amber-100/70 text-amber-900 border border-amber-200/60'
                                          : 'text-[#7A5A3A]'
                                      }`}
                                    >
                                      {priority}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* ── TOOL EXECUTION WIDGET: Journal Entry Created Card ── */}
                    {msg.toolExecution?.tool === 'journal_created' && msg.toolExecution.data && (
                      <div className="ml-7 mt-3 rounded-2xl border border-[#E6DFD5] bg-white p-4 shadow-xs">
                        <div className="flex items-center justify-between border-b border-[#EAE3D9] pb-2">
                          <span className="font-serif font-semibold text-sm text-[#2E2012]">
                            Journal Entry Recorded
                          </span>
                          <Link
                            href="/journal"
                            className="text-xs text-[#8f4d30] hover:underline"
                          >
                            Open Diary →
                          </Link>
                        </div>
                        <div className="mt-2 text-xs">
                          <div className="font-medium text-sm text-[#2E2012]">{msg.toolExecution.data.title}</div>
                          <p className="mt-1 text-[#5C3E21] line-clamp-2 leading-relaxed">
                            {msg.toolExecution.data.content}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ── TOOL EXECUTION WIDGET: User Stats Overview ── */}
                    {msg.toolExecution?.tool === 'user_stats' && msg.toolExecution.data && (
                      <div className="ml-7 mt-3 rounded-2xl border border-[#E6DFD5] bg-white p-4 shadow-xs">
                        <span className="font-serif font-semibold text-sm text-[#2E2012] block border-b border-[#EAE3D9] pb-2">
                          Reflection Momentum
                        </span>
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className="rounded-xl bg-[#FAF7F2] p-2.5 border border-[#E6DFD5]">
                            <div className="text-[10px] text-[#8C7A6B]">Streak</div>
                            <div className="font-medium text-base text-orange-600 mt-0.5">
                              {msg.toolExecution.data.streakDays}d
                            </div>
                          </div>
                          <div className="rounded-xl bg-[#FAF7F2] p-2.5 border border-[#E6DFD5]">
                            <div className="text-[10px] text-[#8C7A6B]">Entries</div>
                            <div className="font-medium text-base text-[#8f4d30] mt-0.5">
                              {msg.toolExecution.data.journalCount}
                            </div>
                          </div>
                          <div className="rounded-xl bg-[#FAF7F2] p-2.5 border border-[#E6DFD5]">
                            <div className="text-[10px] text-[#8C7A6B]">Active Tasks</div>
                            <div className="font-medium text-base text-blue-600 mt-0.5">
                              {msg.toolExecution.data.activeTodosCount}
                            </div>
                          </div>
                          <div className="rounded-xl bg-[#FAF7F2] p-2.5 border border-[#E6DFD5]">
                            <div className="text-[10px] text-[#8C7A6B]">Momentum</div>
                            <div className="font-medium text-base text-emerald-600 mt-0.5">
                              {msg.toolExecution.data.momentumScore}/100
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── TOOL EXECUTION WIDGET: TinyFish Browser Simulator (Abstract, No Raw Logs) ── */}
                    {msg.toolExecution?.tool === 'tinyfish' && (
                      <div className="ml-7 mt-3 rounded-2xl border border-[#E6DFD5] bg-[#1E1712] overflow-hidden shadow-sm text-xs text-white">
                        {/* Browser Bar */}
                        <div className="flex items-center justify-between bg-[#150F0B] px-4 py-2 border-b border-white/10">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
                              <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
                              <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
                            </div>
                            <span className="font-mono text-[11px] text-[#D19168] ml-1">
                              Browser Automation
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] font-mono">
                            {tinyfishStreams[msg.id]?.status === 'running' ? (
                              <span className="flex items-center gap-1.5 text-amber-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                                Working
                              </span>
                            ) : tinyfishStreams[msg.id]?.status === 'success' ? (
                              <span className="flex items-center gap-1 text-emerald-400">
                                <Check size={11} /> Completed
                              </span>
                            ) : (
                              <span className="text-zinc-400">Ready</span>
                            )}
                          </div>
                        </div>

                        {/* Address Bar */}
                        <div className="flex items-center justify-between bg-[#1A130E] px-4 py-2 border-b border-white/5 font-mono text-[11px]">
                          <div className="flex items-center gap-1.5 truncate text-zinc-300">
                            <Lock size={11} className="text-emerald-400 flex-shrink-0" />
                            <span className="truncate">{msg.toolExecution.data?.eventUrl || 'https://lu.ma'}</span>
                          </div>
                          <a
                            href={msg.toolExecution.data?.eventUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#D19168] hover:underline flex-shrink-0 ml-2 text-[10px]"
                          >
                            Open <ExternalLink size={9} />
                          </a>
                        </div>

                        {/* Viewport: Live Stream or Abstract Stage */}
                        <div className="p-4">
                          {tinyfishStreams[msg.id]?.streamingUrl ? (
                            <div className="space-y-2">
                              <div className="relative w-full h-72 rounded-xl overflow-hidden border border-white/10 bg-black">
                                <iframe
                                  src={tinyfishStreams[msg.id]?.streamingUrl}
                                  className="w-full h-full border-0"
                                  title="Browser Session"
                                  allow="camera; microphone; display-capture"
                                />
                              </div>
                              <div className="text-[11px] font-mono text-[#D19168] truncate">
                                {tinyfishStreams[msg.id]?.currentAction || 'Automating registration...'}
                              </div>
                            </div>
                          ) : tinyfishStreams[msg.id]?.status === 'running' ? (
                            <div className="rounded-xl bg-[#150F0B] p-4 text-center space-y-3 border border-white/5">
                              <Loader2 size={20} className="animate-spin text-[#D19168] mx-auto" />
                              <p className="text-xs text-zinc-300">
                                {tinyfishStreams[msg.id]?.currentAction || 'Navigating event portal...'}
                              </p>
                              <p className="text-[11px] text-zinc-500">
                                Reading ticket criteria, auto-injecting verified profile, and confirming attendance.
                              </p>
                            </div>
                          ) : tinyfishStreams[msg.id]?.status === 'success' ? (
                            <div className="rounded-xl bg-emerald-950/60 border border-emerald-500/30 p-4 text-emerald-200 space-y-1">
                              <div className="flex items-center gap-1.5 font-medium text-xs text-emerald-300">
                                <CheckCircle2 size={14} />
                                <span>Registration Confirmed</span>
                              </div>
                              <p className="text-xs text-emerald-100/80 leading-relaxed">
                                Successfully registered for the event on Lu.ma. Your confirmation has been saved to your notes and to-dos.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <p className="text-xs text-zinc-300">
                                Ready to automate registration for <strong>{msg.toolExecution.data?.eventUrl}</strong>.
                              </p>
                              <button
                                onClick={() => runTinyFishRegistration(msg.id, msg.toolExecution!.data!.eventUrl)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[#8f4d30] px-3.5 py-1.5 text-xs font-medium text-white shadow hover:bg-[#723c24] transition-all cursor-pointer"
                              >
                                <Zap size={12} />
                                <span>Launch Registration</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {/* ── TOOL EXECUTION WIDGET: Real-World Action Prototype ── */}
                    {msg.toolExecution?.tool === 'real_world_action' && msg.toolExecution.data && (
                      <RealWorldActionCard
                        action={msg.toolExecution.data as any}
                        messageId={msg.id}
                        interactionEventId={msg.interactionEventId}
                      />
                    )}

                    {/* Inline Thread Auto-Resolution Action */}
                    {activeThread && index === messages.length - 1 && (
                      <div className="ml-7 mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-2.5 text-xs text-[#2E2012]">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
                          <span className="truncate">
                            Reached clarity on <strong>&ldquo;{activeThread.topic}&rdquo;</strong>?
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleResolveActiveThread(activeThread.id)}
                          disabled={isResolvingThread}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 transition-colors shadow-2xs shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          <Check size={13} />
                          <span>{isResolvingThread ? 'Resolving...' : 'Mark Resolved'}</span>
                        </button>
                      </div>
                    )}

                    {/* Intervention Feedback Bar ("Was this useful?") */}
                    <div className="ml-7">
                      <InterventionFeedbackBar
                        messageId={msg.id}
                        interactionEventId={msg.interactionEventId}
                      />
                    </div>

                  </div>
                )}
              </div>
            ))}

            {/* Claude-style Thinking / Tool Working Indicator with Live Timer */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 pl-7 my-2"
              >
                <div className="inline-flex items-center gap-2.5 rounded-xl border border-[#DFDAD2] bg-[#F2EFEA] px-3.5 py-2 text-xs text-[#524B43] shadow-xs">
                  <Loader2 size={13} className="animate-spin text-[#8F4D30] flex-shrink-0" />
                  <span className="font-medium text-[#2E2823]">
                    {getLoadingStageDescription(loadingElapsedSeconds, messages[messages.length - 1]?.content)}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#8F4D30] bg-[#E7E2D9] px-2 py-0.5 rounded-md border border-[#D9D3C7]">
                    <Clock size={11} className="text-[#8F4D30]" />
                    {Math.floor(loadingElapsedSeconds / 60)}:{String(loadingElapsedSeconds % 60).padStart(2, '0')}
                  </span>
                  <button
                    onClick={() => handleStopAutonomousTask()}
                    className="ml-2 inline-flex items-center gap-1 rounded-md bg-[#FAF7F2] hover:bg-[#EBE5DB] px-2 py-0.5 text-[11px] font-medium text-[#8F4D30] border border-[#DFDAD2] transition-colors cursor-pointer"
                    title="Stop autonomous agent"
                  >
                    <Square size={10} className="fill-[#8F4D30] text-[#8F4D30]" />
                    Stop
                  </button>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Claude-Style Floating Input Box ── */}
        <div className="flex-shrink-0 px-4 sm:px-6 pb-24 sm:pb-28 pt-1 bg-gradient-to-t from-[#FAF7F2] via-[#FAF7F2] to-transparent">
          <div className="mx-auto max-w-3xl">
            {/* Active Dilemma Focus Banner */}
            {activeThread && (
              <div className="mb-2.5 flex items-center justify-between gap-3 rounded-2xl border border-[#E6DFD5] bg-[#F5EFEB] px-4 py-2.5 text-xs text-[#2E2012] shadow-2xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#8f4d30]/12 text-[#8f4d30] shrink-0">
                    <Clock size={13} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] text-[#7A5A3A] block font-medium">Reflecting on dilemma</span>
                    <span className="font-semibold text-xs text-[#2E2012] truncate block">{activeThread.topic}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleResolveActiveThread(activeThread.id)}
                    disabled={isResolvingThread}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <CheckCircle2 size={13} />
                    <span>{isResolvingThread ? 'Resolving...' : 'Mark Resolved'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveThread(null);
                      setActiveThreadId(null);
                    }}
                    className="p-1 rounded-lg text-[#7A5A3A] hover:text-[#2E2012] hover:bg-black/5 transition-colors cursor-pointer"
                    title="Dismiss thread focus"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            <div className="relative flex flex-col rounded-3xl border border-[#DED7CE] bg-white p-3 sm:p-4 shadow-sm focus-within:border-[#8f4d30] focus-within:shadow-md transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Reply to Force or ask to analyze your reflections..."
                rows={2}
                className="w-full resize-none bg-transparent px-1 py-0.5 text-sm sm:text-[15px] text-[#2E2012] placeholder-[#A68664] focus:outline-none"
              />

              <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2 text-xs text-[#7A5A3A]">
                <span className="text-[11px] text-[#A68664] hidden sm:inline">
                  Enter to send · Shift+Enter for new line
                </span>

                <div className="ml-auto flex items-center gap-2">
                  {isLoading && (
                    <button
                      onClick={() => handleStopAutonomousTask()}
                      className="flex h-8 items-center gap-1.5 px-3 rounded-full bg-[#FAF7F2] border border-[#DFDAD2] text-[#8F4D30] hover:bg-[#EBE5DB] text-xs font-medium cursor-pointer transition-all"
                      title="Stop autonomous task"
                    >
                      <Square size={11} className="fill-[#8F4D30] text-[#8F4D30]" />
                      <span>Stop</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8f4d30] text-white shadow-xs hover:bg-[#723c24] disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Send message"
                  >
                    <ArrowUp size={15} />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2 text-center text-[11px] text-[#8C7A6B]">
              Force reflects on your journals and tasks with end-to-end privacy.
            </div>
          </div>
        </div>
      </div>

      {/* Telegram 1-Click Connect & Access Modal */}
      <TelegramConnectModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
      />

      {/* Working Memory & Active Threads Drawer */}
      <AgentMemoryDrawer
        isOpen={isMemoryOpen}
        onClose={() => setIsMemoryOpen(false)}
        onSelectThread={(prompt, threadId, threadTopic) => {
          setInput(prompt);
          if (threadId) {
            setActiveThread({ id: threadId, topic: threadTopic || prompt });
            setActiveThreadId(threadId);
          }
          textareaRef.current?.focus();
        }}
      />

      {/* Voice Debrief Modal */}
      <VoiceDebriefModal
        isOpen={isDebriefOpen}
        onClose={() => setIsDebriefOpen(false)}
        connections={debriefConnections}
        onDebriefComplete={handleDebriefComplete}
      />

      {/* Phase 4: Control Center & Diagnostics Modal */}
      <AgentControlModal
        isOpen={isControlModalOpen}
        onClose={() => setIsControlModalOpen(false)}
      />
    </div>
  );
}
}

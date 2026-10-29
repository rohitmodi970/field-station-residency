"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/utilities/context/ThemeContext';
import { useCalendarIntegration } from '@/hooks/useCalendarIntegration';
import {
  Calendar, Plus, Zap, Brain, CalendarCheck,
  AlertTriangle, Loader2, RefreshCw, CheckCheck, Trash2, ArrowUpDown,
  Circle, CheckCircle2,
} from 'lucide-react';

import AddTodoModal from '@/components/todo/Addtodomodal';
import {
  AiTodo,
  FilterStatus,
  FilterPriority,
  PRIORITY_CONFIG,
  hexToRgba,
  isOverdue,
  isEodMissed,
  formatDueDate,
} from '@/components/todo/types';
import { announceTaskAdded } from '@/utils/notifications/taskAddedNotifier';
import { useAiDecryption } from '@/utils/encryption/useAiDecryption';

const HISTORY_ARCHIVE_DELAY_MS = 2 * 60 * 60 * 1000;

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AiTodoPage() {
  const { currentTheme, isDarkMode: isDark } = useTheme();
  const primary = currentTheme?.primary ?? '#6366f1';
  const secondary = currentTheme?.secondary ?? '#8b5cf6';

  const { decryptTodo } = useAiDecryption();

  const { isConnected, events, loadEvents, isLoading: calLoading } =
    useCalendarIntegration();

  // ── State ──────────────────────────────────────────────────────────────
  const [todos, setTodos] = useState<AiTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [sortBy, setSortBy] = useState<'priority' | 'due_date' | 'created'>('priority');
  const [isMobile, setIsMobile] = useState(false);
  const [isNarrowDesktop, setIsNarrowDesktop] = useState(false);
  const [isFullListExpanded, setIsFullListExpanded] = useState(true);
  const [expandedBoardCards, setExpandedBoardCards] = useState<Record<string, boolean>>({});
  const [expandedFullListRows, setExpandedFullListRows] = useState<Record<string, boolean>>({});
  const calendarGuideSteps = [
    {
      title: 'Connect your Google Calendar',
      detail: 'Open Settings and link your calendar in one secure step.',
      accent: '#c97347',
    },
    {
      title: 'Preview the next two weeks',
      detail: 'We pull upcoming events so tasks stay relevant and timely.',
      accent: '#7b977c',
    },
    {
      title: 'Generate prep & follow-ups',
      detail: 'One click turns events into clear actions you can track.',
      accent: '#8a6b58',
    },
  ];

  // ── Toast helper ───────────────────────────────────────────────────────
  const showToast = useCallback(
    (msg: string, type: 'success' | 'error' = 'success') => {
      setToast({ msg, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  // ── Fetch todos ────────────────────────────────────────────────────────
  const fetchTodos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai-todo');
      const data = await res.json();
      const rawTodos: AiTodo[] = data.todos ?? [];
      // Decrypt each row (no-op for plaintext legacy rows)
      const decrypted = await Promise.all(
        rawTodos.map(async (row: any) => {
          const fields = await decryptTodo(row);
          return {
            ...row,
            title: (fields.title && fields.title.trim()) || (row.title && row.title.trim()) || 'Untitled Task',
            description: (fields.description && fields.description.trim()) || (row.description && row.description.trim()) || null,
            ai_reasoning: fields.ai_reasoning || row.ai_reasoning || null,
            category: fields.category || row.category || 'Personal',
            calendar_event_title: fields.calendar_event_title || row.calendar_event_title || null,
          } as AiTodo;
        })
      );
      setTodos(decrypted);

      // Auto-heal: If any rows in DB had a generic / placeholder title (like 'Personal', 'Task', or null), but we decrypted the real title, sync to DB!
      const needSync = decrypted.filter((t, i) => {
        const raw = rawTodos[i] as any;
        const rawTitle = (raw?.title || '').trim().toLowerCase();
        const decTitle = (t.title || '').trim().toLowerCase();
        const isGenericRaw = !rawTitle || rawTitle === 'personal' || rawTitle === 'task' || rawTitle === 'untitled task';
        const isRealDecrypted = decTitle && decTitle !== 'personal' && decTitle !== 'task' && decTitle !== 'untitled task';
        return isGenericRaw && isRealDecrypted;
      });
      if (needSync.length > 0) {
        fetch('/api/ai-todo/sync-plaintext', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tasks: needSync.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              category: t.category,
              ai_reasoning: t.ai_reasoning,
            })),
          }),
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('[AiTodo] fetchTodos failed', err);
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }, [decryptTodo]);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  useEffect(() => {
    const handler = () => fetchTodos();
    window.addEventListener('force:todo-updated', handler);
    return () => window.removeEventListener('force:todo-updated', handler);
  }, [fetchTodos]);

  // ── Responsive breakpoints ─────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1120px)');
    const sync = () => setIsNarrowDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (isMobile) setIsFullListExpanded(false);
  }, [isMobile]);

  // ── Calendar events ────────────────────────────────────────────────────
  useEffect(() => {
    if (isConnected) {
      const now = new Date();
      const twoWeeks = new Date(now.getTime() + 14 * 86400000);
      loadEvents({
        timeMin: now.toISOString(),
        timeMax: twoWeeks.toISOString(),
        maxResults: 20,
      });
    }
  }, [isConnected, loadEvents]);

  // ── Generate todos from calendar ───────────────────────────────────────
  const generateFromCalendar = useCallback(async () => {
    if (!events?.length) {
      showToast('No upcoming calendar events found', 'error');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/ai-todo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', events }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const rawTodos: AiTodo[] = Array.isArray(data.todos) ? data.todos : [];
      // Decrypt each newly generated todo
      const decrypted = await Promise.all(
        rawTodos.map(async (row: any) => {
          const fields = await decryptTodo(row);
          return {
            ...row,
            title: (fields.title && fields.title.trim()) || (row.title && row.title.trim()) || 'Untitled Task',
            description: (fields.description && fields.description.trim()) || (row.description && row.description.trim()) || null,
            ai_reasoning: fields.ai_reasoning || row.ai_reasoning || null,
            category: fields.category || row.category || 'Personal',
            calendar_event_title: fields.calendar_event_title || row.calendar_event_title || null,
          } as AiTodo;
        })
      );
      setTodos((prev) => [...decrypted, ...prev]);
      decrypted.forEach((todo) => {
        if (!todo?.title) return;
        announceTaskAdded({ title: todo.title, source: 'calendar' });
      });
      showToast(`✨ Generated ${decrypted.length} smart tasks!`);
    } catch (err) {
      console.warn('[AiTodo] generateFromCalendar failed', err);
      showToast('Generation failed. Try again.', 'error');
    } finally {
      setGenerating(false);
    }
  }, [events, showToast, decryptTodo]);

  // ── Mutations ──────────────────────────────────────────────────────────
  const addManual = useCallback(
    async (partial: Partial<AiTodo>) => {
      try {
        const res = await fetch('/api/ai-todo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'add_manual', ...partial }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setTodos((prev) => [data.todo, ...prev]);
        if (data?.todo?.title) {
          announceTaskAdded({ title: data.todo.title, source: 'manual' });
          showToast(`Task added: ${data.todo.title}`);
        } else {
          showToast('Task added!');
        }
      } catch (err) {
        console.warn('[AiTodo] addManual failed', err);
        showToast('Failed to add task', 'error');
      }
    },
    [showToast]
  );

  const toggleStatus = useCallback(
    async (id: string, current: AiTodo['status']) => {
      const next = current === 'done' ? 'pending' : 'done';
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: next } : t))
      );
      try {
        await fetch('/api/ai-todo', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: next }),
        });
      } catch (err) {
        console.warn('[AiTodo] toggleStatus failed', err);
        setTodos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: current } : t))
        );
      }
    },
    []
  );

  const updatePriority = useCallback(
    async (id: string, priority: AiTodo['priority']) => {
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, priority } : t))
      );
      try {
        await fetch('/api/ai-todo', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, priority }),
        });
      } catch (err) { console.warn('[AiTodo] updatePriority failed', err); }
    },
    []
  );


  const clearCompleted = useCallback(async () => {
    setTodos((prev) => prev.filter((t) => t.status !== 'done'));
    try {
      await fetch('/api/ai-todo?clearAll=true', { method: 'DELETE' });
      showToast('Cleared completed tasks');
    } catch (err) { console.warn('[AiTodo] clearCompleted failed', err); }
  }, [showToast]);

  const clearAllTasks = useCallback(async () => {
    if (!window.confirm('Clear all tasks? This cannot be undone.')) return;
    setTodos([]);
    try {
      await fetch('/api/ai-todo?clearAll=true&scope=all', { method: 'DELETE' });
      showToast('Cleared all tasks');
    } catch (err) {
      console.warn('[AiTodo] clearAllTasks failed', err);
      showToast('Failed to clear all tasks', 'error');
      fetchTodos();
    }
  }, [fetchTodos, showToast]);

  // ── Derived state ──────────────────────────────────────────────────────
  const categories = [
    'all',
    ...Array.from(new Set(todos.map((t) => t.category ?? 'Personal'))),
  ];

  const isArchivedComplete = useCallback((todo: AiTodo) => {
    if (todo.status !== 'done') return false;
    const completedAt = todo.updated_at || todo.created_at;
    if (!completedAt) return false;
    const completedMs = new Date(completedAt).getTime();
    if (Number.isNaN(completedMs)) return false;
    return Date.now() - completedMs >= HISTORY_ARCHIVE_DELAY_MS;
  }, []);

  const historyTodos = todos
    .filter((t) => isArchivedComplete(t))
    .sort((a, b) => {
      const at = new Date(a.updated_at || a.created_at || 0).getTime();
      const bt = new Date(b.updated_at || b.created_at || 0).getTime();
      return bt - at;
    });

  const activeTodosPool = todos.filter((t) => !isArchivedComplete(t));
  const recentTodos = activeTodosPool
    .filter((t) => {
      const createdAt = t.created_at;
      if (!createdAt) return false;
      const createdMs = new Date(createdAt).getTime();
      if (Number.isNaN(createdMs)) return false;
      return Date.now() - createdMs <= 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => {
      const at = new Date(a.created_at || 0).getTime();
      const bt = new Date(b.created_at || 0).getTime();
      return bt - at;
    })
    .slice(0, 6);

  const filteredTodos = activeTodosPool
    .filter((t) => filterStatus === 'all' || t.status === filterStatus)
    .filter((t) => filterPriority === 'all' || t.priority === filterPriority)
    .filter(
      (t) =>
        filterCategory === 'all' ||
        (t.category ?? 'Personal') === filterCategory
    )
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const order = { high: 0, medium: 1, low: 2 };
        return (order[a.priority] ?? 1) - (order[b.priority] ?? 1);
      }
      if (sortBy === 'due_date') {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return cb - ca;
    });

  const stats = {
    total: activeTodosPool.length,
    done: activeTodosPool.filter((t) => t.status === 'done').length,
    high: activeTodosPool.filter((t) => t.priority === 'high' && t.status !== 'done').length,
    overdue: activeTodosPool.filter((t) => isOverdue(t.due_date) && t.status !== 'done').length,
    eodMissed: activeTodosPool.filter((t) => isEodMissed(t)).length,
  };
  const completionPct =
    stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const activeBoardTodos = filteredTodos.filter((t) => t.status !== 'done');
  const doneBoardTodos = filteredTodos.filter((t) => t.status === 'done');
  const focusTask = activeBoardTodos[0] ?? null;
  const alsoTodayTasks = activeBoardTodos.slice(1, 5);
  const laterTasks = activeBoardTodos.slice(5, 9);
  const doneTodayTasks = doneBoardTodos.slice(0, 4);
  const eodMissedInView = filteredTodos.filter((t) => isEodMissed(t));
  const fullListPreviewCount = isMobile ? 2 : 3;
  const fullListPreview = filteredTodos.slice(0, fullListPreviewCount);
  const hasMoreInFullList = filteredTodos.length > fullListPreviewCount;
  const stackedBoardLayout = isMobile || isNarrowDesktop;
  const isCompactLayout = isMobile || isNarrowDesktop;

  const toggleBoardCard = (key: string) =>
    setExpandedBoardCards((p) => ({ ...p, [key]: !p[key] }));
  const toggleFullListRow = (key: string) =>
    setExpandedFullListRows((p) => ({ ...p, [key]: !p[key] }));

  // Scroll to a todo card by id and apply a calm highlight that fades
  const scrollAndHighlight = (id?: string) => {
    if (!id) return;
    try {
      const el = document.getElementById(`todo-${id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const originalBg = el.style.background;
      // Apply a calm soothing hue depending on theme
      const highlight = isDark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.16)';
      el.style.transition = 'box-shadow 0.35s ease, background 0.6s ease';
      el.style.boxShadow = '0 10px 30px rgba(139,92,246,0.12)';
      el.style.background = highlight;
      // revert after a short delay
      setTimeout(() => {
        el.style.background = originalBg || '';
        el.style.boxShadow = '';
      }, 2400);
    } catch (err) {
      console.warn('[AiTodo] scrollAndHighlight failed', err);
    }
  };

  // ── Theme tokens ───────────────────────────────────────────────────────
  const bg = isDark ? '#1a120e' : '#faf4ee';
  const card = isDark ? 'rgba(59,42,31,0.58)' : 'rgba(255,252,248,0.94)';
  const border = isDark ? 'rgba(234,209,190,0.2)' : 'rgba(164,132,110,0.24)';
  const text = isDark ? '#faeee3' : '#3f2d24';
  const muted = isDark ? 'rgba(250,238,227,0.58)' : 'rgba(63,45,36,0.54)';

  const pageBackground = isDark
    ? `radial-gradient(1000px 680px at -8% -18%, rgba(157,118,97,0.38), transparent 58%),
       radial-gradient(900px 560px at 105% 2%, rgba(133,161,141,0.28), transparent 56%),
       linear-gradient(180deg, #201510 0%, ${bg} 45%, #170f0c 100%)`
    : `radial-gradient(1080px 680px at -8% -20%, rgba(186,143,117,0.22), transparent 58%),
       radial-gradient(880px 560px at 105% 4%, rgba(140,171,152,0.2), transparent 56%),
       linear-gradient(180deg, #fdf8f2 0%, ${bg} 44%, #f6ede5 100%)`;

  const pillBase: React.CSSProperties = {
    borderRadius: 20,
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${border}`,
    transition: 'all 0.2s',
    background: card,
    fontFamily: 'inherit',
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        backgroundColor: pageBackground.includes('gradient') || pageBackground.includes('url(') ? undefined : pageBackground,
        backgroundImage: pageBackground.includes('gradient') || pageBackground.includes('url(') ? pageBackground : undefined,
        backgroundRepeat: pageBackground.includes('gradient') || pageBackground.includes('url(') ? 'no-repeat' : undefined,
        backgroundPosition: pageBackground.includes('gradient') || pageBackground.includes('url(') ? 'center' : undefined,
        backgroundSize: pageBackground.includes('gradient') || pageBackground.includes('url(') ? 'cover' : undefined,
        minHeight: '100dvh',
        padding: isMobile ? '16px 12px 96px' : '26px 18px 110px',
        fontFamily: 'Avenir Next, Trebuchet MS, Segoe UI, sans-serif',
      }}
    >
      <style>{`
        .todo-board-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr) minmax(0, 1fr);
          gap: 16px;
          align-items: start;
          width: 100%;
          box-sizing: border-box;
        }
        @media (max-width: 1080px) {
          .todo-board-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div style={{ maxWidth: 'min(1320px, 95vw)', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* ══ HEADER ═══════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 26 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isCompactLayout ? '1fr' : '1.5fr 1fr',
              gap: 14,
            }}
          >
            {/* Hero card */}
            <div
              style={{
                background: `linear-gradient(145deg,
                  ${hexToRgba(primary, isDark ? 0.34 : 0.2)},
                  ${hexToRgba(secondary, isDark ? 0.26 : 0.14)})`,
                borderRadius: 24,
                border: `1px solid ${border}`,
                padding: isCompactLayout ? '16px 14px' : '20px 22px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 16px 34px rgba(88,64,47,0.16)',
              }}
            >
              {/* Decorative blobs */}
              <div
                style={{
                  position: 'absolute',
                  top: -32,
                  right: -24,
                  width: 140,
                  height: 140,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.24)',
                  filter: 'blur(2px)',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: -48,
                  left: -14,
                  width: 164,
                  height: 164,
                  borderRadius: '50%',
                  background: isDark
                    ? 'rgba(255,214,180,0.12)'
                    : 'rgba(191,130,95,0.14)',
                  pointerEvents: 'none',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: isCompactLayout ? 'flex-start' : 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  position: 'relative',
                  zIndex: 1,
                  flexDirection: isCompactLayout ? 'column' : 'row',
                }}
              >
                <div>
                  <div
                    style={{
                      color: muted,
                      fontSize: 11,
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      marginBottom: 5,
                    }}
                  >
                    Daily Command Deck
                  </div>
                  <h1
                    id="task-atelier"
                    style={{
                      color: text,
                      fontSize: isMobile ? 30 : 36,
                      fontWeight: 700,
                      margin: 0,
                      letterSpacing: 0.2,
                      lineHeight: 1.05,
                      fontFamily: 'Iowan Old Style, Palatino Linotype, serif',
                    }}
                  >
                    Task Atelier
                  </h1>
                  <p
                    style={{
                      color: muted,
                      fontSize: 14,
                      margin: '10px 0 0',
                      maxWidth: 420,
                      lineHeight: 1.55,
                    }}
                  >
                    A calmer board for prioritizing focus work, reminders, and
                    calendar-led action in one unique flow.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    background: `linear-gradient(120deg, ${primary}, #8b6a55)`,
                    border: 'none',
                    color: '#fff',
                    borderRadius: 14,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 14,
                    transition: 'all 0.2s',
                    boxShadow: '0 10px 24px rgba(88,53,35,0.24)',
                    whiteSpace: 'nowrap',
                    fontFamily: 'inherit',
                    width: isCompactLayout ? '100%' : 'auto',
                  }}
                >
                  <Plus size={16} />
                  New Task
                </button>
              </div>
            </div>

            {/* Stats / Pulse card */}
            <div
              style={{
                background: card,
                borderRadius: 24,
                border: `1px solid ${border}`,
                padding: isMobile ? '14px 12px' : '16px 16px',
                boxShadow: '0 12px 28px rgba(88,64,47,0.12)',
              }}
            >
              <div
                style={{
                  color: muted,
                  fontSize: 11,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  marginBottom: 10,
                }}
              >
                Pulse
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {[
                  { label: 'Total', val: stats.total, color: text },
                  { label: 'Done', val: stats.done, color: '#2f8f66' },
                  { label: 'High', val: stats.high, color: '#cf5f3c' },
                  { label: 'Overdue', val: stats.overdue, color: '#c2410c' },
                  { label: 'Missed EOD', val: stats.eodMissed, color: '#8e6f25' },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${border}`,
                      background: isDark
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(255,255,255,0.75)',
                      padding: '10px 11px',
                    }}
                  >
                    <div
                      style={{
                        color: s.color,
                        fontSize: 22,
                        fontWeight: 800,
                        lineHeight: 1,
                      }}
                    >
                      {s.val}
                    </div>
                    <div style={{ color: muted, fontSize: 11, marginTop: 2 }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <span style={{ color: text, fontWeight: 600, fontSize: 13 }}>
                    Completion
                  </span>
                  <span
                    style={{ color: primary, fontWeight: 700, fontSize: 13 }}
                  >
                    {completionPct}%
                  </span>
                </div>
                <div
                  style={{
                    background: isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.08)',
                    borderRadius: 99,
                    height: 9,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${completionPct}%`,
                      background: `linear-gradient(to right, ${primary}, #7f9f92)`,
                      height: '100%',
                      borderRadius: 99,
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ CALENDAR AI PANEL ════════════════════════════════════════════ */}
        <section
          style={{
            background: isDark
              ? 'linear-gradient(140deg, rgba(57,38,28,0.7), rgba(37,27,21,0.7))'
              : 'linear-gradient(140deg, rgba(247,235,224,0.9), rgba(236,240,232,0.86))',
            border: `1px solid ${hexToRgba(primary, 0.25)}`,
            borderRadius: 22,
            padding: isMobile ? '14px 12px' : '18px 20px',
            marginBottom: 20,
            boxShadow: '0 12px 24px rgba(88,64,47,0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
                  alignItems: isCompactLayout ? 'stretch' : 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
                  flexDirection: isCompactLayout ? 'column' : 'row',
            }}
          >
            {/* Left: info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  background: isDark ? `${primary}2b` : '#fff7f0',
                  border: `1px solid ${hexToRgba(primary, 0.3)}`,
                  borderRadius: 14,
                  padding: 10,
                  flexShrink: 0,
                }}
              >
                <Brain size={20} style={{ color: primary }} />
              </div>
              <div>
                <div
                  style={{
                    color: text,
                    fontWeight: 700,
                    fontSize: 15,
                    marginBottom: 2,
                    fontFamily: 'Iowan Old Style, Palatino Linotype, serif',
                  }}
                >
                  Calendar-to-Task Engine
                </div>
                <div style={{ color: muted, fontSize: 12 }}>
                  {isConnected
                    ? `${events?.length ?? 0} upcoming events · auto-generates prep & follow-up tasks`
                    : 'Connect Google Calendar to unlock AI task generation'}
                </div>
              </div>
            </div>

            {/* Right: actions */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                  width: isCompactLayout ? '100%' : 'auto',
                flexWrap: 'wrap',
              }}
            >
              {isConnected && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: '#22c55e20',
                    color: '#22c55e',
                    borderRadius: 20,
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <CalendarCheck size={12} />
                  Connected
                </div>
              )}

              <button
                onClick={
                  isConnected
                    ? generateFromCalendar
                    : () => (window.location.href = '/settings?tab=integrations')
                }
                disabled={generating || calLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background:
                    generating || calLoading
                      ? 'rgba(255,255,255,0.1)'
                      : `linear-gradient(120deg, ${primary}, #8b6a55)`,
                  color: generating || calLoading ? muted : '#fff',
                  border: 'none',
                  borderRadius: 14,
                  padding: '10px 18px',
                  cursor: generating || calLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: 14,
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  width: isCompactLayout ? '100%' : 'auto',
                  justifyContent: 'center',
                  fontFamily: 'inherit',
                }}
              >
                {generating ? (
                  <>
                    <Loader2
                      size={15}
                      style={{ animation: 'spin 1s linear infinite' }}
                    />
                    Thinking...
                  </>
                ) : calLoading ? (
                  <>
                    <Loader2
                      size={15}
                      style={{ animation: 'spin 1s linear infinite' }}
                    />
                    Loading events...
                  </>
                ) : isConnected ? (
                  <>
                    <Zap size={15} />
                    Generate Tasks
                  </>
                ) : (
                  <>
                    <Calendar size={15} />
                    Connect Calendar
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Event pills */}
          {isConnected && events && events.length > 0 && (
            <div
              style={{
                marginTop: 14,
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {events.slice(0, 4).map((ev) => {
                const d = new Date(ev.start);
                const isToday = d.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={ev.id}
                    style={{
                      background: isDark
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(255,255,255,0.72)',
                      border: `1px solid ${border}`,
                      borderRadius: 999,
                      padding: '5px 11px',
                      fontSize: 12,
                      color: muted,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: isToday ? '#b06d3d' : primary,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: text, fontWeight: 500 }}>
                      {ev.title.length > 22
                        ? ev.title.slice(0, 22) + '…'
                        : ev.title}
                    </span>
                    <span>
                      {isToday
                        ? 'Today'
                        : d.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                    </span>
                  </div>
                );
              })}
              {events.length > 4 && (
                <div
                  style={{
                    background: `${primary}15`,
                    borderRadius: 8,
                    padding: '5px 10px',
                    fontSize: 12,
                    color: primary,
                    fontWeight: 600,
                  }}
                >
                  +{events.length - 4} more
                </div>
              )}
            </div>
          )}

          {isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{
                marginTop: 14,
                borderRadius: 18,
                border: `1px solid ${hexToRgba(primary, 0.16)}`,
                background: isDark
                  ? 'linear-gradient(120deg, rgba(24,18,14,0.85), rgba(34,28,23,0.55))'
                  : 'linear-gradient(120deg, rgba(255,252,248,0.9), rgba(240,234,228,0.6))',
                padding: isCompactLayout ? '12px 12px' : '14px 16px',
                display: 'grid',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
                    border: `1px solid ${hexToRgba(primary, 0.2)}`,
                    borderRadius: 12,
                    padding: 8,
                  }}
                >
                  <Zap size={16} style={{ color: primary }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: text, fontSize: 14 }}>Turn events into tasks</div>
                  <div style={{ fontSize: 12, color: muted }}>Use the calendar panel to generate prep and follow-up items.</div>
                </div>
              </div>

              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0, y: 6 },
                  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.12 } },
                }}
                style={{ display: 'grid', gap: 8 }}
              >
                {[
                  'Review upcoming events above',
                  'Click Generate Tasks to build a checklist',
                  'Edit, prioritize, or archive what you need',
                ].map((step, index) => (
                  <motion.div
                    key={step}
                    variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: 14,
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)',
                      border: `1px solid ${hexToRgba(primary, 0.16)}`,
                    }}
                  >
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 3, repeat: Infinity, delay: index * 0.35 }}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        color: primary,
                        background: isDark ? 'rgba(0,0,0,0.35)' : '#fff',
                        border: `1px solid ${hexToRgba(primary, 0.3)}`,
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </motion.div>
                    <div style={{ fontSize: 12, color: text, fontWeight: 600 }}>{step}</div>
                  </motion.div>
                ))}
              </motion.div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {['Prep notes', 'Follow-up email', 'Travel buffer'].map((chip) => (
                  <div
                    key={chip}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      color: text,
                      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)',
                      border: `1px solid ${hexToRgba(primary, 0.2)}`,
                    }}
                  >
                    {chip}
                  </div>
                ))}

                <button
                  onClick={generateFromCalendar}
                  disabled={generating || calLoading || !events?.length}
                  style={{
                    marginLeft: 'auto',
                    padding: '8px 12px',
                    borderRadius: 12,
                    border: `1px solid ${hexToRgba(primary, 0.3)}`,
                    background: generating || calLoading ? 'rgba(255,255,255,0.1)' : `linear-gradient(120deg, ${primary}, #8b6a55)`,
                    color: generating || calLoading ? muted : '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: generating || calLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {generating ? 'Generating…' : 'Generate Tasks'}
                </button>
              </div>
            </motion.div>
          )}

          {!isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{
                marginTop: 16,
                borderRadius: 20,
                border: `1px solid ${hexToRgba(primary, 0.18)}`,
                background: isDark
                  ? 'linear-gradient(120deg, rgba(25,18,14,0.9), rgba(34,28,23,0.7))'
                  : 'linear-gradient(120deg, rgba(255,250,246,0.92), rgba(245,236,230,0.7))',
                padding: isCompactLayout ? '14px 12px' : '16px 18px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <motion.div
                aria-hidden
                animate={{ opacity: [0.35, 0.6, 0.35], x: ['-12%', '12%', '-12%'] }}
                transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  position: 'absolute',
                  inset: '0%',
                  background: isDark
                    ? 'radial-gradient(circle at 20% 20%, rgba(201,115,71,0.18), transparent 55%)'
                    : 'radial-gradient(circle at 20% 20%, rgba(201,115,71,0.22), transparent 55%)',
                  pointerEvents: 'none',
                }}
              />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
                      border: `1px solid ${hexToRgba(primary, 0.2)}`,
                      borderRadius: 12,
                      padding: 8,
                    }}
                  >
                    <Calendar size={16} style={{ color: primary }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: text, fontSize: 14 }}>Make your calendar do the planning</div>
                    <div style={{ fontSize: 12, color: muted }}>A quick setup turns events into tasks you can actually finish.</div>
                  </div>
                </div>

                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0, transition: { staggerChildren: 0.12 } },
                  }}
                  style={{ display: 'grid', gap: 10 }}
                >
                  {calendarGuideSteps.map((step, index) => (
                    <motion.div
                      key={step.title}
                      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        padding: '10px 12px',
                        borderRadius: 16,
                        border: `1px solid ${hexToRgba(step.accent, 0.25)}`,
                        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
                      }}
                    >
                      <motion.div
                        animate={{ scale: [1, 1.08, 1], boxShadow: ['0 0 0 rgba(0,0,0,0)', `0 0 12px ${hexToRgba(step.accent, 0.35)}`, '0 0 0 rgba(0,0,0,0)'] }}
                        transition={{ duration: 3.6, repeat: Infinity, delay: index * 0.4 }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                          color: step.accent,
                          background: isDark ? 'rgba(0,0,0,0.35)' : '#fff',
                          border: `1px solid ${hexToRgba(step.accent, 0.4)}`,
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </motion.div>
                      <div>
                        <div style={{ fontWeight: 700, color: text, fontSize: 13 }}>{step.title}</div>
                        <div style={{ color: muted, fontSize: 12 }}>{step.detail}</div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

                <div
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  {['Prep checklist', 'Follow-up nudge', 'Travel buffer'].map((chip) => (
                    <div
                      key={chip}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        color: text,
                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)',
                        border: `1px solid ${hexToRgba(primary, 0.2)}`,
                      }}
                    >
                      {chip}
                    </div>
                  ))}

                  <button
                    onClick={() => (window.location.href = '/settings?tab=integrations')}
                    style={{
                      marginLeft: 'auto',
                      padding: '8px 12px',
                      borderRadius: 12,
                      border: `1px solid ${hexToRgba(primary, 0.3)}`,
                      background: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
                      color: text,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Open Settings
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </section>

        {/* ══ EOD MISSED BANNER ════════════════════════════════════════════ */}
        {eodMissedInView.length > 0 && (
          <div
            style={{
              marginBottom: 14,
              borderRadius: 16,
              border: `2px solid ${hexToRgba('#a98532', 0.55)}`,
              background: isDark
                ? 'linear-gradient(140deg, rgba(103,78,24,0.44), rgba(73,55,18,0.34))'
                : 'linear-gradient(140deg, rgba(255,245,214,0.96), rgba(255,250,232,0.92))',
              padding: '12px 14px',
              boxShadow: '0 12px 24px rgba(122,92,28,0.12)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: isDark ? '#f7ddb0' : '#6b5420',
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              <AlertTriangle size={14} />
              Missed EOD
            </div>
            <div
              style={{
                marginTop: 4,
                color: isDark ? 'rgba(247,221,176,0.9)' : '#7a6124',
                fontSize: 13,
              }}
            >
              {eodMissedInView.length} task
              {eodMissedInView.length === 1 ? '' : 's'} in this view crossed
              the 24-hour window without completion.
            </div>
          </div>
        )}

        {/* ══ FILTERS BAR ══════════════════════════════════════════════════ */}
        <section
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 16,
            alignItems: 'center',
            background: card,
            border: `1px solid ${border}`,
            borderRadius: 20,
            padding: isMobile ? 10 : 12,
            boxShadow: '0 10px 24px rgba(88,64,47,0.08)',
          }}
        >
          {/* Status pills */}
          {(['all', 'pending', 'in_progress', 'done'] as FilterStatus[]).map(
            (s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  ...pillBase,
                  flex: isMobile ? '1 1 calc(50% - 4px)' : '0 0 auto',
                  background:
                    filterStatus === s
                      ? `linear-gradient(120deg, ${primary}, #8b6a55)`
                      : card,
                  color: filterStatus === s ? '#fff' : muted,
                  border: `1px solid ${
                    filterStatus === s ? primary : border
                  }`,
                }}
              >
                {s === 'all'
                  ? 'All'
                  : s === 'in_progress'
                  ? 'In Progress'
                  : s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== 'all' && (
                  <span
                    style={{
                      marginLeft: 5,
                      background:
                        filterStatus === s
                          ? 'rgba(255,255,255,0.25)'
                          : 'rgba(0,0,0,0.08)',
                      borderRadius: 10,
                      padding: '0 5px',
                      fontSize: 11,
                    }}
                  >
                    {todos.filter((t) => t.status === s).length}
                  </span>
                )}
              </button>
            )
          )}

          {/* Priority select */}
          <select
            value={filterPriority}
            onChange={(e) =>
              setFilterPriority(e.target.value as FilterPriority)
            }
            style={{
              background: card,
              border: `1px solid ${border}`,
              color: muted,
              borderRadius: 20,
              padding: '7px 12px',
              fontSize: 13,
              cursor: 'pointer',
              outline: 'none',
              flex: isMobile ? '1 1 100%' : '0 0 auto',
              fontFamily: 'inherit',
            }}
          >
            <option value="all">All priorities</option>
            <option value="high">🟠 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>

          {/* Category select */}
          {categories.length > 2 && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                background: card,
                border: `1px solid ${border}`,
                color: muted,
                borderRadius: 20,
                padding: '7px 12px',
                fontSize: 13,
                cursor: 'pointer',
                outline: 'none',
                flex: isMobile ? '1 1 100%' : '0 0 auto',
                fontFamily: 'inherit',
              }}
            >
              {categories.map((c) => (
                <option key={c}>{c === 'all' ? 'All categories' : c}</option>
              ))}
            </select>
          )}

          {/* Sort + clear actions */}
          <div
            style={{
              marginLeft: isMobile ? 0 : 'auto',
              display: 'flex',
              gap: 8,
              width: isMobile ? '100%' : 'auto',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() =>
                setSortBy((s) =>
                  s === 'priority'
                    ? 'due_date'
                    : s === 'due_date'
                    ? 'created'
                    : 'priority'
                )
              }
              style={{
                ...pillBase,
                background: card,
                color: muted,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                flex: isMobile ? '1 1 100%' : '0 0 auto',
              }}
            >
              <ArrowUpDown size={13} />
              {sortBy === 'priority'
                ? 'Priority'
                : sortBy === 'due_date'
                ? 'Due date'
                : 'Newest'}
            </button>

            {stats.done > 0 && (
              <button
                onClick={clearCompleted}
                style={{
                  ...pillBase,
                  background: card,
                  color: '#8a6a54',
                  border: `1px solid rgba(138,106,84,0.35)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  flex: isMobile ? '1 1 calc(50% - 4px)' : '0 0 auto',
                }}
              >
                <CheckCheck size={13} />
                Clear done
              </button>
            )}

            {stats.total > 0 && (
              <button
                onClick={clearAllTasks}
                style={{
                  ...pillBase,
                  background: card,
                  color: '#8a6a54',
                  border: `1px solid rgba(138,106,84,0.35)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  flex: isMobile ? '1 1 calc(50% - 4px)' : '0 0 auto',
                }}
              >
                <Trash2 size={13} />
                Clear all
              </button>
            )}
          </div>
        </section>

        {/* ══ BOARD ════════════════════════════════════════════════════════ */}
        {loading ? (
          <EmptyState type="loading" primary={primary} muted={muted} card={card} border={border} text={text} />
        ) : filteredTodos.length === 0 ? (
          <EmptyState
            type={todos.length === 0 ? 'empty' : 'no-match'}
            primary={primary}
            muted={muted}
            card={card}
            border={border}
            text={text}
            isConnected={isConnected}
            generating={generating}
            onGenerate={generateFromCalendar}
            onAdd={() => setShowAddModal(true)}
          />
        ) : (
          <div
            className="todo-board-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: stackedBoardLayout
                ? '1fr'
                : 'minmax(0, 1fr) minmax(0, 1.35fr) minmax(0, 1fr)',
              gap: 16,
              alignItems: 'start',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            {/* ── Left column ─────────────────────────────────────────── */}
            <div style={{ display: 'grid', gap: 12, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
              <SectionLabel muted={muted}>Your focus today</SectionLabel>

              <div
                style={{
                  borderRadius: 18,
                  border: `1px solid ${hexToRgba('#be9d88', 0.45)}`,
                  background: isDark
                    ? 'rgba(66,44,33,0.52)'
                    : 'rgba(250,238,225,0.86)',
                  padding: '14px 14px',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    color: text,
                    fontSize: 31,
                    fontWeight: 700,
                    fontFamily: 'Iowan Old Style, Palatino Linotype, serif',
                    lineHeight: 1,
                  }}
                >
                  Today
                </div>
                <div style={{ color: muted, fontSize: 13, marginTop: 6 }}>
                  Start with one thing
                </div>
              </div>

              {focusTask && (
                <ExpandableCard
                  border={`1px solid ${hexToRgba('#d4ad88', 0.45)}`}
                  bg={isDark ? 'rgba(67,48,37,0.55)' : 'rgba(254,243,232,0.84)'}
                  title={focusTask.title}
                  detail={
                    focusTask.description ||
                    focusTask.ai_reasoning ||
                    (focusTask.due_date
                      ? `Due ${formatDueDate(focusTask.due_date)}`
                      : 'You are in motion.')
                  }
                  text={text}
                  muted={muted}
                  label="Focus note"
                  expanded={!!expandedBoardCards['focus-note']}
                  onToggle={() => toggleBoardCard('focus-note')}
                />
              )}

              {alsoTodayTasks.length > 0 && (
                <SectionLabel muted={muted} style={{ marginTop: 2 }}>
                  Also today
                </SectionLabel>
              )}

              {alsoTodayTasks.map((todo) => (
                <AlsoTodayCard
                  key={todo.id ?? `also-${todo.title}`}
                  todo={todo}
                  isDark={isDark}
                  text={text}
                  muted={muted}
                  expanded={
                    !!expandedBoardCards[`also-${todo.id ?? todo.title}`]
                  }
                  onToggleExpand={() =>
                    toggleBoardCard(`also-${todo.id ?? todo.title}`)
                  }
                  onToggleStatus={() =>
                    todo.id && toggleStatus(todo.id, todo.status)
                  }
                />
              ))}
            </div>

            {/* ── Centre column ────────────────────────────────────────── */}
            <div style={{ display: 'grid', gap: 12, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
              <div
                style={{
                  textAlign: 'center',
                  color: muted,
                  fontSize: 12,
                  letterSpacing: 1.3,
                  textTransform: 'uppercase',
                  fontWeight: 700,
                }}
              >
                Next step
              </div>
              <div
                style={{
                  textAlign: 'center',
                  color: text,
                  fontSize: isMobile ? 28 : 34,
                  fontWeight: 700,
                  fontFamily: 'Iowan Old Style, Palatino Linotype, serif',
                }}
              >
                Do this first
              </div>

              {focusTask ? (
                <div
                  style={{
                    borderRadius: 20,
                    border: `1px solid ${
                      isEodMissed(focusTask)
                        ? hexToRgba('#a98532', 0.55)
                        : hexToRgba('#d5c2b3', 0.62)
                    }`,
                    background: isDark
                      ? 'rgba(52,38,30,0.7)'
                      : 'rgba(255,255,255,0.82)',
                    padding: isMobile ? '12px 12px' : '18px 20px',
                    boxShadow: isEodMissed(focusTask)
                      ? '0 16px 30px rgba(142,111,37,0.2)'
                      : '0 16px 28px rgba(56,33,23,0.12)',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 16,
                      border: `2px solid ${
                        isEodMissed(focusTask) ? '#a98532' : '#f0833d'
                      }`,
                      background: isEodMissed(focusTask)
                        ? isDark
                          ? 'rgba(106,84,30,0.24)'
                          : 'rgba(255,248,224,0.84)'
                        : isDark
                        ? 'rgba(81,60,48,0.38)'
                        : 'rgba(244,248,251,0.74)',
                      padding: '14px 14px',
                      minWidth: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
                      <button
                        onClick={() =>
                          focusTask.id &&
                          toggleStatus(focusTask.id, focusTask.status)
                        }
                        style={{
                          background: 'none',
                          border: 'none',
                          color: muted,
                          padding: 0,
                          cursor: 'pointer',
                          marginTop: 1,
                          flexShrink: 0,
                        }}
                      >
                        <Circle size={20} />
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            color: text,
                            fontWeight: 700,
                            fontSize: isMobile ? 18 : 26,
                            lineHeight: 1.12,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {focusTask.title}
                        </div>
                        <div
                          style={{
                            color: muted,
                            fontSize: 15,
                            marginTop: 6,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {focusTask.description ||
                            focusTask.ai_reasoning ||
                            (focusTask.due_date
                              ? `Due ${formatDueDate(focusTask.due_date)}`
                              : 'Deep focus block.')}
                        </div>
                        <div
                          style={{
                            marginTop: 10,
                            display: 'inline-flex',
                            borderRadius: 999,
                            padding: '4px 9px',
                            background: 'rgba(94,130,172,0.18)',
                            color: '#3d5f86',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {focusTask.priority === 'high'
                            ? 'High focus'
                            : focusTask.priority === 'medium'
                            ? 'Steady focus'
                            : 'Light focus'}
                        </div>
                        {isEodMissed(focusTask) && (
                          <div
                            style={{
                              marginTop: 8,
                              display: 'inline-flex',
                              borderRadius: 999,
                              padding: '4px 10px',
                              background: 'rgba(169,133,50,0.22)',
                              color: '#6b5420',
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            Missed EOD
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 20,
                    border: `1px solid ${border}`,
                    background: card,
                    padding: '20px 18px',
                    textAlign: 'center',
                    color: muted,
                  }}
                >
                  Everything in this view is complete. Nice pace.
                </div>
              )}

              {/* Full list accordion */}
              {filteredTodos.length > 0 && (
                <div
                  style={{
                    borderRadius: 18,
                    border: `1px solid ${border}`,
                    background: card,
                    padding: '12px 14px',
                  }}
                >
                  <button
                    onClick={() => setIsFullListExpanded((v) => v)}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: muted,
                          fontSize: 12,
                          letterSpacing: 1.2,
                          textTransform: 'uppercase',
                          fontWeight: 700,
                        }}
                      >
                        Full list
                      </div>
                      <div style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                        {isFullListExpanded
                          ? `Showing ${filteredTodos.length} tasks`
                          : `${filteredTodos.length} tasks in this view`}
                      </div>
                    </div>
                    {/* <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color: text,
                        fontSize: 12,
                        fontWeight: 700,
                        border: `1px solid ${border}`,
                        borderRadius: 999,
                        padding: '5px 10px',
                        background: isDark
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(255,255,255,0.72)',
                      }}
                    >
                      {isFullListExpanded ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                      {isFullListExpanded ? 'Collapse' : 'Expand'}
                    </div> */}
                  </button>

                  {/* Preview */}
                  {!isFullListExpanded && (
                    <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                      {fullListPreview.map((todo) => (
                        <div
                          key={todo.id ?? `preview-${todo.title}`}
                          style={{
                            borderRadius: 12,
                            border: `1px solid ${
                              isEodMissed(todo)
                                ? hexToRgba('#a98532', 0.5)
                                : border
                            }`,
                            padding: '9px 10px',
                            background: isEodMissed(todo)
                              ? isDark
                                ? 'rgba(106,84,30,0.28)'
                                : 'rgba(255,248,224,0.86)'
                              : isDark
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(255,255,255,0.8)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              onClick={() =>
                                todo.id && toggleStatus(todo.id, todo.status)
                              }
                              style={{
                                background: 'none',
                                border: 'none',
                                color: muted,
                                padding: 0,
                                cursor: 'pointer',
                              }}
                            >
                              {todo.status === 'done' ? (
                                <CheckCircle2 size={16} />
                              ) : (
                                <Circle size={16} />
                              )}
                            </button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  color: text,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden',
                                }}
                              >
                                {todo.title}
                              </div>
                              <div style={{ color: muted, fontSize: 11, marginTop: 2 }}>
                                {isEodMissed(todo)
                                  ? 'Missed EOD • Needs attention'
                                  : todo.due_date
                                  ? `Due ${formatDueDate(todo.due_date)}`
                                  : `${PRIORITY_CONFIG[todo.priority].label} priority`}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {hasMoreInFullList && (
                        <div
                          style={{ color: muted, fontSize: 12, textAlign: 'center' }}
                        >
                          +{filteredTodos.length - fullListPreviewCount} more
                          tasks hidden
                        </div>
                      )}
                    </div>
                  )}

                  {/* Full expanded list */}
                  {isFullListExpanded && (
                    <div
                      style={{
                        marginTop: 10,
                        maxHeight: isMobile ? '62vh' : '52vh',
                        overflowY: 'auto',
                        paddingRight: 2,
                      }}
                    >
                      {filteredTodos.map((todo, idx) => {
                        const rowKey = `full-${todo.id ?? todo.title}-${idx}`;
                        const rowExpanded = !!expandedFullListRows[rowKey];
                        const itemDone = todo.status === 'done';
                        const itemOverdue = !itemDone && isOverdue(todo.due_date);
                        const itemEodMissed = isEodMissed(todo);
                        const detailText =
                          todo.description || todo.ai_reasoning || '';
                        const hasLong = detailText.length > 96;

                        return (
                          <div
                            id={todo.id ? `todo-${todo.id}` : undefined}
                            key={todo.id ?? todo.title}
                            style={{
                              padding: '10px 8px',
                              borderBottom:
                                idx === filteredTodos.length - 1
                                  ? 'none'
                                  : `1px solid ${border}`,
                              background: itemEodMissed
                                ? isDark
                                  ? 'rgba(106,84,30,0.2)'
                                  : 'rgba(255,248,224,0.64)'
                                : 'transparent',
                              borderRadius: itemEodMissed ? 10 : 0,
                              opacity: itemDone ? 0.65 : 1,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 8,
                              }}
                            >
                              <button
                                onClick={() =>
                                  todo.id && toggleStatus(todo.id, todo.status)
                                }
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: muted,
                                  padding: 0,
                                  cursor: 'pointer',
                                  marginTop: 1,
                                  flexShrink: 0,
                                }}
                              >
                                {itemDone ? (
                                  <CheckCircle2 size={16} />
                                ) : (
                                  <Circle size={16} />
                                )}
                              </button>

                              <div
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                  cursor: hasLong ? 'pointer' : 'default',
                                }}
                                onClick={() =>
                                  hasLong && toggleFullListRow(rowKey)
                                }
                              >
                                <div
                                  style={{
                                    color: text,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    lineHeight: 1.35,
                                    textDecoration: itemDone
                                      ? 'line-through'
                                      : 'none',
                                  }}
                                >
                                  {todo.title}
                                </div>
                                <div
                                  style={{
                                    color: muted,
                                    fontSize: 12,
                                    marginTop: 2,
                                    whiteSpace: rowExpanded ? 'normal' : 'nowrap',
                                    textOverflow: rowExpanded ? 'clip' : 'ellipsis',
                                    overflow: rowExpanded ? 'visible' : 'hidden',
                                  }}
                                >
                                  {todo.category || 'Personal'}
                                  {todo.due_date
                                    ? ` • ${itemOverdue ? 'Overdue' : 'Due'} ${formatDueDate(todo.due_date)}`
                                    : ''}
                                  {todo.reminder_at
                                    ? ` • Reminder ${new Date(
                                        todo.reminder_at
                                      ).toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                      })}`
                                    : ''}
                                  {itemEodMissed ? ' • Missed EOD' : ''}
                                </div>

                                {detailText && (
                                  <div
                                    style={{
                                      color: muted,
                                      fontSize: 12,
                                      marginTop: 4,
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    {rowExpanded
                                      ? detailText
                                      : detailText.slice(0, 96)}
                                    {!rowExpanded && detailText.length > 96
                                      ? '...'
                                      : ''}
                                  </div>
                                )}

                                {hasLong && (
                                  <div
                                    style={{
                                      color: muted,
                                      fontSize: 11,
                                      marginTop: 5,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {rowExpanded ? 'Show less' : 'Tap to expand'}
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() =>
                                  todo.id &&
                                  updatePriority(
                                    todo.id,
                                    todo.priority === 'high'
                                      ? 'medium'
                                      : todo.priority === 'medium'
                                      ? 'low'
                                      : 'high'
                                  )
                                }
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: itemEodMissed
                                    ? '#6b5420'
                                    : itemOverdue
                                    ? '#cf5f3c'
                                    : muted,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  padding: 0,
                                  marginTop: 2,
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.4,
                                  flexShrink: 0,
                                  fontFamily: 'inherit',
                                }}
                                title="Cycle priority"
                              >
                                {todo.priority}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* ── Right column ─────────────────────────────────────────── */}
            <div style={{ display: 'grid', gap: 12, minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
              {/* Arc card */}
              <div
                style={{
                  borderRadius: 16,
                  border: `1px solid ${hexToRgba('#c8b6ac', 0.56)}`,
                  background: isDark
                    ? 'rgba(71,53,47,0.48)'
                    : 'rgba(246,239,236,0.9)',
                  padding: '12px 13px',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    color: muted,
                    fontSize: 12,
                    letterSpacing: 1.3,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Your arc today
                </div>
                <div style={{ color: text, fontSize: 15, fontWeight: 500, overflowWrap: 'anywhere' }}>
                  {completionPct >= 70
                    ? 'You are in motion'
                    : completionPct >= 35
                    ? 'This is building'
                    : 'Just getting started'}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    borderTop: `1px solid ${hexToRgba('#d2a58d', 0.45)}`,
                    paddingTop: 8,
                    color: muted,
                    fontSize: 13,
                  }}
                >
                  {stats.done} done. Keep going.
                </div>
              </div>

              {/* Done today */}
              {doneTodayTasks.length > 0 && (
                <>
                  <SectionLabel muted={muted}>Done today</SectionLabel>
                  {doneTodayTasks.map((todo) => (
                    <div
                      id={todo.id ? `todo-${todo.id}` : undefined}
                      key={todo.id ?? `done-${todo.title}`}
                      style={{
                        borderRadius: 16,
                        border: `1px solid ${hexToRgba('#b9d2cb', 0.6)}`,
                        background: isDark
                          ? 'rgba(40,74,66,0.4)'
                          : 'rgba(227,245,240,0.84)',
                        padding: '11px 12px',
                        opacity: 0.76,
                        minWidth: 0,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
                        <button
                          onClick={() =>
                            todo.id && toggleStatus(todo.id, todo.status)
                          }
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#31756a',
                            padding: 0,
                            cursor: 'pointer',
                            marginTop: 1,
                            flexShrink: 0,
                          }}
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <div
                          style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                          onClick={() =>
                            toggleBoardCard(`done-${todo.id ?? todo.title}`)
                          }
                        >
                          <div
                            style={{
                              color: text,
                              fontWeight: 600,
                              fontSize: 15,
                              lineHeight: 1.25,
                              textDecoration: 'line-through',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {todo.title}
                          </div>
                          <div style={{ color: muted, fontSize: 12, marginTop: 4, overflowWrap: 'anywhere' }}>
                            {expandedBoardCards[
                              `done-${todo.id ?? todo.title}`
                            ]
                              ? todo.description || 'Completed and archived.'
                              : (
                                  todo.description || 'Completed and archived.'
                                ).slice(0, 65) +
                                ((todo.description || '').length > 65
                                  ? '...'
                                  : '')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Space for later */}
              {laterTasks.length > 0 && (
                <>
                  <SectionLabel muted={muted}>Space for later</SectionLabel>
                  {laterTasks.map((todo) => (
                    <LaterCard
                      key={todo.id ?? `later-${todo.title}`}
                      todo={todo}
                      isDark={isDark}
                      text={text}
                      muted={muted}
                      expanded={
                        !!expandedBoardCards[`later-${todo.id ?? todo.title}`]
                      }
                      onToggleExpand={() =>
                        toggleBoardCard(`later-${todo.id ?? todo.title}`)
                      }
                      onToggleStatus={() =>
                        todo.id && toggleStatus(todo.id, todo.status)
                      }
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ RECENTLY ADDED ═══════════════════════════════════════════════ */}
        {recentTodos.length > 0 && (
          <section
            style={{
              marginTop: 18,
              borderRadius: 18,
              border: `1px solid ${hexToRgba(primary, 0.24)}`,
              background: isDark
                ? 'linear-gradient(140deg, rgba(62,41,30,0.5), rgba(37,27,21,0.46))'
                : 'linear-gradient(140deg, rgba(255,250,245,0.98), rgba(245,238,230,0.92))',
              padding: isMobile ? '12px 12px' : '14px 14px',
              boxShadow: '0 10px 22px rgba(88,64,47,0.08)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 8,
              }}
            >
              <div>
                <div
                  style={{
                    color: muted,
                    fontSize: 11,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  Recently added
                </div>
                <div style={{ color: text, fontSize: 14, fontWeight: 700 }}>
                  New tasks are surfaced here first
                </div>
              </div>
              <div style={{ color: muted, fontSize: 12 }}>
                Last 24 hours
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {recentTodos.map((todo, idx) => {
                const sourceLabel = todo.ai_reasoning?.includes('[COGNITION_ENGINE]')
                  ? 'Cognition'
                  : todo.source_type === 'manual'
                    ? 'Manual'
                    : todo.source_type === 'action'
                      ? 'Action'
                      : todo.source_type === 'calendar'
                        ? 'Calendar'
                        : 'AI';

                return (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => scrollAndHighlight(todo.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter') scrollAndHighlight(todo.id); }}
                    key={todo.id ?? `recent-${todo.title}-${idx}`}
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${hexToRgba(primary, 0.16)}`,
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.86)',
                      padding: '10px 11px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: primary,
                          marginTop: 5,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ color: text, fontWeight: 700, fontSize: 14, overflowWrap: 'anywhere' }}>
                            {todo.title}
                          </div>
                          <span style={{
                            borderRadius: 999,
                            border: `1px solid ${hexToRgba(primary, 0.2)}`,
                            background: hexToRgba(primary, 0.08),
                            color: primary,
                            fontSize: 10,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                          }}>
                            New
                          </span>
                          <span style={{
                            borderRadius: 999,
                            border: `1px solid ${border}`,
                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)',
                            color: muted,
                            fontSize: 10,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                          }}>
                            {sourceLabel}
                          </span>
                        </div>
                        <div style={{ color: muted, fontSize: 12, marginTop: 3 }}>
                          Added {todo.created_at ? new Date(todo.created_at).toLocaleString() : 'recently'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ══ TASK HISTORY ═══════════════════════════════════════════════ */}
        {historyTodos.length > 0 && (
          <section
            style={{
              marginTop: 18,
              borderRadius: 18,
              border: `1px solid ${border}`,
              background: card,
              padding: isMobile ? '12px 12px' : '14px 14px',
              boxShadow: '0 10px 22px rgba(88,64,47,0.08)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 8,
              }}
            >
              <div>
                <div
                  style={{
                    color: muted,
                    fontSize: 11,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  Task History
                </div>
                <div style={{ color: text, fontSize: 14, fontWeight: 700 }}>
                  {historyTodos.length} completed task{historyTodos.length === 1 ? '' : 's'} archived
                </div>
              </div>
              <div style={{ color: muted, fontSize: 12 }}>
                Auto-moved after 2 hours
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8, maxHeight: isMobile ? '36vh' : '28vh', overflowY: 'auto' }}>
              {historyTodos.map((todo, idx) => {
                const completedAt = todo.updated_at || todo.created_at;
                const completedLabel = completedAt
                  ? new Date(completedAt).toLocaleString()
                  : 'Unknown time';
                const sourceLabel = todo.ai_reasoning?.includes('[COGNITION_ENGINE]')
                  ? 'Cognition'
                  : todo.source_type === 'manual'
                    ? 'Manual'
                    : todo.source_type === 'action'
                      ? 'Action'
                      : todo.source_type === 'calendar'
                        ? 'Calendar'
                        : 'AI';

                return (
                  <div
                    key={todo.id ?? `history-${todo.title}-${idx}`}
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${hexToRgba('#b9d2cb', 0.5)}`,
                      background: isDark ? 'rgba(40,74,66,0.25)' : 'rgba(227,245,240,0.68)',
                      padding: '10px 11px',
                      opacity: 0.85,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <CheckCircle2 size={16} style={{ color: '#31756a', marginTop: 1, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            color: text,
                            fontWeight: 600,
                            fontSize: 14,
                            lineHeight: 1.3,
                            textDecoration: 'line-through',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {todo.title}
                        </div>
                        <div style={{ color: muted, fontSize: 12, marginTop: 3 }}>
                          Completed: {completedLabel} • Source: {sourceLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ══ REFRESH BUTTON ═══════════════════════════════════════════════ */}
        {todos.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button
              onClick={fetchTodos}
              style={{
                background: card,
                border: `1px solid ${border}`,
                color: muted,
                borderRadius: 20,
                padding: '8px 18px',
                cursor: 'pointer',
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'inherit',
              }}
            >
              <RefreshCw size={13} />
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* ══ MODALS / OVERLAYS ════════════════════════════════════════════ */}
      {showAddModal && (
        <AddTodoModal
          onClose={() => setShowAddModal(false)}
          onAdd={addManual}
          isDark={isDark}
          primary={primary}
          isMobile={isMobile}
        />
      )}

      {/* ══ TOAST ════════════════════════════════════════════════════════ */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 96,
            left: '50%',
            transform: 'translateX(-50%)',
            background: toast.type === 'error' ? '#8a6a54' : '#22c55e',
            color: '#fff',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 9999,
            width: 'min(92vw, 520px)',
            textAlign: 'center',
            animation: 'slideUp 0.3s ease',
          }}
        >
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Small presentational helpers ───────────────────────────────────────────

function SectionLabel({
  muted,
  children,
  style,
}: {
  muted: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        color: muted,
        fontSize: 12,
        letterSpacing: 1.3,
        textTransform: 'uppercase',
        fontWeight: 700,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ExpandableCard({
  border,
  bg,
  title,
  detail,
  text,
  muted,
  label,
  expanded,
  onToggle,
}: {
  border: string;
  bg: string;
  title: string;
  detail: string;
  text: string;
  muted: string;
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const PREVIEW = 90;
  return (
    <div
      onClick={onToggle}
      style={{ borderRadius: 16, border, background: bg, padding: '12px 14px', cursor: 'pointer', minWidth: 0 }}
    >
      <div style={{ color: muted, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700, marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ color: text, fontSize: 22, fontWeight: 600, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{title}</div>
      <div style={{ color: muted, fontSize: 13, marginTop: 7, overflowWrap: 'anywhere' }}>
        {expanded ? detail : detail.slice(0, PREVIEW) + (detail.length > PREVIEW ? '...' : '')}
      </div>
      <div style={{ color: muted, fontSize: 11, marginTop: 6, fontWeight: 700 }}>
        {expanded ? 'Show less' : 'Tap to expand'}
      </div>
    </div>
  );
}

function AlsoTodayCard({
  todo,
  isDark,
  text,
  muted,
  expanded,
  onToggleExpand,
  onToggleStatus,
}: {
  todo: AiTodo;
  isDark: boolean;
  text: string;
  muted: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleStatus: () => void;
}) {
  const eod = isEodMissed(todo);
  const detail = todo.description || todo.ai_reasoning || 'Quick win to keep momentum.';
  const PREVIEW = 70;

  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${eod ? hexToRgba('#a98532', 0.52) : hexToRgba('#dbc77a', 0.56)}`,
        background: eod
          ? isDark ? 'rgba(106,84,30,0.4)' : 'rgba(255,248,224,0.9)'
          : isDark ? 'rgba(69,58,34,0.53)' : 'rgba(247,239,212,0.92)',
        padding: '12px 13px',
        boxShadow: eod ? '0 8px 18px rgba(142,111,37,0.18)' : 'none',
        minWidth: 0,
      }}
    >
      <div id={todo.id ? `todo-${todo.id}` : undefined} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
        <button onClick={onToggleStatus} style={{ background: 'none', border: 'none', color: muted, padding: 0, cursor: 'pointer', marginTop: 1, flexShrink: 0 }}>
          <Circle size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={onToggleExpand}>
          <div style={{ color: text, fontWeight: 600, fontSize: 15, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{todo.title}</div>
          <div style={{ color: muted, fontSize: 13, marginTop: 4, overflowWrap: 'anywhere' }}>
            {expanded ? detail : detail.slice(0, PREVIEW) + (detail.length > PREVIEW ? '...' : '')}
          </div>
          <div style={{ marginTop: 8, display: 'inline-flex', borderRadius: 999, padding: '2px 8px', background: 'rgba(196,160,26,0.18)', color: '#977916', fontSize: 11, fontWeight: 700 }}>
            Easy win
          </div>
          {eod && (
            <div style={{ marginTop: 6, display: 'inline-flex', borderRadius: 999, padding: '2px 8px', background: 'rgba(169,133,50,0.22)', color: '#6b5420', fontSize: 11, fontWeight: 800 }}>
              Missed EOD
            </div>
          )}
          <div style={{ color: muted, fontSize: 11, marginTop: 6, fontWeight: 700 }}>
            {expanded ? 'Show less' : 'Tap to expand'}
          </div>
        </div>
      </div>
    </div>
  );
}

function LaterCard({
  todo,
  isDark,
  text,
  muted,
  expanded,
  onToggleExpand,
  onToggleStatus,
}: {
  todo: AiTodo;
  isDark: boolean;
  text: string;
  muted: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleStatus: () => void;
}) {
  const eod = isEodMissed(todo);
  const detail = todo.description || todo.ai_reasoning || 'Keep this parked for a calmer slot.';
  const PREVIEW = 68;

  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${eod ? hexToRgba('#a98532', 0.5) : hexToRgba('#8ac8bb', 0.58)}`,
        background: eod
          ? isDark ? 'rgba(106,84,30,0.34)' : 'rgba(255,248,224,0.88)'
          : isDark ? 'rgba(38,67,61,0.52)' : 'rgba(217,241,237,0.88)',
        padding: '12px 13px',
        minWidth: 0,
      }}
    >
      <div id={todo.id ? `todo-${todo.id}` : undefined} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
        <button onClick={onToggleStatus} style={{ background: 'none', border: 'none', color: muted, padding: 0, cursor: 'pointer', marginTop: 1, flexShrink: 0 }}>
          <Circle size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={onToggleExpand}>
          <div style={{ color: text, fontWeight: 600, fontSize: 15, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{todo.title}</div>
          <div style={{ color: muted, fontSize: 12, marginTop: 4, overflowWrap: 'anywhere' }}>
            {expanded ? detail : detail.slice(0, PREVIEW) + (detail.length > PREVIEW ? '...' : '')}
          </div>
          <div style={{ marginTop: 8, display: 'inline-flex', borderRadius: 999, padding: '2px 8px', background: 'rgba(69,185,166,0.19)', color: '#1f7668', fontSize: 11, fontWeight: 700 }}>
            Reflection
          </div>
          {eod && (
            <div style={{ marginTop: 6, display: 'inline-flex', borderRadius: 999, padding: '2px 8px', background: 'rgba(169,133,50,0.22)', color: '#6b5420', fontSize: 11, fontWeight: 800 }}>
              Missed EOD
            </div>
          )}
          <div style={{ color: muted, fontSize: 11, marginTop: 6, fontWeight: 700 }}>
            {expanded ? 'Show less' : 'Tap to expand'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Empty / Loading state ────────────────────────────────────────────────────

function EmptyState({
  type,
  primary,
  muted,
  card,
  border,
  text,
  isConnected,
  generating,
  onGenerate,
  onAdd,
}: {
  type: 'loading' | 'empty' | 'no-match';
  primary: string;
  muted: string;
  card: string;
  border: string;
  text: string;
  isConnected?: boolean;
  generating?: boolean;
  onGenerate?: () => void;
  onAdd?: () => void;
}) {
  if (type === 'loading') {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: muted,
          background: card,
          border: `1px solid ${border}`,
          borderRadius: 22,
        }}
      >
        <Loader2
          size={28}
          style={{
            margin: '0 auto 12px',
            display: 'block',
            animation: 'spin 1s linear infinite',
            color: primary,
          }}
        />
        <p style={{ margin: 0, fontSize: 15 }}>Loading tasks...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        textAlign: 'center',
        padding: '72px 20px',
        color: muted,
        background: card,
        border: `1px solid ${border}`,
        borderRadius: 24,
        boxShadow: '0 12px 24px rgba(88,64,47,0.08)',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>
        {type === 'empty' ? '✨' : '🔍'}
      </div>
      <p
        style={{
          color: text,
          fontWeight: 700,
          fontSize: 18,
          margin: '0 0 8px',
        }}
      >
        {type === 'empty' ? 'No tasks yet' : 'No matching tasks'}
      </p>
      <p
        style={{ color: muted, fontSize: 14, margin: '0 0 24px', lineHeight: 1.55 }}
      >
        {type === 'empty'
          ? isConnected
            ? 'Hit "Generate Tasks" to create AI-powered tasks, or add one manually.'
            : 'Add tasks manually or connect Google Calendar for AI-generated tasks.'
          : 'Try changing your filters.'}
      </p>
      <div
        style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        {isConnected && type === 'empty' && (
          <button
            onClick={onGenerate}
            disabled={generating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: `linear-gradient(120deg, ${primary}, #8b6a55)`,
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              padding: '12px 22px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 15,
              fontFamily: 'inherit',
            }}
          >
            <Zap size={16} />
            Generate Tasks
          </button>
        )}
        <button
          onClick={onAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: card,
            color: text,
            border: `1px solid ${border}`,
            borderRadius: 12,
            padding: '12px 22px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 15,
            fontFamily: 'inherit',
          }}
        >
          <Plus size={16} />
          Add Manually
        </button>
      </div>
    </div>
  );
}
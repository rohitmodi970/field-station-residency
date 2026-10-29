// ─── Types ─────────────────────────────────────────────────────────────────

export interface AiTodo {
  id?: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'done';
  due_date?: string;
  reminder_at?: string;
  calendar_event_id?: string;
  calendar_event_title?: string;
  ai_reasoning?: string;
  category?: string;
  is_manual?: boolean;
  source_type?: 'calendar' | 'action' | 'manual' | 'ai';
  created_at?: string;
  updated_at?: string;
}

export type FilterStatus = 'all' | 'pending' | 'in_progress' | 'done';
export type FilterPriority = 'all' | 'high' | 'medium' | 'low';

// ─── Constants ──────────────────────────────────────────────────────────────

export const PRIORITY_CONFIG = {
  high: {
    label: 'High',
    color: '#b06d3d',
    bg: 'rgba(176,109,61,0.16)',
    ring: 'rgba(176,109,61,0.36)',
  },
  medium: {
    label: 'Medium',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    ring: 'rgba(245,158,11,0.35)',
  },
  low: {
    label: 'Low',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    ring: 'rgba(34,197,94,0.35)',
  },
} as const;

export const CATEGORY_COLORS: Record<string, string> = {
  Work: '#6366f1',
  Personal: '#ec4899',
  Health: '#22c55e',
  Finance: '#f59e0b',
  Learning: '#8b5cf6',
  Social: '#06b6d4',
  Travel: '#f97316',
  Admin: '#64748b',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return `rgba(99, 102, 241, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function relativeTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  const suffix = diff < 0 ? ' ago' : '';
  if (mins < 60) return `${mins}m${suffix}`;
  if (hrs < 24) return `${hrs}h${suffix}`;
  return `${days}d${suffix}`;
}

export function isOverdue(iso?: string): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

export function isLikelyDailyTaskText(text?: string): boolean {
  if (!text) return false;
  return /\b(daily|every day|everyday|each day|every morning|every evening|nightly|habit|routine|streak|med|meds|medication|medicine|pill|dose|tablet|supplement)\b/i.test(
    text
  );
}

export function isScheduledTask(todo: AiTodo): boolean {
  return Boolean(todo.reminder_at || todo.due_date);
}

export function isEodMissed(todo: AiTodo): boolean {
  if (!todo || todo.status === 'done') return false;
  if (isScheduledTask(todo)) return false;
  if (
    isLikelyDailyTaskText(
      `${todo.title} ${todo.description || ''} ${todo.ai_reasoning || ''}`
    )
  )
    return false;
  if (!todo.created_at) return false;
  const ageMs = Date.now() - new Date(todo.created_at).getTime();
  return ageMs >= 24 * 60 * 60 * 1000;
}

export function formatDueDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const hasExplicitTime = /T\d{2}:\d{2}/.test(iso);
  const timePart = hasExplicitTime
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';
  const datePart =
    d.toDateString() === now.toDateString()
      ? 'Today'
      : d.toDateString() === tomorrow.toDateString()
        ? 'Tomorrow'
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return timePart ? `${datePart}, ${timePart}` : datePart;
}
"use client";

import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Zap,
  ChevronDown,
  ChevronUp,
  Brain,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import {
  AiTodo,
  PRIORITY_CONFIG,
  CATEGORY_COLORS,
  isOverdue,
  formatDueDate,
} from './types';

// ─── Props ──────────────────────────────────────────────────────────────────

interface TodoCardProps {
  todo: AiTodo;
  isDark: boolean;
  primary: string;
  onToggle: (id: string, current: AiTodo['status']) => void;
  onDelete: (id: string) => void;
  onPriorityChange: (id: string, priority: AiTodo['priority']) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TodoCard({
  todo,
  isDark,
  primary,
  onToggle,
  onDelete,
  onPriorityChange,
}: TodoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isDone = todo.status === 'done';
  const pCfg = PRIORITY_CONFIG[todo.priority];
  const catColor = CATEGORY_COLORS[todo.category ?? 'Personal'] ?? '#6366f1';
  const overdue = !isDone && isOverdue(todo.due_date);
  const isReminderItem = Boolean(todo.reminder_at);
  const reminderTimeLabel = todo.reminder_at
    ? new Date(todo.reminder_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;
  const isCognitionEngineTask = todo.ai_reasoning?.includes('[COGNITION_ENGINE]') ?? false;
  const isNewTask = Boolean(
    todo.created_at && (Date.now() - new Date(todo.created_at).getTime()) < 30 * 60 * 1000
  );
  const sourceLabel = isCognitionEngineTask
    ? 'Cognition'
    : todo.source_type === 'manual'
      ? 'Manual'
      : todo.source_type === 'action'
        ? 'Action'
        : todo.source_type === 'calendar'
          ? 'Calendar'
          : 'AI';

  // ── Theme ──────────────────────────────────────────────────────────────
  const cardBg = isDark
    ? 'linear-gradient(170deg, rgba(62,41,30,0.62), rgba(34,24,18,0.62))'
    : 'linear-gradient(170deg, rgba(255,250,245,0.96), rgba(249,238,227,0.92))';
  const border = isDark ? 'rgba(239,213,193,0.18)' : 'rgba(162,125,102,0.22)';
  const text = isDark ? '#f8efe8' : '#3f2d24';
  const muted = isDark ? 'rgba(248,239,232,0.56)' : 'rgba(63,45,36,0.54)';

  return (
    <div
      className="todo-card"
      style={{
        background: cardBg,
        border: `1px solid ${isDone ? 'rgba(255,255,255,0.05)' : border}`,
        borderLeft: `4px solid ${isDone ? 'rgba(255,255,255,0.1)' : pCfg.color}`,
        borderRadius: 18,
        padding: '14px 16px',
        marginBottom: 12,
        transition: 'all 0.25s',
        opacity: isDone ? 0.6 : 1,
        position: 'relative',
        boxShadow: isDone ? 'none' : '0 10px 24px rgba(92,64,44,0.08)',
      }}
    >
      <div className="todo-card__top" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Checkbox */}
        <button
          onClick={() => todo.id && onToggle(todo.id, todo.status)}
          aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
          style={{
            flexShrink: 0,
            marginTop: 2,
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            padding: 0,
            color: isDone ? pCfg.color : muted,
            transition: 'all 0.2s',
          }}
        >
          {isDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div
            className="todo-card__title-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                color: isDone ? muted : text,
                fontWeight: 600,
                fontSize: 15,
                textDecoration: isDone ? 'line-through' : 'none',
                flex: 1,
                minWidth: 0,
                overflowWrap: 'anywhere',
              }}
            >
              {todo.title}
            </span>

            {/* Pills */}
            <Pill bg={`${catColor}20`} color={catColor}>
              {todo.category}
            </Pill>
            <Pill bg={pCfg.bg} color={pCfg.color} bold>
              {pCfg.label}
            </Pill>
            {isNewTask && (
              <Pill bg="rgba(16,185,129,0.14)" color="#059669" bold>
                New
              </Pill>
            )}
            {isCognitionEngineTask && (
              <Pill bg="rgba(139, 92, 246, 0.12)" color="#8b5cf6" bold>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Brain size={10} />
                  Cognition
                </span>
              </Pill>
            )}
            <Pill
              bg={isReminderItem ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.12)'}
              color={isReminderItem ? '#10b981' : '#6366f1'}
              bold
            >
              {isReminderItem ? 'Reminder' : 'Task'}
            </Pill>
            <Pill bg="rgba(125,101,85,0.12)" color="#7d6555" bold>
              {sourceLabel}
            </Pill>
          </div>

          {/* Meta row */}
          <div
            className="todo-card__meta-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginTop: 6,
              flexWrap: 'wrap',
            }}
          >
            {todo.due_date && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: overdue ? '#b06d3d' : muted,
                  fontSize: 12,
                }}
              >
                <Clock size={11} />
                <span style={{ fontWeight: overdue ? 700 : 400 }}>
                  {overdue ? 'Overdue · ' : ''}
                  {formatDueDate(todo.due_date)}
                </span>
              </span>
            )}
            {isReminderItem && reminderTimeLabel && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: '#10b981',
                  fontSize: 12,
                }}
              >
                <Clock size={11} />
                Reminds at {reminderTimeLabel}
              </span>
            )}
            {todo.calendar_event_title && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: muted,
                  fontSize: 12,
                }}
              >
                <Calendar size={11} />
                {todo.calendar_event_title}
              </span>
            )}
            {!todo.is_manual && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  color: muted,
                  fontSize: 11,
                }}
              >
                <Zap size={10} />
                AI
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div
          className="todo-card__actions"
          style={{ display: 'flex', gap: 4, flexShrink: 0, position: 'relative' }}
        >
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: muted,
              padding: 4,
              borderRadius: 6,
            }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <button
            onClick={() => setShowMenu((v) => !v)}
            aria-label="More options"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: muted,
              padding: 4,
              borderRadius: 6,
            }}
          >
            <MoreHorizontal size={14} />
          </button>

          {/* Context menu */}
          {showMenu && (
            <>
              {/* Click-away layer */}
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                onClick={() => setShowMenu(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  background: isDark ? '#1e293b' : '#fff',
                  border: `1px solid ${border}`,
                  borderRadius: 10,
                  padding: 6,
                  zIndex: 99,
                  minWidth: 148,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                }}
              >
                {(['high', 'medium', 'low'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      todo.id && onPriorityChange(todo.id, p);
                      setShowMenu(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      background:
                        todo.priority === p ? PRIORITY_CONFIG[p].bg : 'none',
                      border: 'none',
                      color: PRIORITY_CONFIG[p].color,
                      padding: '7px 10px',
                      borderRadius: 7,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: todo.priority === p ? 700 : 400,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: PRIORITY_CONFIG[p].color,
                        flexShrink: 0,
                      }}
                    />
                    {PRIORITY_CONFIG[p].label} Priority
                  </button>
                ))}

                <div
                  style={{
                    height: 1,
                    background: border,
                    margin: '4px 0',
                  }}
                />

                <button
                  onClick={() => {
                    todo.id && onDelete(todo.id);
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    color: '#8a6a54',
                    padding: '7px 10px',
                    borderRadius: 7,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: 'inherit',
                  }}
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (todo.description || todo.ai_reasoning) && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${border}`,
          }}
        >
          {todo.description && (
            <p
              style={{
                color: muted,
                fontSize: 13,
                lineHeight: 1.6,
                margin: 0,
                marginBottom: todo.ai_reasoning ? 8 : 0,
              }}
            >
              {todo.description}
            </p>
          )}
          {todo.ai_reasoning && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                background: `${primary}10`,
                borderRadius: 8,
                padding: '8px 10px',
              }}
            >
              <Brain
                size={13}
                style={{ color: primary, flexShrink: 0, marginTop: 2 }}
              />
              <p
                style={{
                  color: muted,
                  fontSize: 12,
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                  margin: 0,
                }}
              >
                {todo.ai_reasoning}
              </p>
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .todo-card {
            padding: 12px 13px !important;
          }

          .todo-card__top {
            flex-direction: column !important;
            gap: 10px !important;
          }

          .todo-card__title-row {
            flex-direction: column !important;
            align-items: flex-start !important;
          }

          .todo-card__title-row > span {
            width: 100%;
          }

          .todo-card__meta-row {
            gap: 6px 8px !important;
          }

          .todo-card__actions {
            align-self: flex-end;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Pill sub-component ──────────────────────────────────────────────────────

function Pill({
  children,
  bg,
  color,
  bold,
}: {
  children: React.ReactNode;
  bg: string;
  color: string;
  bold?: boolean;
}) {
  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: 20,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: bold ? 700 : 600,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}
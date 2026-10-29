"use client";

import React, { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { AiTodo, CATEGORY_COLORS } from './types';

// ─── Props ──────────────────────────────────────────────────────────────────

interface AddTodoModalProps {
  onClose: () => void;
  onAdd: (todo: Partial<AiTodo>) => Promise<void>;
  isDark: boolean;
  primary: string;
  isMobile: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AddTodoModal({
  onClose,
  onAdd,
  isDark,
  primary,
  isMobile,
}: AddTodoModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [category, setCategory] = useState('Personal');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onAdd({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      category,
      due_date: dueDate || undefined,
    });
    setSaving(false);
    onClose();
  };

  // ── Theme tokens ───────────────────────────────────────────────────────
  const bg = isDark ? '#1a1a2e' : '#ffffff';
  const border = isDark ? 'rgba(241,225,209,0.2)' : 'rgba(139,108,90,0.2)';
  const text = isDark ? '#f8efe8' : '#3f2d24';
  const muted = isDark ? 'rgba(248,239,232,0.55)' : 'rgba(63,45,36,0.55)';
  const inputBg = isDark ? 'rgba(241,225,209,0.08)' : 'rgba(248,239,232,0.85)';

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: inputBg,
    border: `1px solid ${border}`,
    borderRadius: 12,
    padding: '10px 14px',
    color: text,
    fontSize: isMobile ? 16 : 15,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    background: inputBg,
    border: `1px solid ${border}`,
    borderRadius: 8,
    padding: '8px 10px',
    color: text,
    fontSize: isMobile ? 16 : 14,
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={(e) => e.target === e.currentTarget && onClose()}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(41,26,18,0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          padding: '16px',
        }}
      >
        {/* Modal card */}
        <div
          style={{
            background: isDark
              ? 'linear-gradient(165deg, #2a1d17, #1f1612)'
              : 'linear-gradient(165deg, #fffaf5, #f8efe8)',
            border: `1px solid ${border}`,
            borderRadius: isMobile ? 20 : 24,
            padding: isMobile ? 16 : 28,
            width: '100%',
            maxWidth: isMobile ? '100%' : 460,
            maxHeight: isMobile ? 'calc(100dvh - 32px)' : '90dvh',
            overflowY: 'auto',
            boxShadow: '0 30px 60px rgba(37,22,15,0.4)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <h3
              style={{
                color: text,
                fontWeight: 700,
                fontSize: 18,
                fontFamily: 'Iowan Old Style, Palatino Linotype, serif',
                letterSpacing: 0.2,
                margin: 0,
              }}
            >
              Create Task
            </h3>
            <button
              onClick={onClose}
              aria-label="Close modal"
              style={{
                color: muted,
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                fontSize: 20,
                lineHeight: 1,
                padding: '4px 8px',
                borderRadius: 6,
                transition: 'background 0.15s',
              }}
            >
              ×
            </button>
          </div>

          {/* Title */}
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="What needs to be done?"
            style={{ ...inputStyle, marginBottom: 12 }}
          />

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details..."
            rows={2}
            style={{
              ...inputStyle,
              marginBottom: 12,
              resize: 'none',
              fontSize: isMobile ? 16 : 14,
            }}
          />

          {/* Priority + Category */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  color: muted,
                  fontSize: 12,
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as 'high' | 'medium' | 'low')
                }
                style={selectStyle}
              >
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  color: muted,
                  fontSize: 12,
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={selectStyle}
              >
                {Object.keys(CATEGORY_COLORS).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Due date */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                color: muted,
                fontSize: 12,
                marginBottom: 6,
                fontWeight: 600,
              }}
            >
              Due Date (optional)
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ ...inputStyle, fontSize: 14 }}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            style={{
              width: '100%',
              background: title.trim()
                ? `linear-gradient(120deg, ${primary}, #8b6a55)`
                : 'rgba(255,255,255,0.1)',
              color: title.trim() ? '#fff' : muted,
              border: 'none',
              borderRadius: 14,
              padding: '12px 0',
              fontWeight: 700,
              fontSize: 15,
              cursor: title.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontFamily: 'inherit',
            }}
          >
            {saving ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Adding...
              </>
            ) : (
              <>
                <Plus size={16} />
                Add Task
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
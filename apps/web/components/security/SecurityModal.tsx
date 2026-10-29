'use client';
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface SecurityModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: number;
  danger?: boolean;
  /** Optional footer pinned at bottom of modal */
  footer?: React.ReactNode;
}

/**
 * A reusable modal overlay for all security actions (password change,
 * TOTP setup, recovery code generation, etc.).
 * Reads theme vars from the parent [data-theme] attribute.
 */
export function SecurityModal({
  open, onClose, title, subtitle, children, maxWidth = 480, danger, footer,
}: SecurityModalProps) {
  /* Scroll-lock + Escape key */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes secModalBg   { from { opacity: 0 } to { opacity: 1 } }
        @keyframes secModalCard { from { opacity: 0; transform: translateY(18px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'fixed', inset: 0, zIndex: 9200,
          background: 'rgba(0,0,0,0.52)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px 16px',
          animation: 'secModalBg 0.18s ease',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          style={{
            background: 'var(--cream-card)',
            borderRadius: 24,
            border: `1px solid ${danger ? 'var(--border-danger)' : 'var(--cream-border-strong)'}`,
            boxShadow: '0 32px 80px rgba(0,0,0,0.26)',
            width: '100%',
            maxWidth,
            maxHeight: '90vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            animation: 'secModalCard 0.25s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          {/* ── Header ── */}
          <div style={{
            display: 'flex', alignItems: 'flex-start',
            justifyContent: 'space-between',
            padding: '22px 24px 0',
            flexShrink: 0,
          }}>
            <div>
              <h2 style={{
                margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em',
                color: danger ? 'var(--text-danger)' : 'var(--cream-text)',
              }}>{title}</h2>
              {subtitle && (
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--cream-muted)', lineHeight: 1.55 }}>
                  {subtitle}
                </p>
              )}
            </div>
            <button
              id="sec-modal-close"
              onClick={onClose}
              style={{
                border: 'none',
                background: 'var(--cream-inner)',
                cursor: 'pointer',
                borderRadius: 10,
                padding: '7px 8px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--cream-muted)',
                flexShrink: 0,
                marginLeft: 14,
                transition: 'background 0.15s',
                fontFamily: 'inherit',
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* ── Body ── */}
          <div style={{ padding: '20px 24px', flex: 1 }}>
            {children}
          </div>

          {/* ── Footer (optional) ── */}
          {footer && (
            <div style={{
              padding: '0 24px 22px',
              flexShrink: 0,
              borderTop: '1px solid var(--cream-border)',
              paddingTop: 16,
            }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

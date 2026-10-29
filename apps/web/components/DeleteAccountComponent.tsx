'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { AlertTriangle, Loader2 } from 'lucide-react';

/**
 * DeleteAccountComponent — uses inline styles with CDS tokens so it always
 * renders correctly regardless of which CSS framework or theme is active.
 */
const DeleteAccountComponent = () => {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [confirmationStep, setConfirmationStep] = useState(false);

  const proceedToConfirmation = () => {
    if (!reason.trim()) { setError('Please provide a reason before continuing.'); return; }
    setConfirmationStep(true);
    setError('');
  };

  const handleAccountDeletion = async () => {
    if (confirmText !== 'DELETE') { setError('Type DELETE to confirm.'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/user/deleteAccount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete account');
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/user/account/deleted');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelDeletion = () => {
    if (confirmationStep) { setConfirmationStep(false); setConfirmText(''); }
    else { setReason(''); }
    setError('');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    borderRadius: 10, border: '1px solid var(--border, rgba(0,0,0,0.12))',
    background: 'var(--fill-field, #F3F1EC)',
    color: 'var(--text-primary, #1A1917)',
    fontSize: 13, padding: '8px 12px',
    outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Warning strip */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        borderRadius: 10,
        border: '1px solid var(--border-danger, rgba(180,40,40,0.3))',
        background: 'var(--bg-danger, #FDECED)',
        padding: '10px 14px',
      }}>
        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--text-danger, #9B2020)' }} />
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-danger, #9B2020)' }}>
          Deleting your account permanently removes all your data and cannot be undone.
        </p>
      </div>

      {/* Inline error */}
      {error && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-danger, #9B2020)' }}>{error}</p>
      )}

      {/* Step 1: Reason */}
      {!confirmationStep && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="delete-reason" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary, #6B6862)' }}>
              Why are you leaving?
            </label>
            <textarea
              id="delete-reason"
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Your feedback helps us improve…"
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
            />
          </div>
          <div>
            <button
              type="button"
              onClick={proceedToConfirmation}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                borderRadius: 10, border: 'none',
                background: 'var(--fill-danger, #C53030)',
                color: 'var(--on-danger, #fff)',
                fontSize: 13, fontWeight: 500, padding: '9px 18px',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Request account deletion
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Confirm */}
      {confirmationStep && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text-danger, #9B2020)' }}>
            This action cannot be undone. All your data will be permanently deleted.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label htmlFor="delete-confirm" style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary, #6B6862)' }}>
              Type <strong style={{ fontWeight: 600, color: 'var(--text-primary, #1A1917)' }}>DELETE</strong> to confirm:
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE"
              style={{ ...inputStyle, height: 38 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={cancelDeletion}
              disabled={isSubmitting}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                borderRadius: 10,
                border: '1px solid var(--border, rgba(0,0,0,0.12))',
                background: 'var(--surface-1, #F3F1EC)',
                color: 'var(--text-secondary, #6B6862)',
                fontSize: 13, fontWeight: 500, padding: '9px 16px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.5 : 1, fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAccountDeletion}
              disabled={isSubmitting || confirmText !== 'DELETE'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                borderRadius: 10, border: 'none',
                background: 'var(--fill-danger, #C53030)',
                color: 'var(--on-danger, #fff)',
                fontSize: 13, fontWeight: 500, padding: '9px 18px',
                cursor: isSubmitting || confirmText !== 'DELETE' ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || confirmText !== 'DELETE' ? 0.45 : 1,
                fontFamily: 'inherit',
              }}
            >
              {isSubmitting && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
              {isSubmitting ? 'Deleting…' : 'Delete my account permanently'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeleteAccountComponent;
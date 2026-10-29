'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { isEncryptionInitialized } from '@/utils/encryption/keyManager';
import { generateAndSaveRecoveryCodes } from '@/utils/encryption';
import {
  hasCollabPrivateKey,
  storeCollabPrivateKey,
  generateCollabKeyPair,
  exportPublicKey,
  clearCollabPrivateKey,
} from '@/utils/encryption/collaborationCrypto';
import DeleteAccountComponent from '@/components/DeleteAccountComponent';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RecoveryCodesDisplay from '@/components/security/RecoveryCodesDisplay';
import { SecurityModal } from '@/components/security/SecurityModal';
import { useTheme } from '@/utilities/context/ThemeContext';
import {
  Shield, RefreshCw, AlertCircle, Lock, CheckCircle2,
  AlertTriangle, Loader2, ChevronLeft, Eye, EyeOff, X,
  Monitor, Smartphone, Globe, KeyRound, ChevronDown, ChevronRight,
  BookOpen, ShieldCheck, ShieldAlert, ShieldOff, HelpCircle,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */
interface DeviceSession {
  id: string;
  device_name?: string | null;
  browser?: string | null;
  os?: string | null;
  ip_address?: string | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  last_activity?: string | null;
  is_current?: boolean | null;
  is_active?: boolean | null;
  user_agent?: string | null;
}

interface PasswordChangeSectionProps {
  migrationNeeded: boolean;
  isMigrated: boolean;
  isOAuthUser: boolean;
  vaultPasswordSet: boolean;
  encryptionSalt?: string | null;
  encryptedMasterKey?: string | null;
  masterKeyIV?: string | null;
  keyVersion?: number;
  userId?: string;
  onPasswordChanged?: () => void;
  onPasswordSet?: () => void;
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function decodeJwtPayload(token: string): { session_id?: string } | null {
  try {
    const p = token.split('.')[1];
    if (!p) return null;
    return JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

function isPhone(os?: string | null) {
  return /android|ios|iphone|ipad/i.test(os ?? '');
}

/* ─── Design tokens — theme-aware ────────────────────────────────────── */
// Light vars on :root, dark vars on [data-theme="dark"] — driven by isDarkMode
// from ThemeContext so the page follows the user's in-app toggle, not just the OS.
const PAGE_STYLES = `
  :root {
    --cream-page:   #F0EDE4;
    --cream-card:   #FAFAF8;
    --cream-inner:  #F3F1EC;
    --cream-border: rgba(0,0,0,0.08);
    --cream-border-strong: rgba(0,0,0,0.14);
    --cream-text:   #1A1917;
    --cream-muted:  #6B6862;
    --cream-faint:  #9B9790;

    --pill-green-bg:   #E8F5E6; --pill-green-text: #2D7A2A;
    --pill-amber-bg:   #FFF3DC; --pill-amber-text: #7A5500;
    --pill-red-bg:     #FDECED; --pill-red-text:   #9B2020;
    --pill-blue-bg:    #EBF3FF; --pill-blue-text:  #1A4FA0;
    --pill-gray-bg:    #EFEFED; --pill-gray-text:  #5A5855;

    --surface-0:  #FAFAF8;
    --surface-1:  #F3F1EC;
    --text-primary:   #1A1917;
    --text-secondary: #6B6862;
    --text-muted:     #9B9790;
    --border:        rgba(0,0,0,0.08);
    --border-strong: rgba(0,0,0,0.14);
    --fill-field: #F3F1EC;
    --border-danger: rgba(180,40,40,0.35);
    --bg-danger:     #FDECED;
    --text-danger:   #9B2020;
    --fill-danger:   #C53030;
    --on-danger:     #FFFFFF;
  }

  /* Dark overrides — driven by data-theme="dark" set from ThemeContext.isDarkMode */
  [data-theme="dark"] {
    --cream-page:   #141412;
    --cream-card:   #1E1D1B;
    --cream-inner:  #272522;
    --cream-border: rgba(255,255,255,0.08);
    --cream-border-strong: rgba(255,255,255,0.14);
    --cream-text:   #EDEAE4;
    --cream-muted:  #9B9790;
    --cream-faint:  #6B6862;

    --pill-green-bg:   #1A3319; --pill-green-text: #7DD87A;
    --pill-amber-bg:   #2E2206; --pill-amber-text: #F5C842;
    --pill-red-bg:     #2E1010; --pill-red-text:   #F87070;
    --pill-blue-bg:    #0F1E38; --pill-blue-text:  #7AB5F5;
    --pill-gray-bg:    #28271F; --pill-gray-text:  #9B9790;

    --surface-0:  #1E1D1B;
    --surface-1:  #272522;
    --text-primary:   #EDEAE4;
    --text-secondary: #9B9790;
    --text-muted:     #6B6862;
    --border:        rgba(255,255,255,0.08);
    --border-strong: rgba(255,255,255,0.14);
    --fill-field: #272522;
    --border-danger: rgba(248,112,112,0.35);
    --bg-danger:     #2E1010;
    --text-danger:   #F87070;
    --fill-danger:   #C53030;
    --on-danger:     #FFFFFF;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ringFill { from { stroke-dashoffset: 251; } }

  .sec-card-row:hover { background: rgba(0,0,0,0.02); }
  [data-theme="dark"] .sec-card-row:hover { background: rgba(255,255,255,0.03); }

  .sec-btn-ghost:hover { background: var(--cream-inner) !important; }
  .sec-btn-outline:hover { opacity: 0.85; }

  @media (max-width: 760px) {
    .sec-sidebar { display: none !important; }
    .sec-grid { grid-template-columns: 1fr !important; }
  }
`;

/* ─── Primitives ──────────────────────────────────────────────────────── */
type PillVariant = 'green' | 'amber' | 'red' | 'blue' | 'gray';

function Pill({ label, variant = 'gray' }: { label: string; variant?: PillVariant }) {
  const styles: Record<PillVariant, React.CSSProperties> = {
    green: { background: 'var(--pill-green-bg)', color: 'var(--pill-green-text)' },
    amber: { background: 'var(--pill-amber-bg)', color: 'var(--pill-amber-text)' },
    red:   { background: 'var(--pill-red-bg)',   color: 'var(--pill-red-text)'   },
    blue:  { background: 'var(--pill-blue-bg)',  color: 'var(--pill-blue-text)'  },
    gray:  { background: 'var(--pill-gray-bg)',  color: 'var(--pill-gray-text)'  },
  };
  return (
    <span style={{ ...styles[variant], fontSize: 11, fontWeight: 500, letterSpacing: '0.02em', padding: '3px 9px', borderRadius: 99, whiteSpace: 'nowrap', display: 'inline-block' }}>
      {label}
    </span>
  );
}

function SecurityCard({ title, description, pill, pillVariant, children, id }: { title: string; description?: string; pill?: string; pillVariant?: PillVariant; children: React.ReactNode; id?: string; }) {
  return (
    <section id={id} style={{ background: 'var(--cream-card)', borderRadius: 20, border: '1px solid var(--cream-border)', overflow: 'hidden', animation: 'fadeSlideIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--cream-border)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--cream-text)', letterSpacing: '-0.01em' }}>{title}</h2>
          {description && <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--cream-muted)', lineHeight: 1.5 }}>{description}</p>}
        </div>
        {pill && <Pill label={pill} variant={pillVariant} />}
      </div>
      <div style={{ padding: '20px 22px' }}>{children}</div>
    </section>
  );
}

function InnerCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--cream-inner)', borderRadius: 14, border: '1px solid var(--cream-border)', padding: '14px 16px' }}>
      {children}
    </div>
  );
}

function OutlineButton({ onClick, disabled, loading, loadingText, children, danger, id }: {
  onClick?: () => void; disabled?: boolean; loading?: boolean; loadingText?: string;
  children: React.ReactNode; danger?: boolean; id?: string;
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled || loading}
      className="sec-btn-outline"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10,
        border: `1px solid ${danger ? 'rgba(180,40,40,0.25)' : 'var(--cream-border-strong)'}`,
        background: danger ? 'var(--pill-red-bg)' : 'var(--cream-card)',
        color: danger ? 'var(--pill-red-text)' : 'var(--cream-text)',
        fontSize: 13, fontWeight: 500, cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? 0.5 : 1, whiteSpace: 'nowrap', transition: 'opacity 0.15s', fontFamily: 'inherit',
      }}
    >
      {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

function PrimaryButton({ onClick, disabled, loading, loadingText, children, id }: {
  onClick?: () => void; disabled?: boolean; loading?: boolean; loadingText?: string;
  children: React.ReactNode; id?: string;
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        width: '100%', padding: '10px 16px', borderRadius: 12, border: 'none',
        background: 'var(--cream-text)', color: 'var(--cream-card)', fontSize: 14, fontWeight: 500,
        cursor: disabled || loading ? 'not-allowed' : 'pointer', opacity: disabled || loading ? 0.45 : 1,
        transition: 'opacity 0.15s', fontFamily: 'inherit', letterSpacing: '-0.01em',
      }}
    >
      {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

function StatusBanner({ variant, icon: Icon, children }: {
  variant: 'info' | 'warning' | 'success' | 'error'; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  children: React.ReactNode;
}) {
  const map = {
    info:    { bg: 'var(--pill-blue-bg)',  border: 'var(--pill-blue-text)',  text: 'var(--pill-blue-text)'  },
    warning: { bg: 'var(--pill-amber-bg)', border: 'var(--pill-amber-text)', text: 'var(--pill-amber-text)' },
    success: { bg: 'var(--pill-green-bg)', border: 'var(--pill-green-text)', text: 'var(--pill-green-text)' },
    error:   { bg: 'var(--pill-red-bg)',   border: 'var(--pill-red-text)',   text: 'var(--pill-red-text)'   },
  };
  const s = map[variant];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, background: s.bg, border: `1px solid ${s.border}22` }}>
      <Icon size={14} style={{ color: s.text, marginTop: 1, flexShrink: 0 }} />
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: s.text }}>{children}</p>
    </div>
  );
}

function PasswordInput({ label, value, onChange, disabled, placeholder, show, onToggle }: {
  label: string; value: string; onChange: (v: string) => void;
  disabled: boolean; placeholder: string; show: boolean; onToggle: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--cream-muted)' }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
          disabled={disabled} placeholder={placeholder}
          style={{ width: '100%', boxSizing: 'border-box', height: 40, borderRadius: 10, border: '1px solid var(--cream-border-strong)', background: 'var(--cream-inner)', color: 'var(--cream-text)', fontSize: 13, padding: '0 38px 0 12px', outline: 'none', fontFamily: 'inherit' }}
        />
        <button type="button" onClick={onToggle} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--cream-faint)', display: 'flex', alignItems: 'center' }}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function StrengthBar({ password }: { password: string }) {
  const score = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  if (!password) return null;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const barColors = ['', 'var(--pill-red-text)', 'var(--pill-amber-text)', 'var(--pill-blue-text)', 'var(--pill-green-text)'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ height: 3, flex: 1, borderRadius: 99, background: i <= score ? barColors[score] : 'var(--cream-border-strong)', transition: 'background 0.2s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--cream-faint)' }}>Password strength</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: barColors[score] }}>{labels[score]}</span>
      </div>
    </div>
  );
}

/* ─── Security Score Card ─────────────────────────────────────────────── */
function SecurityScoreCard({ score, checks }: {
  score: number;
  checks: { label: string; done: boolean; hint?: string; action?: () => void; actionLabel?: string }[];
}) {
  const isPerfect = score >= 100;

  return (
    <section id="sec-score" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--cream-text)', letterSpacing: '-0.01em' }}>
            Account protection
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--cream-muted)' }}>
            {isPerfect ? 'Your account is well protected.' : 'Complete these steps to fully secure your account.'}
          </p>
        </div>
      </div>

      <div style={{
        width: '100%', height: 3, borderRadius: 99, background: 'var(--cream-border)', overflow: 'hidden', marginBottom: 20
      }}>
        <div style={{
          height: '100%', width: `${score}%`,
          background: score >= 80 ? 'var(--pill-green-text)' : score >= 50 ? 'var(--pill-amber-text)' : 'var(--pill-red-text)',
          transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)'
        }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {checks.map((c, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: c.done ? '12px 14px' : '14px',
              borderRadius: 14,
              border: c.done ? '1px solid transparent' : '1px dashed var(--cream-border-strong)',
              background: c.done ? 'transparent' : 'var(--cream-card)',
            }}
          >
            <div style={{ color: c.done ? 'var(--pill-green-text)' : 'var(--cream-faint)', marginTop: 2 }}>
              {c.done ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            </div>
            <div>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: c.done ? 'var(--cream-muted)' : 'var(--cream-text)', marginBottom: 2 }}>
                {c.label}
              </span>
              {c.hint && !c.done && (
                <span style={{ display: 'block', fontSize: 12, color: 'var(--cream-muted)', marginBottom: 8, lineHeight: 1.4 }}>{c.hint}</span>
              )}
              {!c.done && c.action && (
                <button
                  onClick={c.action}
                  style={{
                    padding: 0, border: 'none', background: 'transparent',
                    fontSize: 12, fontWeight: 500, color: 'var(--cream-text)',
                    textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit'
                  }}
                >
                  {c.actionLabel ?? 'Set up'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Password Modal Content ──────────────────────────────────────────── */
function PasswordModalContent({
  migrationNeeded, isMigrated, isOAuthUser, vaultPasswordSet,
  encryptionSalt, encryptedMasterKey, masterKeyIV, keyVersion = 1,
  userId, onPasswordChanged, onPasswordSet, onClose,
}: PasswordChangeSectionProps & { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isSetPasswordMode = isOAuthUser && !vaultPasswordSet;

  const handleMigration = async () => {
    if (!currentPassword) { setMessage({ type: 'error', text: 'Enter your current password' }); return; }
    setLoading(true); setMessage(null);
    try {
      const res = await fetch('/api/user/migrate-encryption', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: currentPassword }) });
      const data = await res.json();
      if (res.ok) { setMessage({ type: 'success', text: data.message || 'Security upgrade complete!' }); setCurrentPassword(''); }
      else setMessage({ type: 'error', text: data.error || 'Security upgrade failed' });
    } catch { setMessage({ type: 'error', text: 'Security upgrade failed. Try again.' }); }
    finally { setLoading(false); }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) { setMessage({ type: 'error', text: 'All fields are required' }); return; }
    if (newPassword !== confirmPassword) { setMessage({ type: 'error', text: 'New passwords do not match' }); return; }
    if (newPassword.length < 8) { setMessage({ type: 'error', text: 'Password must be at least 8 characters' }); return; }
    setLoading(true); setMessage(null);
    try {
      const { getDeviceId } = await import('@/utils/encryption/keyManager');
      const deviceId = await getDeviceId();

      const res = await fetch('/api/user/change-password', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ currentPassword, newPassword, deviceId }) 
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message || 'Password changed!' });
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        onPasswordChanged?.();
        setTimeout(onClose, 1400);
      } else setMessage({ type: 'error', text: data.error || 'Failed to change password' });
    } catch { setMessage({ type: 'error', text: 'Failed to change password. Try again.' }); }
    finally { setLoading(false); }
  };

  const handleSetPassword = async () => {
    if (!newPassword || !confirmPassword) { setMessage({ type: 'error', text: 'All fields are required' }); return; }
    if (newPassword !== confirmPassword) { setMessage({ type: 'error', text: 'Passwords do not match' }); return; }
    if (newPassword.length < 8) { setMessage({ type: 'error', text: 'Password must be at least 8 characters' }); return; }
    if (!userId || !encryptionSalt || !encryptedMasterKey || !masterKeyIV) { setMessage({ type: 'error', text: 'Encryption data not loaded. Refresh and try again.' }); return; }
    setLoading(true); setMessage(null);
    try {
      const { setPasswordAndUpgradeKey } = await import('@/utils/encryption/keyManager');
      await setPasswordAndUpgradeKey(userId, newPassword, encryptionSalt, encryptedMasterKey, masterKeyIV, keyVersion);
      fetch('/api/security/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'password_set', email: '' }) }).catch(() => {});
      setMessage({ type: 'success', text: 'Password set. Your account encryption has been upgraded.' });
      setNewPassword(''); setConfirmPassword('');
      onPasswordSet?.();
      setTimeout(onClose, 1400);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to set password. Try again.' });
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Guidance banners */}
      {isSetPasswordMode && (
        <StatusBanner variant="info" icon={Shield}>
          <strong>Signed in with Google.</strong> Setting a force password enables email login and account recovery.
        </StatusBanner>
      )}
      {!isSetPasswordMode && migrationNeeded && (
        <StatusBanner variant="warning" icon={AlertTriangle}>
          <strong>Security upgrade needed.</strong> Run the upgrade before changing your password.
        </StatusBanner>
      )}
      {!isSetPasswordMode && isMigrated && !migrationNeeded && (
        <StatusBanner variant="success" icon={CheckCircle2}>
          <strong>Security upgrade active.</strong> Password changes are safe to make.
        </StatusBanner>
      )}
      {message && (
        <StatusBanner variant={message.type === 'error' ? 'error' : 'success'} icon={message.type === 'error' ? AlertCircle : CheckCircle2}>
          {message.text}
        </StatusBanner>
      )}

      {/* Fields */}
      {isSetPasswordMode ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PasswordInput label="New password" value={newPassword} onChange={setNewPassword} disabled={loading} placeholder="Min 8 characters" show={showNew} onToggle={() => setShowNew(v => !v)} />
          <PasswordInput label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} disabled={loading} placeholder="Repeat password" show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
          <StrengthBar password={newPassword} />
          {confirmPassword && newPassword && (
            <p style={{ margin: 0, fontSize: 12, color: confirmPassword === newPassword ? 'var(--pill-green-text)' : 'var(--pill-red-text)' }}>
              {confirmPassword === newPassword ? '✓ Passwords match' : 'Passwords do not match'}
            </p>
          )}
          <PrimaryButton id="sec-set-password-btn" onClick={handleSetPassword} disabled={!newPassword || !confirmPassword} loading={loading} loadingText="Setting password…">
            <Lock size={14} /> Set password
          </PrimaryButton>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--cream-faint)' }}>Your journals stay encrypted — only the lock changes.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PasswordInput label="Current password" value={currentPassword} onChange={setCurrentPassword} disabled={loading} placeholder="Enter current password" show={showCurrent} onToggle={() => setShowCurrent(v => !v)} />
          {!migrationNeeded && (
            <>
              <PasswordInput label="New password" value={newPassword} onChange={setNewPassword} disabled={loading} placeholder="Min 8 characters" show={showNew} onToggle={() => setShowNew(v => !v)} />
              <PasswordInput label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} disabled={loading} placeholder="Repeat password" show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
              <StrengthBar password={newPassword} />
              {confirmPassword && newPassword && (
                <p style={{ margin: 0, fontSize: 12, color: confirmPassword === newPassword ? 'var(--pill-green-text)' : 'var(--pill-red-text)' }}>
                  {confirmPassword === newPassword ? '✓ Passwords match' : 'Passwords do not match'}
                </p>
              )}
            </>
          )}
          {migrationNeeded ? (
            <PrimaryButton id="sec-migrate-btn" onClick={handleMigration} disabled={!currentPassword} loading={loading} loadingText="Upgrading…">Run security upgrade</PrimaryButton>
          ) : (
            <PrimaryButton id="sec-change-password-btn" onClick={handlePasswordChange} disabled={!currentPassword || !newPassword || !confirmPassword} loading={loading} loadingText="Updating…">Change password</PrimaryButton>
          )}
          {!isOAuthUser && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--cream-faint)' }}>
              <Link href="/forgot-password" style={{ color: 'var(--cream-muted)' }}>Forgot your password?</Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── TOTP Setup Modal Content ────────────────────────────────────────── */
function TotpSetupModalContent({ onEnabled, onClose, onToastShow }: {
  onEnabled: (verifiedAt: string) => void;
  onClose: () => void;
  onToastShow: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [wizardStep, setWizardStep] = useState<'qr' | 'verify' | 'done'>('qr');
  const [setupData, setSetupData] = useState<{ secret: string; qrDataUrl: string; accountName: string } | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const loadQR = useCallback(async () => {
    setSetupLoading(true);
    try {
      const res = await fetch('/api/encryption/totp/setup', { cache: 'no-store' });
      if (!res.ok) { const d = await res.json(); onToastShow(d.error ?? 'Failed to load QR code', 'error'); onClose(); return; }
      const d = await res.json();
      setSetupData({ secret: d.secret, qrDataUrl: d.qrDataUrl, accountName: d.accountName });
    } catch { onToastShow('Failed to load QR code', 'error'); onClose(); }
    finally { setSetupLoading(false); }
  }, [onClose, onToastShow]);

  useEffect(() => { loadQR(); }, [loadQR]);

  const handleVerify = async () => {
    const code = verifyCode.replace(/\D/g, '').trim();
    if (code.length !== 6) { setVerifyError('Enter the 6-digit code from your app'); return; }
    setVerifyLoading(true); setVerifyError(null);
    try {
      const res = await fetch('/api/encryption/totp/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const d = await res.json();
      if (!res.ok) { setVerifyError(d.error ?? 'Invalid code. Try again.'); return; }
      setWizardStep('done');
      onEnabled(new Date().toISOString());
      onToastShow('Authenticator app enabled ✅', 'success');
    } catch { setVerifyError('Verification failed. Please try again.'); }
    finally { setVerifyLoading(false); }
  };

  const steps = ['Scan', 'Verify', 'Done'];
  const currentStep = wizardStep === 'qr' ? 0 : wizardStep === 'verify' ? 1 : 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Step indicators */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {steps.map((label, i) => (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: i < currentStep ? 'var(--pill-green-bg)' : i === currentStep ? 'var(--cream-text)' : 'var(--cream-inner)',
                color: i < currentStep ? 'var(--pill-green-text)' : i === currentStep ? 'var(--cream-card)' : 'var(--cream-faint)',
                border: `1.5px solid ${i < currentStep ? 'var(--pill-green-text)' : i === currentStep ? 'var(--cream-text)' : 'var(--cream-border-strong)'}`,
                transition: 'all 0.2s',
              }}>
                {i < currentStep ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 12, fontWeight: i === currentStep ? 600 : 400, color: i === currentStep ? 'var(--cream-text)' : 'var(--cream-faint)' }}>{label}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: 'var(--cream-border-strong)', margin: '0 8px' }} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: QR */}
      {wizardStep === 'qr' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {setupLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0', color: 'var(--cream-faint)', gap: 8 }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Generating QR code…
            </div>
          ) : setupData ? (
            <>
              <StatusBanner variant="info" icon={Shield}>
                <strong>Scan this QR code</strong> with Google Authenticator, Authy, 1Password, or any TOTP app.{' '}
                Can&apos;t scan? Enter the secret manually: <code style={{ fontSize: 11, letterSpacing: '0.08em', background: 'rgba(0,0,0,0.06)', borderRadius: 4, padding: '1px 5px', wordBreak: 'break-all' }}>{setupData.secret}</code>
              </StatusBanner>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <img src={setupData.qrDataUrl} alt="TOTP QR code" style={{ width: 200, height: 200, borderRadius: 14, border: '1px solid var(--cream-border-strong)', background: '#fff' }} />
              </div>

              <div style={{ background: 'var(--cream-inner)', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: 'var(--cream-muted)', lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--cream-text)' }}>Instructions</strong><br />
                1. Open your authenticator app<br />
                2. Tap <strong>+</strong> → <strong>Scan QR code</strong><br />
                3. Point the camera at the code above<br />
                4. <strong>FORCE</strong> should appear in your app — click Next
              </div>

              <PrimaryButton id="sec-totp-next-btn" onClick={() => { setWizardStep('verify'); setVerifyCode(''); setVerifyError(null); }}>
                <Smartphone size={14} /> Next — Enter code to verify
              </PrimaryButton>
            </>
          ) : null}
        </div>
      )}

      {/* Step 2: Verify */}
      {wizardStep === 'verify' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--cream-muted)', lineHeight: 1.6 }}>
            Open your authenticator app and enter the 6-digit code shown for <strong style={{ color: 'var(--cream-text)' }}>FORCE</strong>.
          </p>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--cream-muted)', display: 'block', marginBottom: 7 }}>6-digit code</label>
            <input
              id="sec-totp-code-input"
              type="text" inputMode="numeric" value={verifyCode}
              onChange={e => { setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setVerifyError(null); }}
              maxLength={6} placeholder="000 000" autoFocus
              style={{ width: '100%', boxSizing: 'border-box', height: 52, borderRadius: 12, border: `1px solid ${verifyError ? 'var(--pill-red-text)' : 'var(--cream-border-strong)'}`, background: 'var(--cream-inner)', color: 'var(--cream-text)', fontSize: 26, fontFamily: 'monospace', letterSpacing: '0.4em', textAlign: 'center', padding: '0 12px', outline: 'none', fontWeight: 700, transition: 'border-color 0.15s' }}
            />
          </div>
          {verifyError && <StatusBanner variant="error" icon={AlertCircle}>{verifyError}</StatusBanner>}
          <div style={{ display: 'flex', gap: 10 }}>
            <OutlineButton id="sec-totp-back-btn" onClick={() => setWizardStep('qr')}>← Back</OutlineButton>
            <div style={{ flex: 1 }}>
              <PrimaryButton id="sec-totp-verify-btn" onClick={handleVerify} disabled={verifyCode.length !== 6} loading={verifyLoading} loadingText="Verifying…">
                <CheckCircle2 size={14} /> Verify &amp; enable
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {wizardStep === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <StatusBanner variant="success" icon={CheckCircle2}>
            <strong>Authenticator app enabled!</strong> You can now use TOTP codes to verify new devices.
          </StatusBanner>
          <StatusBanner variant="info" icon={Shield}>
            <strong>Keep your recovery codes handy.</strong> If you lose your phone, recovery codes are the only way back in.
          </StatusBanner>
          <PrimaryButton id="sec-totp-done-btn" onClick={onClose}>
            Done
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}

/* ─── TOTP Remove Modal Content ──────────────────────────────────────── */
function TotpRemoveModalContent({ onRemoved, onClose, onToastShow }: {
  onRemoved: () => void;
  onClose: () => void;
  onToastShow: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    if (!code.trim()) { setError('Enter your current TOTP code'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/encryption/totp/setup', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.trim(), type: 'totp' }) });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? 'Invalid code. Try again.'); return; }
      onRemoved();
      onToastShow('Authenticator app removed', 'info');
      onClose();
    } catch { setError('Failed to remove. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <StatusBanner variant="warning" icon={AlertTriangle}>
        <strong>This will disable 2FA on your account.</strong> New device logins will only require your password.
      </StatusBanner>
      <div>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--cream-muted)', display: 'block', marginBottom: 7 }}>Enter current 6-digit TOTP code to confirm</label>
        <input
          id="sec-totp-remove-input"
          type="text" inputMode="numeric" value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
          maxLength={6} placeholder="000 000" autoFocus
          style={{ width: '100%', boxSizing: 'border-box', height: 48, borderRadius: 12, border: `1px solid ${error ? 'var(--pill-red-text)' : 'var(--cream-border-strong)'}`, background: 'var(--cream-inner)', color: 'var(--cream-text)', fontSize: 24, fontFamily: 'monospace', letterSpacing: '0.4em', textAlign: 'center', padding: '0 12px', outline: 'none', fontWeight: 700, transition: 'border-color 0.15s' }}
        />
      </div>
      {error && <StatusBanner variant="error" icon={AlertCircle}>{error}</StatusBanner>}
      <div style={{ display: 'flex', gap: 10 }}>
        <OutlineButton id="sec-totp-remove-cancel" onClick={onClose}>Cancel</OutlineButton>
        <button
          id="sec-totp-remove-confirm"
          onClick={handle}
          disabled={code.length !== 6 || loading}
          style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(180,40,40,0.25)', background: code.length === 6 && !loading ? 'var(--fill-danger)' : 'var(--pill-red-bg)', color: code.length === 6 && !loading ? '#fff' : 'var(--pill-red-text)', fontSize: 13, fontWeight: 500, cursor: code.length !== 6 || loading ? 'not-allowed' : 'pointer', opacity: code.length !== 6 || loading ? 0.65 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}
        >
          {loading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
          {loading ? 'Removing…' : 'Remove 2FA'}
        </button>
      </div>
    </div>
  );
}

/* ─── Device Row ──────────────────────────────────────────────────────── */
function DeviceRow({ session, isCurrent, onRevoke, revoking, duplicateCount }: {
  session: DeviceSession; isCurrent: boolean; onRevoke: () => void; revoking: boolean; duplicateCount?: number;
}) {
  const label = session.device_name || `${session.browser || 'Browser'} on ${session.os || 'Unknown OS'}`;
  const DeviceIcon = isPhone(session.os) ? Smartphone : Monitor;
  const locationStr = [session.city, session.country].filter(Boolean).join(', ') || session.location || null;
  const ip = session.ip_address;
  const showIp = ip && ip !== '0.0.0.0' && ip !== '::1' && ip !== '127.0.0.1';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: '1px solid var(--cream-border)' }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'var(--cream-card)', border: '1px solid var(--cream-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-muted)' }}>
        <DeviceIcon size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cream-text)', letterSpacing: '-0.01em' }}>{label}</span>
          {isCurrent && <Pill label="This device" variant="blue" />}
          {!isCurrent && session.last_activity && <Pill label={timeAgo(session.last_activity)} variant="gray" />}
          {duplicateCount && duplicateCount > 1 && <Pill label={`${duplicateCount} sessions`} variant="amber" />}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 14px', marginTop: 4, alignItems: 'center' }}>
          {session.browser && <span style={{ fontSize: 12, color: 'var(--cream-faint)' }}>{session.browser}</span>}
          {locationStr ? (
            <span style={{ fontSize: 12, color: 'var(--cream-faint)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Globe size={11} />{locationStr}</span>
          ) : showIp ? (
            <span style={{ fontSize: 12, color: 'var(--cream-faint)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Globe size={11} />{ip}</span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--cream-faint)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Globe size={11} />Local network</span>
          )}
        </div>
      </div>
      <OutlineButton onClick={onRevoke} loading={revoking} loadingText="Removing…" danger>
        {isCurrent ? 'Sign out' : 'Revoke'}
      </OutlineButton>
    </div>
  );
}

/* ─── Advanced / Danger Zone Accordion ───────────────────────────────── */
function AdvancedSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [showInner, setShowInner] = useState(false);

  return (
    <div id="sec-advanced">
      {/* Toggle button */}
      <button
        id="sec-advanced-toggle"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderRadius: 16, border: '1px solid var(--cream-border)',
          background: 'var(--cream-card)', cursor: 'pointer', fontFamily: 'inherit',
          color: 'var(--cream-muted)', fontSize: 14, fontWeight: 500, transition: 'background 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={16} style={{ color: 'var(--cream-faint)' }} />
          Advanced settings
        </div>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {open && (
        <div style={{ marginTop: 10, animation: 'fadeSlideIn 0.2s ease' }}>
          {/* Warning banner — first layer */}
          <div style={{ marginBottom: 12 }}>
            <StatusBanner variant="error" icon={AlertTriangle}>
              <strong>Danger zone.</strong> The actions below are <strong>permanent and cannot be undone.</strong> Proceed only if you are absolutely sure.
            </StatusBanner>
          </div>

          <div style={{ background: 'var(--cream-card)', borderRadius: 18, border: '2px solid var(--border-danger)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-danger)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-danger)' }}>Delete account</h3>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--cream-muted)' }}>
                  Permanently delete your FORCE account and all journal data.
                </p>
              </div>
              <button
                id="sec-delete-account-reveal"
                onClick={() => setShowInner(v => !v)}
                style={{
                  border: '1px solid var(--border-danger)', background: 'var(--pill-red-bg)', color: 'var(--text-danger)',
                  padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <ShieldOff size={13} />
                {showInner ? 'Cancel' : 'Continue'}
              </button>
            </div>

            {/* Second layer — confirm intent */}
            {showInner && (
              <div style={{ padding: '16px 20px', animation: 'fadeSlideIn 0.2s ease' }}>
                <StatusBanner variant="warning" icon={AlertTriangle}>
                  <strong>What gets deleted:</strong> your account, all journals, entries, settings, and encryption keys.
                  This <strong>cannot be reversed</strong>. Your data cannot be recovered by FORCE support.
                </StatusBanner>
                <div style={{ marginTop: 14 }}>
                  {children /* DeleteAccountComponent — 3rd + final confirmation layer */}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Toast ───────────────────────────────────────────────────────────── */
function Toast({ toast, onDismiss }: { toast: { type: 'success' | 'error' | 'info'; message: string } | null; onDismiss: () => void }) {
  if (!toast) return null;
  const pillVariant: PillVariant = toast.type === 'success' ? 'green' : toast.type === 'error' ? 'red' : 'blue';
  return (
    <div style={{ position: 'fixed', right: 20, top: 80, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--cream-card)', border: '1px solid var(--cream-border-strong)', borderRadius: 12, padding: '10px 14px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', maxWidth: 320, animation: 'fadeSlideIn 0.2s ease' }}>
      <Pill label={toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : 'i'} variant={pillVariant} />
      <span style={{ fontSize: 13, color: 'var(--cream-text)', flex: 1 }}>{toast.message}</span>
      <button onClick={onDismiss} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--cream-faint)', display: 'flex', alignItems: 'center' }}><X size={14} /></button>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────── */
export default function SecurityPage() {
  const router = useRouter();
  const { isDarkMode } = useTheme();

  /* Core state */
  const [isMigrated, setIsMigrated] = useState<boolean | null>(null);
  const [lastPasswordChangedAt, setLastPasswordChangedAt] = useState<string | null>(null);
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  /* Revoke dialog */
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<DeviceSession | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [isSelfRevokeTarget, setIsSelfRevokeTarget] = useState(false);

  /* Recovery codes */
  const [codesRemaining, setCodesRemaining] = useState<number | null>(null);
  const [codesSetAt, setCodesSetAt] = useState<string | null>(null);
  const [newlyCodes, setNewlyCodes] = useState<string[] | null>(null);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesError, setCodesError] = useState<string | null>(null);
  const [showCodesRemoveModal, setShowCodesRemoveModal] = useState(false);
  const [codesRemoving, setCodesRemoving] = useState(false);
  const [codesRemoveError, setCodesRemoveError] = useState<string | null>(null);

  /* OAuth + encryption data */
  const [isOAuthUser, setIsOAuthUser] = useState(false);
  const [vaultPasswordSet, setVaultPasswordSet] = useState(false);
  const [encryptionData, setEncryptionData] = useState<{ salt: string | null; encryptedMasterKey: string | null; masterKeyIV: string | null; keyVersion: number; userId: string | null; }>({ salt: null, encryptedMasterKey: null, masterKeyIV: null, keyVersion: 1, userId: null });

  /* TOTP status (hoisted so score card can see it) */
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [totpVerifiedAt, setTotpVerifiedAt] = useState<string | null>(null);
  const [loadingTotp, setLoadingTotp] = useState(true);

  /* Collaboration key status */
  const [collabKeyStatus, setCollabKeyStatus] = useState<'checking' | 'found' | 'missing'>('checking');
  const [collabKeyVersion, setCollabKeyVersion] = useState<number | null>(null);
  const [resettingCollabKey, setResettingCollabKey] = useState(false);
  const [collabKeyError, setCollabKeyError] = useState<string | null>(null);

  /* Modal open states */
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showTotpSetupModal, setShowTotpSetupModal] = useState(false);
  const [showTotpRemoveModal, setShowTotpRemoveModal] = useState(false);
  const [showCodesConfirm, setShowCodesConfirm] = useState(false);

  /* Sign-out overlay — shown when password change triggers a session reset */
  const [signOutOverlay, setSignOutOverlay] = useState(false);

  const [, setEncryptionReady_unused] = useState(false);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ type, message });
    toastRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  /* Fetch TOTP status */
  const loadTotp = useCallback(async () => {
    setLoadingTotp(true);
    try {
      const res = await fetch('/api/encryption/totp/setup', { cache: 'no-store' });
      if (res.status === 409) {
        setTotpEnabled(true); setTotpVerifiedAt(null);
      } else if (res.ok) {
        const d = await res.json();
        if (d.enabled === true) { setTotpEnabled(true); setTotpVerifiedAt(d.verifiedAt ?? null); }
        else { setTotpEnabled(false); setTotpVerifiedAt(null); }
      } else { setTotpEnabled(false); }
    } catch { setTotpEnabled(false); }
    finally { setLoadingTotp(false); }
  }, []);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setRefreshing(true);
    setError(null);
    setEncryptionReady_unused(isEncryptionInitialized());
    try {
      const supabase = createClient();
      const [{ data: sessionData }, migRes, devRes, settRes, recoveryRes, saltRes, userRes] = await Promise.all([
        supabase.auth.getSession(),
        fetch('/api/user/migrate-encryption', { cache: 'no-store' }),
        fetch('/api/user/devices', { cache: 'no-store' }),
        fetch('/api/user/settings', { cache: 'no-store' }),
        fetch('/api/encryption/recovery-codes', { cache: 'no-store' }),
        fetch('/api/encryption/salt', { cache: 'no-store' }),
        fetch('/api/user/current', { cache: 'no-store' }),
      ]);
      const payload = sessionData.session?.access_token ? decodeJwtPayload(sessionData.session.access_token) : null;
      setCurrentSessionId(payload?.session_id ?? null);
      if (migRes.ok) { const d = await migRes.json(); setIsMigrated(Boolean(d.isMigrated)); }
      if (settRes.ok) { const d = await settRes.json(); setLastPasswordChangedAt(d?.settings?.last_password_changed_at ?? null); }
      if (recoveryRes.ok) { const r = await recoveryRes.json(); setCodesRemaining(r.remaining ?? 0); setCodesSetAt(r.set_at ?? null); }
      if (saltRes.ok) {
        const s = await saltRes.json();
        setIsOAuthUser(Boolean(s.is_oauth_user));
        setVaultPasswordSet(Boolean(s.vault_password_set));
        if (userRes.ok) {
          const u = await userRes.json();
          const uid: string | null = u.user?.id ?? null;
          setEncryptionData({ salt: s.salt, encryptedMasterKey: s.encrypted_master_key, masterKeyIV: s.master_key_iv, keyVersion: s.key_version ?? 1, userId: uid });
          // Check collab key status in IDB + server
          if (uid) {
            hasCollabPrivateKey(uid)
              .then(found => setCollabKeyStatus(found ? 'found' : 'missing'))
              .catch(() => setCollabKeyStatus('missing'));
            fetch(`/api/user/public-key?userId=${uid}`, { cache: 'no-store' })
              .then(r => r.ok ? r.json() : null)
              .then(d => { if (d?.key_version) setCollabKeyVersion(d.key_version); })
              .catch(() => {});
          }
        }
      }
      if (devRes.ok) {
        const d = await devRes.json();
        setDevices(Array.isArray(d.devices) ? d.devices : []);
      } else {
        setDevices([]);
        fetch('/api/user/devices/register', { method: 'POST', cache: 'no-store' }).catch(() => {});
      }
      if (!opts?.silent) showToast('Refreshed', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load security data';
      setError(msg);
      if (!opts?.silent) showToast(msg, 'error');
    } finally {
      setLoadingDevices(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetch('/api/user/devices/register', { method: 'POST', cache: 'no-store' })
      .catch(() => {})
      .finally(() => { loadData({ silent: true }); loadTotp(); });
    return () => { if (toastRef.current) clearTimeout(toastRef.current); };
  }, [loadData, loadTotp]);

  const getDeviceLabel = (s: DeviceSession) => s.device_name || `${s.browser || 'Browser'} on ${s.os || 'Unknown OS'}`;

  const handleRevokeRequest = (session: DeviceSession, isCurrent: boolean) => {
    setRevokeTarget(session); setIsSelfRevokeTarget(isCurrent); setRevokeError(null); setShowRevokeDialog(true);
  };

  const handleRevokeConfirm = async () => {
    if (!revokeTarget) return;
    setActionLoading(revokeTarget.id); setRevokeError(null);
    try {
      const r = await fetch(`/api/user/devices/${revokeTarget.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Failed');
      if (isSelfRevokeTarget) {
        showToast('Signing out…', 'info');
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }
      await loadData({ silent: true });
      showToast('Device removed', 'success');
      setShowRevokeDialog(false); setRevokeTarget(null);
    } catch {
      setRevokeError('Failed to remove device');
      showToast('Failed to remove device', 'error');
    } finally { setActionLoading(null); }
  };

  const handleGenerateCodes = async () => {
    setCodesLoading(true); setCodesError(null);
    try {
      const codes = await generateAndSaveRecoveryCodes();
      if (!codes.length) throw new Error('Code generation failed');
      setNewlyCodes(codes); setCodesRemaining(8); setCodesSetAt(new Date().toISOString());
      setShowCodesConfirm(false);
      showToast('Recovery codes generated', 'success');
    } catch (e) {
      setCodesError(e instanceof Error ? e.message : 'Failed to generate codes');
    } finally { setCodesLoading(false); }
  };

  const handleRemoveCodes = async () => {
    setCodesRemoving(true);
    setCodesRemoveError(null);
    try {
      const res = await fetch('/api/encryption/recovery-codes', { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed to remove recovery codes');
      }
      setCodesRemaining(0);
      setCodesSetAt(null);
      setShowCodesRemoveModal(false);
      showToast('Recovery codes removed', 'info');
      await loadData({ silent: true });
    } catch (e) {
      setCodesRemoveError(e instanceof Error ? e.message : 'Failed to remove codes');
    } finally {
      setCodesRemoving(false);
    }
  };

  /* Reset collaboration key — generates new RSA pair, uploads pub key, clears server shared keys */
  const handleResetCollabKey = async () => {
    const uid = encryptionData.userId;
    if (!uid) return;
    const confirmed = window.confirm(
      'This will revoke your access to all collaborative journals until each owner re-invites you. Continue?'
    );
    if (!confirmed) return;
    setResettingCollabKey(true);
    setCollabKeyError(null);
    try {
      // 1. Generate new RSA-4096 pair (~500ms)
      const pair = await generateCollabKeyPair();
      // 2. Store new private key in IDB (overwrites old)
      await storeCollabPrivateKey(pair.privateKey, uid);
      // 3. Upload new public key — this increments key_version on server
      //    and sends collab_key_reset_needed notifications to affected journal owners
      const pubB64 = await exportPublicKey(pair.publicKey);
      const uploadRes = await fetch('/api/user/public-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_key: pubB64 }),
      });
      if (!uploadRes.ok) throw new Error('Failed to upload new public key');
      // 4. Clear all stale journal_shared_keys rows on the server
      const resetRes = await fetch('/api/user/reset-collab-key', { method: 'POST' });
      if (!resetRes.ok) throw new Error('Failed to clear stale shared keys');
      // 5. Refresh local UI state
      const versionData = await uploadRes.json();
      setCollabKeyVersion(versionData.key_version ?? null);
      setCollabKeyStatus('found');
      showToast('Collaboration key reset. Journal owners have been notified.', 'success');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Reset failed';
      setCollabKeyError(msg);
      showToast(msg, 'error');
    } finally {
      setResettingCollabKey(false);
    }
  };

  const migrationNeeded = isMigrated === false;

  /* Security score computation */
  const passwordScore = isOAuthUser ? (vaultPasswordSet ? 1 : 0) : 1;
  const recoveryScore = (codesRemaining !== null && codesRemaining > 0) ? 1 : 0;
  const totpScore = totpEnabled === true ? 1 : 0;
  const score = isMigrated === null ? 0 : Math.round((passwordScore + recoveryScore + totpScore) / 3 * 100);

  /* Deduplication for devices */
  const seen = new Map<string, { session: DeviceSession; count: number }>();
  for (const d of devices) {
    const key = d.user_agent || d.browser || d.id;
    if (!seen.has(key)) { seen.set(key, { session: d, count: 1 }); }
    else { seen.get(key)!.count++; }
  }
  const dedupedDevices = Array.from(seen.values());

  const isCodesSetUp = codesRemaining !== null && codesRemaining > 0;
  const isCodesLow = isCodesSetUp && codesRemaining! <= 2;

  return (
    <>
      <style>{PAGE_STYLES}</style>

      {/* ── Sign-out overlay ── */}
      {signOutOverlay && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99998,
            background: isDarkMode ? 'rgba(20,20,18,0.92)' : 'rgba(240,237,228,0.92)',
            backdropFilter: 'blur(12px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20,
            animation: 'fadeSlideIn 0.25s ease',
          }}
        >
          {/* Spinner */}
          <div style={{ position: 'relative', width: 52, height: 52 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid var(--cream-border-strong)' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid transparent', borderTopColor: 'var(--cream-text)', animation: 'spin 0.8s linear infinite' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--cream-text)', letterSpacing: '-0.01em' }}>Signing you out…</p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--cream-muted)' }}>Your password was updated. Redirecting to login.</p>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <SecurityModal
        open={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title={isOAuthUser && !vaultPasswordSet ? 'Set force password' : 'Change password'}
        subtitle="Your journals remain encrypted — only the lock changes."
      >
        <PasswordModalContent
          migrationNeeded={migrationNeeded}
          isMigrated={isMigrated === true}
          isOAuthUser={isOAuthUser}
          vaultPasswordSet={vaultPasswordSet}
          encryptionSalt={encryptionData.salt}
          encryptedMasterKey={encryptionData.encryptedMasterKey}
          masterKeyIV={encryptionData.masterKeyIV}
          keyVersion={encryptionData.keyVersion}
          userId={encryptionData.userId ?? undefined}
          onPasswordChanged={() => {
            setLastPasswordChangedAt(new Date().toISOString());
            showToast('Password updated — signing you out…', 'success');
            // Show the sign-out overlay immediately; Supabase will invalidate
            // the session and redirect to /login once the password API responds.
            setTimeout(() => setSignOutOverlay(true), 800);
            loadData({ silent: true });
          }}
          onPasswordSet={() => { setVaultPasswordSet(true); setLastPasswordChangedAt(new Date().toISOString()); showToast('Password set. Account secured.', 'success'); loadData({ silent: true }); }}
          onClose={() => setShowPasswordModal(false)}
        />
      </SecurityModal>

      <SecurityModal
        open={showTotpSetupModal}
        onClose={() => setShowTotpSetupModal(false)}
        title="Set up Authenticator App"
        subtitle="Link Google Authenticator, Authy, 1Password or any TOTP app."
        maxWidth={500}
      >
        <TotpSetupModalContent
          onEnabled={(verifiedAt) => { setTotpEnabled(true); setTotpVerifiedAt(verifiedAt); }}
          onClose={() => setShowTotpSetupModal(false)}
          onToastShow={showToast}
        />
      </SecurityModal>

      <SecurityModal
        open={showTotpRemoveModal}
        onClose={() => setShowTotpRemoveModal(false)}
        title="Remove Authenticator App"
        subtitle="Disabling 2FA reduces your account security."
        danger
      >
        <TotpRemoveModalContent
          onRemoved={() => { setTotpEnabled(false); setTotpVerifiedAt(null); }}
          onClose={() => setShowTotpRemoveModal(false)}
          onToastShow={showToast}
        />
      </SecurityModal>

      <SecurityModal
        open={showCodesConfirm}
        onClose={() => setShowCodesConfirm(false)}
        title={isCodesSetUp ? 'Regenerate recovery codes?' : 'Generate recovery codes'}
        subtitle={isCodesSetUp ? 'All existing codes will be permanently invalidated.' : 'You will receive 8 single-use backup codes.'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isCodesSetUp && (
            <StatusBanner variant="warning" icon={AlertTriangle}>
              <strong>Your old codes will stop working immediately.</strong> Download and save the new codes before closing.
            </StatusBanner>
          )}
          {!isCodesSetUp && (
            <StatusBanner variant="info" icon={Shield}>
              Recovery codes let you access your account if you lose your phone or forget your password. Store them offline in a safe place.
            </StatusBanner>
          )}
          {codesError && <StatusBanner variant="error" icon={AlertCircle}>{codesError}</StatusBanner>}
          <div style={{ display: 'flex', gap: 10 }}>
            <OutlineButton id="sec-codes-cancel" onClick={() => setShowCodesConfirm(false)}>Cancel</OutlineButton>
            <div style={{ flex: 1 }}>
              <PrimaryButton id="sec-codes-generate-confirm"  onClick={handleGenerateCodes} loading={codesLoading} loadingText="Generating…">
                <span style={{ color: 'var(--cream-page)' }}>{isCodesSetUp ? 'Regenerate codes' : 'Generate codes'}</span>
              </PrimaryButton>
            </div>
          </div>
        </div>
      </SecurityModal>

      <SecurityModal
        open={showCodesRemoveModal}
        onClose={() => setShowCodesRemoveModal(false)}
        title="Remove Recovery Codes"
        subtitle="This will permanently delete your backup recovery codes."
        danger
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <StatusBanner variant="warning" icon={AlertTriangle}>
            <strong>Disabling backup recovery codes reduces your account recovery options.</strong> If TOTP is also not enabled, 2-Step Verification will be turned off and you can sign in directly on any device without extra verification prompts.
          </StatusBanner>
          {codesRemoveError && <StatusBanner variant="error" icon={AlertCircle}>{codesRemoveError}</StatusBanner>}
          <div style={{ display: 'flex', gap: 10 }}>
            <OutlineButton id="sec-codes-remove-cancel" onClick={() => setShowCodesRemoveModal(false)}>Cancel</OutlineButton>
            <button
              id="sec-codes-remove-confirm"
              onClick={handleRemoveCodes}
              disabled={codesRemoving}
              style={{
                flex: 1, padding: '9px 14px', borderRadius: 10,
                border: '1px solid rgba(180,40,40,0.25)',
                background: 'var(--fill-danger)',
                color: '#fff', fontSize: 13, fontWeight: 500,
                cursor: codesRemoving ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'inherit',
              }}
            >
              {codesRemoving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
              {codesRemoving ? 'Removing…' : 'Remove codes'}
            </button>
          </div>
        </div>
      </SecurityModal>

      {/* ── Page shell ── */}
      <div
        data-theme={isDarkMode ? 'dark' : 'light'}
        className="pb-20"
        style={{ minHeight: '100vh', background: 'var(--cream-page)', fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}
      >
        <Toast toast={toast} onDismiss={() => setToast(null)} />

        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 24px' }}>
          <div className="sec-grid" style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 52, alignItems: 'start' }}>

            {/* ── Left sidebar ── */}
            <div className="sec-sidebar" style={{ position: 'sticky', top: 64 }}>
              <Link href="/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 500, color: 'var(--cream-muted)', textDecoration: 'none', marginBottom: 28 }}>
                <ChevronLeft size={14} /> Back to settings
              </Link>

              <h1 style={{ margin: 0, fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: 800, color: 'var(--cream-text)', letterSpacing: '-0.04em', lineHeight: 1.05 }}>
                Security
              </h1>
              <p style={{ marginTop: 14, marginBottom: 28, fontSize: 13, lineHeight: 1.7, color: 'var(--cream-muted)', maxWidth: 230 }}>
                Manage passwords, recovery options, two-factor auth, and trusted devices.
              </p>

              {/* Section nav */}
              <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 28 }}>
                {[
                  { href: '#sec-score', label: 'Overview', icon: ShieldCheck },
                  { href: '#sec-password', label: 'Password', icon: Lock },
                  { href: '#sec-recovery', label: 'Recovery codes', icon: KeyRound },
                  { href: '#sec-totp', label: 'Authenticator app', icon: Smartphone },
                  { href: '#sec-devices', label: 'Active devices', icon: Monitor },
                  { href: '#sec-advanced', label: 'Advanced', icon: ShieldAlert },
                ].map(({ href, label, icon: Icon }) => (
                  <a
                    key={href}
                    href={href}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 10px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'var(--cream-muted)', textDecoration: 'none', transition: 'background 0.12s, color 0.12s' }}
                    className="sec-btn-ghost"
                  >
                    <Icon size={14} style={{ flexShrink: 0 }} />
                    {label}
                  </a>
                ))}
              </nav>

              {/* Guide link */}
              <Link
                href="/security/guide"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 11, border: '1px solid var(--cream-border-strong)', background: 'var(--cream-card)', color: 'var(--cream-muted)', fontSize: 12, fontWeight: 500, textDecoration: 'none', marginBottom: 16 }}
              >
                <BookOpen size={13} /> Security guide
              </Link>

              <button
                onClick={() => loadData()}
                disabled={refreshing}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 11, border: '1px solid var(--cream-border-strong)', background: 'var(--cream-card)', color: 'var(--cream-muted)', fontSize: 12, fontWeight: 500, cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.6 : 1, fontFamily: 'inherit' }}
              >
                <RefreshCw size={13} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
                Refresh
              </button>
            </div>

            {/* ── Right column ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {error && <StatusBanner variant="error" icon={AlertCircle}>{error}</StatusBanner>}

              {/* ── Action Required Alert if 2-Step Verification is not enabled ── */}
              {!(totpEnabled === true || isCodesSetUp) && !loadingTotp && (
                <div
                  style={{
                    background: 'var(--pill-red-bg)',
                    border: '1px solid var(--border-danger)',
                    borderRadius: 16,
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                    animation: 'fadeSlideIn 0.3s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'var(--fill-danger)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <ShieldAlert size={20} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-danger)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Action Required
                        </span>
                        <span style={{ fontSize: 11, background: 'var(--fill-danger)', color: '#fff', padding: '2px 7px', borderRadius: 6, fontWeight: 600 }}>
                          2-Step Verification Disabled
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-danger)', lineHeight: 1.4 }}>
                        Your account does not have 2-Step Verification enabled. Protect your encrypted journals across new devices by setting up an Authenticator App or Backup Recovery Codes.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTotpSetupModal(true)}
                    style={{
                      padding: '9px 18px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'var(--fill-danger)',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontFamily: 'inherit',
                      boxShadow: '0 2px 8px rgba(197,48,48,0.25)',
                    }}
                  >
                    Enable 2-Step Verification →
                  </button>
                </div>
              )}

              {/* Security Score */}
              <SecurityScoreCard
                score={score}
                checks={[
                  {
                    label: isOAuthUser ? 'Force password set' : 'Password protected',
                    done: isOAuthUser ? vaultPasswordSet : true,
                    hint: isOAuthUser ? 'Required for email login and recovery' : undefined,
                    action: isOAuthUser && !vaultPasswordSet ? () => setShowPasswordModal(true) : undefined,
                    actionLabel: 'Set password →',
                  },
                  {
                    label: 'Recovery codes generated',
                    done: isCodesSetUp,
                    hint: 'Backup if you lose access to your phone',
                    action: !isCodesSetUp ? () => setShowCodesConfirm(true) : undefined,
                    actionLabel: 'Generate →',
                  },
                  {
                    label: 'Authenticator app (2FA) enabled',
                    done: totpEnabled === true,
                    hint: '6-digit codes for new device verification',
                    action: totpEnabled === false ? () => setShowTotpSetupModal(true) : undefined,
                    actionLabel: 'Enable →',
                  },
                ]}
              />

              {/* Simple explanation banner for 2-Step Verification & Encrypted Vault */}
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'var(--cream-inner)',
                  border: '1px solid var(--cream-border)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <HelpCircle size={15} style={{ color: 'var(--cream-muted)', marginTop: 2, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--cream-muted)' }}>
                  <strong>How 2-Step Verification (Vault Protection) works:</strong> Your journals are end-to-end encrypted. When 2-Step Verification is enabled, signing in from an unrecognized device requires an authenticator code, recovery code, or approval from a trusted device. If not enabled, you can sign in directly from any device without extra verification prompts.
                </p>
              </div>

              {/* ── Password ── */}
              <SecurityCard id="sec-password" title="Password" description="Your password secures your account and keeps your journals completely private." pill={isOAuthUser && !vaultPasswordSet ? 'Not set' : 'Protected'} pillVariant={isOAuthUser && !vaultPasswordSet ? 'amber' : 'green'}>
                <InnerCard>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'var(--cream-card)', border: '1px solid var(--cream-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-muted)' }}>
                        <Lock size={16} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--cream-text)' }}>
                          {isOAuthUser ? 'Force password' : 'Account password'}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--cream-faint)' }}>
                          {isOAuthUser && !vaultPasswordSet
                            ? 'Not set up yet — required for email login'
                            : lastPasswordChangedAt
                            ? `Last changed ${timeAgo(lastPasswordChangedAt)}`
                            : 'Last change date not recorded'}
                        </p>
                      </div>
                    </div>
                    <OutlineButton id="sec-password-open" onClick={() => setShowPasswordModal(true)}>
                      {isOAuthUser && !vaultPasswordSet ? 'Set password' : 'Change'}
                    </OutlineButton>
                  </div>
                </InnerCard>
                {migrationNeeded && (
                  <div style={{ marginTop: 12 }}>
                    <StatusBanner variant="warning" icon={AlertTriangle}>
                      <strong>Security upgrade available.</strong> Click &ldquo;Change&rdquo; → &ldquo;Run security upgrade&rdquo; to use the latest encryption.{' '}
                      <Link href="/security/guide#migration" style={{ color: 'inherit', textDecoration: 'underline' }}>Learn more</Link>
                    </StatusBanner>
                  </div>
                )}
              </SecurityCard>

              {/* ── Recovery codes ── */}
              <SecurityCard id="sec-recovery" title="Recovery codes" description="Use these single-use codes to sign in if you forget your password." pill={isCodesSetUp ? 'Generated' : 'Not set up'} pillVariant={isCodesSetUp ? 'green' : 'amber'}>
                <InnerCard>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'var(--cream-card)', border: '1px solid var(--cream-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-muted)' }}>
                        <KeyRound size={16} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--cream-text)' }}>Backup recovery codes</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--cream-faint)' }}>
                          {isCodesSetUp
                            ? `${codesRemaining} of 8 codes remaining${codesSetAt ? ` · generated ${timeAgo(codesSetAt)}` : ''}`
                            : 'Generate 8 single-use backup codes and store offline.'}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isCodesSetUp && (
                        <OutlineButton id="sec-codes-remove-open" danger onClick={() => setShowCodesRemoveModal(true)}>
                          Remove
                        </OutlineButton>
                      )}
                      <OutlineButton id="sec-codes-open" onClick={() => setShowCodesConfirm(true)} loading={codesLoading} loadingText="Generating…">
                        {isCodesSetUp ? 'Regenerate' : 'Generate codes'}
                      </OutlineButton>
                    </div>
                  </div>
                </InnerCard>
                {isCodesLow && (
                  <div style={{ marginTop: 12 }}>
                    <StatusBanner variant="warning" icon={AlertTriangle}>
                      Only {codesRemaining} code{codesRemaining === 1 ? '' : 's'} remaining. Regenerate to get a fresh set of 8.
                    </StatusBanner>
                  </div>
                )}
                {!isCodesSetUp && (
                  <div style={{ marginTop: 12 }}>
                    <StatusBanner variant="warning" icon={AlertTriangle}>
                      <strong>Recommended:</strong> Recovery codes are your only backup if you lose your phone or forget your password.{' '}
                      <Link href="/security/guide#recovery" style={{ color: 'inherit', textDecoration: 'underline' }}>Why this matters</Link>
                    </StatusBanner>
                  </div>
                )}
              </SecurityCard>

              {/* ── TOTP ── */}
              <SecurityCard id="sec-totp" title="Authenticator app (2FA)" description="Protect your account with an extra layer of security." pill={loadingTotp ? undefined : totpEnabled ? 'Enabled' : 'Not set up'} pillVariant={totpEnabled ? 'green' : 'gray'}>
                <InnerCard>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'var(--cream-card)', border: '1px solid var(--cream-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream-muted)' }}>
                        <Smartphone size={16} />
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--cream-text)' }}>
                          Time-based one-time codes (TOTP)
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--cream-faint)' }}>
                          {loadingTotp ? 'Checking status…' : totpEnabled
                            ? totpVerifiedAt ? `Enabled · verified ${timeAgo(totpVerifiedAt)}` : 'Enabled — use your TOTP app to verify new devices'
                            : 'Use Google Authenticator, Authy, 1Password, or any TOTP app'}
                        </p>
                      </div>
                    </div>
                    {!loadingTotp && (
                      totpEnabled ? (
                        <OutlineButton id="sec-totp-remove-open" danger onClick={() => setShowTotpRemoveModal(true)}>Remove</OutlineButton>
                      ) : (
                        <OutlineButton id="sec-totp-setup-open" onClick={() => setShowTotpSetupModal(true)}>Enable</OutlineButton>
                      )
                    )}
                  </div>
                </InnerCard>
                {!totpEnabled && !loadingTotp && (
                  <div style={{ marginTop: 12 }}>
                    <StatusBanner variant="info" icon={HelpCircle}>
                      <strong>What is TOTP?</strong> An authenticator app generates a new 6-digit code every 30 seconds. You&apos;ll use it to verify new devices.{' '}
                      <Link href="/security/guide#totp" style={{ color: 'inherit', textDecoration: 'underline' }}>Learn more</Link>
                    </StatusBanner>
                  </div>
                )}
              </SecurityCard>

              {/* ── Active devices ── */}
              <SecurityCard
                id="sec-devices"
                title="Active devices"
                description="Manage the browsers and devices currently signed in to your account."
                pill={dedupedDevices.length ? `${dedupedDevices.length} device${dedupedDevices.length !== 1 ? 's' : ''}` : undefined}
                pillVariant="gray"
              >
                {loadingDevices ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--cream-faint)', fontSize: 13, padding: '4px 0' }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Loading sessions…
                  </div>
                ) : dedupedDevices.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--cream-faint)' }}>No active sessions found.</p>
                ) : (
                  <div style={{ background: 'var(--cream-inner)', borderRadius: 14, border: '1px solid var(--cream-border)', overflow: 'hidden' }}>
                    {dedupedDevices.map(({ session: d, count }, idx) => {
                      const isCurrent = typeof window !== 'undefined'
                        ? (d.user_agent ? d.user_agent === window.navigator.userAgent : false)
                        : false;
                      return (
                        <div key={d.id} style={{ borderBottom: idx < dedupedDevices.length - 1 ? '1px solid var(--cream-border)' : 'none' }}>
                          <DeviceRow
                            session={d}
                            isCurrent={isCurrent}
                            onRevoke={() => handleRevokeRequest(d, isCurrent)}
                            revoking={actionLoading === d.id}
                            duplicateCount={count}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <StatusBanner variant="info" icon={Shield}>
                    <strong>See an unfamiliar device?</strong> Click <strong>Revoke</strong> to immediately sign it out and remove its access.
                  </StatusBanner>
                </div>
              </SecurityCard>

              {/* ── Collaboration Key ── */}
              <SecurityCard
                id="sec-collab-key"
                title="Collaboration Key"
                description="Your RSA-4096 key enables end-to-end encrypted journal sharing. The private half lives only in this browser."
                pill={
                  collabKeyStatus === 'checking' ? 'Checking…' :
                  collabKeyStatus === 'found'    ? 'Active on this device' :
                                                   'Not found on this device'
                }
                pillVariant={
                  collabKeyStatus === 'checking' ? 'gray' :
                  collabKeyStatus === 'found'    ? 'green' : 'amber'
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {collabKeyStatus === 'checking' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--cream-muted)', fontSize: 13 }}>
                      <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                      Checking local key store…
                    </div>
                  )}

                  {collabKeyStatus === 'found' && (
                    <InnerCard>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cream-text)' }}>RSA-4096 (SHA-256)</span>
                          {collabKeyVersion !== null && (
                            <span style={{ fontSize: 12, color: 'var(--cream-faint)' }}>Server key version: v{collabKeyVersion}</span>
                          )}
                        </div>
                        <Pill label="Private key in browser" variant="green" />
                      </div>
                    </InnerCard>
                  )}

                  {collabKeyStatus === 'missing' && (
                    <StatusBanner variant="warning" icon={AlertTriangle}>
                      Your collaboration private key was not found in this browser. This happens if you cleared your
                      browser storage or are using a new device. Generate a new key below — journal owners will be
                      notified to re-invite you.
                    </StatusBanner>
                  )}

                  {collabKeyError && (
                    <StatusBanner variant="error" icon={AlertCircle}>{collabKeyError}</StatusBanner>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <OutlineButton
                      id="reset-collab-key-btn"
                      onClick={handleResetCollabKey}
                      loading={resettingCollabKey}
                      loadingText="Generating new key…"
                      disabled={resettingCollabKey || collabKeyStatus === 'checking'}
                      danger={collabKeyStatus === 'found'}
                    >
                      {collabKeyStatus === 'missing' ? <><KeyRound size={13} /> Generate New Key</> : <><RefreshCw size={13} /> Reset Collaboration Key</>}
                    </OutlineButton>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--cream-faint)', lineHeight: 1.5 }}>
                      {collabKeyStatus === 'found'
                        ? 'Resetting generates a new key pair and revokes your current access to all shared journals.'
                        : 'Generating a key will notify journal owners to re-share their journals with you.'}
                    </p>
                  </div>
                </div>
              </SecurityCard>

              {/* ── Advanced (danger zone) ── */}
              <AdvancedSection>
                <DeleteAccountComponent />
              </AdvancedSection>

            </div>
          </div>
        </div>

        {/* Revoke dialog */}
        <ConfirmDialog
          open={showRevokeDialog}
          onOpenChange={(open) => { setShowRevokeDialog(open); if (!open) { setRevokeTarget(null); setRevokeError(null); } }}
          title={isSelfRevokeTarget ? 'Sign out of this device?' : 'Remove device?'}
          description={
            isSelfRevokeTarget
              ? 'You will be signed out immediately and redirected to the login page.'
              : revokeTarget
                ? `This will sign out "${getDeviceLabel(revokeTarget)}" and revoke its access.`
                : 'This will sign out the selected device.'
          }
          confirmLabel={isSelfRevokeTarget ? 'Sign out' : 'Remove device'}
          confirmLoadingLabel={isSelfRevokeTarget ? 'Signing out…' : 'Removing…'}
          onConfirm={handleRevokeConfirm}
          loading={Boolean(revokeTarget && actionLoading === revokeTarget.id)}
          error={revokeError}
          confirmTone="danger"
        />

        {/* Recovery codes display modal */}
        {newlyCodes && newlyCodes.length > 0 && (
          <RecoveryCodesDisplay
            codes={newlyCodes}
            mode="modal"
            context="regenerated"
            onDismiss={() => {
              setNewlyCodes(null);
              fetch('/api/security/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'recovery_codes_regenerated', email: '' }) }).catch(() => {});
            }}
          />
        )}
      </div>
    </>
  );
}
'use client';
// apps/web/components/security/NewDeviceVerification.tsx
/**
 * NewDeviceVerification — Security Architecture v2 (Phase 2 + Phase 4)
 *
 * Full-page gate shown when FORCE detects the current browser has no
 * device_keys row (i.e. it is an untrusted / new device).
 *
 * The user is authenticated (Supabase session valid) but not yet
 * "encryption-trusted". They must verify via one of three methods:
 *
 *   Tab A — Approve from existing device  (Phase 4 — ACTIVE)
 *   Tab B — Recovery code                 (Phase 2 — ACTIVE)
 *   Tab C — Authenticator app (TOTP)      (Phase 3 — Coming soon)
 *
 * Phase 4 approval flow:
 *   1. Requesting device generates ECDH key pair, POSTs request to server
 *   2. Server broadcasts via Supabase Realtime to existing trusted devices
 *   3. Trusted device approves → ECDH handshake → encrypted master key sent
 *   4. This device decrypts master key, generates deviceSecret, registers itself
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Shield, KeyRound, Smartphone, Loader2, AlertCircle,
  CheckCircle2, Lock, ArrowLeft, Monitor, RefreshCw, Clock,
} from 'lucide-react';
import { initializeEncryption, getDeviceId } from '@/utils/encryption/keyManager';
import { base64ToUint8Array } from '@/utils/encryption/crypto';

// ── ECDH helpers (Phase 4) ────────────────────────────────────────────────────

async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

async function exportPublicKeyBase64(key: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', key);
  return btoa(String.fromCharCode(...new Uint8Array(spki)));
}

async function importPublicKeyBase64(base64: string): Promise<CryptoKey> {
  const spki = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return crypto.subtle.importKey('spki', spki, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}

async function deriveSharedAESKey(privateKey: CryptoKey, remotePublicKey: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: remotePublicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function decryptWithKey(ciphertextB64: string, ivB64: string, key: CryptoKey): Promise<Uint8Array> {
  const ciphertext = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new Uint8Array(decrypted);
}

// ── Design tokens ──────────────────────────────────────────────────────────────
// Every color below is a CSS var WITH a hard fallback. If --cream-* isn't
// defined globally in your app, these still render a solid warm-cream card
// instead of silently going transparent (the root cause of the bug).
const T = {
  card: 'var(--cream-card, #FFF8EE)',
  inner: 'var(--cream-inner, #F2E4CF)',
  border: 'var(--cream-border, #B98D58)',
  borderStrong: 'var(--cream-border-strong, #8A5A2C)',
  text: 'var(--cream-text, #1A120C)',
  muted: 'var(--cream-muted, #2E2118)',
  faint: 'var(--cream-faint, #3F2E22)',
  accent: '#8F2D1F',
  accentSoft: 'rgba(143,45,31,0.2)',
  accentRing: 'rgba(143,45,31,0.48)',
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────
interface NewDeviceVerificationProps {
  userId: string;
  userEmail?: string;
  /** For email users: their password. For OAuth users: their userId (legacy credential). */
  credential: string;
  isOAuthUser: boolean;
  /** Whether the user has a TOTP authenticator set up */
  hasTOTP?: boolean;
  /** Whether the user has active (unused) recovery codes */
  hasRecoveryCode?: boolean;
  onSuccess: () => void;
  onSignOut?: () => void;
}

type VerifyTab = 'recovery' | 'totp' | 'approve';

// ── Tab configuration ─────────────────────────────────────────────────────────
const ALL_TABS: { id: VerifyTab; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'approve', label: 'Approve from device', icon: <Shield size={15} /> },
  { id: 'recovery', label: 'Recovery code', icon: <KeyRound size={15} /> },
  { id: 'totp', label: 'Authenticator app', icon: <Smartphone size={15} /> },
];

// ── Recovery Code Input sub-component ─────────────────────────────────────────
function RecoveryCodeInput({
  userId,
  credential,
  isOAuthUser,
  onSuccess,
}: {
  userId: string;
  credential: string;
  isOAuthUser: boolean;
  onSuccess: () => void;
}) {
  const [segments, setSegments] = useState(['', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [emailPassword, setEmailPassword] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const inputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  const code = segments.join('-').toUpperCase();
  const isReady = segments[0]!.length === 4 && segments[1]!.length === 4;

  const handleSegmentChange = (idx: number, value: string) => {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    const next = [...segments];
    next[idx] = clean;
    setSegments(next);
    setError(null);
    if (clean.length === 4 && idx === 0) inputRefs[1]?.current?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && segments[idx]!.length === 0 && idx === 1) {
      inputRefs[0]?.current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const parts = text.split('-');
    if (parts.length >= 2) {
      setSegments([parts[0]!.slice(0, 4), parts[1]!.slice(0, 4)]);
    } else if (text.length === 8) {
      setSegments([text.slice(0, 4), text.slice(4, 8)]);
    }
  };

  const handleVerify = async () => {
    if (!isReady) return;
    setLoading(true);
    setError(null);

    // For OAuth users: prefer entered password (they may have set one via Phase 5),
    // fall back to userId (legacy OAuth credential).
    // For email users: use the pre-passed credential or the manually entered password.
    const effectiveCredential = isOAuthUser
      ? (emailPassword || credential || userId)
      : (credential || emailPassword);
    if (!effectiveCredential) {
      setError('Please enter your password above before verifying the recovery code.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/encryption/verify-recovery-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, action: 'dry-run' }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Invalid recovery code. Please check and try again.');
        setLoading(false);
        return;
      }

      try {
        await initializeEncryption(
          userId,
          effectiveCredential,
          data.encryption_salt,
          data.encrypted_master_key,
          data.master_key_iv,
          data.key_version ?? 1,
          base64ToUint8Array(data.encryption_salt)
        );
      } catch (err) {
        // If first attempt failed and this is an OAuth user, retry with the
        // alternative credential (userId for legacy, or password if they entered one)
        if (err instanceof DOMException && err.name === 'OperationError' && isOAuthUser) {
          const fallbackCredential = emailPassword ? userId : emailPassword;
          if (fallbackCredential && fallbackCredential !== effectiveCredential) {
            try {
              await initializeEncryption(
                userId,
                fallbackCredential,
                data.encryption_salt,
                data.encrypted_master_key,
                data.master_key_iv,
                data.key_version ?? 1,
                base64ToUint8Array(data.encryption_salt)
              );
            } catch {
              // Also try with legacy iterations (key_version=1) as last resort
              try {
                await initializeEncryption(
                  userId,
                  userId,
                  data.encryption_salt,
                  data.encrypted_master_key,
                  data.master_key_iv,
                  1,
                  base64ToUint8Array(data.encryption_salt)
                );
              } catch {
                setError(
                  emailPassword
                    ? 'Invalid password. The recovery code is valid, but your password is incorrect.'
                    : 'Please enter your account password to decrypt your journals on this device.'
                );
                setLoading(false);
                return;
              }
            }
          } else {
            // No fallback available — OAuth user with no password entered, userId failed
            // Try legacy iterations as last resort
            if ((data.key_version ?? 1) >= 2) {
              try {
                await initializeEncryption(
                  userId,
                  userId,
                  data.encryption_salt,
                  data.encrypted_master_key,
                  data.master_key_iv,
                  1,
                  base64ToUint8Array(data.encryption_salt)
                );
              } catch {
                setError(
                  'Your account requires a password. If you\'ve set a password for your account, please enter it above and try again.'
                );
                setLoading(false);
                return;
              }
            } else {
              setError('Invalid password. The recovery code is valid, but your password is incorrect.');
              setLoading(false);
              return;
            }
          }
        } else if (err instanceof DOMException && err.name === 'OperationError') {
          setError('Invalid password. The recovery code is valid, but your password is incorrect.');
          setLoading(false);
          return;
        } else {
          setError(err instanceof Error ? err.message : 'Invalid password or decryption failed.');
          setLoading(false);
          return;
        }
      }

      const consumeRes = await fetch('/api/encryption/verify-recovery-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, action: 'consume' }),
      });

      if (!consumeRes.ok) {
        const consumeData = await consumeRes.json();
        setError(consumeData.error ?? 'Failed to consume recovery code. Please try again.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => onSuccess(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(34,197,94,0.12)]">
          <CheckCircle2 size={28} color="#16a34a" />
        </div>
        <p className="text-sm font-semibold" style={{ color: T.text }}>Device verified!</p>
        <p className="text-[13px]" style={{ color: T.muted }}>Unlocking your journals…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed" style={{ color: T.muted }}>
        Enter one of your saved recovery codes. Each code can only be used once.
      </p>

      {!credential && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium" style={{ color: T.muted }}>{isOAuthUser ? 'Account password (if set)' : 'Your account password'}</label>
          <div className="relative flex items-center">
            <input
              type={showEmailPassword ? 'text' : 'password'}
              value={emailPassword}
              onChange={e => setEmailPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
              className="h-11 w-full rounded-xl border-2 px-3 pr-10 text-[13px] outline-none transition-colors disabled:opacity-50"
              style={{ borderColor: T.border, background: T.inner, color: T.text }}
              onFocus={e => (e.currentTarget.style.borderColor = T.accentRing)}
              onBlur={e => (e.currentTarget.style.borderColor = T.border)}
            />
            <button type="button" onClick={() => setShowEmailPassword(v => !v)} className="absolute right-3 border-none bg-transparent p-0" style={{ color: T.faint }}>
              <Lock size={14} className={showEmailPassword ? '' : 'opacity-50'} />
            </button>
          </div>
          <p className="text-[11px]" style={{ color: T.faint }}>{isOAuthUser ? 'Enter your password if you\'ve set one for your account.' : 'Needed to decrypt your journals after verifying the code.'}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        {segments.map((seg, idx) => (
          <React.Fragment key={idx}>
            <input
              ref={inputRefs[idx]}
              type="text"
              value={seg}
              onChange={e => handleSegmentChange(idx, e.target.value)}
              onKeyDown={e => handleKeyDown(idx, e)}
              onPaste={handlePaste}
              maxLength={4}
              placeholder="XXXX"
              disabled={loading}
              className="h-14 w-28 rounded-xl border-2 text-center font-mono text-xl font-bold uppercase outline-none transition-colors disabled:opacity-50"
              style={{ borderColor: T.border, background: T.inner, color: T.text, letterSpacing: '0.2em' }}
            />
            {idx === 0 && <span className="text-2xl font-light" style={{ color: T.faint }}>—</span>}
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.07)] px-3.5 py-2.5">
          <AlertCircle size={14} color="#dc2626" className="shrink-0" />
          <p className="m-0 text-[13px] text-red-600">{error}</p>
        </div>
      )}

      <button
        onClick={handleVerify}
        disabled={!isReady || loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: T.accent }}
      >
        {loading ? (<><Loader2 size={15} className="animate-spin" />Verifying…</>) : (<><Lock size={15} />Verify & unlock</>)}
      </button>

      <p className="text-center text-[12px]" style={{ color: T.faint }}>
        Lost your codes?{' '}
        <a href="/settings/security" style={{ color: T.accent }} className="no-underline hover:underline">
          Manage recovery options
        </a>
      </p>
    </div>
  );
}

// ── TOTP Verification Tab (Phase 3 — ACTIVE) ──────────────────────────────────
function TOTPVerificationTab({
  userId,
  credential,
  isOAuthUser,
  onSuccess,
}: {
  userId: string;
  credential: string;
  isOAuthUser: boolean;
  onSuccess: () => void;
}) {
  const [digits, setDigits] = React.useState(['', '', '', '', '', '']);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [emailPassword, setEmailPassword] = React.useState('');
  const [showEmailPassword, setShowEmailPassword] = React.useState(false);

  const r0 = useRef<HTMLInputElement>(null);
  const r1 = useRef<HTMLInputElement>(null);
  const r2 = useRef<HTMLInputElement>(null);
  const r3 = useRef<HTMLInputElement>(null);
  const r4 = useRef<HTMLInputElement>(null);
  const r5 = useRef<HTMLInputElement>(null);
  const inputRefs = [r0, r1, r2, r3, r4, r5];

  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError(null);
    if (value && index < 5) inputRefs[index + 1]?.current?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1]?.current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length === 6) {
      setDigits(text.split(''));
      inputRefs[5]?.current?.focus();
    }
  };

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);

    // For OAuth users: prefer entered password (they may have set one via Phase 5),
    // fall back to userId (legacy OAuth credential).
    const effectiveCredential = isOAuthUser
      ? (emailPassword || credential || userId)
      : (credential || emailPassword);
    if (!effectiveCredential) {
      setError('Please enter your password below before verifying the code.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/encryption/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Invalid code. Please try again.');
        setLoading(false);
        return;
      }

      try {
        await initializeEncryption(
          userId,
          effectiveCredential,
          data.encryption_salt,
          data.encrypted_master_key,
          data.master_key_iv,
          data.key_version ?? 1,
          base64ToUint8Array(data.encryption_salt)
        );
      } catch (err) {
        // If first attempt failed for OAuth user, retry with alternative credentials
        if (err instanceof DOMException && err.name === 'OperationError' && isOAuthUser) {
          const fallbackCredential = emailPassword ? userId : emailPassword;
          let recovered = false;
          if (fallbackCredential && fallbackCredential !== effectiveCredential) {
            try {
              await initializeEncryption(
                userId, fallbackCredential, data.encryption_salt,
                data.encrypted_master_key, data.master_key_iv,
                data.key_version ?? 1, base64ToUint8Array(data.encryption_salt)
              );
              recovered = true;
            } catch { /* fall through */ }
          }
          // Last resort: try userId with legacy iterations
          if (!recovered && (data.key_version ?? 1) >= 2) {
            try {
              await initializeEncryption(
                userId, userId, data.encryption_salt,
                data.encrypted_master_key, data.master_key_iv,
                1, base64ToUint8Array(data.encryption_salt)
              );
              recovered = true;
            } catch { /* fall through */ }
          }
          if (!recovered) {
            setError(
              emailPassword
                ? 'Invalid password. The authenticator code is valid, but your password is incorrect.'
                : 'Your account requires a password. If you\'ve set a password for your account, please enter it below and try again.'
            );
            setLoading(false);
            return;
          }
        } else if (err instanceof DOMException && err.name === 'OperationError') {
          setError('Invalid password. The authenticator code is valid, but your password is incorrect.');
          setLoading(false);
          return;
        } else {
          setError(err instanceof Error ? err.message : 'Invalid password or decryption failed.');
          setLoading(false);
          return;
        }
      }

      setSuccess(true);
      setTimeout(() => onSuccess(), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed. Please try again.');
      setLoading(false);
    }
  };

  const isReady = digits.every(d => d !== '');

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(34,197,94,0.12)]">
          <CheckCircle2 size={28} color="#16a34a" />
        </div>
        <p className="text-sm font-semibold" style={{ color: T.text }}>Device verified!</p>
        <p className="text-[13px]" style={{ color: T.muted }}>Unlocking your journals…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed" style={{ color: T.muted }}>
        Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and enter the
        6-digit code for your FORCE account.
      </p>

      <div className="flex items-center justify-center gap-2" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={inputRefs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleDigitChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            disabled={loading}
            autoFocus={i === 0}
            className="h-14 w-10 rounded-xl border-2 text-center font-mono text-xl font-bold outline-none transition-colors disabled:opacity-50"
            style={{ borderColor: T.border, background: T.inner, color: T.text }}
          />
        ))}
      </div>

      {!credential && (
        <div className="mb-2 flex flex-col gap-1.5">
          <label className="text-[13px] font-medium" style={{ color: T.text }}>{isOAuthUser ? 'Account Password (if set)' : 'Account Password'}</label>
          <div className="relative">
            <input
              type={showEmailPassword ? 'text' : 'password'}
              value={emailPassword}
              onChange={(e) => { setEmailPassword(e.target.value); setError(null); }}
              placeholder="Enter your password to decrypt data"
              disabled={loading}
              className="w-full rounded-xl border px-3 py-2.5 pr-10 text-[13px] outline-none disabled:opacity-50"
              style={{ borderColor: T.borderStrong, background: T.inner, color: T.text }}
            />
            <button
              type="button"
              onClick={() => setShowEmailPassword(!showEmailPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent text-[12px]"
              style={{ color: T.faint }}
            >
              {showEmailPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-[11px]" style={{ color: T.faint }}>{isOAuthUser ? 'Enter your password if you\'ve set one for your account.' : 'Required to decrypt your journals on this new device.'}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.07)] px-3.5 py-2.5">
          <AlertCircle size={14} color="#dc2626" className="shrink-0" />
          <p className="m-0 text-[13px] text-red-600">{error}</p>
        </div>
      )}

      <button
        onClick={handleVerify}
        disabled={!isReady || loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: T.accent }}
      >
        {loading ? (<><Loader2 size={15} className="animate-spin" />Verifying…</>) : (<><Smartphone size={15} />Verify & unlock</>)}
      </button>

      <p className="text-center text-[12px]" style={{ color: T.faint }}>
        Don&apos;t have access to your authenticator?{' '}
        <button
          type="button"
          onClick={() => setError(null)}
          className="cursor-pointer border-none bg-transparent p-0 text-[12px] underline"
          style={{ color: T.accent }}
        >
          Use a recovery code instead
        </button>
      </p>
    </div>
  );
}

// ── Device Approval Tab (Phase 4 — ACTIVE) ─────────────────────────────────────
type ApprovalStage = 'idle' | 'pending' | 'approved' | 'denied' | 'expired' | 'error';

function DeviceApprovalTab({
  userId,
  credential,
  isOAuthUser,
  onSuccess,
}: {
  userId: string;
  credential: string;
  isOAuthUser: boolean;
  onSuccess: () => void;
}) {
  const [stage, setStage] = useState<ApprovalStage>('idle');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const ecdhKeyPairRef = useRef<CryptoKeyPair | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broadcastChannelRef = useRef<any>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    // Clean up the broadcast channel if it's still open
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.unsubscribe();
      broadcastChannelRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const checkApprovalStatus = useCallback(async (isManual = false) => {
    const activeReqId = requestIdRef.current;
    const activeKeyPair = ecdhKeyPairRef.current;
    if (!activeReqId || !activeKeyPair) return;

    if (isManual) {
      setIsRefreshing(true);
      setRefreshError(null);
    }

    try {
      const poll = await fetch(`/api/encryption/device-approval/status?request_id=${activeReqId}`);
      const pollData = await poll.json();

      if (pollData.status === 'approved') {
        stopPolling();

        const approverPubKey = await importPublicKeyBase64(pollData.approver_public_key);
        const sharedKey = await deriveSharedAESKey(activeKeyPair.privateKey, approverPubKey);
        const masterKeyBytes = await decryptWithKey(pollData.encrypted_package, pollData.package_iv, sharedKey);

        const saltRes = await fetch('/api/encryption/salt');
        const saltData = await saltRes.json();
        if (!saltData.salt) throw new Error('Failed to fetch encryption salt');
        const saltBytes = Uint8Array.from(atob(saltData.salt), c => c.charCodeAt(0));

        const {
          generateDeviceSecret: gds,
          deriveDeviceKey,
          encryptText,
          uint8ArrayToBase64: u2b,
          importMasterKey,
        } = await import('@/utils/encryption/crypto');
        const masterKey = await importMasterKey(masterKeyBytes);

        const { storeMasterKeyAndCache } = await import('@/utils/encryption/keyManager');
        await storeMasterKeyAndCache(userId, masterKey);

        const deviceSecretBytes = gds();
        const deviceSecretB64 = u2b(deviceSecretBytes);
        const thisDeviceId = crypto.randomUUID();
        const { storeDeviceCredentials } = await import('@/utils/encryption/keyManager');
        await storeDeviceCredentials({ deviceId: thisDeviceId, deviceSecret: deviceSecretB64 });

        const deviceKey = await deriveDeviceKey(deviceSecretB64, saltBytes);
        const masterKeyB64 = u2b(masterKeyBytes);
        const { ciphertext: encKey, iv: keyIv } = await encryptText(masterKeyB64, deviceKey);

        const ua = navigator.userAgent;
        const browser = ua.includes('Chrome') && !ua.includes('Edg') ? 'Chrome'
          : ua.includes('Firefox') ? 'Firefox'
          : ua.includes('Safari') && !ua.includes('Chrome') ? 'Safari'
          : ua.includes('Edg') ? 'Edge' : 'Browser';

        const regRes = await fetch('/api/encryption/device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_id: thisDeviceId,
            device_name: `${navigator.platform} — ${browser}`,
            device_type: 'web',
            browser,
            encrypted_key: encKey,
            key_iv: keyIv,
            salt: saltData.salt,
          }),
        });

        if (!regRes.ok) {
          const regData = await regRes.json().catch(() => ({}));
          throw new Error(regData.error ?? 'Failed to register device');
        }

        setStage('approved');
        setTimeout(onSuccess, 1200);

      } else if (pollData.status === 'denied') {
        stopPolling();
        setStage('denied');
      } else if (pollData.status === 'expired') {
        stopPolling();
        setStage('expired');
      }
    } catch (e) {
      console.error('[DeviceApprovalTab] Status check error:', e);
      if (isManual) {
        setRefreshError(e instanceof Error ? e.message : 'Could not refresh status. Tap retry.');
      } else {
        stopPolling();
        setError(e instanceof Error ? e.message : 'Approval failed. Please try again.');
        setStage('error');
      }
    } finally {
      if (isManual) {
        setIsRefreshing(false);
      }
    }
  }, [stopPolling, userId, onSuccess]);

  const handleRequest = async () => {
    stopPolling();
    setStage('idle');
    setError(null);
    setRefreshError(null);
    setSecondsLeft(600);
    setIsSending(true);

    try {
      const keyPair = await generateECDHKeyPair();
      ecdhKeyPairRef.current = keyPair;
      const publicKeyB64 = await exportPublicKeyBase64(keyPair.publicKey);

      const deviceId = (await getDeviceId()) ?? crypto.randomUUID();
      const ua = navigator.userAgent;
      const browser = ua.includes('Chrome') && !ua.includes('Edg') ? 'Chrome'
        : ua.includes('Firefox') ? 'Firefox'
        : ua.includes('Safari') && !ua.includes('Chrome') ? 'Safari'
        : ua.includes('Edg') ? 'Edge' : 'Browser';
      let os = 'Unknown OS';
      if (ua.includes('Windows')) os = 'Windows';
      else if (ua.includes('Mac')) os = 'macOS';
      else if (ua.includes('Linux')) os = 'Linux';
      else if (ua.includes('Android')) os = 'Android';
      else if (/iPhone|iPad/.test(ua)) os = 'iOS';

      const res = await fetch('/api/encryption/device-approval/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesting_device_id: deviceId,
          requesting_device_name: `${os} — ${browser}`,
          requesting_browser: browser,
          requester_public_key: publicKeyB64,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to send request');

      setRequestId(data.request_id);
      requestIdRef.current = data.request_id;
      setStage('pending');

      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const channel = supabase.channel(`device-approval:${userId}`);

      // Keep a reference so stopPolling() can tear down the channel
      // when the approval flow finishes or the component unmounts.
      broadcastChannelRef.current = channel;

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'approval_requested',
            payload: {
              request_id: data.request_id,
              requesting_device_name: `${os} — ${browser}`,
              requesting_browser: browser,
              requester_public_key: publicKeyB64,
            },
          });
          // Keep the channel alive until stopPolling() — trusted devices
          // that connect slightly after the broadcast can still receive it.
        }
      });

      timerRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) { stopPolling(); setStage('expired'); return 0; }
          return s - 1;
        });
      }, 1000);

      pollRef.current = setInterval(() => {
        void checkApprovalStatus(false);
      }, 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send approval request');
      setStage('error');
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (stage === 'idle') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-relaxed" style={{ color: T.muted }}>
          Send a request to one of your existing trusted devices. They'll see a prompt to approve your login.
        </p>
        <div className="flex items-center gap-3 rounded-xl border px-4 py-3.5" style={{ borderColor: T.border, background: T.inner }}>
          <Monitor size={18} style={{ color: T.faint }} className="shrink-0" />
          <div>
            <p className="text-[13px] font-medium" style={{ color: T.text }}>How it works</p>
            <p className="mt-0.5 text-[12px]" style={{ color: T.muted }}>Your other logged-in devices will receive a prompt. Approve from any one of them to unlock access here.</p>
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.07)] px-3.5 py-2.5">
            <AlertCircle size={14} color="#dc2626" className="shrink-0" />
            <p className="m-0 text-[13px] text-red-600">{error}</p>
          </div>
        )}
        <button
          onClick={handleRequest}
          disabled={isSending}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold text-white shadow-sm transition-all active:scale-[0.98] active:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: T.accent }}
        >
          {isSending ? (<><Loader2 size={15} className="animate-spin" />Sending request...</>) : (<><Shield size={15} />Send approval request</>)}
        </button>
      </div>
    );
  }

  if (stage === 'pending') {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full" style={{ background: T.accentSoft }} />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full ring-1" style={{ background: T.accentSoft, boxShadow: `0 0 0 1px ${T.accentRing} inset` }}>
            <Shield size={28} color={T.accent} />
          </div>
        </div>
        <div>
          <p className="text-[15px] font-semibold" style={{ color: T.text }}>Waiting for approval</p>
          <p className="mt-1 text-[13px]" style={{ color: T.muted }}>Check your other devices for an approval prompt</p>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: T.border, background: T.inner }}>
          <Clock size={12} style={{ color: T.faint }} />
          <span className="font-mono text-[12px]" style={{ color: T.faint }}>Expires in {formatTime(secondsLeft)}</span>
        </div>

        {/* Manual Refresh Button */}
        <button
          type="button"
          onClick={() => void checkApprovalStatus(true)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all hover:opacity-85 active:scale-95 disabled:opacity-50 cursor-pointer"
          style={{ borderColor: T.border, background: T.inner, color: T.text }}
          title="Check if your other device approved the request"
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} style={{ color: T.muted }} />
          <span>{isRefreshing ? 'Checking status…' : 'Refresh status'}</span>
        </button>

        {refreshError && (
          <div className="flex items-center gap-2 rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.07)] px-3 py-1.5 text-left">
            <AlertCircle size={13} color="#dc2626" className="shrink-0" />
            <p className="m-0 text-[11.5px] text-red-600">{refreshError}</p>
          </div>
        )}

        <button onClick={() => { stopPolling(); setStage('idle'); }} className="text-[12px] underline" style={{ color: T.faint }}>
          Cancel and try another method
        </button>
      </div>
    );
  }

  if (stage === 'approved') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(34,197,94,0.12)]">
          <CheckCircle2 size={28} color="#16a34a" />
        </div>
        <p className="text-sm font-semibold" style={{ color: T.text }}>Device approved!</p>
        <p className="text-[13px]" style={{ color: T.muted }}>Unlocking your journals…</p>
      </div>
    );
  }

  if (stage === 'denied') {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(239,68,68,0.1)]">
          <AlertCircle size={28} color="#dc2626" />
        </div>
        <p className="text-sm font-semibold text-red-700">Request was denied</p>
        <p className="text-[13px]" style={{ color: T.muted }}>The request was denied by your other device. Use a recovery code or retry approval.</p>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => void handleRequest()}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all active:scale-[0.98]"
            style={{ background: T.accent }}
          >
            <RefreshCw size={13} /> Retry Approval
          </button>
          <button
            onClick={() => { stopPolling(); setStage('idle'); setError(null); }}
            className="rounded-xl border px-3.5 py-2.5 text-[13px] font-medium transition-colors"
            style={{ borderColor: T.border, background: T.inner, color: T.muted }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'expired') {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: T.inner }}>
          <Clock size={28} style={{ color: T.faint }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: T.text }}>Request expired</p>
        <p className="text-[13px]" style={{ color: T.muted }}>The 10-minute window passed. Retry to send a new approval request.</p>
        <button
          onClick={() => void handleRequest()}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all active:scale-[0.98]"
          style={{ background: T.accent }}
        >
          <RefreshCw size={13} /> Retry Approval
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(239,68,68,0.1)]">
        <AlertCircle size={24} color="#dc2626" />
      </div>
      <div>
        <p className="text-sm font-semibold text-red-700">Device Approval Failed</p>
        <p className="mt-1 text-[13px] text-red-600">{error || 'Could not complete the approval handshake. Please try again.'}</p>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => void handleRequest()}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all active:scale-[0.98]"
          style={{ background: T.accent }}
        >
          <RefreshCw size={13} /> Retry Approval
        </button>
        <button
          onClick={() => { stopPolling(); setStage('idle'); setError(null); }}
          className="rounded-xl border px-3.5 py-2.5 text-[13px] font-medium transition-colors"
          style={{ borderColor: T.border, background: T.inner, color: T.muted }}
        >
          Back to Options
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function NewDeviceVerification({
  userId,
  userEmail,
  credential,
  isOAuthUser,
  hasTOTP = false,
  hasRecoveryCode = false,
  onSuccess,
  onSignOut,
}: NewDeviceVerificationProps) {
  // Build the list of tabs this specific user can actually use
  const availableTabs = ALL_TABS.filter((tab) => {
    if (tab.id === 'approve') return true; // always shown — works if they have any trusted device
    if (tab.id === 'recovery') return hasRecoveryCode;
    if (tab.id === 'totp') return hasTOTP;
    return false;
  });

  const [activeTab, setActiveTab] = useState<VerifyTab>(availableTabs[0]?.id ?? 'approve');
  const [rememberDevice, setRememberDevice] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('__force_remember_device');
      if (stored !== null) {
        setRememberDevice(stored === 'true');
      }
    }
  }, []);

  // Wrap onSuccess to optionally persist the 30-day device trust
  const handleVerifySuccess = async () => {
    if (rememberDevice) {
      try {
        const { markDeviceAsRemembered } = await import('@/utils/encryption/keyManager');
        await markDeviceAsRemembered(30);
      } catch (err) {
        // Non-fatal: user just won't get the skip-gate benefit on next login
        console.warn('[NDV] markDeviceAsRemembered failed (non-fatal):', err);
      }
    }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      {/* Solid opaque card — background color is set inline so it can never
          resolve to transparent, even if the --cream-* tokens aren't defined
          globally in this app yet. */}
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border shadow-[0_20px_60px_rgba(0,0,0,0.16)]"
        style={{ background: '#fffdf8', borderColor: T.borderStrong }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-6 py-5" style={{ background: '#fffaf0', borderColor: T.border }}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1" style={{ background: T.card, boxShadow: `0 0 0 1px ${T.borderStrong} inset` }}>
            <Shield size={20} color={T.accent} />
          </div>
          <div>
            <h2 className="m-0 text-[17px] font-semibold" style={{ color: '#111827' }}>Verify this device</h2>
            <p className="mt-0.5 text-[12px]" style={{ color: '#4b5563' }}>
              {userEmail ?? 'Unknown account'} · New device detected
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2.5 border-b px-5 py-3" style={{ background: '#fffefb', borderColor: T.border }}>
          <Shield size={13} color={T.accent} className="mt-px shrink-0" />
          <p className="m-0 text-[15px] font-medium" style={{ color: '#111827' }}>
            This browser hasn't accessed your encrypted journals before. Verify your identity to unlock them.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex border-b px-4 pt-1" style={{ background: '#fffaf0', borderColor: T.border }}>
          {availableTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative mr-1 flex cursor-pointer items-center gap-1.5 rounded-t-lg border-none px-3 py-2.5 text-[15px] font-medium transition-colors"
                style={{
                  background: isActive ? T.accentSoft : 'transparent',
                  color: isActive ? T.accent : '#4b5563',
                }}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t" style={{ background: T.accent }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="p-5" style={{ background: T.card }}>
          {activeTab === 'approve' && (
            <DeviceApprovalTab userId={userId} credential={credential} isOAuthUser={isOAuthUser} onSuccess={handleVerifySuccess} />
          )}
          {activeTab === 'recovery' && (
            <RecoveryCodeInput userId={userId} credential={credential} isOAuthUser={isOAuthUser} onSuccess={handleVerifySuccess} />
          )}
          {activeTab === 'totp' && (
            <TOTPVerificationTab userId={userId} credential={credential} isOAuthUser={isOAuthUser} onSuccess={handleVerifySuccess} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-3" style={{ background: T.card, borderColor: T.border }}>
          <div className="flex items-center justify-between">
            <p className="text-[12px]" style={{ color: T.faint }}>
              <a href="https://findmyforce.com/security/guide" target="_blank" rel="noreferrer" style={{ color: T.accent }} className="no-underline hover:underline">
                Learn about device trust →
              </a>
            </p>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="inline-flex cursor-pointer items-center gap-1 border-none bg-transparent text-[12px] transition-colors hover:text-red-500"
                style={{ color: T.faint }}
              >
                <ArrowLeft size={11} />
                Sign out
              </button>
            )}
          </div>
          {/* Remember device checkbox */}
          <label
            className="mt-2.5 flex cursor-pointer items-center gap-2 select-none"
            style={{ color: T.muted }}
          >
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="h-3.5 w-3.5 rounded"
              style={{ accentColor: T.accent }}
            />
            <span className="text-[16px]">Mark this device as trusted </span>
          </label>
        </div>
      </div>
    </div>
  );
}
'use client';
// apps/web/components/security/DeviceApprovalHandler.tsx
/**
 * DeviceApprovalHandler — Phase 4
 *
 * Mounted ONCE in the root layout (or journal page) for authenticated users.
 * Listens on Supabase Realtime channel `device-approval:{userId}` for
 * `approval_requested` events sent by new devices.
 *
 * When a request arrives, shows a full-page modal prompt:
 *   "Chrome on Windows is requesting access. Is this you?"
 *   [Approve] [Deny]
 *
 * On Approve:
 *   1. Decrypts master key using current device's credentials (IndexedDB)
 *   2. Performs ECDH with requester's public key
 *   3. Wraps master key with derived shared secret
 *   4. POSTs the encrypted package to /api/encryption/device-approval/approve
 *
 * On Deny:
 *   POSTs to /api/encryption/device-approval/deny
 */

import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Shield, ShieldAlert, ShieldCheck, Loader2,
  Monitor, X, CheckCircle2, AlertCircle, RefreshCw,
} from 'lucide-react';
import { getEncryptionKey, getDeviceId } from '@/utils/encryption/keyManager';
import { exportKey, base64ToUint8Array } from '@/utils/encryption/crypto';

// ── ECDH Crypto helpers ────────────────────────────────────────────────────────

/** Generate ephemeral ECDH P-256 key pair for the approving device. */
async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
}

/** Export a CryptoKey (public) to base64 SPKI. */
async function exportPublicKeyBase64(key: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', key);
  return btoa(String.fromCharCode(...new Uint8Array(spki)));
}

/** Import a base64 SPKI public key. */
async function importPublicKeyBase64(base64: string): Promise<CryptoKey> {
  const spki = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return crypto.subtle.importKey('spki', spki, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}

/** Derive a 256-bit AES-GCM key from an ECDH private key + remote public key. */
async function deriveSharedAESKey(
  privateKey: CryptoKey,
  remotePublicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: remotePublicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt a Uint8Array with AES-GCM, returns { ciphertext: base64, iv: base64 }. */
async function encryptWithKey(
  data: Uint8Array,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data as unknown as BufferSource);
  const toB64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
  return {
    ciphertext: toB64(new Uint8Array(encrypted)),
    iv: toB64(iv),
  };
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface ApprovalRequest {
  request_id: string;
  requesting_device_name: string;
  requesting_browser: string;
  requester_public_key: string;
}

type ApprovalState = 'prompt' | 'approving' | 'approved' | 'denied' | 'error';

// ── Approval Modal ─────────────────────────────────────────────────────────────

function ApprovalModal({
  request,
  userId,
  onDone,
}: {
  request: ApprovalRequest;
  userId: string;
  onDone: () => void;
}) {
  const [state, setState] = useState<ApprovalState>('prompt');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/encryption/device-approval/status?request_id=${request.request_id}`);
      const data = await res.json();
      if (data.status === 'approved' || data.status === 'denied' || data.status === 'expired') {
        onDone();
      }
    } catch {
      /* non-fatal */
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleApprove = async () => {
    setState('approving');
    setErrorMsg(null);

    try {
      // 1. Get master key bytes from memory/IndexedDB
      const masterCryptoKey = await getEncryptionKey(userId);
      const masterKeyB64 = await exportKey(masterCryptoKey);
      const masterKeyRaw = base64ToUint8Array(masterKeyB64);

      // 2. Generate ephemeral ECDH key pair (approver side)
      const approverKeyPair = await generateECDHKeyPair();
      const approverPublicKeyB64 = await exportPublicKeyBase64(approverKeyPair.publicKey);

      // 3. Import requester's public key
      const requesterPubKey = await importPublicKeyBase64(request.requester_public_key);

      // 4. Derive shared AES key
      const sharedKey = await deriveSharedAESKey(approverKeyPair.privateKey, requesterPubKey);

      // 5. Encrypt master key bytes with shared key
      const { ciphertext, iv } = await encryptWithKey(masterKeyRaw, sharedKey);

      // 6. POST to approve endpoint
      const res = await fetch('/api/encryption/device-approval/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: request.request_id,
          approver_public_key: approverPublicKeyB64,
          encrypted_package: ciphertext,
          package_iv: iv,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to approve device');
      }

      setState('approved');
      setTimeout(onDone, 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Approval failed');
      setState('error');
    }
  };

  const handleDeny = async () => {
    setState('denying' as ApprovalState);
    try {
      await fetch('/api/encryption/device-approval/deny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: request.request_id }),
      });
    } catch { /* non-fatal */ }
    setState('denied');
    setTimeout(onDone, 1600);
  };

  return (
    <>
      <style>{`
        @keyframes approvalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes approvalPopIn {
          0% { opacity: 0; transform: scale(0.94) translateY(12px); }
          70% { transform: scale(1.01) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes approvalPulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(22, 163, 74, 0); }
        }
        @keyframes approvalSuccessPop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .approval-btn-approve {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .approval-btn-approve:hover:not(:disabled) {
          transform: translateY(-1.5px) scale(1.01);
          box-shadow: 0 8px 22px -4px rgba(22, 163, 74, 0.42);
          filter: brightness(1.05);
        }
        .approval-btn-approve:active:not(:disabled) {
          transform: scale(0.98);
        }
        .approval-btn-deny {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .approval-btn-deny:hover:not(:disabled) {
          background-color: rgba(220, 38, 38, 0.12) !important;
          border-color: rgba(220, 38, 38, 0.4) !important;
          transform: translateY(-1.5px);
          box-shadow: 0 4px 14px -2px rgba(220, 38, 38, 0.18);
        }
        .approval-btn-deny:active:not(:disabled) {
          transform: scale(0.98);
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[100000] flex items-center justify-center p-4"
        style={{
          background: 'rgba(15, 12, 10, 0.62)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'approvalFadeIn 0.22s ease-out',
        }}
      >
        <div
          className="relative w-full max-w-md overflow-hidden rounded-[24px] border shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)]"
          style={{
            background: 'var(--cream-card, #FFFDF8)',
            borderColor: 'var(--cream-border-strong, rgba(0,0,0,0.12))',
            animation: 'approvalPopIn 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Top Status Accent Bar */}
          <div
            className="h-1.5 w-full"
            style={{
              background:
                state === 'approved'
                  ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                  : state === 'denied' || state === 'error'
                  ? 'linear-gradient(90deg, #dc2626, #ef4444)'
                  : 'linear-gradient(90deg, #d97706, #9f6958, #16a34a)',
            }}
          />

          {/* Header */}
          <div
            className="relative px-6 pt-5 pb-4 border-b"
            style={{
              background: 'var(--cream-inner, #F7F4EC)',
              borderColor: 'var(--cream-border, rgba(0,0,0,0.07))',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-xs"
                  style={{
                    background: 'var(--cream-card, #FFFDF8)',
                    borderColor: 'var(--cream-border-strong, rgba(0,0,0,0.12))',
                    color: '#9f6958',
                  }}
                >
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <h2 className="m-0 text-[16px] font-bold tracking-tight" style={{ color: 'var(--cream-text, #1A1917)' }}>
                    New Device Request
                  </h2>
                  <p className="m-0 text-[12px] font-medium" style={{ color: 'var(--cream-muted, #6B6862)' }}>
                    Authorize 2-Step verification
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  title="Check request status"
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all hover:opacity-85 active:scale-95 disabled:opacity-50 cursor-pointer"
                  style={{
                    background: 'var(--cream-card, #FFFDF8)',
                    borderColor: 'var(--cream-border-strong, rgba(0,0,0,0.12))',
                    color: 'var(--cream-muted, #6B6862)',
                  }}
                >
                  <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
                  <span>{isRefreshing ? 'Checking…' : 'Refresh'}</span>
                </button>

                {/* Live Pulsing Beacon */}
                <div
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase"
                  style={{
                    background: 'rgba(22, 163, 74, 0.12)',
                    color: '#15803d',
                    border: '1px solid rgba(22, 163, 74, 0.25)',
                  }}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                  </span>
                  Live
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 bg-[#FFFDF8]" >
            {state === 'prompt' && (
              <>
                {/* Device Details Card */}
                <div
                  className="mb-5 rounded-2xl border p-4 transition-all"
                  style={{
                    background: 'var(--cream-inner, #F7F4EC)',
                    borderColor: 'var(--cream-border-strong, rgba(0,0,0,0.1))',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                  }}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-xs"
                      style={{
                        background: 'var(--cream-card, #FFFDF8)',
                        borderColor: 'var(--cream-border, rgba(0,0,0,0.08))',
                        color: '#9f6958',
                      }}
                    >
                      <Monitor size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="m-0 text-[14px] font-bold truncate" style={{ color: 'var(--cream-text, #1A1917)' }}>
                          {request.requesting_device_name || 'Unknown Device'}
                        </p>
                        <span
                          className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: 'rgba(159, 105, 88, 0.12)',
                            color: '#8b4b39',
                          }}
                        >
                          Requesting Access
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] leading-snug" style={{ color: 'var(--cream-muted, #6B6862)' }}>
                        Wants to unlock and decrypt your journals on this device.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Explanatory security text */}
                <div className="mb-6 flex items-start gap-2.5 px-1">
                  <Shield size={15} className="mt-0.5 shrink-0" style={{ color: '#9f6958' }} />
                  <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--cream-muted, #6B6862)' }}>
                    If this is you signing in, tap <strong style={{ color: 'var(--cream-text, #1A1917)' }}>Approve</strong> to safely share encryption keys. If you did not make this request, tap <strong style={{ color: '#dc2626' }}>Deny</strong> immediately.
                  </p>
                </div>

                {/* Interactive Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDeny}
                    className="approval-btn-deny flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[13.5px] font-semibold cursor-pointer select-none"
                    style={{
                      background: 'rgba(220, 38, 38, 0.06)',
                      borderColor: 'rgba(220, 38, 38, 0.22)',
                      color: '#dc2626',
                    }}
                  >
                    <X size={16} />
                    Deny
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    className="approval-btn-approve flex flex-1 items-center justify-center gap-2 rounded-xl border border-transparent px-4 py-3 text-[13.5px] font-semibold text-white shadow-sm cursor-pointer select-none"
                    style={{
                      background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
                      boxShadow: '0 4px 14px rgba(22, 163, 74, 0.32)',
                    }}
                  >
                    <ShieldCheck size={17} />
                    Approve
                  </button>
                </div>
              </>
            )}

            {state === 'approving' && (
              <div className="flex flex-col items-center gap-3.5 py-6 text-center">
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-3 border-emerald-500/20" />
                  <div className="absolute inset-0 animate-spin rounded-full border-3 border-emerald-600 border-t-transparent" />
                  <ShieldCheck size={24} className="text-emerald-600 animate-pulse" />
                </div>
                <div>
                  <p className="m-0 text-[15px] font-semibold" style={{ color: 'var(--cream-text, #1A1917)' }}>
                    Approving device…
                  </p>
                  <p className="mt-1 text-[12px]" style={{ color: 'var(--cream-muted, #6B6862)' }}>
                    Deriving secure ECDH key & encrypting session key
                  </p>
                </div>
              </div>
            )}

            {(state as string) === 'denying' && (
              <div className="flex flex-col items-center gap-3.5 py-6 text-center">
                <div className="relative flex h-14 w-14 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-3 border-red-500/20" />
                  <div className="absolute inset-0 animate-spin rounded-full border-3 border-red-600 border-t-transparent" />
                  <X size={24} className="text-red-600" />
                </div>
                <div>
                  <p className="m-0 text-[15px] font-semibold text-red-600">
                    Denying request…
                  </p>
                  <p className="mt-1 text-[12px]" style={{ color: 'var(--cream-muted, #6B6862)' }}>
                    Blocking device from accessing your journals
                  </p>
                </div>
              </div>
            )}

            {state === 'approved' && (
              <div
                className="flex flex-col items-center gap-3.5 py-6 text-center"
                style={{ animation: 'approvalSuccessPop 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
              >
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full shadow-md"
                  style={{
                    background: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)',
                    color: '#ffffff',
                    animation: 'approvalPulseGlow 1.8s infinite',
                  }}
                >
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <p className="m-0 text-[16px] font-bold text-emerald-700">
                    Device Approved!
                  </p>
                  <p className="mt-1 text-[12.5px]" style={{ color: 'var(--cream-muted, #6B6862)' }}>
                    The new device is now authorized and can decrypt journals.
                  </p>
                </div>
              </div>
            )}

            {state === 'denied' && (
              <div
                className="flex flex-col items-center gap-3.5 py-6 text-center"
                style={{ animation: 'approvalSuccessPop 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
              >
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full shadow-md"
                  style={{
                    background: 'rgba(220, 38, 38, 0.12)',
                    color: '#dc2626',
                    border: '1px solid rgba(220, 38, 38, 0.25)',
                  }}
                >
                  <X size={30} />
                </div>
                <div>
                  <p className="m-0 text-[16px] font-bold text-red-600">
                    Request Denied
                  </p>
                  <p className="mt-1 text-[12.5px]" style={{ color: 'var(--cream-muted, #6B6862)' }}>
                    The device has been blocked from accessing your account.
                  </p>
                </div>
              </div>
            )}

            {state === 'error' && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: '#dc2626',
                    border: '1px solid rgba(220, 38, 38, 0.2)',
                  }}
                >
                  <AlertCircle size={28} />
                </div>
                <div>
                  <p className="m-0 text-[14.5px] font-semibold text-red-600">{errorMsg || 'Approval failed'}</p>
                  <p className="mt-1 text-[12px]" style={{ color: 'var(--cream-muted, #6B6862)' }}>
                    Could not complete the handshake. Please try again.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleApprove}
                    className="approval-btn-approve flex items-center justify-center gap-2 rounded-xl border border-transparent px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm cursor-pointer select-none"
                    style={{
                      background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
                      boxShadow: '0 4px 14px rgba(22, 163, 74, 0.32)',
                    }}
                  >
                    <RefreshCw size={14} />
                    Retry Approval
                  </button>
                  <button
                    type="button"
                    onClick={() => setState('prompt')}
                    className="rounded-xl border px-4 py-2.5 text-[13px] font-semibold cursor-pointer transition-colors"
                    style={{
                      background: 'var(--cream-inner, #F7F4EC)',
                      borderColor: 'var(--cream-border-strong, rgba(0,0,0,0.12))',
                      color: 'var(--cream-text, #1A1917)',
                    }}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main Handler Component ─────────────────────────────────────────────────────

export default function DeviceApprovalHandler({ userId }: { userId: string }) {
  const [pendingRequest, setPendingRequest] = useState<ApprovalRequest | null>(null);
  const supabaseRef = useRef(createClient());
  // Track request IDs already shown so broadcast + poll don't double-trigger
  const seenRequestIdsRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showRequest = (req: ApprovalRequest) => {
    if (seenRequestIdsRef.current.has(req.request_id)) return;
    seenRequestIdsRef.current.add(req.request_id);
    console.log('[DeviceApprovalHandler] Showing approval prompt for:', req.request_id);
    setPendingRequest(req);
  };

  useEffect(() => {
    if (!userId) return;

    const supabase = supabaseRef.current;
    const channelName = `device-approval:${userId}`;

    // ── Realtime broadcast (fast path) ────────────────────────────────────
    const channel = supabase
      .channel(channelName, { config: { broadcast: { self: true } } })
      .on('broadcast', { event: 'approval_requested' }, ({ payload }) => {
        const req = payload as ApprovalRequest;
        console.log('[DeviceApprovalHandler] Broadcast received:', req.request_id);
        showRequest(req);
      })
      .subscribe((status) => {
        console.log('[DeviceApprovalHandler] Channel status:', status, 'for user:', userId);
      });

    // ── DB polling fallback (reliable path) ───────────────────────────────
    // Polls every 3 s in case the Realtime broadcast was missed (e.g. the
    // WebSocket connection wasn't fully established when the new device sent
    // its request, or the message was dropped due to a network hiccup).
    //
    // We load our own deviceId FIRST so the exclude filter is always correct,
    // even on the very first poll, preventing this device from seeing a request
    // it sent itself (same-browser scenario).

    const pollForPending = async (overrideDeviceId?: string | null) => {
      try {
        const eid = overrideDeviceId !== undefined ? overrideDeviceId : null;
        const url = eid
          ? `/api/encryption/device-approval/pending?exclude_device_id=${encodeURIComponent(eid)}`
          : '/api/encryption/device-approval/pending';
        const res = await fetch(url, { cache: 'no-store' });
        if (res.status === 401) {
          // User is signed out or session has ended — stop polling immediately
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (data.request) {
          showRequest(data.request as ApprovalRequest);
        }
      } catch (e) {
        // Non-fatal — silent failure keeps the UI clean
        console.warn('[DeviceApprovalHandler] Poll error:', e);
      }
    };

    // Load deviceId first, then start polling so the exclude filter is
    // applied from the very first request.
    import('@/utils/encryption/keyManager').then(({ getDeviceId }) => {
      getDeviceId().then(thisDeviceId => {
        console.log('[DeviceApprovalHandler] Starting poll, exclude_device_id:', thisDeviceId);
        // Immediate poll
        pollForPending(thisDeviceId);
        // Recurring poll every 3 s
        pollIntervalRef.current = setInterval(
          () => pollForPending(thisDeviceId),
          3000
        );
      });
    });

    return () => {
      supabase.removeChannel(channel);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!pendingRequest) return null;

  return (
    <ApprovalModal
      request={pendingRequest}
      userId={userId}
      onDone={() => setPendingRequest(null)}
    />
  );
}

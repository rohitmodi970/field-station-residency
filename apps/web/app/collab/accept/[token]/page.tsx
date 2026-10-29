'use client';
// apps/web/app/collab/accept/[token]/page.tsx
// Accept a collaboration journal invitation.
// User must be logged in. If not, redirected to login then back here.
//
// Phase 2: on mount, ensureCollabKeyPair() sets up / confirms the user's RSA key pair
// before the Accept button becomes active. After accept, unwraps the AES journal key.

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import {
  ensureCollabKeyPair,
  unwrapAesKey,
  cacheJournalKey,
} from '@/utils/encryption/collaborationCrypto';
import { importMasterKey } from '@/utils/encryption/crypto';

type Status = 'loading' | 'preparing_key' | 'ready' | 'accepting' | 'success' | 'error' | 'already_used' | 'expired';

interface AcceptResult {
  journal_id?: string;
  role?: string;
  key_ready?: boolean;
  invitee_wrapped_key?: string | null;
  error?: string;
}

export default function AcceptCollabPage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [status, setStatus] = useState<Status>('loading');
  const [result, setResult] = useState<AcceptResult>({});
  const [countdown, setCountdown] = useState(5);

  // Phase 2: RSA key pair for this user (set up during 'preparing_key' phase)
  const [userId, setUserId] = useState<string | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);

  // ── Step 1: Resolve user + ensure RSA key pair on mount ───────────────
  useEffect(() => {
    const setup = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          // Not logged in — redirect to login
          const returnUrl = encodeURIComponent(window.location.pathname);
          router.push(`/auth/login?redirectTo=${returnUrl}`);
          return;
        }

        setUserId(user.id);
        setStatus('preparing_key');

        // Ensure RSA key pair exists for this user (~500ms if generating new)
        const pair = await ensureCollabKeyPair(user.id);
        setPrivateKey(pair.privateKey);
        setStatus('ready');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to set up encryption key';
        setKeyError(msg);
        setStatus('error');
        setResult({ error: msg });
      }
    };

    setup();
  }, [router]);

  // ── Step 2: Accept the invitation ────────────────────────────────────
  const accept = useCallback(async () => {
    if (!token || !privateKey || !userId) return;
    setStatus('accepting');

    try {
      const res = await fetch(`/api/collab/accept/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data: AcceptResult = await res.json();

      if (res.status === 409) { setStatus('already_used'); setResult(data); return; }
      if (res.status === 410) { setStatus('expired');      setResult(data); return; }

      if (!res.ok) {
        setStatus('error');
        setResult(data);
        return;
      }

      // ── Phase 2: Unwrap the journal AES key ──────────────────────────
      if (data.key_ready && data.invitee_wrapped_key && data.journal_id) {
        try {
          const journalAesKey = await unwrapAesKey(data.invitee_wrapped_key, privateKey);
          cacheJournalKey(data.journal_id, journalAesKey);
          console.log('[accept] ✅ Journal AES key unwrapped and cached');
        } catch (err) {
          // Non-fatal: key will be re-fetched when the editor opens
          console.warn('[accept] Failed to unwrap journal key (non-fatal):', err);
        }
      }

      setStatus('success');
      setResult(data);
    } catch {
      setStatus('error');
      setResult({ error: 'Network error. Please try again.' });
    }
  }, [token, privateKey, userId]);

  // ── Auto-redirect to journal after success ────────────────────────────
  useEffect(() => {
    if (status === 'success' && result.journal_id) {
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            router.push(`/journal/${result.journal_id}`);
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status, result.journal_id, router]);

  // ── Helpers ───────────────────────────────────────────────────────────
  const headerEmoji =
    status === 'preparing_key' ? '🔐' :
    status === 'ready'         ? '✉️' :
    status === 'accepting'     ? '⏳' :
    status === 'success'       ? '✅' :
    status === 'expired'       ? '⏰' :
    status === 'already_used'  ? 'ℹ️' : '❌';

  const headerTitle =
    status === 'loading'       ? 'Loading…' :
    status === 'preparing_key' ? 'Setting up your key…' :
    status === 'ready'         ? 'Accept invitation' :
    status === 'accepting'     ? 'Accepting…' :
    status === 'success'       ? 'You\'re in!' :
    status === 'error'         ? 'Something went wrong' :
    status === 'expired'       ? 'Invitation expired' :
                                 'Already processed';

  const isButtonDisabled =
    status === 'loading' ||
    status === 'preparing_key' ||
    status === 'accepting' ||
    status === 'success';

  return (
    <div className="min-h-screen bg-[#0f0f14] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-violet-500/20 rounded-2xl overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-8 py-6 text-center">
            <div className="text-5xl mb-3">{headerEmoji}</div>
            <h1 className="text-white text-xl font-bold tracking-tight">{headerTitle}</h1>
          </div>

          {/* Body */}
          <div className="px-8 py-8 space-y-5">

            {/* Loading / preparing key */}
            {(status === 'loading' || status === 'preparing_key') && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                <p className="text-slate-400 text-sm text-center">
                  {status === 'preparing_key'
                    ? 'Setting up your end-to-end encryption key… (first time only, ~1 second)'
                    : 'Verifying your invitation…'}
                </p>
              </div>
            )}

            {/* Ready to accept */}
            {status === 'ready' && (
              <>
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 text-center">
                  <p className="text-violet-300 text-sm">
                    Your encryption key is ready. Click below to accept the invitation.
                  </p>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-emerald-400 text-sm flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">🔐</span>
                    <span>
                      This journal is <strong>end-to-end encrypted</strong>. Only you
                      and your collaborators can read the content.
                    </span>
                  </p>
                </div>

                <button
                  id="accept-invite-btn"
                  onClick={accept}
                  disabled={isButtonDisabled}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Accept Invitation
                </button>
              </>
            )}

            {/* Accepting (spinner while API call runs) */}
            {status === 'accepting' && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                <p className="text-slate-400 text-sm text-center">
                  Accepting invitation and setting up access…
                </p>
              </div>
            )}

            {/* Success */}
            {status === 'success' && (
              <>
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 text-center">
                  <p className="text-violet-300 font-medium">
                    You now have <span className="font-bold capitalize">{result.role}</span> access to this journal
                  </p>
                  {!result.key_ready && (
                    <p className="text-amber-400 text-sm mt-2">
                      ⚠ Your encryption key isn&apos;t set up yet. The journal owner will
                      grant you access once your key is ready.
                    </p>
                  )}
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <p className="text-emerald-400 text-sm flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">🔐</span>
                    <span>
                      This journal is <strong>end-to-end encrypted</strong>. Only you
                      and your collaborators can read the content.
                    </span>
                  </p>
                </div>

                <button
                  onClick={() => router.push(`/journal/${result.journal_id}`)}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 text-sm"
                >
                  Open Journal
                </button>

                <p className="text-slate-500 text-xs text-center">
                  Redirecting in {countdown}s…
                </p>
              </>
            )}

            {/* Expired */}
            {status === 'expired' && (
              <>
                <p className="text-slate-300 text-sm text-center leading-relaxed">
                  This invitation link has expired. Invitations are valid for 7 days.
                  Ask the journal owner to send a new invitation.
                </p>
                <Link
                  href="/dashboard"
                  className="block w-full bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-3 rounded-xl text-center text-sm transition-all duration-200"
                >
                  Go to Dashboard
                </Link>
              </>
            )}

            {/* Already used */}
            {status === 'already_used' && (
              <>
                <p className="text-slate-300 text-sm text-center leading-relaxed">
                  {result.error ?? 'This invitation has already been processed.'}
                </p>
                <Link
                  href="/dashboard"
                  className="block w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 rounded-xl text-center text-sm transition-all duration-200"
                >
                  Go to Dashboard
                </Link>
              </>
            )}

            {/* Error */}
            {status === 'error' && (
              <>
                <p className="text-slate-300 text-sm text-center leading-relaxed">
                  {keyError ?? result.error ?? 'Failed to accept the invitation. Please try again or contact support.'}
                </p>
                {!keyError && (
                  <div className="flex gap-3">
                    <button
                      onClick={accept}
                      disabled={!privateKey}
                      className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 rounded-xl text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Retry
                    </button>
                    <Link
                      href="/dashboard"
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-3 rounded-xl text-center text-sm transition-all duration-200"
                    >
                      Dashboard
                    </Link>
                  </div>
                )}
                {keyError && (
                  <Link
                    href="/security"
                    className="block w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 rounded-xl text-center text-sm transition-all duration-200"
                  >
                    Go to Security Center
                  </Link>
                )}
              </>
            )}

          </div>

          {/* Footer */}
          <div className="border-t border-white/5 px-8 py-4 text-center">
            <p className="text-slate-600 text-xs">
              This invitation link is single-use and bound to your email address.
            </p>
          </div>
        </div>

        {/* Force branding */}
        <p className="text-center text-slate-700 text-sm mt-6 font-bold tracking-tight">
          force.
        </p>
      </div>
    </div>
  );
}

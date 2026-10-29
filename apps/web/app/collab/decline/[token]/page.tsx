'use client';
// apps/web/app/collab/decline/[token]/page.tsx
// Decline a collaboration journal invitation.
// Intentionally unauthenticated — clicking the link in the email is enough.

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Status = 'loading' | 'success' | 'error' | 'already_used';

interface DeclineResult {
  error?: string;
}

export default function DeclineCollabPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [status, setStatus] = useState<Status>('loading');
  const [result, setResult] = useState<DeclineResult>({});

  const decline = useCallback(async () => {
    if (!token) {
      setStatus('error');
      setResult({ error: 'Invalid invitation link' });
      return;
    }

    try {
      const res = await fetch(`/api/collab/decline/${token}`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.status === 409) {
        setStatus('already_used');
        setResult(data);
        return;
      }

      if (!res.ok) {
        setStatus('error');
        setResult(data);
        return;
      }

      setStatus('success');
    } catch {
      setStatus('error');
      setResult({ error: 'Network error. Please try again.' });
    }
  }, [token]);

  useEffect(() => {
    decline();
  }, [decline]);

  return (
    <div className="min-h-screen bg-[#0f0f14] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="bg-gradient-to-r from-slate-700 to-slate-600 px-8 py-6 text-center">
            <div className="text-5xl mb-3">
              {status === 'loading' ? '⏳' :
               status === 'success' ? '👋' :
               status === 'already_used' ? 'ℹ️' : '❌'}
            </div>
            <h1 className="text-white text-xl font-bold tracking-tight">
              {status === 'loading' && 'Processing…'}
              {status === 'success' && 'Invitation declined'}
              {status === 'error' && 'Something went wrong'}
              {status === 'already_used' && 'Already processed'}
            </h1>
          </div>

          {/* Body */}
          <div className="px-8 py-8 space-y-5">

            {status === 'loading' && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
                <p className="text-slate-400 text-sm text-center">Declining invitation…</p>
              </div>
            )}

            {status === 'success' && (
              <>
                <p className="text-slate-300 text-sm text-center leading-relaxed">
                  The invitation has been declined. The journal owner has been notified.
                  You can always ask them to send a new invitation in the future.
                </p>
                <Link
                  href="/dashboard"
                  className="block w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold py-3.5 rounded-xl text-center text-sm transition-all duration-200"
                >
                  Go to Dashboard
                </Link>
                <Link
                  href="/"
                  className="block w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-3 rounded-xl text-center text-sm transition-all duration-200"
                >
                  Return to Home
                </Link>
              </>
            )}

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

            {status === 'error' && (
              <>
                <p className="text-slate-300 text-sm text-center leading-relaxed">
                  {result.error ?? 'Failed to decline the invitation. Please try again.'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={decline}
                    className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-medium py-3 rounded-xl text-sm transition-all duration-200"
                  >
                    Retry
                  </button>
                  <Link
                    href="/"
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-3 rounded-xl text-center text-sm transition-all duration-200"
                  >
                    Home
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/5 px-8 py-4 text-center">
            <p className="text-slate-600 text-xs">
              Declining this invitation does not delete any of your data.
            </p>
          </div>
        </div>

        <p className="text-center text-slate-700 text-sm mt-6 font-bold tracking-tight">
          force.
        </p>
      </div>
    </div>
  );
}

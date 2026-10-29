"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

function ConnectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const platform = searchParams?.get('platform') || '';
  const sender = searchParams?.get('sender') || '';
  const t = searchParams?.get('t') || '';
  const sig = searchParams?.get('sig') || '';

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function checkAuthAndLink() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setIsLoggedIn(false);
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);

      if (!platform || !sender) {
        setError('Missing connection parameters.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, sender, t, sig }),
        });

        const data = await res.json();
        if (data.ok) {
          setSuccess(true);
        } else {
          setError(data.error || 'Failed to link account.');
        }
      } catch (err: any) {
        setError(err.message || 'Network error linking account.');
      } finally {
        setLoading(false);
      }
    }

    checkAuthAndLink();
  }, [platform, sender, t, sig]);

  const platformLabel = platform === 'telegram' ? 'Telegram' : platform === 'imessage' ? 'iMessage' : platform === 'whatsapp' ? 'WhatsApp' : 'Messaging';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 selection:bg-white/20">
      <div className="w-full max-w-md bg-white/[0.03] border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-2xl text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/5 border border-white/10 text-2xl mb-2">
          {platform === 'telegram' ? '✈️' : platform === 'imessage' ? '💬' : '⚡'}
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">Connect {platformLabel}</h1>

        {loading && (
          <div className="py-6 flex flex-col items-center space-y-3">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-sm text-neutral-400">Linking your account to Force Agent...</p>
          </div>
        )}

        {!loading && !isLoggedIn && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-neutral-300">
              Please log in to your Force account to connect your {platformLabel} handle ({sender}).
            </p>
            <div className="pt-2">
              <Link
                href={`/login?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '/connect')}`}
                className="w-full inline-block py-3 px-6 rounded-xl bg-white text-black font-medium text-sm hover:bg-neutral-200 transition-colors shadow-lg shadow-white/5"
              >
                Log In to Connect
              </Link>
            </div>
          </div>
        )}

        {!loading && isLoggedIn && success && (
          <div className="space-y-4 py-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              ✓ Successfully Connected
            </div>
            <p className="text-sm text-neutral-300 leading-relaxed">
              Your <span className="font-semibold text-white">{platformLabel}</span> account is now linked to Force Agent!
            </p>
            <p className="text-xs text-neutral-400">
              You can now text <span className="text-neutral-200">@force_agent_bot_newbot</span> anytime to capture tasks, log reflections, and explore sidequests.
            </p>
            <div className="pt-4 flex flex-col gap-2">
              <Link
                href="/agent"
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium transition-colors"
              >
                Open Force Web Agent
              </Link>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="space-y-4 py-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              Linking Failed
            </div>
            <p className="text-sm text-neutral-300">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-neutral-400 underline hover:text-white transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-neutral-500 text-sm">Loading...</div>}>
      <ConnectContent />
    </Suspense>
  );
}

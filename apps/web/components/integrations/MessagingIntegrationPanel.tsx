 'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Send, MessageSquare, Database, RefreshCw } from 'lucide-react';

type PhotonMessageRow = {
  id: string;
  platform: string | null;
  platform_id: string | null;
  message_id: string | null;
  content_type: string | null;
  content_text: string | null;
  created_at: string;
};

type Props = {
  settings: any;
  isDarkMode: boolean;
  accentColor: string;
  onUpdateSettings: (updates: any) => Promise<void>;
};

export function MessagingIntegrationPanel({ settings, isDarkMode, accentColor, onUpdateSettings }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [telegramIdToLink, setTelegramIdToLink] = useState('');
  const [linkedSuccess, setLinkedSuccess] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PhotonMessageRow[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotPage, setSnapshotPage] = useState(1);
  const [snapshotTotal, setSnapshotTotal] = useState(0);
  const snapshotLimit = 5;

  useEffect(() => {
    fetchSnapshot();
  }, [snapshotPage]);

  const fetchSnapshot = async () => {
    setSnapshotLoading(true);
    setSnapshotError(null);

    try {
      const res = await fetch(`/api/user/photon-snapshot?limit=${snapshotLimit}&page=${snapshotPage}`, {
        cache: 'no-store',
      });
      const data = await res.json();

      if (!res.ok) {
        setSnapshotError(data?.error || 'Failed to load Photon snapshot');
        setSnapshot([]);
        return;
      }

      setSnapshot(data.messages || []);
      setSnapshotTotal(data.total || 0);
    } catch (e: any) {
      setSnapshotError(e?.message || 'Network error');
      setSnapshot([]);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const fieldClass = 'w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-opacity-50';
  const sectionClass = `rounded-[24px] border p-5 ${isDarkMode ? 'border-slate-700 bg-slate-950/55' : 'border-[#dcc7bb] bg-[#fffdfa]'}`;

  return (
    <section className={sectionClass}>
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] opacity-70">
            <MessageSquare size={16} />
            Telegram Setup
          </div>
          <h2 className="mt-2 text-2xl font-semibold">Connect Force on Telegram</h2>
          <p className="mt-2 text-sm opacity-75">
            Your personal AI companion is available 24/7 on Telegram. It works for every member with isolated memory and private data storage.
          </p>
        </div>

        {/* 1-Click Telegram Bot Launch Card */}
        <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50/50 p-5 dark:border-sky-900/50 dark:from-sky-950/30 dark:to-slate-900/40">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#229ED9] text-white shadow-md shadow-sky-500/20">
                <Send size={22} className="translate-x-[-1px] translate-y-[1px]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">@force_agent_bot_newbot</h3>
                  <span className="rounded-full bg-sky-100 dark:bg-sky-950 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Launch the bot directly in your Telegram app on mobile or desktop.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href="https://t.me/force_agent_bot_newbot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-[#229ED9] hover:bg-[#1E88E5] px-5 py-2.5 text-xs font-semibold text-white shadow transition"
              >
                <Send size={13} />
                <span>Open in Telegram</span>
              </a>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-sky-100 dark:border-sky-900/30 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Direct link: <code className="font-mono text-sky-700 dark:text-sky-300">https://t.me/force_agent_bot_newbot</code></span>
            <span className="hidden sm:inline">Multi-tenant & private</span>
          </div>
        </div>

        <div className="mt-2 rounded-xl border p-4">
          <h4 className="text-base font-semibold">Manual Link (Optional)</h4>
          <p className="text-xs opacity-70 mt-1">If you prefer manual linking instead of the automatic 1-tap link, enter your Telegram user ID or @username below:</p>
          <div className="mt-3 flex gap-2 flex-col sm:flex-row">
            <input
              className={fieldClass}
              placeholder="Telegram ID or @username"
              value={telegramIdToLink}
              onChange={(e) => setTelegramIdToLink(e.target.value)}
            />
            <button
              onClick={async () => {
                if (!telegramIdToLink.trim()) return;
                setLinking(true);
                setLinkedSuccess(null);
                setError(null);
                try {
                  const res = await fetch('/api/user/external-account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ provider: 'telegram', external_id: telegramIdToLink.trim() })
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setLinkedSuccess('Telegram account linked successfully.');
                    setTelegramIdToLink('');
                  } else {
                    setError(data?.error || 'Failed to link Telegram ID');
                  }
                } catch (e: any) {
                  setError(e?.message || 'Network error');
                } finally {
                  setLinking(false);
                }
              }}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold text-white ${linking ? 'bg-gray-400' : 'bg-black hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700'}`}
            >
              {linking ? 'Linking…' : 'Link Account'}
            </button>
          </div>
          {linkedSuccess && <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{linkedSuccess}</div>}
          {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>

        <div className="mt-6 rounded-xl border p-4 bg-white/80 dark:bg-slate-950/55">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm uppercase tracking-[0.18em] opacity-70">
                <Database size={16} /> Photon Message Snapshot
              </div>
              <p className="mt-2 text-sm opacity-75">A live preview of the latest messages stored in your Photon message table.</p>
            </div>
            <button
              onClick={fetchSnapshot}
              disabled={snapshotLoading}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition hover:bg-slate-100 disabled:opacity-60"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              <RefreshCw size={14} className={snapshotLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {snapshotError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{snapshotError}</div>
          )}

          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/70">
            <table className="w-full text-left text-sm text-slate-700 dark:text-slate-200">
              <thead>
                <tr>
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Platform</th>
                  <th className="py-2 pr-3 font-medium">Message ID</th>
                  <th className="py-2 pr-3 font-medium">Content</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-sm text-slate-500 dark:text-slate-400">
                      {snapshotLoading ? 'Loading snapshot…' : 'No Photon messages found yet.'}
                    </td>
                  </tr>
                ) : (
                  snapshot.map((message) => (
                    <tr key={message.id} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="py-3 pr-3 align-top text-xs text-slate-500 dark:text-slate-400">{new Date(message.created_at).toLocaleString()}</td>
                      <td className="py-3 pr-3 align-top">{message.platform || 'unknown'}</td>
                      <td className="py-3 pr-3 align-top text-xs text-slate-600 dark:text-slate-300">{message.message_id || '—'}</td>
                      <td className="py-3 pr-3 align-top text-xs text-slate-700 dark:text-slate-200">{message.content_text ? message.content_text.slice(0, 120) : message.content_type || 'No text'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {snapshotTotal > snapshotLimit && (
            <div className="mt-3 flex items-center justify-between text-xs opacity-75">
              <span>{`Showing ${Math.min(snapshot.length, snapshotLimit)} of ${snapshotTotal} photon messages`}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSnapshotPage(Math.max(1, snapshotPage - 1))}
                  disabled={snapshotPage === 1}
                  className="rounded-full border px-3 py-1 transition disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setSnapshotPage(snapshotPage + 1)}
                  disabled={snapshotPage * snapshotLimit >= snapshotTotal}
                  className="rounded-full border px-3 py-1 transition disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

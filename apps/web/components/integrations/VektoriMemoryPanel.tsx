'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, RefreshCw, Shield, Trash2, Workflow } from 'lucide-react';
import { VektoriMemoryExplorer } from '@/components/integrations/VektoriMemoryExplorer';
import { VektoriBackfillButton } from '@/components/integrations/VektoriBackfillButton';

type UserSettings = {
  memory_opt_in?: boolean;
  memory_retention_days?: number | null;
  memory_rollout_percent?: number | null;
  memory_last_cleared_at?: string | null;
};

type VektoriHealth = {
  ok: boolean;
  runtime?: {
    enabled: boolean;
    configured: boolean;
    coolingDown: boolean;
    failureCount: number;
    disabledUntil: number;
    rolloutPercent: number;
  };
  metrics?: {
    ingestSuccessCount: number;
    ingestFailureCount: number;
    searchSuccessCount: number;
    searchFailureCount: number;
    clearSuccessCount: number;
    clearFailureCount: number;
    healthSuccessCount: number;
    healthFailureCount: number;
    lastMetricEventAt: number;
  };
  service?: { ok: boolean; status?: number; error?: string };
  error?: string;
};

type Props = {
  settings: UserSettings | null;
  saving: boolean;
  isDarkMode: boolean;
  accentColor: string;
  onUpdateSettings: (updates: Partial<UserSettings>) => Promise<void>;
};

const retentionOptions = [30, 90, 365, 730];

export function VektoriMemoryPanel({ settings, saving, isDarkMode, accentColor, onUpdateSettings }: Props) {
  const [health, setHealth] = useState<VektoriHealth | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [busyAction, setBusyAction] = useState<'clear' | 'opt-in' | 'opt-out' | null>(null);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try {
      const response = await fetch('/api/vektori/health', { cache: 'no-store' });
      const data = await response.json().catch(() => null);
      setHealth(data);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const privacyEnabled = settings?.memory_opt_in ?? true;
  const rolloutPercent = settings?.memory_rollout_percent ?? 100;
  const retentionDays = settings?.memory_retention_days ?? 365;
  const lastCleared = settings?.memory_last_cleared_at ?? null;

  const runtimeEnabled = health?.runtime?.enabled ?? false;
  const serviceHealthy = health?.service?.ok ?? false;
  const isCoolingDown = health?.runtime?.coolingDown ?? false;

  const statusTone = useMemo(() => {
    if (!privacyEnabled) return { label: 'Opted out', color: '#8b5e56' };
    if (runtimeEnabled && serviceHealthy && !isCoolingDown) return { label: 'Healthy', color: '#256f5f' };
    if (runtimeEnabled && !serviceHealthy) return { label: 'Degraded', color: '#a16207' };
    return { label: 'Fallback active', color: '#7a5148' };
  }, [privacyEnabled, runtimeEnabled, serviceHealthy, isCoolingDown]);

  const updateRolloutPercent = async (percent: number) => {
    await onUpdateSettings({ memory_rollout_percent: percent });
    await fetchHealth();
  };

  const updateRetention = async (days: number) => {
    await onUpdateSettings({ memory_retention_days: days });
  };

  const handleClear = async () => {
    setBusyAction('clear');
    try {
      const response = await fetch('/api/vektori/privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.privacy) {
          await onUpdateSettings(data.privacy);
        }
        await fetchHealth();
      }
    } finally {
      setBusyAction(null);
    }
  };

  const toggleOptIn = async (nextValue: boolean) => {
    setBusyAction(nextValue ? 'opt-in' : 'opt-out');
    try {
      const response = await fetch('/api/vektori/privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextValue ? 'opt_in' : 'opt_out' }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.privacy) {
          await onUpdateSettings(data.privacy);
        }
        await fetchHealth();
      }
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className={`overflow-hidden rounded-[30px] border p-5 shadow-[0_12px_34px_rgba(94,71,51,0.1)] ${isDarkMode ? 'border-slate-700/70 bg-slate-900/75 text-slate-100' : 'border-[#d9c3b5]/70 bg-[#fff8f2]/94 text-[#3f2a24]'}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ borderColor: accentColor + '55', color: accentColor }}>
            <Workflow size={12} /> Memory Layer
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.02em]" style={{ fontFamily: 'var(--dashboard-heading-font, Georgia, serif)' }}>
              Vektori is the memory engine behind your journal timeline.
            </h2>
            <p className={`mt-2 text-sm leading-6 ${isDarkMode ? 'text-slate-300' : 'text-[#6f5048]'}`}>
              It captures evolving thoughts, corrections, emotional shifts, and causal context. When it is unavailable, your existing memory flow stays in place automatically.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Ingest', value: runtimeEnabled ? 'Background sync' : 'Fallback only', icon: Activity },
              { label: 'Retrieve', value: serviceHealthy ? 'Live search' : 'Legacy memory', icon: ArrowRight },
              { label: 'Privacy', value: privacyEnabled ? 'Opted in' : 'Opted out', icon: Shield },
            ].map((item) => (
              <div key={item.label} className={`rounded-2xl border p-4 ${isDarkMode ? 'border-slate-700 bg-slate-950/50' : 'border-[#dcc7bb]/70 bg-[#fffdfa]'}`}>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] opacity-70">
                  <item.icon size={12} /> {item.label}
                </div>
                <p className="mt-2 text-sm font-semibold">{item.value}</p>
              </div>
            ))}
          </div>

          <div className={`grid gap-3 rounded-[24px] border p-4 ${isDarkMode ? 'border-slate-700 bg-slate-950/55' : 'border-[#e0cabd] bg-[#fffdfa]'}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] opacity-70">Live diagnostics</p>
                <p className="mt-1 text-sm font-medium">{statusTone.label}</p>
              </div>
              <button
                onClick={fetchHealth}
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 disabled:opacity-60"
                style={{ borderColor: accentColor + '55', color: accentColor }}
                disabled={loadingHealth}
              >
                <RefreshCw size={12} className={loadingHealth ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Enabled" value={health?.runtime?.enabled ? 'Yes' : 'No'} tone={health?.runtime?.enabled ? accentColor : '#8b5e56'} />
              <Stat label="Configured" value={health?.runtime?.configured ? 'Yes' : 'No'} tone={health?.runtime?.configured ? '#256f5f' : '#8b5e56'} />
              <Stat label="Cooldown" value={health?.runtime?.coolingDown ? 'Active' : 'Clear'} tone={health?.runtime?.coolingDown ? '#a16207' : '#256f5f'} />
              <Stat label="Rollout" value={`${health?.runtime?.rolloutPercent ?? rolloutPercent}%`} tone={accentColor} />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Ingest ok" value={`${health?.metrics?.ingestSuccessCount ?? 0}`} tone="#256f5f" />
              <Stat label="Search ok" value={`${health?.metrics?.searchSuccessCount ?? 0}`} tone="#256f5f" />
              <Stat label="Fallbacks" value={`${(health?.metrics?.ingestFailureCount ?? 0) + (health?.metrics?.searchFailureCount ?? 0)}`} tone="#a16207" />
              <Stat label="Last event" value={health?.metrics?.lastMetricEventAt ? new Date(health.metrics.lastMetricEventAt).toLocaleTimeString() : '—'} tone={accentColor} />
            </div>

            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#7a5148]'}`}>
              {health?.service?.ok
                ? `Upstream service reachable${health.service.status ? ` (${health.service.status})` : ''}.`
                : 'Upstream service unavailable right now, so chat and journal flows fall back to the legacy memory path.'}
            </p>
          </div>
        </div>

        <div className={`w-full max-w-[360px] rounded-[28px] border p-4 ${isDarkMode ? 'border-slate-700 bg-slate-950/50' : 'border-[#dcc7bb]/70 bg-[#fffdfa]'}`}>
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] opacity-70">Controls</p>
              <h3 className="mt-1 text-lg font-semibold">Memory lifecycle</h3>
            </div>

            <div className="rounded-2xl border p-4" style={{ borderColor: accentColor + '35', background: isDarkMode ? 'rgba(15,23,42,0.72)' : 'rgba(255,250,246,0.9)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Memory opt-in</p>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#7a5148]'}`}>Keep Vektori active for your account.</p>
                </div>
                <button
                  onClick={() => toggleOptIn(!privacyEnabled)}
                  disabled={saving || busyAction !== null}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60"
                  style={{ backgroundColor: privacyEnabled ? accentColor : '#9CA3AF' }}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${privacyEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Rollout percent</label>
              <div className="flex flex-wrap gap-2">
                {[0, 25, 50, 100].map((value) => (
                  <button
                    key={value}
                    onClick={() => updateRolloutPercent(value)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${rolloutPercent === value ? 'font-semibold' : ''}`}
                    style={{ borderColor: rolloutPercent === value ? accentColor : (isDarkMode ? '#374151' : '#dfc7b9'), color: rolloutPercent === value ? accentColor : 'inherit' }}
                  >
                    {value}%
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Retention horizon</label>
              <div className="grid grid-cols-2 gap-2">
                {retentionOptions.map((days) => (
                  <button
                    key={days}
                    onClick={() => updateRetention(days)}
                    className={`rounded-2xl border px-3 py-2 text-left text-sm transition ${retentionDays === days ? 'font-semibold' : ''}`}
                    style={{ borderColor: retentionDays === days ? accentColor : (isDarkMode ? '#374151' : '#dfc7b9'), background: retentionDays === days ? `${accentColor}12` : 'transparent' }}
                  >
                    {days} days
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <VektoriBackfillButton
                isDarkMode={isDarkMode}
                accentColor={accentColor}
                disabled={!privacyEnabled || saving || busyAction !== null}
                onComplete={fetchHealth}
              />

              <button
                onClick={handleClear}
                disabled={busyAction !== null || saving}
                className="flex w-full items-center justify-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold transition hover:opacity-80 disabled:opacity-60"
                style={{ borderColor: '#d98d86', color: '#a14b43', background: isDarkMode ? 'rgba(127,29,29,0.14)' : '#fff5f3' }}
              >
                <Trash2 size={14} /> Clear memory
              </button>

              <div className={`rounded-2xl border p-3 text-xs leading-5 ${isDarkMode ? 'border-slate-700 bg-slate-950/50 text-slate-300' : 'border-[#dcc7bb] bg-[#fffdfa] text-[#6f5048]'}`}>
                <div className="flex items-center gap-2 font-semibold" style={{ color: accentColor }}>
                  <CheckCircle2 size={14} /> Fallback-safe
                </div>
                <p className="mt-2">
                  If Vektori is down, chat and journal analysis continue through the legacy memory path with no user-visible break.
                </p>
                {lastCleared && <p className="mt-2">Last cleared: {new Date(lastCleared).toLocaleString()}</p>}
                {health?.runtime?.failureCount ? <p className="mt-2">Recent failures: {health.runtime.failureCount}</p> : null}
                {busyAction && <p className="mt-2">Working on {busyAction.replace('-', ' ')}...</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <VektoriMemoryExplorer isDarkMode={isDarkMode} accentColor={accentColor} compact />
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border px-3 py-3" style={{ borderColor: `${tone}33` }}>
      <p className="text-[10px] uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-1 text-sm font-semibold" style={{ color: tone }}>{value}</p>
    </div>
  );
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowRight, CheckCircle2, Clock3, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { VektoriMemoryExplorer } from '@/components/integrations/VektoriMemoryExplorer'
import { VektoriBackfillButton } from '@/components/integrations/VektoriBackfillButton'
import { BACKFILL_SUMMARY_KEY, getIndexedJournalCount, loadSyncLedger } from '@/utils/vektori/syncLedger'

const FALLBACK_ACCENT = '#4A7DA5'
const BAR_ACTIVE = '#4A7DA5'
const BAR_INACTIVE = '#D4C4BC'

type VektoriRuntime = {
  enabled: boolean
  configured: boolean
  coolingDown: boolean
  failureCount: number
  disabledUntil: number
  rolloutPercent: number
}

type VektoriHealth = {
  ok: boolean
  runtime?: VektoriRuntime
  metrics?: {
    ingestSuccessCount: number
    ingestFailureCount: number
    searchSuccessCount: number
    searchFailureCount: number
    lastMetricEventAt: number
  }
  service?: { ok: boolean; status?: number; error?: string; storeCount?: number }
  error?: string
}

type BackfillSummary = {
  ingested: number
  unchanged?: number
  skipped: number
  failed: number
  total: number
  uniqueIndexed?: number
  completedAt: string
}

const BACKFILL_STORAGE_KEY = BACKFILL_SUMMARY_KEY

type Props = {
  isDarkMode: boolean
  accentColor: string
  totalEntries: number
  streakCount: number
  weeklyEntries: number
  lastEntryDate: string | null
}

function formatLastEntry(lastEntryDate: string | null) {
  if (!lastEntryDate) return 'No journal yet'

  const timestamp = new Date(lastEntryDate).getTime()
  if (Number.isNaN(timestamp)) return 'Recent'

  const daysAgo = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))
  if (daysAgo <= 0) return 'Today'
  if (daysAgo === 1) return '1 day ago'
  return `${daysAgo} days ago`
}

export function VektoriSnapshot({
  isDarkMode,
  accentColor,
  totalEntries,
  streakCount,
  weeklyEntries,
  lastEntryDate,
}: Props) {
  const [health, setHealth] = useState<VektoriHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [backfillSummary, setBackfillSummary] = useState<BackfillSummary | null>(null)
  const [indexedCount, setIndexedCount] = useState(0)

  const accent = accentColor?.trim() || FALLBACK_ACCENT

  const fetchHealth = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/vektori/health', { cache: 'no-store' })
      const data = await response.json().catch(() => null)
      setHealth(data)
    } catch {
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()

    try {
      const raw = localStorage.getItem(BACKFILL_STORAGE_KEY)
      if (raw) {
        setBackfillSummary(JSON.parse(raw) as BackfillSummary)
      }
      setIndexedCount(getIndexedJournalCount(loadSyncLedger()))
    } catch {
      setBackfillSummary(null)
      setIndexedCount(0)
    }
  }, [fetchHealth])

  const handleBackfillComplete = useCallback(() => {
    setIndexedCount(getIndexedJournalCount(loadSyncLedger()))
    fetchHealth()
  }, [fetchHealth])

  const handleBackfillSummary = useCallback((summary: BackfillSummary) => {
    setBackfillSummary(summary)
    setIndexedCount(summary.uniqueIndexed ?? getIndexedJournalCount(loadSyncLedger()))
    try {
      localStorage.setItem(BACKFILL_STORAGE_KEY, JSON.stringify(summary))
    } catch {
      // ignore storage failures
    }
  }, [])

  const statusLabel = useMemo(() => {
    if (!health?.runtime?.enabled) return 'Not available'
    if (health?.service?.ok) return 'Available'
    if (health?.runtime?.coolingDown) return 'Temporarily limited'
    return 'Limited'
  }, [health])

  const signalBars = useMemo(() => {
    const liveCount = health?.service?.storeCount
    const indexed = typeof liveCount === 'number' && liveCount > 0 ? liveCount : indexedCount || backfillSummary?.uniqueIndexed || 0
    const target = Math.max(totalEntries, indexed, 1)
    const fillRatio = Math.min(1, indexed / target)
    const activeBars = Math.max(indexed > 0 ? 1 : 0, Math.round(fillRatio * 6))

    return Array.from({ length: 6 }, (_, index) => ({
      height: 28 + index * 10,
      active: index < activeBars,
    }))
  }, [backfillSummary?.uniqueIndexed, health?.service?.storeCount, indexedCount, totalEntries])

  const liveStoreCount = health?.service?.storeCount
  const memoryReady = (liveStoreCount ?? 0) > 0 || indexedCount > 0
  const storeMismatch = indexedCount > 0 && typeof liveStoreCount === 'number' && liveStoreCount === 0

  const serviceHealthy = Boolean(health?.service?.ok)
  const runtimeEnabled = Boolean(health?.runtime?.enabled)

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-[28px] border p-5 shadow-[0_14px_34px_rgba(94,71,51,0.1)] ${isDarkMode ? 'border-slate-700/70 bg-slate-900/76 text-slate-100' : 'border-[#d9c3b6]/65 bg-[#fff9f4]/94 text-[#402a24]'}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: isDarkMode ? 'radial-gradient(circle at 20% 20%, rgba(96,165,250,0.12), transparent 34%), radial-gradient(circle at 80% 0%, rgba(134,239,172,0.10), transparent 30%)' : 'radial-gradient(circle at 20% 20%, rgba(232,93,93,0.11), transparent 34%), radial-gradient(circle at 80% 0%, rgba(118,159,109,0.10), transparent 30%)' }} />

      <div className="relative z-10 space-y-4">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ borderColor: `${accent}55`, color: accent }}>
            <Sparkles size={12} /> Memory snapshot
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.02em]" style={{ fontFamily: 'var(--dashboard-heading-font, Georgia, serif)' }}>
              Your journal memory status
            </h2>
            <p className={`mt-2 max-w-2xl text-sm leading-6 ${isDarkMode ? 'text-slate-300' : 'text-[#6c4f47]'}`}>
              This section shows how much of your writing is remembered and ready for fast search.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Journal entries', value: totalEntries.toLocaleString(), icon: Activity },
              { label: 'Current streak', value: streakCount > 0 ? `${streakCount} days` : 'Not tracked', icon: Clock3 },
              { label: 'This week', value: `${weeklyEntries} entries`, icon: ArrowRight },
              { label: 'Last entry', value: formatLastEntry(lastEntryDate), icon: CheckCircle2 },
            ].map((item) => (
              <div key={item.label} className={`rounded-2xl border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-950/50' : 'border-[#e0c9bc]/70 bg-[#fffcfa]'}`}>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] opacity-70">
                  <item.icon size={12} /> {item.label}
                </div>
                <p className="mt-2 text-lg font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-[28px] border p-4 ${isDarkMode ? 'border-slate-700 bg-slate-950/55' : 'border-[#e0cabd] bg-[#fffdfa]'}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] opacity-70">Memory status</p>
              <p className="mt-1 text-sm font-semibold">{statusLabel}</p>
            </div>
            <div className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: `${accent}55`, color: accent }}>
              {loading ? 'Refreshing' : runtimeEnabled ? 'Live' : 'Offline'}
            </div>
          </div>

          <div className="mt-4 rounded-3xl border p-4" style={{ borderColor: `${accent}33`, background: isDarkMode ? 'rgba(15,23,42,0.58)' : '#f7f1ec' }}>
            <p className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-[#7a5148]'}`}>
              {memoryReady
                ? 'Your journal history is available for quick search.'
                : 'Your journal history is being prepared in the background. You can continue writing — search will be ready shortly.'}
            </p>
          </div>

          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-2xl border px-3 py-2" style={{ borderColor: `${accent}22` }}>
              <span className="text-xs uppercase tracking-[0.16em] opacity-70">Connection</span>
              <span className="font-semibold">{serviceHealthy ? 'Connected' : 'Offline'}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border px-3 py-2" style={{ borderColor: `${accent}22` }}>
              <span className="text-xs uppercase tracking-[0.16em] opacity-70">Search</span>
              <span className="font-semibold">{memoryReady ? 'Ready' : 'Preparing'}</span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <VektoriBackfillButton
              isDarkMode={isDarkMode}
              accentColor={accent}
              onComplete={handleBackfillComplete}
              onSummary={handleBackfillSummary}
            />
            <Link href="/settings?tab=integrations" className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition hover:opacity-80" style={{ borderColor: `${accent}55`, color: accent }}>
              Open settings <ArrowRight size={12} />
            </Link>
          </div>
          
        </div>
      </div>

      <div className="relative z-10">
        <VektoriMemoryExplorer
          isDarkMode={isDarkMode}
          accentColor={accent}
          memoryReady={memoryReady}
          indexedCount={indexedCount}
          totalEntries={totalEntries}
        />
      </div>
    </motion.section>
  )
}
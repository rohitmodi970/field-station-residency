'use client'

/**
 * RecoveryCodesBanner — Security Architecture v2
 *
 * Full-screen modal warning shown when recovery_codes_count === 0.
 * Appears on the journal/dashboard after encryption is ready.
 *
 * Snooze: "Remind me later" stores a 24-hour timestamp in localStorage.
 * The modal will re-appear on next visit after 24h until codes are generated.
 *
 * Dismissable only via:
 *   1. "Set up now"  → navigates to /security?setup=recovery
 *   2. "Remind me in 24h" → snoozes for 24 hours
 */

import React, { useEffect, useState } from 'react'
import { ShieldAlert, KeyRound, ArrowRight, Clock, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

const SNOOZE_KEY = 'force_recovery_snooze_until'
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

function isSnoozed(): boolean {
  try {
    const val = localStorage.getItem(SNOOZE_KEY)
    if (!val) return false
    return Date.now() < Number(val)
  } catch {
    return false
  }
}

function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DURATION_MS))
  } catch { /* noop */ }
}

export default function RecoveryCodesBanner() {
  const [show, setShow] = useState(false)
  const [mode, setMode] = useState<'missing' | 'upgrade'>('missing')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function check() {
      // Don't show if currently snoozed
      if (isSnoozed()) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch('/api/user/encryption-status')
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled && data.show_recovery_banner !== false) {
          if (data.recovery_codes_count === 0) {
            setShow(true)
            setMode('missing')
          } else if (data.needs_upgrade) {
            setShow(true)
            setMode('upgrade')
          }
        }
      } catch {
        // Non-critical — silently ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    check()
    return () => { cancelled = true }
  }, [])

  const handleSetupNow = () => {
    setShow(false)
    router.push('/security?setup=recovery')
  }

  const handleSnooze = () => {
    snooze()
    setShow(false)
  }

  if (loading || !show) return null

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
    >
      {/* Modal card */}
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.4)]"
        style={{ background: 'var(--color-background-primary, #fff)' }}
      >
        {/* Urgent header gradient */}
        <div
          className="relative overflow-hidden px-6 py-6"
          style={{
            background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 40%, #b45309 100%)',
          }}
        >
          {/* Decorative glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'radial-gradient(circle at 80% 50%, rgba(251,191,36,0.5), transparent 60%)',
            }}
          />

          <div className="relative flex items-start gap-4">
            {/* Icon */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <ShieldAlert size={24} color="#fbbf24" />
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-red-200">
                Security Warning
              </p>
              <h2 className="mt-1 text-[18px] font-bold leading-snug text-white">
                {mode === 'missing' ? 'Recovery codes not set up' : 'Security Upgrade Required'}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-red-100/80">
                {mode === 'missing' 
                  ? "You have no recovery codes. If you lose access on all your devices, you'll be permanently locked out."
                  : "We've significantly upgraded our encryption system. Your existing recovery codes are outdated and will no longer work."}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Risk callout */}
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50 px-4 py-3.5">
            <KeyRound size={15} color="#d97706" className="mt-0.5 shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-amber-800">What are recovery codes?</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-amber-700">
                8 one-time codes that let you access your encrypted journals from a new device
                if you can't use your existing devices.
                Each code can only be used once.
              </p>
            </div>
          </div>

          {mode === 'missing' ? (
            <ul className="mb-6 space-y-2 text-[12px]" style={{ color: 'var(--color-text-secondary, #6b7280)' }}>
              {[
                "Lost your phone? Can't access journals without recovery codes.",
                'New browser or device? You need a code to verify yourself.',
                'Takes 30 seconds to set up — protects your journals forever.',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 text-red-400">•</span>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mb-6 space-y-2 text-[12px]" style={{ color: 'var(--color-text-secondary, #6b7280)' }}>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-red-400">•</span>
                Your current recovery codes are deprecated.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-red-400">•</span>
                Please generate a new set of codes to ensure you can recover your account.
              </li>
            </ul>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleSetupNow}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
              style={{
                background: 'linear-gradient(135deg, #9f6958, #7a8f66)',
                boxShadow: '0 4px 16px rgba(159,105,88,0.35)',
              }}
            >
              <KeyRound size={16} />
              {mode === 'missing' ? 'Generate recovery codes now' : 'Upgrade recovery codes now'}
              <ArrowRight size={16} />
            </button>

            <button
              onClick={handleSnooze}
              className="flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-[13px] font-medium transition-colors hover:opacity-80"
              style={{
                borderColor: 'var(--color-border-secondary, #e5e7eb)',
                color: 'var(--color-text-secondary, #6b7280)',
                background: 'transparent',
              }}
            >
              <Clock size={14} />
              Remind me in 24 hours
            </button>
          </div>

          {/* Fine print */}
          <p className="mt-4 text-center text-[11px]" style={{ color: 'var(--color-text-tertiary, #9ca3af)' }}>
            This warning will reappear every 24 hours until you set up recovery codes.
          </p>
        </div>
      </div>
    </div>
  )
}

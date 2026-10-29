'use client'

/**
 * LegacyMigrationGate — Security Architecture v2
 *
 * Shown to V1 users detected by ensureEncryptionReady() returning
 * status: 'legacy_otp_required'.
 *
 * Flow:
 *   Step 1 — Email OTP verification (auto-sent on mount)
 *   Step 2 — Vault unlock
 *             • Email users: enter password → initializeEncryption()
 *             • OAuth users: auto-decrypt via userId credential (transparent)
 *
 * On completion, calls props.onVerified() so the parent can re-run
 * ensureEncryptionReady() and proceed to the app.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ShieldCheck, Mail, KeyRound, RefreshCw, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import { initializeEncryption } from '@/utils/encryption/keyManager'

interface LegacyMigrationGateProps {
  userId: string
  isOAuthUser: boolean
  onVerified: () => void
}

type Step = 'otp' | 'vault' | 'migrating'

const RESEND_COOLDOWN_SECS = 60

export default function LegacyMigrationGate({
  userId,
  isOAuthUser,
  onVerified,
}: LegacyMigrationGateProps) {
  const [step, setStep] = useState<Step>('otp')
  const [maskedEmail, setMaskedEmail] = useState('')

  // OTP step state
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpLoading, setOtpLoading] = useState(false)
  const [sendLoading, setSendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [attemptsRemaining, setAttemptsRemaining] = useState(5)

  // Vault step state (email users only)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [vaultError, setVaultError] = useState<string | null>(null)
  const [vaultLoading, setVaultLoading] = useState(false)

  // Encrypted key data returned by verify-otp (used in vault step)
  const encDataRef = useRef<{
    encrypted_master_key: string
    master_key_iv: string
    encryption_salt: string
    key_version: number
  } | null>(null)

  // ── Auto-send OTP on mount ────────────────────────────────────────────────
  const sendOtp = useCallback(async () => {
    setSendLoading(true)
    setOtpError(null)
    try {
      const res = await fetch('/api/encryption/legacy-verify/send-otp', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setOtpError(data.error ?? 'Failed to send code. Please try again.')
        return
      }
      setMaskedEmail(data.email ?? '')
      // Start resend cooldown
      setResendCooldown(RESEND_COOLDOWN_SECS)
    } catch {
      setOtpError('Network error. Please check your connection and try again.')
    } finally {
      setSendLoading(false)
    }
  }, [])

  useEffect(() => {
    sendOtp()
  }, [sendOtp])

  // ── Resend cooldown timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.trim().length < 6) return
    setOtpLoading(true)
    setOtpError(null)
    try {
      const res = await fetch('/api/encryption/legacy-verify/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otp.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setOtpError(data.error ?? 'Invalid code. Please try again.')
        if (data.attemptsRemaining !== undefined) {
          setAttemptsRemaining(data.attemptsRemaining)
        }
        return
      }

      // Store encrypted key data for the vault step
      encDataRef.current = {
        encrypted_master_key: data.encrypted_master_key,
        master_key_iv: data.master_key_iv,
        encryption_salt: data.encryption_salt,
        key_version: data.key_version ?? 1,
      }

      if (isOAuthUser) {
        // OAuth: decrypt using userId as credential (transparent to user)
        setStep('migrating')
        await initializeEncryption(
          userId,
          userId,                          // OAuth legacy credential = userId
          data.encryption_salt,
          data.encrypted_master_key,
          data.master_key_iv,
          data.key_version ?? 1
        )
        onVerified()
      } else {
        // Email: show password step
        setStep('vault')
      }
    } catch {
      setOtpError('Something went wrong. Please try again.')
    } finally {
      setOtpLoading(false)
    }
  }

  // ── Vault unlock (email users) ────────────────────────────────────────────
  const handleVaultUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!encDataRef.current || !password) return
    setVaultLoading(true)
    setVaultError(null)
    try {
      const { encryption_salt, encrypted_master_key, master_key_iv, key_version } =
        encDataRef.current

      await initializeEncryption(
        userId,
        password,
        encryption_salt,
        encrypted_master_key,
        master_key_iv,
        key_version
      )
      setStep('migrating')
      onVerified()
    } catch {
      setVaultError(
        'Incorrect password. Please check your password and try again.'
      )
    } finally {
      setVaultLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-stone-200/60 shadow-2xl p-8 space-y-8">

          {/* Icon + title */}
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-8 h-8 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-2xl font-light text-stone-900" style={{ letterSpacing: '-0.02em' }}>
                Security Upgrade
              </h1>
              <p className="text-sm text-stone-500 mt-1">
                One-time verification to protect your journals
              </p>
            </div>
          </div>

          {/* ── Step: OTP ── */}
          {(step === 'otp') && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="bg-amber-50 rounded-2xl p-4 flex items-start gap-3">
                <Mail className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-sm text-stone-700">
                  We sent a 6-digit verification code to{' '}
                  <span className="font-medium text-stone-900">
                    {maskedEmail || 'your email'}
                  </span>
                  . Enter it below to continue.
                </p>
              </div>

              {/* OTP input */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                    setOtpError(null)
                  }}
                  placeholder="000000"
                  autoFocus
                  className="w-full text-center text-3xl font-light tracking-[0.5em] py-4 px-4 bg-stone-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-stone-900 placeholder-stone-300 transition-all"
                />
              </div>

              {otpError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {otpError}
                  {attemptsRemaining <= 3 && attemptsRemaining > 0 && (
                    <span className="block mt-1 text-xs opacity-70">
                      {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                    </span>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={otp.length < 6 || otpLoading}
                className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {otpLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                  : <><span>Verify Code</span><ArrowRight className="w-4 h-4" strokeWidth={1.5} /></>
                }
              </button>

              {/* Resend */}
              <div className="text-center">
                {resendCooldown > 0 ? (
                  <span className="text-xs text-stone-400">
                    Resend in {resendCooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setOtp(''); sendOtp() }}
                    disabled={sendLoading}
                    className="text-xs text-stone-500 hover:text-stone-800 underline underline-offset-4 flex items-center gap-1 mx-auto transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                    {sendLoading ? 'Sending…' : 'Resend code'}
                  </button>
                )}
              </div>
            </form>
          )}

          {/* ── Step: Password (email users) ── */}
          {step === 'vault' && (
            <form onSubmit={handleVaultUnlock} className="space-y-6">
              <div className="bg-stone-50 rounded-2xl p-4 flex items-start gap-3">
                <KeyRound className="w-5 h-5 text-stone-500 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-sm text-stone-600">
                  Email verified! Now enter your password to unlock your journals
                  and complete the security upgrade.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setVaultError(null) }}
                    placeholder="Enter your password"
                    autoFocus
                    required
                    className="w-full py-3.5 px-4 pr-12 bg-stone-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 text-stone-900 placeholder-stone-400 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors"
                  >
                    {showPassword
                      ? <EyeOff className="w-5 h-5" strokeWidth={1.5} />
                      : <Eye className="w-5 h-5" strokeWidth={1.5} />
                    }
                  </button>
                </div>
              </div>

              {vaultError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {vaultError}
                </div>
              )}

              <button
                type="submit"
                disabled={!password || vaultLoading}
                className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-medium transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {vaultLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Unlocking…</>
                  : <><span>Unlock & Continue</span><ArrowRight className="w-4 h-4" strokeWidth={1.5} /></>
                }
              </button>
            </form>
          )}

          {/* ── Step: Migrating ── */}
          {step === 'migrating' && (
            <div className="text-center space-y-4 py-4">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto" strokeWidth={1.5} />
              <p className="text-stone-600 text-sm">Upgrading your security… just a moment.</p>
            </div>
          )}

          {/* Progress indicator */}
          {step !== 'migrating' && (
            <div className="flex gap-1.5">
              <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${step === 'otp' ? 'bg-orange-400' : 'bg-stone-800'}`} />
              <div className={`h-1 flex-1 rounded-full transition-all duration-500 ${step === 'vault' ? 'bg-orange-400' : step === 'otp' ? 'bg-stone-200' : 'bg-stone-800'}`} />
            </div>
          )}

        </div>

        <p className="text-center text-xs text-stone-400 mt-6 px-4">
          This one-time check secures your account on our new device-trust system.
          Your journals remain private throughout.
        </p>
      </div>
    </div>
  )
}

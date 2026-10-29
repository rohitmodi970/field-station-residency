// apps/web/app/(auth)/reset-password/page.tsx
'use client'

import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  KeyRound,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

// Vault re-keying step states:
//   'idle'          — password not yet reset
//   'pw_updated'    — supabase password updated, starting vault check
//   'easy_rekey'    — vault re-keyed from cache (silent, just show success)
//   'needs_code'    — fresh device: need recovery code from user
//   'rekeying'      — rekeyMasterKeyFromRecoveryCode in progress
//   'new_codes'     — rekey done, show new recovery codes
//   'no_codes'      — no recovery codes exist, show warning
//   'done'          — complete, redirect soon
type VaultStep =
  | 'idle'
  | 'pw_updated'
  | 'easy_rekey'
  | 'needs_code'
  | 'rekeying'
  | 'new_codes'
  | 'no_codes'
  | 'done'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  // Password form
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [passwordStrength, setPasswordStrength] = useState(0)

  // Vault re-keying
  const [vaultStep, setVaultStep] = useState<VaultStep>('idle')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [vaultError, setVaultError] = useState('')
  const [newCodes, setNewCodes] = useState<string[]>([])
  const [savedPassword, setSavedPassword] = useState('')

  const calculatePasswordStrength = (pwd: string) => {
    let strength = 0
    if (pwd.length >= 8) strength += 25
    if (pwd.length >= 12) strength += 25
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) strength += 25
    if (/\d/.test(pwd)) strength += 12.5
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) strength += 12.5
    setPasswordStrength(Math.min(strength, 100))
  }

  const getStrengthColor = () => {
    if (passwordStrength < 25) return '#ef4444'
    if (passwordStrength < 50) return '#f97316'
    if (passwordStrength < 75) return '#eab308'
    return '#22c55e'
  }

  const getStrengthText = () => {
    if (passwordStrength < 25) return 'Weak'
    if (passwordStrength < 50) return 'Fair'
    if (passwordStrength < 75) return 'Good'
    return 'Strong'
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setPassword(v)
    calculatePasswordStrength(v)
    if (error) setError('')
  }

  // ── Step 1: Reset password with Supabase Auth ───────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (!password || !confirmPassword) {
      setError('Please fill in all fields')
      setIsLoading(false)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      setIsLoading(false)
      return
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        setIsLoading(false)
        return
      }

      // Password updated — now attempt vault re-keying
      setSavedPassword(password)
      setPassword('')
      setConfirmPassword('')
      setVaultStep('pw_updated')
      await attemptVaultRekey(password)
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 2: Attempt vault re-keying ────────────────────────────────────
  const attemptVaultRekey = useCallback(async (newPassword: string) => {
    try {
      // Dynamic import to keep initial bundle lean
      const {
        restoreEncryptionFromCache,
        restoreEncryptionFromDeviceSecret,
        getEncryptionKey,
        changePassword: changePwWrapping,
      } = await import('@/utils/encryption')

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setVaultStep('needs_code')
        return
      }

      // ── Easy path: master key is cached on this device ──────────────────
      const restoredFromCache = await restoreEncryptionFromCache(user.id)
      if (restoredFromCache) {
        setVaultStep('easy_rekey')
        // Silently re-wrap via changePassword action — reads from cache
        try {
          const res = await fetch('/api/user/change-encryption-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword }),
          })
          if (res.ok) {
            setVaultStep('done')
            setTimeout(() => router.push('/login'), 3000)
            return
          }
        } catch {
          // Fall through to show needs_code
        }
      }

      // ── No cached key: user needs to provide a recovery code ────────────
      setVaultStep('needs_code')
    } catch {
      // Assume no cached key — ask for recovery code
      setVaultStep('needs_code')
    }
  }, [supabase, router])

  // ── Step 3: Re-key vault using recovery code ────────────────────────────
  const handleRecoveryRekey = async (e: React.FormEvent) => {
    e.preventDefault()
    setVaultError('')

    if (!recoveryCode.trim()) {
      setVaultError('Please enter a recovery code')
      return
    }

    setVaultStep('rekeying')

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Session expired. Please log in again.')

      const { rekeyMasterKeyFromRecoveryCode } = await import('@/utils/encryption')
      const { newRecoveryCodes } = await rekeyMasterKeyFromRecoveryCode(
        user.id,
        recoveryCode,
        savedPassword
      )

      if (newRecoveryCodes.length > 0) {
        setNewCodes(newRecoveryCodes)
        setVaultStep('new_codes')
      } else {
        // Codes generated as empty (master key was in memory for dual-wrap but generation failed)
        setVaultStep('done')
        setTimeout(() => router.push('/login'), 3000)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Vault re-keying failed. Please try again.'
      setVaultError(msg)
      setVaultStep('needs_code')
    }
  }

  const handleSkipRecoveryCode = () => {
    setVaultStep('no_codes')
  }

  const handleFinish = () => {
    setVaultStep('done')
    setTimeout(() => router.push('/login'), 2000)
  }

  // ── Render: success / vault steps ──────────────────────────────────────
  if (vaultStep === 'easy_rekey' || vaultStep === 'pw_updated') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl bg-gray-800 shadow-2xl p-8 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Updating your vault...</h2>
          <p className="text-gray-400 text-sm">Re-encrypting your journal vault with the new password.</p>
        </div>
      </div>
    )
  }

  if (vaultStep === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl bg-gray-800 shadow-2xl p-8 text-center">
          <div className="rounded-full bg-green-500 p-4 w-fit mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-4">All done!</h1>
          <p className="text-gray-300 mb-6">Your password and journal vault have been updated.</p>
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Redirecting to login...</span>
          </div>
        </div>
      </div>
    )
  }

  if (vaultStep === 'needs_code' || vaultStep === 'rekeying') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl bg-gray-800 shadow-2xl p-8">
          <div className="rounded-full bg-blue-500/20 p-4 w-fit mx-auto mb-6">
            <KeyRound className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Unlock your vault</h1>
          <p className="text-gray-400 text-sm text-center mb-6">
            Password updated ✓ — your journal vault is encrypted with your old password.
            Enter a recovery code to re-encrypt it with your new password.
          </p>

          {vaultError && (
            <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 rounded-lg mb-4 text-sm">
              {vaultError}
            </div>
          )}

          <form onSubmit={handleRecoveryRekey} className="space-y-4">
            <div>
              <label htmlFor="recoveryCode" className="block text-sm font-medium text-gray-300 mb-2">
                Recovery Code
              </label>
              <input
                id="recoveryCode"
                type="text"
                value={recoveryCode}
                onChange={(e) => {
                  setRecoveryCode(e.target.value)
                  if (vaultError) setVaultError('')
                }}
                placeholder="XXXX-XXXX"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase tracking-widest text-center"
                disabled={vaultStep === 'rekeying'}
                autoComplete="off"
              />
            </div>

            <button
              type="submit"
              disabled={vaultStep === 'rekeying' || !recoveryCode.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {vaultStep === 'rekeying' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Re-encrypting vault...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Unlock &amp; update vault
                </>
              )}
            </button>
          </form>

          <button
            onClick={handleSkipRecoveryCode}
            className="mt-4 w-full text-sm text-gray-500 hover:text-gray-300 transition-colors"
            disabled={vaultStep === 'rekeying'}
          >
            I don&apos;t have a recovery code
          </button>
        </div>
      </div>
    )
  }

  if (vaultStep === 'new_codes') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl bg-gray-800 shadow-2xl p-8">
          <div className="rounded-full bg-green-500/20 p-4 w-fit mx-auto mb-4">
            <RotateCcw className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Vault re-keyed ✓</h1>
          <p className="text-gray-400 text-sm text-center mb-6">
            Your old recovery codes are now invalid. Save these new codes somewhere safe — you&apos;ll need one if you forget your password again.
          </p>

          <div className="bg-gray-900 rounded-lg p-4 mb-6 space-y-2">
            {newCodes.map((code, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-gray-500 text-xs w-4 text-right">{i + 1}.</span>
                <code className="font-mono text-sm text-green-300 tracking-wider">{code}</code>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                const text = newCodes.map((c, i) => `${i + 1}. ${c}`).join('\n')
                const blob = new Blob([`Force Recovery Codes\n\n${text}\n\nGenerated: ${new Date().toLocaleDateString()}\nStore these codes safely. Each can be used once.`], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'force-recovery-codes.txt'
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
            >
              Download codes
            </button>
            <button
              onClick={handleFinish}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
            >
              I&apos;ve saved them
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (vaultStep === 'no_codes') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl bg-gray-800 shadow-2xl p-8">
          <div className="rounded-full bg-yellow-500/20 p-4 w-fit mx-auto mb-4">
            <AlertTriangle className="w-10 h-10 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Vault locked</h1>
          <p className="text-gray-300 text-sm text-center mb-4">
            Without a recovery code, journals encrypted with your old password cannot be recovered.
            Your password has been updated — new journals will encrypt normally with your new password.
          </p>
          <p className="text-gray-500 text-xs text-center mb-6">
            To prevent this in the future, generate recovery codes from Security Settings after logging in.
          </p>
          <button
            onClick={handleFinish}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Continue to login
          </button>
        </div>
      </div>
    )
  }

  // ── Default: password entry form ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white py-8 flex flex-col items-center justify-center">
      <div className="container mx-auto max-w-md px-6 py-8 bg-gray-800 rounded-xl shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-blue-500/20 p-4">
            <Lock className="w-12 h-12 text-blue-400" />
          </div>
        </div>

        <h1 className="font-bold text-3xl text-center mb-2">Reset Password</h1>
        <p className="text-gray-400 text-center mb-8">Enter your new password below</p>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleResetPassword} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handlePasswordChange}
                className="w-full pl-10 pr-12 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {password && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">Password strength:</span>
                  <span className="text-xs font-medium" style={{ color: getStrengthColor() }}>
                    {getStrengthText()}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ width: `${passwordStrength}%`, backgroundColor: getStrengthColor() }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (error) setError('')
                }}
                className="w-full pl-10 pr-12 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
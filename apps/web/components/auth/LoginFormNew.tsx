'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { createClient } from '@/utils/supabase/client'
import { signInWithEmail } from '@/actions/auth'
import { initializeEncryption, isDeviceRemembered, clearRememberedDevice } from '@/utils/encryption/keyManager'
import { getUserEncryptionData } from '@/actions/encryption'
import { storeCredential } from '@/utils/encryption/credentialTransit'
import { trackEvent, identifyUser } from '@/lib/posthog-events'
import { Eye, EyeOff } from 'lucide-react'

const LoginFormNew = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  React.useEffect(() => {
    isDeviceRemembered().then(setRememberDevice)
  }, [])

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError(null)

    try {
      trackEvent.userLoggedIn({
        method: 'google',
      })

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (oauthError) throw oauthError
    } catch (err: any) {
      setError(err.message || 'Google authentication failed')
      trackEvent.errorOccurred({
        error_type: 'google_login_failed',
        error_message: err.message,
        page: '/login',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setIsLoading(true)
    setError(null)

    try {
      const { data, error: signInError } = await signInWithEmail({
        email,
        password,
      })

      if (signInError) {
        const errorMessage = signInError.message || 'Authentication failed'
        if (errorMessage.toLowerCase().includes('invalid email or password')) {
          setError('Invalid email or password. Please try again.')
        } else if (errorMessage.toLowerCase().includes('email not confirmed')) {
          setError('Please verify your email before signing in.')
        } else {
          setError(errorMessage)
        }

        trackEvent.errorOccurred({
          error_type: 'email_login_failed',
          error_message: errorMessage,
          page: '/login',
        })

        return
      }

      if (data.user) {
        trackEvent.userLoggedIn({
          method: 'email',
        })

        identifyUser(data.user.id, {
          email: data.user.email,
          name: data.user.user_metadata?.name,
          created_at: data.user.created_at,
        })

        // Store credential for EncryptionGate — if a device verification
        // gate appears, this avoids re-prompting the user for their password.
        // See credentialTransit.ts for the security model (passive-snooping defense).
        // and show the password field if needed.
        await storeCredential(password).catch(() => {
          // Non-fatal: EncryptionGate will fall back to an empty credential
          // and show the password field if needed.
        })

        // Store user's choice so NewDeviceVerification can default to it
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('__force_remember_device', rememberDevice.toString())
        }

        // If they explicitly unchecked it, clear any existing trust
        if (!rememberDevice) {
          await clearRememberedDevice()
        }

        try {
          const encryptionData = await getUserEncryptionData()

          if (encryptionData) {
            // Pass key_version so initializeEncryption uses the correct PBKDF2 iteration
            // count (100k for legacy key_version=1, 600k for device-key key_version=2).
            await initializeEncryption(
              data.user.id,
              password,
              encryptionData.salt,
              encryptionData.encrypted_master_key,
              encryptionData.master_key_iv,
              encryptionData.key_version  // ← CRITICAL: was always missing before
            )
          }
        } catch (encError) {
          console.error('[LoginFormNew] Encryption error:', encError)
        }

        if (typeof window !== 'undefined') {
          sessionStorage.setItem('force_auth_toast', 'logged_in')
          // Use router.push to preserve module state (specifically the transitKey
          // in credentialTransit.ts) for password-free 2FA.
          router.push('/journal')
        } else {
          router.push('/journal')
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed'
      setError(errorMessage)
      trackEvent.errorOccurred({
        error_type: 'email_login_failed',
        error_message: errorMessage,
        page: '/login',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none bg-animate-shift"
        style={{
          backgroundImage: `
            linear-gradient(135deg,
              rgba(254, 242, 242, 0.4) 0%,
              rgba(254, 215, 170, 0.3) 25%,
              rgba(251, 191, 146, 0.35) 50%,
              rgba(240, 113, 113, 0.25) 75%,
              rgba(219, 112, 147, 0.2) 100%
            )
          `,
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none bg-animate-grain"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.8' numOctaves='4' seed='2' result='noise'/%3E%3C/filter%3E%3Crect width='100' height='100' fill='%23000' filter='url(%23grain)' opacity='0.05'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundAttachment: 'fixed',
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(ellipse 150% 80% at 50% 20%, rgba(147, 197, 253, 0.08) 0%, transparent 60%)',
        }}
      />

      <div className="relative w-full max-w-sm z-10">
        <div className="flex flex-col items-center gap-12">
          <div className="group relative flex flex-col items-center gap-3">
            <div className="pointer-events-none absolute -inset-3 rounded-3xl bg-linear-to-br from-amber-200/45 via-rose-200/30 to-sky-200/25 blur-xl opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100" />
            <div className="relative w-16 h-16 rounded-2xl bg-stone-900/95 ring-1 ring-stone-700/60 shadow-[0_10px_28px_rgba(28,25,23,0.3)] flex items-center justify-center transition-all duration-400 ease-out group-hover:-translate-y-1 group-hover:scale-105 group-hover:shadow-[0_16px_36px_rgba(28,25,23,0.36)]">
              <Image
                src="/logo.svg"
                alt="force"
                width={44}
                height={58}
                className="drop-shadow-[0_1px_0_rgba(255,255,255,0.2)] transition-transform duration-400 ease-out group-hover:rotate-3 group-hover:scale-105"
                priority
              />
            </div>
            <span className="text-xs tracking-[0.22em] text-stone-500 font-medium transition-colors duration-300 group-hover:text-stone-700">
              FORCE
            </span>
          </div>

          <div className="text-center">
            <h1
              className="text-5xl md:text-6xl font-light text-stone-900 leading-tight"
              style={{ letterSpacing: '-0.02em' }}
            >
              Come back to yourself.
            </h1>
          </div>

          <div className="w-full space-y-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-3 bg-stone-800 hover:bg-stone-900 active:bg-stone-950 text-stone-50 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-xs text-stone-400 font-medium uppercase">or</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-stone-100 border-0 rounded-lg px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:bg-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-300 transition-all duration-200"
                  required
                  autoFocus
                />
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-stone-100 border-0 rounded-lg pl-4 pr-11 py-3 text-stone-900 placeholder:text-stone-400 focus:bg-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-300 transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-700 active:scale-95 transition-all focus:outline-none rounded-md cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className="relative flex items-center justify-center w-4 h-4 rounded border border-stone-300 bg-white transition-all duration-200 group-hover:border-stone-400 group-active:scale-95">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {rememberDevice && (
                      <svg className="w-2.5 h-2.5 text-stone-700 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-stone-600 select-none group-hover:text-stone-800 transition-colors">
                    Remember this device
                  </span>
                </label>

                <Link
                  href="/forgot-password"
                  className="text-xs text-stone-500 underline underline-offset-4 hover:text-stone-700 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full px-5 py-3 bg-stone-800 hover:bg-stone-900 active:bg-stone-950 text-stone-50 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md mt-2"
              >
                {isLoading ? 'Signing in...' : 'Continue'}
              </button>
            </form>
          </div>

          <div className="text-center text-xs text-stone-500">
            <span>By continuing, you agree to our </span>
            <Link href="/terms-and-conditions" className="underline underline-offset-4">
              Terms
            </Link>
            <span> and </span>
            <Link href="/privacy-policy" className="underline underline-offset-4">
              Privacy Policy
            </Link>
            <span>.</span>
          </div>

          <div className="text-center text-xs text-stone-500 pt-8">
            <span>Don't have an account? </span>
            <Link href="/register" className="text-stone-700 underline underline-offset-4 hover:text-stone-900 transition-colors">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginFormNew

'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Input } from '@/components/ui/input'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    if (!email) {
      setError('Please enter your email address')
      setIsLoading(false)
      return
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) {
        setError(resetError.message)
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Common background elements to match LoginFormNew
  const BackgroundElements = () => (
    <>
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
    </>
  )

  const LogoBlock = () => (
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
  )

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4 relative overflow-hidden">
        <BackgroundElements />

        <div className="relative w-full max-w-sm z-10">
          <div className="flex flex-col items-center gap-12">
            <LogoBlock />

            <div className="text-center w-full">
              <h1
                className="text-4xl md:text-5xl font-light text-stone-900 leading-tight mb-8"
                style={{ letterSpacing: '-0.02em' }}
              >
                Check your email.
              </h1>
              
              <div className="flex flex-col items-center justify-center mb-8">
                 <div className="rounded-full bg-stone-200/50 p-4 mb-6 ring-1 ring-stone-300">
                   <CheckCircle2 className="w-8 h-8 text-stone-700" />
                 </div>
                 <p className="text-stone-600 mb-2">
                   We've sent a password reset link to:
                 </p>
                 <p className="text-stone-900 font-medium mb-2">{email}</p>
              </div>

              <div className="bg-stone-100/50 border border-stone-200 rounded-xl p-5 mb-8 text-left shadow-sm">
                <h3 className="font-semibold text-stone-800 mb-3 text-sm">Next Steps:</h3>
                <ol className="text-sm text-stone-600 space-y-2 list-decimal list-inside">
                  <li>Check your email inbox</li>
                  <li>Click the reset link in the email</li>
                  <li>Create a new password</li>
                </ol>
              </div>

              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 text-stone-500 hover:text-stone-800 transition-colors text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex items-center justify-center p-4 relative overflow-hidden">
      <BackgroundElements />

      <div className="relative w-full max-w-sm z-10">
        <div className="flex flex-col items-center gap-12">
          <LogoBlock />

          <div className="text-center">
            <h1
              className="text-4xl md:text-5xl font-light text-stone-900 leading-tight mb-4"
              style={{ letterSpacing: '-0.02em' }}
            >
              Reset Password
            </h1>
            <p className="text-stone-500">
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          <div className="w-full space-y-6">
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-stone-100 border-0 rounded-lg px-4 py-3 text-stone-900 placeholder:text-stone-400 focus:bg-stone-200 focus:outline-none focus:ring-1 focus:ring-stone-300 transition-all duration-200"
                  placeholder="Email address"
                  required
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-stone-800 hover:bg-stone-900 active:bg-stone-950 text-stone-50 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md mt-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </div>

          <div className="text-center text-xs text-stone-500 pt-8">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
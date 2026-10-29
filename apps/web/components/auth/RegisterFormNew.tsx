'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Eye, EyeOff, ArrowRight, Feather, Check, X, Zap,
  BookOpen, PenTool, Edit3, MessageCircle, Mail, FileText,
  Book, Pencil, Hash, AtSign, MessageSquare,
} from 'lucide-react'
import { signUpWithEmail } from '@/actions/auth'
import { initializeEncryptionForNewUser, initializeEncryption } from '@/utils/encryption/keyManager'
import { createClient } from '@/utils/supabase/client'
import { trackEvent, identifyUser } from '@/lib/posthog-events'

const RegisterFormNew = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [currentStep, setCurrentStep] = useState<'name' | 'email' | 'password' | 'confirm' | 'complete'>('name')
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [typewriterText, setTypewriterText] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const verifiedUsername = (searchParams.get('verifiedUsername') || '').trim().toLowerCase()
  const verifiedEmail = (searchParams.get('verifiedEmail') || '').trim().toLowerCase()

  useEffect(() => { setMounted(true) }, [])

  // useEffect(() => {
  //   if (!mounted) return
  //   const fullText = 'Your story starts here'
  //   let index = 0
  //   const timer = setInterval(() => {
  //     if (index <= fullText.length) {
  //       setTypewriterText(fullText.slice(0, index))
  //       index++
  //     } else {
  //       clearInterval(timer)
  //     }
  //   }, 80)
  //   return () => clearInterval(timer)
  // }, [mounted])

  useEffect(() => {
    calculatePasswordStrength(formData.password)
  }, [formData.password])

  const calculatePasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength += 25
    if (password.length >= 12) strength += 15
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 20
    if (/\d/.test(password)) strength += 20
    if (/[^a-zA-Z0-9]/.test(password)) strength += 20
    setPasswordStrength(Math.min(strength, 100))
  }

  const getPasswordStrengthLabel = () => {
    if (passwordStrength < 40) return 'Weak'
    if (passwordStrength < 70) return 'Good'
    return 'Strong'
  }

  const getPasswordChecks = () => [
    { label: 'At least 8 characters', valid: formData.password.length >= 8 },
    { label: 'Upper & lowercase letters', valid: /[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password) },
    { label: 'Contains a number', valid: /\d/.test(formData.password) },
    { label: 'Special character', valid: /[^a-zA-Z0-9]/.test(formData.password) },
  ]

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.name.trim()) setCurrentStep('email')
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email.includes('@') || !formData.email.includes('.')) return

    const normalizedEmail = formData.email.trim().toLowerCase()
    const normalizedLocalPart = normalizedEmail.split('@')[0] || ''

    if (verifiedEmail && normalizedEmail !== verifiedEmail) {
      setError('Please use the same email that received your access code.')
      return
    }
    if (!verifiedEmail && verifiedUsername && normalizedLocalPart !== verifiedUsername) {
      setError('This signup link is limited to your verified username access path.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/check-waitlist-status?email=${encodeURIComponent(formData.email)}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to verify email status')
        setLoading(false)
        return
      }

      if (!data.canSignup) {
        switch (data.action) {
          case 'already_registered':
            setError('An account with this email already exists. Redirecting to login...')
            setTimeout(() => router.push('/login'), 2000)
            break
          case 'join_waitlist':
            setError('Please join our waitlist first. Redirecting...')
            setTimeout(() => router.push('/waitlist'), 2000)
            break
          case 'wait_for_approval':
            setError('Your application is pending approval. Please wait for our email notification.')
            break
          case 'access_denied':
            setError('Access not available. Please contact support if you believe this is an error.')
            break
          default:
            setError(data.message)
        }
        setLoading(false)
        return
      }

      setCurrentStep('password')
      setLoading(false)
    } catch {
      setError('Failed to verify email status. Please try again.')
      setLoading(false)
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordStrength >= 40) setCurrentStep('confirm')
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (passwordStrength < 75) {
      setError('Please create a stronger password')
      return
    }

    setLoading(true)
    try {
      const tempUserId = `temp_${Date.now()}`
      const { salt: encryptionSalt, encryptedMasterKey, masterKeyIV } =
        await initializeEncryptionForNewUser(tempUserId, formData.password)

      const { data, error: signUpError } = await signUpWithEmail({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        encryptionSalt,
        encryptedMasterKey,
        masterKeyIV,
      })

      if (signUpError) {
        setError(signUpError.message.includes('already registered')
          ? 'An account with this email already exists'
          : signUpError.message)
        return
      }

      if (data.user) {
        trackEvent.userSignedUp({ method: 'email', referrer: document.referrer })
        identifyUser(data.user.id, {
          email: data.user.email,
          name: formData.name,
          created_at: data.user.created_at,
        })
        await initializeEncryption(data.user.id, formData.password, encryptionSalt, encryptedMasterKey, masterKeyIV)
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('force_auth_toast', 'signed_up')
        }
        setCurrentStep('complete')
        setTimeout(() => router.push('/verify-email'), 2000)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account'
      setError(errorMessage)
      trackEvent.errorOccurred({ error_type: 'email_signup_failed', error_message: errorMessage, page: '/register' })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setError(null)
    try {
      trackEvent.userSignedUp({ method: 'google', referrer: document.referrer })

      // NOTE: Encryption setup for Google OAuth users is handled entirely
      // server-side in /auth/callback/route.ts. The master key is derived
      // from the user's ID on the server — no client-side crypto material
      // needs to be stored or passed through the OAuth redirect.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) throw error
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign up with Google'
      setError(errorMessage)
      trackEvent.errorOccurred({ error_type: 'google_signup_failed', error_message: errorMessage, page: '/register' })
    }
  }


  if (success) {
    return (
      <div className="relative min-h-screen w-full bg-transparent flex items-center justify-center overflow-hidden">
        <div className="relative z-10 text-center space-y-8 animate-fade-in px-4">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 border-2 border-black rounded-full animate-ping opacity-20" />
            <div className="relative w-24 h-24 border-2 border-black rounded-full flex items-center justify-center bg-white">
              <Check className="w-12 h-12 text-black" strokeWidth={1.5} />
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-5xl font-light text-black">
              Welcome to Force
            </h2>
            <p className="text-lg text-black/60 max-w-md mx-auto font-light">
              Your journey begins now. Please check your email to verify your account.
            </p>
          </div>
          {/* <div className="flex items-center justify-center gap-3 pt-8">
            <div className="h-px w-12 bg-gradient-to-r from-transparent via-black/20 to-transparent" />
            <Zap className="w-5 h-5 text-black/40 animate-pulse" strokeWidth={1.5} />
            <div className="h-px w-12 bg-gradient-to-r from-transparent via-black/20 to-transparent" />
          </div> */}
        </div>
      </div>
    )
  }

  const stepNumber = currentStep === 'name' ? 1 : currentStep === 'email' ? 2 : currentStep === 'password' ? 3 : 4
  const totalSteps = 4

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Warm layered gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(135deg,
            rgba(254,242,242,0.4) 0%,
            rgba(254,215,170,0.3) 25%,
            rgba(251,191,146,0.35) 50%,
            rgba(240,113,113,0.25) 75%,
            rgba(219,112,147,0.2) 100%)`,
        }}
      />

      {/* Grain texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.8' numOctaves='4' seed='2' result='noise'/%3E%3C/filter%3E%3Crect width='100' height='100' fill='%23000' filter='url(%23grain)' opacity='0.05'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundAttachment: 'fixed',
        }}
      />

      {/* Radial accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(ellipse 150% 80% at 50% 20%, rgba(147,197,253,0.08) 0%, transparent 60%)' }}
      />

      {/* Flowing horizontal lines */}
      <div className="absolute inset-0 opacity-[0.015] overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-0 w-full h-px bg-gradient-to-r from-transparent via-black to-transparent animate-flow-right" />
        <div className="absolute top-[30%] left-0 w-full h-px bg-gradient-to-r from-transparent via-black to-transparent animate-flow-left" style={{ animationDelay: '1s' }} />
        <div className="absolute top-[50%] left-0 w-full h-px bg-gradient-to-r from-transparent via-black to-transparent animate-flow-right" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[70%] left-0 w-full h-px bg-gradient-to-r from-transparent via-black to-transparent animate-flow-left" style={{ animationDelay: '3s' }} />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { w: 2, h: 2, l: 15, delay: 0 }, { w: 1.5, h: 1.5, l: 35, delay: -2 },
          { w: 2.5, h: 2.5, l: 55, delay: -4 }, { w: 1.8, h: 1.8, l: 75, delay: -6 },
          { w: 2.2, h: 2.2, l: 25, delay: -8 }, { w: 1.6, h: 1.6, l: 65, delay: -10 },
        ].map((p, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-black"
            style={{
              width: `${p.w}px`, height: `${p.h}px`,
              left: `${p.l}%`, top: `${(i * 25) % 100}%`,
              opacity: 0.03,
              animation: `float ${15 + i * 2}s ease-in-out infinite, pulse-opacity ${8 + i}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ── Main two-column layout ── */}
      <div className={`relative z-10 w-full max-w-5xl transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="grid lg:grid-cols-5 gap-12 xl:gap-16 items-center">

          {/* ── LEFT: Branding panel (from old form) ── */}
          <div className="hidden lg:flex lg:col-span-2 flex-col space-y-10 relative group">

            {/* Hoverable decorative icons around branding */}
            <div className="absolute -left-12 top-[10%] opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100">
              <Edit3 className="w-8 h-8 text-stone-400 animate-bounce-gentle" strokeWidth={1} />
            </div>
            <div className="absolute -right-12 top-[30%] opacity-0 group-hover:opacity-100 transition-all duration-500 delay-200">
              <BookOpen className="w-10 h-10 text-stone-400 animate-wiggle" strokeWidth={1} />
            </div>
            <div className="absolute -left-16 top-[60%] opacity-0 group-hover:opacity-100 transition-all duration-500 delay-300">
              <MessageCircle className="w-7 h-7 text-stone-400 animate-pulse-gentle" strokeWidth={1} />
            </div>
            <div className="absolute -right-10 top-[80%] opacity-0 group-hover:opacity-100 transition-all duration-500 delay-400">
              <Feather className="w-9 h-9 text-stone-400 animate-float-gentle" strokeWidth={1} />
            </div>

            {/* SVG Logo + FORCE title */}
            <div className="relative">
              <div className="flex items-center justify-center mb-8 relative group/logo">
                <div className="absolute inset-0 bg-gradient-to-br from-stone-900/5 to-transparent rounded-full blur-3xl group-hover/logo:blur-[60px] transition-all duration-1000 animate-pulse-slow" />
                <svg
                  width="206" height="156" viewBox="0 0 206 156"
                  fill="none" xmlns="http://www.w3.org/2000/svg"
                  className="relative z-10 w-[160px] h-[124px] opacity-90 hover:opacity-100 transition-all duration-700 hover:scale-110 animate-float-gentle"
                >
                  <path d="M85.3772 32.024L16.1691 18.3645C10.9033 17.3252 6 21.3553 6 26.7227C6 30.8625 8.97598 34.4031 13.0541 35.1152L72.9119 45.5665C76.784 46.2426 79.6096 49.6043 79.6096 53.535C79.6096 57.649 76.5216 61.1077 72.4339 61.5723L51.7716 63.9202C42.8656 64.9323 39.49 76.1065 46.3462 81.8801C48.8875 84.0202 52.311 84.7903 55.5239 83.9448L86.0883 75.9016C91.2213 74.5508 94.7989 69.9099 94.7989 64.6022V43.4869C94.7989 37.9062 90.8523 33.1046 85.3772 32.024Z" fill="#1c1917" stroke="#1c1917" strokeWidth="11.6841"/>
                  <path d="M120.579 32.024L189.787 18.3645C195.053 17.3252 199.956 21.3553 199.956 26.7227C199.956 30.8625 196.98 34.4031 192.902 35.1152L133.044 45.5665C129.172 46.2426 126.346 49.6043 126.346 53.535C126.346 57.649 129.434 61.1077 133.522 61.5723L153.915 63.8896C162.691 64.8869 165.865 76.0069 158.939 81.4872C156.537 83.3876 153.391 84.069 150.418 83.3327L120.032 75.8074C114.819 74.5162 111.157 69.837 111.157 64.466V43.4869C111.157 37.9062 115.104 33.1046 120.579 32.024Z" fill="#1c1917" stroke="#1c1917" strokeWidth="11.6841"/>
                  <path d="M102.979 5.8418H105.315C107.897 5.84184 109.989 7.9345 109.989 10.5156C109.989 13.0968 107.897 15.1894 105.315 15.1895H102.979C100.397 15.1894 98.3047 13.0968 98.3047 10.5156C98.3047 7.93448 100.397 5.84181 102.979 5.8418Z" fill="#1c1917" stroke="#1c1917" strokeWidth="11.6841"/>
                  <path d="M111.157 143.714V66.5989C111.157 63.3724 113.773 60.7568 116.999 60.7568C120.226 60.7568 122.841 63.3724 122.841 66.5989V143.714C122.841 146.94 120.226 149.556 116.999 149.556C113.773 149.556 111.157 146.94 111.157 143.714Z" fill="#1c1917" stroke="#1c1917" strokeWidth="11.6841"/>
                </svg>
              </div>

              <div className="text-center space-y-5">
                {/* Animated FORCE letters */}
                <h1 className="text-6xl font-light tracking-tight relative inline-block">
                  <span className="relative z-10 inline-block">
                    {'FORCE'.split('').map((letter, i) => (
                      <span
                        key={i}
                        className="inline-block"
                        style={{
                          animationDelay: `${i * 0.1}s`,
                          background: 'linear-gradient(180deg, #1c1917 0%, #44403c 50%, #1c1917 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundSize: '100% 200%',
                          animation: `wave 2s ease-in-out ${i * 0.1}s infinite, shimmer 3s ease-in-out infinite`,
                        }}
                      >
                        {letter}
                      </span>
                    ))}
                  </span>
                </h1>

                {/* Zap divider */}
                {/* <div className="flex items-center justify-center gap-3 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                  <div className="h-px w-10 bg-gradient-to-r from-transparent via-stone-400 to-transparent animate-expand" />
                  <Zap className="w-4 h-4 text-stone-400 animate-spin-slow" strokeWidth={1.5} />
                  <div className="h-px w-10 bg-gradient-to-r from-transparent via-stone-400 to-transparent animate-expand" style={{ animationDelay: '0.2s' }} />
                </div> */}

                {/* Typewriter text */}
                {/* <p className="text-base font-light text-stone-500 leading-relaxed min-h-[24px] animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
                  {mounted ? (
                    <>
                      <span className="inline-block animate-text-reveal">{typewriterText}</span>
                      <span className="animate-blink text-stone-400">|</span>
                    </>
                  ) : (
                    <span className="opacity-0">placeholder</span>
                  )}
                </p> */}
              </div>
            </div>

            {/* Quote */}
            {/* <div className="relative group/quote">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-stone-400/40 to-transparent" />
              <div className="pl-5 py-3">
                <p className="text-base font-light text-stone-600 italic leading-relaxed mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                  "There is no greater agony than bearing an untold story inside you."
                </p>
                <p className="text-xs font-light text-stone-400 tracking-wider uppercase" style={{ fontFamily: 'Georgia, serif' }}>
                  — Maya Angelou
                </p>
              </div>
              <div className="absolute -left-1 top-4 w-2 h-2 rounded-full bg-stone-300 group-hover/quote:bg-stone-500 transition-colors duration-500" />
            </div> */}

            {/* Features */}
            {/* <div className="space-y-3">
              {[
                'Private & secure journaling',
                'Share with the community',
                'Beautiful writing experience',
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-1 h-1 bg-stone-500 rounded-full" />
                  <p className="text-sm text-stone-500 font-light">{feature}</p>
                </div>
              ))}
            </div> */}
          </div>

          {/* ── RIGHT: Form panel (from new form) ── */}
          <div className="lg:col-span-3 w-full max-w-sm mx-auto lg:mx-0 lg:ml-auto">

            {/* Mobile-only logo (shown when left panel is hidden) */}
            <div className="flex flex-col items-center gap-2 mb-10 lg:hidden">
              <svg width="206" height="156" viewBox="0 0 206 156" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-9">
                <path d="M85.3772 32.024L16.1691 18.3645C10.9033 17.3252 6 21.3553 6 26.7227C6 30.8625 8.97598 34.4031 13.0541 35.1152L72.9119 45.5665C76.784 46.2426 79.6096 49.6043 79.6096 53.535C79.6096 57.649 76.5216 61.1077 72.4339 61.5723L51.7716 63.9202C42.8656 64.9323 39.49 76.1065 46.3462 81.8801C48.8875 84.0202 52.311 84.7903 55.5239 83.9448L86.0883 75.9016C91.2213 74.5508 94.7989 69.9099 94.7989 64.6022V43.4869C94.7989 37.9062 90.8523 33.1046 85.3772 32.024Z" fill="#1c1917" stroke="#1c1917" strokeWidth="11.6841"/>
                <path d="M120.579 32.024L189.787 18.3645C195.053 17.3252 199.956 21.3553 199.956 26.7227C199.956 30.8625 196.98 34.4031 192.902 35.1152L133.044 45.5665C129.172 46.2426 126.346 49.6043 126.346 53.535C126.346 57.649 129.434 61.1077 133.522 61.5723L153.915 63.8896C162.691 64.8869 165.865 76.0069 158.939 81.4872C156.537 83.3876 153.391 84.069 150.418 83.3327L120.032 75.8074C114.819 74.5162 111.157 69.837 111.157 64.466V43.4869C111.157 37.9062 115.104 33.1046 120.579 32.024Z" fill="#1c1917" stroke="#1c1917" strokeWidth="11.6841"/>
                <path d="M102.979 5.8418H105.315C107.897 5.84184 109.989 7.9345 109.989 10.5156C109.989 13.0968 107.897 15.1894 105.315 15.1895H102.979C100.397 15.1894 98.3047 13.0968 98.3047 10.5156C98.3047 7.93448 100.397 5.84181 102.979 5.8418Z" fill="#1c1917" stroke="#1c1917" strokeWidth="11.6841"/>
                <path d="M111.157 143.714V66.5989C111.157 63.3724 113.773 60.7568 116.999 60.7568C120.226 60.7568 122.841 63.3724 122.841 66.5989V143.714C122.841 146.94 120.226 149.556 116.999 149.556C113.773 149.556 111.157 146.94 111.157 143.714Z" fill="#1c1917" stroke="#1c1917" strokeWidth="11.6841"/>
              </svg>
              <span className="text-xs tracking-widest text-stone-500 font-medium">FORCE</span>
            </div>

            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-5xl md:text-6xl font-light text-stone-900 mb-4 leading-tight" style={{ letterSpacing: '-0.02em' }}>
                Your story starts here
              </h2>
              <p className="text-xs md:text-sm text-stone-500 font-medium tracking-widest">
                Step {stepNumber} of {totalSteps}
              </p>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-1.5 mb-12">
              {[...Array(totalSteps)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${i < stepNumber ? 'bg-stone-800' : 'bg-stone-200'}`}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 rounded-lg border border-rose-200 bg-rose-50 animate-fade-in">
                <p className="text-sm text-rose-700">{error}</p>
              </div>
            )}

            {/* ── Name Step ── */}
            {currentStep === 'name' && (
              <form onSubmit={handleNameSubmit} className="space-y-8 animate-slide-in">
                <div className="relative">
                  <label className="block text-sm font-light text-black/60 mb-3 tracking-wide">
                    What should we call you?
                  </label>
                  <div className="relative group">
                    <input
                      type="text" name="name" value={formData.name}
                      onChange={handleChange} autoFocus required
                      className="w-full px-0 py-4 bg-transparent border-0 border-b-2 border-black/20 text-black text-lg font-light focus:outline-none focus:border-black transition-all duration-300 placeholder:text-black/30 px-4"
                      placeholder="Your name"
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-black opacity-0 group-focus-within:opacity-20 blur-sm transition-opacity duration-300" />
                  </div>
                </div>

                <button
                  type="submit" disabled={!formData.name.trim()}
                  className="group relative w-full py-4 bg-stone-800 hover:bg-stone-900 active:bg-stone-950 text-stone-50 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md flex items-center justify-center gap-3 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <span className="relative z-10">Continue</span>
                  <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                </button>

                <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-xs text-stone-400 font-medium uppercase">or</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>

                <button
                  type="button" onClick={handleGoogleSignUp}
                  className="relative w-full py-4 border border-stone-300 text-stone-900 font-medium text-sm hover:bg-stone-50 transition-all duration-200 rounded-lg flex items-center justify-center gap-3 overflow-hidden"
                >
                  <svg className="relative z-10 w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="relative z-10">Continue with Google</span>
                </button>
              </form>
            )}

            {/* ── Email Step ── */}
            {currentStep === 'email' && (
              <form onSubmit={handleEmailSubmit} className="space-y-8 animate-slide-in">
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-light text-black/60 tracking-wide">Your email address</label>
                    <button type="button" onClick={() => setCurrentStep('name')}
                      className="text-xs text-black/40 hover:text-black transition-colors underline">
                      Back
                    </button>
                  </div>
                  <div className="relative group">
                    <input
                      type="email" name="email" value={formData.email}
                      onChange={handleChange} autoFocus required disabled={loading}
                      className="w-full px-0 py-4 bg-transparent border-0 border-b-2 border-black/20 text-black text-lg font-light focus:outline-none focus:border-black transition-all duration-300 placeholder:text-black/30 px-4"
                      placeholder="your@email.com"
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-black opacity-0 group-focus-within:opacity-20 blur-sm transition-opacity duration-300" />
                  </div>
                </div>

                <button
                  type="submit" disabled={!formData.email.includes('@') || loading}
                  className="group relative w-full py-4 bg-stone-800 hover:bg-stone-900 active:bg-stone-950 text-stone-50 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md flex items-center justify-center gap-3 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  {loading ? (
                    <>
                      <div className="relative z-10 w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="relative z-10">Verifying email...</span>
                    </>
                  ) : (
                    <>
                      <span className="relative z-10">Continue</span>
                      <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* ── Password Step ── */}
            {currentStep === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-8 animate-slide-in">
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-light text-black/60 tracking-wide">Create a password</label>
                    <button type="button" onClick={() => setCurrentStep('email')}
                      className="text-xs text-black/40 hover:text-black transition-colors underline">
                      Back
                    </button>
                  </div>
                  <div className="relative group">
                    <input
                      type={showPassword ? 'text' : 'password'} name="password"
                      value={formData.password} onChange={handleChange} autoFocus required
                      className="w-full px-0 py-4 bg-transparent border-0 border-b-2 border-black/20 text-black text-lg font-light focus:outline-none focus:border-black transition-all duration-300 pr-10 placeholder:text-black/30"
                      placeholder="Enter a strong password"
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-black opacity-0 group-focus-within:opacity-20 blur-sm transition-opacity duration-300" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-black/40 hover:text-black transition-colors">
                      {showPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.5} /> : <Eye className="w-5 h-5" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>

                {formData.password && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-black/50 uppercase tracking-wider">
                        Strength: {getPasswordStrengthLabel()}
                      </span>
                      <span className="text-xs text-black/40">{passwordStrength}%</span>
                    </div>
                    <div className="h-0.5 bg-black/10 overflow-hidden rounded-full">
                      <div
                        className="h-full bg-stone-800 transition-all duration-500 rounded-full"
                        style={{ width: `${passwordStrength}%` }}
                      />
                    </div>
                    <div className="space-y-2 pt-2">
                      {getPasswordChecks().map((check, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          {check.valid
                            ? <Check className="w-3 h-3 text-stone-700" strokeWidth={2} />
                            : <X className="w-3 h-3 text-black/20" strokeWidth={2} />}
                          <span className={`text-xs ${check.valid ? 'text-black/70' : 'text-black/30'}`}>
                            {check.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit" disabled={passwordStrength < 40}
                  className="group relative w-full py-4 bg-stone-800 hover:bg-stone-900 active:bg-stone-950 text-stone-50 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md flex items-center justify-center gap-3 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <span className="relative z-10">Continue</span>
                  <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                </button>
              </form>
            )}

            {/* ── Confirm Password Step ── */}
            {currentStep === 'confirm' && (
              <form onSubmit={handleRegister} className="space-y-8 animate-slide-in">
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-light text-black/60 tracking-wide">Confirm your password</label>
                    <button type="button" onClick={() => setCurrentStep('password')}
                      className="text-xs text-black/40 hover:text-black transition-colors underline">
                      Back
                    </button>
                  </div>
                  <div className="relative group">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword"
                      value={formData.confirmPassword} onChange={handleChange} autoFocus required
                      className="w-full px-0 py-4 bg-transparent border-0 border-b-2 border-black/20 text-black text-lg font-light focus:outline-none focus:border-black transition-all duration-300 pr-10 placeholder:text-black/30"
                      placeholder="Re-enter your password"
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-px bg-black opacity-0 group-focus-within:opacity-20 blur-sm transition-opacity duration-300" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 text-black/40 hover:text-black transition-colors">
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" strokeWidth={1.5} /> : <Eye className="w-5 h-5" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>

                {formData.confirmPassword && (
                  <div className="animate-fade-in">
                    {formData.password === formData.confirmPassword ? (
                      <div className="flex items-center gap-2 text-stone-700">
                        <Check className="w-4 h-4" strokeWidth={2} />
                        <span className="text-sm font-light">Passwords match</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-black/40">
                        <X className="w-4 h-4" strokeWidth={2} />
                        <span className="text-sm font-light">Passwords don't match</span>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-black/40 font-light text-center">
                  By creating an account, you agree to our{' '}
                  <a href="/terms-and-conditions" className="underline hover:text-black/70 transition-colors">Terms and Conditions</a>
                  {' '}and{' '}
                  <a href="/privacy-policy" className="underline hover:text-black/70 transition-colors">Privacy Policy</a>.
                </p>

                <button
                  type="submit" disabled={loading || formData.password !== formData.confirmPassword}
                  className="group relative w-full py-4 bg-stone-800 hover:bg-stone-900 active:bg-stone-950 text-stone-50 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 shadow-sm hover:shadow-md flex items-center justify-center gap-3 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  {loading ? (
                    <>
                      <div className="relative z-10 w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="relative z-10">Creating account...</span>
                    </>
                  ) : (
                    <>
                      <span className="relative z-10">Create account</span>
                      <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Sign in link */}
            {currentStep !== 'complete' && (
              <div className="mt-12 text-center">
                <p className="text-sm text-black/50 font-light">
                  Already have an account?{' '}
                  <a href="/login" className="text-black underline hover:no-underline transition-all">
                    Sign in
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0) rotate(0deg); }
          25% { transform: translateY(-30px) translateX(15px) rotate(5deg); }
          50% { transform: translateY(-15px) translateX(-15px) rotate(-5deg); }
          75% { transform: translateY(-40px) translateX(10px) rotate(3deg); }
        }
        @keyframes float-gentle {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes shimmer {
          0%, 100% { background-position: 0% 0%; }
          50% { background-position: 0% 100%; }
        }
        @keyframes wave {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-5px) scale(1.05); }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.05); }
        }
        @keyframes pulse-opacity {
          0%, 100% { opacity: 0.03; }
          50% { opacity: 0.06; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes flow-right {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes flow-left {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        @keyframes expand {
          0% { width: 0; opacity: 0; }
          100% { width: 2.5rem; opacity: 1; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes text-reveal {
          from { opacity: 0; filter: blur(4px); }
          to { opacity: 1; filter: blur(0); }
        }
        @keyframes bounce-gentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(5deg); }
          75% { transform: rotate(-5deg); }
        }
        @keyframes pulse-gentle {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 0.2; transform: scale(1.1); }
        }
        @keyframes spin-very-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .animate-blink          { animation: blink 1s step-end infinite; }
        .animate-pulse-slow     { animation: pulse-slow 4s ease-in-out infinite; }
        .animate-spin-slow      { animation: spin-slow 8s linear infinite; }
        .animate-float-gentle   { animation: float-gentle 3s ease-in-out infinite; }
        .animate-flow-right     { animation: flow-right 15s linear infinite; }
        .animate-flow-left      { animation: flow-left 15s linear infinite; }
        .animate-expand         { animation: expand 1s ease-out forwards; }
        .animate-fade-in-up     { animation: fade-in-up 1s ease-out forwards; opacity: 0; }
        .animate-text-reveal    { animation: text-reveal 0.6s ease-out forwards; }
        .animate-slide-in       { animation: slide-in 0.5s ease-out; }
        .animate-fade-in        { animation: fade-in 0.5s ease-out; }
        .animate-bounce-gentle  { animation: bounce-gentle 3s ease-in-out infinite; }
        .animate-wiggle         { animation: wiggle 4s ease-in-out infinite; }
        .animate-pulse-gentle   { animation: pulse-gentle 3s ease-in-out infinite; }
        .animate-spin-very-slow { animation: spin-very-slow 20s linear infinite; }
      `}</style>
    </div>
  )
}

export default RegisterFormNew
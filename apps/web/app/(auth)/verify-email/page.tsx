// apps\web\app\(auth)\verify-email\page.tsx
'use client'

import { Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const email = searchParams?.get('email')
  const [isResending, setIsResending] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createClient()

  const handleResendEmail = async () => {
    if (!email) {
      setMessage('No email address found. Please register again.')
      return
    }

    setIsResending(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })

      if (error) {
        setMessage(error.message)
      } else {
        setMessage('Verification email sent! Please check your inbox.')
      }
    } catch (err) {
      setMessage('Failed to resend email. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white py-8 flex flex-col items-center justify-center">
      <div className="container mx-auto max-w-md px-6 py-8 bg-gray-800 rounded-xl shadow-2xl text-center">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-blue-500 p-4">
            <Mail className="w-12 h-12 text-white" />
          </div>
        </div>

        <h1 className="font-bold text-3xl mb-4">Check Your Email</h1>
        
        <p className="text-gray-300 mb-2">
          We've sent a verification link to:
        </p>
        {email && (
          <p className="text-blue-400 font-medium mb-6">
            {email}
          </p>
        )}

        <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 mb-6 text-left">
          <h3 className="font-semibold mb-2 text-sm">Next Steps:</h3>
          <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
            <li>Check your email inbox</li>
            <li>Click the verification link in the email</li>
            <li>You'll be redirected to login</li>
          </ol>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.includes('sent') 
              ? 'bg-green-500/20 border border-green-500 text-green-100' 
              : 'bg-red-500/20 border border-red-500 text-red-100'
          }`}>
            {message}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleResendEmail}
            disabled={isResending || !email}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResending ? 'Sending...' : 'Resend Verification Email'}
          </button>

          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          <p>Didn't receive the email? Check your spam folder</p>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
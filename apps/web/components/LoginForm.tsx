// apps/web/components/LoginForm.tsx
"use client"
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Mail, Lock, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { createClient } from '@/utils/supabase/client';
import { signInWithEmail } from '@/actions/auth';
import { initializeEncryption } from '@/utils/encryption/keyManager';
import { getUserEncryptionData } from '@/actions/encryption';

const LoginForm = () => {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      // Use server action instead of direct client call
      const { data, error: signInError } = await signInWithEmail({
        email,
        password,
      });

      if (signInError) {
        // Handle specific error cases
        if (signInError.message.includes('Email not confirmed')) {
          setError('Please verify your email before logging in. Check your inbox for the verification link.');
        } else if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else {
          setError(signInError.message);
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Initialize encryption after successful login
        try {
          const encryptionData = await getUserEncryptionData();
          
          if (encryptionData) {
            // Pass key_version so initializeEncryption uses the correct PBKDF2 iteration
            // count (100k for legacy key_version=1, 600k for device-key key_version=2).
            await initializeEncryption(
              data.user.id,
              password, // Email users use their actual password
              encryptionData.salt,
              encryptionData.encrypted_master_key,
              encryptionData.master_key_iv,
              encryptionData.key_version  // ← CRITICAL: was always missing before
            );
            console.log('[LoginForm] Encryption initialized successfully for email user');
          } else {
            console.warn('[LoginForm] No encryption data found for user - encryption not initialized');
          }
        } catch (encError) {
          console.error('[LoginForm] Error initializing encryption:', encError);
          // Don't block login if encryption fails
        }

        // Redirect to dashboard on successful login.
        // Use a full navigation so the browser sends any HTTP-only
        // auth cookies that the server action may have set. Client-side
        // router.push + router.refresh can sometimes render before the
        // cookie is attached, requiring a manual hard-refresh. A full
        // navigation ensures the session is available immediately.
        if (typeof window !== 'undefined') {
          window.location.assign('/dashboard');
        } else {
          // Fallback for non-browser contexts
          router.push('/dashboard');
        }
      }
    } catch (err) {
      setError('An error occurred during login');
      setIsLoading(false);
      console.error(err);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      setError('Google sign-in failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (error) setError('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (error) setError('');
  };

  return (
    <div className='min-h-screen bg-black text-white relative overflow-hidden'>
      {/* Animated Background Grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient Orbs */}
        <div className="absolute top-20 left-20 w-[500px] h-[500px] bg-purple-600 rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-blob"></div>
        <div className="absolute bottom-20 right-20 w-[500px] h-[500px] bg-blue-600 rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-pink-600 rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-blob animation-delay-4000"></div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]"></div>
      </div>

      <div className='min-h-screen grid lg:grid-cols-2 relative z-10'>
        {/* Left Side - Branding & Info */}
        <div className='hidden lg:flex flex-col justify-center items-center p-12 xl:p-20 relative'>
          <div className='max-w-xl space-y-8 animate-fade-in'>
            {/* Logo */}
            <div className='space-y-4'>
              <h1 className='text-7xl xl:text-8xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent tracking-tight leading-tight'>
                Force
              </h1>
              <p className='text-2xl xl:text-3xl text-gray-300 font-light'>
                Your Personal Journal Companion
              </p>
            </div>

            {/* Features */}
            <div className='space-y-6 pt-8'>
              <div className='flex items-start gap-4 group'>
                <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform'>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className='text-xl font-semibold mb-1'>End-to-End Encrypted</h3>
                  <p className='text-gray-400'>Your thoughts stay private with AES-256 encryption</p>
                </div>
              </div>

              <div className='flex items-start gap-4 group'>
                <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform'>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className='text-xl font-semibold mb-1'>AI-Powered Insights</h3>
                  <p className='text-gray-400'>Get personalized insights from your journal entries</p>
                </div>
              </div>

              <div className='flex items-start gap-4 group'>
                <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform'>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className='text-xl font-semibold mb-1'>Beautiful Customization</h3>
                  <p className='text-gray-400'>Personalize your journaling experience your way</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className='flex gap-8 pt-8 border-t border-white/10'>
              <div>
                <div className='text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent'>10k+</div>
                <div className='text-sm text-gray-400'>Active Users</div>
              </div>
              <div>
                <div className='text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent'>50k+</div>
                <div className='text-sm text-gray-400'>Journals Written</div>
              </div>
              <div>
                <div className='text-3xl font-bold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent'>99.9%</div>
                <div className='text-sm text-gray-400'>Uptime</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className='flex flex-col justify-center items-center p-6 sm:p-8 lg:p-12 xl:p-20'>
          <div className='w-full max-w-md space-y-8 animate-slide-up'>
            {/* Mobile Logo */}
            <div className='lg:hidden text-center mb-8'>
              <h1 className='text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent tracking-tight'>
                Force
              </h1>
              <p className='text-gray-400 mt-2'>Your Personal Journal Companion</p>
            </div>

            {/* Form Card */}
            <div className='backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 p-8 shadow-2xl'>
              <div className='mb-8'>
                <h2 className='text-3xl font-bold mb-2'>Welcome Back</h2>
                <p className='text-gray-400'>Sign in to continue your journey</p>
              </div>

        {error && (
          <div className="bg-red-500/20 backdrop-blur-sm border border-red-400/50 text-red-100 px-4 py-3 rounded-xl mb-6 flex items-center gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="w-full space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-200">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-purple-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:bg-white/10 text-white placeholder-gray-400"
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-200">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-purple-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange}
                  className="w-full pl-10 pr-12 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:bg-white/10 text-white placeholder-gray-400"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-purple-400 transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-300 group-hover:text-white transition-colors">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-purple-400 hover:text-purple-300 transition-colors font-medium">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-purple-500/50 transform hover:scale-[1.02]"
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>

          <div className="relative w-full py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 text-gray-400 bg-transparent backdrop-blur-xl">
                Or continue with
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3.5 px-4 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            disabled={isLoading}
          >
            <FcGoogle className="text-2xl" />
            <span>Sign in with Google</span>
          </button>

          <p className="text-sm text-gray-300 text-center pt-2">
            Don't have an account yet?{' '}
            <Link href="/register" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
              Register now
            </Link>
          </p>

          <p className="text-xs text-gray-400 text-center mt-4">
            Didn't receive verification email?{' '}
            <Link href="/resend-verification" className="text-purple-400 hover:text-purple-300 transition-colors">
              Resend
            </Link>
          </p>
        </form>

              {/* Footer */}
              <div className='text-center text-sm pt-6 border-t border-white/10'>
                <p className='text-gray-400'>
                  New to Force?{' '}
                  <Link href="/register" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
                    Create an account
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
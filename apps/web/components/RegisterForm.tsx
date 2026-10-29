// apps/web/components/RegisterForm.tsx
"use client"
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SkipBack, Mail, Lock, User, Phone, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { createClient } from '@/utils/supabase/client';
import { signUpWithEmail } from '@/actions/auth';
import { initializeEncryptionForNewUser, initializeEncryption } from '@/utils/encryption/keyManager';
import RecoveryCodesDisplay from '@/components/security/RecoveryCodesDisplay';

interface RegistrationData {
  email: string;
  password: string;
  name: string;
  phone: string;
  confirmPassword: string;
}

const RegisterForm = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  // Phase 2: recovery codes shown once after signup
  const [pendingRecoveryCodes, setPendingRecoveryCodes] = useState<string[]>([]);
  const [pendingEmail, setPendingEmail] = useState<string>('');
  const supabase = createClient();

  const initialFormState: RegistrationData = {
    email: '',
    password: '',
    name: '',
    phone: '',
    confirmPassword: '',
  };

  const [formData, setFormData] = useState<RegistrationData>(initialFormState);
  const [error, setError] = useState<string>('');
  const [passwordStrength, setPasswordStrength] = useState<number>(0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    // Calculate password strength
    if (name === 'password') {
      calculatePasswordStrength(value);
    }

    // Clear error when user types
    if (error) setError('');
  };

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 12.5;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 12.5;
    setPasswordStrength(Math.min(strength, 100));
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 25) return 'bg-red-500';
    if (passwordStrength < 50) return 'bg-orange-500';
    if (passwordStrength < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 25) return 'Weak';
    if (passwordStrength < 50) return 'Fair';
    if (passwordStrength < 75) return 'Good';
    return 'Strong';
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setError('');
    setPasswordStrength(0);
  };

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    // Validate form
    if (!formData.email || !formData.password || !formData.name) {
      setError('Please fill in all required fields');
      setIsSubmitting(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsSubmitting(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsSubmitting(false);
      return;
    }

    try {
      // Initialize encryption and generate master key BEFORE signup
      // This generates salt, master key, and encrypts master key with password
      const tempUserId = `temp_${Date.now()}`; // Temporary ID for key generation
      const { 
        salt: encryptionSalt, 
        encryptedMasterKey, 
        masterKeyIV,
        recoveryCodes,  // Phase 2: plain codes for one-time display
      } = await initializeEncryptionForNewUser(tempUserId, formData.password);

      console.log('[RegisterForm] Generated encryption data for new user');

      // Use the server action with encryption data
      const { data, error: signUpError } = await signUpWithEmail({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone || undefined,
        encryptionSalt, // Pass salt to store in user metadata
        encryptedMasterKey, // Pass encrypted master key
        masterKeyIV, // Pass master key IV
      });

      if (signUpError) {
        setError(signUpError.message);
        setIsSubmitting(false);
        return;
      }

      if (data.user) {
        // Check if email confirmation is required
        if (data.user.identities && data.user.identities.length === 0) {
          setError('This email is already registered. Please login instead.');
          setIsSubmitting(false);
          return;
        }

        // Re-initialize encryption with actual user ID and decrypt master key
        if (data.user.id) {
          await initializeEncryption(
            data.user.id,
            formData.password,
            encryptionSalt,
            encryptedMasterKey,
            masterKeyIV
          );
          console.log('[RegisterForm] Encryption initialized with actual user ID');
        }

        // Phase 2: if recovery codes were generated, show them before proceeding
        if (recoveryCodes && recoveryCodes.length > 0) {
          setPendingEmail(formData.email);
          setPendingRecoveryCodes(recoveryCodes);
          // registrationSuccess = true will be set after codes are dismissed
          setIsSubmitting(false);
          resetForm();
          return; // Don't show the email-sent screen yet — show codes first
        }

        // Show success message (no recovery codes case)
        setRegistrationSuccess(true);
        resetForm();

        // Redirect after 3 seconds with email parameter
        setTimeout(() => {
          router.push(`/verify-email?email=${encodeURIComponent(formData.email)}`);
        }, 3000);
      }
    } catch (err) {
      setError('An error occurred during registration');
      console.error(err);
      setIsSubmitting(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      setError('Google sign-in failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Phase 2: show recovery codes before the success screen
  if (pendingRecoveryCodes.length > 0) {
    return (
      <RecoveryCodesDisplay
        codes={pendingRecoveryCodes}
        mode="modal"
        context="signup"
        onDismiss={() => {
          setPendingRecoveryCodes([]);
          setRegistrationSuccess(true);
          setTimeout(() => {
            router.push(`/verify-email?email=${encodeURIComponent(pendingEmail)}`);
          }, 3000);
        }}
      />
    );
  }

  if (registrationSuccess) {
    return (
      <div className='min-h-screen bg-black text-white relative overflow-hidden flex items-center justify-center'>
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-[500px] h-[500px] bg-green-600 rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-blob"></div>
          <div className="absolute bottom-20 right-20 w-[500px] h-[500px] bg-emerald-600 rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-blob animation-delay-2000"></div>
        </div>

        <div className='w-full max-w-2xl mx-auto px-6 relative z-10'>
          <div className='backdrop-blur-xl bg-white/5 rounded-3xl shadow-2xl border border-white/10 p-12 text-center animate-scale-in'>
            <div className="flex justify-center mb-8">
              <div className="rounded-full bg-gradient-to-r from-green-500 to-emerald-500 p-6 shadow-2xl animate-bounce-slow">
                <CheckCircle2 className="w-20 h-20 text-white" />
              </div>
            </div>
            <h1 className='font-bold text-5xl mb-6 bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent'>
              Account Created Successfully!
            </h1>
            <p className='text-gray-200 mb-6 text-xl'>
              We've sent a verification email to <br/>
              <strong className="text-white text-2xl">{formData.email}</strong>
            </p>
            <p className='text-base text-gray-300 mb-8 max-w-lg mx-auto'>
              Please check your inbox and click the verification link to activate your account and start your journaling journey.
            </p>
            <div className="mt-10">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-green-400" />
              <p className="text-base text-gray-300 mt-4">Redirecting to verification page...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        {/* Left Side - Branding & Benefits */}
        <div className='hidden lg:flex flex-col justify-center items-center p-12 xl:p-20 relative'>
          <div className='max-w-xl space-y-8 animate-fade-in'>
            {/* Logo */}
            <div className='space-y-4'>
              <h1 className='text-7xl xl:text-8xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent tracking-tight leading-tight'>
                Force
              </h1>
              <p className='text-2xl xl:text-3xl text-gray-300 font-light'>
                Start Your Journaling Journey
              </p>
            </div>

            {/* Benefits */}
            <div className='space-y-6 pt-8'>
              <div className='flex items-start gap-4 group'>
                <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform'>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className='text-xl font-semibold mb-1'>Quick & Easy Setup</h3>
                  <p className='text-gray-400'>Create your account in less than 60 seconds</p>
                </div>
              </div>

              <div className='flex items-start gap-4 group'>
                <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform'>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className='text-xl font-semibold mb-1'>Bank-Level Security</h3>
                  <p className='text-gray-400'>Your data is encrypted and secure, always</p>
                </div>
              </div>

              <div className='flex items-start gap-4 group'>
                <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform'>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className='text-xl font-semibold mb-1'>Join 10,000+ Writers</h3>
                  <p className='text-gray-400'>Be part of our growing community</p>
                </div>
              </div>
            </div>

            {/* Social Proof */}
            <div className='pt-8 border-t border-white/10'>
              <p className='text-gray-400 mb-4'>Trusted by individuals worldwide</p>
              <div className='flex -space-x-2'>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className='w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border-2 border-black flex items-center justify-center text-sm font-bold'>
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
                <div className='w-10 h-10 rounded-full bg-white/10 border-2 border-black flex items-center justify-center text-xs font-bold'>
                  +10k
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Registration Form */}
        <div className='flex flex-col justify-center items-center p-6 sm:p-8 lg:p-12 xl:p-20'>
          <div className='w-full max-w-md space-y-8 animate-slide-up'>
            {/* Mobile Logo */}
            <div className='lg:hidden text-center mb-8'>
              <h1 className='text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent tracking-tight'>
                Force
              </h1>
              <p className='text-gray-400 mt-2'>Start Your Journey Today</p>
            </div>

            {/* Form Card */}
            <div className='backdrop-blur-xl bg-white/5 rounded-3xl border border-white/10 p-8 shadow-2xl'>
              <div className='mb-8'>
                <h2 className='text-3xl font-bold mb-2'>Create Account</h2>
                <p className='text-gray-400'>Join Force today</p>
              </div>

        {error && (
          <div className="bg-red-500/20 backdrop-blur-sm border border-red-400/50 text-red-100 px-4 py-3 rounded-xl mb-6 animate-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleRegistration} className="flex flex-col gap-4">
          {/* Name Field */}
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-gray-200">
              Full Name <span className="text-red-400">*</span>
            </label>
            <div className="relative group">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-purple-400" />
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:bg-white/10 text-white placeholder-gray-400"
                placeholder="John Doe"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-200">
              Email Address <span className="text-red-400">*</span>
            </label>
            <div className="relative group">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-purple-400" />
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:bg-white/10 text-white placeholder-gray-400"
                placeholder="you@example.com"
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Phone Field (Optional) */}
          <div className="space-y-2">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-200">
              Phone Number <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <div className="relative group">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-purple-400" />
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:bg-white/10 text-white placeholder-gray-400"
                placeholder="+1 (555) 000-0000"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-gray-200">
              Password <span className="text-red-400">*</span>
            </label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-purple-400" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleInputChange}
                className="w-full pl-10 pr-12 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:bg-white/10 text-white placeholder-gray-400"
                placeholder="••••••••"
                required
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-purple-400 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {formData.password && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300">Password strength:</span>
                  <span className={`text-xs font-semibold ${passwordStrength >= 75 ? 'text-green-400' : passwordStrength >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {getPasswordStrengthText()}
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                    style={{ width: `${passwordStrength}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-200">
              Confirm Password <span className="text-red-400">*</span>
            </label>
            <div className="relative group">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 transition-colors group-focus-within:text-purple-400" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full pl-10 pr-12 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all hover:bg-white/10 text-white placeholder-gray-400"
                placeholder="••••••••"
                required
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-purple-400 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-transparent flex items-center justify-center gap-2 shadow-lg hover:shadow-purple-500/50 transform hover:scale-[1.02] ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </button>

          <div className="relative w-full py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 text-gray-400 bg-transparent backdrop-blur-xl">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-800 font-semibold py-3.5 px-4 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-transparent shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
            disabled={isSubmitting}
          >
            <FcGoogle className="text-2xl" />
            <span>Sign up with Google</span>
          </button>

          <p className="text-sm text-gray-300 text-center pt-2">
            Already have an account?{' '}
            <Link href="/login" className="text-purple-400 hover:text-purple-300 font-semibold transition-colors">
              Log in
            </Link>
          </p>
        </form>

              {/* Footer */}
              <div className='text-center text-sm pt-6 border-t border-white/10'>
                <Link href="/" className='inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors'>
                  <SkipBack className="w-4 h-4" />
                  <span>Back to Home</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;
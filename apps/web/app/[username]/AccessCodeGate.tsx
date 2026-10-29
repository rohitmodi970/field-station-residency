'use client';

import { FormEvent, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

import OtpInput from './otp-input';

type AccessCodeGateProps = {
  username: string;
  displayName: string;
};

type VerifyResponse = {
  success: boolean;
  error?: string;
  message?: string;
  nextUrl?: string;
  user?: {
    username: string;
    name: string;
    email: string;
  };
};

export default function AccessCodeGate({ username, displayName }: AccessCodeGateProps) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const usernamePath = useMemo(() => `/${username}`, [username]);
  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const normalizedCode = code.trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/access-code/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          code: normalizedCode,
        }),
      });

      const data = (await response.json()) as VerifyResponse;
      if (!response.ok || !data.success) {
        setError(data.error || 'Code verification failed. Please try again.');
        setLoading(false);
        return;
      }

      // Optionally use returned user info (analytics, logging)
      if (data.user?.name) {
        // user.name available: data.user.name
      }

      // Immediately navigate to the next step instead of showing an intermediate success UI
      const target = data.nextUrl || `/register?verifiedUsername=${encodeURIComponent(username)}`;
      router.push(target);
      setLoading(false);
      return;
    } catch {
      setError('Unable to verify code right now. Please try again.');
      setLoading(false);
    }
  };

  const isCodeComplete = code.length === 6;

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.96, y: 14 },
    visible: { opacity: 1, scale: 1, y: 0 },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 },
  };

 
// Attempt to read CSS variables for theming, with fallbacks
  return (
    <main
      className="min-h-screen flex items-center justify-center bg-[#f6efe6] px-6 py-12 text-[#2f2b26] md:py-20 bg-cover bg-center"
      style={{ backgroundImage: "url('/doorway-bg.jpg')" }}
    >
      <div className="relative mx-auto w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-xl"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-3xl md:text-5xl font-semibold text-slate-900 mb-6 tracking-tight leading-[1.1] text-center"
            style={{
              letterSpacing: '-0.02em',
            }}
          >
            The door is open
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="text-base md:text-lg text-slate-700/75 mb-9 font-light text-center "
          >
            Enter the code here
          </motion.p>

          <motion.form onSubmit={handleVerify} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.5 }} className="flex flex-col gap-7">
          <div className="flex justify-center">
            <OtpInput value={code} onChange={setCode} />
          </div>

          {error && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-center text-sm text-red-500/80">
              {error}
            </motion.p>
          )}

          <motion.button
            type="submit"
            disabled={!isCodeComplete || loading}
            whileHover={{ scale: isCodeComplete && !loading ? 1.02 : 1 }}
            whileTap={{ scale: isCodeComplete && !loading ? 0.98 : 1 }}
            className="w-full py-4 md:py-4 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-300 disabled:to-slate-400 disabled:opacity-45 disabled:cursor-not-allowed text-white font-light tracking-wide text-sm rounded-xl transition-all duration-300 shadow-lg hover:shadow-amber-400/20 disabled:shadow-none"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                />
                Entering...
              </span>
            ) : (
              <span>Step inside Force</span>
            )}
          </motion.button>
          </motion.form>

          {/* <p className="mt-6 text-xs text-[#7b6d5f]">Your access path: {usernamePath}</p> */}
        </motion.div>
        <motion.div
          className="pointer-events-none absolute inset-0 -z-10 rounded-3xl blur-2xl opacity-10"
          animate={{
            boxShadow: [
              '0 0 40px rgba(217, 119, 6, 0.15)',
              '0 0 70px rgba(217, 119, 6, 0.22)',
              '0 0 40px rgba(217, 119, 6, 0.15)',
            ],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
    </main>
  );

}

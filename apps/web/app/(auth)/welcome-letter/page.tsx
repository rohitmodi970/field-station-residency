'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

const LETTER_TEXT = `Hey.

This might feel unfamiliar.

There's no right way to do this.
No format to follow.

You don't have to sound smart.
You don't have to be consistent.

You just have to be honest.

That's enough.

-- Force`;
// This page is intentionally simple and doesn't use the OnboardingForm or WelcomeLetter components, as it has a unique design and behavior compared to the rest of the onboarding flow.
function WelcomeLetterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  const rawName = (searchParams.get('name') || '').trim();
  const rawEmail = (searchParams.get('email') || '').trim();

  const displayName = useMemo(() => {
    if (rawName) {
      return rawName;
    }
    if (rawEmail) {
      return rawEmail.split('@')[0] || 'there';
    }
    return 'there';
  }, [rawEmail, rawName]);
// The typing effect and cursor blinking are handled with two separate useEffect hooks. The first one types out the LETTER_TEXT character by character, while the second one toggles the visibility of the cursor every 520ms. The delays for typing characters are adjusted based on whether the character is a period or a newline to create a more natural typing effect.
  useEffect(() => {
    let charIndex = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const typeNextCharacter = () => {
      if (charIndex < LETTER_TEXT.length) {
        const char = LETTER_TEXT[charIndex];
        setDisplayedText(LETTER_TEXT.substring(0, charIndex + 1));

        let delay = 36;
        if (char === '.') {
          delay = 520;
        } else if (char === '\n') {
          delay = 320;
        }

        charIndex += 1;
        timeout = setTimeout(typeNextCharacter, delay);
      } else {
        setIsComplete(true);
      }
    };

    timeout = setTimeout(typeNextCharacter, 220);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 520);

    return () => clearInterval(interval);
  }, []);

  const handleContinue = () => {
    router.push('/login');
  };

  return (
    <main
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{
        background: 'radial-gradient(circle at center, #2c2016 0%, #120c08 100%)',
      }}
    >
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' result='noise' /%3E%3C/filter%3E%3Crect width='400' height='400' fill='white' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      <motion.div
        className="relative w-full max-w-2xl mx-auto px-6"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div
          className="relative bg-[#f6efe6] shadow-2xl p-8 md:p-12 text-[#2f2b26]"
          style={{
            minHeight: '70vh',
            boxShadow: '0 28px 60px rgba(10, 6, 3, 0.75), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
            backgroundImage: `repeating-linear-gradient(
              90deg,
              transparent,
              transparent 2px,
              rgba(46, 34, 24, 0.03) 2px,
              rgba(46, 34, 24, 0.03) 4px
            ),
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(46, 34, 24, 0.03) 2px,
              rgba(46, 34, 24, 0.03) 4px
            )`,
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-b from-black/15 to-transparent pointer-events-none" />

          <div className="font-serif text-lg leading-8 text-[#2f2b26] whitespace-pre-wrap h-full flex flex-col justify-start">
            <span className="text-base tracking-wide">
              {displayedText}
              {!isComplete && showCursor && (
                <span className="inline-block w-0.5 h-6 bg-[#2f2b26] ml-0.5" />
              )}
              {isComplete && showCursor && (
                <span className="inline-block w-0.5 h-6 bg-[#2f2b26] ml-0.5" />
              )}
            </span>
          </div>
        </div>

        {isComplete && (
          <motion.div
            className="flex flex-col items-center mt-10 gap-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <p className="text-sm text-[#c7b6a6] text-center">Welcome, {displayName}</p>
            <p className="text-xs text-[#b7a596] text-center max-w-sm">
              Check your inbox to verify your email. Once verified, log in to begin onboarding.
            </p>
            <button
              onClick={handleContinue}
              className="text-[#f0e3d6] hover:text-white transition-colors duration-300 text-lg tracking-wide group"
            >
              Continue to onboarding{' '}
              <span className="inline-block group-hover:translate-x-1 transition-transform duration-300">
                &rarr;
              </span>
            </button>
          </motion.div>
        )}
      </motion.div>
    </main>
  );
}

export default function WelcomeLetterPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-[#171311]">
          <div className="text-[#f0e3d6] text-xl">Loading...</div>
        </main>
      }
    >
      <WelcomeLetterContent />
    </Suspense>
  );
}

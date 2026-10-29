'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const COPY_TEXT = `Hey.

This might feel unfamiliar.

There's no right way to do this.
No format to follow.

You don't have to sound smart.
You don't have to be consistent.

You just have to be honest.

That's enough.

— Force`;

type WelcomeLetterProps = {
  displayName?: string;
  onContinue: () => void;
};

export default function WelcomeLetter({ displayName, onContinue }: WelcomeLetterProps) {
  const safeName = (displayName || 'there').trim() || 'there';
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let charIndex = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const typeNextCharacter = () => {
      if (charIndex < COPY_TEXT.length) {
        const char = COPY_TEXT[charIndex];
        setDisplayedText(COPY_TEXT.substring(0, charIndex + 1));

        let delay = 40;
        if (char === '.') {
          delay = 600;
        } else if (char === '\n') {
          delay = 400;
        }

        charIndex += 1;
        timeout = setTimeout(typeNextCharacter, delay);
      } else {
        setIsComplete(true);
      }
    };

    timeout = setTimeout(typeNextCharacter, 300);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      initial={{
        background: 'radial-gradient(circle at center, #0a0a0a 0%, #000000 100%)',
      }}
      exit={{
        background: 'radial-gradient(circle at center, #0f0f0f 0%, #000000 100%)',
      }}
      transition={{ duration: 1 }}
      style={{
        background: 'radial-gradient(circle at center, #0a0a0a 0%, #000000 100%)',
      }}
    >
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' result='noise' /%3E%3C/filter%3E%3Crect width='400' height='400' fill='white' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      <motion.div
        className="relative w-full max-w-2xl mx-auto px-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <div
          className="relative bg-stone-50 shadow-2xl p-8 md:p-12 text-foreground"
          style={{
            minHeight: '70vh',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            backgroundImage: `repeating-linear-gradient(
              90deg,
              transparent,
              transparent 2px,
              rgba(0, 0, 0, 0.01) 2px,
              rgba(0, 0, 0, 0.01) 4px
            ),
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0, 0, 0, 0.01) 2px,
              rgba(0, 0, 0, 0.01) 4px
            )`,
            transform: 'perspective(1000px) rotateX(0deg)',
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-b from-black/20 to-transparent pointer-events-none" />

          <div className="font-terminal-grotesque text-xl leading-9 text-stone-900 whitespace-pre-wrap h-full flex flex-col justify-start">
            <span className="text-lg tracking-wide">
              {displayedText}
              {!isComplete && showCursor && (
                <motion.span
                  className="inline-block w-0.5 h-6 bg-stone-900 ml-0.5"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
              {isComplete && showCursor && (
                <motion.span
                  className="inline-block w-0.5 h-6 bg-stone-900 ml-0.5"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                />
              )}
            </span>
          </div>
        </div>

        {isComplete && (
          <motion.div
            className="flex flex-col items-center mt-10 gap-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <p className="font-terminal-grotesque text-base text-stone-400 text-center">Welcome, {safeName}</p>
            <button
              onClick={onContinue}
              className="font-terminal-grotesque text-stone-300 hover:text-stone-100 transition-colors duration-300 text-xl tracking-wide group"
            >
              Begin{' '}
              <span className="inline-block group-hover:translate-x-1 transition-transform duration-300">
                →
              </span>
            </button>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

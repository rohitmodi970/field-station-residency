"use client";

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/utilities/context/ThemeContext';

export const PROMPT_LOADING_PHRASES = [
  'Building your prompt…',
  'Force is gathering your insights…',
  'Fetching your recent journals…',
  'Reflecting on your patterns…',
  'Connecting the dots…',
  'Personalizing your reflection…',
  'Force is thinking…',
];

interface PromptThinkingSkeletonProps {
  className?: string;
  isDarkMode?: boolean;
}

export function RotatingThinkingBadge({ isDarkMode: customDarkMode }: { isDarkMode?: boolean }) {
  const themeContext = useTheme();
  const isDarkMode = customDarkMode ?? themeContext?.isDarkMode ?? false;
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % PROMPT_LOADING_PHRASES.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 h-5 overflow-hidden">
      <span
        className="inline-flex h-2 w-2 rounded-full animate-pulse shrink-0"
        style={{ background: isDarkMode ? '#f59e0b' : '#c0874d' }}
      />
      <AnimatePresence mode="wait">
        <motion.span
          key={phraseIndex}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="text-xs font-medium uppercase tracking-widest whitespace-nowrap"
          style={{
            color: isDarkMode ? 'rgba(251,191,36,0.9)' : '#a07048',
            letterSpacing: '0.1em',
          }}
        >
          {PROMPT_LOADING_PHRASES[phraseIndex]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export default function PromptThinkingSkeleton({ className = '', isDarkMode: customDarkMode }: PromptThinkingSkeletonProps) {
  const themeContext = useTheme();
  const isDarkMode = customDarkMode ?? themeContext?.isDarkMode ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-(--radius-hero) border p-5 sm:p-7 md:p-8 lg:p-10 backdrop-blur-sm ${className}`}
      style={{
        borderColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(159,120,100,0.24)',
        background: isDarkMode ? 'rgba(15,23,42,0.72)' : 'rgba(255,249,244,0.86)',
      }}
    >
      <div className="mb-4">
        <RotatingThinkingBadge isDarkMode={isDarkMode} />
      </div>

      <div className="space-y-3">
        <div className={`h-4 w-28 rounded-full animate-pulse ${isDarkMode ? 'bg-slate-700/80' : 'bg-[#ecdacb]'}`} />
        <div className={`h-7 w-3/4 rounded-full animate-pulse ${isDarkMode ? 'bg-slate-600/90' : 'bg-[#f0e0d6]'}`} />
        <div className={`h-4 w-full rounded-full animate-pulse ${isDarkMode ? 'bg-slate-700/70' : 'bg-[#f3e7df]'}`} />
        <div className={`h-4 w-5/6 rounded-full animate-pulse ${isDarkMode ? 'bg-slate-700/70' : 'bg-[#f3e7df]'}`} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className={`h-10 w-36 rounded-full animate-pulse ${isDarkMode ? 'bg-slate-600/80' : 'bg-[#ead3c6]'}`} />
        <div className={`h-3 w-20 rounded-full animate-pulse ${isDarkMode ? 'bg-slate-700/60' : 'bg-[#f3e7df]'}`} />
      </div>
    </motion.div>
  );
}

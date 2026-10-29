"use client";

import { motion } from 'framer-motion';

export type GreetingSource = 'waitlist' | 'journal' | 'reengagement' | 'fallback' | 'llm';

export interface HeroGreeting {
  badge: string;
  title: string;
  subtitle: string;
  source: GreetingSource;
}

interface SpotlightGreetingHeroProps {
  greeting: HeroGreeting;
  loading?: boolean;
}

export function SpotlightGreetingHero({ greeting, loading = false }: SpotlightGreetingHeroProps) {
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-7 w-44 rounded-full bg-[#e7c3a5]/70" />
        <div className="mt-4 h-14 w-3/4 rounded-2xl bg-[#e7c3a5]/55" />
        <div className="mt-3 h-6 w-full rounded-xl bg-[#e7c3a5]/45" />
      </div>
    );
  }

  const dotColor =
    greeting.source === 'waitlist'
      ? 'bg-amber-500'
      : greeting.source === 'journal'
      ? 'bg-cyan-500'
      : greeting.source === 'reengagement'
      ? 'bg-orange-500'
      : 'bg-emerald-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-[#c8a99b]/45 bg-[#f8e6db]/84 px-3 py-1 text-xs font-semibold text-[#7b5146]">
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${dotColor}`} />
        {greeting.badge}
      </div>

      <h1
        className="mt-4 whitespace-pre-line text-[42px] leading-[0.95] tracking-[0.03em] text-[#2e2012] sm:text-[56px]"
        style={{ fontFamily: 'var(--dashboard-heading-font)' }}
      >
        {greeting.title}
      </h1>

      <p
        className="mt-3 max-w-3xl text-[17px] leading-relaxed text-[#6f5046]"
        style={{ fontFamily: 'var(--dashboard-body-font)', letterSpacing: '0.02em' }}
      >
        {greeting.subtitle}
      </p>
    </motion.div>
  );
}

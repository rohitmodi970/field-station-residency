"use client"

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/utilities/context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { isEncryptionInitialized } from '@/utils/encryption/keyManager';
import { decryptEntriesForAI } from '@/utils/encryption/decryptForAI';
import { useAiDecryption } from '@/utils/encryption/useAiDecryption';
import useDashboardStore from '@/stores/dashboardStore';
import { trackEvent, identifyUser, updateUserProperties } from '@/lib/posthog-events';
import type { SpotlightInsight } from '@/lib/spotlight/types';
import type { EnergyBucket, PersonalizedDashboardPayload } from '@/lib/personalization/types';
import { getBucketLabel } from '@/lib/personalization/bucket';
import type { DashboardInsights } from '@/lib/dashboard/insights';
import { SkeletonWritingPrompt } from '@/components/dashboard-b2c/skeletons/SkeletonWritingPrompt';
import { dashboardCache } from '@/lib/cache/dashboardCache';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { HeroGreeting, GreetingSource } from '@/components/spotlight/SpotlightGreetingHero';
import { setJournalPromptContext, setJournalPromptPrefill } from '@/lib/journal/new-entry-navigation';

// ─── B2C Dashboard Components (Phase 1) ───
// const MoodCheckin = dynamic(() => import('@/components/dashboard-b2c/MoodCheckin'), { ssr: false });
const WritingPromptHero = dynamic(() => import('@/components/dashboard-b2c/WritingPromptHero'), { ssr: false });
const PromptThinkingSkeleton = dynamic(() => import('@/components/dashboard-b2c/PromptThinkingSkeleton'), { ssr: false });

// ─── B2C Dashboard Components (Phase 2) ───
// const JourneyRing = dynamic(() => import('@/components/dashboard-b2c/JourneyRing'), { ssr: false });
// const MoodTimeline = dynamic(() => import('@/components/dashboard-b2c/MoodTimeline'), { ssr: false });

// ─── B2C Dashboard Components (Phase 2+: Wellness) ───
const MentalWeatherForecast = dynamic(() => import('@/components/dashboard-b2c/MentalWeatherForecast'), { ssr: false });
const WellnessBalance = dynamic(() => import('@/components/dashboard-b2c/WellnessBalance'), { ssr: false });
// AI Spotlight - Old version (stable)
// const AISpotlight = dynamic(() => import('@/components/dashboard-b2c/AISpotlight'), { ssr: false });
// AI Spotlight - New version (Beta) with activity scoring & re-engagement
// const SpotlightPanel = dynamic(() => import('@/components/spotlight/SpotlightPanel').then(m => ({ default: m.SpotlightPanel })), { ssr: false });
const SpotlightGreetingHero = dynamic(() => import('@/components/spotlight/SpotlightGreetingHero').then(m => ({ default: m.SpotlightGreetingHero })), { ssr: false });

// ─── B2C Dashboard Components (Phase 3) ───
const MemoryCarousel = dynamic(() => import('@/components/dashboard-b2c/MemoryCarousel'), { ssr: false });
const VektoriSnapshot = dynamic(() => import('@/components/dashboard-b2c/VektoriSnapshot').then(mod => ({ default: mod.VektoriSnapshot })), { ssr: false });
// const ActionPills = dynamic(() => import('@/components/dashboard-b2c/ActionPills'), { ssr: false });
// const DiscoverChips = dynamic(() => import('@/components/dashboard-b2c/DiscoverChips'), { ssr: false });

// ─── Existing components (still used) ───
// const FloatingActionButton = dynamic(() => import('@/components/FloatingActionButton'), { ssr: false });
const ThemeSidebar = dynamic(() => import('@/components/Navbar/ThemeSidebar'), { ssr: false });
const Toast = dynamic(() => import('@/components/ui/toast'), { ssr: false });
const NewUserGuidance = dynamic(() => import('@/components/DashBoardomponents').then(mod => ({ default: mod.NewUserGuidance })), { ssr: false });

const PROMPT_LOADING_PHRASES = [
  'Building your prompt…',
  'Force is gathering your insights…',
  'Fetching your recent journals…',
  'Reflecting on your patterns…',
  'Connecting the dots…',
  'Personalizing your workspace…',
  'Force is thinking…',
];

function RotatingThinkingText({ isDarkMode }: { isDarkMode: boolean }) {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % PROMPT_LOADING_PHRASES.length);
    }, 2400);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 mb-4 h-5 overflow-hidden">
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
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="text-xs font-medium uppercase tracking-widest whitespace-nowrap"
          style={{
            color: isDarkMode ? 'rgba(251,191,36,0.85)' : '#a07048',
            letterSpacing: '0.1em',
          }}
        >
          {PROMPT_LOADING_PHRASES[phraseIndex]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

interface JournalStats {
  totalEntries: number;
  streakCount: number;
  lastEntryDate: string | null;
  weeklyEntries: number;
  averageMood: string;
  mostProductiveDay: string;
  topTopics: { name: string; count: number }[];
}
// Note: The above interface is an example. The actual structure should match the data returned by your API.
interface PromptData {
  prompt: {
    text: string;
    explanation: string;
  };
  suggestions: {
    moodTrends: {
      primaryMood: string;
      trend: string;
      intensity: number;
    };
    aiNudge: {
      theme: string;
      suggestion: string;
      action: string;
    };
    patternInsight: {
      pattern: string;
      exploration: string;
    };
  };
  commitment?: boolean;
  requiresSelection: boolean;
  error?: string;
}

interface DashboardPersonalizationResponse {
  success: boolean;
  requiresSelection: boolean;
  bucket: EnergyBucket | null;
  reflection?: string | null;
  commitment?: boolean;
  personalization?: PersonalizedDashboardPayload | null;
  error?: string;
}

interface BucketStateResponse {
  success: boolean;
  bucket: EnergyBucket | null;
  reflection: string | null;
  commitment: boolean;
  requiresSelection: boolean;
  error?: string;
}

declare global {
  interface Window {
    __forceResetDashboardCache?: () => Promise<void>;
  }
}

const NEW_USER_FULL_PERSONALIZATION_MAX_ENTRIES = 12;
const PERSONALIZATION_FADE_MAX_ENTRIES = 30;
const SECTION_LABELS_MAX_ENTRIES = 24;
const SPOTLIGHT_PREFERENCE_MAX_ENTRIES = 24;
const WEEKLY_REMINDER_DAYS = 7;
const MONTHLY_REMINDER_DAYS = 30;
const DASHBOARD_INSIGHTS_VERSION = 3;
const NEW_USER_GUIDANCE_SEEN_KEY = 'force:dashboard:new-user-guidance-seen';
const SPOTLIGHT_GREETING_CACHE_KEY = 'spotlightGreeting';
const SPOTLIGHT_GREETING_CACHE_TTL_SECONDS = 2 * 60 * 60;

type CachedSpotlightGreetingEntry = {
  greeting: HeroGreeting;
  totalEntries: number;
  lastEntryDate: string | null;
};

type DashboardStorePersistApi = {
  hasHydrated?: () => boolean;
  rehydrate?: () => Promise<void> | void;
  onFinishHydration?: (callback: () => void) => () => void;
};

type DashboardStoreWithPersist = typeof useDashboardStore & {
  persist?: DashboardStorePersistApi;
};

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(138, 106, 88, ${alpha})`;

  const red = parseInt(clean.slice(0, 2), 16);
  const green = parseInt(clean.slice(2, 4), 16);
  const blue = parseInt(clean.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function isWithinEntryWindow(entryCount: number, maxEntries: number): boolean {
  return entryCount <= maxEntries;
}

const BUCKET_OPTIONS: Array<{ key: EnergyBucket; title: string; description: string }> = [
  {
    key: 'clarity',
    title: 'Seeking clarity',
    description: 'I want to understand my thoughts, patterns, and emotions better.',
  },
  {
    key: 'growth',
    title: 'Ready for growth',
    description: 'I am ready to become a better version of myself.',
  },
  {
    key: 'stability',
    title: 'Craving stability',
    description: 'I want more grounding and balance in my inner world.',
  },
];

/* ─────────────────────────────────────────
   VISUAL: THOUGHT THREADS
───────────────────────────────────────── */
const ThoughtThreadsVisual = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const words = [
    { text: 'tension', x: 22, y: 26 },
    { text: 'pattern', x: 70, y: 16 },
    { text: 'belief', x: 78, y: 60 },
    { text: 'clarity', x: 48, y: 80 },
    { text: 'truth', x: 14, y: 66 },
    { text: 'assumption', x: 34, y: 50 },
  ];
  const cx = 50;
  const cy = 44;

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: isDarkMode
            ? 'radial-gradient(ellipse at 50% 44%, rgba(251,146,60,0.12) 0%, transparent 68%)'
            : 'radial-gradient(ellipse at 50% 44%, rgba(232,93,93,0.12) 0%, transparent 68%)',
        }}
      />
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="softGlowT">
            <feGaussianBlur stdDeviation="0.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {words.map((w, i) => (
          <motion.line
            key={w.text}
            x1={w.x}
            y1={w.y}
            x2={cx}
            y2={cy}
            stroke={isDarkMode ? 'rgba(251,146,60,0.28)' : 'rgba(232,93,93,0.32)'}
            strokeWidth="0.18"
            filter="url(#softGlowT)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.45, 0.12, 0.45] }}
            transition={{
              duration: 6 + i * 0.7,
              delay: i * 0.9,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </svg>

      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.22, 0.42, 0.22] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute rounded-full"
          style={{
          left: `${cx}%`,
          top: `${cy}%`,
          transform: 'translate(-50%, -50%)',
          width: 50,
          height: 50,
          background: isDarkMode
            ? 'radial-gradient(circle, rgba(251,146,60,0.22) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(232,93,93,0.26) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          left: `${cx}%`,
          top: `${cy}%`,
          transform: 'translate(-50%, -50%)',
          width: 5,
          height: 5,
          background: 'rgba(232,93,93,0.42)',
        }}
      />

      {words.map((w, i) => (
        <motion.span
          key={`word-${w.text}`}
          animate={{
            x: [0, 4, -3, 0],
            y: [0, -5, 3, 0],
            opacity: [0.25, 0.45, 0.25],
          }}
          transition={{
            duration: 9 + i * 1.2,
            delay: i * 1.1,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute font-inter"
          style={{
            left: `${w.x}%`,
            top: `${w.y}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: 7,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: isDarkMode ? 'rgba(243,244,246,0.42)' : 'rgba(45,45,45,0.38)',
            whiteSpace: 'nowrap',
            fontWeight: 300,
          }}
        >
          {w.text}
        </motion.span>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────
   VISUAL: VOICE SIGNALS
───────────────────────────────────────── */
const VoiceSignalsVisual = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const barCount = 28;
  const bars = Array.from({ length: barCount }, (_, i) => ({
    baseH: 14 + Math.sin((i / barCount) * Math.PI) * 52 + Math.random() * 16,
    delay: i * 0.06,
    duration: 1.8 + Math.random() * 1.4,
  }));

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 55%, rgba(118,159,109,0.13) 0%, transparent 68%)',
        }}
      />
      {[0, 1, 2].map((i) => (
        <motion.div
          key={`ring-${i}`}
          className="absolute rounded-full pointer-events-none"
          style={{ border: isDarkMode ? '0.5px solid rgba(134,239,172,0.16)' : '0.5px solid rgba(118,159,109,0.2)' }}
          animate={{ width: [44, 170], height: [44, 170], opacity: [0.5, 0] }}
          transition={{
            duration: 4,
            delay: i * 1.33,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
      <div className="relative flex items-center gap-[2.5px]" style={{ height: 76 }}>
        {bars.map((bar, i) => (
          <motion.div
            key={`bar-${i}`}
            animate={{
              height: [bar.baseH * 0.32, bar.baseH, bar.baseH * 0.25],
            }}
            transition={{
              duration: bar.duration,
              delay: bar.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              width: 2.5,
              borderRadius: 3,
              background: isDarkMode
                ? 'linear-gradient(to top, rgba(134,239,172,0.66), rgba(134,239,172,0.08))'
                : 'linear-gradient(to top, rgba(118,159,109,0.62), rgba(118,159,109,0.1))',
            }}
          />
        ))}
      </div>
      <div
        className="absolute"
        style={{
          bottom: '27%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 110,
          height: 18,
          background: isDarkMode
            ? 'radial-gradient(ellipse, rgba(134,239,172,0.16) 0%, transparent 80%)'
            : 'radial-gradient(ellipse, rgba(118,159,109,0.16) 0%, transparent 80%)',
          filter: 'blur(6px)',
        }}
      />
    </div>
  );
};

/* ─────────────────────────────────────────
   VISUAL: PATTERN MAP
───────────────────────────────────────── */
const PatternMapVisual = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const nodes = [
    { label: 'self', cx: 100, cy: 76, r: 5.5, primary: true },
    { label: 'people', cx: 52, cy: 46, r: 4.2 },
    { label: 'place', cx: 38, cy: 108, r: 3.5 },
    { label: 'work', cx: 155, cy: 40, r: 4.0 },
    { label: 'health', cx: 162, cy: 106, r: 3.6 },
    { label: 'home', cx: 68, cy: 132, r: 3.2 },
    { label: 'rest', cx: 138, cy: 136, r: 3.0 },
    { label: 'creativity', cx: 20, cy: 73, r: 2.8 },
  ];
  const edges: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [0, 5],
    [0, 6],
    [0, 7],
    [1, 2],
    [1, 3],
    [3, 4],
    [5, 6],
  ];

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: isDarkMode
            ? 'radial-gradient(ellipse at 55% 50%, rgba(96,165,250,0.08) 0%, transparent 68%)'
            : 'radial-gradient(ellipse at 55% 50%, rgba(74,125,165,0.1) 0%, transparent 68%)',
        }}
      />
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 200 160"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="nodeGlowP">
            <feGaussianBlur stdDeviation="1.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {edges.map(([a, b], i) => {
          const start = nodes[a];
          const end = nodes[b];
          if (!start || !end) return null;
          return (
            <motion.line
              key={`edge-${a}-${b}`}
              x1={start.cx}
              y1={start.cy}
              x2={end.cx}
              y2={end.cy}
              stroke="rgba(74,125,165,0.28)"
              strokeWidth="0.35"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.07, 0.3, 0.07] }}
              transition={{
                duration: 6 + i * 0.4,
                delay: i * 0.25,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          );
        })}
        {nodes.map((n) =>
          n.primary ? (
            <motion.circle
              key={`aura-${n.label}`}
              cx={n.cx}
              cy={n.cy}
              r={n.r + 3}
              fill="none"
              stroke="rgba(74,125,165,0.14)"
              strokeWidth="0.5"
              animate={{ r: [n.r + 3, n.r + 8, n.r + 3] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : null,
        )}
        {nodes.map((n, i) => (
          <g key={`node-${n.label}`}>
            <motion.circle
              cx={n.cx}
              cy={n.cy}
              r={n.r}
              fill={
                n.primary ? 'rgba(74,125,165,0.40)' : 'rgba(74,125,165,0.20)'
              }
              filter="url(#nodeGlowP)"
              animate={{ opacity: [0.48, 0.88, 0.48] }}
              transition={{
                duration: 5 + i * 0.6,
                delay: i * 0.3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <circle
              cx={n.cx}
              cy={n.cy}
              r={n.primary ? 1.5 : 0.9}
              fill={
                n.primary ? 'rgba(74,125,165,0.72)' : 'rgba(74,125,165,0.52)'
              }
            />
            <text
              x={n.cx}
              y={n.cy + n.r + 7}
              textAnchor="middle"
              fontSize="5"
              fill="rgba(45,45,45,0.35)"
              fontFamily="'Inter', sans-serif"
              fontWeight="300"
              letterSpacing="0.8"
              style={{ textTransform: 'uppercase' }}
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

/* ─────────────────────────────────────────
   CARDS DATA
───────────────────────────────────────── */
const createDashboardCards = (isDarkMode: boolean) => [
  {
    tag: 'Thought Threads',
    heading: "Notice what's underneath.",
    copy:
      'Sometimes we stay inside our thoughts so long that they start feeling unquestionably true. Thought Threads reveals patterns and hidden assumptions inside a single entry. The Cognition Engine helps you rebalance and turn reflection into action.',
    accent: isDarkMode ? '#fb923c' : '#E85D5D',
    bgFrom: isDarkMode ? '#111827' : '#FDF5F1',
    bgTo: isDarkMode ? '#1f2937' : '#EDE4DF',
    text: isDarkMode ? '#F3F4F6' : '#1A1A1A',
    muted: isDarkMode ? '#CBD5E1' : '#686868',
    Visual: ThoughtThreadsVisual,
  },
  {
    tag: 'Voice Signals',
    heading: 'Speak freely.',
    copy:
      'Some feelings are easier to speak than write. Record naturally or upload voice notes, and Force reflects emotional tone, dominant feelings, and the underlying energy quietly back to you.',
    accent: isDarkMode ? '#86efac' : '#769F6D',
    bgFrom: isDarkMode ? '#0f172a' : '#F2F6F0',
    bgTo: isDarkMode ? '#172554' : '#E5EDE2',
    text: isDarkMode ? '#F3F4F6' : '#1A1A1A',
    muted: isDarkMode ? '#CBD5E1' : '#686868',
    Visual: VoiceSignalsVisual,
  },
  {
    tag: 'Pattern Map',
    heading: 'See the bigger picture.',
    copy:
      'Over time, Pattern Map reveals recurring emotional loops across people, places, relationships, and environments — quietly shaping your happiness and energy.',
    accent: isDarkMode ? '#93c5fd' : '#4A7DA5',
    bgFrom: isDarkMode ? '#0f172a' : '#F1F5FA',
    bgTo: isDarkMode ? '#111827' : '#E4ECF6',
    text: isDarkMode ? '#F3F4F6' : '#1A1A1A',
    muted: isDarkMode ? '#CBD5E1' : '#686868',
    Visual: PatternMapVisual,
  },
];

/* ─────────────────────────────────────────
   ATMOSPHERIC CTA
───────────────────────────────────────── */
const InsightsCTA = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const [isNavigating, setIsNavigating] = React.useState(false);

  const handleNavigateToAnalysis = () => {
    if (isNavigating) {
      return;
    }

    setIsNavigating(true);
    window.location.href = '/analysis';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 1.4, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center gap-4 pt-12 pb-2"
    >
    <div
      style={{
        width: 36,
        height: '0.5px',
          background: isDarkMode ? 'rgba(148,163,184,0.2)' : 'rgba(45,45,45,0.09)',
        marginBottom: 4,
      }}
    />

    <div className="relative">
      <motion.div
        animate={{ opacity: [0.28, 0.55, 0.28], scale: [1, 1.06, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-full -z-10"
        style={{
          background: isDarkMode
            ? 'radial-gradient(ellipse, rgba(96,165,250,0.12) 0%, rgba(134,239,172,0.08) 50%, transparent 80%)'
            : 'radial-gradient(ellipse, rgba(232,93,93,0.10) 0%, rgba(118,159,109,0.07) 50%, transparent 80%)',
          filter: 'blur(18px)',
          transform: 'scale(1.5)',
        }}
      />

      <motion.button
        whileTap={{ scale: 0.97 }}
        animate={{
          backgroundPosition: isNavigating ? '100% 50%' : ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{
          backgroundPosition: {
            duration: 5.5,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        }}
        onClick={handleNavigateToAnalysis}
        disabled={isNavigating}
        className="group relative flex items-center gap-4 transition-all duration-500 hover:scale-[1.02] hover:saturate-125 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-85 disabled:hover:scale-100 disabled:hover:saturate-100 disabled:hover:brightness-100"
        style={{
          padding: '13px 32px',
          borderRadius: 40,
          backgroundImage: isDarkMode
            ? 'linear-gradient(135deg, rgba(82,95,70,0.96) 0%, rgba(90,113,92,0.96) 46%, rgba(61,76,91,0.96) 100%)'
            : 'linear-gradient(135deg, #9f6958 0%, #8f7f62 48%, #7a8f66 100%)',
          backgroundSize: '200% 200%',
          border: isDarkMode ? '0.5px solid rgba(148,163,184,0.16)' : '0.5px solid rgba(0,0,0,0.035)',
          boxShadow: isDarkMode
            ? '0 8px 18px rgba(0,0,0,0.34), 0 1px 4px rgba(15,23,42,0.18)'
            : '0 8px 18px rgba(121,89,72,0.32)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          cursor: 'pointer',
        }}
      >
        <div
          className="absolute inset-0 rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-700"
          style={{
            background:
              'linear-gradient(135deg, rgba(232,93,93,0.04) 0%, rgba(74,125,165,0.04) 100%)',
          }}
        />

        <span
          className="font-inter font-medium relative z-10 inline-flex items-center gap-2"
          style={{
            fontSize: 10.5,
            letterSpacing: '0.42em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
            fontWeight: 300,
          }}
        >
          {isNavigating ? 'Opening' : 'See What emerges'}
          {isNavigating && (
            <motion.span
              className="inline-block h-2.5 w-2.5 rounded-full border border-white/70 border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </span>

        {!isNavigating && (
          <motion.div
            animate={{ x: [0, 2, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="relative z-10"
          >
            <ArrowRight size={11} strokeWidth={1.5} style={{ color: '#FFFFFF' }} />
          </motion.div>
        )}
      </motion.button>
    </div>

    <p
      className="font-terminal-grotesque"
      style={{
        fontSize: 10.5,
        color: isDarkMode ? 'rgba(226,232,240,0.45)' : 'rgba(45,45,45,0.32)',
        letterSpacing: '0.12em',
        fontWeight: 300,
        // fontStyle: 'italic',
        marginTop: 2,
      }}
    >
      Your patterns become clearer over time.
    </p>
    </motion.div>
  );
};

const DEFAULT_HERO_SUBTITLE = 'Move at the pace of your own mind. Capture what matters, understand your emotional rhythm, and return to a calmer, clearer inner state.';

function buildFallbackGreeting(firstName: string): HeroGreeting {
  return {
    badge: 'Daily Reflection Space',
    title: `Welcome back,\n${firstName}`,
    subtitle: DEFAULT_HERO_SUBTITLE,
    source: 'fallback',
  };
}

function pickGreetingInsight(insights: SpotlightInsight[], isNewUser: boolean): SpotlightInsight | null {
  if (!insights?.length) return null;

  const sortByPriority = (items: SpotlightInsight[]) => [...items].sort((a, b) => b.priority - a.priority);

  const waitlistInsights = sortByPriority(insights.filter(i => i.type === 'waitlist'));
  const journalInsights = sortByPriority(insights.filter(i => i.type === 'journal'));
  const reengagementInsights = sortByPriority(insights.filter(i => i.type === 'reengagement'));

  if (isNewUser) {
    return waitlistInsights[0] || journalInsights[0] || reengagementInsights[0] || insights[0] || null;
  }

  return journalInsights[0] || reengagementInsights[0] || waitlistInsights[0] || insights[0] || null;
}

function buildHeroGreetingFromInsight(insight: SpotlightInsight, firstName: string): HeroGreeting {
  const baseTitle = (insight.title || '').trim();
  const title = baseTitle || `Welcome back,\n${firstName}`;

  const badge = insight.type === 'waitlist'
    ? 'Your Force Intentions'
    : insight.type === 'journal'
    ? 'Your Journal Signal'
    : 'Your Momentum Signal';

  return {
    badge,
    title,
    subtitle: (insight.body || '').trim() || DEFAULT_HERO_SUBTITLE,
    source: insight.type,
  };
}

function getDaysSince(dateValue?: string | null): number | null {
  if (!dateValue) return null;
  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
}

function normalizeJournalSnippet(content: string): string {
  return content
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

async function fetchRecentJournalSnippets(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('journals')
    .select('content')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('display_date', { ascending: false })
    .limit(2);

  if (error || !data?.length) return [];

  return data
    .map((entry: { content?: string | null }) => normalizeJournalSnippet(entry.content || ''))
    .filter((text: string) => text.length > 20)
    .map((text: string) => text.slice(0, 120));
}

function buildActivityAwareGreeting(params: {
  firstName: string;
  stats?: JournalStats | null;
  selectedInsight?: SpotlightInsight | null;
  recentJournalSnippets?: string[];
  isNewUserContext?: boolean;
}): HeroGreeting {
  const {
    firstName,
    stats = null,
    selectedInsight = null,
    recentJournalSnippets = [],
    isNewUserContext = false,
  } = params;

  if (selectedInsight) {
    const base = buildHeroGreetingFromInsight(selectedInsight, firstName);
    const daysSinceLastEntry = getDaysSince(stats?.lastEntryDate);

    if (isNewUserContext) {
      return {
        ...base,
        source: 'waitlist',
        subtitle: base.subtitle.includes('?')
          ? base.subtitle
          : `${base.subtitle} What do you want your first honest entry to capture today?`,
      };
    }

    if (daysSinceLastEntry !== null && daysSinceLastEntry >= 2) {
      return {
        badge: 'Gentle Return Prompt',
        title: `It has been ${daysSinceLastEntry} days since your last entry.`,
        subtitle: 'Would you like to write one small check-in about what has shifted in your mind lately?',
        source: 'reengagement',
      };
    }

    if (daysSinceLastEntry === 1) {
      return {
        badge: 'Yesterday Was Quiet',
        title: `Ready to continue today, ${firstName}?`,
        subtitle: 'What is one thought you carried from yesterday that still wants your attention?',
        source: 'reengagement',
      };
    }

    if (recentJournalSnippets.length > 0) {
      return {
        ...base,
        subtitle: `You recently wrote: "${recentJournalSnippets[0]}...". What feels unfinished there today?`,
      };
    }

    if (!base.subtitle.includes('?')) {
      return {
        ...base,
        subtitle: `${base.subtitle} What feels most important to put into words right now?`,
      };
    }

    return base;
  }

  if (isNewUserContext) {
    return {
      badge: 'Daily Reflection Space',
      title: `Welcome back,\n${firstName}`,
      subtitle: 'What is one feeling or intention you want your first entry to hold today?',
      source: 'fallback',
    };
  }

  const fallbackDaysSinceLastEntry = getDaysSince(stats?.lastEntryDate);
  if (fallbackDaysSinceLastEntry !== null && fallbackDaysSinceLastEntry >= 2) {
    return {
      badge: 'Gentle Return Prompt',
      title: `You have been away for ${fallbackDaysSinceLastEntry} days.`,
      subtitle: 'Would you like to write a quick reset note about how these last days have felt?',
      source: 'fallback',
    };
  }

  if (recentJournalSnippets.length > 0) {
    return {
      badge: 'Your Journal Signal',
      title: `Welcome back,\n${firstName}`,
      subtitle: `You mentioned "${recentJournalSnippets[0]}..." recently. How does that feel today?`,
      source: 'journal',
    };
  }

  return buildFallbackGreeting(firstName);
}

async function polishGreetingWithLlm(params: {
  baseGreeting: HeroGreeting;
  recentJournalSnippets: string[];
  daysSinceLastEntry: number | null;
  isNewUserContext: boolean;
  decryptPromptCache?: <T = unknown>(row: Record<string, unknown>) => Promise<T | null>;
  friendlyContext?: {
    firstName?: string;
    toneMode?: 'gentle_friend' | 'coach_friend' | 'reflective_friend';
    totalEntries?: number;
    streakCount?: number;
    averageMood?: string;
    topTopics?: string[];
    localHour?: number;
  };
}): Promise<HeroGreeting> {
  const t0 = Date.now();
  console.log('[polishGreetingWithLlm] ▶ START — base:', JSON.stringify(params.baseGreeting).slice(0, 200));
  try {
    const response = await fetch('/api/spotlight/greeting', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        baseGreeting: params.baseGreeting,
        recentJournalSnippets: params.recentJournalSnippets,
        daysSinceLastEntry: params.daysSinceLastEntry,
        isNewUserContext: params.isNewUserContext,
        friendlyContext: params.friendlyContext,
      }),
    });

    console.log(`[polishGreetingWithLlm] HTTP ${response.status} in ${Date.now() - t0}ms`);
    if (!response.ok) {
      console.warn('[polishGreetingWithLlm] ✗ Non-OK response, returning base greeting');
      return params.baseGreeting;
    }

    const data = await response.json();
    console.log('[polishGreetingWithLlm] Response keys:', Object.keys(data || {}).join(', '));
    console.log('[polishGreetingWithLlm] data.greeting:', JSON.stringify(data?.greeting)?.slice(0, 300));
    console.log('[polishGreetingWithLlm] data._plaintext?.greeting:', JSON.stringify(data?._plaintext?.greeting)?.slice(0, 300));
    console.log('[polishGreetingWithLlm] data.response?.greeting:', JSON.stringify(data?.response?.greeting)?.slice(0, 300));

    let polished: any = data?.greeting || data?._plaintext?.greeting || data?.response?.greeting;

    if ((!polished || !polished.title) && params.decryptPromptCache) {
      console.log('[polishGreetingWithLlm] data.greeting is undefined — attempting client decryption of encrypted row...');
      try {
        const decrypted = await params.decryptPromptCache<{ greeting?: HeroGreeting }>(data);
        if (decrypted) {
          polished = decrypted.greeting || decrypted;
          console.log('[polishGreetingWithLlm] ✓ Successfully decrypted greeting:', JSON.stringify(polished)?.slice(0, 200));
        }
      } catch (decErr) {
        console.warn('[polishGreetingWithLlm] Decryption attempt failed:', decErr);
      }
    }

    if (!polished?.title || !polished?.subtitle || !polished?.badge) {
      console.warn('[polishGreetingWithLlm] ✗ Missing title/subtitle/badge in polished. Returning base.', polished);
      return params.baseGreeting;
    }

    const result: HeroGreeting = {
      badge: String(polished.badge),
      title: String(polished.title),
      subtitle: String(polished.subtitle),
      source: (polished.source as GreetingSource) || 'llm',
    };
    console.log(`[polishGreetingWithLlm] ✓ SUCCESS in ${Date.now() - t0}ms — source: ${result.source}, title: "${result.title.slice(0, 60)}"`);
    return result;
  } catch (err) {
    console.error(`[polishGreetingWithLlm] ✗ THREW after ${Date.now() - t0}ms:`, err);
    return params.baseGreeting;
  }
}

async function getCachedSpotlightGreeting(params: {
  totalEntries: number;
  lastEntryDate: string | null;
}): Promise<HeroGreeting | null> {
  const cached = await dashboardCache.get<CachedSpotlightGreetingEntry>(SPOTLIGHT_GREETING_CACHE_KEY).catch(() => null);
  if (!cached) {
    return null;
  }

  const hasChanged = cached.totalEntries !== params.totalEntries || cached.lastEntryDate !== params.lastEntryDate;
  if (hasChanged || cached.greeting?.source === 'fallback') {
    await dashboardCache.delete(SPOTLIGHT_GREETING_CACHE_KEY).catch(() => {});
    return null;
  }

  return cached.greeting;
}

async function saveCachedSpotlightGreeting(params: {
  greeting: HeroGreeting;
  totalEntries: number;
  lastEntryDate: string | null;
}): Promise<void> {
  const payload: CachedSpotlightGreetingEntry = {
    greeting: params.greeting,
    totalEntries: params.totalEntries,
    lastEntryDate: params.lastEntryDate,
  };

  await dashboardCache.set(SPOTLIGHT_GREETING_CACHE_KEY, payload, SPOTLIGHT_GREETING_CACHE_TTL_SECONDS).catch(() => {});
}

export default function Dashboard() {
  const router = useRouter();
  const { decryptPromptCache } = useAiDecryption();
  const [user, setUser] = useState<User | null>(null);
  // Always start as true so SSR and CSR produce identical HTML (avoids hydration mismatch).
  // The warm-cache check below runs in useEffect and calls setLoading(false) immediately
  // after hydration if cached data is already present.
  const [loading, setLoading] = useState(true);
  const { 
    isDarkMode, 
    elementColors,
    currentFont,
    currentTheme,
    pageBackground
  } = useTheme();
  const dashboardCards = createDashboardCards(isDarkMode);
  const pageBackgroundIsImage = pageBackground?.includes('gradient') || pageBackground?.includes('url(');
  const dashboardBackgroundStyle: React.CSSProperties = {
    backgroundColor: pageBackgroundIsImage ? undefined : pageBackground,
    backgroundImage: pageBackgroundIsImage ? pageBackground : undefined,
    backgroundRepeat: pageBackgroundIsImage ? 'no-repeat' : undefined,
    backgroundPosition: pageBackgroundIsImage ? 'center' : undefined,
    backgroundSize: pageBackgroundIsImage ? 'cover' : undefined,
  };
  
  const [successMessage, setSuccessMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const cachedStats = useDashboardStore((state) => state.stats);
  const cachedPrompt = useDashboardStore((state) => state.promptData);
  const cachedPersonalization = useDashboardStore((state) => state.personalization);
  const setCachedStats = useDashboardStore((state) => state.setStats);
  const setCachedPrompt = useDashboardStore((state) => state.setPromptData);
  const setCachedPersonalization = useDashboardStore((state) => state.setPersonalization);
  const setCachedInsights = useDashboardStore((state) => state.setInsights);
  const shouldRefreshSection = useDashboardStore((state) => state.shouldRefresh);
  const hydratePersistentCache = useDashboardStore((state) => state.hydrateFromPersistentCache);
  // Safe default for SSR — the effect below syncs to the real value after hydration.
  const [isDashboardCacheHydrated, setIsDashboardCacheHydrated] = useState(false);
  const [newUser, setNewUser] = useState(false);
  const [showNewUserGuidance, setShowNewUserGuidance] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  // SSR-safe initial value — the hero component shows its own skeleton while loading=true.
  const [heroGreeting, setHeroGreeting] = useState<HeroGreeting>({ badge: '', title: '', subtitle: '', source: 'fallback' as const });
  const [heroGreetingLoading, setHeroGreetingLoading] = useState(true);
  const [personalizationBucket, setPersonalizationBucket] = useState<EnergyBucket | null>(null);
  const [personalizationPayload, setPersonalizationPayload] = useState<PersonalizedDashboardPayload | null>(null);
  const [dashboardInsights, setDashboardInsights] = useState<DashboardInsights | null>(null);
  const [requiresBucketSelection, setRequiresBucketSelection] = useState(false);
  const [personalizationSaving, setPersonalizationSaving] = useState(false);
  const [personalizationError, setPersonalizationError] = useState<string | null>(null);
  const [personalizationLoadError, setPersonalizationLoadError] = useState<string | null>(null);
  const [personalizationRefreshing, setPersonalizationRefreshing] = useState(false);
  const [entryCountForPersonalization, setEntryCountForPersonalization] = useState(0);
  const [, setShowBucketProgressReminder] = useState(false);
  const hasEntries = (stats?.totalEntries ?? 0) > 0;
  const hasMeaningfulInsights = (stats?.totalEntries ?? 0) >= 5;
  // Toggle between old (stable) and new (beta) AI Spotlight
  // Default to true (V2). A useEffect below reads localStorage after hydration.
  const [, setUseSpotlightV2] = useState(true);
  const [promptData, setPromptData] = useState<PromptData | null>(null);
  const [isPromptRefreshing, setIsPromptRefreshing] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const resolvedPromptData = promptData || cachedPrompt || null;

  // Track font loading — hard 400ms timeout ensures a slow CDN never blocks render
  useEffect(() => {
    if (typeof document !== 'undefined' && document.fonts) {
      const timeout = setTimeout(() => setFontsLoaded(true), 400);
      document.fonts.ready
        .then(() => { clearTimeout(timeout); setFontsLoaded(true); })
        .catch(() => { clearTimeout(timeout); setFontsLoaded(true); });
      return () => clearTimeout(timeout);
    } else {
      setFontsLoaded(true);
    }
  }, []);

  useEffect(() => {
    // ── Spotlight V2 preference (localStorage, client-only) ───────────────────
    const saved = localStorage.getItem('force:spotlight:v2');
    if (saved !== null) {
      setUseSpotlightV2(saved !== 'false');
    }

    // ── Zustand persist hydration ─────────────────────────────────────────────
    const persist = (useDashboardStore as DashboardStoreWithPersist).persist;
    if (!persist) {
      setIsDashboardCacheHydrated(true);
      return;
    }

    if (persist.hasHydrated?.()) {
      setIsDashboardCacheHydrated(true);
      return;
    }

    const unsubscribe = persist.onFinishHydration?.(() => {
      setIsDashboardCacheHydrated(true);
    });

    void persist.rehydrate?.();

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const fetchDashboardPersonalization = async (): Promise<DashboardPersonalizationResponse | null> => {
    const retryDelaysMs = [400, 1200];
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      try {
        const response = await fetch('/api/personalization/dashboard', {
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        const json = (await response.json()) as DashboardPersonalizationResponse;
        if (!response.ok || json.error) {
          throw new Error(json.error || 'Personalization request failed');
        }

        return json;
      } catch (error) {
        if (attempt < retryDelaysMs.length) {
          const retryDelayMs = retryDelaysMs[attempt];
          if (retryDelayMs === undefined) {
            continue;
          }

          await wait(retryDelayMs);
          continue;
        }

        return {
          success: false,
          requiresSelection: false,
          bucket: null,
          error: error instanceof Error ? error.message : 'Personalization failed. Please retry.',
        };
      }
    }

    return null;
  };

  const fetchDashboardPersonalizationCached = async (): Promise<DashboardPersonalizationResponse | null> => {
    if (cachedPersonalization && !shouldRefreshSection('personalization')) {
      return {
        success: true,
        requiresSelection: false,
        bucket: personalizationBucket,
        personalization: cachedPersonalization,
      };
    }

    const response = await fetchDashboardPersonalization();
    if (response?.success && response.personalization) {
      setCachedPersonalization(response.personalization);
    }
    return response;
  };

  const fetchBucketState = async (): Promise<BucketStateResponse | null> => {
    try {
      const response = await fetch('/api/personalization/bucket', {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        return null;
      }

      const json = (await response.json()) as BucketStateResponse;
      return json;
    } catch {
      return null;
    }
  };

  const refreshPersonalization = async () => {
    if (personalizationRefreshing) return;
    if (!isWithinEntryWindow(entryCountForPersonalization, PERSONALIZATION_FADE_MAX_ENTRIES)) return;
    setPersonalizationRefreshing(true);
    setPersonalizationLoadError(null);

    const response = await fetchDashboardPersonalization();
    if (response?.success) {
      setPersonalizationBucket(response.bucket || personalizationBucket);
      setRequiresBucketSelection(Boolean(response.requiresSelection && isWithinEntryWindow(entryCountForPersonalization, NEW_USER_FULL_PERSONALIZATION_MAX_ENTRIES)));
      setPersonalizationPayload(response.personalization || null);
      if (response.personalization) {
        setCachedPersonalization(response.personalization);
      }
    } else {
      setPersonalizationPayload(null);
      setCachedPersonalization(null);
      setPersonalizationLoadError(response?.error || 'Personalization failed. Please retry.');
    }

    setPersonalizationRefreshing(false);
  };

  const getReminderStorageKey = () => (user?.id ? `force:bucket:reminder:lastPromptAt:${user.id}` : null);

  const markReminderTouched = () => {
    if (typeof window === 'undefined') return;
    const key = getReminderStorageKey();
    if (!key) return;
    localStorage.setItem(key, String(Date.now()));
  };

  const getReminderIntervalDays = (entryCount: number) => {
    return entryCount <= PERSONALIZATION_FADE_MAX_ENTRIES ? WEEKLY_REMINDER_DAYS : MONTHLY_REMINDER_DAYS;
  };

  const saveDashboardBucket = async (bucket: EnergyBucket) => {
    setPersonalizationSaving(true);
    setPersonalizationError(null);
    setPersonalizationLoadError(null);
    try {
      const response = await fetch('/api/personalization/bucket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bucket }),
      });

      const json = await response.json();
      if (!response.ok || json?.error) {
        throw new Error(json?.error || 'Could not save your personalization mode.');
      }

      const updated = await fetchDashboardPersonalization();

      if (isWithinEntryWindow(entryCountForPersonalization, PERSONALIZATION_FADE_MAX_ENTRIES)) {
        if (!updated || updated.requiresSelection || !updated.bucket || !updated.personalization) {
          throw new Error('Could not refresh personalization after saving.');
        }

        setPersonalizationBucket(updated.bucket);
        setPersonalizationPayload(updated.personalization);
        setCachedPersonalization(updated.personalization);
      } else {
        const stateOnly = await fetchBucketState();
        if (!stateOnly || !stateOnly.success || !stateOnly.bucket) {
          throw new Error('Could not refresh bucket after saving.');
        }
        setPersonalizationBucket(stateOnly.bucket);
        setPersonalizationPayload(null);
        setCachedPersonalization(null);
      }
      setRequiresBucketSelection(false);
      setShowBucketProgressReminder(false);
      markReminderTouched();

      if (typeof window !== 'undefined') {
        const shouldApplyPersonalization = isWithinEntryWindow(entryCountForPersonalization, SPOTLIGHT_PREFERENCE_MAX_ENTRIES);
        const hasManualPreference = localStorage.getItem('force:spotlight:v2') !== null;
        if (!hasManualPreference && shouldApplyPersonalization && updated?.personalization) {
          const preferred = updated.personalization.variants.behavior.preferSpotlightV2;
          setUseSpotlightV2(preferred);
          localStorage.setItem('force:spotlight:v2', String(preferred));
        }
      }
    } catch (error) {
      setPersonalizationError(error instanceof Error ? error.message : 'Could not save your personalization mode.');
    } finally {
      setPersonalizationSaving(false);
    }
  };

  // Fetch journal stats with better error handling and retries
  const fetchJournalStats = async (retryCount = 0) => {
    const maxRetries = 3;
    try {
      console.log('Fetching journal stats...');
      const response = await fetch('/api/fetch-journals/journal-stats', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Journal stats received:', data);
      setStats(data);
      
      // Update user properties with journal stats
      if (data.totalEntries > 0) {
        updateUserProperties({
          journal_count: data.totalEntries,
          last_journal_date: data.lastEntryDate || undefined,
        });
      }
      
      return data;
    } catch (error) {
      console.error(`Failed to fetch journal stats (attempt ${retryCount + 1}):`, error);
      
      if (retryCount < maxRetries) {
        console.log(`Retrying in ${(retryCount + 1) * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
        return fetchJournalStats(retryCount + 1);
      } else {
        // Set default stats on final failure
        setStats({
          totalEntries: 0,
          streakCount: 0,
          lastEntryDate: null,
          weeklyEntries: 0,
          averageMood: 'neutral',
          mostProductiveDay: 'Monday',
          topTopics: []
        });
        throw error;
      }
    }
  };

  const primeDashboardCache = () => {
    if (typeof window === 'undefined') return false;

    const store = useDashboardStore.getState();

    let usedWarmCache = false;

    if (store.stats) {
      setStats(store.stats);
      usedWarmCache = true;
    }

    if (store.promptData) {
      setPromptData(store.promptData);
      usedWarmCache = true;
    }

    if (store.personalization) {
      setPersonalizationPayload(store.personalization);
      usedWarmCache = true;
    }

    const storeInsights = store.insights as DashboardInsights | null;
    if (storeInsights && Number(storeInsights.version ?? 0) === DASHBOARD_INSIGHTS_VERSION) {
      setDashboardInsights(storeInsights);
      usedWarmCache = true;
    }

    return usedWarmCache;
  };

  // Re-implement fetchJournalStats to use cache first
  const fetchJournalStatsCached = async (retryCount = 0, force = false) => {
    if (!force && cachedStats && !shouldRefreshSection('stats')) {
      console.log('[Dashboard] Using cached journal stats');
      setStats(cachedStats);
      return cachedStats;
    }

    const data = await fetchJournalStats(retryCount);
    if (data) setCachedStats(data);
    return data;
  };

  const fetchRandomPrompt = async (retryCount = 0, force = false) => {
    const maxRetries = 2;
    const tag = `[Prompt:${force ? 'FORCE' : 'normal'}:attempt${retryCount + 1}]`;
    try {
      console.log(`${tag} ── START fetchRandomPrompt ──────────────────────────────`);
      console.log(`${tag} force=${force}, retryCount=${retryCount}`);

      let response: Response;
      const currentPromptText = (
        promptData?.prompt?.text ||
        writingPromptVariant?.text ||
        resolvedPromptData?.prompt?.text ||
        ''
      ).trim();
      const url = `/api/prompts/personalized${force ? `?force=true&t=${Date.now()}&current=${encodeURIComponent(currentPromptText)}` : ''}`;
      console.log(`${tag} Target URL: ${url}`);

      const encryptionReady = isEncryptionInitialized();
      console.log(`${tag} Encryption initialized: ${encryptionReady}`);

      if (encryptionReady) {
        try {
          console.log(`${tag} [1/5] Getting Supabase user...`);
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          console.log(`${tag} [1/5] User found: ${!!user}, uid: ${user?.id ?? 'none'}`);

          if (user) {
            console.log(`${tag} [2/5] Decrypting journal entries for AI...`);
            const entries = await decryptEntriesForAI(user.id, 3);
            console.log(`${tag} [2/5] Decrypted ${entries.length} entries. Content lengths: [${entries.map(e => e.content?.length ?? 0).join(', ')}]`);

            console.log(`${tag} [3/5] POSTing entries to /api/prompts/personalized...`);
            const fetchStart = Date.now();
            response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ entries, force, currentPrompt: currentPromptText }),
            });
            console.log(`${tag} [3/5] POST completed in ${Date.now() - fetchStart}ms — HTTP ${response.status}`);
          } else {
            console.warn(`${tag} [2/5] No authenticated user found — falling back to GET`);
            const fetchStart = Date.now();
            response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
            console.log(`${tag} [2/5] GET completed in ${Date.now() - fetchStart}ms — HTTP ${response.status}`);
          }
        } catch (clientDecryptErr) {
          console.error(`${tag} Client-side decrypt or supabase call THREW:`, clientDecryptErr);
          console.warn(`${tag} Falling back to GET after decrypt error`);
          const fetchStart = Date.now();
          response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
          console.log(`${tag} GET (decrypt-error fallback) completed in ${Date.now() - fetchStart}ms — HTTP ${response.status}`);
        }
      } else {
        console.log(`${tag} [2/5] Encryption not initialized → using legacy GET (key_version=1 server-decrypt)`);
        const fetchStart = Date.now();
        response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
        console.log(`${tag} [2/5] GET completed in ${Date.now() - fetchStart}ms — HTTP ${response.status}`);
      }

      if (!response.ok) {
        let errorBody = '(could not parse body)';
        try { errorBody = JSON.stringify(await response.json()); } catch { /* ignore */ }
        console.error(`${tag} [4/5] API returned non-OK status ${response.status}. Body: ${errorBody}`);
        const isServerError = response.status >= 500;
        if (isServerError && retryCount < maxRetries) {
          console.log(`${tag} Server error — retrying in ${retryCount + 1}s...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return fetchRandomPrompt(retryCount + 1, force);
        }
        console.warn(`${tag} Non-retryable failure (status ${response.status}). Returning null.`);
        return null;
      }

      console.log(`${tag} [4/5] Response OK. Parsing JSON body...`);
      const rawRow = await response.json();
      console.log(`${tag} [4/5] Raw response keys: [${Object.keys(rawRow ?? {}).join(', ')}]`);
      console.log(`${tag} [4/5] Has '_plaintext': ${!!rawRow?._plaintext}, Has 'prompt': ${!!rawRow?.prompt}, Has 'response': ${!!rawRow?.response}, Has 'response_encrypted': ${!!rawRow?.response_encrypted}`);

      // ── Tier 1: server-attached verified plaintext (no key needed) ──────────
      let data: PromptData | null = null;
      if (rawRow?._plaintext && typeof rawRow._plaintext === 'object') {
        console.log(`${tag} [5/5] Using server _plaintext (no decrypt needed).`);
        data = rawRow._plaintext as PromptData;
      } else {
        // ── Tier 2: ECIES decrypt (private key in memory) ────────────────────
        console.log(`${tag} [5/5] No _plaintext — running decryptPromptCache...`);
        data = await decryptPromptCache<PromptData>(rawRow);
        console.log(`${tag} [5/5] decryptPromptCache result: ${data === null ? 'null' : 'non-null'}`);
      }

      if (data) {
        console.log(`${tag} [5/5] data.prompt preview: ${JSON.stringify((data as any)?.prompt)?.slice(0, 120)}`);
      }

      if (data && (data.prompt?.text || (data as any).text)) {
        const normalizedData: PromptData = data.prompt ? data : {
          prompt: {
            text: (data as any).text || '',
            explanation: (data as any).explanation || '',
          },
          suggestions: (data as any).suggestions || {
            moodTrends: { primaryMood: 'reflective', trend: 'steady', intensity: 0.5 },
            aiNudge: { theme: 'Reflection', suggestion: (data as any).explanation || '', action: 'Write freely' },
            patternInsight: { pattern: 'Exploration', exploration: 'Explore what comes to mind' }
          },
          requiresSelection: false,
        };
        console.log(`${tag} ✅ Prompt resolved successfully: "${normalizedData.prompt.text.slice(0, 80)}..."`);
        setPromptData(normalizedData);
        setCachedPrompt(normalizedData);
        return normalizedData;
      }

      console.warn(`${tag} ⚠️ Data received but no prompt.text found. Returning raw data.`);
      return data;
    } catch (error) {
      console.error(`${tag} ❌ THREW at attempt ${retryCount + 1}:`, error);
      if (retryCount < maxRetries) {
        console.log(`${tag} Retrying in 1s...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchRandomPrompt(retryCount + 1, force);
      }
      console.error(`${tag} All ${maxRetries + 1} attempts exhausted. Returning null.`);
      return null;
    }
  };



  const handleRefreshPrompt = async () => {
    if (isPromptRefreshing) {
      console.log('[Refresh] Already refreshing — ignoring click');
      return;
    }
    console.log('[Refresh] ════ handleRefreshPrompt TRIGGERED ════════════════');
    setIsPromptRefreshing(true);
    const refreshStart = Date.now();
    const MIN_REFRESH_DURATION = 1200;

    try {
      console.log('[Refresh] Calling fetchRandomPrompt(0, force=true)...');
      const refreshed = await fetchRandomPrompt(0, true);
      const elapsed = Date.now() - refreshStart;

      if (elapsed < MIN_REFRESH_DURATION) {
        await new Promise((resolve) => setTimeout(resolve, MIN_REFRESH_DURATION - elapsed));
      }

      if (refreshed && (refreshed.prompt?.text || (refreshed as any).text)) {
        const incomingText = (refreshed.prompt?.text || (refreshed as any).text || '').trim();
        const incomingExplanation = (refreshed.prompt?.explanation || (refreshed as any).explanation || '').trim();
        const promptSuggestions = (refreshed as any).suggestions;

        console.log('[Refresh] ✅ Applying fresh prompt:', incomingText.slice(0, 80));
        const normalizedPrompt: PromptData = {
          prompt: {
            text: incomingText,
            explanation: incomingExplanation,
          },
          suggestions: promptSuggestions || {
            moodTrends: { primaryMood: 'reflective', trend: 'steady', intensity: 0.5 },
            aiNudge: { theme: 'Reflection', suggestion: incomingExplanation, action: 'Write freely' },
            patternInsight: { pattern: 'Exploration', exploration: 'Explore what comes to mind' }
          },
          requiresSelection: false,
        };

        setPromptData(normalizedPrompt);
        setCachedPrompt(normalizedPrompt, stats?.totalEntries);
        setJournalPromptPrefill(normalizedPrompt.prompt.text);
        setJournalPromptContext({ text: normalizedPrompt.prompt.text, explanation: normalizedPrompt.prompt.explanation });
        setSuccessMessage("Refreshed with a new prompt for you!");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        // Dynamic prompt generation failed — show error, keep current prompt
        console.warn('[Refresh] ⚠️ No dynamic prompt returned from API — keeping current prompt.');
        setSuccessMessage("Couldn't generate a new prompt right now. Please try again.");
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (error) {
      console.error('[Refresh] ❌ THREW unexpectedly:', error);
      setSuccessMessage("Couldn't refresh prompt. Please try again.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsPromptRefreshing(false);
    }
  };

  // Cached prompt loader
  const fetchRandomPromptCached = async (statsResult: JournalStats | null, retryCount = 0) => {
    const cachedEntryCount = useDashboardStore.getState().promptSourceEntryCount;
    const needsRefresh = shouldRefreshSection('prompts') || 
      (statsResult && cachedEntryCount !== undefined && cachedEntryCount !== statsResult.totalEntries);

    if (cachedPrompt && !needsRefresh) {
      console.log('[Dashboard] Using cached prompt data');
      setPromptData(cachedPrompt);
      return cachedPrompt;
    }

    const data = await fetchRandomPrompt(retryCount);
    if (data) setCachedPrompt(data, statsResult?.totalEntries);
    return data;
  };

  const fetchDashboardInsights = async (retryCount = 0) => {
    const maxRetries = 2;
    try {
      const response = await fetch('/api/dashboard/insights', {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: DashboardInsights = await response.json();
      setDashboardInsights(data);
      setCachedInsights(data);
      return data;
    } catch (error) {
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return fetchDashboardInsights(retryCount + 1);
      }
      console.warn('[Dashboard] Failed to fetch LLM insights.', error);
      const fallbackInsights: DashboardInsights = {
        version: DASHBOARD_INSIGHTS_VERSION,
        generatedAt: new Date().toISOString(),
        source: 'fallback',
        sourceEntryId: null,
        sourceEntryCount: 0,
        sourceEntryDate: null,
        sourceContext: 'fallback',
        mentalWeather: {
          pattern: 'calm',
          intensity: 58,
          forecast: 'A steadier day. Use this moment to name what matters most.',
        },
        mindEnergy: {
          level: 58,
          state: 'steady',
          message: "You're grounded. This is a good moment to do something meaningful.",
          hint: 'Set intention, write clearly, move slowly.',
        },
        wellnessBalance: {
          emotional: 62,
          mental: 58,
          physical: 60,
          priority: 'emotional',
          message: 'We will learn your rhythm as you write. Start with one small check-in.',
        },
        rhythm: {
          energyPattern: 'midday',
          label: 'Peak at midday',
          insight: 'Your energy rises through the morning. Use lunch time to shift gears.',
          times: ['11am-1pm: Decision time', 'Social moment available', 'Movement helps'],
        },
      };
      setDashboardInsights(fallbackInsights);
      setCachedInsights(fallbackInsights);
      return fallbackInsights;
    }
  };

  const fetchDashboardInsightsCached = async (retryCount = 0) => {
    const currentInsights = useDashboardStore.getState().insights as DashboardInsights | null;
    const hasCurrentVersion = currentInsights && Number(currentInsights.version ?? 0) === DASHBOARD_INSIGHTS_VERSION;
    // If cached insights are present but were generated as a fallback and
    // the user has many entries, prefer regenerating from server to get LLM-backed analysis.
    const cachedIsFallback = currentInsights?.source === 'fallback';
    const userEntryCount = stats?.totalEntries ?? null;
    if (cachedIsFallback && userEntryCount !== null && userEntryCount >= 10) {
      console.log('[Dashboard] Cached insights are fallback and user has many entries — bypassing client cache and fetching fresh insights');
      return fetchDashboardInsights(retryCount);
    }

    if (hasCurrentVersion && !shouldRefreshSection('insights')) {
      console.log('[Dashboard] Using cached insights');
      setDashboardInsights(currentInsights);
      return currentInsights;
    }

    return fetchDashboardInsights(retryCount);
  };

  const shouldRefreshInsights = (statsResult: JournalStats | null, currentInsights: DashboardInsights | null) => {
    if (!statsResult) return false;
    if (!currentInsights) return true;
    const entryCount = Number(statsResult.totalEntries ?? 0);
    const lastEntryDate = statsResult.lastEntryDate ?? null;
    return shouldRefreshSection('insights')
      || Number(currentInsights.version ?? 0) !== DASHBOARD_INSIGHTS_VERSION
      || currentInsights.sourceEntryCount !== entryCount
      || (currentInsights.sourceEntryDate || null) !== lastEntryDate;
  };

  const resolveInsightsForStats = async (statsResult: JournalStats | null) => {
    if (!statsResult) return null;
    const currentInsights = useDashboardStore.getState().insights;
    if (shouldRefreshInsights(statsResult, currentInsights)) {
      return fetchDashboardInsightsCached();
    }
    if (currentInsights) {
      setDashboardInsights(currentInsights);
      return currentInsights;
    }
    return fetchDashboardInsightsCached();
  };

  // Initialize encryption on mount
  useEffect(() => {
    async function initEncryption() {
      try {
        const supabase = createClient();
        
        // Use getSession instead of getUser to avoid auth API calls that might fail
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user && !isEncryptionInitialized()) {
          const isOAuthUser = session.user.app_metadata?.provider !== 'email';
          
          if (isOAuthUser) {
            // Use helper function to auto-initialize for OAuth users
            const { autoInitializeEncryptionForOAuthUser } = await import('@/utils/encryption');
            await autoInitializeEncryptionForOAuthUser(session.user.id);
            console.log('[Dashboard] Encryption initialized');
          }
        }
      } catch (err) {
        console.error('[Dashboard] Failed to initialize encryption:', err);
        // Don't throw - allow dashboard to continue loading
      }
    }

    initEncryption();
  }, []);

  // Dev-only helper to clear dashboard caches and force insight regeneration from the console.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    window.__forceResetDashboardCache = async () => {
      try {
        localStorage.removeItem('force:dashboard-cache');
        useDashboardStore.getState().clear();
        await dashboardCache.clear().catch(() => {});
        const res = await fetch('/api/dashboard/insights?force=1&expand=mentalWeather', { credentials: 'same-origin' });
        const json = await res.json().catch(() => null);
        console.log('[Dashboard] Forced refresh result:', json);
        location.reload();
      } catch (error) {
        console.error('[Dashboard] Failed to force reset dashboard cache:', error);
      }
    };

    return () => {
      try {
        delete window.__forceResetDashboardCache;
      } catch (error) {
        console.warn('[Dashboard] Failed to clear dev cache helper.', error);
      }
    };
  }, []);

  // Main data loading effect - only runs when user is authenticated
  useEffect(() => {
    const supabase = createClient();
    
    const loadDashboardData = async () => {
      try {
        if (!isDashboardCacheHydrated) {
          return;
        }

        // Check authentication FIRST before setting any state
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          // Redirect immediately without showing UI
          setLoading(true); // Keep loading state to prevent UI flash
          router.push('/login');
          return;
        }

        setUser(session.user);

        // Prime warm cache into memory
        primeDashboardCache();
        void hydratePersistentCache();
        
        // Identify user in PostHog
        identifyUser(session.user.id, {
          email: session.user.email,
          name: session.user.user_metadata?.name,
          created_at: session.user.created_at,
        });

        if (!dataLoaded) {
          const loadT0 = Date.now();
          console.log('[Dashboard] ════════════════════════════════════════════════');
          console.log('[Dashboard] ▶ loadDashboardData START');
          
          // Track dashboard view
          trackEvent.searchPerformed({
            results_count: 0,
            context: 'global',
            query_length: 0,
          });
          
          const userFirstName = session.user.user_metadata?.name?.split(' ')[0] || session.user.email?.split('@')[0] || 'User';
          console.log(`[Dashboard] User: ${userFirstName}`);

          // ── Fast Greeting Resolution (Instant 0ms or Cached) ───────────────
          const storeState = useDashboardStore.getState();
          console.log('[Dashboard] Store state — stats:', !!storeState.stats, '| promptData:', !!storeState.promptData, '| insights:', !!storeState.insights, '| personalization:', !!storeState.personalization);

          const cachedGreeting = await getCachedSpotlightGreeting({
            totalEntries: storeState.stats?.totalEntries ?? 0,
            lastEntryDate: storeState.stats?.lastEntryDate ?? null,
          });
          console.log('[Dashboard] Cached greeting:', cachedGreeting ? `source=${cachedGreeting.source}, title="${cachedGreeting.title?.slice(0, 50)}"` : 'null (no cache)');

          if (cachedGreeting) {
            setHeroGreeting(cachedGreeting);
          } else {
            const immediateGreeting = buildActivityAwareGreeting({
              firstName: userFirstName,
              stats: storeState.stats,
              isNewUserContext: (storeState.stats?.totalEntries ?? 0) === 0,
            });
            console.log('[Dashboard] Activity-aware greeting:', `source=${immediateGreeting.source}, title="${immediateGreeting.title?.slice(0, 50)}"`);
            setHeroGreeting(immediateGreeting);
          }

          // ── Full Parallel Fetching ─────────────────────────────────────────
          console.log(`[Dashboard] ▶ Firing 6 parallel fetches at T+${Date.now() - loadT0}ms`);
          const [
            statsResult,
            personalizationResult,
            promptResult,
            insightsResult,
            spotlightData,
            recentSnippets
          ] = await Promise.all([
            fetchJournalStatsCached().catch(error => {
              console.error('[Dashboard] ✗ Stats FAILED:', error);
              return null;
            }),
            fetchDashboardPersonalizationCached().catch(error => {
              console.error('[Dashboard] ✗ Personalization FAILED:', error);
              return null;
            }),
            fetchRandomPromptCached(storeState.stats).catch(error => {
              console.error('[Dashboard] ✗ Prompt FAILED:', error);
              return null;
            }),
            fetchDashboardInsightsCached().catch(error => {
              console.error('[Dashboard] ✗ Insights FAILED:', error);
              return null;
            }),
            fetch('/api/spotlight').then(r => r.ok ? r.json() : null).catch(() => null),
            fetchRecentJournalSnippets(supabase, session.user.id).catch(() => []),
          ]);

          console.log(`[Dashboard] ✓ All 6 parallel fetches settled at T+${Date.now() - loadT0}ms`);
          console.log('[Dashboard]   stats:', statsResult ? `totalEntries=${statsResult.totalEntries}` : 'null');
          console.log('[Dashboard]   personalization:', personalizationResult ? `success=${personalizationResult.success}` : 'null');
          console.log('[Dashboard]   prompt:', promptResult ? 'received' : 'null');
          console.log('[Dashboard]   insights:', insightsResult ? 'received' : 'null');
          console.log('[Dashboard]   spotlight:', spotlightData ? `${(spotlightData.insights || []).length} insights` : 'null');
          console.log('[Dashboard]   snippets:', Array.isArray(recentSnippets) ? `${recentSnippets.length} snippets` : 'null');

          if (statsResult) setCachedStats(statsResult);

          const resolvedEntryCount = Number(statsResult?.totalEntries ?? storeState.stats?.totalEntries ?? 0);
          const isWithinPersonalizationWindow = isWithinEntryWindow(resolvedEntryCount, PERSONALIZATION_FADE_MAX_ENTRIES);
          const isNewUserBucketFlow = isWithinEntryWindow(resolvedEntryCount, NEW_USER_FULL_PERSONALIZATION_MAX_ENTRIES);

          setEntryCountForPersonalization(resolvedEntryCount);

          if (isWithinPersonalizationWindow && personalizationResult) {
            if (personalizationResult.success) {
              setPersonalizationBucket(personalizationResult.bucket || null);
              setRequiresBucketSelection(Boolean(personalizationResult.requiresSelection && isNewUserBucketFlow));
              setPersonalizationPayload(personalizationResult.personalization || null);
              setPersonalizationLoadError(null);
              if (personalizationResult.personalization) {
                setCachedPersonalization(personalizationResult.personalization);
              }

              if (personalizationResult.personalization && typeof window !== 'undefined') {
                const hasManualPreference = localStorage.getItem('force:spotlight:v2') !== null;
                if (!hasManualPreference && isWithinEntryWindow(resolvedEntryCount, SPOTLIGHT_PREFERENCE_MAX_ENTRIES)) {
                  const preferred = personalizationResult.personalization.variants.behavior.preferSpotlightV2;
                  setUseSpotlightV2(preferred);
                  localStorage.setItem('force:spotlight:v2', String(preferred));
                }
              }
            } else if (personalizationResult.error) {
              setPersonalizationPayload(null);
              setCachedPersonalization(null);
              setPersonalizationLoadError(personalizationResult.error);
            }
          }

          // ── Background: Polished LLM greeting generation (silent) ───────────
          void (async () => {
            const bgT0 = Date.now();
            try {
              const isCachedLlm = cachedGreeting && cachedGreeting.source === 'llm';
              console.log(`[Dashboard:BG] ▶ Greeting polish worker started. cachedGreeting.source=${cachedGreeting?.source || 'none'}, isCachedLlm=${isCachedLlm}`);
              if (isCachedLlm) {
                console.log('[Dashboard:BG] ■ Skipping — already have LLM greeting cached');
                return;
              }

              const insights: SpotlightInsight[] = Array.isArray(spotlightData?.insights) ? spotlightData.insights : [];
              const isNewUserContext = !statsResult || (statsResult.totalEntries ?? 0) === 0;
              const selectedInsight = pickGreetingInsight(insights, isNewUserContext);
              console.log(`[Dashboard:BG] selectedInsight: ${selectedInsight ? selectedInsight.type : 'null'}, isNewUser: ${isNewUserContext}`);

              const baseGreeting = buildActivityAwareGreeting({
                firstName: userFirstName,
                stats: statsResult || storeState.stats,
                selectedInsight,
                recentJournalSnippets: recentSnippets || [],
                isNewUserContext,
              });
              console.log(`[Dashboard:BG] Base greeting built: source=${baseGreeting.source}, title="${baseGreeting.title?.slice(0, 50)}"`);
              console.log(`[Dashboard:BG] Calling polishGreetingWithLlm...`);

              const polished = await polishGreetingWithLlm({
                baseGreeting,
                recentJournalSnippets: recentSnippets || [],
                daysSinceLastEntry: getDaysSince(statsResult?.lastEntryDate),
                isNewUserContext,
                decryptPromptCache,
                friendlyContext: {
                  firstName: userFirstName,
                  toneMode: 'gentle_friend',
                  totalEntries: statsResult?.totalEntries,
                  streakCount: statsResult?.streakCount,
                  averageMood: statsResult?.averageMood,
                  topTopics: (statsResult?.topTopics || []).map((topic: { name: string }) => topic.name).slice(0, 3),
                  localHour: new Date().getHours(),
                },
              });

              console.log(`[Dashboard:BG] polishGreetingWithLlm returned in ${Date.now() - bgT0}ms — source=${polished?.source}, title="${polished?.title?.slice(0, 50)}"`);

              // Only update if the LLM actually produced a different greeting
              if (polished && polished.source === 'llm') {
                console.log('[Dashboard:BG] ✓ LLM greeting received! Updating hero and saving to cache.');
                setHeroGreeting(polished);
                await saveCachedSpotlightGreeting({
                  greeting: polished,
                  totalEntries: statsResult?.totalEntries ?? 0,
                  lastEntryDate: statsResult?.lastEntryDate ?? null,
                });
              } else {
                console.warn(`[Dashboard:BG] ✗ LLM did NOT produce an 'llm' source greeting. Got source=${polished?.source}. Hero NOT updated.`);
              }
            } catch (err) {
              console.error(`[Dashboard:BG] ✗ Background greeting polish THREW after ${Date.now() - bgT0}ms:`, err);
            }
          })();

          // All data fetches are settled — reveal dashboard!
          console.log(`[Dashboard] ✓ Dashboard reveal at T+${Date.now() - loadT0}ms — setLoading(false)`);
          console.log('[Dashboard] ════════════════════════════════════════════════');
          setHeroGreetingLoading(false);
          setDataLoaded(true);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
        setLoading(false);
        router.push('/login');
      }
    };

    loadDashboardData();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setLoading(true); // Prevent UI flash on logout
        router.push('/login');
      } else {
        setUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded, isDashboardCacheHydrated, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!user?.id || !personalizationBucket) return;
    if (requiresBucketSelection) {
      setShowBucketProgressReminder(false);
      return;
    }

    if (isWithinEntryWindow(entryCountForPersonalization, NEW_USER_FULL_PERSONALIZATION_MAX_ENTRIES)) {
      setShowBucketProgressReminder(false);
      return;
    }

    const key = getReminderStorageKey();
    if (!key) return;

    const lastPromptRaw = localStorage.getItem(key);
    const lastPromptAt = lastPromptRaw ? Number(lastPromptRaw) : 0;
    const intervalMs = getReminderIntervalDays(entryCountForPersonalization) * 24 * 60 * 60 * 1000;

    if (!lastPromptAt || Number.isNaN(lastPromptAt) || Date.now() - lastPromptAt >= intervalMs) {
      setShowBucketProgressReminder(true);
      return;
    }

    setShowBucketProgressReminder(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, personalizationBucket, entryCountForPersonalization, requiresBucketSelection]);

  // Check new user status
  // Check new user status
  useEffect(() => {
    if (user) {
      // Check if user is new based on metadata or created_at date
      const userCreatedAt = new Date(user.created_at);
      const daysSinceCreation = (Date.now() - userCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceCreation < 1 && !newUser) {
        setNewUser(true);
        setShowNewUserGuidance(true);
        
        // Show welcome toast for new users
        setSuccessMessage("Welcome to your journal! Follow the guide to get started.");
        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
        }, 5000);
      }
    }
  }, [user, newUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasEntries) {
      setShowNewUserGuidance(false);
      return;
    }

    const guidanceSeen = localStorage.getItem(NEW_USER_GUIDANCE_SEEN_KEY) === 'true';
    if (!guidanceSeen && !newUser) {
      setNewUser(true);
      setShowNewUserGuidance(true);
    }
  }, [hasEntries, newUser]);

  const sectionLabels = isWithinEntryWindow(entryCountForPersonalization, SECTION_LABELS_MAX_ENTRIES)
    ? personalizationPayload?.variants.sectionLabels
    : undefined;

  const writingPromptVariant = isWithinEntryWindow(entryCountForPersonalization, PERSONALIZATION_FADE_MAX_ENTRIES)
    ? personalizationPayload?.variants.writingPrompt
    : undefined;

  const handleDismissGuidance = () => {
    setShowNewUserGuidance(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem(NEW_USER_GUIDANCE_SEEN_KEY, 'true');
    }
    
    // Show encouraging toast when guidance is dismissed
    setSuccessMessage("Great! You're ready to start your journaling journey.");
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };
  
  // Show dashboard loader until all components, prompts, and insights are fully loaded.
  // This ensures no skeleton loading states are ever shown to the user.
  if (loading || !dataLoaded || heroGreetingLoading || !fontsLoaded) {
    return (
      <div
        className={`relative min-h-screen overflow-hidden ${isDarkMode ? 'bg-slate-950 text-slate-100' : ''}`}
        style={dashboardBackgroundStyle}
      >
        <style>{`
          @keyframes loadDriftA {
            0%, 100% { transform: translate3d(0, 0, 0); }
            50% { transform: translate3d(14px, -18px, 0); }
          }

          @keyframes loadDriftB {
            0%, 100% { transform: translate3d(0, 0, 0); }
            50% { transform: translate3d(-12px, 16px, 0); }
          }

          @keyframes softSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @keyframes shimmer {
            0% { background-position: 220% 0; }
            100% { background-position: -120% 0; }
          }

          @keyframes pulseIn {
            0%, 100% { opacity: 0.75; transform: scale(0.96); }
            50% { opacity: 1; transform: scale(1); }
          }

          .loading-drift-a {
            animation: loadDriftA 13s ease-in-out infinite;
          }

          .loading-drift-b {
            animation: loadDriftB 17s ease-in-out infinite;
          }

          .loading-ring {
            animation: softSpin 6s linear infinite;
          }

          .loading-shimmer {
            background: linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,245,238,0.95) 50%, rgba(255,255,255,0) 70%);
            background-size: 230% 100%;
            animation: shimmer 2.6s linear infinite;
          }

          .loading-pulse {
            animation: pulseIn 2.2s ease-in-out infinite;
          }

          /* breathing/grid/gradient keyframes used by loader background */
          @keyframes breathingScale {
            0% { opacity: 0.95; transform: scale(1) translateX(0) translateY(0); }
            25% { opacity: 0.98; transform: scale(1.01) translateX(8px) translateY(-6px); }
            50% { opacity: 1; transform: scale(1.02) translateX(0) translateY(8px); }
            75% { opacity: 0.98; transform: scale(1.01) translateX(-8px) translateY(-4px); }
            100% { opacity: 0.95; transform: scale(1) translateX(0) translateY(0); }
          }

          @keyframes gridBreathing {
            0% { background-size: 25px 25px; }
            50% { background-size: 27px 27px; }
            100% { background-size: 25px 25px; }
          }

          @keyframes gradientShift {
            0% { background-position: 0% 0%; }
            50% { background-position: 100% 100%; }
            100% { background-position: 0% 0%; }
          }

          @keyframes depthBreathing1 {
            0%, 100% { opacity: 0.25; transform: translate(0, 0) scale(1); }
            50% { opacity: 0.35; transform: translate(15px, -15px) scale(1.05); }
          }

          @keyframes depthBreathing2 {
            0%, 100% { opacity: 0.18; transform: translate(0, 0) scale(1); }
            50% { opacity: 0.28; transform: translate(-20px, 12px) scale(1.05); }
          }

          .animate-breathing { animation: breathingScale 15s ease-in-out infinite; }
        `}</style>

        <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 animate-breathing">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: isDarkMode
                    ? 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.92) 20%, rgba(51,65,85,0.92) 40%, rgba(15,118,110,0.28) 60%, rgba(59,130,246,0.22) 80%, rgba(88,28,135,0.24) 100%)'
                    : `linear-gradient(135deg, rgb(255,192,214) 0%, rgb(255,224,208) 22%, rgb(255,241,236) 42%, rgb(248,224,233) 64%, rgb(240,216,227) 82%, rgb(225,197,218) 100%)`,
                  backgroundPosition: '0% 0%',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '200% 200%',
                  animation: 'gradientShift 20s ease-in-out infinite',
                  transform: 'scale(1.02)',
                  opacity: (pageBackground && pageBackground !== (isDarkMode ? '#1F2937' : '#F7F9FC')) ? 0.3 : 1
                }}
              />

              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: isDarkMode
                    ? `linear-gradient(0deg, rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)`
                    : `linear-gradient(0deg, rgba(180,110,136,0.38) 1px, transparent 1px), linear-gradient(90deg, rgba(180,110,136,0.38) 1px, transparent 1px)`,
                  backgroundSize: '25px 25px',
                  animation: 'gridBreathing 16s ease-in-out infinite'
                }}
              />

              <div style={{ position: 'absolute', inset: 0, background: isDarkMode ? 'radial-gradient(ellipse at 30% 50%, rgba(251,146,60,0.08) 0%, transparent 50%)' : 'radial-gradient(ellipse at 30% 50%, rgba(255,190,210,0.16) 0%, transparent 50%)', animation: 'depthBreathing1 18s ease-in-out infinite' }} />
              <div style={{ position: 'absolute', inset: 0, background: isDarkMode ? 'radial-gradient(ellipse at 70% 30%, rgba(96,165,250,0.08) 0%, transparent 50%)' : 'radial-gradient(ellipse at 70% 30%, rgba(246,203,223,0.16) 0%, transparent 50%)', animation: 'depthBreathing2 22s ease-in-out infinite' }} />
            </div>

            <div className={`loading-drift-a absolute -left-20 top-8 h-72 w-72 rounded-full blur-3xl ${isDarkMode ? 'bg-sky-500/20' : 'bg-[#f0b2c4]/44'}`} />
            <div className={`loading-drift-b absolute right-0 top-0 h-96 w-96 rounded-full blur-3xl ${isDarkMode ? 'bg-emerald-400/15' : 'bg-[#efc7d5]/36'}`} />
            <div className={`absolute inset-0 ${isDarkMode ? 'bg-[radial-gradient(circle_at_18%_18%,rgba(56,189,248,0.16),transparent_40%),radial-gradient(circle_at_82%_8%,rgba(34,197,94,0.12),transparent_34%),radial-gradient(circle_at_50%_82%,rgba(139,92,246,0.12),transparent_30%)]' : 'bg-[radial-gradient(circle_at_18%_18%,rgba(255,227,234,0.56),transparent_40%),radial-gradient(circle_at_82%_8%,rgba(255,239,229,0.44),transparent_34%),radial-gradient(circle_at_50%_82%,rgba(242,224,216,0.28),transparent_30%)]'}`} />
            <div className="absolute inset-0 opacity-20 mix-blend-soft-light" style={{ backgroundImage: isDarkMode ? 'linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)' : 'linear-gradient(to right, rgba(140,104,90,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(140,104,90,0.05) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />
            <div className="absolute inset-0 opacity-12" style={{ backgroundImage: isDarkMode ? 'radial-gradient(rgba(148,163,184,0.15) 0.7px, transparent 0.7px)' : 'radial-gradient(rgba(126,92,78,0.14) 0.7px, transparent 0.7px)', backgroundSize: '5px 5px' }} />
          </div>

        <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center px-6 py-14 sm:px-10">
          <div className={`w-full rounded-[34px] p-6 backdrop-blur-[14px] sm:p-8 lg:p-10 ${isDarkMode ? 'border border-slate-700/70 bg-slate-900/80 shadow-[0_18px_40px_rgba(15,23,42,0.42)]' : 'border border-[#d4b49f]/58 bg-[#fff9f4]/78 shadow-[0_18px_40px_rgba(104,67,48,0.12)]'}`}>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
              <div>
                

                <h1 className={`mt-4 text-[42px] leading-[0.95] tracking-[0.03em] drop-shadow-[0_1px_0_rgba(255,255,255,0.22)] sm:text-[52px] ${isDarkMode ? 'text-slate-50' : 'text-[#33201a]'}`} style={{ fontFamily: 'var(--dashboard-heading-font, Georgia, serif)' }}>
                  Let your thoughts land
                </h1>

                <p className={`mt-3 max-w-xl text-base leading-relaxed ${isDarkMode ? 'text-slate-300' : 'text-[#714b40]'}`} style={{ fontFamily: 'var(--dashboard-body-font, system-ui, sans-serif)', letterSpacing: '0.02em' }}>
                  Analyzing your data and preparing tailored reflection insights.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {['Mood Trends', 'Prompt Engine', 'Memory Stream'].map((item) => (
                    <div key={item} className={`rounded-2xl border px-3 py-2.5 text-xs font-semibold shadow-[0_8px_18px_rgba(139,93,72,0.08)] ${isDarkMode ? 'border-slate-700 bg-slate-800/90 text-slate-200' : 'border-[#d9b6a6]/72 bg-[#fff1e7]/96 text-[#6c4437]'}`}>
                      <div className={`mb-2 h-1.5 w-full overflow-hidden rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-[#f1ccb4]'}`}>
                        <div className="loading-shimmer h-full w-full" />
                      </div>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`rounded-[28px] p-4 shadow-[0_14px_30px_rgba(127,85,67,0.08)] sm:p-5 ${isDarkMode ? 'border border-slate-700/70 bg-slate-950/60 text-slate-100' : 'border border-[#d8b7a7]/64 bg-[#fff5ee]/84'}`}>
                <div className="mb-4 flex items-center justify-between">
                  <div className={`h-3 w-24 rounded-full ${isDarkMode ? 'bg-slate-700' : 'bg-[#e6c5b1]'}`} />
                  <div className={`loading-ring h-8 w-8 rounded-full border-2 ${isDarkMode ? 'border-slate-600 border-t-sky-300' : 'border-[#cb8f78]/52 border-t-[#8f5f52]'}`} />
                </div>

                <SkeletonWritingPrompt />

              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // When the cache is warm, `loading` starts as false and `user` is null until
  // the auth check resolves — render the shell immediately with cached data.
  // Only bail out if the loading gate above is active (which handles redirects).
// Authenticated and data loaded - render dashboard
  return (
    <div 
      className={`relative -mb-24 min-h-screen flex flex-col overflow-hidden pb-40 ${isDarkMode ? 'dark' : ''}`}
      style={{
        ...dashboardBackgroundStyle,
        color: elementColors.text,
        fontFamily: 'var(--font-family)',
        '--dashboard-text': elementColors.text,
        '--dashboard-accent': elementColors.accent,
        '--dashboard-surface': elementColors.background,
        '--dashboard-label-border': elementColors.accent,
        '--dashboard-label-bg': elementColors.background,
        '--dashboard-label-text': elementColors.text,
        '--dashboard-cta-text': elementColors.text,
      } as React.CSSProperties}
    >
      <ThemeSidebar />  
      {showToast && (
        <Toast 
          message={successMessage} 
          type="success" 
          visible={showToast} 
          duration={3000} 
        />
      )}
      
      <main className={`dashboard-shell relative z-10 flex-1 container mx-auto max-w-3xl lg:max-w-6xl xl:max-w-7xl py-6 sm:py-8 lg:py-10 px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8 lg:space-y-10 ${isDarkMode ? 'text-slate-100' : ''}`}>

        {personalizationBucket && (
          <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.08em] uppercase ${isDarkMode ? 'border-slate-700 bg-slate-900/80 text-slate-200' : 'border-[#d4b3aa]/55 bg-[#f9ece7]/88 text-[#7a4d44]'}`}>
            {getBucketLabel(personalizationBucket)}
          </div>
        )}

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className={`relative overflow-hidden rounded-[34px] px-6 py-7 backdrop-blur-xl sm:px-8 ${isDarkMode ? 'border border-slate-700/70 bg-slate-900/75 shadow-[0_18px_42px_rgba(15,23,42,0.35)]' : 'border border-[#d9b8ad]/55 bg-[#fff7f2]/92 shadow-[0_18px_42px_rgba(104,67,48,0.14)]'}`}
        >
          <div className="absolute inset-0 dashboard-hero-grain opacity-28" />
          <div className="absolute -left-16 bottom-4 h-24 w-56 rounded-full bg-[#ebc3b2]/26 blur-2xl" />
          <div className="absolute right-10 top-8 h-20 w-48 rounded-full bg-[#c8ded6]/22 blur-2xl" />
          <Image 
            src="/mind_scroll/stickers/diamond_top2.png" 
            alt="" 
            aria-hidden 
            className="absolute right-8 top-5 w-8 opacity-45" 
            width={32}
            height={32}
          />
          <SpotlightGreetingHero greeting={heroGreeting} loading={heroGreetingLoading} />

          <div className="mt-5">
            {/* {hasEntries ? ( */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className={`rounded-2xl p-3 shadow-sm ${isDarkMode ? 'border border-slate-700/70 bg-slate-950/55' : 'border border-[#d8beb2]/60 bg-[#fffcfa]/92'}`}>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#7a5148]'}`}>Journal Entries</p>
                  <p className={`mt-1 text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-[#3e2a24]'}`}>{stats?.totalEntries ?? 0}</p>
                </div>
                <div className={`rounded-2xl p-3 shadow-sm ${isDarkMode ? 'border border-slate-700/70 bg-slate-950/55' : 'border border-[#d8beb2]/60 bg-[#fffcfa]/92'}`}>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#7a5148]'}`}>Current Streak</p>
                  <p className={`mt-1 text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-[#3e2a24]'}`}>{stats?.streakCount ?? 0} days</p>
                </div>
                <div className={`rounded-2xl p-3 shadow-sm ${isDarkMode ? 'border border-slate-700/70 bg-slate-950/55' : 'border border-[#d8beb2]/60 bg-[#fffcfa]/92'}`}>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#7a5148]'}`}>This Week</p>
                  <p className={`mt-1 text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-[#3e2a24]'}`}>{stats?.weeklyEntries ?? 0} entries</p>
                </div>
                <div className={`rounded-2xl p-3 shadow-sm ${isDarkMode ? 'border border-slate-700/70 bg-slate-950/55' : 'border border-[#d8beb2]/60 bg-[#fffcfa]/92'}`}>
                  <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#7a5148]'}`}>Average Mood</p>
                  <p className={`mt-1 text-sm font-semibold capitalize ${isDarkMode ? 'text-slate-100' : 'text-[#3e2a24]'}`}>
                    {stats?.averageMood ?? <span className="inline-block h-3 w-20 animate-pulse rounded-full bg-[#ecdacb] align-middle" />}
                  </p>
                </div>
              </div>
           
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03, duration: 0.5 }}
          className={`relative overflow-hidden rounded-[30px] p-5 ${isDarkMode ? 'border border-slate-700/70 bg-slate-900/70 shadow-[0_14px_34px_rgba(15,23,42,0.28)]' : 'border border-[#dbc5b9]/55 bg-[#fff9f4]/88 shadow-[0_14px_34px_rgba(96,65,45,0.1)]'}`}
        >
          <div className="absolute inset-0 dashboard-soft-diagonal opacity-30" />
          <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-3 -mb-4">
            {dashboardCards.map((card, i) => (
              <motion.article
                key={card.tag}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{
                  duration: 1.4,
                  delay: i * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative rounded-3xl overflow-hidden cursor-default group"
                style={{
                  background: `linear-gradient(152deg, ${card.bgFrom} 0%, ${card.bgTo} 100%)`,
                  border: isDarkMode ? '0.5px solid rgba(148,163,184,0.12)' : '0.5px solid rgba(0,0,0,0.042)',
                  boxShadow:
                    isDarkMode
                      ? '0 2px 18px rgba(15,23,42,0.25), 0 0 0 0.5px rgba(255,255,255,0.04) inset'
                      : '0 2px 18px rgba(0,0,0,0.038), 0 0 0 0.5px rgba(255,255,255,0.55) inset',
                }}
              >
                <div className="relative overflow-hidden" style={{ height: 210 }}>
                  <card.Visual isDarkMode={isDarkMode} />
                  <div
                    className="absolute bottom-0 left-0 right-0"
                    style={{
                      height: 64,
                      background: `linear-gradient(to top, ${card.bgFrom} 0%, transparent 100%)`,
                    }}
                  />
                </div>

                <div className="px-6 pt-5 pb-8">
                  <p
                    className="font-terminal-grotesque"
                    style={{
                      fontSize: 8,
                      letterSpacing: '0.48em',
                      textTransform: 'uppercase',
                      color: `${card.accent}95`,
                      fontWeight: 300,
                      marginBottom: 11,
                    }}
                  >
                    {card.tag}
                  </p>

                  <h3
                    className="font-hydrogen-whiskey font-light "
                    style={{
                      fontSize: 21,
                      lineHeight: 1.24,
                      marginBottom: 12,
                      color: card.text,
                      fontFamily: 'var(--dashboard-heading-font, Georgia, serif)',
                    }}
                  >
                    {card.heading}
                  </h3>

                  <div
                    style={{
                      height: '0.5px',
                      width: 28,
                      background: `${card.accent}38`,
                      marginBottom: 13,
                    }}
                  />

                  <p
                    className="font-terminal-grotesque font-light"
                    style={{ fontSize: 12, lineHeight: 1.78, color: card.muted }}
                  >
                    {card.copy}
                  </p>
                </div>

                <div
                  className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-700"
                  style={{
                    background: `radial-gradient(ellipse at 50% 5%, ${card.accent}07 0%, transparent 55%)`,
                  }}
                />
              </motion.article>
            ))}
          </div>

          <InsightsCTA isDarkMode={isDarkMode} />
        </motion.section>
        
        {/* Mood Check-in
        <div className="dashboard-section-label">
          <span>State Check-In</span>
        </div>
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45 }}
          className="relative overflow-hidden rounded-[30px] border border-[#d8c2b5]/55 bg-[#fff8f2]/90 p-3 shadow-[0_12px_28px_rgba(79,57,39,0.1)]"
        >
          <MoodCheckin />
        </motion.section> */}

        {/* Notifications 
        <NotificationPanel />*/}

        {/* New User Guidance (conditional) */}
        {/* {showNewUserGuidance && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.45 }}
            className="relative overflow-hidden rounded-[30px] border border-[#dcc0b6]/55 bg-[#fff7f2]/88 p-3 shadow-[0_12px_28px_rgba(97,64,44,0.11)]"
          >
            <NewUserGuidance onDismissAll={handleDismissGuidance} />
          </motion.section>
        )} */}

        {requiresBucketSelection && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.13, duration: 0.45 }}
            className="relative overflow-hidden rounded-[30px] border border-[#dcc0b6]/55 bg-[#fff7f2]/88 p-5 shadow-[0_12px_28px_rgba(97,64,44,0.11)]"
          >
            <div className="mb-4">
              <p className="text-xs uppercase tracking-widest text-[#7a4e45]">Personalization setup</p>
              <h3 className="mt-1 text-lg font-semibold" style={{ fontFamily: 'var(--dashboard-heading-font)' }}>How should Force support you right now?</h3>
              <p className="mt-1 text-sm text-[#725149]" style={{ fontFamily: 'var(--dashboard-body-font)' }}>
                Pick one mode to tune your prompts and dashboard flow.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {BUCKET_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => saveDashboardBucket(option.key)}
                  disabled={personalizationSaving}
                  className="text-left rounded-2xl border border-[#d8bbb0] bg-[#fffdfa] p-4 hover:bg-[#f8efe7] transition-colors disabled:opacity-50"
                >
                  <p className="font-semibold text-[#3f2a24]">{option.title}</p>
                  <p className="mt-1 text-sm text-[#6f5048]">{option.description}</p>
                </button>
              ))}
            </div>

            {personalizationError && (
              <p className="mt-3 text-sm text-red-600">{personalizationError}</p>
            )}
          </motion.section>
        )}

        {personalizationLoadError && !requiresBucketSelection && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.45 }}
            className="relative overflow-hidden rounded-[30px] border border-[#e2c8bd]/60 bg-[#fff6f1]/88 p-4 shadow-[0_10px_26px_rgba(97,64,44,0.1)]"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#7a4e45]">Personalization</p>
                <p className="mt-1 text-sm text-[#6f5048]" style={{ fontFamily: 'var(--dashboard-body-font)' }}>
                  Something went wrong while loading your personalization. You can retry now.
                </p>
              </div>
              <button
                onClick={refreshPersonalization}
                disabled={personalizationRefreshing}
                className="rounded-full border border-[#d8bbb0] bg-[#fffdfa] px-4 py-2 text-sm font-semibold text-[#3f2a24] transition-colors hover:bg-[#f8efe7] disabled:opacity-60"
              >
                {personalizationRefreshing ? 'Retrying...' : 'Retry'}
              </button>
            </div>
          </motion.section>
        )}

        {/* ═══ SECTION 2: Primary Action — Writing Prompt ═══ */}
        <div className="dashboard-section-label flex items-center justify-between">
          <span>Clarity Practice</span>
          {/* <button
            type="button"
            onClick={handleRefreshPrompt}
            disabled={isPromptRefreshing}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
              isDarkMode
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-[#8c675a] hover:text-[#3e2a24]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Refresh writing prompt"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPromptRefreshing ? 'animate-spin text-amber-500' : ''}`} />
            <span>{isPromptRefreshing ? 'Refreshing...' : 'Refresh Prompt'}</span>
          </button> */}
        </div>
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.45 }}
          className={`relative overflow-hidden rounded-[30px] p-3 ${isDarkMode ? 'border border-slate-700/70 bg-slate-900/70 shadow-[0_12px_32px_rgba(15,23,42,0.24)]' : 'border border-[#d8c2b5]/55 bg-[#fff7ef]/90 shadow-[0_12px_32px_rgba(79,57,39,0.11)]'}`}
        >
              {resolvedPromptData && !isPromptRefreshing ? (
                <WritingPromptHero
                  prompt={{
                    text:
                      promptData?.prompt?.text ||
                      writingPromptVariant?.text ||
                      resolvedPromptData.prompt?.text ||
                      "",
                    explanation:
                      promptData?.prompt?.explanation ||
                      writingPromptVariant?.explanation ||
                      resolvedPromptData.prompt?.explanation ||
                      "",
                  }}
                  ctaLabel={writingPromptVariant?.ctaLabel || personalizationPayload?.insight.actionLabel}
                  onRefresh={handleRefreshPrompt}
                  isRefreshing={isPromptRefreshing}
                />
              ) : (
                <PromptThinkingSkeleton isDarkMode={isDarkMode} />
              )}
        </motion.section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          <MentalWeatherForecast
            key={`weather-${hasEntries ? 'active' : 'new'}`}
            isNewUserContext={stats ? !hasMeaningfulInsights : undefined}
            insight={dashboardInsights?.mentalWeather}
            dashboardInsights={dashboardInsights}
            analysisOverride={dashboardInsights?.mentalWeather?.analysis ?? null}
          />
          <WellnessBalance
            key={`wellness-${hasEntries ? 'active' : 'new'}`}
            isNewUserContext={stats ? !hasMeaningfulInsights : undefined}
            insight={dashboardInsights?.wellnessBalance}
            dashboardInsights={dashboardInsights}
          />
        </div>

        {/* ═══ SECTION: Vektori Memory Snapshot ═══ */}
        <div className="dashboard-section-label">
          <span>Memory Layer</span>
        </div>
        <VektoriSnapshot
          isDarkMode={isDarkMode}
          accentColor={elementColors.accent}
          totalEntries={stats?.totalEntries ?? 0}
          streakCount={stats?.streakCount ?? 0}
          weeklyEntries={stats?.weeklyEntries ?? 0}
          lastEntryDate={stats?.lastEntryDate ?? null}
        />

        {/* ═══ SECTION 6: Recent Memories ═══ */}
        <div className="dashboard-section-label">
          {sectionLabels?.memory ? (
            <span>{sectionLabels.memory}</span>
          ) : (
            <span>Recent Memories</span>
          )}
        </div>
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.33, duration: 0.45 }}
          className={`relative overflow-hidden rounded-[30px] p-3 ${isDarkMode ? 'border border-slate-700/70 bg-slate-900/70 shadow-[0_12px_28px_rgba(15,23,42,0.24)]' : 'border border-[#d8c2b5]/55 bg-[#fff8f2]/90 shadow-[0_12px_28px_rgba(79,57,39,0.1)]'}`}
        >
          <MemoryCarousel />
        </motion.section>

      </main>
      
      
      
      <style>{`
        @font-face {
          font-family: 'Hydrogen Whiskey';
          src: url('/fonts/Hydrogen_Whiskey.otf') format('opentype');
          font-display: swap;
        }

        @font-face {
          font-family: 'Terminal Grotesque';
          src: url('/fonts/terminal-grotesque.ttf') format('opentype');
          font-display: swap;
        }

        :root {
          --dashboard-heading-font: 'Hydrogen Whiskey', serif;
          --dashboard-body-font: 'Terminal Grotesque', sans-serif;
        }

        .dashboard-shell {
          font-size: clamp(0.92rem, 0.86rem + 0.25vw, 1rem);
        }

        .dashboard-shell .text-xs {
          font-size: clamp(0.78rem, 0.75rem + 0.14vw, 0.84rem);
          line-height: clamp(1.1rem, 1.04rem + 0.18vw, 1.22rem);
        }

        .dashboard-shell .text-sm {
          font-size: clamp(0.9rem, 0.86rem + 0.18vw, 0.96rem);
          line-height: clamp(1.3rem, 1.24rem + 0.24vw, 1.42rem);
        }

        .font-terminal-grotesque {
          font-family: 'Terminal Grotesque', sans-serif !important;
        }

        .dashboard-shell .text-base {
          font-size: clamp(0.96rem, 0.9rem + 0.24vw, 1.05rem);
          line-height: clamp(1.42rem, 1.34rem + 0.32vw, 1.56rem);
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 1; }
        }

        @keyframes dashboardFloatA {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-18px) translateX(8px); }
        }

        @keyframes dashboardFloatB {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(14px) translateX(-12px); }
        }

        @keyframes dashboardFloatC {
          0%, 100% { transform: translateY(0px) translateX(0px) scale(1); }
          50% { transform: translateY(-10px) translateX(12px) scale(1.06); }
        }

        @keyframes dashboardGrid {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-34px, -34px, 0); }
        }

        .dashboard-float-a {
          animation: dashboardFloatA 10s ease-in-out infinite;
        }

        .dashboard-float-b {
          animation: dashboardFloatB 14s ease-in-out infinite;
        }

        .dashboard-float-c {
          animation: dashboardFloatC 18s ease-in-out infinite;
        }

        .dashboard-grid {
          background-image:
            linear-gradient(to right, rgba(126, 92, 74, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(126, 92, 74, 0.1) 1px, transparent 1px);
          background-size: 40px 40px;
          mask-image: radial-gradient(circle at 50% 40%, black 28%, transparent 85%);
          animation: dashboardGrid 44s linear infinite;
        }

        .dark .dashboard-grid {
          background-image:
            linear-gradient(to right, rgba(148, 163, 184, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
        }

        .dashboard-aurora-a {
          background: radial-gradient(72% 90% at 50% 50%, rgba(233,194,178,0.32) 0%, rgba(233,194,178,0) 70%);
          filter: blur(34px);
          animation: auroraSweepA 18s ease-in-out infinite;
        }

        .dark .dashboard-aurora-a {
          background: radial-gradient(72% 90% at 50% 50%, rgba(56,189,248,0.14) 0%, rgba(56,189,248,0) 70%);
        }

        .dashboard-aurora-b {
          background: radial-gradient(72% 90% at 50% 50%, rgba(192,222,212,0.3) 0%, rgba(192,222,212,0) 72%);
          filter: blur(38px);
          animation: auroraSweepB 22s ease-in-out infinite;
        }

        .dark .dashboard-aurora-b {
          background: radial-gradient(72% 90% at 50% 50%, rgba(34,197,94,0.12) 0%, rgba(34,197,94,0) 72%);
        }

        .dashboard-noise {
          background-image: radial-gradient(rgba(123, 88, 70, 0.08) 0.5px, transparent 0.5px);
          background-size: 5px 5px;
        }

        .dark .dashboard-noise {
          background-image: radial-gradient(rgba(148, 163, 184, 0.08) 0.5px, transparent 0.5px);
        }

        .dashboard-hero-grain {
          background-image: radial-gradient(rgba(120, 86, 68, 0.09) 0.6px, transparent 0.6px);
          background-size: 5px 5px;
        }

        .dark .dashboard-hero-grain {
          background-image: radial-gradient(rgba(148, 163, 184, 0.08) 0.6px, transparent 0.6px);
        }

        .dashboard-soft-diagonal {
          background: linear-gradient(130deg, rgba(255,255,255,0.5), rgba(255,255,255,0) 30%, rgba(255,255,255,0.35));
        }

        .dark .dashboard-soft-diagonal {
          background: linear-gradient(130deg, rgba(15,23,42,0.55), rgba(15,23,42,0) 30%, rgba(15,23,42,0.3));
        }

        .dashboard-section-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 2px;
          margin-bottom: -2px;
          color: var(--dashboard-label-text, #7a4f44);
          font-size: clamp(0.58rem, 0.52rem + 0.18vw, 0.66rem);
          font-weight: 700;
          letter-spacing: clamp(0.08em, 0.06em + 0.08vw, 0.12em);
          text-transform: uppercase;
          opacity: 0.88;
          padding: 0 8px;
          height: 22px;
          border-radius: 999px;
          border: 1px solid var(--dashboard-label-border, rgba(159, 120, 100, 0.26));
          background: var(--dashboard-label-bg, rgba(252, 239, 229, 0.75));
        }

        .dashboard-shell ::selection {
          background: var(--dashboard-accent, rgba(159, 120, 100, 0.26));
          color: var(--dashboard-text, #2d2d2d);
        }

        .dashboard-vignette {
          background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0) 46%, rgba(92,62,44,0.08) 120%);
        }

        .dark .dashboard-vignette {
          background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0) 42%, rgba(15,23,42,0.4) 120%);
        }

        @keyframes auroraSweepA {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(4%, -3%, 0) scale(1.04); }
        }

        @keyframes auroraSweepB {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(-4%, 4%, 0) scale(1.06); }
        }

        @media (max-width: 768px) {
          .dashboard-section-label {
            letter-spacing: 0.09em;
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        
        /* Dark mode styles */
        .dark {
          --bg-background: #121212;
          --text-primary: #ffffff;
          --text-muted: #a0a0a0;
          color-scheme: dark;
        }
        
        .dark body,
        .dark .bg-background {
          background-color: var(--bg-background);
          color: var(--text-primary);
        }
        
        .dark .text-muted-foreground {
          color: var(--text-muted);
        }
        
        .dark .bg-muted {
          background-color: #2a2a2a;
        }
        
        .dark .border {
          border-color: #333333;
        }
        
        /* Enhance mobile responsiveness */
        @media (max-width: 640px) {
          .container {
            padding-left: 0.75rem;
            padding-right: 0.75rem;
          }
          
          main {
            padding-top: 1rem;
            padding-bottom: 1rem;
          }
          
          .space-y-4 > * + * {
            margin-top: 1rem;
          }
        }
        
        @media (min-width: 641px) and (max-width: 1024px) {
          .container {
            max-width: 100%;
            padding-left: 1.5rem;
            padding-right: 1.5rem;
          }
        }
        
        @media (min-width: 1025px) {
          .container {
            padding-left: 2rem;
            padding-right: 2rem;
          }
        }
        
        /* Animation for welcome banner */
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}
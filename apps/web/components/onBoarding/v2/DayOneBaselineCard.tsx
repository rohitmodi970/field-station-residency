'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ArrowUpRight,
  Eye,
  Lightbulb,
  ShieldCheck,
  Crosshair,
  CheckCircle2,
  Scale,
  Compass
} from 'lucide-react';
import Link from 'next/link';
import CognitiveSpectrumCanvas from '@/components/dashboard-b2c/CognitiveSpectrumCanvas';
import CognitiveSpectrumModal from '@/components/dashboard-b2c/CognitiveSpectrumModal';

export interface DayOneBaselineProps {
  clarityScore?: number;
  selfAwarenessScore?: number;
  confidenceScore?: number;
  followThroughIntent?: number;
  selfAccountabilityScore?: number;
  receptiveHumilityScore?: number;
  clarityObservation?: string;
  emotionalCandorObservation?: string;
  groundedConvictionObservation?: string;
  actionReadinessObservation?: string;
  selfAccountabilityObservation?: string;
  receptiveHumilityObservation?: string;
  wordsAnalyzed?: number;
  signalsCount?: number;
  topicsDetected?: string[];
  startingMindstateTitle?: string;
  startingMindstateSnippet?: string;
  archetype?: string;        // Kept for backwards compatibility
  archetypeTagline?: string; // Kept for backwards compatibility
}

export const DayOneBaselineCard: React.FC<DayOneBaselineProps> = ({
  clarityScore = 91,
  selfAwarenessScore = 94,
  confidenceScore = 88,
  followThroughIntent = 90,
  selfAccountabilityScore = 95,
  receptiveHumilityScore = 89,
  clarityObservation,
  emotionalCandorObservation,
  groundedConvictionObservation,
  actionReadinessObservation,
  selfAccountabilityObservation,
  receptiveHumilityObservation,
  wordsAnalyzed = 1420,
  signalsCount = 5,
  topicsDetected = ['Engineering', 'Team Leadership', 'Product Strategy'],
  startingMindstateTitle = 'Clear-eyed · Carrying momentum · Ready to execute',
  startingMindstateSnippet = 'High personal standards with zero sugarcoating. You identified root bottlenecks honestly and showed an immediate bias toward resolution.',
}) => {
  const [showSpectrumModal, setShowSpectrumModal] = useState(false);

  // Deeply human, grounded Day-1 observations (no fake peer percentiles before Week 1)
  const metrics = [
    {
      icon: <Lightbulb className="h-3.5 w-3.5 text-amber-600" />,
      label: 'Clarity of Intent',
      score: clarityScore,
      observation: clarityObservation || 'Connects root causes, not just symptoms',
      barTrack: 'bg-amber-100',
      barFrom: 'from-amber-500',
      barTo: 'to-orange-500',
      tagColor: 'text-amber-800',
    },
    {
      icon: <Eye className="h-3.5 w-3.5 text-purple-600" />,
      label: 'Emotional Candor',
      score: selfAwarenessScore,
      observation: emotionalCandorObservation || 'Zero sugarcoating; names real friction',
      barTrack: 'bg-purple-100',
      barFrom: 'from-purple-500',
      barTo: 'to-indigo-500',
      tagColor: 'text-purple-800',
    },
    {
      icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />,
      label: 'Grounded Conviction',
      score: confidenceScore,
      observation: groundedConvictionObservation || 'Quiet conviction over performative hype',
      barTrack: 'bg-emerald-100',
      barFrom: 'from-emerald-500',
      barTo: 'to-teal-500',
      tagColor: 'text-emerald-800',
    },
    {
      icon: <Crosshair className="h-3.5 w-3.5 text-rose-600" />,
      label: 'Action Readiness',
      score: followThroughIntent,
      observation: actionReadinessObservation || 'Immediate bias to resolve and build',
      barTrack: 'bg-rose-100',
      barFrom: 'from-rose-500',
      barTo: 'to-amber-500',
      tagColor: 'text-rose-800',
    },
    {
      icon: <Scale className="h-3.5 w-3.5 text-blue-600" />,
      label: 'Self-Accountability',
      score: selfAccountabilityScore,
      observation: selfAccountabilityObservation || 'Owns the outcome; zero victim narrative',
      barTrack: 'bg-blue-100',
      barFrom: 'from-blue-500',
      barTo: 'to-indigo-500',
      tagColor: 'text-blue-800',
    },
    {
      icon: <Compass className="h-3.5 w-3.5 text-teal-600" />,
      label: 'Receptive Humility',
      score: receptiveHumilityScore,
      observation: receptiveHumilityObservation || 'Eager to unlearn; low ego defensiveness',
      barTrack: 'bg-teal-100',
      barFrom: 'from-teal-500',
      barTo: 'to-emerald-500',
      tagColor: 'text-teal-800',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-3xl border border-[#d5b493]/70 bg-gradient-to-br from-[#fffaf4] via-[#fff5e8] to-[#f7ebd9] p-6 sm:p-7 shadow-[0_8px_30px_rgba(139,93,54,0.06)]"
    >
      {/* Decorative ambient glow */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-gradient-to-br from-amber-400/20 to-orange-400/0 blur-2xl" />

      {/* Top Header Label */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8d5c3] pb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b5d36]">
            <Sparkles className="h-3 w-3 text-amber-600" />
            Day-1 Cognitive Calibration
          </span>
          <span className="text-xs text-[#856347]/80">Baseline Established</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSpectrumModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-600/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-500/25 transition-colors shadow-2xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
            <span>View Resonance Aura</span>
          </button>
          <Link
            href="/onboarding/weekly-insights-demo"
            target="_blank"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-[#8b5d36] hover:text-[#704523] hover:underline"
          >
            <span>Weekly Demo</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Starting Mindstate & Presence Banner (Deeply Humanistic & Honest) */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-100/90 via-amber-50/80 to-white/70 p-4 sm:p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Observed Starting Mindstate
            </span>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#2e2012] font-[family-name:var(--font-ob-display)]">
            {startingMindstateTitle}
          </h3>
          <p className="text-xs text-[#6f4a2e]/90 leading-relaxed max-w-xl">
            {startingMindstateSnippet}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center rounded-xl bg-amber-500/15 border border-amber-500/30 px-3.5 py-2 text-xs text-amber-950 shrink-0">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <div className="text-left">
            <p className="font-bold text-[11px] leading-tight">Baseline Calibrated</p>
            <p className="text-[10px] text-amber-800/80 font-normal">Zero artificial rankings on Day 1</p>
          </div>
        </div>
      </div>

      {/* 6-Box Metric Matrix (Human Behavioral Observations) */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-[#e8d5c3] bg-white/85 p-3.5 backdrop-blur-sm transition-all hover:border-[#8b5d36] hover:shadow-sm"
          >
            <div className="flex items-center gap-1.5 text-xs text-[#8b5d36]">
              {m.icon}
              <span className="font-semibold">{m.label}</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-[#2e2012]">
              {m.score}
              <span className="text-xs font-normal text-[#856347]">/100</span>
            </p>
            <div className={`mt-1.5 h-1 w-full overflow-hidden rounded-full ${m.barTrack}`}>
              <div
                className={`h-full bg-gradient-to-r ${m.barFrom} ${m.barTo}`}
                style={{ width: `${m.score}%` }}
              />
            </div>
            <p className={`mt-2 text-[10px] font-medium leading-tight ${m.tagColor}`}>
              {m.observation}
            </p>
          </div>
        ))}
      </div>

      {/* Topics Detected from Social Profiles */}
      {topicsDetected.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-black/[0.03] px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8b5d36] mr-1">
            Detected Themes:
          </span>
          {topicsDetected.map((topic, idx) => (
            <span
              key={idx}
              className="inline-flex items-center rounded-lg border border-[#e8d5c3] bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-[#6f4a2e]"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {/* Sub-Ledger: Transparent Baseline Calibration */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-black/[0.03] border border-[#e8d5c3]/50 px-4 py-2.5 text-xs text-[#6f4a2e]">
        <span>
          Calibrated across <strong className="text-[#2e2012] font-semibold">{wordsAnalyzed.toLocaleString()} words</strong> of your answers & {signalsCount} verified public channels
        </span>
        <span className="text-[11px] text-[#856347] font-medium">
          Peer cohort percentiles unlock after Week 1
        </span>
      </div>

      {/* Day-1 Live Generative Particle Resonance Signature Card */}
      <div
        onClick={() => setShowSpectrumModal(true)}
        className="group relative mt-4 cursor-pointer overflow-hidden rounded-2xl border border-amber-300/80 bg-[#0c0806] p-4 text-[#f7eedf] shadow-md transition-all hover:border-amber-400 hover:shadow-xl"
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400">
                <Sparkles className="h-3 w-3 text-amber-400 animate-pulse" />
                Your Mindstate in Motion
              </span>
              <span className="text-[11px] text-[#a38062] font-mono">Real-Time Vector Field</span>
            </div>
            <h4 className="text-base font-bold text-white font-[family-name:var(--font-ob-display)]">
              Day-1 Cognitive Resonance Aura
            </h4>
            <p className="text-xs text-[#d4af88] leading-relaxed max-w-xl">
              A living visual portrait of your thinking cadence right now. Watch how your clarity and candor shape these particle streams.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 text-black px-3.5 py-1.5 text-xs font-bold shadow transition-all group-hover:bg-amber-400 group-hover:scale-105 shrink-0 self-start sm:self-center">
            <span>Explore Living Aura</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>

        {/* Live Background Particle Field */}
        <div className="absolute inset-0 opacity-45 group-hover:opacity-75 transition-opacity pointer-events-none">
          <CognitiveSpectrumCanvas
            stats={{
              confidence: confidenceScore,
              followThrough: followThroughIntent,
              clarity: clarityScore,
              growthVelocity: 75,
              volume: Math.min(100, Math.floor(wordsAnalyzed / 15)),
              emotionalAgility: selfAwarenessScore,
            }}
            theme="gold"
            interactive={false}
          />
        </div>
      </div>

      {/* Full-Screen Cognitive Spectrum Modal */}
      <CognitiveSpectrumModal
        isOpen={showSpectrumModal}
        onClose={() => setShowSpectrumModal(false)}
        userName="Builder"
        initialStats={{
          confidence: confidenceScore,
          followThrough: followThroughIntent,
          clarity: clarityScore,
          growthVelocity: 75,
          volume: Math.min(100, Math.floor(wordsAnalyzed / 15)),
          emotionalAgility: selfAwarenessScore,
        }}
      />
    </motion.div>
  );
};

export default DayOneBaselineCard;

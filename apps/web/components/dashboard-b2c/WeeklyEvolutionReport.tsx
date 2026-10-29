'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Mic,
  PenTool,
  Zap,
  Target,
  ShieldCheck,
  Trophy,
  Sparkles,
  ChevronRight,
  X,
  ArrowUpRight,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Layers,
  Heart,
  Share2,
  Copy,
  Check,
  CheckCheck
} from 'lucide-react';
import CognitiveSpectrumModal from './CognitiveSpectrumModal';
import CognitiveSpectrumCanvas from './CognitiveSpectrumCanvas';

export interface ParameterEvidence {
  id: string;
  label: string;
  scoreDisplay: string;
  percentileRank: string;
  whyThisScore: string;
  weekOverWeekDelta?: string;
  pillsOrTags?: string[];
  quotesOrClips: Array<{
    type: 'audio' | 'journal' | 'action';
    title: string;
    timestamp: string;
    snippet: string;
  }>;
  relatedTodosCompleted: string[];
}

export interface WeeklyEvolutionReportProps {
  userName?: string;
  weekRange?: string;
  onRunEngine?: () => void;
}

export const WeeklyEvolutionReport: React.FC<WeeklyEvolutionReportProps> = ({
  userName = 'Rohit',
  weekRange = 'Sep 26 – Oct 2, 2026',
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [selectedParam, setSelectedParam] = useState<ParameterEvidence | null | undefined>(null);
  const [activeHeroTrait, setActiveHeroTrait] = useState<'follow_through' | 'confidence' | 'growth_velocity' | 'words_spoken'>('follow_through');
  const [hasCopiedShare, setHasCopiedShare] = useState(false);
  const [showSpectrumModal, setShowSpectrumModal] = useState(false);

  // Grounded evidence map for the 10 upgraded parameters
  const evidenceData: Record<string, ParameterEvidence> = {
    words_spoken: {
      id: 'words_spoken',
      label: 'Words Spoken',
      scoreDisplay: '12,850 Words',
      percentileRank: 'Top 3% Voice Output',
      weekOverWeekDelta: '+2,150 words vs last week',
      whyThisScore: 'You recorded 5 distinct voice sessions totaling 1h 14m of audio. Average speech cadence was a measured, intentional 142 wpm with zero awkward dead-air pauses.',
      quotesOrClips: [
        {
          type: 'audio',
          title: 'Evening Debrief Session',
          timestamp: 'Oct 1, 9:20 PM',
          snippet: '3,450 words articulated across 22 minutes of continuous stream-of-consciousness architecture design.'
        },
        {
          type: 'audio',
          title: 'Sprint Planning Voice Note',
          timestamp: 'Sep 27, 8:15 AM',
          snippet: '2,890 words analyzing frontend performance friction and calendar alignment.'
        }
      ],
      relatedTodosCompleted: [
        'Transcribed 5 audio reflections to Vektori memory',
        'Auto-extracted 4 actionable tasks from voice notes'
      ]
    },
    words_written: {
      id: 'words_written',
      label: 'Words Written',
      scoreDisplay: '4,620 Words',
      percentileRank: 'Top 8% Deep Writing',
      weekOverWeekDelta: '+680 words vs last week',
      whyThisScore: 'You wrote 4 long-form reflective entries across the week with an average session length of 18 minutes, displaying structured paragraphs and clear conceptual transitions.',
      quotesOrClips: [
        {
          type: 'journal',
          title: 'Architecture Retrospective',
          timestamp: 'Sep 30, 10:15 PM',
          snippet: '1,840 words detailing system evolution, caching layers, and real-time state synchronization.'
        },
        {
          type: 'journal',
          title: 'Mid-Week Alignment Note',
          timestamp: 'Sep 28, 9:00 PM',
          snippet: '1,210 words breaking down priority tradeoffs between feature velocity and security posture.'
        }
      ],
      relatedTodosCompleted: ['Documented cognitive architecture updates']
    },
    follow_through: {
      id: 'follow_through',
      label: 'Follow-Through Rate',
      scoreDisplay: '92%',
      percentileRank: 'Top 1% on Execution',
      weekOverWeekDelta: '+8% vs last week (11 of 12 kept)',
      whyThisScore: 'You set 12 clear commitments in your morning reflections. You completed 11 of them before the week ended, maintaining an average close time of under 36 hours.',
      quotesOrClips: [
        {
          type: 'journal',
          title: 'Morning Reflection · Oct 1',
          timestamp: 'Thu, 8:45 AM',
          snippet: '"Instead of waiting on the database team, I will spin up an isolated staging branch and run the migration scripts myself today."'
        },
        {
          type: 'action',
          title: 'Commitment Completed',
          timestamp: 'Thu, 2:10 PM',
          snippet: 'Action closed: "Staging database migration & verification check" -> Status: Completed'
        },
        {
          type: 'journal',
          title: 'Weekly Alignment · Sep 29',
          timestamp: 'Tue, 9:15 PM',
          snippet: '"Blocked out calendar for deep work tomorrow morning. No notifications until noon."'
        }
      ],
      relatedTodosCompleted: [
        'Staging database migration script verified',
        'Updated Google OAuth credentials',
        'Drafted API migration checklist for team',
        'Archived legacy context model endpoints'
      ]
    },
    confidence: {
      id: 'confidence',
      label: 'Confidence Index',
      scoreDisplay: '92 / 100',
      percentileRank: 'Top 2% Vocal Conviction',
      weekOverWeekDelta: '+4 pts vs baseline',
      whyThisScore: 'Your audio recordings demonstrated steady pitch contours with variance under 5.8%, zero filler hesitations ("um", "maybe", "sorry"), and assertive declarative phrasing.',
      quotesOrClips: [
        {
          type: 'audio',
          title: 'Voice Journal Note #04',
          timestamp: 'Wed, 7:30 PM (Duration: 3m 42s)',
          snippet: '"We are shipping this version on Monday. The architecture is sound, latency is under 120ms, and we have zero regressions."'
        },
        {
          type: 'journal',
          title: 'Technical Review · Sep 28',
          timestamp: 'Mon, 11:15 AM',
          snippet: '"I decided not to compromise on the security model. It was the right call and the team fully aligned."'
        }
      ],
      relatedTodosCompleted: [
        'Locked V2 Onboarding architecture spec',
        'Confirmed release roadmap with team'
      ]
    },
    clarity: {
      id: 'clarity',
      label: 'Clarity of Thought',
      scoreDisplay: '95 / 100',
      percentileRank: 'Top 4% Structured Logic',
      weekOverWeekDelta: '+6 pts vs last week',
      whyThisScore: 'Your reflections bridged 6 distinct conceptual domains (distributed state, user psychology, latency friction, security protocols) with rigorous cause-and-effect reasoning.',
      quotesOrClips: [
        {
          type: 'journal',
          title: 'Cognitive Architecture Synthesis',
          timestamp: 'Oct 1, 4:00 PM',
          snippet: '"The friction isn\'t user cognitive load; it\'s asynchronous state divergence between optimistic UI and background ingestion."'
        }
      ],
      relatedTodosCompleted: ['Optimized state reconciliation pipeline']
    },
    decisiveness: {
      id: 'decisiveness',
      label: 'Decisiveness',
      scoreDisplay: '89 / 100',
      percentileRank: 'Top 6% Execution Speed',
      weekOverWeekDelta: '+3 pts vs last week',
      whyThisScore: 'You made 3 high-stakes architectural decisions within an average of 3.8 hours from first identifying the bottleneck, avoiding decision paralysis.',
      quotesOrClips: [
        {
          type: 'journal',
          title: 'Decision Log · Sep 29',
          timestamp: 'Tue, 1:45 PM',
          snippet: '"We are cutting the third-party dependency. We will write our own lightweight client to avoid vendor lock-in."'
        }
      ],
      relatedTodosCompleted: ['Deprecated obsolete SDK client']
    },
    emotional_range: {
      id: 'emotional_range',
      label: 'Emotional Range',
      scoreDisplay: '5 States',
      percentileRank: 'High Emotional Agility',
      weekOverWeekDelta: 'Full recovery from mid-week strain',
      pillsOrTags: ['Determined', 'Focused', 'Reflective', 'Strained', 'Calibrated'],
      whyThisScore: 'You did not suppress or deny stress during Wednesday’s deployment bottleneck; you logged it honestly, recalibrated, and regained grounded calm within 24 hours.',
      quotesOrClips: [
        {
          type: 'audio',
          title: 'Post-Mortem Audio Note',
          timestamp: 'Sep 30, 4:10 PM',
          snippet: '"The deploy failed, but all data is safe in Supabase backups. No need to panic; we will roll back systematically."'
        },
        {
          type: 'journal',
          title: 'Evening Grounding Reflection',
          timestamp: 'Sep 30, 10:30 PM',
          snippet: '"Breathing deeply. The rollback worked. Ready to restart fresh tomorrow."'
        }
      ],
      relatedTodosCompleted: ['Executed automated rollback checklist']
    },
    streak: {
      id: 'streak',
      label: 'Consistency Streak',
      scoreDisplay: '7 Days',
      percentileRank: '100% Attendance',
      weekOverWeekDelta: 'Uninterrupted 7/7 days logged',
      whyThisScore: 'You maintained uninterrupted daily check-ins every single morning and evening throughout the entire 7-day evaluation window.',
      quotesOrClips: [
        {
          type: 'journal',
          title: 'Daily Streak Record',
          timestamp: 'Sep 26 – Oct 2',
          snippet: '7 consecutive days logged with both morning intention setting and evening synthesis.'
        }
      ],
      relatedTodosCompleted: ['Achieved 7-day milestone badge']
    },
    growth_velocity: {
      id: 'growth_velocity',
      label: 'Growth Velocity',
      scoreDisplay: '+14% WoW',
      percentileRank: 'Peak Acceleration',
      weekOverWeekDelta: '+14% overall output velocity',
      whyThisScore: 'Across written depth (+17%), completed actions (+12%), and vocal clarity (+8%), your overall weekly momentum outpaced 96% of active users on FORCE.',
      quotesOrClips: [
        {
          type: 'action',
          title: 'Weekly Trajectory Index',
          timestamp: 'Oct 2, 6:00 PM',
          snippet: 'Overall cognitive volume rose from 14,200 equivalent tokens last week to 16,840 this week.'
        }
      ],
      relatedTodosCompleted: ['Surpassed 4 personal weekly records']
    },
    topics_explored: {
      id: 'topics_explored',
      label: 'Topics Explored',
      scoreDisplay: '8 Domains',
      percentileRank: 'Polymath Breadth',
      weekOverWeekDelta: '+2 new domains vs last week',
      pillsOrTags: ['Architecture', 'Product Strategy', 'Team Dynamics', 'Security', 'Cognition', 'API Design'],
      whyThisScore: 'You traversed 8 core knowledge domains this week, actively linking low-level database constraints to high-level product UX.',
      quotesOrClips: [
        {
          type: 'journal',
          title: 'Cross-Domain Synthesis Note',
          timestamp: 'Sep 29, 2:00 PM',
          snippet: '"Connecting OAuth token lifetimes directly to user onboarding completion drop-offs."'
        }
      ],
      relatedTodosCompleted: ['Mapped cross-functional feature dependencies']
    }
  };

  const handleSimulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 1200);
  };

  const handleShareReport = () => {
    const shareText = `🚀 FORCE Weekly Cognitive Evolution Report (${weekRange})\n\n🏆 Hero Trait: Top 1% in Follow-Through (11/12 commitments kept)\n🎙️ Words Spoken: 12,850 (Top 3% Voice Output)\n✍️ Words Written: 4,620\n⚡ Growth Velocity: +14% Week-over-Week\n🔥 Consistency Streak: 7 Days (100% Attendance)\n\nTracked automatically via FORCE Cognition Engine.`;
    
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(shareText);
      setHasCopiedShare(true);
      setTimeout(() => setHasCopiedShare(false), 2600);
    }
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto space-y-6 text-[#2e2012] font-[family-name:var(--font-ob-body)]">
      {/* ── Top Ambient Resonance Bar ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-[#d5b493]/70 bg-gradient-to-r from-[#fffaf4] via-[#fff4e6] to-[#fbf0e1] p-5 sm:p-6 shadow-sm">
        {/* Glow orb */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-amber-400/25 to-orange-400/5 blur-2xl" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b5d36]">
                <Activity className="h-3 w-3 text-amber-600 animate-pulse" />
                Resonance Core · Live
              </span>
              <span className="text-xs text-[#856347] font-medium">{weekRange}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#2e2012] font-[family-name:var(--font-ob-display)]">
              Weekly Cognitive Evolution
            </h1>
            <p className="text-xs text-[#6f4a2e]/80">
              Evaluated across your journals, voice recordings, and completed actions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Spectrum Modal Button */}
            <button
              onClick={() => setShowSpectrumModal(true)}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 px-3.5 py-2.5 text-xs font-semibold text-amber-950 shadow-xs transition-all hover:bg-amber-500/25 active:scale-95"
            >
              <Sparkles className="h-4 w-4 text-amber-600 animate-pulse" />
              <span>Cognitive Spectrum</span>
            </button>

            {/* Share Report Button */}
            <button
              onClick={handleShareReport}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-[#d5b493] bg-white/90 px-3.5 py-2.5 text-xs font-semibold text-[#8b5d36] shadow-xs transition-all hover:bg-white active:scale-95"
            >
              {hasCopiedShare ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="text-emerald-700">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 text-[#8b5d36]" />
                  <span>Share Report</span>
                </>
              )}
            </button>

            {/* Run Weekly Scan Button */}
            <button
              onClick={handleSimulateScan}
              disabled={isScanning}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#8b5d36] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#744b29] active:scale-95 disabled:opacity-60"
            >
              {isScanning ? (
                <>
                  <Sparkles className="h-4 w-4 animate-spin" />
                  <span>Scanning footprint...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 text-amber-300" />
                  <span>Run Weekly Scan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Demo Trait Selector Pill (Lets user test different top scores) */}
        <div className="mt-4 pt-3 border-t border-[#e8d5c3]/80 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-semibold text-[#8b5d36]">Simulate Hero Trait:</span>
          <button
            onClick={() => setActiveHeroTrait('follow_through')}
            className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
              activeHeroTrait === 'follow_through'
                ? 'bg-[#8b5d36] text-white shadow-xs'
                : 'bg-white/80 text-[#6f4a2e] hover:bg-white'
            }`}
          >
            Top 1% Follow-Through
          </button>
          <button
            onClick={() => setActiveHeroTrait('confidence')}
            className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
              activeHeroTrait === 'confidence'
                ? 'bg-[#8b5d36] text-white shadow-xs'
                : 'bg-white/80 text-[#6f4a2e] hover:bg-white'
            }`}
          >
            Top 1% Confidence
          </button>
          <button
            onClick={() => setActiveHeroTrait('growth_velocity')}
            className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
              activeHeroTrait === 'growth_velocity'
                ? 'bg-[#8b5d36] text-white shadow-xs'
                : 'bg-white/80 text-[#6f4a2e] hover:bg-white'
            }`}
          >
            +14% Growth Velocity
          </button>
          <button
            onClick={() => setActiveHeroTrait('words_spoken')}
            className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
              activeHeroTrait === 'words_spoken'
                ? 'bg-[#8b5d36] text-white shadow-xs'
                : 'bg-white/80 text-[#6f4a2e] hover:bg-white'
            }`}
          >
            Top 3% Voice Volume
          </button>
        </div>
      </div>

      {/* ── Hero Spotlight Trophy Card (Best Performing Metric) ─────────────── */}
      <motion.div
        key={activeHeroTrait}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-3xl border-2 border-amber-400/90 bg-gradient-to-br from-amber-500/10 via-[#fff8ee] to-[#faedd8] p-6 sm:p-8 shadow-[0_12px_40px_rgba(217,119,6,0.12)]"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 text-white px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-sm">
                <Trophy className="h-3.5 w-3.5 fill-white" />
                Hero Spotlight of the Week
              </span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                Beat 99% of Builders
              </span>
            </div>

            {activeHeroTrait === 'follow_through' && (
              <>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#2e2012] font-[family-name:var(--font-ob-display)]">
                  Top 1% in Follow-Through This Week
                </h2>
                <p className="text-sm sm:text-base text-[#6f4a2e] leading-relaxed max-w-2xl">
                  &ldquo;Wohh {userName}, you are in the top 1% of builders on execution discipline! You set 12 clear commitments across your reflections and closed 11 before Friday without hesitation.&rdquo;
                </p>
              </>
            )}

            {activeHeroTrait === 'confidence' && (
              <>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#2e2012] font-[family-name:var(--font-ob-display)]">
                  Top 1% in Vocal Confidence This Week
                </h2>
                <p className="text-sm sm:text-base text-[#6f4a2e] leading-relaxed max-w-2xl">
                  &ldquo;Wohh {userName}, your voice showed peak conviction. Zero second-guessing or hesitation pauses in your audio reflections. High steady pitch contour throughout.&rdquo;
                </p>
              </>
            )}

            {activeHeroTrait === 'growth_velocity' && (
              <>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#2e2012] font-[family-name:var(--font-ob-display)]">
                  +14% Growth Velocity This Week
                </h2>
                <p className="text-sm sm:text-base text-[#6f4a2e] leading-relaxed max-w-2xl">
                  &ldquo;Wohh {userName}, your weekly evolution accelerated at breakneck speed. Deep writing expanded by 17%, closed todos rose by 12%, and cognitive breadth reached 8 active domains.&rdquo;
                </p>
              </>
            )}

            {activeHeroTrait === 'words_spoken' && (
              <>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#2e2012] font-[family-name:var(--font-ob-display)]">
                  Top 1% in Verbal Reflection Volume
                </h2>
                <p className="text-sm sm:text-base text-[#6f4a2e] leading-relaxed max-w-2xl">
                  &ldquo;Wohh {userName}, you articulated over 12,850 spoken words across 5 voice notes. Your thoughts were crystal clear and paced at a deliberate 142 words per minute.&rdquo;
                </p>
              </>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                onClick={() => setSelectedParam(evidenceData[activeHeroTrait])}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-900 text-amber-50 px-4 py-2 text-xs font-semibold shadow hover:bg-black transition-all"
              >
                <span>Inspect Evidence & Grounded Notes</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowSpectrumModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-600/40 bg-white/95 text-amber-900 px-3.5 py-2 text-xs font-semibold shadow-xs hover:bg-white hover:border-amber-600 transition-all"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                <span>View Particle Resonance</span>
              </button>
              <span className="text-xs text-[#856347] font-medium hidden sm:inline">
                Verified from 4 journal entries & 11 completed todos
              </span>
            </div>
          </div>

          {/* Right Trophy Badge Graphic */}
          <div className="flex flex-col items-center justify-center self-center shrink-0 rounded-2xl border border-amber-300 bg-white/90 p-5 shadow-xs text-center min-w-[150px]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white shadow-md">
              <Trophy className="h-8 w-8" />
            </div>
            <span className="mt-3 text-2xl font-black text-[#2e2012]">
              {activeHeroTrait === 'growth_velocity' ? '+14%' : 'TOP 1%'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              {activeHeroTrait === 'follow_through'
                ? 'Follow-Through'
                : activeHeroTrait === 'confidence'
                ? 'Conviction Index'
                : activeHeroTrait === 'growth_velocity'
                ? 'Growth Velocity'
                : 'Volume Output'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Generative Particle Spectrum Teaser Card ─────────────────────── */}
      <div
        onClick={() => setShowSpectrumModal(true)}
        className="group relative cursor-pointer overflow-hidden rounded-3xl border border-[#3d2919] bg-[#0c0806] p-5 sm:p-6 shadow-xl transition-all hover:border-amber-500/70 hover:shadow-[0_10px_35px_rgba(245,158,11,0.15)]"
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400">
                <Sparkles className="h-3 w-3 text-amber-400 animate-pulse" />
                Generative Resonance Aura
              </span>
              <span className="text-xs text-white/50 font-mono">Live Noise Field</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white font-[family-name:var(--font-ob-display)]">
              Your Personal Cognitive Flow Spectrum
            </h3>
            <p className="text-xs text-[#a38062] max-w-xl">
              A mathematical vector field driven by your voice pitch stability, journal depth, and task completion. Click to launch interactive full-screen modulation.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 text-black px-4 py-2 text-xs font-bold shadow-md transition-all group-hover:bg-amber-400 group-hover:scale-105">
              <span>Expand Vector Field</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {/* Live Mini Background Canvas */}
        <div className="absolute inset-0 opacity-40 group-hover:opacity-75 transition-opacity pointer-events-none">
          <CognitiveSpectrumCanvas
            stats={{
              confidence: 92,
              followThrough: 92,
              clarity: 95,
              growthVelocity: 88,
              volume: 75,
              emotionalAgility: 80,
            }}
            theme="gold"
            interactive={false}
          />
        </div>
      </div>

      {/* ── 10 Realistic Parameters Grid (Interactive & Materialistic) ─────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-lg font-bold text-[#2e2012]">
              Complete Weekly Metric Ledger
            </h3>
            <p className="text-xs text-[#6f4a2e]/80">
              Click any metric card below to review the exact grounded quotes, audio clips, and completed actions.
            </p>
          </div>
          <span className="text-xs text-[#8b5d36] font-semibold">10 Verified Parameters</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* 1. Words Spoken */}
          <div
            onClick={() => setSelectedParam(evidenceData.words_spoken)}
            className="cursor-pointer group rounded-2xl border border-[#e8d5c3] bg-white/80 p-4 transition-all hover:border-[#8b5d36] hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b5d36]">
                <Mic className="h-3.5 w-3.5 text-amber-600" />
                Spoken
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#a88262] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-2 text-xl font-bold text-[#2e2012]">12,850</p>
            <p className="text-[10px] font-semibold text-emerald-600">Top 3% Voice Volume</p>
            <span className="mt-1 block text-[10px] text-[#856347]">5 audio sessions</span>
          </div>

          {/* 2. Words Written */}
          <div
            onClick={() => setSelectedParam(evidenceData.words_written)}
            className="cursor-pointer group rounded-2xl border border-[#e8d5c3] bg-white/80 p-4 transition-all hover:border-[#8b5d36] hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b5d36]">
                <PenTool className="h-3.5 w-3.5 text-orange-600" />
                Written
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#a88262] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-2 text-xl font-bold text-[#2e2012]">4,620</p>
            <p className="text-[10px] font-semibold text-[#8b5d36]">Top 8% Deep Writing</p>
            <span className="mt-1 block text-[10px] text-[#856347]">4 reflections</span>
          </div>

          {/* 3. Follow-Through Rate (replaces Proactive Score) */}
          <div
            onClick={() => setSelectedParam(evidenceData.follow_through)}
            className="cursor-pointer group rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-4 transition-all hover:border-[#8b5d36] hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <CheckCheck className="h-3.5 w-3.5 text-amber-600" />
                Follow-Through
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-2 text-xl font-bold text-[#2e2012]">92%</p>
            <p className="text-[10px] font-bold text-emerald-700">Top 1% on Execution</p>
            <span className="mt-1 block text-[10px] text-amber-900 font-medium">11 of 12 kept</span>
          </div>

          {/* 4. Confidence Index */}
          <div
            onClick={() => setSelectedParam(evidenceData.confidence)}
            className="cursor-pointer group rounded-2xl border border-[#e8d5c3] bg-white/80 p-4 transition-all hover:border-[#8b5d36] hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b5d36]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Confidence
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#a88262] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-2 text-xl font-bold text-[#2e2012]">92<span className="text-xs font-normal text-muted-foreground">/100</span></p>
            <p className="text-[10px] font-semibold text-emerald-600">Top 2% Conviction</p>
            <span className="mt-1 block text-[10px] text-[#856347]">Steady vocal pitch</span>
          </div>

          {/* 5. Clarity of Thought (replaces Mental Sharpness) */}
          <div
            onClick={() => setSelectedParam(evidenceData.clarity)}
            className="cursor-pointer group rounded-2xl border border-[#e8d5c3] bg-white/80 p-4 transition-all hover:border-[#8b5d36] hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b5d36]">
                <Lightbulb className="h-3.5 w-3.5 text-purple-600" />
                Clarity
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#a88262] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-2 text-xl font-bold text-[#2e2012]">95<span className="text-xs font-normal text-muted-foreground">/100</span></p>
            <p className="text-[10px] font-semibold text-purple-700">Top 4% Structured Logic</p>
            <span className="mt-1 block text-[10px] text-[#856347]">6 concepts linked</span>
          </div>

          {/* 6. Decisiveness */}
          <div
            onClick={() => setSelectedParam(evidenceData.decisiveness)}
            className="cursor-pointer group rounded-2xl border border-[#e8d5c3] bg-white/80 p-4 transition-all hover:border-[#8b5d36] hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b5d36]">
                <Target className="h-3.5 w-3.5 text-rose-600" />
                Decisive
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#a88262] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-2 text-xl font-bold text-[#2e2012]">89<span className="text-xs font-normal text-muted-foreground">/100</span></p>
            <p className="text-[10px] font-semibold text-rose-700">Top 6% Execution</p>
            <span className="mt-1 block text-[10px] text-[#856347]">3 hard calls made</span>
          </div>

          {/* 7. Emotional Range (replaces Calm) */}
          <div
            onClick={() => setSelectedParam(evidenceData.emotional_range)}
            className="cursor-pointer group rounded-2xl border border-[#e8d5c3] bg-white/80 p-4 transition-all hover:border-[#8b5d36] hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b5d36]">
                <Heart className="h-3.5 w-3.5 text-pink-600" />
                Emotions
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#a88262] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-2 text-xl font-bold text-[#2e2012]">5 States</p>
            <p className="text-[10px] font-semibold text-pink-700">High Agility</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="rounded bg-pink-50 px-1 text-[9px] font-medium text-pink-700">Focused</span>
              <span className="rounded bg-pink-50 px-1 text-[9px] font-medium text-pink-700">Calibrated</span>
            </div>
          </div>

          {/* 8. Consistency Streak */}
          <div
            onClick={() => setSelectedParam(evidenceData.streak)}
            className="cursor-pointer group rounded-2xl border border-[#e8d5c3] bg-white/80 p-4 transition-all hover:border-[#8b5d36] hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b5d36]">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                Streak
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#a88262] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-2 text-xl font-bold text-orange-600">7 Days</p>
            <p className="text-[10px] font-semibold text-emerald-600">100% Attendance</p>
            <span className="mt-1 block text-[10px] text-[#856347]">Morning & evening</span>
          </div>

          {/* 9. Growth Velocity (replaces Energy) */}
          <div
            onClick={() => setSelectedParam(evidenceData.growth_velocity)}
            className="cursor-pointer group rounded-2xl border border-[#e8d5c3] bg-white/80 p-4 transition-all hover:border-[#8b5d36] hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b5d36]">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                Velocity
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#a88262] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <p className="text-xl font-bold text-emerald-700">+14%</p>
              <span className="text-[10px] font-semibold text-emerald-600">WoW</span>
            </div>
            <p className="text-[10px] font-semibold text-emerald-600">Peak Acceleration</p>
            <span className="mt-1 block text-[10px] text-[#856347]">Outpacing 96%</span>
          </div>

          {/* 10. Topics Explored (replaces Deep Focus Time) */}
          <div
            onClick={() => setSelectedParam(evidenceData.topics_explored)}
            className="cursor-pointer group rounded-2xl border border-[#e8d5c3] bg-white/80 p-4 transition-all hover:border-[#8b5d36] hover:shadow-md hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b5d36]">
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                Topics
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-[#a88262] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="mt-2 text-xl font-bold text-[#2e2012]">8 Domains</p>
            <p className="text-[10px] font-semibold text-indigo-600">Polymath Breadth</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="rounded bg-indigo-50 px-1 text-[9px] font-medium text-indigo-700">Arch</span>
              <span className="rounded bg-indigo-50 px-1 text-[9px] font-medium text-indigo-700">Security</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Reality Check & Honest Coaching ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* The Reality Mirror */}
        <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-50/70 to-white/90 p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>The Reality Mirror · Blindspot Caught</span>
          </div>
          <p className="mt-2 text-sm text-[#4e341f] leading-relaxed">
            You crushed execution early in the week, but on Wednesday night your follow-through pace dipped due to back-to-back meeting fatigue. You mentioned feeling drained twice without creating a calendar protection task.
          </p>
        </div>

        {/* Next Week's 1 High-Leverage Directive */}
        <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-white/90 p-5">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-wider">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Next Week&apos;s High-Leverage Focus</span>
          </div>
          <p className="mt-2 text-sm text-[#1e3b2b] leading-relaxed">
            Protect your 9:00 AM to 11:30 AM creative block. Do not open email or team messaging until you complete your morning voice reflection. Repeat Friday&apos;s deep work pacing.
          </p>
        </div>
      </div>

      {/* ── Detailed Evidence Drawer Modal ───────────────────────────────────── */}
      <AnimatePresence>
        {selectedParam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-[#d5b493] bg-[#fffaf4] p-6 sm:p-7 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#e8d5c3] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-[#8b5d36]">
                    <Sparkles className="h-5 w-5 text-amber-700" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#2e2012]">
                      {selectedParam.label} · Grounded Evidence
                    </h3>
                    <p className="text-xs text-[#856347]">
                      {selectedParam.scoreDisplay} &bull; {selectedParam.percentileRank}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedParam(null)}
                  className="rounded-full p-2 text-[#856347] hover:bg-black/5 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Delta comparison badge */}
              {selectedParam.weekOverWeekDelta && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100/80 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    <TrendingUp className="h-3 w-3 text-emerald-700" />
                    {selectedParam.weekOverWeekDelta}
                  </span>
                </div>
              )}

              {/* Tags / Pills if present */}
              {selectedParam.pillsOrTags && selectedParam.pillsOrTags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedParam.pillsOrTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="rounded-lg bg-amber-100/70 border border-amber-300/60 px-2 py-0.5 text-xs font-semibold text-amber-900"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Rationale explanation */}
              <div className="mt-4 rounded-2xl bg-amber-500/10 p-4 border border-amber-500/20">
                <p className="text-xs font-bold uppercase tracking-wider text-[#8b5d36]">
                  Why Force Concluded This:
                </p>
                <p className="mt-1 text-sm text-[#3b2413] leading-relaxed">
                  {selectedParam.whyThisScore}
                </p>
              </div>

              {/* Exact Snippets / Audio Recordings */}
              <div className="mt-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#856347]">
                  Source Snippets & Audio Transcripts:
                </p>
                {selectedParam.quotesOrClips.map((q, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-[#e8d5c3] bg-white p-3.5 space-y-1.5 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-xs text-[#856347]">
                      <span className="font-semibold text-[#8b5d36]">
                        {q.type === 'audio' ? '🎙️ ' : q.type === 'action' ? '🎯 ' : '✍️ '}
                        {q.title}
                      </span>
                      <span>{q.timestamp}</span>
                    </div>
                    <p className="text-xs text-[#2e2012] italic leading-relaxed">
                      {q.snippet}
                    </p>
                  </div>
                ))}
              </div>

              {/* Related Completed Actions */}
              {selectedParam.relatedTodosCompleted.length > 0 && (
                <div className="mt-5 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#856347]">
                    Connected Completed Actions:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedParam.relatedTodosCompleted.map((todo, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200/80 px-3 py-2 text-xs text-emerald-900"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-medium truncate">{todo}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedParam(null)}
                  className="rounded-xl bg-[#8b5d36] px-5 py-2 text-xs font-semibold text-white hover:bg-[#744b29] transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Cognitive Resonance Spectrum Modal ────────────────────────────── */}
      <CognitiveSpectrumModal
        isOpen={showSpectrumModal}
        onClose={() => setShowSpectrumModal(false)}
        userName={userName}
        initialStats={{
          confidence: 92,
          followThrough: 92,
          clarity: 95,
          growthVelocity: 88,
          volume: 85,
          emotionalAgility: 80,
        }}
      />
    </div>
  );
};

export default WeeklyEvolutionReport;

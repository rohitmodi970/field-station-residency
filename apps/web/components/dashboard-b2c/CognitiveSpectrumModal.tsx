'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  Sliders,
  Download,
  Share2,
  RefreshCw,
  Eye,
  Activity,
  Check,
  Zap,
  ShieldCheck,
  Target,
  Lightbulb,
  Heart,
  BookOpen
} from 'lucide-react';
import CognitiveSpectrumCanvas, {
  CognitiveStats,
  ColorTheme
} from './CognitiveSpectrumCanvas';

export interface CognitiveSpectrumModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  initialStats?: Partial<CognitiveStats>;
}

export const CognitiveSpectrumModal: React.FC<CognitiveSpectrumModalProps> = ({
  isOpen,
  onClose,
  userName = 'Rohit',
  initialStats,
}) => {
  // Baseline stats representing Rohit's top scores
  const defaultBaseline: CognitiveStats = {
    confidence: initialStats?.confidence ?? 92,
    followThrough: initialStats?.followThrough ?? 92,
    clarity: initialStats?.clarity ?? 95,
    growthVelocity: initialStats?.growthVelocity ?? 88,
    volume: initialStats?.volume ?? 85,
    emotionalAgility: initialStats?.emotionalAgility ?? 80,
  };

  const [stats, setStats] = useState<CognitiveStats>(defaultBaseline);
  const [theme, setTheme] = useState<ColorTheme>('gold');
  const [activePreset, setActivePreset] = useState<'weekly' | 'confidence' | 'execution' | 'agility'>('weekly');
  const [showSliders, setShowSliders] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);

  // Preset switchers
  const applyPreset = (preset: 'weekly' | 'confidence' | 'execution' | 'agility') => {
    setActivePreset(preset);
    if (preset === 'weekly') {
      setStats(defaultBaseline);
      setTheme('gold');
    } else if (preset === 'confidence') {
      setStats({
        confidence: 98,
        followThrough: 75,
        clarity: 96,
        growthVelocity: 70,
        volume: 80,
        emotionalAgility: 50,
      });
      setTheme('gold');
    } else if (preset === 'execution') {
      setStats({
        confidence: 85,
        followThrough: 99,
        clarity: 82,
        growthVelocity: 94,
        volume: 95,
        emotionalAgility: 60,
      });
      setTheme('neural');
    } else if (preset === 'agility') {
      setStats({
        confidence: 80,
        followThrough: 70,
        clarity: 88,
        growthVelocity: 85,
        volume: 85,
        emotionalAgility: 98,
      });
      setTheme('amethyst');
    }
  };

  // Export high-resolution PNG snapshot of the canvas
  const handleExportSnapshot = () => {
    if (!canvasElementRef.current) return;
    setIsExporting(true);

    try {
      const dataUrl = canvasElementRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `FORCE_Cognitive_Spectrum_${userName}_${activePreset}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Failed to export canvas snapshot', e);
    } finally {
      setTimeout(() => setIsExporting(false), 800);
    }
  };

  const handleShareSummary = () => {
    const text = `🌌 FORCE Cognitive Spectrum: ${userName}'s Neural Flow Signature\n\n• Flow Coherence: ${stats.confidence}% (Vocal Conviction)\n• Execution Pull: ${stats.followThrough}% (Follow-Through Rate)\n• Harmonic Clarity: ${stats.clarity}%\n• Kinetic Velocity: ${stats.growthVelocity}%\n\nGenerated via FORCE Generative Vector Field.`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2400);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-5xl h-[92vh] max-h-[860px] flex flex-col rounded-3xl border border-[#4a3422] bg-[#0c0806] text-[#f7eedf] shadow-[0_25px_80px_rgba(0,0,0,0.8)] overflow-hidden"
        >
          {/* ── Top Header Bar ────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-[#2b1c12] bg-[#120d09]/90 z-20">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Sparkles className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold tracking-tight text-white font-[family-name:var(--font-ob-display)]">
                    Cognitive Resonance Spectrum
                  </h2>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    <Activity className="h-2.5 w-2.5 animate-pulse" />
                    Live Curl Flow Field
                  </span>
                </div>
                <p className="text-xs text-[#a38062]">
                  Mathematical particle field generated from your weekly voice notes, reflections, and completed actions.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGuide(!showGuide)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showGuide
                    ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                    : 'border-[#3b2718] bg-[#1a120c] text-[#d4af88] hover:bg-[#251a12]'
                }`}
                title="Spectrum Behavior Anatomy"
              >
                <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                <span>How It Morphs</span>
              </button>

              <button
                onClick={handleShareSummary}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-[#3b2718] bg-[#1a120c] px-3 py-1.5 text-xs font-semibold text-[#d4af88] hover:bg-[#251a12] transition-colors"
                title="Copy Spectrum Summary"
              >
                {hasCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Share</span>
                  </>
                )}
              </button>

              <button
                onClick={handleExportSnapshot}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors"
                title="Download High-Res PNG"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Save Image</span>
              </button>

              <button
                onClick={onClose}
                className="rounded-full p-2 text-[#a38062] hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ── Main Canvas Viewport ────────────────────────────────────────── */}
          <div className="relative flex-1 w-full overflow-hidden bg-[#070503]">
            {/* The Live Particle Canvas */}
            <CognitiveSpectrumCanvas
              stats={stats}
              theme={theme}
              interactive={true}
              onCanvasReady={(c) => {
                canvasElementRef.current = c;
              }}
              className="absolute inset-0"
            />

            {/* Subtle Vignette Overlay */}
            <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />

            {/* ── Slide-Over Anatomy Guide Drawer ─────────────────────────── */}
            <AnimatePresence>
              {showGuide && (
                <motion.div
                  initial={{ x: '100%', opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '100%', opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-0 right-0 bottom-0 w-full sm:w-96 z-30 bg-[#100b08]/95 border-l border-[#3a2618] p-5 sm:p-6 overflow-y-auto backdrop-blur-xl shadow-2xl space-y-4 text-xs"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider font-[family-name:var(--font-ob-display)]">
                        Spectrum Anatomy & Physics
                      </h4>
                    </div>
                    <button
                      onClick={() => setShowGuide(false)}
                      className="p-1 text-[#a38062] hover:text-white rounded-lg hover:bg-white/5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-[#a38062] leading-relaxed">
                    This vector field is not a pre-rendered loop — each physical particle rule directly mirrors your cognitive footprint:
                  </p>

                  <div className="space-y-3 pt-1">
                    {/* 1. Cloud Density */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1">
                      <div className="flex items-center justify-between text-white font-semibold">
                        <span>1. Particle Density & Cloud Depth</span>
                        <span className="text-amber-400 font-mono">Volume</span>
                      </div>
                      <p className="text-[#c59d7b] leading-relaxed">
                        <strong>Behavior:</strong> Scales active nodes up to 3,500. When you write long-form journals (e.g. 4,620 words) or record lengthy voice debriefs, the cloud becomes dense, layered, and deep. Sparser reflection leaves wispy, minimal filaments.
                      </p>
                    </div>

                    {/* 2. Coherence vs Turbulence */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1">
                      <div className="flex items-center justify-between text-white font-semibold">
                        <span>2. Stream Coherence vs Turbulence</span>
                        <span className="text-amber-400 font-mono">Confidence</span>
                      </div>
                      <p className="text-[#c59d7b] leading-relaxed">
                        <strong>Behavior:</strong> Inferred from vocal pitch stability & lack of filler hesitation. High conviction locks particles into sleek, parallel, laminar ribbon bands moving with purpose. If hesitation pauses occur, the vectors splinter into swirling chaotic eddies.
                      </p>
                    </div>

                    {/* 3. Gravitational Orbital Pull */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1">
                      <div className="flex items-center justify-between text-white font-semibold">
                        <span>3. Gravitational Core Pull</span>
                        <span className="text-amber-400 font-mono">Follow-Through</span>
                      </div>
                      <p className="text-[#c59d7b] leading-relaxed">
                        <strong>Behavior:</strong> When you complete your commitments (e.g. 11 of 12 kept), a central gravitational attractor activates, pulling wandering particles into structured, crystalline orbits. If commitments are dropped, the attractor weakens and particles drift unanchored into the void.
                      </p>
                    </div>

                    {/* 4. Forward Drift & Kinetic Velocity */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1">
                      <div className="flex items-center justify-between text-white font-semibold">
                        <span>4. Kinetic Velocity & Forward Drift</span>
                        <span className="text-amber-400 font-mono">Growth Velocity</span>
                      </div>
                      <p className="text-[#c59d7b] leading-relaxed">
                        <strong>Behavior:</strong> High week-over-week acceleration (+14% WoW) propels particles forward at high speed with glowing luminous trails. When maintaining a slow, contemplative plateau, the drift slows to a calm, breathing cadence.
                      </p>
                    </div>

                    {/* 5. Harmonic Waves & Chromatic Shifts */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-1">
                      <div className="flex items-center justify-between text-white font-semibold">
                        <span>5. Harmonic Waves & Color Shifts</span>
                        <span className="text-amber-400 font-mono">Emotional Agility</span>
                      </div>
                      <p className="text-[#c59d7b] leading-relaxed">
                        <strong>Behavior:</strong> Navigating diverse emotions without denial creates undulating harmonic wave pulses and shifts the color spectrum from warm gold into bioluminescent cyan and amethyst resonances.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Top HUD Overlay Info */}
            <div className="pointer-events-none absolute top-4 left-4 z-10 flex flex-col gap-1.5 text-xs font-mono text-[#a38062]">
              <div className="inline-flex items-center gap-2 rounded-lg bg-black/60 border border-white/10 px-2.5 py-1 backdrop-blur-md">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                <span className="text-white/90">Coherence: <strong className="text-amber-400">{stats.confidence}%</strong></span>
                <span className="text-white/30">&bull;</span>
                <span className="text-white/90">Pull: <strong className="text-amber-400">{stats.followThrough}%</strong></span>
              </div>
              <p className="text-[10px] text-[#876548] pl-1">
                Touch or move cursor to sculpt particle streams
              </p>
            </div>

            {/* Bottom Floating Preset Selector */}
            <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-auto">
              {/* Presets Chips */}
              <div className="flex flex-wrap items-center gap-1.5 bg-black/70 border border-white/15 p-1.5 rounded-2xl backdrop-blur-xl">
                <button
                  onClick={() => applyPreset('weekly')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    activePreset === 'weekly'
                      ? 'bg-amber-500 text-black font-semibold shadow-md'
                      : 'text-[#d4af88] hover:bg-white/10'
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Rohit&apos;s Weekly Baseline</span>
                </button>
                <button
                  onClick={() => applyPreset('confidence')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    activePreset === 'confidence'
                      ? 'bg-amber-500 text-black font-semibold shadow-md'
                      : 'text-[#d4af88] hover:bg-white/10'
                  }`}
                >
                  <ShieldCheck className="h-3 w-3" />
                  <span>Vocal Conviction</span>
                </button>
                <button
                  onClick={() => applyPreset('execution')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    activePreset === 'execution'
                      ? 'bg-amber-500 text-black font-semibold shadow-md'
                      : 'text-[#d4af88] hover:bg-white/10'
                  }`}
                >
                  <Target className="h-3 w-3" />
                  <span>Orbital Execution</span>
                </button>
                <button
                  onClick={() => applyPreset('agility')}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                    activePreset === 'agility'
                      ? 'bg-amber-500 text-black font-semibold shadow-md'
                      : 'text-[#d4af88] hover:bg-white/10'
                  }`}
                >
                  <Heart className="h-3 w-3" />
                  <span>Emotional Pulse</span>
                </button>
              </div>

              {/* Theme Palette & Manual Sliders Toggle */}
              <div className="flex items-center gap-2 bg-black/70 border border-white/15 p-1.5 rounded-2xl backdrop-blur-xl">
                {/* Color dots */}
                <div className="flex items-center gap-1 px-1">
                  <button
                    onClick={() => setTheme('gold')}
                    className={`h-4 w-4 rounded-full bg-amber-400 transition-all ${
                      theme === 'gold' ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                    }`}
                    title="FORCE Gold Core"
                  />
                  <button
                    onClick={() => setTheme('neural')}
                    className={`h-4 w-4 rounded-full bg-cyan-400 transition-all ${
                      theme === 'neural' ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                    }`}
                    title="Neural Bioluminescence"
                  />
                  <button
                    onClick={() => setTheme('amethyst')}
                    className={`h-4 w-4 rounded-full bg-purple-400 transition-all ${
                      theme === 'amethyst' ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                    }`}
                    title="Deep Amethyst"
                  />
                  <button
                    onClick={() => setTheme('aurora')}
                    className={`h-4 w-4 rounded-full bg-emerald-400 transition-all ${
                      theme === 'aurora' ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                    }`}
                    title="Aurora Spectrum"
                  />
                </div>

                <div className="h-4 w-px bg-white/20" />

                <button
                  onClick={() => setShowSliders(!showSliders)}
                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium transition-colors ${
                    showSliders ? 'bg-white/20 text-white' : 'text-[#d4af88] hover:bg-white/10'
                  }`}
                >
                  <Sliders className="h-3 w-3" />
                  <span>Modulate</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Optional Collapsible Manual Modulation Drawer ─────────────── */}
          <AnimatePresence>
            {showSliders && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-[#2b1c12] bg-[#120d09] px-6 py-4 overflow-hidden z-20"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Confidence Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-[#a38062]">
                      <span className="font-semibold text-white">Stream Coherence</span>
                      <span>{stats.confidence}%</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      value={stats.confidence}
                      onChange={(e) => setStats({ ...stats, confidence: Number(e.target.value) })}
                      className="w-full accent-amber-500 h-1 bg-white/20 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-[#78593e]">Vocal Conviction vs Turbulence</p>
                  </div>

                  {/* Follow-Through Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-[#a38062]">
                      <span className="font-semibold text-white">Core Gravitation</span>
                      <span>{stats.followThrough}%</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      value={stats.followThrough}
                      onChange={(e) => setStats({ ...stats, followThrough: Number(e.target.value) })}
                      className="w-full accent-amber-500 h-1 bg-white/20 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-[#78593e]">Execution Pull & Orbit</p>
                  </div>

                  {/* Clarity Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-[#a38062]">
                      <span className="font-semibold text-white">Harmonic Clarity</span>
                      <span>{stats.clarity}%</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      value={stats.clarity}
                      onChange={(e) => setStats({ ...stats, clarity: Number(e.target.value) })}
                      className="w-full accent-amber-500 h-1 bg-white/20 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-[#78593e]">Noise Octave Smoothness</p>
                  </div>

                  {/* Growth Velocity Slider */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-[#a38062]">
                      <span className="font-semibold text-white">Kinetic Velocity</span>
                      <span>{stats.growthVelocity}%</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="100"
                      value={stats.growthVelocity}
                      onChange={(e) => setStats({ ...stats, growthVelocity: Number(e.target.value) })}
                      className="w-full accent-amber-500 h-1 bg-white/20 rounded-lg cursor-pointer"
                    />
                    <p className="text-[10px] text-[#78593e]">Drift Speed & Trail Energy</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CognitiveSpectrumModal;

"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAiDecryption } from '@/utils/encryption/useAiDecryption';

type AnalysisHistoryItem = {
    id: string;
    analysis_type: 'sentiment' | 'textual';
    date_range: string;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
};

type AudioHistoryItem = {
    id: string;
    date: string;
    filename: string;
    summary: string;
    analysis?: any;
};

type RecentActivity = {
    source: 'audio' | 'analysis';
    title: string;
    description: string;
    timestampMs: number;
};

type VoiceSignalInsight = {
    timestampMs: number;
    filename: string;
    summary: string;
    topEmotion: string;
    topEmotionScore?: number;
    durationSeconds?: number;
    speakerCount?: number;
    confidencePct?: number;
};

function firstValidNumber(...values: Array<number | undefined | null>): number | undefined {
    for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    return undefined;
}

function formatRelativeTime(timestampMs: number): string {
    const deltaMs = Date.now() - timestampMs;
    const minutes = Math.max(1, Math.floor(deltaMs / 60000));

    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function pickTopEmotion(
    distribution?: Record<string, number> | null
): { name: string; score?: number } {
    if (!distribution || typeof distribution !== 'object') {
        return { name: 'Not detected' };
    }

    const entries = Object.entries(distribution)
        .filter(([, score]) => typeof score === 'number' && Number.isFinite(score))
        .sort(([, a], [, b]) => (b as number) - (a as number));

    if (!entries.length) return { name: 'Not detected' };
    const [name, score] = entries[0] as [string, number];
    return { name, score: Number(score) };
}

function extractVoiceSignalInsight(item: AudioHistoryItem): VoiceSignalInsight {
    const analysis = item.analysis;
    const isHume = Boolean(analysis && typeof analysis === 'object' && analysis.type === 'hume' && analysis.data);

    if (isHume) {
        const summary = analysis?.data?.summary;
        const emotionSource = summary?.enrichedEmotionDistribution || summary?.emotionDistribution || analysis?.data?.enrichedEmotions || analysis?.data?.emotions;
        const dominant = pickTopEmotion(emotionSource);

        return {
            timestampMs: Date.parse(item.date || ''),
            filename: item.filename || 'Untitled recording',
            summary: item.summary || 'Voice analysis completed',
            topEmotion: dominant.name,
            topEmotionScore: dominant.score,
            durationSeconds: firstValidNumber(summary?.totalDuration),
            speakerCount: firstValidNumber(summary?.speakerCount, analysis?.data?.speakers?.length),
        };
    }

    const emotion = analysis?.gemini?.emotions?.primary || analysis?.deepgram?.sentiment?.overall || 'Not detected';
    const confidence = firstValidNumber(analysis?.deepgram?.confidence, analysis?.gemini?.speechPatterns?.clarity, analysis?.gemini?.speechPatterns?.confidence);

    return {
        timestampMs: Date.parse(item.date || ''),
        filename: item.filename || 'Untitled recording',
        summary: item.summary || analysis?.gemini?.summary || analysis?.deepgram?.summary || 'Voice analysis completed',
        topEmotion: emotion,
        confidencePct: typeof confidence === 'number' ? Math.round(confidence * 100) : undefined,
    };
}

type NavCardProps = {
    title: string;
    description?: string;
    href: string;
    toneClass?: string;
    icon: React.ReactNode;
    metric?: string;
    chip?: string;
};

const NavCard: React.FC<NavCardProps> = ({
    title,
    description,
    href,
    toneClass = 'from-[#ffd3e3] via-[#fff0f5] to-[#f6f1ea]',
    icon,
    metric,
    chip,
}) => {
    const router = useRouter();

    const handleClick = useCallback(() => router.push(href), [href, router]);

    const handleKey = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
            }
        },
        [handleClick]
    );

    return (
        <motion.div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={handleKey}
            aria-label={title}
            initial={{ opacity: 0, y: 20, scale: 0.96, rotate: -0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ y: -4, scale: 1.01, rotate: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`cursor-pointer group relative isolate overflow-hidden flex flex-col justify-between rounded-[26px] p-6 shadow-[0_14px_30px_rgba(143,74,104,0.16)] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2`}
            style={{ minHeight: 230, background: 'linear-gradient(180deg, rgba(255,242,247,0.99) 0%, rgba(255,247,240,0.98) 100%)', border: '1px solid rgba(173,103,130,0.20)', color: '#1f1110' }}
        >
            <div className={`absolute inset-0 rounded-[26px] bg-gradient-to-br ${toneClass} opacity-14`} />
            <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#e88bb0]/14 blur-2xl transition-all duration-500 group-hover:scale-125" />
            <div className="absolute -left-8 -bottom-10 h-24 w-24 rounded-full bg-[#d9a07a]/10 blur-2xl transition-all duration-500 group-hover:scale-125" />
            <div className="pointer-events-none absolute inset-0 shine opacity-6" />
            <div className="pointer-events-none absolute right-4 top-4 z-0 h-7 w-20 rounded-full bg-white/42 ring-1 ring-black/8" />

            <div className="relative z-10 flex items-start gap-3">
                <div className="shrink-0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                        <h3 className="max-w-[12ch] text-[1.55rem] font-bold leading-tight sm:max-w-none sm:text-2xl" style={{ fontFamily: 'var(--analysis-heading-font)', letterSpacing: '0.02em', color: '#1b0f0f' }}>{title}</h3>
                        {chip ? (
                            <span className="relative z-10 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'rgba(255,236,244,0.99)', border: '1px solid rgba(153,70,108,0.28)', color: '#140909', boxShadow: '0 8px 16px rgba(77,58,49,0.10)' }}>
                                {chip}
                            </span>
                        ) : null}
                    </div>
                    {description ? <p className="mt-2 max-w-sm text-sm leading-relaxed" style={{ color: '#241413' }}>{description}</p> : null}
                </div>
            </div>

            <div className="relative z-10 mt-7 flex items-center justify-between gap-4 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: 'rgba(255,236,244,0.99)', border: '1px solid rgba(153,70,108,0.28)', color: '#140909', boxShadow: '0 8px 16px rgba(77,58,49,0.10)' }}>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 12h14" />
                        <path d="M12 5l7 7-7 7" />
                    </svg>
                    Enter Experience
                </span>
                {metric ? <span className="text-sm font-semibold" style={{ color: '#140909' }}>{metric}</span> : null}
            </div>
        </motion.div>
    );
};

const AudioIcon = (
    <svg style={{ width: 44, height: 44, borderRadius: 12, padding: 6, background: 'var(--analysis-shell-bg)', border: '1px solid rgba(0,0,0,0.06)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3v18" />
        <path d="M5 8v8a7 7 0 0 0 14 0V8" />
    </svg>
);

const AdvancedIcon = (
    <svg style={{ width: 44, height: 44, borderRadius: 12, padding: 6, background: 'var(--analysis-shell-bg)', border: '1px solid rgba(0,0,0,0.06)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2l2 4 4 .5-3 3 0 4-3-2-3 2 0-4-3-3 4-.5z" />
    </svg>
);

const containerVariants = {
    hidden: { opacity: 0, y: 14 },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.08,
            duration: 0.4,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.38 } },
};

const Analysis: React.FC = () => {
    const router = useRouter();
    const { decryptAudio } = useAiDecryption();
    const [recentActivity, setRecentActivity] = useState<RecentActivity | null>(null);
    const [recentVoiceSignal, setRecentVoiceSignal] = useState<VoiceSignalInsight | null>(null);
    const [activityLoading, setActivityLoading] = useState(true);
    const [activityError, setActivityError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadRecentActivity = async () => {
            try {
                setActivityLoading(true);
                setActivityError(null);

                const [analysisRes, audioRes] = await Promise.all([
                    fetch('/api/analysis/history?limit=5', { cache: 'no-store' }),
                    fetch('/api/analysis/audio/history?limit=5', { cache: 'no-store' }),
                ]);

                const analysisData = analysisRes.ok ? await analysisRes.json() : { history: [] };
                const audioData = audioRes.ok ? await audioRes.json() : { history: [] };

                const analysisHistory: AnalysisHistoryItem[] = Array.isArray(analysisData?.history)
                    ? analysisData.history
                    : [];
                const rawAudioHistory = Array.isArray(audioData?.history)
                    ? audioData.history
                    : [];

                // Decrypt audio history
                const audioHistory: AudioHistoryItem[] = await Promise.all(
                    rawAudioHistory.map(async (row: any) => {
                        const dec = await decryptAudio(row);
                        const results = dec.results as any;
                        return {
                            ...row,
                            transcript: results?.transcript ?? row.transcript,
                            gemini_analysis: results?.gemini_analysis ?? row.gemini_analysis,
                            deepgram_analysis: results?.deepgram_analysis ?? row.deepgram_analysis,
                            hume_analysis: results?.hume_analysis ?? row.hume_analysis,
                        } as AudioHistoryItem;
                    })
                );

                const normalized: RecentActivity[] = [
                    ...analysisHistory.map((item) => ({
                        source: 'analysis' as const,
                        title: item.analysis_type === 'sentiment' ? 'Sentiment Analysis' : 'Textual Analysis',
                        description: item.date_range ? `Range: ${item.date_range}` : 'Advanced analysis completed',
                        timestampMs: Date.parse(item.created_at || ''),
                    })),
                    ...audioHistory.map((item) => ({
                        source: 'audio' as const,
                        title: `Audio Analysis - ${item.filename || 'Untitled recording'}`,
                        description: item.summary || 'Audio analysis completed',
                        timestampMs: Date.parse(item.date || ''),
                    })),
                ].filter((item) => Number.isFinite(item.timestampMs));

                normalized.sort((a, b) => b.timestampMs - a.timestampMs);
                const latestVoice = audioHistory
                    .map(extractVoiceSignalInsight)
                    .filter((item) => Number.isFinite(item.timestampMs))
                    .sort((a, b) => b.timestampMs - a.timestampMs)[0] || null;

                if (mounted) {
                    setRecentActivity(normalized[0] || null);
                    setRecentVoiceSignal(latestVoice);
                }
            } catch (error) {
                if (mounted) {
                    setActivityError('Failed to load recent activity');
                    setRecentVoiceSignal(null);
                }
                console.error('[Analysis Dashboard] Recent activity load failed:', error);
            } finally {
                if (mounted) {
                    setActivityLoading(false);
                }
            }
        };

        loadRecentActivity();

        return () => {
            mounted = false;
        };
    }, []);

    const recentActivityTime = useMemo(() => {
        if (!recentActivity) return '';
        return new Date(recentActivity.timestampMs).toLocaleString();
    }, [recentActivity]);

    return (
        <main
            className="analysis-shell analysis-body relative min-h-screen overflow-y-auto px-4 pb-24 pt-6 text-[#2d1917] sm:px-6 lg:px-10"
            style={{
                background: 'transparent',
            }}
        >
            <style jsx>{`
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

                :global(:root) {
                    --analysis-heading-font: 'Hydrogen Whiskey', serif;
                    --analysis-body-font: 'Terminal Grotesque', sans-serif;
                }

                .analysis-shell {
                    font-size: clamp(0.92rem, 0.86rem + 0.25vw, 1rem);
                }

                .analysis-shell .text-xs {
                    font-size: clamp(0.78rem, 0.75rem + 0.14vw, 0.84rem);
                    line-height: clamp(1.1rem, 1.04rem + 0.18vw, 1.22rem);
                }

                .analysis-shell .text-sm {
                    font-size: clamp(0.9rem, 0.86rem + 0.18vw, 0.96rem);
                    line-height: clamp(1.3rem, 1.24rem + 0.24vw, 1.42rem);
                }

                .analysis-shell .text-base {
                    font-size: clamp(0.96rem, 0.9rem + 0.24vw, 1.05rem);
                    line-height: clamp(1.42rem, 1.34rem + 0.32vw, 1.56rem);
                }

                .float-a {
                    animation: floatA 10s ease-in-out infinite;
                }

                .float-b {
                    animation: floatB 14s ease-in-out infinite;
                }

                .float-c {
                    animation: floatC 18s ease-in-out infinite;
                }

                .grid-drift {
                    background-image:
                        linear-gradient(to right, rgba(176, 74, 118, 0.1) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(176, 74, 118, 0.1) 1px, transparent 1px);
                    background-size: 34px 34px;
                    mask-image: radial-gradient(circle at 50% 30%, black 38%, transparent 78%);
                    animation: gridDrift 30s linear infinite;
                }

                .pulse-ring {
                    animation: pulseRing 2.8s ease-out infinite;
                }

                .shine {
                    background: linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,.5) 50%, rgba(255,255,255,0) 70%);
                    background-size: 230% 100%;
                    animation: shine 4s linear infinite;
                }

                .ticker {
                    animation: ticker 16s linear infinite;
                }

                .slow-spin {
                    animation: slowSpin 16s linear infinite;
                }

                .sticker-bob {
                    animation: stickerBob 7s ease-in-out infinite;
                }

                .paper-noise {
                    background-image: radial-gradient(rgba(152, 55, 95, 0.08) 0.5px, transparent 0.5px);
                    background-size: 4px 4px;
                }

                .analysis-heading {
                    font-family: var(--analysis-heading-font);
                }

                .analysis-heading-sm {
                    font-family: var(--analysis-heading-font);
                    letter-spacing: 0.045em;
                }

                .analysis-body {
                    font-family: var(--analysis-body-font);
                    letter-spacing: 0.02em;
                }

                @keyframes floatA {
                    0%, 100% { transform: translateY(0px) translateX(0px); }
                    50% { transform: translateY(-18px) translateX(8px); }
                }

                @keyframes floatB {
                    0%, 100% { transform: translateY(0px) translateX(0px); }
                    50% { transform: translateY(14px) translateX(-10px); }
                }

                @keyframes floatC {
                    0%, 100% { transform: translateY(0px) translateX(0px) scale(1); }
                    50% { transform: translateY(-10px) translateX(14px) scale(1.07); }
                }

                @keyframes gridDrift {
                    0% { transform: translate3d(0, 0, 0); }
                    100% { transform: translate3d(-34px, -34px, 0); }
                }

                @keyframes pulseRing {
                    0% { transform: scale(0.85); opacity: 0.85; }
                    70% { transform: scale(1.18); opacity: 0; }
                    100% { transform: scale(1.18); opacity: 0; }
                }

                @keyframes shine {
                    0% { background-position: 200% 0; }
                    100% { background-position: -30% 0; }
                }

                @keyframes ticker {
                    0% { transform: translateX(0%); }
                    100% { transform: translateX(-50%); }
                }

                @keyframes slowSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                @keyframes stickerBob {
                    0%, 100% { transform: translateY(0px) rotate(-2deg); }
                    50% { transform: translateY(-8px) rotate(2deg); }
                }
            `}</style>

            <div className="pointer-events-none absolute inset-0 bg-transparent">
                <div className="float-a absolute -left-16 top-20 h-56 w-56 rounded-full bg-[#d6a3b5]/10 blur-3xl" />
                <div className="float-b absolute right-0 top-10 h-72 w-72 rounded-full bg-[#cfd8d0]/08 blur-3xl" />
                <div className="float-c absolute bottom-12 left-1/3 h-60 w-60 rounded-full bg-[#e0b89e]/08 blur-3xl" />
            </div>

            <motion.section
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="relative mx-auto max-w-6xl px-0 sm:px-2"
            >
                <motion.header variants={itemVariants} className="relative mb-8 overflow-hidden rounded-[30px] p-5 bg-white/95 sm:p-8" style={{ background: 'linear-gradient(180deg, rgba(255,250,251,0.95) 0%, rgba(251,246,243,0.95) 100%)' }}>
                    <img src="/mind_scroll/stickers/top1.png" alt="" aria-hidden className="sticker-bob absolute -left-4 -top-4 w-20 opacity-90 sm:w-24" />
                    <img src="/mind_scroll/stickers/wave_top3.png" alt="" aria-hidden className="absolute -right-4 top-4 w-20 opacity-85 sm:w-24" />
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#c89db1]/54 bg-[#fff0f6]/92 px-3 py-1 text-xs font-semibold text-[#6a213f]">
                        <span className="relative inline-flex h-2.5 w-2.5">
                            <span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-emerald-500/70" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </span>
                        Insight Sanctuary
                    </div>

                    <h1 className="analysis-heading mb-3 text-[32px] font-bold uppercase leading-[1.02] tracking-[0.015em] text-[#201110] sm:text-[44px] lg:text-[58px]" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.4)' }}>
                        Understand Your
                        <br />
                        Patterns In Motion
                    </h1>

                    <p className="analysis-body max-w-3xl text-lg leading-relaxed text-[#47322c]">
                        Your attention shapes your inner world. Use Voice Signals and Pattern Map to trace emotional shifts, surface hidden signals, and return to a clearer mental map.
                    </p>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start">
                        <button
                            type="button"
                            onClick={() => router.push('/analysis/audio-analysis')}
                            className="relative overflow-hidden rounded-2xl border border-[#8b5e71]/55 bg-linear-to-r from-[#8d5b77] via-[#9b6f86] to-[#7f9f92] px-5 py-3 text-sm font-semibold text-white shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-xl w-full sm:w-auto"
                        >
                            <span className="relative z-10">Enter Voice Signals</span>
                            <span className="pointer-events-none absolute inset-0 shine opacity-40" />
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/analysis/advanced')}
                            className="rounded-2xl border border-[#c99fb2]/48 bg-[#fff0f6] px-5 py-3 text-sm font-semibold text-[#4b2637] transition duration-300 hover:-translate-y-0.5 hover:bg-[#ffe2ee] hover:shadow-md w-full sm:w-auto"
                        >
                            Open Pattern Map
                        </button>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                            { label: 'Modules', value: '2 Active', bar: '88%' },
                                { label: 'Latency', value: '~2-5 min', bar: '72%' },
                                { label: 'Modes', value: 'Voice Signals + Pattern Map', bar: '84%' },
                                { label: 'UX', value: 'Interactive', bar: '90%' },
                        ].map((item) => (
                            <div key={item.label} className="rounded-2xl bg-[#fff3f8]/96 p-3 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md">
                                <p className="text-xs text-[#8a2557]">{item.label}</p>
                                <p className="mt-1 text-sm font-semibold text-[#2d171f]">{item.value}</p>
                                <div className="mt-2 h-1.5 rounded-full bg-[#f1c3d6]">
                                    <div className="h-1.5 rounded-full bg-linear-to-r from-[#8d5b77] via-[#b06b8f] to-[#7f9f92]" style={{ width: item.bar }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.header>

                <motion.div variants={itemVariants} className="mb-6 overflow-hidden rounded-2xl bg-[#fff0f7]/94 p-2 shadow-sm backdrop-blur">
                    <div className="ticker flex min-w-max items-center gap-8 text-xs font-semibold uppercase tracking-wide text-[#7d214b]">
                        {Array.from({ length: 2 }).map((_, idx) => (
                            <React.Fragment key={idx}>
                                <span>Attention Mapping</span>
                                <span>Voice-to-Insight Pipeline</span>
                                <span>Pattern Reflection Engine</span>
                                <span>Interactive Insight Canvas</span>
                                <span>Deep Session Analytics</span>
                            </React.Fragment>
                        ))}
                    </div>
                </motion.div>

                <motion.section variants={itemVariants} className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-2">
                    <NavCard
                        title="Voice Signals"
                        description="Launch voice uploads and insight analysis in the dedicated experience."
                        href="/analysis/audio-analysis"
                        toneClass="from-[#ffbfd7] via-[#ffe0ec] to-[#fff5fb]"
                        icon={<span style={{ display: 'flex', height: 48, width: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', background: 'var(--analysis-shell-bg)', color: 'var(--accent)' }}>♪</span>}
                        metric="Quick voice insights"
                        chip="Signals"
                    />

                    <NavCard
                        title="Deep Pattern Atlas"
                        description="Uncover long-arc behavior, recurring emotional loops, and high-signal themes across your journal timeline."
                        href="/analysis/advanced"
                        toneClass="from-[#f1e0ff] via-[#e7d7ff] to-[#f7f1e5]"
                        icon={AdvancedIcon}
                        metric="Long-range pattern clarity"
                        chip="Insights"
                    />
                </motion.section>

                <motion.section variants={itemVariants} className="mt-6">
                    <article className="relative overflow-hidden rounded-[30px] p-6 transition duration-300 sm:p-7 bg-white/95" style={{ background: 'linear-gradient(180deg, rgba(255,247,250,0.96) 0%, rgba(251,243,236,0.96) 100%)' }}>
                        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#f2b0cd]/42 blur-3xl" />
                        <div className="pointer-events-none absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-[#d8c0a4]/45 blur-3xl" />
                        <img src="/mind_scroll/stickers/branch_bottom.png" alt="" aria-hidden className="absolute -bottom-4 -right-3 w-16 opacity-75" />

                        <div className="relative mb-5 flex items-center justify-between gap-4">
                            <div>
                                <h4 className="analysis-heading text-[30px] leading-none tracking-wide" style={{ color: '#231311', textShadow: '0 1px 0 rgba(255,255,255,0.35)' }}>
                                    Fresh Signals
                                </h4>
                                <p className="mt-2 text-sm" style={{ color: '#4c352f' }}>A refined snapshot of your most recent insight event.</p>
                            </div>
                            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(255,240,246,0.96)', border: '1px solid rgba(192,121,149,0.16)', color: '#4b2b3d' }}>
                                <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
                                Pulse Feed
                            </div>
                        </div>

                        <div className="relative rounded-2xl p-5 text-sm sm:p-6" style={{ background: 'rgba(255,249,251,0.96)', border: '1px dashed rgba(177,88,128,0.14)', color: '#2d1917' }}>
                            {activityLoading ? (
                                <>
                                    <p className="font-medium">Loading recent activity...</p>
                                    <p className="mt-1 text-xs leading-relaxed">Collecting your latest insight events.</p>
                                </>
                            ) : activityError ? (
                                <>
                                    <p className="font-medium">Could not load activity</p>
                                    <p className="mt-1 text-xs leading-relaxed">{activityError}</p>
                                </>
                            ) : recentActivity ? (
                                <>
                                    {recentVoiceSignal ? (
                                        <>
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <p className="text-base font-semibold" style={{ color: 'var(--analysis-text)' }}>Recent Voice Signal</p>
                                                <p className="text-xs" style={{ color: 'var(--analysis-muted)' }}>{new Date(recentVoiceSignal.timestampMs).toLocaleString()}</p>
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'var(--analysis-shell-bg)', border: '1px solid rgba(147,114,95,0.04)', color: 'var(--analysis-muted)' }}>
                                                    Source: Voice Signals
                                                </span>
                                                <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'var(--analysis-shell-bg)', border: '1px solid rgba(147,114,95,0.04)', color: 'var(--analysis-muted)' }}>
                                                    Freshness: {formatRelativeTime(recentVoiceSignal.timestampMs)}
                                                </span>
                                                {typeof recentVoiceSignal.topEmotionScore === 'number' && (
                                                    <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'var(--analysis-shell-bg)', border: '1px solid rgba(147,114,95,0.04)', color: 'var(--analysis-muted)' }}>
                                                        Emotion Confidence: {Math.round(recentVoiceSignal.topEmotionScore * 100)}%
                                                    </span>
                                                )}
                                                {typeof recentVoiceSignal.confidencePct === 'number' && (
                                                    <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'var(--analysis-shell-bg)', border: '1px solid rgba(147,114,95,0.04)', color: 'var(--analysis-muted)' }}>
                                                        Transcript Confidence: {recentVoiceSignal.confidencePct}%
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,249,251,0.96)', border: '1px solid rgba(192,121,149,0.12)', color: '#2d1917' }}>
                                                    <p className="text-[11px] uppercase tracking-wide" style={{ color: '#6a4057' }}>File</p>
                                                    <p className="mt-1 text-sm font-semibold line-clamp-1" style={{ color: '#231311' }}>{recentVoiceSignal.filename}</p>
                                                </div>
                                                <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,249,251,0.96)', border: '1px solid rgba(192,121,149,0.12)', color: '#2d1917' }}>
                                                    <p className="text-[11px] uppercase tracking-wide" style={{ color: '#6a4057' }}>Dominant Emotion</p>
                                                    <p className="mt-1 text-sm font-semibold" style={{ color: '#231311' }}>
                                                        {recentVoiceSignal.topEmotion}
                                                        {typeof recentVoiceSignal.topEmotionScore === 'number' ? ` (${Math.round(recentVoiceSignal.topEmotionScore * 100)}%)` : ''}
                                                    </p>
                                                </div>
                                                <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,249,251,0.96)', border: '1px solid rgba(192,121,149,0.12)', color: '#2d1917' }}>
                                                    <p className="text-[11px] uppercase tracking-wide" style={{ color: '#6a4057' }}>Signal Metrics</p>
                                                    <p className="mt-1 text-sm font-semibold" style={{ color: '#231311' }}>
                                                        {typeof recentVoiceSignal.durationSeconds === 'number' ? `${Math.round(recentVoiceSignal.durationSeconds)}s` : 'Duration n/a'}
                                                        {typeof recentVoiceSignal.speakerCount === 'number' ? ` · ${recentVoiceSignal.speakerCount} speaker${recentVoiceSignal.speakerCount === 1 ? '' : 's'}` : ''}
                                                        {typeof recentVoiceSignal.confidencePct === 'number' ? ` · ${recentVoiceSignal.confidencePct}% confidence` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-base font-semibold text-[#231311]">{recentActivity.title}</p>
                                            <p className="mt-2 text-sm leading-relaxed text-[#4a332d]">{recentActivity.description}</p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                    <span className="rounded-full border border-[#d889aa]/72 bg-[#fff0f6]/95 px-2.5 py-1 text-[11px] font-semibold text-[#53263f]">
                                                    Source: {recentActivity.source === 'audio' ? 'Hume' : 'Pattern Map'}
                                                </span>
                                                <span className="rounded-full border border-[#d889aa]/72 bg-[#fff0f6]/95 px-2.5 py-1 text-[11px] font-semibold text-[#53263f]">
                                                    Freshness: {formatRelativeTime(recentActivity.timestampMs)}
                                                </span>
                                            </div>
                                            <p className="mt-3 text-xs text-[#6c394d]">{recentActivityTime}</p>
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    <p className="font-medium text-[#231311]">No fresh signals yet</p>
                                    <p className="mt-1 text-xs leading-relaxed text-[#4c352f]">Launch Voice Signals to create your first signal and start your activity pulse.</p>
                                </>
                            )}
                        </div>

                        <div className="analysis-body mt-5 grid grid-cols-1 gap-2 text-sm text-[#5b3045] sm:grid-cols-2">
                            <p className="rounded-xl border border-[#d889aa]/58 bg-[#fff0f6]/94 px-3 py-2">• Timeline refreshes automatically after each completed run.</p>
                            <p className="rounded-xl border border-[#d889aa]/58 bg-[#fff0f6]/94 px-3 py-2">• Signals stay easy to scan across sessions.</p>
                        </div>
                    </article>
                </motion.section>

                <motion.section variants={itemVariants} className="relative mt-6 overflow-hidden rounded-3xl bg-[#fff1f7]/95 p-5 shadow-sm">
                    <img src="/mind_scroll/stickers/diamond_top2.png" alt="" aria-hidden className="slow-spin absolute -right-3 top-3 w-10 opacity-75" />
                    <h4 className="analysis-heading-sm text-[28px] leading-none tracking-wide text-[#231311]" style={{ textShadow: '0 1px 0 rgba(255,255,255,0.35)' }}>
                        Experience Status
                    </h4>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                            { title: 'Voice Engine', state: 'Ready', tone: 'bg-pink-500' },
                            { title: 'Pattern Engine', state: 'Ready', tone: 'bg-rose-500' },
                            { title: 'Export Queue', state: 'Idle', tone: 'bg-fuchsia-500' },
                        ].map((item) => (
                            <div key={item.title} className="flex items-center justify-between rounded-2xl border border-[#d48eaa]/66 bg-[#fff3f8]/96 px-3 py-2.5">
                                <span className="text-sm text-[#311a24]">{item.title}</span>
                                <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/78 px-2.5 py-1 text-xs font-semibold text-[#311a24]">
                                    <span className={`h-2 w-2 rounded-full ${item.tone}`} />
                                    {item.state}
                                </span>
                            </div>
                        ))}
                    </div>
                </motion.section>
            </motion.section>
        </main>
    );
};

export default Analysis;

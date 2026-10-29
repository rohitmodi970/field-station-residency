'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '@/utilities/context/ThemeContext';
import { Brain, RefreshCw, ChevronDown, Zap, MessageCircle, Lightbulb, CheckCircle2, Target, Eye, EyeOff, ListTodo, Loader2 } from 'lucide-react';
import { getEncryptionKey } from '@/utils/encryption/keyManager';
import { encryptText as encryptTextRaw, decryptText as decryptTextRaw } from '@/utils/encryption/crypto';
import { ActionCard } from './ActionCard';
import { ActionOptionsModal, type ActionData } from './ActionOptionsModal';
import CognitionEngineWorkspace from './CognitionEngineWorkspace';

/* ─────────────── Types ─────────────── */
interface AnalysisData {
  summary?: string;
  overallSentiment?: {
    score: number;
    label: string;
    confidence: number;
  };
  emotionalPatterns?: {
    primaryEmotions: Array<{ emotion: string; intensity: number }>;
    secondaryEmotions?: Array<{ emotion: string; intensity: number }>;
  };
  topics?: Array<{ topic: string; sentiment: number }>;
  keyInsights?: Array<{ insight: string; significance: string; evidence?: string[]; confidence?: number }>;
  recommendations?: Array<{ area: string; suggestion: string; rationale: string }>;
  taskCandidates?: Array<{
    title?: string;
    description?: string;
    due_at?: string | null;
    reminder_at?: string | null;
    priority?: 'high' | 'medium' | 'low';
    category?: 'health' | 'productivity' | 'social' | 'wellbeing';
    type?: 'execution' | 'decision';
    should_autocreate?: boolean;
  }>;
}

interface JournalAnalysisProps {
  journalId: string;
  journal: { title: string; content: string } | null;
  user: { id: string } | null;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const SINGLE_ENTRY_ANALYSIS_LIMIT = 1;
const ANALYSIS_PENDING_KEY_PREFIX = 'force:analysis:pending:';

function pendingKeyForJournal(journalId: string): string {
  return `${ANALYSIS_PENDING_KEY_PREFIX}${journalId}`;
}

/* ─────────────── Helpers ─────────────── */
const sentimentMeta = (score: number) => {
  if (score > 0.3) return { emoji: '😊', label: 'Positive', colors: ['#059669', '#34D399'] as const };
  if (score < -0.3) return { emoji: '😔', label: 'Negative', colors: ['#DC2626', '#F87171'] as const };
  return { emoji: '😐', label: 'Neutral', colors: ['#D97706', '#FBBF24'] as const };
};

/** Extract r,g,b from a hex color string */
const hexRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const rgba = (hex: string, a: number) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
/** Lighten a hex color by blending towards white */
const lighten = (hex: string, amount: number) => {
  const [r, g, b] = hexRgb(hex);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `#${lr.toString(16).padStart(2,'0')}${lg.toString(16).padStart(2,'0')}${lb.toString(16).padStart(2,'0')}`;
};
/** Darken a hex color by blending towards black */
const darken = (hex: string, amount: number) => {
  const [r, g, b] = hexRgb(hex);
  const dr = Math.round(r * (1 - amount));
  const dg = Math.round(g * (1 - amount));
  const db = Math.round(b * (1 - amount));
  return `#${dr.toString(16).padStart(2,'0')}${dg.toString(16).padStart(2,'0')}${db.toString(16).padStart(2,'0')}`;
};

/* ─────────────── Humanization Helper ─────────────── */
const humanizeText = (text: string): string => {
  if (!text) return '';
  
  return text
    // Remove spiritual/abstract terms
    .replace(/\b(chakra|muladhara|svadhisthana|manipura|anahata|vishuddha|ajna|sahasrara)\b/gi, 'life area')
    .replace(/energy block(s)?/gi, 'challenge$1')
    .replace(/energy flow(s)?/gi, 'progress')
    .replace(/consciousness level/gi, 'awareness')
    .replace(/spiritual (evolution|journey|growth)/gi, 'personal $1')
    .replace(/soul'?s? journey/gi, 'life path')
    .replace(/divine/gi, 'inner')
    .replace(/sacred/gi, 'meaningful')
    .replace(/kundalini/gi, 'energy')
    .replace(/foundation & stability indicators?/gi, 'work and life balance')
    .replace(/emotional well-being metrics/gi, 'emotional state')
    .replace(/personal power & agency/gi, 'sense of control')
    
    // Make conversational
    .replace(/\bThe user (is|has|shows|demonstrates)\b/gi, "You $1")
    .replace(/\bThe individual (is|has|shows|demonstrates)\b/gi, "You $1")
    .replace(/\bThis person (is|has|shows|demonstrates)\b/gi, "You $1")
    .replace(/\bdemonstrates\b/gi, 'show')
    .replace(/\bindicates\b/gi, 'suggests')
    .replace(/\bevident that\b/gi, 'clear that')
    .replace(/\bmanifest(ation|s)? of\b/gi, '')
    
    // Simplify clinical/academic language
    .replace(/\bpsychological\b/gi, 'mental')
    .replace(/\bcognitive\b/gi, 'thinking')
    .replace(/\bambulatory meditation with caffeinated beverage\b/gi, 'morning walks with coffee')
    .replace(/\bcircadian rhythm optimization\b/gi, 'sleep schedule')
    .replace(/\bemotional dysregulation\b/gi, 'mood swings')
    .replace(/\binterpersonal contexts\b/gi, 'relationships')
    .replace(/\bsleep architecture\b/gi, 'sleep quality')
    .replace(/\bresource anxiety patterns\b/gi, 'worries about work or money')
    
    .trim()
    // Clean up double spaces
    .replace(/\s{2,}/g, ' ');
};

const getActionIcon = (area: string): string => {
  const lower = area.toLowerCase();
  if (lower.includes('sleep') || lower.includes('rest')) return '💤';
  if (lower.includes('exercise') || lower.includes('movement')) return '🏃';
  if (lower.includes('social') || lower.includes('relationship')) return '💬';
  if (lower.includes('work') || lower.includes('productiv')) return '⏰';
  if (lower.includes('emotion') || lower.includes('mood')) return '🧘';
  if (lower.includes('gratitude') || lower.includes('positiv')) return '🙏';
  if (lower.includes('creativ')) return '🎨';
  if (lower.includes('learn')) return '📚';
  return '✨';
};

  const generateHeroSummary = (data: AnalysisData): string => {
  if (!data) return '';
  
  const sentiment = data.overallSentiment?.score || 0;
  const emotions = data.emotionalPatterns?.primaryEmotions || [];
  const topEmotion = emotions[0]?.emotion || '';
  const baseSummary = (data.summary || '').replace(/\s+/g, ' ').trim();
  const topInsight = (data.keyInsights?.[0]?.insight || '').replace(/\s+/g, ' ').trim();
  const topSignificance = (data.keyInsights?.[0]?.significance || '').replace(/\s+/g, ' ').trim();
  
  let output = '';
  
  if (sentiment < -0.3) {
    output = `You're in a difficult stretch, and the pressure is showing up in more than one place. `;
  } else if (sentiment > 0.3) {
    output = `There is real momentum here, and the entry points to something that can be built on. `;
  } else {
    output = `You're in a reflective period, trying to make sense of what matters and what needs to change. `;
  }
  
  if (topEmotion.toLowerCase().includes('stress') || topEmotion.toLowerCase().includes('anxious')) {
    output += `Stress is present, but you're naming it clearly instead of letting it stay vague. `;
  } else if (topEmotion.toLowerCase().includes('joy') || topEmotion.toLowerCase().includes('happy')) {
    output += `Joy is showing up in your entries, which gives you something real to build from. `;
  }
  
  if (baseSummary) {
    output += `${baseSummary} `;
  }

  if (topInsight) {
    output += `The strongest signal is that ${topInsight.toLowerCase()}. `;
  }

  if (topSignificance) {
    output += `That matters because ${topSignificance.toLowerCase()}.`;
  } else {
    const hasPositives = data.topics?.some(t => t.sentiment > 0.3) || false;
    output += hasPositives
      ? `There are still useful strengths here, so the next step is to build from what is already working.`
      : `The next useful move is to turn this into one concrete, low-friction action.`;
  }
  
  return output;
};

const compactLine = (text: string, maxLength: number): string => {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}...`;
};

const cleanEvidence = (evidence?: string[]): string[] => {
  if (!Array.isArray(evidence)) return [];
  return evidence
    .map((item) => (item || '').replace(/\s+/g, ' ').trim())
    .filter((item) => item.length >= 4)
    .slice(0, 2);
};

const buildInsightLines = (insight: NonNullable<AnalysisData['keyInsights']>[number]) => {
  const evidence = cleanEvidence(insight.evidence);
  return {
    insight: (insight.insight || '').replace(/\s+/g, ' ').trim(),
    significance: (insight.significance || '').replace(/\s+/g, ' ').trim(),
    evidence,
  };
};

/* ─────────────── Component ─────────────── */
export default function JournalAnalysis({ journalId, journal, user, showToast }: JournalAnalysisProps) {
  const { isDarkMode, currentTheme, elementColors } = useTheme();
  // show full texts by default

  const [data, setData] = useState<AnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [analysisCount, setAnalysisCount] = useState<number>(0);
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const mountedRef = useRef(true);
  
  // Action Options Modal state
  const [selectedAction, setSelectedAction] = useState<ActionData | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);

  /* ── Theme-derived palette ── */
  const dk = isDarkMode;
  const tp = currentTheme.primary;   // e.g. #4299E1
  const th = currentTheme.hover;     // e.g. #3182CE
  const ta = currentTheme.active;    // e.g. #2B6CB0
  const eBtn = elementColors.button;
  const eTxt = elementColors.text;

  // Derived tints
  const p15 = rgba(tp, 0.15);
  const p20 = rgba(tp, 0.20);
  const p30 = rgba(tp, 0.30);
  const p12 = rgba(tp, 0.12);
  const h20 = rgba(th, 0.20);
  const h15 = rgba(th, 0.15);
  const lightTint = lighten(tp, 0.85);   // very light version of primary
  const lighterTint = lighten(tp, 0.92);
  const lightestTint = lighten(tp, 0.96);
  const darkTint = darken(tp, 0.65);     // very dark version for dark-mode bg
  const darkerTint = darken(tp, 0.75);
  const darkestTint = darken(tp, 0.85);

  /* ── Keyframes: theme-aware ── */
  const KEYFRAMES = useMemo(() => `
@keyframes ja-slideUp{0%{opacity:0;transform:translateY(20px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes ja-fadeIn{0%{opacity:0}to{opacity:1}}
@keyframes ja-shimmer{0%{background-position:-200% center}to{background-position:200% center}}
@keyframes ja-pulseGlow{0%,100%{box-shadow:0 0 12px ${rgba(tp, 0.25)}, 0 0 24px ${rgba(tp, 0.1)}}50%{box-shadow:0 0 24px ${rgba(tp, 0.5)}, 0 0 48px ${rgba(tp, 0.2)}}}
@keyframes ja-ring{0%{transform:scale(1);opacity:.4}50%{transform:scale(1.2);opacity:.1}to{transform:scale(1.4);opacity:0}}
@keyframes ja-barGrow{from{width:0;opacity:0}to{opacity:1}}
@keyframes ja-float{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-6px) rotate(3deg)}}
@keyframes ja-scaleIn{0%{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
@keyframes ja-slideInLeft{0%{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
@keyframes ja-expandDown{0%{opacity:0;max-height:0}to{opacity:1;max-height:500px}}
@keyframes ja-glow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.15)}}
@keyframes ja-spin{to{transform:rotate(360deg)}}
`, [tp]);

  const c = useMemo(() => ({
    // ─── backgrounds ───
    headerBg: dk
      ? `linear-gradient(135deg, ${darkestTint} 0%, ${darkerTint} 25%, ${darkTint} 60%, ${ta} 100%)`
      : `linear-gradient(135deg, ${lightestTint} 0%, ${lighterTint} 35%, ${lightTint} 70%, ${lighten(tp, 0.5)} 100%)`,
    headerShadow: dk
      ? `0 12px 48px ${rgba(ta, 0.6)}, 0 4px 16px ${rgba(darkestTint, 0.4)}, inset 0 1px 0 ${rgba(tp, 0.15)}`
      : `0 8px 32px ${rgba(tp, 0.15)}, 0 2px 8px ${rgba(tp, 0.08)}, inset 0 1px 0 rgba(255,255,255,.9)`,
    headerBorder: dk ? p20 : rgba(tp, 0.3),
    contentBg: dk ? rgba(darkerTint, 0.75) : rgba(lightestTint, 0.85),
    contentBorder: dk ? p15 : rgba(tp, 0.25),
    cardBg: dk
      ? `linear-gradient(135deg, ${rgba(darkerTint, 0.95)}, ${rgba(darkTint, 0.8)})`
      : `linear-gradient(135deg, rgba(255,255,255,0.95), ${rgba(lightestTint, 0.9)})`,
    cardBorder: dk ? p12 : rgba(tp, 0.15),
    cardShadow: dk 
      ? `0 4px 24px rgba(0,0,0,.3), 0 2px 8px rgba(0,0,0,.15)` 
      : `0 4px 20px ${rgba(tp, 0.08)}, 0 2px 10px ${rgba(tp, 0.04)}`,
    sectionBg: dk
      ? `linear-gradient(135deg, ${rgba(darkTint, 0.8)}, ${rgba(ta, 0.5)})`
      : `linear-gradient(135deg, ${rgba(lightestTint, 0.95)}, ${rgba(lighterTint, 0.9)})`,
    expandBg: dk ? rgba(darkerTint, 0.6) : 'rgba(255,255,255,0.98)',
    // ─── text ───
    title: dk ? lighten(tp, 0.8) : darken(tp, 0.6),
    subtitle: dk ? rgba(lighten(tp, 0.6), 0.75) : rgba(tp, 0.75),
    accent: dk ? lighten(tp, 0.5) : tp,
    accentSoft: dk ? rgba(lighten(tp, 0.4), 0.85) : rgba(tp, 0.75),
    body: eTxt,
    muted: dk ? lighten(tp, 0.65) : '#6B7280',
    pill: dk ? rgba(tp, 0.18) : rgba(tp, 0.1),
    pillBorder: dk ? rgba(lighten(tp, 0.35), 0.2) : rgba(tp, 0.15),
    // ─── decorative ───
    decor1: dk 
      ? `radial-gradient(circle at center, ${rgba(tp, 0.15)} 0%, ${rgba(tp, 0.05)} 40%, transparent 70%)` 
      : `radial-gradient(circle at center, ${rgba(tp, 0.1)} 0%, ${rgba(tp, 0.03)} 40%, transparent 70%)`,
    decor2: dk 
      ? `radial-gradient(circle at center, ${rgba(th, 0.12)} 0%, ${rgba(th, 0.04)} 40%, transparent 70%)` 
      : `radial-gradient(circle at center, ${rgba(th, 0.08)} 0%, ${rgba(th, 0.02)} 40%, transparent 70%)`,
    dot: dk ? p30 : p20,
    barBg: dk ? rgba(darkTint, 0.5) : '#E5E7EB',
    // ─── modal ───
    overlay: dk ? 'rgba(0,0,0,.7)' : 'rgba(0,0,0,.4)',
    modalBg: dk 
      ? `linear-gradient(145deg, ${rgba(darkerTint, 0.98)}, ${rgba(darkTint, 0.95)})` 
      : `linear-gradient(145deg, rgba(255,255,255,0.98), ${rgba(lighterTint, 0.95)})`,
    modalBorder: dk ? rgba(tp, 0.3) : rgba(tp, 0.35),
    modalShadow: dk
      ? `0 32px 80px rgba(0,0,0,.6), 0 16px 40px rgba(0,0,0,.4), 0 0 0 1px ${p15}`
      : `0 32px 80px ${rgba(tp, 0.2)}, 0 16px 40px ${rgba(tp, 0.1)}, 0 0 0 1px ${rgba(tp, 0.25)}`,
    btnGhost: dk ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.03)',
    btnGhostBorder: dk ? rgba(lighten(tp, 0.35), 0.12) : rgba(tp, 0.12),
    // ─── buttons ───
    primaryGrad: `linear-gradient(135deg, ${eBtn} 0%, ${th} 100%)`,
    primaryGradFull: `linear-gradient(135deg, ${eBtn} 0%, ${th} 40%, ${lighten(th, 0.15)} 100%)`,
    primaryShadow: `0 6px 24px ${rgba(eBtn, 0.5)}, 0 3px 12px ${rgba(eBtn, 0.3)}, inset 0 1px 0 rgba(255,255,255,.2)`,
    primaryShadowSm: `0 6px 20px ${rgba(eBtn, 0.45)}, 0 3px 10px ${rgba(eBtn, 0.25)}`,
    // ─── re-analyze button ───
    reanalyzeBg: dk ? rgba(tp, 0.18) : rgba(tp, 0.1),
    reanalyzeColor: dk ? lighten(tp, 0.65) : ta,
    reanalyzeBorder: dk ? rgba(lighten(tp, 0.35), 0.2) : rgba(tp, 0.15),
    reanalyzeShadow: dk ? `0 2px 8px ${rgba(tp, 0.15)}` : `0 2px 8px ${rgba(tp, 0.08)}`,
    // ─── summary ───
    summaryBg: dk
      ? `linear-gradient(135deg, ${rgba(tp, 0.12)}, ${rgba(th, 0.08)})`
      : `linear-gradient(135deg, ${rgba(lighterTint, 0.9)}, ${rgba(lighten(th, 0.9), 0.95)})`,
    summaryBorder: dk ? rgba(tp, 0.18) : rgba(lighten(th, 0.65), 0.9),
    summaryShadow: dk ? `0 4px 16px ${rgba(tp, 0.1)}` : `0 4px 16px ${rgba(tp, 0.08)}`,
    summaryText: dk ? lighten(tp, 0.8) : darken(tp, 0.55),
    // ─── confidence badge ───
    badgeBg: dk
      ? `linear-gradient(135deg, ${rgba(darkTint, 0.9)}, ${rgba(ta, 0.7)})`
      : 'linear-gradient(135deg, rgba(249,250,251,0.98), rgba(243,244,246,0.95))',
    badgeColor: dk ? lighten(tp, 0.5) : '#6B7280',
    badgeBorder: dk ? rgba(tp, 0.12) : 'rgba(229,231,235,.6)',
    // ─── emotion bars ───
    barGrad: `linear-gradient(90deg, ${eBtn} 0%, ${th} 50%, ${lighten(th, 0.25)} 100%)`,
    barGlow: dk ? `0 0 12px ${rgba(eBtn, 0.5)}, 0 0 6px ${rgba(th, 0.3)}` : `0 0 8px ${rgba(eBtn, 0.2)}`,
    // ─── neutral topic ───
    neutralTopicBg: dk 
      ? `linear-gradient(135deg, ${rgba(tp, 0.18)}, ${rgba(th, 0.1)})` 
      : `linear-gradient(135deg, ${rgba(lighterTint, 0.8)}, ${rgba(lighten(th, 0.88), 0.85)})`,
    neutralTopicBorder: dk ? p20 : rgba(lighten(th, 0.6), 0.8),
    neutralTopicColor: dk ? lighten(tp, 0.65) : ta,
    // ─── insight border ───
    insightBorder: dk ? eBtn : th,
    insightBg: dk 
      ? `linear-gradient(90deg, ${rgba(eBtn, 0.08)}, transparent)` 
      : `linear-gradient(90deg, ${rgba(tp, 0.04)}, transparent)`,
    // ─── recommendation cards ───
    recBg: dk
      ? `linear-gradient(135deg, ${rgba(tp, 0.1)}, ${rgba(th, 0.05)})`
      : `linear-gradient(135deg, ${rgba(lightestTint, 0.95)}, ${rgba(lighten(th, 0.9), 0.9)})`,
    recBorder: dk ? rgba(darkTint, 0.7) : rgba(lighten(th, 0.75), 0.9),
    recShadow: dk ? `0 2px 12px rgba(0,0,0,.2)` : `0 2px 12px ${rgba(tp, 0.06)}`,
    recAreaGrad: dk 
      ? `linear-gradient(135deg, ${lighten(tp, 0.35)}, ${lighten(th, 0.35)})` 
      : `linear-gradient(135deg, ${eBtn}, ${th})`,
    // ─── loading ───
    loadingText: dk ? lighten(tp, 0.65) : darken(tp, 0.55),
    loadingSubtext: dk ? rgba(tp, 0.75) : rgba(tp, 0.65),
    ringBorder1: dk ? p30 : p20,
    ringBorder2: dk ? h20 : h15,
    centerGlowBg: dk
      ? `linear-gradient(135deg, ${rgba(darkTint, 0.9)}, ${rgba(ta, 0.7)})`
      : `linear-gradient(135deg, ${rgba(lighterTint, 0.95)}, ${rgba(lightTint, 0.85)})`,
    shimmerGrad: `linear-gradient(90deg, transparent, ${eBtn}, ${th}, transparent)`,
    // ─── glassmorphism ───
    glassBlur: 'blur(16px)',
    glassBorder: dk ? `1px solid ${rgba(tp, 0.2)}` : `1px solid ${rgba(tp, 0.15)}`,
  }), [dk, tp, th, ta, eBtn, eTxt, darkTint, darkerTint, darkestTint, lightTint, lighterTint, lightestTint, p12, p15, p20, p30, h15, h20]);

  /* ── Fetch journal analysis count ── */
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchAnalysisCount = async () => {
      if (!user) return;
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) return;

        const res = await fetch(`${supabaseUrl}/rest/v1/journals?select=analysis_count&journal_id=eq.${journalId}&user_id=eq.${user.id}`, {
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
        });
        if (res.ok) {
          const journals = await res.json();
          if (journals && journals.length > 0) {
            setAnalysisCount(journals[0].analysis_count || 0);
          }
        }
      } catch (err) {
        console.warn('[JournalAnalysis] Failed to fetch analysis count:', err);
      }
    };
    fetchAnalysisCount();
  }, [journalId, user]);

  /* ── Load saved analysis ── */
  const loadSaved = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/journal/${journalId}/analysis`);
      if (!res.ok) return;
      const json = await res.json();
      const analyses = json.analyses || json.data || [];
      if (analyses.length > 0) {
        const latest = analyses[0];
        const key = await getEncryptionKey(user.id);
        const decrypted = await decryptTextRaw(latest.result_encrypted, latest.result_iv, key);
        setData(JSON.parse(decrypted));
        setAnalyzedAt(latest.updated_at || latest.created_at);
      }
    } catch (err) {
      console.warn('[JournalAnalysis] load failed:', err);
    }
  }, [journalId, user]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = pendingKeyForJournal(journalId);
    const hasPending = Boolean(window.localStorage.getItem(key));

    if (!hasPending) {
      setIsAnalyzing(false);
      return;
    }

    setIsAnalyzing(true);

    const registry = (window as any).__forceAnalysisJobs as Map<string, Promise<void>> | undefined;
    const runningJob = registry?.get(journalId);

    // If a previous instance left a stale pending key, clear it and recover UI.
    if (!runningJob) {
      window.localStorage.removeItem(key);
      setIsAnalyzing(false);
      void loadSaved();
      return;
    }

    // When the in-memory background job finishes, sync UI state in this instance.
    void runningJob.finally(() => {
      if (!mountedRef.current) return;
      setIsAnalyzing(false);
      void loadSaved();
    });
  }, [journalId, loadSaved]);

  /* ── Analyze ── */
  const handleAnalyze = async () => {
    if (!journal || !user) return;

    if (typeof window !== 'undefined') {
      const registry = (window as any).__forceAnalysisJobs as Map<string, Promise<void>> | undefined;
      if (registry?.has(journalId)) {
        setIsAnalyzing(true);
        showToast('Analysis is already running in the background', 'info');
        return;
      }
    }

    setIsAnalyzing(true);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(pendingKeyForJournal(journalId), new Date().toISOString());
    }

    const runAnalysis = async () => {
      if (!journal || !user) return;
      const analysisInputContent = journal.content || '';

    try {
      const res = await fetch('/api/analysis/text/single', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journalId,
          decrypted_title: journal.title,
          decrypted_content: analysisInputContent,
          resolved_content: analysisInputContent,
          analysis_type: 'combined',
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Analysis failed');
      }
      const { data: result, model_used } = await res.json();
      if (mountedRef.current) {
        setData(result);
        setAnalyzedAt(new Date().toISOString());
      }

      const key = await getEncryptionKey(user.id);
      const { ciphertext, iv } = await encryptTextRaw(JSON.stringify(result), key);
      const wordCount = analysisInputContent.trim().split(/\s+/).filter(Boolean).length;

      await fetch(`/api/journal/${journalId}/analysis`, {
        method: 'PUT',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result_encrypted: ciphertext,
          result_iv: iv,
          is_encrypted: true,
          analysis_type: 'combined',
          model_used: model_used || 'claude-haiku',
          word_count: wordCount,
        }),
      });
      
      // Increment local analysis count
      if (mountedRef.current) {
        setAnalysisCount(prev => prev + 1);
        showToast('Analysis complete and saved!', 'success');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[JournalAnalysis] failed:', err);
      
      // Check if limit reached
      if (message.includes('limit reached') || message.includes('Analysis limit reached')) {
        if (mountedRef.current) {
            showToast('This entry can only be analyzed once.', 'error');
        }
      } else {
        if (mountedRef.current) {
          showToast(`Analysis failed: ${message}`, 'error');
        }
      }
    } finally {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(pendingKeyForJournal(journalId));
      }
      if (mountedRef.current) {
        setIsAnalyzing(false);
      }
    }
    };

    if (typeof window !== 'undefined') {
      const globalWindow = window as any;
      if (!globalWindow.__forceAnalysisJobs) {
        globalWindow.__forceAnalysisJobs = new Map<string, Promise<void>>();
      }

      const registry = globalWindow.__forceAnalysisJobs as Map<string, Promise<void>>;
      const job = runAnalysis().finally(() => {
        registry.delete(journalId);
      });
      registry.set(journalId, job);
      await job;
      return;
    }

    await runAnalysis();
  };

  const toggle = (s: string) => setExpanded(p => ({ ...p, [s]: !p[s] }));

  /* ─────────────── Collapsible Section helper ─────────────── */
  const Section = ({ id, icon, label, children, delay = 0 }: {
    id: string; icon: React.ReactNode; label: string; children: React.ReactNode; delay?: number;
  }) => (
    <div className="rounded-xl overflow-hidden" style={{
      border: `1px solid ${c.cardBorder}`,
      background: c.cardBg,
      boxShadow: dk ? '0 2px 10px rgba(0,0,0,.2)' : '0 2px 10px rgba(60,40,20,.06)',
    }}>
      <button
        onClick={() => toggle(id)}
        className="flex items-center justify-between w-full text-left px-5 py-4"
        style={{ background: c.sectionBg, borderBottom: `1px solid ${c.cardBorder}` }}
      >
        <h3 className="text-sm font-semibold tracking-wide flex items-center gap-2.5" style={{ color: c.accent }}>
          {icon} {label}
        </h3>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300" style={{
          background: c.pill,
          transform: expanded[id] ? 'rotate(180deg)' : 'rotate(0deg)',
          border: `1px solid ${c.pillBorder}`,
        }}>
          <ChevronDown size={16} style={{ color: c.accent }} />
        </div>
      </button>
      {expanded[id] && (
        <div className="px-5 pb-5 pt-3" style={{
          backgroundColor: c.expandBg,
          animation: 'ja-expandDown .2s ease-out',
        }}>
          {children}
        </div>
      )}
    </div>
  );

  /* ─────────────── RENDER ─────────────── */
  return (
    <div className="mt-4 min-w-0 pt-2 sm:mt-6 sm:pt-4" style={{ animation: 'ja-slideUp .25s ease-out' }}>
      <style>{KEYFRAMES}</style>

      {/* ━━━ Header ━━━ */}
      <div className="rounded-2xl p-4 sm:p-5" style={{
        background: c.headerBg,
        boxShadow: dk ? '0 3px 14px rgba(0,0,0,.24)' : '0 3px 14px rgba(62,38,22,.08)',
        border: `1px solid ${c.headerBorder}`,
      }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12" style={{
              background: c.primaryGradFull,
              boxShadow: 'none',
            }}>
              <Brain size={20} className="text-white sm:hidden" />
              <Brain size={22} className="hidden text-white sm:block" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight sm:text-xl" style={{ color: c.title }}>
                Journal Analysis
              </h2>
              {analyzedAt ? (
                <p className="mt-0.5 text-xs font-medium sm:text-sm" style={{ color: c.subtitle }}>
                  Last analyzed {new Date(analyzedAt).toLocaleString()} • {analysisCount}/{SINGLE_ENTRY_ANALYSIS_LIMIT} analysis used
                </p>
              ) : (
                <p className="mt-0.5 text-xs font-medium sm:text-sm" style={{ color: c.subtitle }}>
                  Focused insight for this entry • {analysisCount}/{SINGLE_ENTRY_ANALYSIS_LIMIT} analysis used
                </p>
              )}
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {/* Show/Hide Toggle */}
            {data && (
              <button
                onClick={() => setIsVisible(!isVisible)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-300 hover:scale-105 active:scale-[0.97] sm:flex-none sm:px-4"
                style={{
                  background: c.reanalyzeBg,
                  color: c.reanalyzeColor,
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${c.reanalyzeBorder}`,
                }}
              >
                {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                {isVisible ? 'Hide' : 'Show'}
              </button>
            )}
            {data && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={isAnalyzing || analysisCount >= SINGLE_ENTRY_ANALYSIS_LIMIT}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-300 hover:scale-105 active:scale-[0.97] sm:flex-none sm:px-4"
                style={{
                  background: c.reanalyzeBg,
                  color: c.reanalyzeColor,
                  backdropFilter: 'blur(12px)',
                  border: `1px solid ${c.reanalyzeBorder}`,
                  opacity: (isAnalyzing || analysisCount >= SINGLE_ENTRY_ANALYSIS_LIMIT) ? 0.5 : 1,
                  cursor: (analysisCount >= SINGLE_ENTRY_ANALYSIS_LIMIT) ? 'not-allowed' : 'pointer',
                }}
                title={analysisCount >= SINGLE_ENTRY_ANALYSIS_LIMIT ? 'Analysis already completed for this entry' : ''}
              >
                <RefreshCw size={13} className={isAnalyzing ? 'animate-spin' : ''} />
                Re-analyze
              </button>
            )}
            {!data && !isAnalyzing && (
              <button
                onClick={handleAnalyze}
                disabled={analysisCount >= SINGLE_ENTRY_ANALYSIS_LIMIT}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 sm:w-auto sm:px-5"
                style={{
                  background: analysisCount >= SINGLE_ENTRY_ANALYSIS_LIMIT ? c.muted : c.primaryGradFull,
                  boxShadow: analysisCount >= SINGLE_ENTRY_ANALYSIS_LIMIT ? 'none' : c.primaryShadow,
                  opacity: analysisCount >= SINGLE_ENTRY_ANALYSIS_LIMIT ? 0.6 : 1,
                  cursor: analysisCount >= SINGLE_ENTRY_ANALYSIS_LIMIT ? 'not-allowed' : 'pointer',
                }}
                title={analysisCount >= SINGLE_ENTRY_ANALYSIS_LIMIT ? 'Analysis already completed for this entry' : ''}
              >
                <Zap size={15} />
                {analysisCount >= SINGLE_ENTRY_ANALYSIS_LIMIT ? 'Analyzed' : 'Analyze Entry'}
              </button>
            )}
          </div>
        </div>
      </div>

      {isAnalyzing && (
        <div className="mt-3 flex items-start gap-3 rounded-xl px-3 py-3 sm:px-4" style={{
          background: dk ? 'rgba(56,189,248,0.14)' : 'rgba(224,242,254,0.95)',
          border: `1px solid ${dk ? 'rgba(125,211,252,0.35)' : 'rgba(59,130,246,0.35)'}`,
          boxShadow: 'none',
        }}>
          <Loader2 size={16} className="animate-spin mt-0.5" style={{ color: dk ? '#7dd3fc' : '#1d4ed8' }} />
          <div>
            <div className="text-sm font-bold" style={{ color: dk ? '#dbeafe' : '#1e3a8a' }}>
              Analysis is running in background
            </div>
            <div className="text-xs mt-0.5" style={{ color: dk ? 'rgba(219,234,254,0.82)' : '#1e40af' }}>
              You can keep using the app while this finishes. We will send a notification when analysis is complete.
            </div>
          </div>
        </div>
      )}

      {/* ━━━ Content area ━━━ */}
      {isVisible && (
      <div className="rounded-b-2xl border border-t-0 p-3 transition-colors duration-300 sm:p-5" style={{
        backgroundColor: c.contentBg,
        borderColor: c.contentBorder,
        backdropFilter: 'blur(8px)',
      }}>

        {/* ── Loading ── */}
        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-16" style={{ animation: 'ja-fadeIn .3s ease-out' }}>
            <Loader2 size={22} className="animate-spin" style={{ color: c.accent }} />
            <p className="text-base font-semibold mt-4" style={{ color: c.loadingText }}>
              Analyzing your journal entry...
            </p>
            <p className="text-sm mt-1" style={{ color: c.loadingSubtext }}>
              Extracting concrete patterns and actions.
            </p>
          </div>
        )}

        {/* ── Results ── */}
        {data && !isAnalyzing && (
          <div className="space-y-6">

            {/* Hero Summary */}
            {data && (
              <div className="mb-4 rounded-xl p-4 sm:mb-6 sm:p-6" style={{
                background: dk ? 'rgba(30,41,59,0.45)' : 'rgba(255,255,255,0.85)',
                border: `1px solid ${c.cardBorder}`,
              }}>
                <h3 className="mb-2 text-base font-semibold sm:text-lg" style={{ color: c.title }}>
                  Thought Threads Summary
                </h3>
                <p className="text-sm leading-relaxed break-words whitespace-normal" style={{ color: c.body }}>
                  {humanizeText(generateHeroSummary(data))}
                </p>
              </div>
            )}

            {journal && (
              <CognitionEngineWorkspace
                journalId={journalId}
                entryText={`${journal.title || ''}\n${journal.content || ''}`}
                showToast={showToast}
              />
            )}
          </div>
        )}

        {!data && !isAnalyzing && journal && (
          <div className="mb-6">
            <CognitionEngineWorkspace
              journalId={journalId}
              entryText={`${journal.title || ''}\n${journal.content || ''}`}
              showToast={showToast}
            />
          </div>
        )}
      </div>
      )}

      {/* ━━━ Re-analyze confirmation modal ━━━ */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: c.overlay, backdropFilter: 'blur(6px)', animation: 'ja-fadeIn .2s ease-out' }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 shadow-2xl sm:p-7"
            style={{
              background: c.modalBg,
              border: `1px solid ${c.modalBorder}`,
              boxShadow: c.modalShadow,
              animation: 'ja-scaleIn .35s cubic-bezier(0.34, 1.56, 0.64, 1)',
              backdropFilter: c.glassBlur,
              WebkitBackdropFilter: c.glassBlur,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-5 relative" style={{
                background: c.primaryGradFull,
                boxShadow: c.primaryShadow,
              }}>
                <RefreshCw size={28} className="text-white" style={{ 
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.25))' 
                }} />
                <div className="absolute inset-0 rounded-2xl bg-linear-to-t from-transparent via-transparent to-white/10" />
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: c.title }}>
                Re-analyze Entry?
              </h3>
              <p className="text-sm leading-relaxed font-medium" style={{ color: c.subtitle }}>
                This will replace your current analysis with a fresh AI-generated one.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-300 hover:scale-105 active:scale-[0.97] hover:brightness-[1.05] sm:px-5"
                style={{
                  background: c.btnGhost,
                  color: c.muted,
                  border: `1px solid ${c.btnGhostBorder}`,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowConfirm(false); handleAnalyze(); }}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white transition-all duration-300 hover:scale-105 active:scale-[0.97] sm:px-5"
                style={{
                  background: c.primaryGrad,
                  boxShadow: c.primaryShadow,
                }}
              >
                Re-analyze
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Options Modal */}
      <ActionOptionsModal
        action={selectedAction}
        journalId={journalId}
        isOpen={showActionModal}
        onClose={() => {
          setShowActionModal(false);
          setSelectedAction(null);
        }}
        onSuccess={(message) => {
          showToast(message, 'success');
        }}
        onError={(message) => {
          showToast(message, 'error');
        }}
      />
    </div>
  );
}

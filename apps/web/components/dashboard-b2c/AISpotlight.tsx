"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, RefreshCw } from "lucide-react";
import { useTheme } from "@/utilities/context/ThemeContext";
import { getEncryptionKey } from "@/utils/encryption/keyManager";
import { decryptText } from "@/utils/encryption/crypto";
import { createClient } from "@/utils/supabase/client";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface SuggestionData {
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
}

interface InsightItem {
  id: string;
  icon: string;
  title: string;
  body: string;
  accent: string;
  metric?: string;
}

interface EncryptedAnalysis {
  id: string;
  journal_id: string;
  result_encrypted: string;
  result_iv: string;
  updated_at: string;
}

interface AISpotlightProps {
  suggestions?: SuggestionData;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function suggestionsToInsights(s: SuggestionData): InsightItem[] {
  const items: InsightItem[] = [];
  items.push({
    id: "mood-trend",
    icon: "📈",
    title: `${s.moodTrends.primaryMood} trend detected`,
    body: `Your recent entries show a ${s.moodTrends.trend} trend of ${s.moodTrends.primaryMood.toLowerCase()}.${s.moodTrends.intensity > 0.7 ? " This emotion has been particularly strong." : ""}`,
    accent: "#ad6d5a",
  });
  items.push({
    id: "ai-nudge",
    icon: "💡",
    title: s.aiNudge.theme,
    body: s.aiNudge.suggestion,
    accent: "#5f9f93",
    metric: s.aiNudge.action,
  });
  items.push({
    id: "pattern",
    icon: "🔁",
    title: s.patternInsight.pattern,
    body: s.patternInsight.exploration,
    accent: "#7a8f66",
  });
  return items;
}

function computeQuickInsights(
  decryptedResults: object[],
): InsightItem[] {
  const insights: InsightItem[] = [];
  const patterns: Record<string, number> = {};
  let totalStress = 0;
  let stressCount = 0;
  let totalSentiment = 0;
  let sentimentCount = 0;

  for (const data of decryptedResults) {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.topics)) {
      (d.topics as { topic: string; sentiment: number }[]).forEach((t) => {
        const name = t.topic.toLowerCase();
        patterns[name] = (patterns[name] || 0) + 1;
      });
    }
    const ep = d.emotionalPatterns as { primaryEmotions?: { emotion: string; intensity: number }[] } | undefined;
    if (ep?.primaryEmotions) {
      const stress = ep.primaryEmotions.find(
        (e) => e.emotion.toLowerCase().includes("stress") || e.emotion.toLowerCase().includes("anxious")
      );
      if (stress) { totalStress += stress.intensity; stressCount++; }
    }
    const sentiment = d.overallSentiment as { score?: number } | undefined;
    if (sentiment?.score !== undefined) { totalSentiment += sentiment.score; sentimentCount++; }
  }

  const topPatterns = Object.entries(patterns).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const first = topPatterns[0];
  if (first && first[1] >= 3) {
    insights.push({
      id: `pat-${first[0]}`,
      icon: "🔁",
      title: `${first[0].charAt(0).toUpperCase() + first[0].slice(1)} keeps coming up`,
      body: `You've mentioned "${first[0]}" ${first[1]} times this week.`,
      accent: "#ad6d5a",
      metric: `${first[1]}x mentioned`,
    });
  }

  if (stressCount >= 3) {
    const avgStress = totalStress / stressCount;
    if (avgStress > 0.6) {
      insights.push({
        id: "stress",
        icon: "😰",
        title: "Stress levels are elevated",
        body: "Your entries show high stress this week. Consider trying a calming activity.",
          accent: "#8a6a58",
        metric: `${Math.round(avgStress * 100)}%`,
      });
    } else if (avgStress < 0.3) {
      insights.push({
        id: "stress-low",
        icon: "😌",
        title: "Stress is well managed",
        body: "Keep doing what you're doing , your stress levels are low!",
            accent: "#7a8f66",
      });
    }
  }

  if (sentimentCount >= 3) {
    const avgSentiment = totalSentiment / sentimentCount;
    if (avgSentiment > 0.3) {
      insights.push({
        id: "sentiment-pos",
        icon: "✨",
        title: "Your mood is positive",
        body: `${Math.round(((avgSentiment + 1) / 2) * 100)}% positive sentiment this week.`,
        accent: "#5f9f93",
        metric: "Great week!",
      });
    } else if (avgSentiment < -0.3) {
      insights.push({
        id: "sentiment-neg",
        icon: "💙",
        title: "Mood trending down",
        body: "This week has been tough. Check your action cards for helpful suggestions.",
        accent: "#7f5a4e",
      });
    }
  }

  return insights;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function AISpotlight({ suggestions }: AISpotlightProps) {
  const { isDarkMode } = useTheme();
  const [quickInsights, setQuickInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedInsightIds, setExpandedInsightIds] = useState<Set<string>>(new Set());

  // Fetch & decrypt insights from /api/insights/quick
  useEffect(() => {
    let cancelled = false;
    async function fetchQuick() {
      try {
        const res = await fetch("/api/insights/quick");
        if (!res.ok) return;
        const data: { analyses: EncryptedAnalysis[]; journalCount: number } = await res.json();
        if (!data.analyses?.length) return;

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const key = await getEncryptionKey(user.id);
        const decrypted: object[] = [];
        for (const a of data.analyses) {
          try {
            const plain = await decryptText(a.result_encrypted, a.result_iv, key);
            decrypted.push(JSON.parse(plain));
          } catch { /* skip */ }
        }
        if (!cancelled) setQuickInsights(computeQuickInsights(decrypted));
      } catch { /* silently fail */ } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchQuick();
    return () => { cancelled = true; };
  }, []);

  // Merge all insights
  const allInsights = useMemo(() => {
    const fromSuggestions = suggestions ? suggestionsToInsights(suggestions) : [];
    return [...fromSuggestions, ...quickInsights];
  }, [suggestions, quickInsights]);

  // Cycle
  const cycleNext = () => {
    if (allInsights.length > 0) {
      setActiveIndex((prev) => (prev + 1) % allInsights.length);
    }
  };

  const toggleInsightBody = (insightId: string) => {
    setExpandedInsightIds((prev) => {
      const next = new Set(prev);
      if (next.has(insightId)) {
        next.delete(insightId);
      } else {
        next.add(insightId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="rounded-(--radius-hero) border p-5 animate-pulse" style={{ borderColor: 'rgba(159,120,100,0.24)', background: 'rgba(255,248,243,0.78)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-6 h-6 rounded bg-muted/40" />
          <div className="h-4 w-32 rounded bg-muted/40" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-muted/40" />
          <div className="h-3 w-3/4 rounded bg-muted/40" />
        </div>
      </div>
    );
  }

  if (allInsights.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-(--radius-hero) border border-dashed p-5"
        style={{ background: isDarkMode ? "rgba(255,255,255,0.02)" : "rgba(255,248,244,0.86)", borderColor: 'rgba(177,124,110,0.24)' }}
      >
        <div className="flex items-center gap-3 text-[#7e564b]">
          <Zap className="w-5 h-5 text-[#a25f4b]" />
          <div>
            <p className="text-sm font-medium text-[#5e3d34]">No insights yet</p>
            <p className="text-xs opacity-70">Write & analyze a few entries to unlock AI insights.</p>
          </div>
        </div>
      </motion.section>
    );
  }

  const current = allInsights[activeIndex % allInsights.length];
  if (!current) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className="rounded-(--radius-hero) border border-border/40 overflow-hidden"
      style={{
        background: isDarkMode
          ? `linear-gradient(135deg, ${current.accent}08, ${current.accent}04)`
          : `linear-gradient(135deg, rgba(255,250,246,0.96), ${current.accent}0a)`,
        borderColor: 'rgba(177,124,110,0.24)',
      }}
    >
      <div className="p-5 sm:p-6 lg:p-7">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: current.accent }} />
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: current.accent }}
            >
              AI Spotlight
            </span>
          </div>
          {allInsights.length > 1 && (
            <button
              onClick={cycleNext}
              className="flex items-center gap-1 text-xs text-[#7a5348] hover:text-[#5f3e35] transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> {activeIndex + 1}/{allInsights.length}
            </button>
          )}
        </div>

        {/* Insight card with animation */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">{current.icon}</span>
              <div className="flex-1 min-w-0">
                {(() => {
                  const isExpanded = expandedInsightIds.has(current.id);
                  const shouldClamp = current.body.length > 160;
                  return (
                    <>
                <h3
                  className="font-semibold text-sm mb-1"
                  style={{ fontFamily: "var(--font-serif)", color: '#503731' }}
                >
                  {current.title}
                </h3>
                <p className={`text-sm lg:text-base leading-relaxed text-[#654942] overflow-hidden transition-all duration-300 ${!isExpanded && shouldClamp ? 'max-h-24' : 'max-h-96'}`}>
                  {current.body}
                </p>
                {shouldClamp && (
                  <button
                    type="button"
                    onClick={() => toggleInsightBody(current.id)}
                    className="mt-2 text-xs font-semibold text-[#6e4d45] hover:text-[#553a34]"
                  >
                    {isExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
                    </>
                  );
                })()}
                {current.metric && (
                  <span
                    className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full text-[11px] font-bold"
                    style={{ background: `${current.accent}15`, color: current.accent }}
                  >
                    <Zap className="w-3 h-3" />
                    {current.metric}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dots indicator */}
        {allInsights.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-border/20">
            {allInsights.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className="transition-all duration-200"
                style={{
                  width: i === activeIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === activeIndex ? current.accent : isDarkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
}

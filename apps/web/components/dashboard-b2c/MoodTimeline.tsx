"use client";

import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, Smile, Meh, Frown } from "lucide-react";
import { useTheme } from "@/utilities/context/ThemeContext";

interface MoodTimelineProps {
  stats?: {
    weeklyEntries?: number;
    averageMood?: string;
    mostProductiveDay?: string;
  };
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MOOD_DOT: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  positive: { color: "#5f9f93", icon: <Smile className="w-3 h-3" />, label: "Positive" },
  neutral:  { color: "#ad6d5a", icon: <Meh className="w-3 h-3" />,   label: "Neutral" },
  negative: { color: "#7f5a4e", icon: <Frown className="w-3 h-3" />,  label: "Negative" },
  none:     { color: "transparent", icon: null, label: "No entry" },
};

function mapMoodToType(mood: string | undefined): "positive" | "neutral" | "negative" {
  if (!mood) return "neutral";
  const lower = mood.toLowerCase();
  if (["happy", "calm", "excited", "grateful", "hopeful", "positive"].some((m) => lower.includes(m)))
    return "positive";
  if (["sad", "frustrated", "anxious", "stressed", "tired", "negative"].some((m) => lower.includes(m)))
    return "negative";
  return "neutral";
}

export default function MoodTimeline({ stats }: MoodTimelineProps) {
  const { isDarkMode } = useTheme();

  if (!stats) return null;

  const weeklyEntries = stats.weeklyEntries ?? 0;
  const moodType = mapMoodToType(stats.averageMood);
  const mood = (MOOD_DOT[moodType] ?? MOOD_DOT["neutral"])!;
  const productiveDay = stats.mostProductiveDay;
  const weeklyCoverage = Math.max(0, Math.min(100, Math.round((weeklyEntries / 7) * 100)));
  const weeklyBand = weeklyEntries >= 5 ? "Strong" : weeklyEntries >= 3 ? "Steady" : weeklyEntries >= 1 ? "Building" : "Quiet";
  const weeklyNudge = weeklyEntries >= 5
    ? "Great rhythm this week. Keep your momentum with one short check-in tomorrow."
    : weeklyEntries >= 3
    ? "You are building consistency. A quick evening reflection keeps this streak alive."
    : weeklyEntries >= 1
    ? "A little momentum is here. Try one 3-minute entry to reinforce the habit."
    : "No entries yet this week. Start with one line about how today felt.";

  // Build 7-day dots - highlight productive day, dim others
  const dots = DAYS.map((day) => {
    const isProductive = productiveDay?.toLowerCase().startsWith(day.toLowerCase().slice(0, 3));
    return { day, active: isProductive, moodType: isProductive ? moodType : "none" as const };
  });

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      className="rounded-(--radius-hero) border overflow-hidden"
      style={{ background: isDarkMode ? "rgba(255,255,255,0.02)" : "#fff8f2", borderColor: 'rgba(159,120,100,0.24)' }}
    >
      <div className="h-full p-5 sm:p-6 lg:p-7 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-base font-semibold flex items-center gap-2"
            style={{ fontFamily: 'var(--dashboard-heading-font, var(--font-serif))', letterSpacing: '0.035em', color: '#4f342b' }}
          >
            <TrendingUp className="w-4 h-4 text-[#9f6958]" />
            This Week
          </h3>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: `${mood.color}18`, color: mood.color }}
          >
            {weeklyEntries} {weeklyEntries === 1 ? "entry" : "entries"}
          </span>
        </div>

        {/* Day dots row */}
        <div className="flex items-center justify-between gap-1">
          {dots.map((dot, i) => {
            const dotColor = dot.active ? MOOD_DOT[dot.moodType]?.color : undefined;
            return (
              <motion.div
                key={dot.day}
                className="flex flex-col items-center gap-2"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Dot */}
                <div className="relative">
                  <div
                    className="w-8 h-8 sm:w-9 sm:h-9 lg:w-11 lg:h-11 rounded-full flex items-center justify-center border transition-all"
                    style={
                      dot.active
                        ? {
                            background: `${dotColor}20`,
                            borderColor: `${dotColor}60`,
                            boxShadow: `0 0 12px ${dotColor}30`,
                          }
                        : {
                            background: isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(248,238,231,0.72)",
                            borderColor: isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(159,120,100,0.2)",
                          }
                    }
                  >
                    {dot.active ? (
                      <span style={{ color: dotColor }}>{MOOD_DOT[dot.moodType]?.icon}</span>
                    ) : (
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(123,89,72,0.22)",
                        }}
                      />
                    )}
                  </div>
                </div>
                {/* Label */}
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color: dot.active ? dotColor : undefined,
                    opacity: dot.active ? 1 : 0.5,
                  }}
                >
                  {dot.day}
                </span>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-border/30 space-y-3 flex-1 flex flex-col">
          {/* Average mood row */}
          {stats.averageMood && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs">
                <span style={{ color: mood.color }}>{mood.icon}</span>
                <span className="text-[#775247]">Average mood:</span>
                <span className="font-semibold capitalize text-[#5a3e34]">{stats.averageMood}</span>
              </span>
            </div>

          )}

          {/* Weekly coverage meter */}
          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: 'rgba(159,120,100,0.2)', background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,250,245,0.82)' }}>
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[#6c4a40]">Weekly rhythm</span>
              <span className="font-bold" style={{ color: mood.color }}>{weeklyBand}</span>
            </div>
            <div className="h-2 w-full rounded-full" style={{ background: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(145,111,93,0.16)' }}>
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${weeklyCoverage}%`, background: `linear-gradient(90deg, ${mood.color}, ${mood.color}cc)` }}
              />
            </div>
            <div className="mt-1.5 text-[11px] text-[#7b5950]">
              {weeklyEntries} of 7 days logged
              {productiveDay ? ` • Peak day: ${productiveDay}` : ''}
            </div>
          </div>

          {/* Nudge row */}
          <div className="mt-auto rounded-xl border px-3 py-2 text-[12px] leading-relaxed" style={{ borderColor: 'rgba(159,120,100,0.2)', background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,248,242,0.86)', color: '#6c4a40' }}>
            {weeklyNudge}
          </div>
        </div>
      </div>
    </motion.section>
  );
}

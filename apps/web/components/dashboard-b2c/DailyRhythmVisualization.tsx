"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Zap, Moon, Sun } from "lucide-react";
import { useTheme } from "@/utilities/context/ThemeContext";
import type { RhythmInsight } from "@/lib/dashboard/insights";

interface RhythmData {
  peakTime: string;
  peakLabel: string;
  restTime: string;
  energyPattern: "morning" | "midday" | "evening" | "night";
  suggestion: string;
  label?: string;
  insight?: string;
  times?: string[];
}

const RHYTHM_PATTERNS = {
  morning: {
    emoji: "🌅",
    color: "#d4a574",
    light: "#fff9e6",
    label: "Peak in morning",
    insight: "You're sharpest early. Honor this natural rhythm.",
    times: ["6-9am: Brain is clearest", "Write when fresh", "Big thinking now"],
  },
  midday: {
    emoji: "☀️",
    color: "#d9b74a",
    light: "#fffae0",
    label: "Peak at midday",
    insight: "Your energy rises through the morning. Use lunch time to shift gears.",
    times: ["11am-1pm: Decision time", "Social moment available", "Movement helps"],
  },
  evening: {
    emoji: "🌅",
    color: "#c9956f",
    light: "#f8ede2",
    label: "Evening clarity",
    insight: "Your thoughts deepen as day winds down. Evening reflection is your gift.",
    times: ["4-7pm: Reflection time", "Process feelings now", "Journal deeply"],
  },
  night: {
    emoji: "🌙",
    color: "#7a7f8f",
    light: "#e8e9f0",
    label: "Night thinker",
    insight: "You process best when it's quiet. Protect your evening thinking time.",
    times: ["8-11pm: Creative flow", "Ideas surface now", "Write freely"],
  },
};

type DailyRhythmVisualizationProps = {
  insight?: RhythmInsight | null;
};

export default function DailyRhythmVisualization({ insight }: DailyRhythmVisualizationProps) {
  const { isDarkMode } = useTheme();
  const [data, setData] = useState<RhythmData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (insight) {
          if (!cancelled) {
            setData({
              peakTime: "",
              peakLabel: "",
              restTime: "",
              energyPattern: insight.energyPattern,
              suggestion: "",
              label: insight.label,
              insight: insight.insight,
              times: insight.times,
            });
          }
          return;
        }
        const now = new Date();
        const hour = now.getHours();
        let pattern: RhythmData["energyPattern"] = "midday";

        if (hour >= 5 && hour < 11) pattern = "morning";
        else if (hour >= 11 && hour < 16) pattern = "midday";
        else if (hour >= 16 && hour < 21) pattern = "evening";
        else pattern = "night";

        setData({
          peakTime: "",
          peakLabel: "",
          restTime: "",
          energyPattern: pattern,
          suggestion: "",
        });
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [insight]);

  if (loading || !data) return null;

  const config = RHYTHM_PATTERNS[data.energyPattern];
  const label = data.label || config.label;
  const insightText = data.insight || config.insight;
  const times = data.times && data.times.length >= 3 ? data.times.slice(0, 3) : config.times;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className={`rounded-[30px] border overflow-hidden relative bg-gradient-to-br ${config.light} to-white`}
      style={{ borderColor: `${config.color}35` }}
    >
      {/* Animated time circle background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full border-2 opacity-5"
          style={{ borderColor: config.color }}
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 180, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full border opacity-3"
          style={{ borderColor: config.color }}
        />
      </div>

      <div className="p-6 sm:p-7 lg:p-8 relative z-10">
        {/* Header with emoji */}
        <div className="flex items-start gap-3 mb-5">
          <span className="text-4xl">{config.emoji}</span>
          <div>
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: config.color }}>
              Your rhythm
            </p>
            <h3 className="text-xl font-bold mt-0.5" style={{ fontFamily: 'var(--dashboard-heading-font, serif)', color: config.color }}>
              {label}
            </h3>
          </div>
        </div>

        {/* Central insight */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="rounded-2xl px-4 py-3 mb-5 border-2 backdrop-blur-sm"
          style={{ borderColor: `${config.color}30`, backgroundColor: `${config.color}08` }}
        >
          <p className="text-sm leading-relaxed font-medium" style={{ color: "#3a3a3a", fontFamily: 'var(--dashboard-body-font, sans-serif)' }}>
            {insightText}
          </p>
        </motion.div>

        {/* Time markers */}
        <div className="space-y-2">
          {times.map((time, idx) => (
            <motion.div
              key={time}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + idx * 0.08, duration: 0.3 }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ backgroundColor: `${config.color}12` }}
            >
              <Clock size={14} style={{ color: config.color }} />
              <span className="text-xs font-semibold" style={{ color: config.color }}>
                {time}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Bottom action */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-5 pt-5 border-t text-center"
          style={{ borderColor: `${config.color}20` }}
        >
          <p className="text-xs font-medium" style={{ color: config.color }}>
            ✨ Next entry fits best now
          </p>
        </motion.div>
      </div>
    </motion.section>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/utilities/context/ThemeContext";
import type { MindEnergyInsight } from "@/lib/dashboard/insights";

interface EnergyData {
  level: number; // 0-100
  state: "low" | "recovering" | "steady" | "flowing" | "peak";
  lastUpdated: Date;
  message?: string;
  hint?: string;
}

type MindEnergyPulseProps = {
  isNewUserContext?: boolean;
  insight?: MindEnergyInsight | null;
};

const STATE_CONFIG = {
  low: { label: "Restoring", color: "#a8736f", hue: 10, lightness: 45 },
  recovering: { label: "Regaining", color: "#b89f8f", hue: 30, lightness: 55 },
  steady: { label: "Grounded", color: "#7a9b8f", hue: 160, lightness: 50 },
  flowing: { label: "Flowing", color: "#6fa585", hue: 140, lightness: 48 },
  peak: { label: "Vibrant", color: "#5f9f93", hue: 165, lightness: 52 },
};

export default function MindEnergyPulse({ isNewUserContext = false, insight }: MindEnergyPulseProps) {
  const { isDarkMode } = useTheme();
  const [data, setData] = useState<EnergyData | null>(null);
  const [loading, setLoading] = useState(true);
  const newUserFlag = Boolean(isNewUserContext);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (insight) {
          if (!cancelled) {
            setData({
              level: insight.level,
              state: insight.state,
              lastUpdated: new Date(),
              message: insight.message,
              hint: insight.hint,
            });
          }
          return;
        }
        if (newUserFlag) {
          if (!cancelled) {
            setData({ level: 58, state: "steady", lastUpdated: new Date() });
          }
          return;
        }
        const res = await fetch("/api/momentum", { headers: { "Cache-Control": "no-cache" } });
        if (!res.ok) throw new Error("failed");
        const json = await res.json();
        if (!cancelled && json.consistency) {
          const score = json.consistency.score || 50;
          const adjustedScore = Math.min(85, Math.max(45, score));
          let state: EnergyData["state"] = "steady";
          if (adjustedScore < 52) state = "recovering";
          else if (adjustedScore < 62) state = "steady";
          else if (adjustedScore < 75) state = "flowing";
          else state = "peak";

          setData({ level: adjustedScore, state, lastUpdated: new Date() });
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [insight, newUserFlag]);

  if (loading || !data) return null;

  const config = STATE_CONFIG[data.state];
  const pulseScale = 1 + (data.level / 100) * 0.3;
  const description = data.message || (
    data.state === "low"
      ? "Today can be gentle. Focus on one calming thing that steadies you."
      : data.state === "recovering"
      ? "You're rebuilding momentum. A small, kind win is enough."
      : data.state === "steady"
      ? "You're grounded. This is a good moment to do something meaningful."
      : data.state === "flowing"
      ? "Your energy is moving. Lean into what matters most."
      : "You're vibrant right now. Use this clarity to tackle what's important."
  );
  const hint = data.hint || (
    data.state === "low" || data.state === "recovering"
      ? "Hydrate, rest early, journal gently."
      : data.state === "steady"
      ? "Set intention, write clearly, move slowly."
      : "Take action, create, share ideas."
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[30px] border overflow-hidden relative"
      style={{
        background: isDarkMode ? `hsla(${config.hue}, 25%, 15%, 0.85)` : `hsla(${config.hue}, 28%, 94%, 0.9)`,
        borderColor: `hsla(${config.hue}, 35%, 65%, 0.4)`,
        boxShadow: `0 12px 28px rgba(${parseInt(config.color.slice(1, 3), 16)}, ${parseInt(config.color.slice(3, 5), 16)}, ${parseInt(config.color.slice(5, 7), 16)}, 0.08)`,
      }}
    >
      <div className="p-5 sm:p-6 lg:p-7 relative z-10">
        {/* Background glow orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[30px]">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/3 left-1/4 w-32 h-32 rounded-full blur-3xl"
            style={{ background: config.color, opacity: 0.15 }}
          />
          <motion.div
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.2, 0.4] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            className="absolute bottom-1/4 right-1/4 w-40 h-40 rounded-full blur-3xl"
            style={{ background: config.color, opacity: 0.12 }}
          />
        </div>

        {/* Header */}
        <div className="relative z-20 mb-5">
          <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: config.color }}>
            Your current state
          </p>
          <h3 className="mt-2 text-3xl font-extrabold" style={{ fontFamily: 'var(--dashboard-heading-font, serif)', color: config.color }}>
            {config.label}
          </h3>
          <p className="mt-1 text-sm opacity-75" style={{ color: isDarkMode ? '#aaa' : '#666' }}>
            Energy level: <span className="font-semibold">{Math.round(data.level)}%</span>
          </p>
        </div>

        {/* Main pulse visualization */}
        <div className="relative z-20 flex items-center justify-center my-6">
          <div className="relative w-32 h-32 sm:w-40 sm:h-40">
            {/* Outer rings */}
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.1, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-full border-2"
              style={{ borderColor: config.color }}
            />
            <motion.div
              animate={{ scale: [1.05, 1.15, 1.05], opacity: [0.3, 0.05, 0.3] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
              className="absolute inset-2 rounded-full border-2"
              style={{ borderColor: config.color }}
            />

            {/* Central orb */}
            <motion.div
              animate={{ scale: [pulseScale, pulseScale * 0.95, pulseScale] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-4 rounded-full flex items-center justify-center font-extrabold text-2xl sm:text-3xl"
              style={{
                background: `radial-gradient(135deg, ${config.color}40, ${config.color}08)`,
                border: `2px solid ${config.color}`,
                color: config.color,
              }}
            >
              {Math.round(data.level)}
            </motion.div>
          </div>
        </div>

        {/* Simple description */}
        <div className="relative z-20 text-center mt-4 space-y-2">
          <p className="text-sm leading-relaxed opacity-80" style={{ fontFamily: 'var(--dashboard-body-font, sans-serif)' }}>
            {description}
          </p>
        </div>

        {/* Quick action hint */}
        <div className="relative z-20 mt-4 pt-4 border-t" style={{ borderColor: `${config.color}30` }}>
          <p className="text-xs opacity-60 text-center">
            {hint}
          </p>
        </div>
      </div>
    </motion.section>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, TrendingUp, Calendar, BookOpen, ChevronRight } from "lucide-react";
import { useTheme } from "@/utilities/context/ThemeContext";
import { useRouter } from "next/navigation";

interface ConsistencyData {
  level: "just_starting" | "easy" | "moderate" | "on_fire" | "unstoppable";
  label: string;
  emoji: string;
  description: string;
  score: number;
  streak: number;
  weeklyEntries: number;
  activeDaysLast30: number;
  totalEntries: number;
  progressToNext: number;
  nextLevel: string | null;
  nextLevelEmoji: string | null;
}

const LEVEL_COLORS: Record<ConsistencyData["level"], { ring: string; glow: string; bg: string }> = {
  just_starting: { ring: "#ad6d5a", glow: "rgba(173,109,90,0.24)", bg: "rgba(173,109,90,0.09)" },
  easy:          { ring: "#8a6a58", glow: "rgba(138,106,88,0.24)", bg: "rgba(138,106,88,0.09)" },
  moderate:      { ring: "#5f9f93", glow: "rgba(95,159,147,0.24)", bg: "rgba(95,159,147,0.09)" },
  on_fire:       { ring: "#7a8f66", glow: "rgba(122,143,102,0.26)", bg: "rgba(122,143,102,0.09)" },
  unstoppable:   { ring: "#6f4f43", glow: "rgba(111,79,67,0.28)", bg: "rgba(111,79,67,0.1)" },
};

function RingSVG({ score, color, trackColor, size = 120 }: { score: number; color: string; trackColor: string; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      {/* Progress */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - progress }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
      />
    </svg>
  );
}

function Skeleton() {
  return (
    <div className="rounded-(--radius-hero) border border-border/40 p-5 animate-pulse">
      <div className="flex items-center gap-5">
        <div className="w-30 h-30 rounded-full bg-muted/40" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-24 rounded bg-muted/40" />
          <div className="h-3 w-48 rounded bg-muted/40" />
          <div className="h-3 w-36 rounded bg-muted/40" />
        </div>
      </div>
    </div>
  );
}

export default function JourneyRing() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const [data, setData] = useState<ConsistencyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/momentum", { headers: { "Cache-Control": "no-cache" } });
        if (!res.ok) throw new Error("failed");
        const json = await res.json();
        if (!cancelled && json.consistency) setData(json.consistency as ConsistencyData);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Skeleton />;
  if (!data) return null;

  const colors = LEVEL_COLORS[data.level];
  const stats = [
    { icon: <Flame className="w-3.5 h-3.5" />, value: data.streak, label: "Day streak" },
    { icon: <TrendingUp className="w-3.5 h-3.5" />, value: data.weeklyEntries, label: "This week" },
    { icon: <Calendar className="w-3.5 h-3.5" />, value: data.activeDaysLast30, label: "Active / 30d" },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-(--radius-hero) border overflow-hidden"
      style={{ background: isDarkMode ? colors.bg : '#fff8f2', borderColor: 'rgba(159,120,100,0.24)' }}
    >
      <div className="p-5 sm:p-6 lg:p-7">
        <div className="flex flex-col sm:flex-row items-center gap-5 lg:gap-6">
          {/* Ring */}
          <div className="relative shrink-0">
            <RingSVG score={data.score} color={colors.ring} trackColor={isDarkMode ? 'rgba(255,241,232,0.24)' : 'rgba(159,120,100,0.2)'} size={120} />
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl">{data.emoji}</span>
              <span className="text-xs font-bold mt-0.5" style={{ color: colors.ring }}>
                {data.score}
              </span>
            </div>
            {/* Glow */}
            <div
              className="absolute inset-0 rounded-full blur-xl -z-10"
              style={{ background: colors.glow }}
            />
          </div>

          {/* Content */}
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <h3 className="font-semibold text-base" style={{ fontFamily: 'var(--dashboard-heading-font, var(--font-serif))', letterSpacing: '0.035em', color: '#4f342b' }}>
                {data.label}
              </h3>
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: `${colors.ring}20`, color: colors.ring }}
              >
                Lvl {data.level === "just_starting" ? 1 : data.level === "easy" ? 2 : data.level === "moderate" ? 3 : data.level === "on_fire" ? 4 : 5}
              </span>
            </div>

            <p className="text-sm lg:text-base leading-relaxed mb-3 max-w-sm lg:max-w-md" style={{ color: '#715248', fontFamily: 'var(--dashboard-body-font, inherit)', letterSpacing: '0.02em' }}>
              {data.description}
            </p>

            {/* Stat pills */}
            <div className="flex flex-wrap justify-center sm:justify-start gap-2 lg:gap-3">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border/50"
                  style={{ background: isDarkMode ? "rgba(255,255,255,0.04)" : "rgba(255,249,245,0.95)", borderColor: 'rgba(159,120,100,0.2)' }}
                >
                  <span style={{ color: colors.ring }}>{s.icon}</span>
                  <span className="font-bold">{s.value}</span>
                  <span className="text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Progress to next level */}
        {data.nextLevel && (
          <div className="mt-4 pt-4 border-t border-border/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span>Progress to {data.nextLevelEmoji} {data.nextLevel}</span>
              <span className="font-semibold" style={{ color: colors.ring }}>{data.progressToNext}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-border/30 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: colors.ring }}
                initial={{ width: 0 }}
                animate={{ width: `${data.progressToNext}%` }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.5 }}
              />
            </div>
          </div>
        )}

        {/* Total entries footer */}
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[#765247]">
            <BookOpen className="w-3 h-3" />
            <span>{data.totalEntries} total {data.totalEntries === 1 ? "entry" : "entries"}</span>
          </div>
          <button
            onClick={() => router.push("/journal/new")}
            className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: colors.ring }}
          >
            Write today <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.section>
  );
}

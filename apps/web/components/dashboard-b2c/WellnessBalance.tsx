"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Heart, Brain, Zap } from "lucide-react";
import { useTheme } from "@/utilities/context/ThemeContext";
import type { DashboardInsights, WellnessBalanceInsight } from "@/lib/dashboard/insights";

interface WellnessBalance {
  emotional: number; // 0-100
  mental: number; // 0-100
  physical: number; // 0-100
  balanced: boolean;
  message: string;
  priority: "emotional" | "mental" | "physical";
}

type WellnessBalanceProps = {
  isNewUserContext?: boolean;
  insight?: WellnessBalanceInsight | null;
  dashboardInsights?: DashboardInsights | null;
};

const MIN_MEANINGFUL_ENTRIES = 5;

export default function WellnessBalance({ isNewUserContext = false, insight, dashboardInsights }: WellnessBalanceProps) {
  const { isDarkMode } = useTheme();
  const [data, setData] = useState<WellnessBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const newUserFlag = Boolean(isNewUserContext);
  const currentStateInsight = dashboardInsights?.mindEnergy || null;
  const rhythmInsight = dashboardInsights?.rhythm || null;
  const sourceEntryCount = dashboardInsights?.sourceEntryCount ?? 0;
  const hasMeaningfulHistory = dashboardInsights ? sourceEntryCount >= MIN_MEANINGFUL_ENTRIES : null;
  const showIntroState = newUserFlag || hasMeaningfulHistory === false;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let next: WellnessBalance | null = null;
      try {
        if (showIntroState) {
          if (!cancelled) {
            setData(null);
            setLoading(false);
          }
          return;
        }
        if (insight) {
          const diff = Math.max(insight.emotional, insight.mental, insight.physical) - Math.min(insight.emotional, insight.mental, insight.physical);
          next = {
            emotional: insight.emotional,
            mental: insight.mental,
            physical: insight.physical,
            balanced: diff < 20,
            message: insight.message,
            priority: insight.priority,
          };
        } else if (newUserFlag) {
          next = {
            emotional: 62,
            mental: 58,
            physical: 60,
            balanced: true,
            message: "We will learn your rhythm as you write. Start with one small check-in.",
            priority: "emotional",
          };
        } else {
          const res = await fetch("/api/momentum", { headers: { "Cache-Control": "no-cache" } });
          if (!res.ok) throw new Error("failed");
          const json = await res.json();
          if (json.consistency) {
            const baseScore = json.consistency.score || 50;
            const adjustedScore = Math.min(85, Math.max(50, baseScore));
            const emotional = Math.max(55, Math.min(100, adjustedScore + 6));
            const mental = Math.max(52, Math.min(95, adjustedScore - 2));
            const physical = Math.max(50, Math.min(92, adjustedScore + 1));

            const diff = Math.max(emotional, mental, physical) - Math.min(emotional, mental, physical);
            const balanced = diff < 20;

            let priority: WellnessBalance["priority"] = "emotional";
            if (physical < mental && physical < emotional) priority = "physical";
            else if (mental < emotional && mental < physical) priority = "mental";

            let message = "";
            if (balanced) {
              message = "You're carrying well. Keep this balance alive.";
            } else if (priority === "emotional") {
              message = "Your heart wants a little attention. Give yourself space to feel.";
            } else if (priority === "mental") {
              message = "Your mind wants some room. A slower pace and clarity will help.";
            } else {
              message = "Your body wants care. Move gently, rest, and nourish.";
            }

            next = {
              emotional: Math.round(emotional),
              mental: Math.round(mental),
              physical: Math.round(physical),
              balanced,
              message,
              priority,
            };
          }
        }
      } catch {
        // use default below
      } finally {
        if (!cancelled) {
          setData(
            next ?? {
              emotional: 62,
              mental: 58,
              physical: 60,
              balanced: true,
              message: "We will learn your rhythm as you write. Start with one small check-in.",
              priority: "emotional",
            }
          );
          setLoading(false);
        }
      }
    }
    setLoading(true);
    load();
    return () => { cancelled = true; };
  }, [insight, showIntroState]);

  if (loading) return null;

  if (showIntroState) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        className="rounded-[30px] border overflow-hidden relative h-full"
        style={{
          background: isDarkMode ? "rgba(60, 40, 35, 0.4)" : "#eef8f1",
          borderColor: "rgba(111,165,133,0.22)",
          boxShadow: "0 12px 28px rgba(111,165,133,0.08)",
        }}
      >
        <div className="p-6 sm:p-7 lg:p-8 relative z-10 flex h-full flex-col justify-between">
          <div>
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#6fa585" }}>
                Wellness check
              </p>
              <h3 className="text-2xl font-bold mt-1" style={{ fontFamily: 'var(--dashboard-heading-font, serif)', color: "#6fa585" }}>
                We’ll learn your balance as you write
              </h3>
            </div>

            <div className="rounded-xl px-4 py-3 mb-4 border-2 backdrop-blur-sm text-center" style={{ borderColor: "rgba(111,165,133,0.18)", backgroundColor: "rgba(111,165,133,0.06)" }}>
              <p className="text-sm font-medium leading-relaxed" style={{ color: isDarkMode ? '#E5E7EB' : '#2a2a2a', fontFamily: 'var(--dashboard-body-font, sans-serif)' }}>
                Keep journaling for a bit longer and this card will reflect your own emotional, mental, and physical patterns instead of guesswork.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 mb-6">
              <div className={`rounded-2xl border p-4 backdrop-blur-sm ${isDarkMode ? 'border-slate-600/70 bg-slate-950/45' : 'border-white/50 bg-white/45'}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${isDarkMode ? 'text-slate-400' : 'text-[#7c7b72]'}`}>Current state</p>
                <p className="mt-2 text-lg font-bold" style={{ color: "#6fa585" }}>
                  Not enough history yet
                </p>
                <p className={`mt-1 text-sm leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-[#4a4945]'}`}>
                  A grounded readout will appear after there’s a little more context.
                </p>
              </div>

              <div className={`rounded-2xl border p-4 backdrop-blur-sm ${isDarkMode ? 'border-slate-600/70 bg-slate-950/45' : 'border-white/50 bg-white/45'}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${isDarkMode ? 'text-slate-400' : 'text-[#7c7b72]'}`}>Your rhythm</p>
                <p className="mt-2 text-lg font-bold" style={{ color: "#6fa585" }}>
                  Patterns will appear soon
                </p>
                <p className={`mt-1 text-sm leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-[#4a4945]'}`}>
                  Once your writing builds up, this area will show timing cues that come from your own entries.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-lg px-3 py-2 text-center text-xs font-semibold ${isDarkMode ? 'bg-slate-950/35 text-slate-300' : 'bg-white/55 text-[#5d5a54]'}`}>🧘 Sit</div>
            <div className={`rounded-lg px-3 py-2 text-center text-xs font-semibold ${isDarkMode ? 'bg-slate-950/35 text-slate-300' : 'bg-white/55 text-[#5d5a54]'}`}>👀 Notice</div>
            <div className={`rounded-lg px-3 py-2 text-center text-xs font-semibold ${isDarkMode ? 'bg-slate-950/35 text-slate-300' : 'bg-white/55 text-[#5d5a54]'}`}>💭 Reflect</div>
          </div>
        </div>
      </motion.section>
    );
  }

  if (!data) return null;

  const maxScore = Math.max(data.emotional, data.mental, data.physical);
  const priorityColors = {
    emotional: { color: "#c9687e", light: "#f8e8ed" },
    mental: { color: "#6fa585", light: "#e8f3ed" },
    physical: { color: "#d9a574", light: "#fef5e8" },
  };

  const priorityConfig = priorityColors[data.priority];

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className="rounded-[30px] border overflow-hidden relative h-full"
      style={{
        background: isDarkMode ? "rgba(60, 40, 35, 0.4)" : priorityConfig.light,
        borderColor: `${priorityConfig.color}40`,
        boxShadow: `0 12px 28px rgba(${parseInt(priorityConfig.color.slice(1, 3), 16)}, ${parseInt(priorityConfig.color.slice(3, 5), 16)}, ${parseInt(priorityConfig.color.slice(5, 7), 16)}, 0.08)`,
      }}
    >
      <div className="p-6 sm:p-7 lg:p-8 relative z-10">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: priorityConfig.color }}>
            Wellness check
          </p>
          <h3 className="text-2xl font-bold mt-1" style={{ fontFamily: 'var(--dashboard-heading-font, serif)', color: priorityConfig.color }}>
            {data.balanced ? "You're in balance" : "One area invites care"}
          </h3>
        </div>

        {(currentStateInsight || rhythmInsight) && (
          <div className="grid gap-3 sm:grid-cols-2 mb-6">
            {currentStateInsight && (
              <div className={`rounded-2xl border p-4 backdrop-blur-sm ${isDarkMode ? 'border-slate-600/70 bg-slate-950/45' : 'border-white/50 bg-white/45'}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${isDarkMode ? 'text-slate-400' : 'text-[#7c7b72]'}`}>Current state</p>
                <p className="mt-2 text-lg font-bold" style={{ color: priorityConfig.color }}>
                  {currentStateInsight.state === 'low' ? 'Restoring' : currentStateInsight.state === 'recovering' ? 'Regaining' : currentStateInsight.state === 'steady' ? 'Grounded' : currentStateInsight.state === 'flowing' ? 'Flowing' : 'Vibrant'}
                </p>
                <p className={`mt-1 text-sm leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-[#4a4945]'}`}>{currentStateInsight.message}</p>
                <p className={`mt-2 text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#7a786f]'}`}>{currentStateInsight.hint}</p>
              </div>
            )}

            {rhythmInsight && (
              <div className={`rounded-2xl border p-4 backdrop-blur-sm ${isDarkMode ? 'border-slate-600/70 bg-slate-950/45' : 'border-white/50 bg-white/45'}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${isDarkMode ? 'text-slate-400' : 'text-[#7c7b72]'}`}>Your rhythm</p>
                <p className="mt-2 text-lg font-bold" style={{ color: priorityConfig.color }}>
                  {rhythmInsight.label}
                </p>
                <p className={`mt-1 text-sm leading-relaxed ${isDarkMode ? 'text-slate-200' : 'text-[#4a4945]'}`}>{rhythmInsight.insight}</p>
                {rhythmInsight.times?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rhythmInsight.times.slice(0, 3).map((time) => (
                      <span key={time} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${isDarkMode ? 'border-slate-600 bg-slate-900/60 text-slate-300' : 'border-white/60 bg-white/60 text-[#6b665f]'}`}>
                        {time}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Three wellness bars */}
        <div className="space-y-4 mb-6">
          {/* Emotional */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Heart size={16} style={{ color: "#c9687e" }} />
                <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>Emotional</span>
              </div>
              <span className="text-xs font-bold" style={{ color: "#c9687e" }}>
                {data.emotional}%
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${data.emotional}%` }}
                transition={{ delay: 0.15, duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full bg-linear-to-r from-rose-300 to-red-300"
              />
            </div>
          </div>

          {/* Mental */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Brain size={16} style={{ color: "#6fa585" }} />
                <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>Mental</span>
              </div>
              <span className="text-xs font-bold" style={{ color: "#6fa585" }}>
                {data.mental}%
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${data.mental}%` }}
                transition={{ delay: 0.25, duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full bg-linear-to-r from-teal-300 to-green-300"
              />
            </div>
          </div>

          {/* Physical */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap size={16} style={{ color: "#d9a574" }} />
                <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>Physical</span>
              </div>
              <span className="text-xs font-bold" style={{ color: "#d9a574" }}>
                {data.physical}%
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${data.physical}%` }}
                transition={{ delay: 0.35, duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full bg-linear-to-r from-amber-300 to-orange-300"
              />
            </div>
          </div>
        </div>

        {/* Main message box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="rounded-xl px-4 py-3 mb-4 border-2 backdrop-blur-sm text-center"
          style={{ borderColor: `${priorityConfig.color}30`, backgroundColor: `${priorityConfig.color}08` }}
        >
          <p className="text-sm font-medium leading-relaxed" style={{ color: isDarkMode ? '#E5E7EB' : '#2a2a2a', fontFamily: 'var(--dashboard-body-font, sans-serif)' }}>
            {data.message}
          </p>
        </motion.div>

        {/* Quick care suggestions */}
        <div className="grid grid-cols-3 gap-2 text-xs text-center font-semibold">
          {data.priority === "emotional" && (
            <>
              <div className="rounded px-2 py-2 bg-white/40" style={{ color: "#c9687e" }}>
                💬 Talk
              </div>
              <div className="rounded px-2 py-2 bg-white/40" style={{ color: "#c9687e" }}>
                🎨 Create
              </div>
              <div className="rounded px-2 py-2 bg-white/40" style={{ color: "#c9687e" }}>
                🤝 Connect
              </div>
            </>
          )}
          {data.priority === "mental" && (
            <>
              <div className="rounded px-2 py-2 bg-white/40" style={{ color: "#6fa585" }}>
                🧘 Rest
              </div>
              <div className="rounded px-2 py-2 bg-white/40" style={{ color: "#6fa585" }}>
                📖 Read
              </div>
              <div className="rounded px-2 py-2 bg-white/40" style={{ color: "#6fa585" }}>
                🌳 Nature
              </div>
            </>
          )}
          {data.priority === "physical" && (
            <>
              <div className="rounded px-2 py-2 bg-white/40" style={{ color: "#d9a574" }}>
                🚶 Walk
              </div>
              <div className="rounded px-2 py-2 bg-white/40" style={{ color: "#d9a574" }}>
                😴 Sleep
              </div>
              <div className="rounded px-2 py-2 bg-white/40" style={{ color: "#d9a574" }}>
                💧 Hydrate
              </div>
            </>
          )}
        </div>
      </div>
    </motion.section>
  );
}

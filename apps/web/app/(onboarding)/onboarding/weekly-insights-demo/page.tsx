'use client';

import React from 'react';
import WeeklyEvolutionReport from '@/components/dashboard-b2c/WeeklyEvolutionReport';
import Link from 'next/link';
import { ArrowLeft, Sparkles, LayoutDashboard } from 'lucide-react';

/**
 * /onboarding/weekly-insights-demo
 *
 * Standalone demo page showing the Weekly Evolution Report & Cohort Spotlight Engine.
 * Features:
 * - Dynamic Hero Spotlight (Top 1% in Proactivity / Confidence / Words Spoken)
 * - 10 Familiar & Realistic Parameters
 * - Clickable Grounded Evidence Modal (journal quotes, audio transcripts, completed actions)
 * - Materialistic / Sci-Fi Grounded UI
 */
export default function WeeklyInsightsDemoPage() {
  return (
    <div className="min-h-screen bg-[#fcf8f3] py-8 px-4 sm:px-6 lg:px-8 text-[#2e2012]">
      {/* Top Demo Navigation Bar */}
      <header className="max-w-5xl mx-auto mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#e8d5c3] pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/onboarding/noonairos"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b5d36] hover:text-[#6a4220] transition-colors bg-white/80 border border-[#e8d5c3] px-3 py-1.5 rounded-xl shadow-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Onboarding</span>
          </Link>
          <span className="hidden sm:inline-block text-xs text-[#856347]/60">&bull;</span>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#8b5d36]">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>Weekly Engine Demo</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#8b5d36] hover:bg-[#744b29] px-3.5 py-1.5 rounded-xl shadow-xs transition-colors"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Go to Live Dashboard</span>
          </Link>
        </div>
      </header>

      {/* Main Report Component */}
      <main className="max-w-5xl mx-auto">
        <WeeklyEvolutionReport userName="Rohit" weekRange="Sep 26 – Oct 2, 2026" />
      </main>

      {/* Footer Documentation / Explainer */}
      <footer className="max-w-5xl mx-auto mt-12 pt-6 border-t border-[#e8d5c3] text-center text-xs text-[#856347] space-y-1">
        <p className="font-semibold text-[#2e2012]">
          FORCE Cognition Engine &bull; Weekly Progress & Cohort Benchmark System
        </p>
        <p>
          Under the hood, all 10 parameters are compared against user cohort distributions. The single highest score is dynamically crowned the Hero Spotlight of the week.
        </p>
      </footer>
    </div>
  );
}

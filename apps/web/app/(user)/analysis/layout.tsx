// apps/web/app/(user)/analysis/layout.tsx - Analysis Section Layout

"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSetNavItems } from "@/utilities/context/NavContext";
import { ANALYSIS_NAV_ITEMS } from "@/constants/navigation";
import { useTheme } from "@/utilities/context/ThemeContext";

const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(192, 38, 115, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function AnalysisLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { currentTheme, isDarkMode } = useTheme();
  const primary = currentTheme?.primary ?? '#8a6a58';
  const secondary = currentTheme?.secondary ?? '#b08873';
  const tertiary = currentTheme?.accent ?? '#7fa294';

  // Sets analysis nav items when this layout mounts
  // Clears them when unmounting (navigating away from /analysis/*)
  useSetNavItems(ANALYSIS_NAV_ITEMS, "Insights");

  const moduleTabs = [
    { href: "/analysis", label: "Sanctuary" },
    { href: "/analysis/entries", label: "Thought Threads" },
    { href: "/analysis/audio-analysis", label: "Voice Signals" },
    { href: "/analysis/advanced", label: "Pattern Map" },
  ];

  const shellBg = isDarkMode
    ? 'linear-gradient(180deg, #0b1120 0%, #0f1724 52%, #071226 100%)'
    : 'linear-gradient(180deg, #fdf8f3 0%, #f6ede4 52%, #efe7dc 100%)';

  const analysisText = isDarkMode ? '#E6EEF8' : '#35261f';
  const analysisMuted = isDarkMode ? '#94a3b8' : '#6b5547';
  const analysisSoft = isDarkMode ? '#071226' : '#f9f1ea';
  const analysisCard = isDarkMode ? 'rgba(2,6,23,0.6)' : '#fffaf5';

  return (
    <div
      className={`analysis-layout analysis-vibrance relative min-h-screen overflow-hidden pb-24 ${isDarkMode ? 'dark' : ''}`}
      style={{
        ['--analysis-primary' as string]: primary,
        ['--analysis-secondary' as string]: secondary,
        ['--analysis-tertiary' as string]: tertiary,
        ['--analysis-text' as string]: analysisText,
        ['--analysis-muted' as string]: analysisMuted,
        ['--analysis-soft' as string]: analysisSoft,
        ['--analysis-card' as string]: analysisCard,
        ['--analysis-shell-bg' as string]: shellBg,
        ['--analysis-overlay' as string]: isDarkMode
          ? `radial-gradient(980px 560px at 8% -12%, ${hexToRgba(secondary, 0.06)}, transparent 55%), radial-gradient(900px 520px at 94% 0%, ${hexToRgba(tertiary, 0.06)}, transparent 52%), rgba(2,6,23,0)`
          : `radial-gradient(980px 560px at 8% -12%, ${hexToRgba(secondary, 0.22)}, transparent 55%), radial-gradient(900px 520px at 94% 0%, ${hexToRgba(tertiary, 0.22)}, transparent 52%), rgba(255,255,255,0)`,
        background: isDarkMode
          ? `radial-gradient(980px 560px at 8% -12%, ${hexToRgba(secondary, 0.08)}, transparent 55%), radial-gradient(900px 520px at 94% 0%, ${hexToRgba(tertiary, 0.08)}, transparent 52%), ${shellBg}`
          : `radial-gradient(980px 560px at 8% -12%, ${hexToRgba(secondary, 0.22)}, transparent 55%), radial-gradient(900px 520px at 94% 0%, ${hexToRgba(tertiary, 0.22)}, transparent 52%), ${shellBg}`,
      }}
    >
      <div className="sticky top-0 z-20 border-b backdrop-blur-xl" style={{ borderColor: 'rgba(145,113,93,0.24)', background: 'rgba(252, 245, 237, 0.78)' }}>
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: '#8a705f' }}>Insight Atelier</p>
              <h1 className="text-xl font-bold tracking-[0.015em]" style={{ color: 'var(--analysis-text)', fontFamily: "'Iowan Old Style', 'Palatino Linotype', serif" }}>The Reflection Studio</h1>
            </div>
            <nav className="-mx-1 flex gap-2 overflow-x-auto pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible">
              {moduleTabs.map((tab) => {
                const isActive = pathname === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={[
                      "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:text-sm",
                      isActive ? "text-white shadow-sm" : "bg-white/90 hover:bg-white",
                    ].join(" ")}
                    style={
                      isActive
                        ? { borderColor: '#8f7564', background: 'linear-gradient(135deg, #987763, #7e9f92)' }
                        : { borderColor: 'rgba(147,114,95,0.34)', color: '#6a5548' }
                    }
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-10">
        {children}
      </div>

      <style jsx global>{`
        .analysis-layout {
          color: var(--analysis-text);
          font-family: 'Avenir Next', 'Segoe UI', 'Trebuchet MS', sans-serif;
        }

        .analysis-vibrance {
          background:
            radial-gradient(980px 560px at 8% -12%, ${hexToRgba(secondary, 0.22)}, transparent 55%),
            radial-gradient(900px 520px at 94% 0%, ${hexToRgba(tertiary, 0.22)}, transparent 52%),
            var(--analysis-shell-bg);
        }

        .analysis-vibrance .analysis-shell,
        .analysis-vibrance .analysis-layout {
          color: var(--analysis-text);
        }

        .analysis-vibrance h1,
        .analysis-vibrance h2,
        .analysis-vibrance h3,
        .analysis-vibrance h4 {
          font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif;
          letter-spacing: 0.01em;
        }

        .analysis-vibrance .card,
        .analysis-vibrance [class*="rounded-"][class*="border"] {
          border-color: rgba(145, 113, 93, 0.26);
        }

        /* Light-mode defaults use the analysis variables */
        .analysis-vibrance .bg-white,
        .analysis-vibrance .bg-card,
        .analysis-vibrance .bg-gray-50,
        .analysis-vibrance .bg-slate-50,
        .analysis-vibrance .bg-amber-50,
        .analysis-vibrance .bg-blue-50 {
          background-color: var(--analysis-card) !important;
        }

        .analysis-vibrance .text-gray-600,
        .analysis-vibrance .text-gray-700,
        .analysis-vibrance .text-slate-600,
        .analysis-vibrance .text-slate-700,
        .analysis-vibrance .text-muted-foreground {
          color: var(--analysis-muted) !important;
        }

        .analysis-vibrance .text-blue-700,
        .analysis-vibrance .text-indigo-700,
        .analysis-vibrance .text-amber-700,
        .analysis-vibrance .text-emerald-700 {
          color: var(--analysis-muted) !important;
        }

        .analysis-vibrance .bg-blue-600,
        .analysis-vibrance .bg-blue-500,
        .analysis-vibrance .bg-indigo-600,
        .analysis-vibrance .bg-emerald-600,
        .analysis-vibrance .bg-amber-600 {
          background: linear-gradient(135deg, var(--analysis-primary), var(--analysis-tertiary)) !important;
          color: #fff !important;
        }

        .analysis-vibrance .border-gray-200,
        .analysis-vibrance .border-slate-200,
        .analysis-vibrance .border-blue-200,
        .analysis-vibrance .border-amber-200 {
          border-color: rgba(147, 114, 95, 0.26) !important;
        }

        .analysis-vibrance input,
        .analysis-vibrance textarea,
        .analysis-vibrance select {
          border-color: rgba(147, 114, 95, 0.32) !important;
          background: var(--analysis-card) !important;
          color: var(--analysis-text) !important;
        }

        .analysis-vibrance [class*="text-[#4f1636]"],
        .analysis-vibrance [class*="text-[#612145]"],
        .analysis-vibrance [class*="text-[#8f2f61]"] {
          color: #35261f !important;
        }

        .analysis-vibrance [class*="text-[#7a2d55]"],
        .analysis-vibrance [class*="text-[#8a2c5b]"],
        .analysis-vibrance [class*="text-[#932e63]"],
        .analysis-vibrance [class*="text-[#a53168]"] {
          color: #6b5547 !important;
        }
        
        /* Dark-mode mappings for literal hex-based utility classes */
        .dark .analysis-vibrance [class*="text-[#4f1636]"],
        .dark .analysis-vibrance [class*="text-[#612145]"],
        .dark .analysis-vibrance [class*="text-[#8f2f61]"] {
          color: var(--analysis-text) !important;
        }

        .dark .analysis-vibrance [class*="text-[#7a2d55]"],
        .dark .analysis-vibrance [class*="text-[#8a2c5b]"],
        .dark .analysis-vibrance [class*="text-[#932e63]"],
        .dark .analysis-vibrance [class*="text-[#a53168]"] {
          color: var(--analysis-muted) !important;
        }

        .analysis-vibrance [class*="border-[#c02673]"],
        .analysis-vibrance [class*="border-[#de99bb]"],
        .analysis-vibrance [class*="border-[#d98ab2]"],
        .analysis-vibrance [class*="border-[#e5abc6]"],
        .analysis-vibrance [class*="border-[#efc0d5]"],
        .analysis-vibrance [class*="border-[#e9b4cd]"],
        .analysis-vibrance [class*="border-[#e4abc5]"],
        .analysis-vibrance [class*="border-[#e7b3cb]"] {
          border-color: rgba(147, 114, 95, 0.33) !important;
        }

        .analysis-vibrance [class*="bg-[#c02673]"],
        .analysis-vibrance [class*="data-[state=active]:bg-[#c02673]"] {
          background: linear-gradient(135deg, #9d7d68, #7f9f92) !important;
          color: #fff !important;
        }

        .analysis-vibrance [class*="bg-[#ffe7f3]"],
        .analysis-vibrance [class*="bg-[#ffe8f3]"],
        .analysis-vibrance [class*="bg-[#ffdced]"],
        .analysis-vibrance [class*="bg-[#fff6fb]"] {
          background: rgba(252, 245, 237, 0.92) !important;
        }

        .analysis-vibrance [class*="bg-[#fff1f8]"],
        .analysis-vibrance [class*="bg-[#fff2f9]"],
        .analysis-vibrance [class*="bg-[#fff3fa]"],
        .analysis-vibrance [class*="bg-[#fff4fa]"],
        .analysis-vibrance [class*="bg-[#fff8fc]"],
        .analysis-vibrance [class*="bg-[#fff9fd]"] {
          background: rgba(255, 249, 243, 0.94) !important;
        }

        .analysis-vibrance [class*="from-[#db2777]"],
        .analysis-vibrance [class*="to-[#ec4899]"],
        .analysis-vibrance [class*="to-[#be185d]"] {
          --tw-gradient-from: #9d7d68 var(--tw-gradient-from-position) !important;
          --tw-gradient-to: #7f9f92 var(--tw-gradient-to-position) !important;
          --tw-gradient-stops: var(--tw-gradient-from), #b08c74, var(--tw-gradient-to) !important;
        }

        .analysis-vibrance [class*="focus:ring-[#c02673]"] {
          --tw-ring-color: rgba(149, 117, 98, 0.6) !important;
        }

        .analysis-vibrance button,
        .analysis-vibrance a[class*="rounded"] {
          transition: transform 0.18s ease, box-shadow 0.2s ease;
        }

        .analysis-vibrance button:hover,
        .analysis-vibrance a[class*="rounded"]:hover {
          box-shadow: 0 10px 24px rgba(121, 93, 74, 0.16);
        }
        /* Dark-mode overrides when container has .dark */
        .dark .analysis-vibrance {
          color: var(--analysis-text);
        }

        .dark .analysis-vibrance .bg-white,
        .dark .analysis-vibrance .bg-card,
        .dark .analysis-vibrance .bg-gray-50,
        .dark .analysis-vibrance .bg-slate-50,
        .dark .analysis-vibrance .bg-amber-50,
        .dark .analysis-vibrance .bg-blue-50 {
          background-color: rgba(2,6,23,0.6) !important;
        }

        .dark .analysis-vibrance .text-gray-600,
        .dark .analysis-vibrance .text-gray-700,
        .dark .analysis-vibrance .text-slate-600,
        .dark .analysis-vibrance .text-slate-700,
        .dark .analysis-vibrance .text-muted-foreground {
          color: var(--analysis-muted) !important;
        }

        .dark .analysis-vibrance input,
        .dark .analysis-vibrance textarea,
        .dark .analysis-vibrance select {
          border-color: rgba(255,255,255,0.06) !important;
          background: rgba(2,6,23,0.5) !important;
          color: var(--analysis-text) !important;
        }

        /* Dark-mode fallback: remap any literal hex utility classes to dark-friendly vars */
        .dark .analysis-vibrance [class*="bg-[#"] {
          background-color: rgba(2,6,23,0.5) !important;
        }

        .dark .analysis-vibrance [class*="text-[#"] {
          color: var(--analysis-text) !important;
        }
      `}</style>
    </div>
  );
}
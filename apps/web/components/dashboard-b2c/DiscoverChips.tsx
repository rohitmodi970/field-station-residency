"use client";

import React from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useTheme } from "@/utilities/context/ThemeContext";
import {
  Zap,
  TrendingUp,
  BookOpen,
  Lightbulb,
  Image,
  MessageSquare,
  CheckSquare,
  BarChart3,
} from "lucide-react";

interface Chip {
  label: string;
  icon: React.ReactNode;
  path: string;
  gradient: string;
}

interface DiscoverChipsProps {
  title?: string;
  labelOverrides?: string[];
  orderOverrides?: number[];
}

const CHIPS: Chip[] = [
  {
    label: "Explore Trends",
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    path: "/analysis",
    gradient: "linear-gradient(135deg, #5f9f93, #7a8f66)",
  },
  {
    label: "Deep Insights",
    icon: <Zap className="w-3.5 h-3.5" />,
    path: "/analysis/sentiment-analysis",
    gradient: "linear-gradient(135deg, #ad6d5a, #8a6a58)",
  },
  {
    label: "Browse Journal",
    icon: <BookOpen className="w-3.5 h-3.5" />,
    path: "/journal",
    gradient: "linear-gradient(135deg, #7f5a4e, #6d7f64)",
  },
  {
    label: "Write Entry",
    icon: <Lightbulb className="w-3.5 h-3.5" />,
    path: "/journal/new",
    gradient: "linear-gradient(135deg, #c8a18f, #ad6d5a)",
  },
  {
    label: "Gallery",
    icon: <Image className="w-3.5 h-3.5" />,
    path: "/journal/gallery",
    gradient: "linear-gradient(135deg, #b88e7e, #7a8f66)",
  },
  // {
  //   label: "AI Assistant",
  //   icon: <MessageSquare className="w-3.5 h-3.5" />,
  //   path: "/assistant",
  //   gradient: "linear-gradient(135deg, #ad6d5a, #5f9f93)",
  // },
  {
    label: "To-Do",
    icon: <CheckSquare className="w-3.5 h-3.5" />,
    path: "/todo",
    gradient: "linear-gradient(135deg, #8a6a58, #5f9f93)",
  },
  {
    label: "Entry Analysis",
    icon: <BarChart3 className="w-3.5 h-3.5" />,
    path: "/analysis/entries",
    gradient: "linear-gradient(135deg, #ad6d5a, #5f9f93)",
  },
];

export default function DiscoverChips({ title, labelOverrides, orderOverrides }: DiscoverChipsProps) {
  const { isDarkMode } = useTheme();
  const router = useRouter();

  const resolvedOrder = Array.isArray(orderOverrides) && orderOverrides.length === CHIPS.length
    ? orderOverrides
    : CHIPS.map((_, index) => index);

  const resolvedChips = resolvedOrder
    .map((chipIndex) => CHIPS[chipIndex])
    .filter((chip): chip is Chip => Boolean(chip))
    .map((chip, index) => ({
      ...chip,
      label: labelOverrides?.[index] || chip.label,
    }));

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-(--radius-hero) border overflow-hidden"
      style={{ background: isDarkMode ? "rgba(255,255,255,0.02)" : "#fff8f2", borderColor: 'rgba(159,120,100,0.24)' }}
    >
      <div className="p-5 sm:p-6 lg:p-7">
        <h3
          className="text-base font-semibold mb-3"
          style={{ fontFamily: 'var(--dashboard-heading-font, var(--font-serif))', letterSpacing: '0.035em', color: '#4f342b' }}
        >
          {title || 'Discover'}
        </h3>
        <div className="flex flex-wrap gap-2 lg:gap-3">
          {resolvedChips.map((chip, i) => (
            <motion.button
              key={chip.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: i * 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
              onClick={() => router.push(chip.path)}
              className="group flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-medium border border-border/40 transition-all hover:scale-105 hover:shadow-md active:scale-95"
              style={{
                background: isDarkMode
                  ? "rgba(255,255,255,0.04)"
                  : "#fffdfa",
                borderColor: 'rgba(159,120,100,0.24)',
                color: isDarkMode ? undefined : '#6f4f43',
              }}
            >
              <span
                className="flex items-center justify-center w-5 h-5 rounded-full text-white shrink-0"
                style={{ background: chip.gradient }}
              >
                {chip.icon}
              </span>
              {chip.label}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

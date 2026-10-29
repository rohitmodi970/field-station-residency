"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { BookOpen, ChevronLeft, ChevronRight, ArrowRight, Loader2 } from "lucide-react";
import { useTheme } from "@/utilities/context/ThemeContext";
import { useRouter } from "next/navigation";
import { getAllJournalEntriesWithStatus } from "@/utilities/journal-data";
import type { JournalEntry } from "@/components/Journal/types";
import { resolveJournalTitle } from '@/utilities/journalTitle';
import type { EncryptionReadinessResult } from "@/utils/encryption";
import { createClient } from '@/utils/supabase/client';
import { isEncryptionInitialized } from '@/utils/encryption/keyManager';
import { decryptEntriesForAI } from '@/utils/encryption/decryptForAI';
import { useAiDecryption } from '@/utils/encryption/useAiDecryption';

interface MemoryEntry {
  id: string;
  title: string;
  preview: string;
  date: string;
  mood: string;
  moodColor: string;
}

interface PromptData {
  prompt?: {
    text?: string;
    explanation?: string;
  };
  suggestions?: {
    aiNudge?: {
      action?: string;
      suggestion?: string;
    };
  };
}

const EMPTY_STATE_FALLBACK = "Start your journaling journey - your memories will appear here.";

const MOOD_COLORS: Record<string, string> = {
  happy: "#5f9f93",
  great: "#5f9f93",
  excited: "#7a8f66",
  calm: "#ad6d5a",
  peaceful: "#ad6d5a",
  sad: "#7f5a4e",
  bad: "#7f5a4e",
  down: "#7f5a4e",
  angry: "#6f4f43",
  frustrated: "#6f4f43",
  anxious: "#8a6a58",
  nervous: "#8a6a58",
};

function getMoodColor(mood: string): string {
  const lower = mood.toLowerCase();
  for (const [key, color] of Object.entries(MOOD_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "#7a5a4d";
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MemoryCarousel() {
  const { isDarkMode } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [allEntries, setAllEntries] = useState<MemoryEntry[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [encryptionStatus, setEncryptionStatus] = useState<EncryptionReadinessResult | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [emptyStateSuggestion, setEmptyStateSuggestion] = useState(EMPTY_STATE_FALLBACK);

  const { decryptPromptCache } = useAiDecryption();

  const getDynamicEmptyStateSuggestion = async (): Promise<string> => {
    // Check localStorage cache first
    if (typeof window !== "undefined") {
      try {
        const cachedRaw = localStorage.getItem("promptData");
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as PromptData;
          const fromCache =
            cached?.suggestions?.aiNudge?.action ||
            cached?.suggestions?.aiNudge?.suggestion ||
            cached?.prompt?.explanation;

          if (fromCache && fromCache.trim().length > 0) {
            return fromCache;
          }
        }
      } catch {
        // Ignore cache parse issues and fall back to network.
      }
    }

    try {
      let response: Response;

      // For key_version >= 2 users, decrypt locally and POST so Claude
      // receives real journal content (server cannot decrypt key_version=2).
      if (isEncryptionInitialized()) {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const entries = await decryptEntriesForAI(user.id, 3);
            response = await fetch("/api/prompts/personalized", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ entries }),
            });
          } else {
            response = await fetch("/api/prompts/personalized", {
              headers: { "Cache-Control": "no-cache" },
            });
          }
        } catch {
          response = await fetch("/api/prompts/personalized", {
            headers: { "Cache-Control": "no-cache" },
          });
        }
      } else {
        // key_version=1 legacy path: server handles decrypt
        response = await fetch("/api/prompts/personalized", {
          headers: { "Cache-Control": "no-cache" },
        });
      }

      if (!response.ok) {
        return EMPTY_STATE_FALLBACK;
      }

      // The server now returns the full DB row (which may be encrypted).
      // decryptPromptCache handles v1 (legacy JSONB) and v2 (ECIES) transparently.
      const rawRow = await response.json();
      const data = await decryptPromptCache<PromptData>(rawRow);
      return (
        data?.suggestions?.aiNudge?.action ||
        data?.suggestions?.aiNudge?.suggestion ||
        data?.prompt?.explanation ||
        EMPTY_STATE_FALLBACK
      );
    } catch {
      return EMPTY_STATE_FALLBACK;
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getAllJournalEntriesWithStatus();
        const all = result.entries;
        setEncryptionStatus(result.encryptionStatus);
        if (cancelled) return;
        const mapped = all
          .filter((e: JournalEntry) => !e.isArchived)
          .sort((a: JournalEntry, b: JournalEntry) =>
            new Date(a.displayDate || a.createdAt || a.date).getTime() > new Date(b.displayDate || b.createdAt || b.date).getTime() ? -1 : 1
          )
          .map((e: JournalEntry) => ({
            
            id: e.journalId,
            title: resolveJournalTitle({
              title: e.title,
              date: e.date || e.createdAt,
              hasVoiceMedia: (e.mediaType || []).includes('audio') || ((e.mediaUrl?.audio?.length || 0) > 0),
              defaultTitle: 'Untitled',
            }),
            preview: (e.resolvedContent || e.content)
              ? (e.resolvedContent || e.content).length > 100
                ? (e.resolvedContent || e.content).substring(0, 100) + "…"
                : (e.resolvedContent || e.content)
              : "No content",
            date: (e.displayDate || e.createdAt || new Date()).toString(),
            mood: e.mood || "neutral",
            moodColor: getMoodColor(e.mood || "neutral"),
          }));
        setAllEntries(mapped);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEmptyStateSuggestion() {
      const suggestion = await getDynamicEmptyStateSuggestion();
      if (!cancelled) {
        setEmptyStateSuggestion(suggestion);
      }
    }

    loadEmptyStateSuggestion();
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = showAll ? allEntries.slice(0, 15) : allEntries.slice(0, 10);
  const shellClass = isDarkMode
    ? 'border-slate-700/70 bg-slate-900/75 text-slate-100'
    : 'border-[#d8bfb0]/60 bg-[#fff8f3]/88 text-[#4f342b]';
  const surfaceClass = isDarkMode
    ? 'border-slate-700/70 bg-slate-950/60 text-slate-100'
    : 'border-[#d8c2b5]/55 bg-[#fffdfa] text-[#4f342b]';
  const mutedTextClass = isDarkMode ? 'text-slate-400' : 'text-[#775247]';
  const buttonSurfaceClass = isDarkMode
    ? 'border-slate-600 bg-slate-800/90 text-slate-200'
    : 'border-[#d8bfb0] bg-[#fff9f5] text-[#775247]';

  // Update scroll indicators
  const updateScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    if (showAll) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    updateScroll();
    const el = scrollRef.current;
    if (el) el.addEventListener("scroll", updateScroll, { passive: true });
    return () => el?.removeEventListener("scroll", updateScroll);
  }, [entries, showAll]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 240;
    el.scrollBy({ left: dir === "left" ? -cardWidth : cardWidth, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className={`rounded-(--radius-hero) border p-6 flex items-center justify-center h-48 ${shellClass}`}>
        <Loader2 className={`w-6 h-6 animate-spin ${isDarkMode ? 'text-slate-300' : 'text-[#9f6958]'}`} />
      </div>
    );
  }

  if (encryptionStatus?.status === 'needs_unlock') {
    return (
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-(--radius-hero) border border-dashed p-8 text-center ${shellClass}`}
      >
        <BookOpen className={`w-8 h-8 mx-auto mb-3 ${isDarkMode ? 'text-slate-300/80' : 'text-[#9f6958]/70'}`} />
        <p className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-100' : 'text-[#563a30]'}`}>Unlock your encrypted memories</p>
        <p className={`text-xs mb-4 ${mutedTextClass}`}>
          Please sign out and sign back in to view encrypted entries on this device.
        </p>
      </motion.section>
    );
  }

  if (entries.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-(--radius-hero) border border-dashed p-8 text-center ${shellClass}`}
      >
        <BookOpen className={`w-8 h-8 mx-auto mb-3 ${isDarkMode ? 'text-slate-300/80' : 'text-[#9f6958]/70'}`} />
        <p className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-slate-100' : 'text-[#563a30]'}`}>No entries yet</p>
        <p className={`text-xs mb-4 ${mutedTextClass}`}>
          {emptyStateSuggestion}
        </p>
        <button
          onClick={() => router.push("/journal/new")}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium text-white transition-transform hover:scale-105"
          style={{ background: isDarkMode ? 'linear-gradient(135deg, #475569, #0f766e)' : 'linear-gradient(135deg, #9f6958, #7a8f66)' }}
        >
          Write first entry <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-base font-semibold flex items-center gap-2"
          style={{ fontFamily: 'var(--dashboard-heading-font, var(--font-serif))', letterSpacing: '0.035em', color: isDarkMode ? '#e5e7eb' : '#4f342b' }}
        >
          <BookOpen className={`w-4 h-4 ${isDarkMode ? 'text-slate-300' : 'text-[#9f6958]'}`} />
          Recent Memories
        </h3>
        <div className="flex items-center gap-1.5">
          {allEntries.length > 10 && (
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className={`text-xs font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-[#765247] hover:text-[#5b3e35]'}`}
            >
              {showAll ? "Shrink list" : "Expand list"}
            </button>
          )}

          {/* Scroll arrows */}
          {!showAll && (
            <>
              <button
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-opacity disabled:opacity-20 ${buttonSurfaceClass}`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => scroll("right")}
                disabled={!canScrollRight}
                className={`w-7 h-7 rounded-full border flex items-center justify-center transition-opacity disabled:opacity-20 ${buttonSurfaceClass}`}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => router.push("/journal")}
            className={`text-xs font-medium transition-colors ml-1 ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-[#765247] hover:text-[#5b3e35]'}`}
          >
            View all <ArrowRight className="w-3 h-3 inline" />
          </button>
        </div>
      </div>

      {/* Scrollable row */}
      <div className="relative">
        {/* Fade edges */}
        {!showAll && canScrollLeft && (
          <div
            className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
            style={{
              background: isDarkMode
                ? "linear-gradient(to right, rgba(0,0,0,0.6), transparent)"
                : "linear-gradient(to right, rgba(255,248,243,0.96), transparent)",
            }}
          />
        )}
        {!showAll && canScrollRight && (
          <div
            className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
            style={{
              background: isDarkMode
                ? "linear-gradient(to left, rgba(0,0,0,0.6), transparent)"
                : "linear-gradient(to left, rgba(255,248,243,0.96), transparent)",
            }}
          />
        )}

        <div
          ref={showAll ? undefined : scrollRef}
          className={showAll
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            : "flex gap-3 overflow-x-auto scrollbar-hide pb-1"}
          style={showAll ? undefined : { scrollSnapType: "x mandatory" }}
        >
          {entries.map((entry, i) => (
            <motion.button
              key={entry.id}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => router.push(`/journal/${entry.id}`)}
              className={showAll
                ? "w-full rounded-(--radius-hero) border border-border/40 p-4 lg:p-5 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 group"
                : "shrink-0 w-56 lg:w-64 xl:w-72 rounded-(--radius-hero) border border-border/40 p-4 lg:p-5 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 group"}
              style={{
                scrollSnapAlign: showAll ? undefined : "start",
                background: isDarkMode ? 'rgba(15,23,42,0.75)' : '#fffdfa',
                borderColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(159,120,100,0.24)',
              }}
            >
              {/* Mood dot + date */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: entry.moodColor }}
                />
                <span className={`text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-muted-foreground'}`}>
                  {formatRelativeDate(entry.date)}
                </span>
              </div>

              {/* Topic/title */}
              {/* <p className="text-[10px] uppercase tracking-[0.18em] text-[#8a6458] mb-1 font-semibold">
                Topic
              </p> */}
              <h4 className={`text-sm font-semibold line-clamp-2 mb-1 group-hover:text-foreground transition-colors leading-snug ${isDarkMode ? 'text-slate-100' : ''}`}>
                {entry.title}
              </h4>

              {/* Preview */}
              <p className={`text-xs line-clamp-2 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-muted-foreground'}`}>
                {entry.preview}
              </p>

              {/* Mood label */}
              <div className="mt-2.5">
                <span
                  className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{ background: `${entry.moodColor}15`, color: entry.moodColor }}
                >
                  {entry.mood}
                </span>
              </div>
            </motion.button>
          ))}

          {showAll && allEntries.length > entries.length && (
            <motion.button
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: Math.min(entries.length, 10) * 0.04, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => router.push("/journal")}
              className="w-full rounded-(--radius-hero) border border-dashed border-border/60 p-4 lg:p-5 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 group"
              style={{
                background: isDarkMode ? 'rgba(15,23,42,0.7)' : 'rgba(255,250,246,0.82)',
                borderColor: isDarkMode ? 'rgba(148,163,184,0.18)' : 'rgba(159,120,100,0.28)',
              }}
            >
              <div className="h-full min-h-24 flex flex-col justify-center">
                <span className="text-sm font-semibold group-hover:text-foreground transition-colors">
                  View more memories
                </span>
                <span className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                  Go to full journal <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </motion.button>
          )}
        </div>
      </div>
    </motion.section>
  );
}

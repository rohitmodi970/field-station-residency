// app\user\journal\analysis\advanced\page.tsx

"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTheme } from '@/utilities/context/ThemeContext';
// Layout removed (unused in this page)
import { getAllJournalEntries } from "@/utilities/journal-data";
import { JournalEntry } from "@/components/Journal/types";
import AdvancedAnalysisDashboard from "@/components/Journal/Advanced/AdvancedAnalysisDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, BarChart2 } from "lucide-react";
import AnalysisHistory from "@/components/Journal/AnalysisHistory";

interface AnalysisHistoryEntry {
  id: string;
  date: string;
  title: string;
  summary: string;
  entryIds?: string[];
  dates?: string[];
  analysis: any; // Will be typed based on advanced analysis results
}

// Helper to filter entries to only those relevant to a specific analysis
const filterEntriesForAnalysis = (
  all: JournalEntry[],
  targetIds: string[],
  targetDates: string[]
): JournalEntry[] => {
  if (!all || all.length === 0) return [];

  let matched: JournalEntry[] = [];
  if (targetIds && targetIds.length > 0) {
    matched = all.filter((e) =>
      (e.journalId && targetIds.includes(e.journalId)) ||
      (e.id && targetIds.includes(e.id))
    );
  }

  // Fallback match by dates if IDs didn't match
  if (matched.length === 0 && targetDates && targetDates.length > 0) {
    matched = all.filter((e) => {
      const dStr = e.date ? new Date(e.date).toISOString().slice(0, 10) : '';
      const dispStr = e.displayDate ? new Date(e.displayDate).toISOString().slice(0, 10) : '';
      return targetDates.some((td) => {
        const tClean = td.toLowerCase();
        return (
          (dStr && tClean.includes(dStr)) ||
          (dispStr && tClean.includes(dispStr)) ||
          (e.date &&
            tClean.includes(
              new Date(e.date)
                .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                .toLowerCase()
            ))
        );
      });
    });
  }

  return matched.length > 0 ? matched : all;
};

// Admin configurable: Maximum number of analyses allowed per day
const DAILY_ANALYSIS_LIMIT = 10; // Change this value for testing (e.g., set to 999 for unlimited)

// Helper to get today's date string (YYYY-MM-DD)
const getTodayString = (): string => {
  const today = new Date().toISOString().split('T')[0];
  return today || new Date().toLocaleDateString('en-CA'); // Fallback to locale string in YYYY-MM-DD format
};

// Helper to get/set daily usage from localStorage
const getDailyUsage = (): { date: string; count: number } => {
  const saved = localStorage.getItem('advancedAnalysisDailyUsage');
  if (saved) {
    const usage = JSON.parse(saved);
    // Reset count if it's a new day
    if (usage.date !== getTodayString()) {
      return { date: getTodayString(), count: 0 };
    }
    return usage;
  }
  return { date: getTodayString(), count: 0 };
};

const incrementDailyUsage = () => {
  const usage = getDailyUsage();
  const updated = { date: getTodayString(), count: usage.count + 1 };
  localStorage.setItem('advancedAnalysisDailyUsage', JSON.stringify(updated));
  return updated;
};

const AdvancedAnalysisPage = () => {
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AnalysisHistoryEntry[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<any>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [hasStartedAnalysis, setHasStartedAnalysis] = useState(false);
  const analysisInProgressRef = useRef(false);
  const [dailyUsageCount, setDailyUsageCount] = useState(0);
  const [hasReachedLimit, setHasReachedLimit] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<string | undefined>(undefined);
  const [outerTab, setOuterTab] = useState<string>('analysis');

  // Check daily usage on mount
  useEffect(() => {
    const usage = getDailyUsage();
    setDailyUsageCount(usage.count);
    setHasReachedLimit(usage.count >= DAILY_ANALYSIS_LIMIT);
  }, []);

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('advancedAnalysisHistory');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // Save analysis to history (with storage optimization and entry IDs preserved)
  const saveToHistory = useCallback((analysis: any, title: string, summary: string) => {
    const entryIds = entries.map(e => e.journalId || e.id).filter((id): id is string => Boolean(id));
    const dates = entries.map(e => e.date).filter(Boolean);
    const analyzedEntries = entries.map(e => ({
      id: e.id || e.journalId,
      journalId: e.journalId || e.id,
      title: e.title,
      date: e.date,
    }));

    // Store essential data including textual analysis fields and mindmap insight
    const compressedAnalysis = {
      entryIds,
      dates,
      analyzedEntries,
      keywords: analysis.keywords || [],
      topicHierarchy: analysis.topicHierarchy || [],
      keywordInsight: analysis.keywordInsight || '',
      topicHierarchyInsight: analysis.topicHierarchyInsight || '',
      healthWellnessInsight: analysis.healthWellnessInsight || '',
      progressMetrics: analysis.progressMetrics || {},
      happinessSources: (() => {
        const sources = analysis.happinessSources || [];
        if (sources.length <= 3) return sources.slice(0, 3);
        if (sources.length <= 5) return sources.slice(0, 5);
        if (sources.length === 6) return sources.slice(0, 5);
        return sources.slice(0, 7);
      })(),
      // Mindmap insight text cards
      mindmapInsight: analysis.mindmapInsight || null,
      // New: structured mindmap clusters
      mindmapClusters: analysis.mindmapClusters || [],
      // New: Stage 3 insight fields (Mirror → Meaning → Movement)
      reflectionSummary: analysis.reflectionSummary || '',
      lifePatterns: analysis.lifePatterns || [],
      energyWellbeingInsight: analysis.energyWellbeingInsight || '',
      growthEdge: analysis.growthEdge || '',
      weeklyInsight: analysis.weeklyInsight || '',
      // Textual analysis fields
      vocabularyShifts: analysis.vocabularyShifts || { phases: [], insight: '' },
      majorMilestones: analysis.majorMilestones || { milestones: [], insight: '' },
      dailyRhythmPatterns: analysis.dailyRhythmPatterns || { blocks: [], insight: '' },
      emotionalTriggers: analysis.emotionalTriggers?.slice(0, 10) || [],
      energyLevelTracking: analysis.energyLevelTracking?.slice(0, 10) || [],
      goalProgressMetrics: analysis.goalProgressMetrics?.slice(0, 10) || [],
      socialInteractionImpact: analysis.socialInteractionImpact?.slice(0, 10) || [],
      sleepRestAnalysis: analysis.sleepRestAnalysis?.slice(0, 10) || [],
      creativeOutputLog: analysis.creativeOutputLog?.slice(0, 10) || [],
      stressIndicators: analysis.stressIndicators?.slice(0, 10) || [],
      gratitudeTracking: analysis.gratitudeTracking?.slice(0, 10) || [],
      moodInfluencers: analysis.moodInfluencers?.slice(0, 10) || [],
      // Additional fields needed by components
      metrics: analysis.metrics || [],
      emotionDistribution: analysis.emotionDistribution || [],
      flowData: analysis.flowData || { nodes: [], edges: [] },
      healthMetrics: analysis.healthMetrics || [],
      tenseUsage: analysis.tenseUsage || { present: 0, past: 0, future: 0 },
      wordChoiceCategories: analysis.wordChoiceCategories || [],
    };
    
    const entry: AnalysisHistoryEntry = {
      id: `${title.replace(/\s+/g, '-')}-${Date.now()}`,
      date: new Date().toISOString(),
      title,
      summary,
      entryIds,
      dates,
      analysis: compressedAnalysis
    };
    
    try {
      setHistory(prev => {
        const updated = [entry, ...prev].slice(0, 5); // Keep only last 5 (reduced from 20)
        localStorage.setItem('advancedAnalysisHistory', JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Failed to save to history (localStorage quota exceeded):', error);
      // If quota exceeded, clear old history and try again with just this entry
      try {
        localStorage.setItem('advancedAnalysisHistory', JSON.stringify([entry]));
        setHistory([entry]);
      } catch (retryError) {
        console.error('Failed to save even after clearing history:', retryError);
      }
    }
  }, [entries]);

  const allEntriesRef = useRef<JournalEntry[]>([]);

  // Load a history entry as the current analysis and filter entries to the analyzed subset
  const handleLoadHistory = useCallback((entry: AnalysisHistoryEntry, availableEntries?: JournalEntry[]) => {
    setCurrentAnalysis(entry.analysis);
    setHasStartedAnalysis(true);
    // Switch inner dashboard tab to visual analysis
    setDashboardTab('visual');
    // Switch outer tab to analysis
    setOuterTab('analysis');

    const source = availableEntries || allEntriesRef.current;
    if (source.length > 0) {
      const targetIds: string[] = entry.analysis?.entryIds || 
        entry.entryIds || 
        entry.analysis?.analyzedEntries?.map((e: any) => e.journalId || e.id) || [];
      const targetDates: string[] = entry.analysis?.dates || entry.dates || [];

      const filtered = filterEntriesForAnalysis(source, targetIds, targetDates);
      setEntries(filtered);

      const validDates = filtered
        .map(e => e.date ? new Date(e.date).getTime() : 0)
        .filter(t => !isNaN(t) && t > 0)
        .sort((a, b) => a - b);

      if (validDates.length > 0 && typeof validDates[0] === 'number') {
        const firstTime = validDates[0];
        const lastTime = validDates[validDates.length - 1] ?? firstTime;
        const earliest = new Date(firstTime).toISOString().split('T')[0] ?? '';
        const latest = new Date(lastTime).toISOString().split('T')[0] ?? '';
        if (earliest) setStartDate(earliest);
        if (latest) setEndDate(latest);
      }
    }
  }, []);

  // Stable callback for analysis completion
  const handleAnalysisComplete = useCallback((analysis: any, title: string, summary: string) => {
    if (analysisInProgressRef.current) return;
    analysisInProgressRef.current = true;
    saveToHistory(analysis, title, summary);
    setCurrentAnalysis(analysis);
    setTimeout(() => {
      analysisInProgressRef.current = false;
    }, 100);
  }, [saveToHistory]);

  // Load journal entries on mount and check for auto-opening requested analysis
  useEffect(() => {
    let isMounted = true;
    async function loadJournalEntries() {
      try {
        setIsLoading(true);
        const fetchedEntries = await getAllJournalEntries();
        if (!isMounted) return;
        allEntriesRef.current = fetchedEntries;
        setAllEntries(fetchedEntries);

        // Check if an analysis is requested via URL query params (?id=... / ?open=latest) or localStorage active id
        const targetId = searchParams?.get('id') || (typeof window !== 'undefined' ? localStorage.getItem('advancedAnalysisActiveId') : null);
        const openLatest = searchParams?.get('open') === 'latest';

        let targetEntry: AnalysisHistoryEntry | undefined;
        try {
          const raw = localStorage.getItem('advancedAnalysisHistory');
          if (raw && (targetId || openLatest)) {
            const parsed: AnalysisHistoryEntry[] = JSON.parse(raw);
            targetEntry = targetId ? parsed.find(h => h.id === targetId) : (openLatest ? parsed[0] : undefined);
          }
        } catch {}

        if (targetEntry) {
          handleLoadHistory(targetEntry, fetchedEntries);
          try {
            localStorage.removeItem('advancedAnalysisActiveId');
          } catch {}
        } else {
          setEntries(fetchedEntries);
        }
      } catch (err) {
        console.error('Failed to load journal entries:', err);
        if (isMounted) setError('Failed to load journal entries. Please try again later.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadJournalEntries();
    return () => {
      isMounted = false;
    };
  }, [searchParams, handleLoadHistory]);

  // Auto-open requested analysis when history state updates
  useEffect(() => {
    if (history.length === 0) return;

    const targetId = searchParams?.get('id') || (typeof window !== 'undefined' ? localStorage.getItem('advancedAnalysisActiveId') : null);
    const openLatest = searchParams?.get('open') === 'latest';

    if (!targetId && !openLatest) return;

    const targetEntry = targetId ? history.find(h => h.id === targetId) : (openLatest ? history[0] : undefined);
    if (targetEntry) {
      handleLoadHistory(targetEntry);
      try {
        localStorage.removeItem('advancedAnalysisActiveId');
      } catch {}
    }
  }, [history, searchParams, handleLoadHistory]);

  // Filter entries when date range changes
  useEffect(() => {
    if (!startDate && !endDate) {
      if (hasStartedAnalysis || currentAnalysis) {
        // Do not overwrite filtered entries of an active analysis
        return;
      }
      setEntries(allEntries);
      return;
    }

    const filtered = allEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      const start = startDate ? new Date(startDate) : null;
      let end = endDate ? new Date(endDate) : null;
      if (end) {
        end.setHours(23, 59, 59, 999);
      }

      if (start && end) {
        return entryDate >= start && entryDate <= end;
      } else if (start) {
        return entryDate >= start;
      } else if (end) {
        return entryDate <= end;
      }
      return true;
    });

    setEntries(filtered);
  }, [startDate, endDate, allEntries, hasStartedAnalysis, currentAnalysis]);

  // Handle starting the analysis
  const handleStartAnalysis = () => {
    // Check daily limit
    const usage = getDailyUsage();
    if (usage.count >= DAILY_ANALYSIS_LIMIT) {
      setHasReachedLimit(true);
      return;
    }
    
    // Increment usage count
    const updated = incrementDailyUsage();
    setDailyUsageCount(updated.count);
    setHasReachedLimit(updated.count >= DAILY_ANALYSIS_LIMIT);
    
    setHasStartedAnalysis(true);
    setCurrentAnalysis(null); // Reset to trigger new analysis
    setDashboardTab(undefined); // Clear dashboard tab override
  };

  // Calculate remaining analyses for today
  const remainingAnalyses = Math.max(0, DAILY_ANALYSIS_LIMIT - dailyUsageCount);

  const { currentTheme } = useTheme();

  return (
    <section className="analysis-advanced-theme space-y-6">
      <div className="rounded-2xl p-6" style={{ background: 'var(--analysis-card)', border: '1px solid rgba(147,114,95,0.06)', boxShadow: '0 10px 24px rgba(91,68,47,0.06)' }}>
        <h1 className="mb-2 text-4xl font-bold" style={{ color: 'var(--analysis-text)', fontFamily: "'Iowan Old Style', 'Palatino Linotype', serif" }}>Pattern Map Atlas</h1>
        <p style={{ color: 'var(--analysis-muted)', fontSize: '1.125rem' }}>
          Discover long-range emotional patterns and meaningful shifts across your journal timeline.
        </p>
      </div>

      {/* Date Range Filter */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--analysis-card)', border: '1px solid rgba(147,114,95,0.06)', boxShadow: '0 10px 24px rgba(91,68,47,0.06)' }}>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold" style={{ color: 'var(--analysis-text)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
          Curate Your Timeframe
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
                <label htmlFor="startDate" className="mb-2 block text-sm font-medium" style={{ color: 'var(--analysis-muted)' }}>
                    Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md px-3 py-2 shadow-sm focus:border-transparent focus:outline-none focus:ring-2"
              style={{ background: 'var(--analysis-shell-bg)', color: 'var(--analysis-text)', border: '1px solid rgba(147,114,95,0.04)' }}
            />
          </div>
          <div>
                <label htmlFor="endDate" className="mb-2 block text-sm font-medium" style={{ color: 'var(--analysis-muted)' }}>
                    End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md px-3 py-2 shadow-sm focus:border-transparent focus:outline-none focus:ring-2"
              style={{ background: 'var(--analysis-shell-bg)', color: 'var(--analysis-text)', border: '1px solid rgba(147,114,95,0.04)' }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="flex-1 rounded-md px-4 py-2 font-medium transition-colors"
              style={{ background: 'var(--analysis-shell-bg)', color: 'var(--analysis-muted)' }}
            >
              Reset Window
            </button>
          </div>
        </div>

        <div className="mt-4 rounded p-3" style={{ borderLeft: '4px solid var(--analysis-primary, #9b7a67)', background: 'var(--analysis-shell-bg, #f7eee6)' }}>
          <p className="text-sm" style={{ color: 'var(--analysis-text, #6e5a4b)' }}>
            <span className="font-semibold">{entries.length} entries selected</span>
                  {startDate && endDate && ` from ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`}
                  {startDate && !endDate && ` from ${new Date(startDate).toLocaleDateString()} onwards`}
                  {!startDate && endDate && ` up to ${new Date(endDate).toLocaleDateString()}`}
                  {!startDate && !endDate && ' (all entries)'}
          </p>
        </div>

        {/* Daily Usage Indicator */}
        <div className="mt-4 p-3 rounded" style={{ borderLeft: `4px solid ${hasReachedLimit ? 'rgba(220,38,38,0.9)' : 'rgba(16,185,129,0.9)'}`, background: 'var(--analysis-shell-bg)' }}>
          <p className="text-sm" style={{ color: hasReachedLimit ? '#991B1B' : '#065f46' }}>
                  {hasReachedLimit ? (
                    <>
                      <span className="font-semibold">Daily limit reached.</span> You have used all {DAILY_ANALYSIS_LIMIT} sessions for today. Come back tomorrow.
                    </>
                  ) : (
                    <>
                      <span className="font-semibold">{remainingAnalyses} sessions remaining today.</span> ({dailyUsageCount}/{DAILY_ANALYSIS_LIMIT} used)
                    </>
                  )}
          </p>
        </div>
              
        {/* Start Analysis Button */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            onClick={handleStartAnalysis}
            disabled={entries.length === 0 || hasReachedLimit}
            className="group relative px-8 py-4 font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 overflow-hidden text-white border border-white/20"
            style={{
              background: hasReachedLimit
                ? `linear-gradient(to bottom right, ${currentTheme.medium || '#9CA3AF'}, ${currentTheme.primary || '#6B7280'})`
                : `linear-gradient(to bottom right, ${currentTheme.primary}, ${currentTheme.hover || currentTheme.primary})`,
              backdropFilter: 'blur(10px)'
            }}
          >
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom right, rgba(255,255,255,0.06), transparent)', opacity: 0.5 }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top left, rgba(255,255,255,0.04), transparent)' }} />
            {!hasReachedLimit && (
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 group-hover:translate-x-full transition-transform duration-1000" />
              </div>
            )}

            <span className="relative flex items-center gap-3 text-lg">
                    {hasReachedLimit ? (
                      <>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Daily Limit Reached
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Begin Pattern Map Session
                      </>
                    )}
            </span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl p-8 text-center shadow-sm" style={{ background: 'var(--analysis-card)', border: '1px solid rgba(147,114,95,0.04)', color: 'var(--analysis-muted)' }}>
          Loading your journal entries...
        </div>
      ) : error ? (
        <div className="rounded-2xl p-8 text-center shadow-sm" style={{ background: 'var(--analysis-card)', border: '1px solid rgba(220,38,38,0.12)', color: 'var(--analysis-muted)' }}>
          {error}
        </div>
      ) : (
        <Tabs defaultValue="analysis" value={outerTab} onValueChange={setOuterTab} className="w-full">
          <div className="mb-6">
            <div className="rounded-xl p-1" style={{ background: 'var(--analysis-shell-bg)', border: '1px solid rgba(147,114,95,0.04)' }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="analysis" className="rounded-lg data-[state=active]:bg-[var(--theme-primary)] data-[state=active]:text-white text-[var(--analysis-muted)]">
                  <BarChart2 className="w-4 h-4 mr-2" />
                  Pattern Map
                </TabsTrigger>
                <TabsTrigger value="history" className="rounded-lg text-[var(--analysis-muted)]">
                  <History className="w-4 h-4 mr-2" />
                  Memory Trail
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="analysis">
            {hasStartedAnalysis ? (
              <AdvancedAnalysisDashboard
                entries={entries}
                onAnalysisComplete={handleAnalysisComplete}
                currentAnalysis={currentAnalysis}
                initialTab={dashboardTab}
              />
            ) : (
              <div 
                className="rounded-2xl p-12 text-center shadow-[0_10px_24px_rgba(91,68,47,0.06)]"
                style={{
                  background: 'var(--analysis-card, #fff8f2)',
                  border: '1px solid rgba(147,114,95,0.18)',
                }}
              >
                <div 
                  className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full"
                  style={{ background: 'var(--analysis-soft, #f4e9de)' }}
                >
                  <svg className="h-12 w-12" style={{ color: 'var(--analysis-primary, #937160)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="mb-3 text-2xl font-semibold" style={{ color: 'var(--analysis-text, #3e2e26)' }}>Ready for Pattern Map</h3>
                <p className="mx-auto mb-2 max-w-md" style={{ color: 'var(--analysis-muted, #6e5a4b)' }}>
                  Select your preferred timeframe above and begin a Pattern Map session to generate layered insights from your journal entries.
                </p>
                <p className="text-sm" style={{ color: 'var(--analysis-muted, #7c695b)' }}>
                  {entries.length} {entries.length === 1 ? 'entry' : 'entries'} currently selected
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <AnalysisHistory
              history={history}
              onLoadHistory={handleLoadHistory}
              type="advanced"
            />
          </TabsContent>
        </Tabs>
      )}
    </section>
  );
};

export default function AdvancedAnalysisPageWrapper() {
  return (
    <Suspense fallback={<div className="rounded-2xl p-8 text-center text-[#6e5a4b] bg-[#fff8f2]">Loading Pattern Map Atlas...</div>}>
      <AdvancedAnalysisPage />
    </Suspense>
  );
} 
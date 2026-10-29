/**
 * Re-engagement Data Fetcher
 * 
 * Fetches user data needed for re-engagement strategy generation.
 * Aggregates data from multiple tables into ReengagementData.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReengagementData, WritingPatterns, LastPositiveEntry } from '../types';
import type { 
  ReengagementDataInput, 
  WritingPatternRow, 
  UserStatsRow 
} from './types';
import { ENTRY_MILESTONES } from '../constants';

const DEFAULT_LOOKBACK_DAYS = 90;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Fetch comprehensive re-engagement data for a user
 */
export async function fetchReengagementData(
  supabase: SupabaseClient,
  input: ReengagementDataInput
): Promise<ReengagementData> {
  const { userId, lookbackDays = DEFAULT_LOOKBACK_DAYS } = input;
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);
  const lookbackIso = lookbackDate.toISOString();

  // Fetch data in parallel
  const [
    statsResult,
    writingPatternsResult,
    positiveEntriesResult,
    topicsResult,
    unanalyzedResult,
    draftsResult,
  ] = await Promise.all([
    fetchUserStats(supabase, userId),
    fetchWritingPatterns(supabase, userId, lookbackIso),
    fetchLastPositiveEntry(supabase, userId),
    fetchFavoriteTopics(supabase, userId, lookbackIso),
    fetchUnanalyzedCount(supabase, userId),
    fetchDraftCount(supabase, userId),
  ]);

  // Calculate days inactive
  const lastActiveAt = statsResult.last_entry_at 
    ? new Date(statsResult.last_entry_at) 
    : null;
  const daysInactive = lastActiveAt
    ? Math.floor((Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))
    : 999; // Very large number if never active

  // Calculate entries to next milestone
  const entriesToNextMilestone = calculateEntriesToNextMilestone(statsResult.total_entries);

  // Analyze writing patterns
  const writingPatterns = analyzeWritingPatterns(writingPatternsResult);

  return {
    daysInactive,
    lastActiveAt,
    peakStreak: statsResult.longest_streak,
    currentStreak: statsResult.current_streak,
    totalEntries: statsResult.total_entries,
    totalAnalyses: statsResult.total_analyses,
    entriesToNextMilestone,
    writingPatterns,
    favoriteTopics: topicsResult,
    lastPositiveEntry: positiveEntriesResult,
    unanalyzedCount: unanalyzedResult,
    draftCount: draftsResult,
  };
}

// ============================================
// DATA FETCHING HELPERS
// ============================================

async function fetchUserStats(
  supabase: SupabaseClient,
  userId: string
): Promise<UserStatsRow> {
  // Fetch streak/account stats from users table
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('current_streak, longest_streak, created_at')
    .eq('id', userId)
    .single();

  // Calculate total entries and last entry from journals
  const { count: totalEntries } = await supabase
    .from('journals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_deleted', false);

  const { count: totalAnalyses } = await supabase
    .from('journals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .gt('analysis_count', 0);

  const { data: lastJournal } = await supabase
    .from('journals')
    .select('display_date')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('display_date', { ascending: false })
    .limit(1)
    .single();

  if (profileError || !profile) {
    return {
      current_streak: 0,
      longest_streak: 0,
      total_entries: totalEntries || 0,
      total_analyses: totalAnalyses || 0,
      last_entry_at: lastJournal?.display_date || null,
    };
  }

  return {
    current_streak: profile.current_streak || 0,
    longest_streak: profile.longest_streak || 0,
    total_entries: totalEntries || 0,
    total_analyses: totalAnalyses || 0,
    last_entry_at: lastJournal?.display_date || null,
  };
}

async function fetchWritingPatterns(
  supabase: SupabaseClient,
  userId: string,
  lookbackIso: string
): Promise<WritingPatternRow[]> {
  // Fetch journals - word_count may not exist, so we'll calculate from content if needed
  const { data, error } = await supabase
    .from('journals')
    .select('display_date, content')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .gte('display_date', lookbackIso)
    .order('display_date', { ascending: false });

  if (error || !data) {
    return [];
  }

  // Calculate word count from content if not available
  return data.map((row: { display_date: string; content?: string }) => ({
    created_at: row.display_date, // Keep the returned property name for compatibility if needed
    word_count: row.content ? row.content.split(/\s+/).filter(Boolean).length : 0,
  }));
}

async function fetchLastPositiveEntry(
  supabase: SupabaseClient,
  userId: string
): Promise<LastPositiveEntry | null> {
  // Try to fetch from journal_analyses which has sentiment data
  try {
    const { data, error } = await supabase
      .from('journal_analyses')
      .select(`
        id,
        journal_id,
        sentiment_score,
        topics,
        created_at,
        journals!inner (
          user_id
        )
      `)
      .eq('journals.user_id', userId)
      .gt('sentiment_score', 0.3)
      .order('sentiment_score', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    const analysis = data as { created_at: string; sentiment_score: number; topics?: string[] };
    const topics = analysis.topics || [];
    
    return {
      date: new Date(analysis.created_at),
      sentiment: analysis.sentiment_score,
      topTopic: topics[0] || 'reflection',
    };
  } catch {
    // If journal_analyses doesn't exist or query fails, return null
    return null;
  }
}

async function fetchFavoriteTopics(
  supabase: SupabaseClient,
  userId: string,
  lookbackIso: string
): Promise<string[]> {
  // Fetch topics from journal_analyses instead of journals
  try {
    const { data, error } = await supabase
      .from('journal_analyses')
      .select(`
        topics,
        journals!inner (
          user_id,
          created_at
        )
      `)
      .eq('journals.user_id', userId)
      .gte('journals.created_at', lookbackIso);

    if (error || !data) {
      return [];
    }

    // Count topic frequency
    const topicCounts: Record<string, number> = {};
    for (const row of data) {
      const topics = (row.topics as Array<{ topic: string }> | string[] | null) || [];
      for (const topicItem of topics) {
        const topic = typeof topicItem === 'string' ? topicItem : topicItem.topic;
        if (topic) {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        }
      }
    }

    // Sort by frequency and return top 5
    return Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);
  } catch {
    return [];
  }
}

async function fetchUnanalyzedCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('journals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('analysis_count', 0);

  if (error || count === null) {
    return 0;
  }

  return count;
}

async function fetchDraftCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('journals')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_draft', true);

  if (error || count === null) {
    return 0;
  }

  return count;
}

// ============================================
// ANALYSIS HELPERS
// ============================================

function analyzeWritingPatterns(entries: WritingPatternRow[]): WritingPatterns {
  if (entries.length === 0) {
    return {
      preferredDays: [],
      preferredHours: [],
      avgSessionMinutes: 0,
    };
  }

  const dayCounts: Record<string, number> = {};
  const hourCounts: Record<number, number> = {};
  let totalWordCount = 0;

  for (const entry of entries) {
    const date = new Date(entry.created_at);
    const dayName = DAY_NAMES[date.getDay()] ?? 'Monday';
    const hour = date.getHours();

    dayCounts[dayName] = (dayCounts[dayName] ?? 0) + 1;
    hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
    totalWordCount += entry.word_count || 0;
  }

  // Find top 3 preferred days
  const preferredDays = Object.entries(dayCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day]) => day);

  // Find top 3 preferred hours
  const preferredHours = Object.entries(hourCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => parseInt(hour, 10));

  // Estimate average session time (rough: 15 words/minute)
  const avgWordCount = totalWordCount / entries.length;
  const avgSessionMinutes = Math.round(avgWordCount / 15);

  // Find most active day and hour
  const mostActiveDay = preferredDays[0];
  const mostActiveHour = preferredHours[0];

  return {
    preferredDays,
    preferredHours,
    avgSessionMinutes,
    mostActiveDay,
    mostActiveHour,
  };
}

function calculateEntriesToNextMilestone(totalEntries: number): number {
  for (const milestone of ENTRY_MILESTONES) {
    if (totalEntries < milestone) {
      return milestone - totalEntries;
    }
  }
  // Past all milestones
  return 0;
}

/**
 * Quick check if user needs re-engagement (without full data fetch)
 */
export async function checkReengagementNeeded(
  supabase: SupabaseClient,
  userId: string,
  thresholdDays: number = 3
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('last_entry_at')
    .eq('id', userId)
    .single();

  if (error || !data || !data.last_entry_at) {
    return true; // Consider new users as needing engagement
  }

  const lastEntry = new Date(data.last_entry_at);
  const daysInactive = Math.floor((Date.now() - lastEntry.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysInactive >= thresholdDays;
}

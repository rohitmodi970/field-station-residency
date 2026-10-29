// apps/web/app/api/fetch-journals/journal-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    // Use getUser() which authenticates by contacting the Supabase Auth server
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();
    const { data: journals, error } = await adminClient
      .from('journals')
      .select('id, created_at, mood, tags, date')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching journals for stats:", error);
      return NextResponse.json({ error: "Failed to fetch journal stats" }, { status: 500 });
    }

    const stats = calculateJournalStats(journals || []);
    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error("Error in journal stats API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function calculateJournalStats(journals: any[]) {
  if (!journals || journals.length === 0) {
    return {
      totalEntries: 0,
      streakCount: 0,
      lastEntryDate: null,
      weeklyEntries: 0,
      averageMood: "Neutral",
      mostProductiveDay: "Monday",
      topTopics: []
    };
  }

  const totalEntries = journals.length;
  const lastEntryDate = journals[0].created_at;
  const streakCount = calculateStreak(journals);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weeklyEntries = journals.filter(journal =>
    new Date(journal.created_at) >= oneWeekAgo
  ).length;

  const moodCounts = {
    positive: 0,
    neutral: 0,
    negative: 0
  };

  journals.forEach(journal => {
    if (!journal.mood) return;
    const lowerMood = String(journal.mood).toLowerCase();
    if (lowerMood.includes('happy') || lowerMood.includes('good') || lowerMood.includes('great') || 
        lowerMood.includes('excited') || lowerMood.includes('grateful') || lowerMood.includes('content')) {
      moodCounts.positive++;
    } else if (lowerMood.includes('sad') || lowerMood.includes('bad') || lowerMood.includes('angry') ||
               lowerMood.includes('anxious') || lowerMood.includes('stressed')) {
      moodCounts.negative++;
    } else {
      moodCounts.neutral++;
    }
  });

  let averageMood = "Neutral";
  if (moodCounts.positive > moodCounts.neutral && moodCounts.positive > moodCounts.negative) {
    averageMood = "Positive";
  } else if (moodCounts.negative > moodCounts.neutral && moodCounts.negative > moodCounts.positive) {
    averageMood = "Negative";
  }

  const dayEntries: Record<string, number> = {
    'Monday': 0,
    'Tuesday': 0,
    'Wednesday': 0,
    'Thursday': 0,
    'Friday': 0,
    'Saturday': 0,
    'Sunday': 0
  };

  journals.forEach(journal => {
    const day = new Date(journal.created_at).toLocaleString('en-US', { weekday: 'long' });
    if (day in dayEntries) {
      dayEntries[day] = (dayEntries[day] || 0) + 1;
    }
  });

  let mostProductiveDay = 'Monday';
  let maxEntries = 0;
  for (const [day, count] of Object.entries(dayEntries)) {
    if (count > maxEntries) {
      mostProductiveDay = day;
      maxEntries = count;
    }
  }

  const topicCounts: Record<string, number> = {};
  journals.forEach(journal => {
    if (Array.isArray(journal.tags) && journal.tags.length) {
      journal.tags.forEach((tag: string) => {
        topicCounts[tag] = (topicCounts[tag] || 0) + 1;
      });
    }
  });

  const topTopics = Object.entries(topicCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => (b.count as number) - (a.count as number))
    .slice(0, 5);

  return {
    totalEntries,
    streakCount,
    lastEntryDate,
    weeklyEntries,
    averageMood,
    mostProductiveDay,
    topTopics
  };
}

function calculateStreak(journals: any[]): number {
  if (!journals.length) return 0;

  const sortedJournals = [...journals].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastEntryDate = new Date(sortedJournals[0].created_at);
  lastEntryDate.setHours(0, 0, 0, 0);

  if (today.getTime() - lastEntryDate.getTime() > 86400000 * 2) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    return lastEntryDate.getTime() === yesterday.getTime() ? 1 : 0;
  }

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const journalDates = new Map();
  sortedJournals.forEach(journal => {
    const journalDate = new Date(journal.created_at);
    journalDate.setHours(0, 0, 0, 0);
    journalDates.set(journalDate.getTime(), true);
  });

  while (journalDates.has(currentDate.getTime())) {
    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }

  return streak;
}

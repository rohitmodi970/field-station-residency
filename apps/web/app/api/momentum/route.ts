// apps/web/app/api/momentum/route.ts
// Momentum Algorithm – Phase 1: Consistency only
// Emotional Depth & Self-Awareness metrics are future phases (placeholders returned as null).

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConsistencyLevel =
  | 'just_starting'
  | 'easy'
  | 'moderate'
  | 'on_fire'
  | 'unstoppable';

interface LevelConfig {
  key: ConsistencyLevel;
  label: string;
  emoji: string;
  description: string;
  minScore: number;
  maxScore: number;
}

// ─── Level definitions ────────────────────────────────────────────────────────

const LEVELS: LevelConfig[] = [
  {
    key: 'just_starting',
    label: 'Just Starting',
    emoji: '🌱',
    description: 'Every great journey begins with a single word. Write today!',
    minScore: 0,
    maxScore: 20,
  },
  {
    key: 'easy',
    label: 'Easy',
    emoji: '💧',
    description: "You're building the habit — keep showing up!",
    minScore: 21,
    maxScore: 40,
  },
  {
    key: 'moderate',
    label: 'Moderate',
    emoji: '⚡',
    description: "Solid consistency! You're writing regularly.",
    minScore: 41,
    maxScore: 60,
  },
  {
    key: 'on_fire',
    label: 'On Fire',
    emoji: '🔥',
    description: "You're on a roll — almost daily writing!",
    minScore: 61,
    maxScore: 80,
  },
  {
    key: 'unstoppable',
    label: 'Unstoppable',
    emoji: '🌟',
    description: "Incredible! You write every single day. Nothing can stop you.",
    minScore: 81,
    maxScore: 100,
  },
];

function getLevelConfig(score: number): LevelConfig {
  return (
    LEVELS.slice()
      .reverse()
      .find((l) => score >= l.minScore) ?? LEVELS[0]!
  );
}

// ─── Score computation ────────────────────────────────────────────────────────
// Score is 0-100 built from three sub-components:
//   streak component      → 50 pts max  (saturates at 14-day streak)
//   weekly velocity       → 30 pts max  (saturates at 7 entries / week)
//   30-day cadence        → 20 pts max  (saturates at 20 unique active days)

function computeConsistencyScore(
  streak: number,
  weeklyEntries: number,
  activeDaysLast30: number,
): number {
  const streakScore = (Math.min(streak, 14) / 14) * 50;
  const weeklyScore = (Math.min(weeklyEntries, 7) / 7) * 30;
  const cadenceScore = (Math.min(activeDaysLast30, 20) / 20) * 20;
  return Math.round(streakScore + weeklyScore + cadenceScore);
}

// ─── Streak calculation ───────────────────────────────────────────────────────

function computeStreak(journals: { created_at: string }[]): number {
  if (!journals.length) return 0;

  const sorted = [...journals].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // Build a set of unique calendar dates (UTC day-strings)
  const daySet = new Set<string>();
  sorted.forEach((j) => {
    daySet.add(new Date(j.created_at).toISOString().slice(0, 10));
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  const current = new Date(today);

  while (true) {
    const key = current.toISOString().slice(0, 10);
    if (!daySet.has(key)) break;
    streak++;
    current.setDate(current.getDate() - 1);
  }

  // If no entry today, check if yesterday counted to preserve streak
  if (streak === 0) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = yesterday.toISOString().slice(0, 10);
    if (daySet.has(yKey)) {
      const d = new Date(yesterday);
      while (daySet.has(d.toISOString().slice(0, 10))) {
        streak++;
        d.setDate(d.getDate() - 1);
      }
    }
  }

  return streak;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Fetch all non-deleted journals for the user (we only need created_at for consistency)
    const { data: journals, error } = await adminClient
      .from('journals')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[momentum] DB error:', error);
      return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    const all = journals ?? [];

    // Weekly entries (last 7 days)
    const cutoffWeek = new Date();
    cutoffWeek.setDate(cutoffWeek.getDate() - 7);
    const weeklyEntries = all.filter(
      (j) => new Date(j.created_at) >= cutoffWeek,
    ).length;

    // Unique active days in last 30 days
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    const last30 = all.filter((j) => new Date(j.created_at) >= cutoff30);
    const activeDaySet = new Set(
      last30.map((j) => new Date(j.created_at).toISOString().slice(0, 10)),
    );
    const activeDaysLast30 = activeDaySet.size;

    const streak = computeStreak(all);
    const score = computeConsistencyScore(streak, weeklyEntries, activeDaysLast30);
    const levelConfig = getLevelConfig(score);

    // Progress % to the next level
    const currentLevelIdx = LEVELS.findIndex((l) => l.key === levelConfig.key);
    const nextLevel =
      currentLevelIdx < LEVELS.length - 1 ? LEVELS[currentLevelIdx + 1] : null;

    let progressToNext = 100;
    if (nextLevel) {
      const range = nextLevel.minScore - levelConfig.minScore;
      const gained = score - levelConfig.minScore;
      progressToNext = range > 0 ? Math.min(100, Math.round((gained / range) * 100)) : 100;
    }

    const consistency = {
      level: levelConfig.key,
      label: levelConfig.label,
      emoji: levelConfig.emoji,
      description: levelConfig.description,
      score,
      streak,
      weeklyEntries,
      activeDaysLast30,
      totalEntries: all.length,
      progressToNext,
      nextLevel: nextLevel ? nextLevel.label : null,
      nextLevelEmoji: nextLevel ? nextLevel.emoji : null,
    };

    return NextResponse.json(
      {
        consistency,
        // Future phases – not yet implemented
        emotionalDepth: null,
        selfAwareness: null,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[momentum] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

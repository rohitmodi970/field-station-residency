/**
 * Spotlight Activity Score API
 * 
 * GET: Calculate and return the user's activity score with breakdown
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { calculateActivityScore } from '@/lib/spotlight';
import type { ActivityScoreInput, JournalEntry } from '@/lib/spotlight/types';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeBreakdown = searchParams.get('breakdown') !== 'false';
    const lookbackDays = parseInt(searchParams.get('days') || '30', 10);

    const adminClient = createAdminClient();
    const startTime = Date.now();

    // Fetch journal data
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

    const { data: journals, error: journalsError } = await adminClient
      .from('journals')
      .select('id, created_at: display_date, content, analysis_count, updated_at')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .gte('display_date', cutoffDate.toISOString())
      .order('display_date', { ascending: false });

    if (journalsError) {
      throw new Error(`Failed to fetch journals: ${journalsError.message}`);
    }

    // Fetch profile data for streaks
    const { data: profile } = await adminClient
      .from('users')
      .select('current_streak, longest_streak, created_at')
      .eq('id', user.id)
      .single();

    // Transform journal data
    const journalEntries: JournalEntry[] = (journals || []).map(j => ({
      id: j.id,
      createdAt: new Date(j.created_at),
      wordCount: j.content ? j.content.split(/\s+/).filter(Boolean).length : 0,
      hasAnalysis: (j.analysis_count || 0) > 0,
      wasEdited: j.updated_at && j.updated_at !== j.created_at,
    }));

    // Calculate account age
    const accountAgeDays = profile?.created_at
      ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Build input
    const input: ActivityScoreInput = {
      journals: journalEntries,
      currentStreak: profile?.current_streak || 0,
      longestStreak: profile?.longest_streak || 0,
      accountAgeDays,
    };

    // Calculate score
    const result = calculateActivityScore(input);
    const computationMs = Date.now() - startTime;

    // Build response
    const response: Record<string, unknown> = {
      score: result.score,
      trend: result.trend,
      computationMs,
    };

    if (includeBreakdown) {
      response.breakdown = result.breakdown;
      response.input = {
        journalCount: journalEntries.length,
        currentStreak: input.currentStreak,
        longestStreak: input.longestStreak,
        accountAgeDays,
        lookbackDays,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Activity Score API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate activity score', details: (error as Error).message },
      { status: 500 }
    );
  }
}

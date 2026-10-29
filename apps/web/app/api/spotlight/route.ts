/**
 * Spotlight API - Main Endpoint
 * 
 * GET: Fetch personalized spotlight data (activity score, insights, blend ratios)
 * POST: Record interaction with an insight
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  calculateActivityScore,
  calculateBlendRatios,
  determineUrgency,
  CACHE_CONFIG,
} from '@/lib/spotlight';
import { generateReengagementInsights } from '@/lib/spotlight/reengagement';
import { generateJournalInsights, generateWaitlistInsights } from '@/lib/spotlight/insights';
import type { 
  SpotlightCacheData, 
  SpotlightInsight, 
  ActivityScoreInput,
  JournalEntry,
  Urgency 
} from '@/lib/spotlight/types';

// ============================================
// GET - Fetch Spotlight Data
// ============================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for refresh param
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = await getCachedSpotlightData(user.id);
      if (cached) {
        return NextResponse.json({
          ...cached,
          fromCache: true,
        });
      }
    }

    // Calculate fresh data
    const startTime = Date.now();
    const spotlightData = await calculateSpotlightData(user.id);
    const computationMs = Date.now() - startTime;

    // Cache the result
    await cacheSpotlightData(user.id, { ...spotlightData, computationMs });

    return NextResponse.json({
      ...spotlightData,
      computationMs,
      fromCache: false,
    });
  } catch (error) {
    console.error('[Spotlight API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spotlight data', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Record Interaction
// ============================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { insightId, action, strategyType } = body;

    if (!insightId || !action) {
      return NextResponse.json(
        { error: 'insightId and action are required' },
        { status: 400 }
      );
    }

    // Record the interaction
    const adminClient = createAdminClient();
    const { error: insertError } = await adminClient
      .from('spotlight_history')
      .insert({
        user_id: user.id,
        insight_id: insightId,
        insight_type: strategyType || 'unknown',
        action,
        shown_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[Spotlight API] Failed to record interaction:', insertError);
      // Don't fail the request, just log
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Spotlight API] Interaction error:', error);
    return NextResponse.json(
      { error: 'Failed to record interaction' },
      { status: 500 }
    );
  }
}

// ============================================
// HELPERS
// ============================================

async function getCachedSpotlightData(userId: string): Promise<SpotlightCacheData | null> {
  try {
    const adminClient = createAdminClient();
    
    const { data, error } = await adminClient
      .from('user_spotlight_cache')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    // Check if cache is still valid
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      return null;
    }

    return {
      userId: data.user_id,
      activityScore: data.activity_score,
      scoreBreakdown: data.score_breakdown,
      trend: data.trend,
      urgency: data.urgency,
      blendRatios: data.blend_ratios,
      insights: data.insights || [],
      generatedAt: new Date(data.generated_at),
      expiresAt: new Date(data.expires_at),
      computationMs: data.computation_ms,
    };
  } catch (error) {
    console.error('[Spotlight Cache] Error reading cache:', error);
    return null;
  }
}

async function cacheSpotlightData(
  userId: string, 
  data: Omit<SpotlightCacheData, 'userId' | 'generatedAt' | 'expiresAt'>
): Promise<void> {
  try {
    const adminClient = createAdminClient();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_CONFIG.TTL_MS);

    await adminClient
      .from('user_spotlight_cache')
      .upsert({
        user_id: userId,
        activity_score: data.activityScore,
        score_breakdown: data.scoreBreakdown,
        trend: data.trend,
        urgency: data.urgency,
        blend_ratios: data.blendRatios,
        insights: data.insights,
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        computation_ms: data.computationMs,
      }, {
        onConflict: 'user_id',
      });
  } catch (error) {
    console.error('[Spotlight Cache] Error writing cache:', error);
  }
}

async function calculateSpotlightData(userId: string): Promise<Omit<SpotlightCacheData, 'userId' | 'generatedAt' | 'expiresAt' | 'computationMs'>> {
  const adminClient = createAdminClient();

  // Fetch user's journal data
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: journals, error: journalsError } = await adminClient
    .from('journals')
    .select('id, created_at: display_date, content, analysis_count')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .gte('display_date', thirtyDaysAgo.toISOString())
    .order('display_date', { ascending: false });

  if (journalsError) {
    console.error('[Spotlight] Failed to fetch journals:', journalsError);
  }

  // Fetch streak data
  const { data: profile } = await adminClient
    .from('users')
    .select('current_streak, longest_streak, created_at')
    .eq('id', userId)
    .single();

  // Transform journal data
  const journalEntries: JournalEntry[] = (journals || []).map(j => ({
    id: j.id,
    createdAt: new Date(j.created_at),
    wordCount: j.content ? j.content.split(/\s+/).length : 0,
    hasAnalysis: (j.analysis_count || 0) > 0,
  }));

  // Build input for activity score
  const accountAgeDays = profile?.created_at 
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const input: ActivityScoreInput = {
    journals: journalEntries,
    currentStreak: profile?.current_streak || 0,
    longestStreak: profile?.longest_streak || 0,
    accountAgeDays,
  };

  // Calculate activity score
  const scoreResult = calculateActivityScore(input);

  // Calculate days inactive
  const daysInactive = journalEntries.length > 0 
    ? Math.floor((Date.now() - journalEntries[0]!.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : 30;

  // Determine urgency and blend ratios
  const urgency = determineUrgency(
    scoreResult.score,
    scoreResult.trend,
    daysInactive
  );
  
  const blendRatios = calculateBlendRatios(scoreResult.score, scoreResult.trend, daysInactive);

  // Generate insights based on blend ratios
  // Pass totalEntries to detect new users
  const totalEntries = journalEntries.length;
  const insights = await generateInsights(userId, urgency, blendRatios, totalEntries);

  return {
    activityScore: scoreResult.score,
    scoreBreakdown: scoreResult.breakdown,
    trend: scoreResult.trend,
    urgency,
    blendRatios,
    insights,
  };
}

async function generateInsights(
  userId: string,
  urgency: Urgency,
  blendRatios: { waitlist: number; journal: number; reengagement: number },
  totalEntries: number = 0
): Promise<SpotlightInsight[]> {
  const insights: SpotlightInsight[] = [];
  
  // Calculate target counts based on blend ratios (total max: 5 insights)
  const maxTotal = 5;
  
  // NEW USER HANDLING: If user has no journal entries, use ONLY waitlist insights
  // This prevents showing misleading "999 days inactive" messages
  const isNewUser = totalEntries === 0;
  
  let reengagementTarget: number;
  let journalTarget: number;
  let waitlistTarget: number;
  
  if (isNewUser) {
    // New users get 100% waitlist/onboarding content
    reengagementTarget = 0;
    journalTarget = 0;
    waitlistTarget = maxTotal;
    console.log('[Spotlight] New user detected - using waitlist insights only');
  } else {
    reengagementTarget = Math.round(maxTotal * blendRatios.reengagement);
    journalTarget = Math.round(maxTotal * blendRatios.journal);
    waitlistTarget = Math.round(maxTotal * blendRatios.waitlist);
  }
  
  // Generate insights in parallel
  const [reengagementInsights, journalInsights, waitlistInsights] = await Promise.all([
    // Re-engagement insights if urgency is present
    (urgency !== 'none' && reengagementTarget > 0)
      ? generateReengagementInsights({
          userId,
          urgency,
          maxInsights: Math.max(1, reengagementTarget),
        }).catch(error => {
          console.error('[Spotlight] Failed to generate re-engagement insights:', error);
          return [];
        })
      : Promise.resolve([]),
    
    // Journal-based insights (Phase 5)
    journalTarget > 0
      ? generateJournalInsights(userId, {
          maxInsights: Math.max(1, journalTarget + 1), // Request extra for selection
          lookbackDays: 14,
          minEntries: 2,
        }).catch(error => {
          console.error('[Spotlight] Failed to generate journal insights:', error);
          return [];
        })
      : Promise.resolve([]),
    
    // Waitlist/onboarding insights (Phase 5)
    waitlistTarget > 0
      ? generateWaitlistInsights(userId, {
          maxInsights: Math.max(1, waitlistTarget + 1),
        }).catch(error => {
          console.error('[Spotlight] Failed to generate waitlist insights:', error);
          return [];
        })
      : Promise.resolve([]),
  ]);

  // Combine all insights
  insights.push(...reengagementInsights);
  insights.push(...journalInsights);
  insights.push(...waitlistInsights);

  // Sort by priority and limit to max total
  return insights
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxTotal);
}

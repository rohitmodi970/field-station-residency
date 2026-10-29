/**
 * Spotlight Re-engagement API
 * 
 * GET: Generate re-engagement insights (static or AI-enhanced)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { determineUrgency } from '@/lib/spotlight';
import { 
  generateReengagementInsights, 
  generateAIReengagementInsights 
} from '@/lib/spotlight/reengagement';
import type { Urgency } from '@/lib/spotlight/types';
import type { AIGeneratorOptions } from '@/lib/spotlight/reengagement/ai-generator';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const useAI = searchParams.get('ai') === 'true';
    const maxInsights = parseInt(searchParams.get('max') || '2', 10);
    const urgencyParam = searchParams.get('urgency') as Urgency | null;
    const provider = (searchParams.get('provider') || 'claude') as AIGeneratorOptions['provider'];

    // Determine urgency if not provided
    let urgency: Urgency = urgencyParam || 'mild';
    
    if (!urgencyParam) {
      // Calculate urgency from user data
      const { data: lastEntry } = await supabase
        .from('journals')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const daysSinceEntry = lastEntry?.created_at
        ? Math.floor((Date.now() - new Date(lastEntry.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 30;

      // Get cached score or use default
      const { data: cache } = await supabase
        .from('user_spotlight_cache')
        .select('activity_score, trend')
        .eq('user_id', user.id)
        .single();

      const activityScore = cache?.activity_score ?? 0.3;
      const trend = cache?.trend ?? 'stable';
      urgency = determineUrgency(activityScore, trend, daysSinceEntry);
    }

    const startTime = Date.now();

    // Generate insights
    let insights;
    if (useAI) {
      insights = await generateAIReengagementInsights({
        userId: user.id,
        urgency,
        maxInsights,
        useAI: true,
        aiOptions: {
          provider,
          temperature: 0.8,
          fallbackToStatic: true,
        },
      });
    } else {
      insights = await generateReengagementInsights({
        userId: user.id,
        urgency,
        maxInsights,
      });
    }

    const computationMs = Date.now() - startTime;

    return NextResponse.json({
      insights,
      urgency,
      useAI,
      provider: useAI ? provider : null,
      computationMs,
    });
  } catch (error) {
    console.error('[Re-engagement API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate re-engagement insights', details: (error as Error).message },
      { status: 500 }
    );
  }
}

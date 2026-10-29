// apps/web/app/api/ai/insights/summary/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/ai/insights/summary - Get summarized AI insights for dashboard
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get average sentiment score
    const { data: sentimentData } = await supabase
      .from('ai_insights')
      .select('sentiment_score')
      .eq('user_id', user.id)
      .not('sentiment_score', 'is', null);

    const avgSentiment = sentimentData && sentimentData.length > 0
      ? sentimentData.reduce((sum, item) => sum + (item.sentiment_score || 0), 0) / sentimentData.length
      : null;

    // Get most common topics
    const { data: topicsData } = await supabase
      .from('ai_insights')
      .select('topics')
      .eq('user_id', user.id)
      .not('topics', 'is', null);

    const topicCounts: Record<string, number> = {};
    topicsData?.forEach(item => {
      item.topics?.forEach((topic: string) => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });
    });

    const topTopics = Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    // Get most common keywords
    const { data: keywordsData } = await supabase
      .from('ai_insights')
      .select('keywords')
      .eq('user_id', user.id)
      .not('keywords', 'is', null);

    const keywordCounts: Record<string, number> = {};
    keywordsData?.forEach(item => {
      item.keywords?.forEach((keyword: string) => {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      });
    });

    const topKeywords = Object.entries(keywordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([keyword, count]) => ({ keyword, count }));

    // Get recent insights
    const { data: recentInsights } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get sentiment trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: trendData } = await supabase
      .from('ai_insights')
      .select('sentiment_score, created_at')
      .eq('user_id', user.id)
      .not('sentiment_score', 'is', null)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    return NextResponse.json({
      summary: {
        avgSentiment: avgSentiment ? Number(avgSentiment.toFixed(2)) : null,
        topTopics,
        topKeywords,
        recentInsights,
        sentimentTrend: trendData || [],
        totalInsights: sentimentData?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/ai/insights/summary:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

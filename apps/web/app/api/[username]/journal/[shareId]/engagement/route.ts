// apps/web/app/api/[username]/journal/[shareId]/engagement/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateEngagementMetrics } from '@/lib/viral-tracking';

/**
 * POST /api/[username]/journal/[shareId]/engagement
 * Update engagement metrics for a view session
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string; shareId: string }> }
) {
  try {
    const { username, shareId } = await params;
    const body = await req.json();
    const { 
      visitorId, 
      timeSpentSeconds, 
      scrollPercentage, 
      clickedMedia, 
      clickedShare 
    } = body;

    if (!visitorId) {
      return NextResponse.json(
        { error: 'Visitor ID required' },
        { status: 400 }
      );
    }

    // Get journal ID from shareId (needed for update)
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const adminClient = createAdminClient();
    
    const { data: published } = await adminClient
      .from('journal_publics')
      .select('id, users:published_by (username)')
      .eq('share_id', shareId)
      .eq('is_active', true)
      .single();

    if (!published || (published.users as any)?.username !== username) {
      return NextResponse.json(
        { error: 'Journal not found' },
        { status: 404 }
      );
    }

    // Update engagement metrics
    await updateEngagementMetrics(visitorId, published.id, {
      timeSpentSeconds,
      scrollPercentage,
      clickedMedia,
      clickedShare,
    });

    return NextResponse.json({
      success: true,
      message: 'Engagement tracked',
    });

  } catch (error: any) {
    console.error('[Engagement API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

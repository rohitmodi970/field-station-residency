// apps/web/app/api/[username]/journal/[shareId]/share/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { trackShareEvent, type ShareTrackingData } from '@/lib/viral-tracking';

/**
 * POST /api/[username]/journal/[shareId]/share
 * Record a share event and return tracked URL
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string; shareId: string }> }
) {
  try {
    const { username, shareId } = await params;
    const body = await req.json();
    const { visitorId, platform, targetUrl } = body;

    // Validate required fields
    if (!visitorId || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields: visitorId, platform' },
        { status: 400 }
      );
    }

    // Validate platform
    const validPlatforms = [
      'whatsapp', 'facebook', 'twitter', 'x', 'linkedin', 
      'telegram', 'instagram', 'tiktok', 'email', 'sms',
      'copy_link', 'native_share', 'qr_code', 'other'
    ];

    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      );
    }

    // Verify username matches journal owner
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const adminClient = createAdminClient();
    
    const { data: published } = await adminClient
      .from('journal_publics')
      .select('id, is_active, users:published_by (username)')
      .eq('share_id', shareId)
      .single();

    if (!published || !published.is_active || (published.users as any)?.username !== username) {
      return NextResponse.json(
        { error: 'Journal not found or inactive' },
        { status: 404 }
      );
    }

    // Track share event
    const shareData: ShareTrackingData = {
      visitorId,
      shareId,
      platform,
      targetUrl: targetUrl || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://yourapp.com'}/${username}/journal/${shareId}`,
    };

    const result = await trackShareEvent(shareData);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to track share' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      shareUrl: result.shareUrl,
      message: 'Share tracked successfully',
    });

  } catch (error: any) {
    console.error('[Share API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

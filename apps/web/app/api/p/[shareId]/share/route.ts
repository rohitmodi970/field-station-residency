// apps/web/app/api/p/[shareId]/share/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';

/**
 * POST /api/p/[shareId]/share
 * Record a share-to-platform event for analytics
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params;
    const body = await req.json();
    const { platform, target_url, metadata } = body;

    // Validate platform
    const validPlatforms = [
      'facebook', 'twitter', 'x', 'linkedin', 'whatsapp',
      'telegram', 'email', 'sms', 'copy_link', 'native_share', 'other'
    ];

    if (!platform || !validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid or missing platform' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // 1. Get published journal ID
    const { data: published, error: publishError } = await adminClient
      .from('journal_publics')
      .select('id, is_active')
      .eq('share_id', shareId)
      .single();

    if (publishError || !published) {
      return NextResponse.json(
        { error: 'Share not found' },
        { status: 404 }
      );
    }

    if (!published.is_active) {
      return NextResponse.json(
        { error: 'Share is no longer active' },
        { status: 403 }
      );
    }

    // 2. Get user ID if authenticated (optional)
    let userId = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    } catch (err) {
      // User not authenticated - that's okay for share tracking
    }

    // 3. Get request metadata
    const userAgent = req.headers.get('user-agent') || null;
    const referrer = req.headers.get('referer') || req.headers.get('referrer') || null;

    // 4. Insert share record
    const { error: insertError } = await adminClient
      .from('share_records')
      .insert({
        public_id: published.id,
        user_id: userId,
        platform,
        target_url,
        metadata: metadata || null,
        referrer,
        user_agent: userAgent,
      });

    if (insertError) {
      console.error('Error recording share:', insertError);
      return NextResponse.json(
        { error: 'Failed to record share' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Share recorded successfully',
    });

  } catch (error: any) {
    console.error('Error in share recording:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

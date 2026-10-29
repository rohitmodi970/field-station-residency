// apps/web/app/api/p/[shareId]/media/[mediaId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getSignedUrl } from '@/utils/supabase/storage';

/**
 * GET /api/p/[shareId]/media/[mediaId]
 * Serve media for published journal (validates share access)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shareId: string; mediaId: string }> }
) {
  try {
    const { shareId, mediaId } = await params;
    const adminClient = createAdminClient();

    // 1. Validate share exists and is active
    const { data: published, error: publishError } = await adminClient
      .from('journal_publics')
      .select('id, journal_id, is_active, include_media, media_mode, expires_at')
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

    if (!published.include_media) {
      return NextResponse.json(
        { error: 'Media sharing is not enabled for this journal' },
        { status: 403 }
      );
    }

    // Check expiry
    if (published.expires_at && new Date(published.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Share has expired' },
        { status: 410 }
      );
    }

    // 2. Fetch media record
    const { data: media, error: mediaError } = await adminClient
      .from('journal_media')
      .select('*')
      .eq('id', mediaId)
      .eq('journal_id', published.journal_id)
      .single();

    if (mediaError || !media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      );
    }

    // 3. Handle different media modes
    if (published.media_mode === 'signed' || published.media_mode === 'proxy') {
      // Generate signed URL
      if (!media.bucket || !media.path) {
        return NextResponse.json(
          { error: 'Media file path not found' },
          { status: 404 }
        );
      }

      try {
        const signedUrl = await getSignedUrl(media.bucket, media.path, 3600); // 1 hour

        // For proxy mode, we could stream the file here
        // For signed mode, redirect to signed URL
        return NextResponse.redirect(signedUrl);
      } catch (err: any) {
        console.error('Error generating signed URL:', err);
        return NextResponse.json(
          { error: 'Failed to access media file' },
          { status: 500 }
        );
      }
    } else if (published.media_mode === 'public_copy' && media.public_url) {
      // Redirect to public URL
      return NextResponse.redirect(media.public_url);
    }

    return NextResponse.json(
      { error: 'Media not available' },
      { status: 404 }
    );

  } catch (error: any) {
    console.error('Error serving media:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

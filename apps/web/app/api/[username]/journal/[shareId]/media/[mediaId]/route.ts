// apps/web/app/api/[username]/journal/[shareId]/media/[mediaId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

/**
 * GET /api/[username]/journal/[shareId]/media/[mediaId]
 * Proxy media files for published journals (when media_mode = 'proxy')
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string; shareId: string; mediaId: string }> }
) {
  try {
    const { username, shareId, mediaId } = await params;
    const adminClient = createAdminClient();

    // 1. Verify journal is published and belongs to username
    const { data: published, error: publishError } = await adminClient
      .from('journal_publics')
      .select(`
        id,
        is_active,
        media_mode,
        journal_id,
        users:published_by (username)
      `)
      .eq('share_id', shareId)
      .single();

    if (publishError || !published || !published.is_active) {
      return NextResponse.json(
        { error: 'Journal not found or inactive' },
        { status: 404 }
      );
    }

    // Verify username matches
    if ((published.users as any)?.username !== username) {
      return NextResponse.json(
        { error: 'Username mismatch' },
        { status: 404 }
      );
    }

    // 2. Get media record
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

    // 3. Check if we should proxy or redirect
    if (published.media_mode === 'proxy' && media.bucket && media.path) {
      // Stream file from storage (proxy mode)
      const { data: fileData, error: downloadError } = await adminClient
        .storage
        .from(media.bucket)
        .download(media.path);

      if (downloadError || !fileData) {
        console.error('[Media Proxy] Download error:', downloadError);
        return NextResponse.json(
          { error: 'Failed to fetch media' },
          { status: 500 }
        );
      }

      // Return file with appropriate headers
      const headers = new Headers();
      headers.set('Content-Type', media.mime_type || 'application/octet-stream');
      headers.set('Content-Disposition', `inline; filename="${media.file_name}"`);
      headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      return new NextResponse(fileData, { headers });

    } else if (media.public_url) {
      // Redirect to public URL
      return NextResponse.redirect(media.public_url);
      
    } else {
      // Generate temporary signed URL and redirect
      const { data: signedUrlData } = await adminClient
        .storage
        .from(media.bucket)
        .createSignedUrl(media.path, 3600); // 1 hour

      if (signedUrlData?.signedUrl) {
        return NextResponse.redirect(signedUrlData.signedUrl);
      }

      return NextResponse.json(
        { error: 'Media not accessible' },
        { status: 403 }
      );
    }

  } catch (error: any) {
    console.error('[Media Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

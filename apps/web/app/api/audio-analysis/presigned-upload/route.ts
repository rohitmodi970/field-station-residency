import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { v4 as uuidv4 } from 'uuid';
import { BUCKETS } from '@/utils/supabase/storage';

/**
 * POST /api/audio-analysis/presigned-upload
 * 
 * Generate a presigned URL for client-side upload to Supabase Storage
 * This bypasses Vercel's 4.5MB body size limit
 * 
 * Request body:
 * {
 *   fileName: string,
 *   fileSize: number,
 *   mimeType: string
 * }
 * 
 * Returns:
 * {
 *   uploadUrl: string,
 *   filePath: string,
 *   token: string
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fileName, fileSize, mimeType } = body;

    // Validate inputs
    if (!fileName || !fileSize || !mimeType) {
      return NextResponse.json(
        { error: 'fileName, fileSize, and mimeType are required' },
        { status: 400 }
      );
    }

    // Validate file size (50MB max)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(fileSize / 1024 / 1024).toFixed(1)}MB). Maximum is 50MB.` },
        { status: 400 }
      );
    }

    // Validate MIME type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/flac', 'audio/x-flac'];
    if (!allowedTypes.includes(mimeType) && !mimeType.startsWith('audio/')) {
      return NextResponse.json(
        { error: 'Invalid audio file type' },
        { status: 400 }
      );
    }

    // Generate unique file path
    const fileExt = fileName.split('.').pop() || 'mp3';
    const uniqueFileName = `temp-${uuidv4()}-${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/audio/${uniqueFileName}`;

    // Create presigned upload URL (expires in 10 minutes)
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.storage
      .from(BUCKETS.USERS_CLOUD)
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      console.error('Failed to create presigned URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate upload URL' },
        { status: 500 }
      );
    }

    // Generate a token for this upload session
    const uploadToken = uuidv4();

    console.log(`[Presigned Upload] Generated URL for ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      filePath,
      token: uploadToken,
      path: data.path,
    });

  } catch (error: unknown) {
    console.error('[Presigned Upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate presigned upload URL' },
      { status: 500 }
    );
  }
}

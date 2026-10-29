import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { v4 as uuidv4 } from 'uuid';
import { BUCKETS, getMimeType } from '@/utils/supabase/storage';

function normalizeMimeType(fileName: string, mimeType?: string): string {
  const raw = (mimeType || '').toLowerCase().trim();
  if (raw && raw !== 'application/octet-stream') {
    return raw;
  }
  return getMimeType(fileName).toLowerCase();
}

/**
 * POST /api/ocr/presigned-upload
 * 
 * Generate presigned URLs for client-side upload of OCR images to Supabase Storage
 * This bypasses Vercel's 4.5MB body size limit
 * 
 * Request body:
 * {
 *   files: Array<{
 *     fileName: string,
 *     fileSize: number,
 *     mimeType: string
 *   }>
 * }
 * 
 * Returns:
 * {
 *   uploads: Array<{
 *     uploadUrl: string,
 *     filePath: string,
 *     token: string,
 *     fileName: string
 *   }>
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
    const { files } = body;

    // Validate inputs
    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'files array is required' },
        { status: 400 }
      );
    }

    // Validate file count (max 10 files)
    if (files.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 files allowed per request' },
        { status: 400 }
      );
    }

    // Validate file size (50MB max per file)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    for (const file of files) {
      if (!file.fileName || typeof file.fileSize !== 'number') {
        return NextResponse.json(
          { error: 'Each file must have fileName and fileSize' },
          { status: 400 }
        );
      }

      if (file.fileSize > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.fileName}" too large (${(file.fileSize / 1024 / 1024).toFixed(1)}MB). Maximum is 50MB.` },
          { status: 400 }
        );
      }

      // Validate MIME type (images and PDFs)
      const normalizedMimeType = normalizeMimeType(file.fileName, file.mimeType);
      const isImage = normalizedMimeType.startsWith('image/');
      const isPDF = normalizedMimeType === 'application/pdf';
      
      if (!isImage && !isPDF) {
        return NextResponse.json(
          { error: `Invalid file type for "${file.fileName}". Only images and PDFs are supported.` },
          { status: 400 }
        );
      }
    }

    // Generate presigned URLs for all files
    const adminClient = createAdminClient();
    const uploads = await Promise.all(
      files.map(async (file) => {
        // Generate unique file path
        const fileExt = file.fileName.split('.').pop() || 'jpg';
        const uniqueFileName = `ocr-${uuidv4()}-${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/ocr/${uniqueFileName}`;

        // Create presigned upload URL (expires in 10 minutes)
        const { data, error } = await adminClient.storage
          .from(BUCKETS.USERS_CLOUD)
          .createSignedUploadUrl(filePath);

        if (error || !data) {
          console.error('Error creating presigned URL:', error);
          throw new Error(`Failed to create upload URL for ${file.fileName}`);
        }

        return {
          uploadUrl: data.signedUrl,
          filePath: filePath,
          token: data.token,
          fileName: file.fileName,
          originalFileName: file.fileName
        };
      })
    );

    return NextResponse.json({
      uploads,
      userId: user.id
    });

  } catch (error) {
    console.error('Presigned URL generation error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate presigned URLs'
      },
      { status: 500 }
    );
  }
}

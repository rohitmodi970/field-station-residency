// apps/web/app/api/journals/media/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  uploadToSupabaseStorage,
  deleteFromSupabaseStorage,
  getSignedUrl,
  validateFile,
  BUCKETS,
  MediaType,
} from '@/utils/supabase/storage';

// Import Google Drive functions for users who choose Google Drive storage
import {
  uploadFileToDrive,
  deleteFileFromDrive,
  createUserFolder,
} from '@/utilities/googleDrive';

const MEDIA_LIMITS = {
  image: { count: 6, size: 25 * 1024 * 1024 },
  audio: { count: 11, size: 50 * 1024 * 1024 },
  video: { count: 2, size: 200 * 1024 * 1024 },
  document: { count: 5, size: 5 * 1024 * 1024 },
};

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  return { user };
}

/**
 * Get user's storage preference (Supabase or Google Drive)
 */
async function getUserStoragePreference(userId: string) {
  const adminClient = createAdminClient();
  
  const { data: settings } = await adminClient
    .from('user_settings')
    .select('storage_provider')
    .eq('user_id', userId)
    .single();
  
  return settings?.storage_provider || 'supabase'; // Default to Supabase
}

/**
 * Upload media file
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const formData = await req.formData();
    
    const file = formData.get('file') as File;
    const journalId = formData.get('journal_id') as string;
    const mediaType = formData.get('media_type') as MediaType;
    const forceProvider = formData.get('storage_provider') as string | null;

    if (!file || !journalId || !mediaType) {
      return NextResponse.json(
        { error: 'file, journal_id, and media_type are required' },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateFile(
      file,
      mediaType,
      MEDIA_LIMITS[mediaType].size
    );

    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Check if journal exists and belongs to user
    const { data: journal } = await adminClient
      .from('journals')
      .select('id')
      .eq('journal_id', journalId)
      .eq('user_id', user.id)
      .single();

    if (!journal) {
      return NextResponse.json(
        { error: 'Journal not found' },
        { status: 404 }
      );
    }

    // Check media count limit
    const { count } = await adminClient
      .from('journal_media')
      .select('id', { count: 'exact', head: true })
      .eq('journal_id', journal.id)
      .eq('media_type', mediaType);

    if (count && count >= MEDIA_LIMITS[mediaType].count) {
      return NextResponse.json(
        { error: `Maximum ${mediaType} limit (${MEDIA_LIMITS[mediaType].count}) reached` },
        { status: 400 }
      );
    }

    // Determine storage provider
    const storageProvider = forceProvider || await getUserStoragePreference(user.id);

    let mediaRecord: any = {
      user_id: user.id,
      journal_id: journal.id,
      media_type: mediaType,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_provider: storageProvider,
      upload_status: 'uploading',
    };

    // Insert initial record
    const { data: media, error: insertError } = await adminClient
      .from('journal_media')
      .insert(mediaRecord)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating media record:', insertError);
      return NextResponse.json(
        { error: 'Failed to create media record' },
        { status: 500 }
      );
    }

    try {
      if (storageProvider === 'supabase') {
        // Upload to Supabase Storage
        const result = await uploadToSupabaseStorage(
          user.id,
          file,
          file.name,
          mediaType,
          { journalId, bucket: BUCKETS.USERS_CLOUD }
        );

        // Update media record with storage details
        await adminClient
          .from('journal_media')
          .update({
            bucket: result.bucket,
            path: result.path,
            public_url: result.publicUrl,
            upload_status: 'completed',
          })
          .eq('id', media.id);

        // Generate signed URL for response
        const signedUrl = await getSignedUrl(result.bucket, result.path);

        return NextResponse.json({
          message: 'Media uploaded successfully',
          media: {
            ...media,
            ...result,
            signed_url: signedUrl,
          },
        });
      } else if (storageProvider === 'google_drive') {
        // Upload to Google Drive
        // Note: You'll need to get the user's Google access token
        const { data: userSettings } = await adminClient
          .from('user_settings')
          .select('google_access_token, google_drive_folder_id')
          .eq('user_id', user.id)
          .single();

        if (!userSettings?.google_access_token) {
          throw new Error('Google Drive not connected');
        }

        const fileBuffer = Buffer.from(await file.arrayBuffer());
        
        // Ensure user has a Drive folder
        let driveFolderId = userSettings.google_drive_folder_id;
        if (!driveFolderId) {
          driveFolderId = await createUserFolder(
            userSettings.google_access_token,
            `JournalApp_${user.id}`
          );
        }

        // Create journal-specific folder
        const journalFolderId = await createUserFolder(
          userSettings.google_access_token,
          `Journal_${journalId}`,
          driveFolderId
        );

        if (!journalFolderId) {
          throw new Error('Failed to create journal folder in Google Drive');
        }

        const driveResult = await uploadFileToDrive(
          userSettings.google_access_token,
          fileBuffer,
          file.name,
          file.type,
          journalFolderId
        );

        // Update media record
        await adminClient
          .from('journal_media')
          .update({
            drive_file_id: driveResult.id,
            drive_mime_type: driveResult.mimeType,
            public_url: driveResult.webViewLink || driveResult.webContentLink,
            upload_status: 'completed',
          })
          .eq('id', media.id);

        return NextResponse.json({
          message: 'Media uploaded to Google Drive',
          media: {
            ...media,
            drive_file_id: driveResult.id,
            public_url: driveResult.webViewLink,
          },
        });
      } else {
        throw new Error('Invalid storage provider');
      }
    } catch (uploadError: any) {
      // Mark upload as failed
      await adminClient
        .from('journal_media')
        .update({ upload_status: 'failed' })
        .eq('id', media.id);

      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: uploadError.message || 'Upload failed' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error in POST /api/journals/media:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get media files for a journal
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const { searchParams } = new URL(req.url);
    const journalId = searchParams.get('journal_id');
    const mediaType = searchParams.get('media_type') as MediaType | null;

    if (!journalId) {
      return NextResponse.json(
        { error: 'journal_id is required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Get journal
    const { data: journal } = await adminClient
      .from('journals')
      .select('id')
      .eq('journal_id', journalId)
      .eq('user_id', user.id)
      .single();

    if (!journal) {
      return NextResponse.json(
        { error: 'Journal not found' },
        { status: 404 }
      );
    }

    // Build query
    let query = adminClient
      .from('journal_media')
      .select('*')
      .eq('journal_id', journal.id)
      .eq('upload_status', 'completed');

    if (mediaType) {
      query = query.eq('media_type', mediaType);
    }

    const { data: mediaFiles, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Generate signed URLs for Supabase storage files
    const mediaWithUrls = await Promise.all(
      (mediaFiles || []).map(async (media) => {
        if (media.storage_provider === 'supabase' && media.path && media.bucket) {
          try {
            const signedUrl = await getSignedUrl(media.bucket, media.path);
            return { ...media, signed_url: signedUrl };
          } catch (err) {
            console.error('Error generating signed URL:', err);
          }
        }
        return media;
      })
    );

    return NextResponse.json({ media: mediaWithUrls });
  } catch (error: any) {
    console.error('Error in GET /api/journals/media:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Delete media file
 */
export async function DELETE(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const { searchParams } = new URL(req.url);
    const mediaId = searchParams.get('media_id');

    if (!mediaId) {
      return NextResponse.json(
        { error: 'media_id is required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Get media record
    const { data: media, error: fetchError } = await adminClient
      .from('journal_media')
      .select('*')
      .eq('id', mediaId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      );
    }

    // Delete from storage
    try {
      if (media.storage_provider === 'supabase' && media.path && media.bucket) {
        await deleteFromSupabaseStorage(media.bucket, media.path);
      } else if (media.storage_provider === 'google_drive' && media.drive_file_id) {
        // Get user's Google access token
        const { data: userSettings } = await adminClient
          .from('user_settings')
          .select('google_access_token')
          .eq('user_id', user.id)
          .single();

        if (userSettings?.google_access_token) {
          await deleteFileFromDrive(
            userSettings.google_access_token,
            media.drive_file_id
          );
        }
      }
    } catch (storageError) {
      console.error('Error deleting from storage:', storageError);
      // Continue to delete record even if storage deletion fails
    }

    // Delete database record
    const { error: deleteError } = await adminClient
      .from('journal_media')
      .delete()
      .eq('id', mediaId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Media deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/journals/media:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
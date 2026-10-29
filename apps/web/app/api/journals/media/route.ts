// apps/web/app/api/journals/media/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getAuthenticatedUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { error: 'Server misconfigured', status: 500 };
    }

    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { error: 'Unauthorized', status: 401 };
    }
    return { user };
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { user };
}

// Lightweight request logger (avoids printing sensitive headers)
function logRequest(label: string, req: NextRequest) {
  try {
    const headersObj: Record<string, string> = {};
    for (const [k, v] of req.headers.entries()) {
      // avoid logging authorization-like headers
      if (k.toLowerCase().includes('authorization') || k.toLowerCase().includes('cookie')) continue;
      headersObj[k] = v;
    }

    console.info(`[api/journals/media] ${label}`, {
      method: req.method,
      url: req.url,
      headers: headersObj,
    });
  } catch (err) {
    // best-effort logging
    console.info('[api/journals/media] logRequest error', String(err));
  }
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

async function findJournalWithRetry(
  adminClient: ReturnType<typeof createAdminClient>,
  journalIdentifier: string,
  userId: string,
  method: 'GET' | 'POST'
) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const byJournalId = await adminClient
      .from('journals')
      .select('id')
      .eq('journal_id', journalIdentifier)
      .eq('user_id', userId)
      .maybeSingle();

    if (byJournalId.error) {
      throw byJournalId.error;
    }

    if (byJournalId.data) {
      return { journal: byJournalId.data, attempts: attempt, matchedBy: 'journal_id' as const };
    }

    // Some callers pass journals.id instead of journals.journal_id.
    if (UUID_REGEX.test(journalIdentifier)) {
      const byId = await adminClient
        .from('journals')
        .select('id')
        .eq('id', journalIdentifier)
        .eq('user_id', userId)
        .maybeSingle();

      if (byId.error) {
        throw byId.error;
      }

      if (byId.data) {
        return { journal: byId.data, attempts: attempt, matchedBy: 'id' as const };
      }
    }

    if (attempt < maxAttempts) {
      console.info(`[api/journals/media] ${method} retry journal lookup`, {
        journalId: journalIdentifier,
        userId,
        attempt: attempt + 1,
      });

      // Exponential backoff: 100ms, 200ms
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt - 1)));
    }
  }

  return { journal: null, attempts: maxAttempts, matchedBy: null as null };
}

/**
 * Upload media file
 */
export async function POST(req: NextRequest) {
  try {
    logRequest('POST start', req);
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      console.info('[api/journals/media] POST auth failed', { error: authResult.error });
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const formData = await req.formData();
    // Log form data keys and basic file info (no file contents)
    try {
      const keys: string[] = [];
      for (const pair of formData.entries()) keys.push(String(pair[0]));
      const filePreview = (formData.get('file') as File | null);
      console.info('[api/journals/media] POST formData keys', { keys, fileName: filePreview?.name, fileSize: filePreview?.size });
    } catch (e) {
      console.info('[api/journals/media] POST formData parse error', String(e));
    }
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

    // Check if journal exists and belongs to user (with retry for replication lag).
    const { journal, attempts, matchedBy } = await findJournalWithRetry(
      adminClient,
      journalId,
      user.id,
      'POST'
    );

    if (!journal) {
      console.info('[api/journals/media] POST journal not found after retries', { 
        journalId, 
        userId: user.id,
        retriesAttempted: attempts 
      });
      return NextResponse.json(
        { error: 'Journal not found. Please try again.' },
        { status: 404 }
      );
    }
    
    console.info('[api/journals/media] POST journal found', { 
      journalId, 
      internalId: journal.id,
      attempts,
      matchedBy,
    });

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
        }, { status: 201 });
      } else if (storageProvider === 'google_drive') {
        // Upload to Google Drive
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

        const driveResult = await uploadFileToDrive(
          userSettings.google_access_token,
          fileBuffer,
          file.name,
          file.type,
          journalFolderId || driveFolderId || ''
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
        }, { status: 201 });
      } else {
        throw new Error('Invalid storage provider');
      }
    } catch (uploadError: any) {
      // Mark upload as failed
      await adminClient
        .from('journal_media')
        .update({ upload_status: 'failed' })
        .eq('id', media.id);

      console.error('[api/journals/media] Upload error:', uploadError);
      return NextResponse.json(
        { error: uploadError.message || 'Upload failed' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[api/journals/media] Error in POST handler:', error);
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
    logRequest('GET start', req);
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      console.info('[api/journals/media] GET auth failed', { error: authResult.error });
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
      console.info('[api/journals/media] GET missing journal_id', { url: req.url });
      return NextResponse.json(
        { error: 'journal_id is required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Get journal (with retry for replication lag).
    const { journal, attempts, matchedBy } = await findJournalWithRetry(
      adminClient,
      journalId,
      user.id,
      'GET'
    );

    if (!journal) {
      console.info('[api/journals/media] GET journal not found after retries', {
        journalId,
        userId: user.id,
        retriesAttempted: attempts,
      });
      return NextResponse.json({
        success: true,
        media: [],
      });
    }
    
    console.info('[api/journals/media] GET journal found', { 
      journalId, 
      internalId: journal.id,
      attempts,
      matchedBy,
    });

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
      console.error('[api/journals/media] GET query error', error);
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

    console.info('[api/journals/media] GET success', { count: mediaWithUrls?.length ?? 0 });
    return NextResponse.json({ success: true, media: mediaWithUrls });
  } catch (error: any) {
    console.error('[api/journals/media] Error in GET handler:', error);
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
    logRequest('DELETE start', req);
    const authResult = await getAuthenticatedUser(req);
    if ('error' in authResult) {
      console.info('[api/journals/media] DELETE auth failed', { error: authResult.error });
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const { searchParams } = new URL(req.url);
    const mediaId = searchParams.get('media_id');
    const driveFileId = searchParams.get('drive_file_id');

    if (!mediaId && !driveFileId) {
      console.info('[api/journals/media] DELETE missing identifiers', { url: req.url });
      return NextResponse.json(
        { error: 'media_id or drive_file_id is required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Get media record
    let media: any = null;
    let fetchError: any = null;

    if (mediaId) {
      const primaryResult = await adminClient
        .from('journal_media')
        .select('*')
        .eq('id', mediaId)
        .eq('user_id', user.id)
        .single();

      media = primaryResult.data;
      fetchError = primaryResult.error;
    }

    // Fallback for legacy callers that send drive file ids as media_id.
    if ((!media || fetchError) && mediaId) {
      const fallbackResult = await adminClient
        .from('journal_media')
        .select('*')
        .eq('drive_file_id', mediaId)
        .eq('user_id', user.id)
        .single();

      media = fallbackResult.data;
      fetchError = fallbackResult.error;
    }

    if ((!media || fetchError) && driveFileId) {
      const byDriveIdResult = await adminClient
        .from('journal_media')
        .select('*')
        .eq('drive_file_id', driveFileId)
        .eq('user_id', user.id)
        .single();

      media = byDriveIdResult.data;
      fetchError = byDriveIdResult.error;
    }

    if (fetchError || !media) {
      console.info('[api/journals/media] DELETE media not found', {
        mediaId,
        driveFileId,
        userId: user.id,
        fetchError,
      });
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
      console.error('[api/journals/media] Error deleting from storage:', storageError);
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
    console.error('[api/journals/media] Error in DELETE handler:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

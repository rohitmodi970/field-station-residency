// apps/web/app/api/user/onboarding/upload-audio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { uploadToStorage, validateFile, deleteFromStorage } from '@/utils/storage/multi-provider';
import { BUCKETS, USERS_CLOUD_PATHS } from '@/utils/supabase/storage';
import { AudioMetadata } from '@/types/onboarding';
import { MediaType } from '@/types/database';

/**
 * GET user's Google Drive auth status
 */
async function getGoogleDriveAuth(userId: string) {
  const adminClient = createAdminClient();
  
  const { data } = await adminClient
    .from('user_settings')
    .select('google_drive_auth')
    .eq('user_id', userId)
    .single();
  
  return data?.google_drive_auth || null;
}

/**
 * POST - Upload feeling audio for onboarding
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const storageProvider = (formData.get('storage_provider') as string || 'supabase') as 'supabase' | 'google_drive' | 'both';
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateFile(file, 'audio');
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Get Google Drive auth if needed
    let googleAuth = null;
    if (storageProvider === 'google_drive' || storageProvider === 'both') {
      googleAuth = await getGoogleDriveAuth(user.id);
      
      if (!googleAuth) {
        return NextResponse.json(
          { 
            error: 'Google Drive not authorized',
            requiresAuth: true,
            authUrl: '/api/auth/google/authorize'
          },
          { status: 403 }
        );
      }
    }

    // Upload file to users_cloud/onboarding/<userId>/ (private)
    const uploadResult = await uploadToStorage({
      file,
      userId: user.id,
      mediaType: 'audio',
      storageProvider,
      googleAuth,
      bucket: BUCKETS.USERS_CLOUD,
      pathPrefix: USERS_CLOUD_PATHS.ONBOARDING,
    });

    // If there is an existing onboarding audio, try to delete it from storage
    try {
      const adminClientForDelete = createAdminClient();
      const { data: existing } = await adminClientForDelete
        .from('user_onboarding')
        .select('feeling_audio')
        .eq('user_id', user.id)
        .single();

      const prevAudio = existing?.feeling_audio;
      if (prevAudio) {
        try {
          await deleteFromStorage({
            storageProvider: prevAudio.storage_provider,
            bucket: prevAudio.bucket,
            path: prevAudio.path,
            driveFileId: prevAudio.drive_file_id,
            googleAuth: googleAuth || null,
          });
        } catch (delErr) {
          console.error('Failed to delete previous onboarding audio:', delErr);
        }
      }
    } catch (err) {
      console.error('Error checking for existing onboarding audio:', err);
    }

    // Create audio metadata
    const audioMetadata: AudioMetadata = {
      storage_provider: uploadResult.storage_provider === 'both' 
        ? 'supabase' // Default to supabase when both are used
        : uploadResult.storage_provider,
      bucket: uploadResult.bucket,
      path: uploadResult.path,
      public_url: uploadResult.public_url,
      drive_file_id: uploadResult.drive_file_id,
      drive_mime_type: uploadResult.drive_mime_type,
      file_name: uploadResult.file_name,
      file_size: uploadResult.file_size,
      mime_type: uploadResult.mime_type,
      duration: uploadResult.duration,
    };

    // Update onboarding with audio
    const adminClient = createAdminClient();
    const { data: onboarding, error: updateError } = await adminClient
      .from('user_onboarding')
      .update({
        feeling_audio: audioMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating onboarding with audio:', updateError);
      return NextResponse.json(
        { error: 'Failed to save audio metadata' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Audio uploaded successfully',
      data: audioMetadata,
    });
  } catch (error: any) {
    console.error('Error in POST /api/user/onboarding/upload-audio:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

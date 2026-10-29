// apps/web/app/api/user/onboarding/upload-photo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { uploadToStorage, validateFile } from '@/utils/storage/multi-provider';
import { BUCKETS, USERS_CLOUD_PATHS } from '@/utils/supabase/storage';
import { PhotoMetadata } from '@/types/onboarding';
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
 * POST - Upload pretty photo for onboarding
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
    const validation = validateFile(file, 'image');
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
      mediaType: 'image',
      storageProvider,
      googleAuth,
      bucket: BUCKETS.USERS_CLOUD,
      pathPrefix: USERS_CLOUD_PATHS.ONBOARDING,
    });

    // Create photo metadata
    const photoMetadata: PhotoMetadata = {
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
      width: uploadResult.width,
      height: uploadResult.height,
      thumbnail_url: uploadResult.public_url, // Use same URL as thumbnail for now
    };

    // Update onboarding with photo
    const adminClient = createAdminClient();
    const { data: onboarding, error: updateError } = await adminClient
      .from('user_onboarding')
      .update({
        pretty_photo: photoMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating onboarding with photo:', updateError);
      return NextResponse.json(
        { error: 'Failed to save photo metadata' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Photo uploaded successfully',
      data: photoMetadata,
    });
  } catch (error: any) {
    console.error('Error in POST /api/user/onboarding/upload-photo:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

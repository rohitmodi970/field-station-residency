// ===========================================
// app/api/vault/route.ts - WITH STORAGE LIMITS
// Updated to use public.users -> id as the source for user_id
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { BUCKETS, USERS_CLOUD_PATHS } from '@/utils/supabase/storage';

/**
 * GET /api/vault
 * Fetch user's media files with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1) Auth user (auth.users)
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2) Load app user from public.users (this is what user_media.user_id references)
    const {
      data: appUser,
      error: appUserError,
    } = await supabase
      .from('users')
      .select('id, is_active')
      .eq('id', authUser.id)
      .single();

    if (appUserError || !appUser) {
      console.error('App user not found for auth user:', authUser.id, appUserError);
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    if (!appUser.is_active) {
      return NextResponse.json(
        { error: 'User account is inactive' },
        { status: 403 }
      );
    }

    const userId = appUser.id;

    const searchParams = request.nextUrl.searchParams;
    const folder = searchParams.get('folder');
    const mediaType = searchParams.get('media_type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');

    let query = supabase
      .from('user_media')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (folder && ['mydrive', 'journal', 'onboarding'].includes(folder)) {
      query = query.eq('folder', folder);
    }

    if (mediaType && ['image', 'audio', 'video', 'document'].includes(mediaType)) {
      query = query.eq('media_type', mediaType);
    }

    if (search) {
      query = query.ilike('file_name', `%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching media:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vault
 * Upload new media file with storage limit check
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1) Auth user (auth.users)
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2) Load app user from public.users (FK target of user_media.user_id)
    const {
      data: appUser,
      error: appUserError,
    } = await supabase
      .from('users')
      .select('id, is_active')
      .eq('id', authUser.id)
      .single();

    if (appUserError || !appUser) {
      console.error('App user not found for auth user:', authUser.id, appUserError);
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    if (!appUser.is_active) {
      return NextResponse.json(
        { success: false, error: 'User account is inactive' },
        { status: 403 }
      );
    }

    const userId = appUser.id;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = (formData.get('folder') as string) || 'mydrive';
    const isEncrypted = formData.get('is_encrypted') === 'true';
    const encryptionIv = (formData.get('encryption_iv') as string) || null;
    const width = formData.get('width')
      ? parseInt(formData.get('width') as string)
      : null;
    const height = formData.get('height')
      ? parseInt(formData.get('height') as string)
      : null;
    const duration = formData.get('duration')
      ? parseInt(formData.get('duration') as string)
      : null;

    let metadata = null;
    const metadataString = formData.get('metadata') as string;
    if (metadataString) {
      try {
        metadata = JSON.parse(metadataString);
      } catch (e) {
        return NextResponse.json(
          { success: false, error: 'Invalid metadata JSON' },
          { status: 400 }
        );
      }
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate folder - only mydrive uploads allowed
    if (folder !== 'mydrive') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid folder. Only "mydrive" uploads are allowed. Journal and onboarding files are read-only.',
        },
        { status: 400 }
      );
    }

    // Validate file size (50MB per file limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 50MB limit' },
        { status: 400 }
      );
    }

    // ============================================
    // CHECK STORAGE QUOTA (using userId from public.users)
    // ============================================
    console.log('🔍 Checking storage quota...');

    const { data: storageInfo, error: storageError } = await supabase.rpc(
      'get_user_storage_info',
      { p_user_id: userId }
    );

    if (storageError) {
      console.error('❌ Storage check error:', storageError);
      // Continue with default values if function fails
    }

    const storageData = storageInfo?.[0] || {
      used_mb: 0,
      limit_mb: 500,
      remaining_mb: 500,
      usage_percentage: 0,
    };

    console.log('📊 Storage status:', {
      used: `${storageData.used_mb.toFixed(2)} MB`,
      limit: `${storageData.limit_mb} MB`,
      remaining: `${storageData.remaining_mb.toFixed(2)} MB`,
      usage: `${storageData.usage_percentage.toFixed(1)}%`,
    });

    // Check if adding this file would exceed quota
    const fileSizeMB = file.size / (1024 * 1024);
    const newTotalMB = parseFloat(storageData.used_mb) + fileSizeMB;

    if (newTotalMB > storageData.limit_mb) {
      console.log('❌ Storage quota exceeded');
      return NextResponse.json(
        {
          success: false,
          error: 'Storage quota exceeded',
          details: {
            used_mb: parseFloat(storageData.used_mb).toFixed(2),
            limit_mb: storageData.limit_mb,
            file_size_mb: fileSizeMB.toFixed(2),
            would_be_mb: newTotalMB.toFixed(2),
          },
        },
        { status: 413 } // Payload Too Large
      );
    }

    console.log('✅ Storage quota check passed');

    // Determine media type from MIME type
    const mimeType = file.type;
    let mediaType: string;

    if (mimeType.startsWith('image/')) {
      mediaType = 'image';
    } else if (mimeType.startsWith('audio/')) {
      mediaType = 'audio';
    } else if (mimeType.startsWith('video/')) {
      mediaType = 'video';
    } else if (
      mimeType.startsWith('application/pdf') ||
      mimeType.startsWith('application/msword') ||
      mimeType.startsWith('application/vnd.') ||
      mimeType.startsWith('text/')
    ) {
      mediaType = 'document';
    } else {
      return NextResponse.json(
        { success: false, error: 'Unsupported file type' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${timestamp}_${sanitizedFileName}`;
    // Path: vault/<userId>/<fileId>_<originalName>
    const storagePath = `${USERS_CLOUD_PATHS.VAULT}/${userId}/${fileName}`;

    console.log('📤 Starting upload:', {
      fileName: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      type: mediaType,
      folder,
      path: storagePath,
    });

    // Create a pending record first (user_id now references public.users.id)
    const { data: pendingRecord, error: pendingError } = await supabase
      .from('user_media')
      .insert({
        user_id: userId,
        media_type: mediaType,
        file_name: file.name,
        file_size: file.size,
        mime_type: mimeType,
        bucket: BUCKETS.USERS_CLOUD,
        folder: folder,
        path: storagePath,
        upload_status: 'uploading',
        is_encrypted: isEncrypted,
        encryption_iv: encryptionIv,
        width,
        height,
        duration,
        metadata,
      })
      .select()
      .single();

    if (pendingError) {
      console.error('❌ Database error:', pendingError);

      // Check if it's a storage quota error from the trigger
      if (
        pendingError.code === '54000' ||
        pendingError.message?.includes('Storage quota exceeded')
      ) {
        return NextResponse.json(
          {
            success: false,
            error: 'Storage quota exceeded',
            details: pendingError.message,
          },
          { status: 413 }
        );
      }

      return NextResponse.json(
        { success: false, error: pendingError.message },
        { status: 500 }
      );
    }

    console.log('✅ Pending record created:', pendingRecord.id);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKETS.USERS_CLOUD)
      .upload(storagePath, file, {
        contentType: mimeType,
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);

      // Update record to failed status
      await supabase
        .from('user_media')
        .update({ upload_status: 'failed' })
        .eq('id', pendingRecord.id);

      return NextResponse.json(
        { success: false, error: uploadError.message },
        { status: 500 }
      );
    }

    console.log('✅ File uploaded to storage');

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKETS.USERS_CLOUD).getPublicUrl(storagePath);

    // Update record with public URL and completed status
    const { data: mediaRecord, error: updateError } = await supabase
      .from('user_media')
      .update({
        public_url: publicUrl,
        upload_status: 'completed',
      })
      .eq('id', pendingRecord.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Update error:', updateError);
      // Cleanup uploaded file
      await supabase.storage.from(BUCKETS.USERS_CLOUD).remove([storagePath]);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    console.log('🎉 Upload completed successfully');

    // Get updated storage info
    const { data: updatedStorageInfo } = await supabase.rpc(
      'get_user_storage_info',
      { p_user_id: userId }
    );

    return NextResponse.json(
      {
        success: true,
        data: mediaRecord,
        storage: updatedStorageInfo?.[0] || null,
        message: 'File uploaded successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

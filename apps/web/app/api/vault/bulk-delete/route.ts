
// app/api/vault/bulk-delete/route.ts
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { BUCKETS } from '@/utils/supabase/storage';

/**
 * POST /api/vault/bulk-delete
 * Delete multiple media files at once
 * Body: { ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ids } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid or empty ids array' },
        { status: 400 }
      );
    }

    console.log('🗑️ Bulk deleting:', ids.length, 'items');

    // Fetch all media items to delete
    const { data: mediaItems, error: fetchError } = await supabase
      .from('user_media')
      .select('*')
      .in('id', ids)
      .eq('user_id', user.id);

    if (fetchError || !mediaItems || mediaItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No media found to delete' },
        { status: 404 }
      );
    }

    // Delete from storage
    const pathsToDelete = mediaItems.map(item => item.path);
    const { error: storageError } = await supabase.storage
      .from(BUCKETS.USERS_CLOUD)
      .remove(pathsToDelete);

    if (storageError) {
      console.error('❌ Storage delete error:', storageError);
      // Continue with database deletion
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('user_media')
      .delete()
      .in('id', ids)
      .eq('user_id', user.id);

    if (dbError) {
      console.error('❌ Database delete error:', dbError);
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 500 }
      );
    }

    console.log('✅ Bulk delete completed');

    return NextResponse.json({
      success: true,
      message: `${mediaItems.length} media file(s) deleted successfully`,
      deleted_count: mediaItems.length
    });
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

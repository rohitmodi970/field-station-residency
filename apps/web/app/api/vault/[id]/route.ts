import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { BUCKETS } from '@/utils/supabase/storage';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/vault/[id]
 * Fetch single media item by ID
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_media')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching media:', error);
      return NextResponse.json(
        { success: false, error: 'Media not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/vault/[id]
 * Update media metadata (file_name, metadata, folder)
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const allowedUpdates = ['file_name', 'metadata', 'folder', 'width', 'height', 'duration'];
    
    const updates: any = {};
    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // If folder is being changed, we need to move the file in storage
    if (updates.folder) {
      if (!['miscellaneous', 'specific'].includes(updates.folder)) {
        return NextResponse.json(
          { success: false, error: 'Invalid folder value' },
          { status: 400 }
        );
      }

      // Get current media info
      const { data: currentMedia, error: fetchError } = await supabase
        .from('user_media')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !currentMedia) {
        return NextResponse.json(
          { success: false, error: 'Media not found' },
          { status: 404 }
        );
      }

      // Only move if folder actually changed
      if (currentMedia.folder !== updates.folder) {
        const oldPath = currentMedia.path;
        const fileName = oldPath.split('/').pop();
        const newPath = `${updates.folder}/${user.id}/${fileName}`;

        console.log('📁 Moving file:', { from: oldPath, to: newPath });

        // Move file in storage
        const { error: moveError } = await supabase.storage
          .from(BUCKETS.USERS_CLOUD)
          .move(oldPath, newPath);

        if (moveError) {
          console.error('❌ Storage move error:', moveError);
          return NextResponse.json(
            { success: false, error: 'Failed to move file in storage' },
            { status: 500 }
          );
        }

        // Update path and public URL
        updates.path = newPath;
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKETS.USERS_CLOUD)
          .getPublicUrl(newPath);
        updates.public_url = publicUrl;

        console.log('✅ File moved successfully');
      }
    }

    // Perform the update
    const { data, error } = await supabase
      .from('user_media')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating media:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Media updated successfully'
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
 * DELETE /api/vault/[id]
 * Delete media file (from both storage and database)
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get media info first
    const { data: media, error: fetchError } = await supabase
      .from('user_media')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !media) {
      return NextResponse.json(
        { success: false, error: 'Media not found' },
        { status: 404 }
      );
    }

    console.log('🗑️ Deleting media:', { id: media.id, path: media.path });

    // Delete from storage first
    const { error: storageError } = await supabase.storage
      .from(BUCKETS.USERS_CLOUD)
      .remove([media.path]);

    if (storageError) {
      console.error('❌ Storage delete error:', storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete thumbnail if exists
    if (media.thumbnail_url) {
      const thumbnailPath = media.thumbnail_url.split(`/${BUCKETS.USERS_CLOUD}/`)[1];
      if (thumbnailPath) {
        await supabase.storage.from(BUCKETS.USERS_CLOUD).remove([thumbnailPath]);
      }
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('user_media')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (dbError) {
      console.error('❌ Database delete error:', dbError);
      return NextResponse.json(
        { success: false, error: dbError.message },
        { status: 500 }
      );
    }

    console.log('✅ Media deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Media deleted successfully'
    });
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
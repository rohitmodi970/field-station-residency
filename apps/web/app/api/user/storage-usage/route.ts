// apps/web/app/api/user/storage-usage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { StorageUsage, MediaType } from '@/types/database';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminClient = createAdminClient();

    // Get all media for user
    const { data: mediaFiles, error: mediaError } = await adminClient
      .from('journal_media')
      .select('media_type, file_size')
      .eq('user_id', user.id);

    if (mediaError) {
      console.error('Error fetching media:', mediaError);
      return NextResponse.json(
        { error: mediaError.message },
        { status: 500 }
      );
    }

    // Calculate storage usage
    let totalSize = 0;
    const byType: Record<MediaType, { size: number; size_mb: string; count: number }> = {
      image: { size: 0, size_mb: '0 MB', count: 0 },
      audio: { size: 0, size_mb: '0 MB', count: 0 },
      video: { size: 0, size_mb: '0 MB', count: 0 },
      document: { size: 0, size_mb: '0 MB', count: 0 }
    };

    mediaFiles?.forEach(media => {
      const size = media.file_size || 0;
      totalSize += size;
      
      if (media.media_type in byType) {
        byType[media.media_type as MediaType].size += size;
        byType[media.media_type as MediaType].count += 1;
      }
    });

    // Format sizes to MB
    Object.keys(byType).forEach(type => {
      const typeKey = type as MediaType;
      byType[typeKey].size_mb = (byType[typeKey].size / (1024 * 1024)).toFixed(2) + ' MB';
    });

    // Storage limits (1GB default, can be customized per user)
    const totalLimit = 1 * 1024 * 1024 * 1024; // 1GB in bytes
    const remaining = Math.max(0, totalLimit - totalSize);
    const percentageUsed = (totalSize / totalLimit) * 100;

    const usage: StorageUsage = {
      total_size: totalSize,
      total_size_mb: (totalSize / (1024 * 1024)).toFixed(2) + ' MB',
      file_count: mediaFiles?.length || 0,
      by_type: byType,
      limits: {
        total: totalLimit,
        remaining: remaining,
        percentage_used: Math.min(100, Math.round(percentageUsed))
      }
    };

    return NextResponse.json({ usage });
  } catch (error: any) {
    console.error('Error in GET /api/user/storage-usage:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

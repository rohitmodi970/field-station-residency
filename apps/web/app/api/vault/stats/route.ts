
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/vault/stats
 * Get user's media statistics with storage limits
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get summary from the view (now includes storage limits)
    const { data: summary, error: summaryError } = await supabase
      .from('user_media_summary')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (summaryError && summaryError.code !== 'PGRST116') {
      console.error('Error fetching summary:', summaryError);
    }

    // Get storage usage by folder
    const { data: folderStats, error: folderError } = await supabase
      .from('user_media')
      .select('folder, file_size')
      .eq('user_id', user.id)
      .eq('upload_status', 'completed');

    const folderUsage = folderStats?.reduce((acc, item) => {
      if (!acc[item.folder]) {
        acc[item.folder] = 0;
      }
      acc[item.folder] += item.file_size || 0;
      return acc;
    }, {} as Record<string, number>) || {};

    return NextResponse.json({
      success: true,
      data: {
        total_files: summary?.total_files || 0,
        total_size: summary?.total_size || 0,
        total_size_mb: parseFloat(summary?.total_size_mb || 0).toFixed(2),
        storage_limit_mb: summary?.storage_limit_mb || 500,
        remaining_mb: parseFloat(summary?.remaining_mb || 500).toFixed(2),
        usage_percentage: parseFloat(summary?.usage_percentage || 0).toFixed(1),
        is_near_limit: (summary?.usage_percentage || 0) >= 80,
        by_type: {
          image: summary?.image_count || 0,
          audio: summary?.audio_count || 0,
          video: summary?.video_count || 0,
          document: summary?.document_count || 0
        },
        by_folder: {
          miscellaneous: summary?.misc_count || 0,
          specific: summary?.specific_count || 0
        },
        folder_usage: {
          miscellaneous_mb: ((folderUsage.miscellaneous || 0) / (1024 * 1024)).toFixed(2),
          specific_mb: ((folderUsage.specific || 0) / (1024 * 1024)).toFixed(2)
        },
        last_upload: summary?.last_upload || null
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
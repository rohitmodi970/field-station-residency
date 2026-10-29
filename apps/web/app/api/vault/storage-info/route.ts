// ===========================================
// app/api/vault/storage-info/route.ts - NEW ENDPOINT
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/vault/storage-info
 * Get user's storage usage and limit information
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get storage info from function
    const { data, error } = await supabase
      .rpc('get_user_storage_info', { p_user_id: user.id });

    if (error) {
      console.error('Error fetching storage info:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const storageInfo = data?.[0] || {
      used_bytes: 0,
      used_mb: 0,
      limit_mb: 500,
      remaining_mb: 500,
      usage_percentage: 0,
      total_files: 0
    };

    return NextResponse.json({
      success: true,
      data: {
        used_bytes: storageInfo.used_bytes || 0,
        used_mb: parseFloat(storageInfo.used_mb || 0).toFixed(2),
        limit_mb: storageInfo.limit_mb || 500,
        remaining_mb: parseFloat(storageInfo.remaining_mb || 500).toFixed(2),
        usage_percentage: parseFloat(storageInfo.usage_percentage || 0).toFixed(1),
        total_files: storageInfo.total_files || 0,
        is_near_limit: storageInfo.usage_percentage >= 80, // Warning at 80%
        is_full: storageInfo.usage_percentage >= 100
      }
    });
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

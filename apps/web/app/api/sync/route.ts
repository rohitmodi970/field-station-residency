// apps/web/app/api/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }
  
  return { user };
}

/**
 * GET sync status and data since last sync
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
    const lastSyncTime = searchParams.get('last_sync');
    const adminClient = createAdminClient();

    // Get user's last sync timestamp from settings
    const { data: userMetrics } = await adminClient
      .from('user_metrics')
      .select('last_active')
      .eq('user_id', user.id)
      .single();

    const syncTimestamp = lastSyncTime 
      ? new Date(lastSyncTime).toISOString()
      : userMetrics?.last_active || new Date(0).toISOString();

    // Get journals updated since last sync
    const { data: journals, error: journalsError } = await adminClient
      .from('journals')
      .select(`
        *,
        journal_media(*)
      `)
      .eq('user_id', user.id)
      .gte('updated_at', syncTimestamp)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false });

    if (journalsError) {
      return NextResponse.json(
        { error: journalsError.message },
        { status: 500 }
      );
    }

    // Get deleted journals since last sync (for cleanup)
    const { data: deletedJournals } = await adminClient
      .from('journals')
      .select('journal_id')
      .eq('user_id', user.id)
      .eq('is_deleted', true)
      .gte('updated_at', syncTimestamp);

    // Get user settings
    const { data: settings } = await adminClient
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      sync_time: new Date().toISOString(),
      journals: journals || [],
      deleted_journals: (deletedJournals || []).map(j => j.journal_id),
      settings: settings || null,
      has_changes: (journals && journals.length > 0) || (deletedJournals && deletedJournals.length > 0),
    });
  } catch (error: any) {
    console.error('Error in GET /api/sync:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Upload local changes to server (sync from device)
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
    const body = await req.json();
    const { journals = [], deleted_journals = [] } = body;
    const adminClient = createAdminClient();

    const results = {
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process journal updates/creations
    for (const journal of journals) {
      try {
        // Check if journal exists
        const { data: existing } = await adminClient
          .from('journals')
          .select('id, updated_at')
          .eq('journal_id', journal.journal_id)
          .eq('user_id', user.id)
          .single();

        if (existing) {
          // Update if local version is newer
          const localTime = new Date(journal.updated_at || journal.created_at);
          const serverTime = new Date(existing.updated_at);

          if (localTime > serverTime) {
            await adminClient
              .from('journals')
              .update({
                ...journal,
                user_id: user.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
            results.synced++;
          }
        } else {
          // Create new journal
          await adminClient
            .from('journals')
            .insert({
              ...journal,
              user_id: user.id,
              created_at: journal.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          results.synced++;
        }
      } catch (err: any) {
        console.error('Error syncing journal:', err);
        results.failed++;
        results.errors.push(`Failed to sync ${journal.journal_id}: ${err.message}`);
      }
    }

    // Process deletions
    for (const journalId of deleted_journals) {
      try {
        await adminClient
          .from('journals')
          .update({
            is_deleted: true,
            updated_at: new Date().toISOString(),
          })
          .eq('journal_id', journalId)
          .eq('user_id', user.id);
        results.synced++;
      } catch (err: any) {
        console.error('Error deleting journal:', err);
        results.failed++;
        results.errors.push(`Failed to delete ${journalId}: ${err.message}`);
      }
    }

    // Update last active timestamp
    await adminClient
      .from('user_metrics')
      .upsert({
        user_id: user.id,
        last_active: new Date().toISOString(),
      });

    return NextResponse.json({
      message: 'Sync completed',
      sync_time: new Date().toISOString(),
      results,
    });
  } catch (error: any) {
    console.error('Error in POST /api/sync:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET sync statistics
 */
export async function PUT(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      );
    }

    const { user } = authResult;
    const adminClient = createAdminClient();

    // Get journal count
    const { count: journalCount } = await adminClient
      .from('journals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_deleted', false);

    // Get media count and size
    const { data: mediaStats } = await adminClient
      .from('journal_media')
      .select('file_size, media_type')
      .eq('user_id', user.id);

    const totalMediaSize = mediaStats?.reduce((sum, m) => sum + (m.file_size || 0), 0) || 0;
    const mediaByType = mediaStats?.reduce((acc, m) => {
      acc[m.media_type] = (acc[m.media_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Get storage provider info
    const { data: settings } = await adminClient
      .from('user_settings')
      .select('storage_provider, storage_scope')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      journal_count: journalCount || 0,
      total_media_size: totalMediaSize,
      media_by_type: mediaByType,
      storage_provider: settings?.storage_provider || 'supabase',
      storage_scope: settings?.storage_scope || 'device_only',
      last_sync: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in PUT /api/sync:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
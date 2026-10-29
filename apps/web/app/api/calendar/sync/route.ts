// apps/web/app/api/calendar/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// POST /api/calendar/sync - Sync calendar events to to-do list
// This endpoint is a stub for future integration with to-do list system
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

    const body = await req.json();
    const { eventIds, syncMode = 'new' } = body;

    // Get user's calendar connection
    const { data: connection } = await supabase
      .from('user_google_calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: 'Calendar not connected' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // TODO: Implement actual sync logic when to-do system is ready
    // For now, just mark events as synced in cache
    
    if (eventIds && Array.isArray(eventIds) && eventIds.length > 0) {
      // Mark selected events as synced
      await adminClient
        .from('calendar_events_cache')
        .update({ synced_to_todo: true })
        .in('google_event_id', eventIds)
        .eq('user_id', user.id);

      console.log('[Calendar Sync] Marked', eventIds.length, 'events as synced (stub mode)');

      return NextResponse.json({
        success: true,
        message: 'Calendar sync preparation complete',
        syncedCount: eventIds.length,
        mode: 'stub_pending_todo_implementation',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Calendar sync endpoint ready for to-do integration',
      mode: 'stub',
    });
  } catch (error: any) {
    console.error('[Calendar Sync] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/calendar/sync - Get sync status
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

    // Get sync status
    const { data: connection } = await supabase
      .from('user_google_calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!connection) {
      return NextResponse.json({
        connected: false,
        syncEnabled: false,
      });
    }

    // Count unsyced events
    const { count: unsynced } = await supabase
      .from('calendar_events_cache')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('synced_to_todo', false);

    const { count: synced } = await supabase
      .from('calendar_events_cache')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('synced_to_todo', true);

    return NextResponse.json({
      connected: connection.is_active,
      syncEnabled: connection.sync_enabled,
      lastSync: connection.last_sync_at,
      eventsTotal: connection.total_events_fetched || 0,
      eventsCached: (unsynced || 0) + (synced || 0),
      eventsUnsynced: unsynced || 0,
      eventsSynced: synced || 0,
      calendar: {
        name: connection.calendar_name,
        email: connection.google_email,
      },
    });
  } catch (error: any) {
    console.error('[Calendar Sync Status] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

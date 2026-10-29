// apps/web/app/api/calendar/status/route.ts
// Check Google Calendar connection status

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ connected: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's calendar connection
    const { data: connection, error: fetchError } = await supabase
      .from('user_google_calendar_connections')
      .select('id, google_email, calendar_name, calendar_timezone, is_active, sync_enabled, last_sync_at, expires_at')
      .eq('user_id', user.id)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json({
        connected: false,
        email: null,
        calendarName: null,
        connectUrl: '/api/auth/google-calendar/connect',
      });
    }

    // Check if token is expired and connection is active
    const isExpired = connection.expires_at && connection.expires_at < Date.now();
    const isValid = connection.is_active && !isExpired;

    return NextResponse.json({
      connected: isValid,
      email: connection.google_email,
      calendarName: connection.calendar_name,
      timezone: connection.calendar_timezone,
      syncEnabled: connection.sync_enabled,
      lastSyncAt: connection.last_sync_at,
      needsReauth: isExpired,
      connectUrl: '/api/auth/google-calendar/connect',
      disconnectUrl: '/api/auth/google-calendar/disconnect',
    });
  } catch (error: any) {
    console.error('[Calendar Status] Error:', error);
    return NextResponse.json({ connected: false, error: error.message }, { status: 500 });
  }
}

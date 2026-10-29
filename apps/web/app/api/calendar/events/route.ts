// apps/web/app/api/calendar/events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

interface FetchEventsOptions {
  timeMin?: string; // RFC3339 timestamp (e.g., "2024-01-01T00:00:00Z")
  timeMax?: string; // RFC3339 timestamp
  maxResults?: number;
}

// Refresh Google token if expired
async function refreshGoogleToken(
  connection: any,
  adminClient: any
): Promise<string | null> {
  if (!connection.refresh_token) {
    console.warn('[Calendar Events] No refresh token available');
    return null;
  }

  // Check if token is expired
  if (connection.expires_at > Date.now()) {
    // Token still valid
    return connection.access_token;
  }

  console.log('[Calendar Events] Token expired, refreshing...');

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('[Calendar Events] Token refresh failed:', error);
      return null;
    }

    const tokens = await tokenResponse.json();
    const expiresAt = Date.now() + (tokens.expires_in * 1000);

    // Update token in database
    await adminClient
      .from('user_google_calendar_connections')
      .update({
        access_token: tokens.access_token,
        expires_at: expiresAt,
        expires_in: tokens.expires_in,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    console.log('[Calendar Events] Token refreshed successfully');
    return tokens.access_token;
  } catch (error) {
    console.error('[Calendar Events] Error refreshing token:', error);
    return null;
  }
}

// GET /api/calendar/events - Fetch calendar events
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

    // Get user's calendar connection
    const { data: connection, error: fetchError } = await supabase
      .from('user_google_calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (fetchError || !connection) {
      console.log('[Calendar Events] No calendar connection found for user:', user.id);
      return NextResponse.json(
        { error: 'Calendar not connected', events: [] },
        { status: 200 }
      );
    }

    if (!connection.is_active || !connection.sync_enabled) {
      return NextResponse.json(
        { error: 'Calendar sync is disabled', events: [] },
        { status: 200 }
      );
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const timeMin = searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = searchParams.get('timeMax') || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ahead (today + tomorrow)
    const maxResults = parseInt(searchParams.get('maxResults') || '50');
    const useCache = searchParams.get('useCache') !== 'false';

    const adminClient = createAdminClient();

    // Try to refresh token if expired
    let accessToken = connection.access_token;
    if (connection.expires_at <= Date.now()) {
      const refreshedToken = await refreshGoogleToken(connection, adminClient);
      if (!refreshedToken) {
        return NextResponse.json(
          { error: 'Failed to refresh calendar token', events: [] },
          { status: 200 }
        );
      }
      accessToken = refreshedToken;
    }

    // Fetch events from Google Calendar API
    console.log('[Calendar Events] Fetching events from Google Calendar...');
    
    const eventsResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?' + 
      new URLSearchParams({
        timeMin,
        timeMax,
        maxResults: maxResults.toString(),
        singleEvents: 'true',
        orderBy: 'startTime',
      }).toString(),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!eventsResponse.ok) {
      const error = await eventsResponse.text();
      console.error('[Calendar Events] Failed to fetch events:', error);
      
      // Update error tracking
      await adminClient
        .from('user_google_calendar_connections')
        .update({
          last_error: `Failed to fetch events: ${error}`,
          last_error_at: new Date().toISOString(),
          error_count: (connection.error_count || 0) + 1,
        })
        .eq('id', connection.id);

      return NextResponse.json(
        { error: 'Failed to fetch calendar events', events: [] },
        { status: 200 }
      );
    }

    const eventsData = await eventsResponse.json();
    const events = eventsData.items || [];

    console.log('[Calendar Events] Fetched', events.length, 'events');

    // Cache events in database
    if (events.length > 0 && useCache) {
      const cachedEvents = events.map((event: any) => ({
        user_id: user.id,
        connection_id: connection.id,
        google_event_id: event.id,
        event_title: event.summary || '(No title)',
        event_description: event.description,
        event_start: event.start?.dateTime || event.start?.date,
        event_end: event.end?.dateTime || event.end?.date,
        event_location: event.location,
        event_data: event,
        synced_to_todo: false,
      }));

      // Upsert events to cache
      await adminClient
        .from('calendar_events_cache')
        .upsert(cachedEvents, { onConflict: 'user_id,google_event_id' });

      console.log('[Calendar Events] Cached', cachedEvents.length, 'events');
    }

    // Update sync statistics
    await adminClient
      .from('user_google_calendar_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        sync_count: (connection.sync_count || 0) + 1,
        total_events_fetched: (connection.total_events_fetched || 0) + events.length,
        error_count: 0, // Reset error count on success
        last_error: null,
        last_error_at: null,
      })
      .eq('id', connection.id);

    // Transform events to simplified format
    const transformedEvents = events.map((event: any) => ({
      id: event.id,
      title: event.summary || '(No title)',
      description: event.description,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location,
      attendees: event.attendees?.length || 0,
      isAllDay: !event.start?.dateTime,
      htmlLink: event.htmlLink,
      source: 'google-calendar',
    }));

    return NextResponse.json({
      success: true,
      events: transformedEvents,
      count: transformedEvents.length,
      calendar: {
        name: connection.calendar_name,
        timezone: connection.calendar_timezone,
        email: connection.google_email,
      },
    });
  } catch (error: any) {
    console.error('[Calendar Events] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error', events: [] },
      { status: 500 }
    );
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/calendar/events - Create a new calendar event
// ─────────────────────────────────────────────────────────────────────────────

interface CreateEventRequest {
  title: string;
  description?: string;
  start: string; // ISO timestamp
  end?: string; // ISO timestamp (defaults to 30 min after start)
  location?: string;
  action_id?: string; // Optional link to user_action
  todo_id?: string; // Optional link to ai_todo
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateEventRequest = await req.json();

    // Validate required fields
    if (!body.title || !body.start) {
      return NextResponse.json(
        { error: 'Missing required fields: title and start' },
        { status: 400 }
      );
    }

    // Get user's calendar connection
    const { data: connection, error: fetchError } = await supabase
      .from('user_google_calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json(
        { error: 'Calendar not connected' },
        { status: 400 }
      );
    }

    if (!connection.is_active) {
      return NextResponse.json(
        { error: 'Calendar connection is inactive' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Refresh token if expired
    let accessToken = connection.access_token;
    if (connection.expires_at <= Date.now()) {
      const refreshedToken = await refreshGoogleToken(connection, adminClient);
      if (!refreshedToken) {
        return NextResponse.json(
          { error: 'Failed to refresh calendar token. Please reconnect your calendar.' },
          { status: 401 }
        );
      }
      accessToken = refreshedToken;
    }

    // Calculate end time if not provided (default: 30 minutes)
    const startDate = new Date(body.start);
    const endDate = body.end ? new Date(body.end) : new Date(startDate.getTime() + 30 * 60 * 1000);

    // Build Google Calendar event
    const calendarEvent = {
      summary: body.title,
      description: body.description || '',
      location: body.location || '',
      start: {
        dateTime: startDate.toISOString(),
        timeZone: connection.calendar_timezone || 'UTC',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: connection.calendar_timezone || 'UTC',
      },
      reminders: {
        useDefault: true,
      },
    };

    console.log('[Calendar Events] Creating event:', calendarEvent.summary);

    // Create event via Google Calendar API
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(calendarEvent),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Calendar Events] Failed to create event:', error);
      
      // Update error tracking
      await adminClient
        .from('user_google_calendar_connections')
        .update({
          last_error: `Failed to create event: ${error}`,
          last_error_at: new Date().toISOString(),
          error_count: (connection.error_count || 0) + 1,
        })
        .eq('id', connection.id);

      return NextResponse.json(
        { error: 'Failed to create calendar event' },
        { status: 500 }
      );
    }

    const createdEvent = await response.json();
    console.log('[Calendar Events] Event created:', createdEvent.id);

    // Cache the created event
    await adminClient.from('calendar_events_cache').upsert({
      user_id: user.id,
      connection_id: connection.id,
      google_event_id: createdEvent.id,
      event_title: createdEvent.summary,
      event_description: createdEvent.description,
      event_start: createdEvent.start?.dateTime || createdEvent.start?.date,
      event_end: createdEvent.end?.dateTime || createdEvent.end?.date,
      event_location: createdEvent.location,
      event_data: createdEvent,
      synced_to_todo: !!body.todo_id,
      action_id: body.action_id || null,
      todo_id: body.todo_id || null,
    }, { onConflict: 'user_id,google_event_id' });

    // If action_id is provided, update the user_action with calendar_event_id
    if (body.action_id) {
      await supabase
        .from('user_actions')
        .update({ calendar_event_id: createdEvent.id })
        .eq('id', body.action_id)
        .eq('user_id', user.id);
    }

    // If todo_id is provided, update the ai_todo with calendar_event_id
    if (body.todo_id) {
      await supabase
        .from('ai_todos')
        .update({ calendar_event_id: createdEvent.id })
        .eq('id', body.todo_id)
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      success: true,
      event: {
        id: createdEvent.id,
        title: createdEvent.summary,
        description: createdEvent.description,
        start: createdEvent.start?.dateTime || createdEvent.start?.date,
        end: createdEvent.end?.dateTime || createdEvent.end?.date,
        location: createdEvent.location,
        htmlLink: createdEvent.htmlLink,
      },
    });
  } catch (error: any) {
    console.error('[Calendar Events] POST Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
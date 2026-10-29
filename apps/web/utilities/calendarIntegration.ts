// apps/web/utilities/calendarIntegration.ts
/**
 * Google Calendar Integration Utilities
 * Handles calendar connection, token refresh, event fetching, and sync
 */

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string; // ISO 8601 date or datetime
  end: string; // ISO 8601 date or datetime
  location?: string;
  attendees: number;
  isAllDay: boolean;
  htmlLink: string;
  source: 'google-calendar';
}

export interface CalendarConnection {
  id: string;
  is_active: boolean;
  sync_enabled: boolean;
  calendar_name: string;
  google_email: string;
  last_sync_at: string | null;
  total_events_fetched: number;
}

export interface FetchEventsOptions {
  timeMin?: string; // RFC3339 format
  timeMax?: string; // RFC3339 format
  maxResults?: number;
  useCache?: boolean;
}

/**
 * Initiate Google Calendar OAuth flow
 * Returns authorization URL to redirect user to
 */
export async function initiateCalendarConnect(): Promise<{
  authUrl?: string;
  error?: string;
}> {
  try {
    const response = await fetch('/api/auth/google-calendar/connect');
    
    if (!response.ok) {
      return { error: 'Failed to initiate calendar connection' };
    }

    const data = await response.json();
    return { authUrl: data.authUrl };
  } catch (error) {
    console.error('[Calendar] Error initiating connect:', error);
    return { error: 'Failed to initiate calendar connection' };
  }
}

/**
 * Redirect user to Google Calendar authorization
 */
export function redirectToCalendarAuth() {
  initiateCalendarConnect().then(({ authUrl, error }) => {
    if (error) {
      alert(error);
      return;
    }
    if (authUrl) {
      window.location.href = authUrl;
    }
  });
}

/**
 * Disconnect calendar from user account
 */
export async function disconnectCalendar(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const response = await fetch('/api/auth/google-calendar/disconnect', {
      method: 'POST',
    });

    if (!response.ok) {
      return { success: false, error: 'Failed to disconnect calendar' };
    }

    return { success: true };
  } catch (error) {
    console.error('[Calendar] Error disconnecting:', error);
    return { success: false, error: 'Failed to disconnect calendar' };
  }
}

/**
 * Fetch calendar events
 */
export async function fetchCalendarEvents(
  options: FetchEventsOptions = {}
): Promise<{
  success: boolean;
  events: CalendarEvent[];
  calendar?: {
    name: string;
    timezone: string;
    email: string;
  };
  error?: string;
}> {
  try {
    const params = new URLSearchParams();
    
    if (options.timeMin) params.append('timeMin', options.timeMin);
    if (options.timeMax) params.append('timeMax', options.timeMax);
    if (options.maxResults) params.append('maxResults', options.maxResults.toString());
    if (options.useCache !== undefined) params.append('useCache', options.useCache.toString());

    const response = await fetch(`/api/calendar/events?${params.toString()}`);

    if (!response.ok) {
      return {
        success: false,
        events: [],
        error: 'Failed to fetch calendar events',
      };
    }

    const data = await response.json();
    return {
      success: data.success,
      events: data.events || [],
      calendar: data.calendar,
      error: data.error,
    };
  } catch (error) {
    console.error('[Calendar] Error fetching events:', error);
    return {
      success: false,
      events: [],
      error: 'Failed to fetch calendar events',
    };
  }
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<{
  connected: boolean;
  syncEnabled: boolean;
  lastSync?: string;
  eventsTotal?: number;
  eventsCached?: number;
  eventsUnsynced?: number;
  eventsSynced?: number;
  calendar?: {
    name: string;
    email: string;
  };
  error?: string;
}> {
  try {
    const response = await fetch('/api/calendar/sync');

    if (!response.ok) {
      return { connected: false, syncEnabled: false };
    }

    return await response.json();
  } catch (error) {
    console.error('[Calendar] Error getting sync status:', error);
    return { connected: false, syncEnabled: false };
  }
}

/**
 * Request calendar sync to to-do list (when implemented)
 */
export async function requestCalendarSync(eventIds?: string[]): Promise<{
  success: boolean;
  syncedCount?: number;
  error?: string;
}> {
  try {
    const response = await fetch('/api/calendar/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventIds: eventIds || [],
        syncMode: 'new',
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: 'Failed to request calendar sync',
      };
    }

    const data = await response.json();
    return {
      success: data.success,
      syncedCount: data.syncedCount,
      error: data.error,
    };
  } catch (error) {
    console.error('[Calendar] Error requesting sync:', error);
    return {
      success: false,
      error: 'Failed to request calendar sync',
    };
  }
}

/**
 * Format calendar event for display
 */
export function formatEventForDisplay(event: CalendarEvent): {
  title: string;
  dateRange: string;
  time: string;
  location?: string;
} {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

  const dateRange = event.isAllDay
    ? startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const time = !event.isAllDay
    ? `${startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    : 'All day';

  return {
    title: event.title,
    dateRange,
    time,
    location: event.location,
  };
}

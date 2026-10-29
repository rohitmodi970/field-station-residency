/**
 * Calendar & Gmail Agent Integration
 * Connects Force Agent directly to Google Calendar and Gmail:
 * - Reads user's Google Calendar events (live Google Calendar API + token refresh)
 * - Reads residency schedule (Dhun October 24–30)
 * - Reads user's active to-dos and time-blocks
 * - Reads recent Gmail emails (inbox summaries, unread count, snippets)
 * - Provides 1-click connect deep links if services are not yet connected
 */

import { DHUN_SCHEDULE } from './dhunCoordination';
import { fetchTodos } from './appTools';

async function getAdminClient() {
  try {
    const { createAdminClient } = await import('@/utils/supabase/admin');
    return createAdminClient();
  } catch {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'
    );
  }
}

async function refreshGoogleToken(connection: any, adminClient: any, tableName: string): Promise<string | null> {
  if (connection.expires_at > Date.now()) {
    return connection.access_token;
  }
  if (!connection.refresh_token) {
    return connection.access_token || null;
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: connection.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) return null;
    const tokens = await res.json();
    const expiresAt = Date.now() + tokens.expires_in * 1000;

    await adminClient
      .from(tableName)
      .update({
        access_token: tokens.access_token,
        expires_at: expiresAt,
        expires_in: tokens.expires_in,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return tokens.access_token;
  } catch {
    return null;
  }
}

export interface UnifiedScheduleResult {
  date: string;
  isToday: boolean;
  googleCalendar: {
    connected: boolean;
    email?: string;
    events: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      location?: string;
      isAllDay: boolean;
    }>;
  };
  residencySchedule: {
    hasSchedule: boolean;
    location: string;
    events: Array<{
      time: string;
      event: string;
      isMandatoryOrKey?: boolean;
    }>;
  };
  todos: Array<{
    id: string;
    title: string;
    priority?: string;
    status: string;
    due_date?: string | null;
  }>;
  connectUrl?: string;
  summary: string;
}

export async function getUserSchedule(params: {
  userId?: string;
  dateStr?: string; // YYYY-MM-DD
  adminClient?: any;
}): Promise<UnifiedScheduleResult> {
  const adminClient = params.adminClient || (await getAdminClient());
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const targetDate = params.dateStr || todayStr;
  const isToday = targetDate === todayStr;

  const result: UnifiedScheduleResult = {
    date: targetDate,
    isToday,
    googleCalendar: { connected: false, events: [] },
    residencySchedule: { hasSchedule: false, location: 'Dhun Bioreserve', events: [] },
    todos: [],
    summary: '',
  };

  // 1. Check Residency Schedule (Dhun Oct 24-30)
  const residencyDayEvents = DHUN_SCHEDULE[targetDate] || [];
  if (residencyDayEvents.length > 0) {
    result.residencySchedule = {
      hasSchedule: true,
      location: 'Dhun Bioreserve, Jaipur',
      events: residencyDayEvents.map((e) => ({
        time: e.time,
        event: e.event,
        isMandatoryOrKey: e.isMandatoryOrKey,
      })),
    };
  }

  // 2. Check Google Calendar connection
  if (params.userId && adminClient) {
    try {
      const { data: conn } = await adminClient
        .from('user_google_calendar_connections')
        .select('*')
        .eq('user_id', params.userId)
        .eq('is_active', true)
        .maybeSingle();

      if (conn) {
        result.googleCalendar.connected = true;
        result.googleCalendar.email = conn.google_email;

        const token = await refreshGoogleToken(conn, adminClient, 'user_google_calendar_connections');
        if (token) {
          const startIso = new Date(`${targetDate}T00:00:00Z`).toISOString();
          const endIso = new Date(`${targetDate}T23:59:59Z`).toISOString();

          const calRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(
              startIso
            )}&timeMax=${encodeURIComponent(endIso)}&maxResults=25`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (calRes.ok) {
            const calData = await calRes.json();
            result.googleCalendar.events = (calData.items || []).map((item: any) => ({
              id: item.id,
              title: item.summary || '(Untitled)',
              start: item.start?.dateTime || item.start?.date || '',
              end: item.end?.dateTime || item.end?.date || '',
              location: item.location,
              isAllDay: !item.start?.dateTime,
            }));
          }
        }
      } else {
        result.connectUrl = 'https://www.findmyforce.com/settings/integrations';
      }
    } catch (err: any) {
      console.warn('[CalendarGmailTools] Calendar lookup error:', err?.message || err);
    }

    // 3. Check Todos
    try {
      const todos = await fetchTodos({ userId: params.userId });
      result.todos = todos.slice(0, 5).map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        status: t.status,
        due_date: t.due_date,
      }));
    } catch {}
  }

  // Build textual summary
  const summaryParts: string[] = [];
  if (result.residencySchedule.hasSchedule) {
    summaryParts.push(
      `Dhun Residency Schedule for ${targetDate}:\n` +
        result.residencySchedule.events
          .map((e) => `• ${e.time}: ${e.event}${e.isMandatoryOrKey ? ' (Core/Key)' : ''}`)
          .join('\n')
    );
  }

  if (result.googleCalendar.connected) {
    if (result.googleCalendar.events.length > 0) {
      summaryParts.push(
        `Google Calendar Events (${result.googleCalendar.email}):\n` +
          result.googleCalendar.events.map((e) => `• ${e.start.slice(11, 16) || 'All-day'}: ${e.title}`).join('\n')
      );
    } else {
      summaryParts.push(`Google Calendar (${result.googleCalendar.email}): No external meetings booked for this day.`);
    }
  } else {
    summaryParts.push(
      `Google Calendar: Not connected yet. (Connect link: https://www.findmyforce.com/settings/integrations)`
    );
  }

  result.summary = summaryParts.join('\n\n');
  return result;
}

export interface GmailInboxResult {
  connected: boolean;
  email?: string;
  unreadCount?: number;
  messages: Array<{
    id: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
  }>;
  connectUrl?: string;
  summary: string;
}

export async function getUserGmail(params: {
  userId?: string;
  query?: string;
  maxResults?: number;
  adminClient?: any;
}): Promise<GmailInboxResult> {
  const adminClient = params.adminClient || (await getAdminClient());

  if (!params.userId || !adminClient) {
    return {
      connected: false,
      connectUrl: 'https://www.findmyforce.com/settings/integrations',
      messages: [],
      summary: 'Gmail is not connected yet. Connect your Google account to let Force summarize your inbox.',
    };
  }

  try {
    const { data: conn } = await adminClient
      .from('user_google_gmail_connections')
      .select('*')
      .eq('user_id', params.userId)
      .eq('is_active', true)
      .maybeSingle();

    if (!conn) {
      return {
        connected: false,
        connectUrl: 'https://www.findmyforce.com/settings/integrations',
        messages: [],
        summary:
          'Your Gmail is not connected yet. You can connect it in one tap here: https://www.findmyforce.com/settings/integrations',
      };
    }

    const token = await refreshGoogleToken(conn, adminClient, 'user_google_gmail_connections');
    if (!token) {
      return {
        connected: true,
        email: conn.google_email,
        messages: [],
        summary: `Gmail connected (${conn.google_email}), but token needs re-authorization.`,
      };
    }

    const q = params.query || 'is:unread category:primary';
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${params.maxResults || 5}&q=${encodeURIComponent(
        q
      )}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!listRes.ok) {
      return {
        connected: true,
        email: conn.google_email,
        messages: [],
        summary: `Gmail connected (${conn.google_email}), but could not retrieve messages right now.`,
      };
    }

    const listData = await listRes.json();
    const messageItems = listData.messages || [];

    const messages = await Promise.all(
      messageItems.slice(0, 5).map(async (m: any) => {
        try {
          const detailRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!detailRes.ok) return null;
          const data = await detailRes.json();
          const headers = data.payload?.headers || [];
          const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
          const subject = headers.find((h: any) => h.name === 'Subject')?.value || '(No Subject)';
          const date = headers.find((h: any) => h.name === 'Date')?.value || '';

          return {
            id: m.id,
            from,
            subject,
            snippet: data.snippet || '',
            date,
          };
        } catch {
          return null;
        }
      })
    );

    const validMessages = messages.filter(Boolean) as any[];

    const summary =
      `Gmail (${conn.google_email}) — Recent ${params.query ? `matching "${params.query}"` : 'inbox'}:\n` +
      (validMessages.length > 0
        ? validMessages.map((m) => `• From: ${m.from}\n  Subject: ${m.subject}\n  "${m.snippet.slice(0, 100)}..."`).join('\n\n')
        : 'Inbox is clean. No unread messages.');

    return {
      connected: true,
      email: conn.google_email,
      unreadCount: validMessages.length,
      messages: validMessages,
      summary,
    };
  } catch (err: any) {
    return {
      connected: false,
      connectUrl: 'https://www.findmyforce.com/settings/integrations',
      messages: [],
      summary: `Failed to check Gmail: ${err?.message || err}`,
    };
  }
}

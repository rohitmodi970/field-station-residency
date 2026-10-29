// apps/web/app/api/auth/google-calendar/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// GET /api/auth/google-calendar/callback - Handle Google OAuth callback
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    // Handle user rejection
    if (error) {
      console.error('[Calendar OAuth] User rejected:', error);
      return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&error=calendar_auth_denied`);
    }

    if (!code || !state) {
      console.error('[Calendar OAuth] Missing code or state');
      return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&error=missing_oauth_params`);
    }

    // Decode state
    let userId: string;
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = decodedState.userId;
      if (!userId) throw new Error('No userId in state');
    } catch (err) {
      console.error('[Calendar OAuth] Invalid state:', err);
      return NextResponse.redirect(`${baseUrl}/user/settings?tab=integrations&error=invalid_state`);
    }

    const supabase = await createClient();

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user || user.id !== userId) {
      console.error('[Calendar OAuth] Unauthorized:', authError);
      return NextResponse.redirect(`${baseUrl}/settings?tab=integrations&error=unauthorized`);
    }

    // Exchange code for tokens
    const redirectUri = `${baseUrl}/api/auth/google-calendar/callback`;
    console.log('[Calendar OAuth] Token exchange - redirect_uri:', redirectUri);
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Calendar OAuth] Token exchange failed:', errorText);
      return NextResponse.redirect(
        `${baseUrl}/settings?tab=integrations&error=token_exchange_failed`
      );
    }

    const tokens = await tokenResponse.json();
    console.log('[Calendar OAuth] Tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
    });

    // Get Google user info
    const googleUserResponse = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    if (!googleUserResponse.ok) {
      const errorText = await googleUserResponse.text();
      console.error('[Calendar OAuth] Failed to get user info:', {
        status: googleUserResponse.status,
        error: errorText,
      });
      // Provide fallback user info if fetch failed
      // User can still connect, just won't have email displayed initially
    }

    const googleUser = await googleUserResponse.json().catch(() => ({
      email: 'user@gmail.com',
      id: 'unknown',
      picture: null,
    }));
    
    console.log('[Calendar OAuth] Google user:', { email: googleUser.email });

    // Get primary calendar info
    const calendarResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    let calendarName = 'Primary Calendar';
    let calendarTimezone = 'UTC';
    
    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json();
      calendarName = calendarData.summary || 'Primary Calendar';
      calendarTimezone = calendarData.timeZone || 'UTC';
      console.log('[Calendar OAuth] Calendar info retrieved:', {
        name: calendarName,
        timezone: calendarTimezone,
      });
    }

    // Store tokens and connection info in user_google_calendar_connections
    const adminClient = createAdminClient();
    
    const expiresAt = Date.now() + (tokens.expires_in * 1000);
    
    const { error: upsertError } = await adminClient
      .from('user_google_calendar_connections')
      .upsert({
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_type: tokens.token_type || 'Bearer',
        expires_at: expiresAt,
        expires_in: tokens.expires_in,
        scope: tokens.scope,
        google_email: googleUser.email,
        google_user_id: googleUser.id,
        google_calendar_id: 'primary',
        calendar_name: calendarName,
        calendar_timezone: calendarTimezone,
        is_active: true,
        sync_enabled: true,
        last_sync_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (upsertError) {
      console.error('[Calendar OAuth] Failed to store connection:', upsertError);
      return NextResponse.redirect(
        `${baseUrl}/user/settings?tab=integrations&error=storage_failed`
      );
    }

    console.log('[Calendar OAuth] Connection stored successfully');

    // Redirect to settings with success
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&calendar=connected`
    );
  } catch (error: any) {
    console.error('[Calendar OAuth] Error:', error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://localhost:3000';
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=integrations&error=internal_error`
    );
  }
}

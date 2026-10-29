// apps/web/app/api/auth/google-calendar/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// GET /api/auth/google-calendar/connect - Initiate Google Calendar OAuth flow
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

    // Google OAuth 2.0 configuration
    const clientId = process.env.GOOGLE_CLIENT_ID;
    
    // Get base URL from request (works in dev and production)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const redirectUri = `${baseUrl}/api/auth/google-calendar/callback`;
    
    // Calendar-specific scopes
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly', // Read calendar events
      'https://www.googleapis.com/auth/calendar.events.readonly', // Read calendar event details
      'https://www.googleapis.com/auth/userinfo.profile', // Get user profile info
      'https://www.googleapis.com/auth/userinfo.email', // Get user email
    ].join(' ');

    if (!clientId) {
      console.error('GOOGLE_CLIENT_ID not set in environment variables');
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      );
    }

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline', // Get refresh token
      prompt: 'consent', // Force consent screen to get refresh token
      state: Buffer.from(JSON.stringify({ userId: user.id, source: 'calendar' })).toString('base64'),
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.json({ authUrl });
  } catch (error: any) {
    console.error('Error in GET /api/auth/google-calendar/connect:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

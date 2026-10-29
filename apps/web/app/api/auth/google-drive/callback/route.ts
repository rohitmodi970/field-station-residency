import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// GET /api/auth/google-drive/callback - Handle Google OAuth callback
export async function GET(request: NextRequest) {
  // Auto-detect base URL from request
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                  `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // user_id
    const error = searchParams.get('error');

    console.log('OAuth Callback - baseUrl:', baseUrl);
    console.log('OAuth Callback - code:', code?.substring(0, 20) + '...');
    console.log('OAuth Callback - state:', state);

    if (error) {
      // User denied access or other error
      return NextResponse.redirect(
        `${baseUrl}/user/settings?tab=storage&error=${error}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${baseUrl}/user/settings?tab=storage&error=missing_params`
      );
    }

    const supabase = await createClient();

    // Exchange code for tokens
    const redirectUri = `${baseUrl}/api/auth/google-drive/callback`;
    console.log('Token exchange - redirect_uri:', redirectUri);
    
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
      console.error('Token exchange failed:', errorText);
      return NextResponse.redirect(
        `${baseUrl}/user/settings?tab=storage&error=token_exchange_failed`
      );
    }

    const tokens = await tokenResponse.json();
    console.log('Token exchange successful:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope
    });

    // Store tokens in database
    const expiresAtMs = Date.now() + (tokens.expires_in * 1000); // Unix timestamp in milliseconds
    const { error: dbError } = await supabase
      .from('user_google_drive_connections')
      .upsert({
        user_id: state, // user_id from state parameter
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_type: tokens.token_type || 'Bearer',
        expires_at: expiresAtMs, // bigint - Unix timestamp in ms
        expires_in: tokens.expires_in, // integer - seconds
        scope: tokens.scope,
        is_active: true,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.redirect(
        `${baseUrl}/user/settings?tab=storage&error=db_error`
      );
    }

    // Redirect back to settings page with success
    return NextResponse.redirect(
      `${baseUrl}/user/settings?tab=storage&success=connected`
    );
  } catch (error) {
    console.error('Error in Google Drive callback:', error);
    return NextResponse.redirect(
      `${baseUrl}/user/settings?tab=storage&error=internal_error`
    );
  }
}

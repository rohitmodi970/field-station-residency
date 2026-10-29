import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// GET /api/auth/google-drive/connect - Initiate Google Drive OAuth flow
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
    const redirectUri = `${baseUrl}/api/auth/google-drive/callback`;
    const scope = 'https://www.googleapis.com/auth/drive.file';

    if (!clientId) {
      console.error('GOOGLE_CLIENT_ID not set in environment variables');
      return NextResponse.json(
        { error: 'Google OAuth not configured' },
        { status: 500 }
      );
    }

    console.log('🔗 OAuth Config:', {
      clientId: clientId.substring(0, 20) + '...',
      redirectUri,
      scope
    });

    // Build OAuth URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    authUrl.searchParams.append('state', user.id); // Pass user ID to callback

    console.log('✅ Redirecting to Google OAuth:', authUrl.toString());

    return NextResponse.json({ 
      authUrl: authUrl.toString() 
    });
  } catch (error) {
    console.error('Error in GET /api/auth/google-drive/connect:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

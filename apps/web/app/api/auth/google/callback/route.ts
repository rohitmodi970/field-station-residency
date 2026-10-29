// apps/web/app/api/auth/google/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getTokensFromCode, getDefaultConfig } from '@/utils/google-drive/client';

/**
 * GET - Handle Google OAuth callback
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_API_URL}/user/settings?google_auth=error&message=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: 'No authorization code provided' },
        { status: 400 }
      );
    }

    // Decode state to get user ID
    let userId: string;
    try {
      const decodedState = JSON.parse(Buffer.from(state || '', 'base64').toString());
      userId = decodedState.userId;
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid state parameter' },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user || user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Exchange code for tokens
    const config = getDefaultConfig();
    const tokens = await getTokensFromCode(config, code);

    // Store tokens in user_settings
    const adminClient = createAdminClient();
    const { error: updateError } = await adminClient
      .from('user_settings')
      .update({
        google_drive_auth: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error saving Google Drive tokens:', updateError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_API_URL}/user/settings?google_auth=error&message=Failed+to+save+tokens`
      );
    }

    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_API_URL}/user/settings?google_auth=success`
    );
  } catch (error: any) {
    console.error('Error in GET /api/auth/google/callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_API_URL}/user/settings?google_auth=error&message=${encodeURIComponent(error.message)}`
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  exchangeGoogleAuthCode,
  fetchGoogleUserInfo,
  getAppBaseUrl,
} from '@/utilities/googleOAuth';

export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl(request.nextUrl.protocol, request.nextUrl.host);
  const integrationsUrl = `${baseUrl}/settings?tab=integrations`;

  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(`${integrationsUrl}&error=gmail_auth_denied`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${integrationsUrl}&error=missing_oauth_params`);
    }

    let userId: string;
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = decodedState.userId;
      if (!userId) throw new Error('No userId in state');
    } catch {
      return NextResponse.redirect(`${integrationsUrl}&error=invalid_state`);
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || user.id !== userId) {
      return NextResponse.redirect(`${integrationsUrl}&error=unauthorized`);
    }

    const redirectUri = `${baseUrl}/api/auth/google-gmail/callback`;
    const tokens = await exchangeGoogleAuthCode(code, redirectUri);
    const googleUser = await fetchGoogleUserInfo(tokens.access_token);

    const adminClient = createAdminClient();
    const expiresAt = Date.now() + tokens.expires_in * 1000;

    const { error: upsertError } = await adminClient
      .from('user_google_gmail_connections')
      .upsert(
        {
          user_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          token_type: tokens.token_type || 'Bearer',
          expires_at: expiresAt,
          expires_in: tokens.expires_in,
          scope: tokens.scope || 'userinfo.email',
          google_email: googleUser.email || null,
          google_user_id: googleUser.id || null,
          is_active: true,
          sync_enabled: true,
          last_sync_at: new Date().toISOString(),
          error_count: 0,
          last_error: null,
          last_error_at: null,
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      console.error('[Gmail OAuth] Failed to store connection:', upsertError);
      return NextResponse.redirect(`${integrationsUrl}&error=storage_failed`);
    }

    await adminClient
      .from('user_notification_settings')
      .upsert(
        {
          user_id: user.id,
          email_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    return NextResponse.redirect(`${integrationsUrl}&gmail=connected`);
  } catch (error: unknown) {
    console.error('[Gmail OAuth] Error:', error);
    return NextResponse.redirect(`${integrationsUrl}&error=internal_error`);
  }
}

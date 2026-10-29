import type { SupabaseClient } from '@supabase/supabase-js';

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
  refresh_token?: string;
};

type GoogleConnectionRow = {
  id: string;
  access_token: string;
  refresh_token?: string | null;
  expires_at: number;
  error_count?: number | null;
};

export function getAppBaseUrl(protocol: string, host: string): string {
  return process.env.NEXT_PUBLIC_APP_URL || `${protocol}//${host}`;
}

export async function exchangeGoogleAuthCode(code: string, redirectUri: string): Promise<GoogleTokenResponse> {
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
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  return tokenResponse.json();
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<{
  email?: string;
  id?: string;
  picture?: string | null;
}> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return { email: undefined, id: undefined, picture: null };
  }

  return response.json();
}

export async function revokeGoogleAccessToken(accessToken: string): Promise<void> {
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `token=${accessToken}`,
  });
}

export async function refreshGoogleAccessToken(
  connection: GoogleConnectionRow,
  adminClient: SupabaseClient,
  tableName: 'user_google_calendar_connections' | 'user_google_gmail_connections'
): Promise<string | null> {
  if (connection.expires_at > Date.now()) {
    return connection.access_token;
  }

  if (!connection.refresh_token) {
    return null;
  }

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
    return null;
  }

  const tokens = await tokenResponse.json();
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

  return tokens.access_token as string;
}

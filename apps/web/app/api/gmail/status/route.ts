import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ connected: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: connection, error: fetchError } = await supabase
      .from('user_google_gmail_connections')
      .select('id, google_email, is_active, sync_enabled, last_sync_at, expires_at')
      .eq('user_id', user.id)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json({
        connected: false,
        email: null,
        connectUrl: '/api/auth/google-gmail/connect',
      });
    }

    const isExpired = connection.expires_at && connection.expires_at < Date.now();
    const isValid = connection.is_active && !isExpired;

    return NextResponse.json({
      connected: isValid,
      email: connection.google_email,
      syncEnabled: connection.sync_enabled,
      needsReauth: isExpired,
      connectUrl: '/api/auth/google-gmail/connect',
      disconnectUrl: '/api/auth/google-gmail/disconnect',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ connected: false, error: message }, { status: 500 });
  }
}

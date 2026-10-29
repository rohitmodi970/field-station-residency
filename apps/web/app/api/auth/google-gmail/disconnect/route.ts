import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revokeGoogleAccessToken } from '@/utilities/googleOAuth';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: connection, error: fetchError } = await supabase
      .from('user_google_gmail_connections')
      .select('access_token')
      .eq('user_id', user.id)
      .single();

    if (!connection && fetchError?.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Failed to fetch connection' }, { status: 500 });
    }

    if (connection?.access_token) {
      try {
        await revokeGoogleAccessToken(connection.access_token);
      } catch (err) {
        console.warn('[Gmail Disconnect] Token revoke failed:', err);
      }
    }

    const adminClient = createAdminClient();

    const { error: deleteError } = await adminClient
      .from('user_google_gmail_connections')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to disconnect Gmail' }, { status: 500 });
    }

    await adminClient.from('gmail_messages_cache').delete().eq('user_id', user.id);

    return NextResponse.json({ message: 'Gmail disconnected successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

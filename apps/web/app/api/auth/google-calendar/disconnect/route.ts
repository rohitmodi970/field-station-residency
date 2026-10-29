// apps/web/app/api/auth/google-calendar/disconnect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// POST /api/auth/google-calendar/disconnect - Disconnect calendar
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the connection to revoke token
    const { data: connection, error: fetchError } = await supabase
      .from('user_google_calendar_connections')
      .select('access_token, google_calendar_id')
      .eq('user_id', user.id)
      .single();

    if (!connection && fetchError?.code !== 'PGRST116') {
      console.error('[Calendar Disconnect] Failed to fetch connection:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch connection' },
        { status: 500 }
      );
    }

    // Revoke Google token
    if (connection?.access_token) {
      try {
        const revokeResponse = await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `token=${connection.access_token}`,
        });

        if (!revokeResponse.ok) {
          console.warn('[Calendar Disconnect] Token revoke partially failed:', await revokeResponse.text());
          // Continue anyway - delete local connection
        }
      } catch (err) {
        console.error('[Calendar Disconnect] Error revoking token:', err);
        // Continue anyway
      }
    }

    // Delete connection from database
    const adminClient = createAdminClient();
    const { error: deleteError } = await adminClient
      .from('user_google_calendar_connections')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('[Calendar Disconnect] Failed to delete connection:', deleteError);
      return NextResponse.json(
        { error: 'Failed to disconnect calendar' },
        { status: 500 }
      );
    }

    // Optionally delete cached events
    await adminClient
      .from('calendar_events_cache')
      .delete()
      .eq('user_id', user.id);

    console.log('[Calendar Disconnect] Calendar disconnected for user:', user.id);

    return NextResponse.json({ 
      message: 'Calendar disconnected successfully' 
    });
  } catch (error: any) {
    console.error('[Calendar Disconnect] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

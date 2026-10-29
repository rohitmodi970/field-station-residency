import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// GET /api/auth/google-drive/status - Check if Google Drive is connected
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has Google Drive connection
    const { data: connection, error: fetchError } = await supabase
      .from('user_google_drive_connections')
      .select('id, created_at, scope')
      .eq('user_id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error checking connection:', fetchError);
      return NextResponse.json(
        { error: 'Failed to check connection status' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      connected: !!connection,
      connection: connection ? {
        id: connection.id,
        connectedAt: connection.created_at,
        scope: connection.scope
      } : null
    });
  } catch (error) {
    console.error('Error in GET /api/auth/google-drive/status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

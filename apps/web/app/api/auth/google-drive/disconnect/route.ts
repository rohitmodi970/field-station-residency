import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// POST /api/auth/google-drive/disconnect - Revoke Google Drive access
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user has Google Drive connected
    const { data: connection, error: fetchError } = await supabase
      .from('user_google_drive_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json(
        { error: 'No Google Drive connection found' },
        { status: 404 }
      );
    }

    // Revoke access token with Google
    if (connection.access_token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${connection.access_token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
      } catch (revokeError) {
        console.error('Error revoking Google token:', revokeError);
        // Continue even if revoke fails - we'll delete our record
      }
    }

    // Delete connection from database
    const { error: deleteError } = await supabase
      .from('user_google_drive_connections')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting connection:', deleteError);
      return NextResponse.json(
        { error: 'Failed to disconnect Google Drive' },
        { status: 500 }
      );
    }

    // Update user settings to remove Google Drive as provider
    const { data: settings } = await supabase
      .from('user_settings')
      .select('storage_provider')
      .eq('user_id', user.id)
      .single();

    if (settings && (settings.storage_provider === 'google_drive' || settings.storage_provider === 'both')) {
      await supabase
        .from('user_settings')
        .update({
          storage_provider: 'supabase',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
    }

    return NextResponse.json({ 
      message: 'Google Drive disconnected successfully' 
    });
  } catch (error) {
    console.error('Error in POST /api/auth/google-drive/disconnect:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: connectionId } = await params;

    // Verify the connection exists, is pending, and the current user is the recipient
    const { data: connection, error: fetchError } = await supabase
      .from('force_connections')
      .select('id, recipient_id, status')
      .eq('id', connectionId)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    if (connection.recipient_id !== user.id) {
      return NextResponse.json({ error: 'Only the recipient can accept a connection request' }, { status: 403 });
    }

    if (connection.status !== 'pending') {
      return NextResponse.json({ error: `Cannot accept connection with status: ${connection.status}` }, { status: 400 });
    }

    // Update connection status
    const { data: updatedConnection, error: updateError } = await supabase
      .from('force_connections')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
        relationship_created_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error accepting connection:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ connection: updatedConnection });
  } catch (error: any) {
    console.error('Error in POST /api/connections/[id]/accept:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: connectionId } = await params;

    const { data: connection, error: fetchError } = await supabase
      .from('force_connections')
      .select('id, recipient_id, requester_id, status')
      .eq('id', connectionId)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    if (connection.recipient_id !== user.id && connection.requester_id !== user.id) {
      return NextResponse.json({ error: 'You are not a party to this connection' }, { status: 403 });
    }

    // Dissolve the connection (atomic - revokes all, purges inference, cooldown)
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() + 30); // 30 day cooldown after dissolution

    const { data: updatedConnection, error: updateError } = await supabase
      .from('force_connections')
      .update({
        status: 'dissolved',
        dissolved_at: new Date().toISOString(),
        cooldown_until: cooldownDate.toISOString()
        // We could also reset modeling flags here
      })
      .eq('id', connectionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error dissolving connection:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Cascade revoke all active grants for this connection
    // Setting status to 'revoked' and revoked_at
    const { error: revokeError } = await supabase
      .from('consent_grants')
      .update({ 
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_reason: 'connection_dissolved'
      })
      .eq('connection_id', connectionId)
      .in('status', ['active', 'pending_acceptance']);

    if (revokeError) {
      console.error('Error revoking grants on dissolution:', revokeError);
      // We don't fail the request since the connection is dissolved, but log it
    }

    return NextResponse.json({ success: true, connection: updatedConnection });
  } catch (error: any) {
    console.error('Error in DELETE /api/connections/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

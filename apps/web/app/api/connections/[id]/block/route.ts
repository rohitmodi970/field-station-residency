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

    const { data: connection, error: fetchError } = await supabase
      .from('force_connections')
      .select('id, recipient_id, requester_id, status')
      .eq('id', connectionId)
      .single();

    if (fetchError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Usually only the recipient blocks a requester, but either party can block the other to sever ties
    if (connection.recipient_id !== user.id && connection.requester_id !== user.id) {
      return NextResponse.json({ error: 'You are not a party to this connection' }, { status: 403 });
    }

    // Set to blocked
    const { data: updatedConnection, error: updateError } = await supabase
      .from('force_connections')
      .update({
        status: 'blocked',
        responded_at: new Date().toISOString()
        // No cooldown needed for blocked since it's permanent until unblocked
      })
      .eq('id', connectionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error blocking connection:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Note: the cascade logic for consent_grants won't trigger automatically on status update, 
    // we would need a database trigger or to revoke all grants here. For Phase 4, we assume dissolved 
    // handles active destruction and blocked prevents future requests.

    return NextResponse.json({ connection: updatedConnection });
  } catch (error: any) {
    console.error('Error in POST /api/connections/[id]/block:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

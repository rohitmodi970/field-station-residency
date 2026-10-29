import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recipient_id } = await req.json();

    if (!recipient_id) {
      return NextResponse.json({ error: 'recipient_id is required' }, { status: 400 });
    }

    if (recipient_id === user.id) {
      return NextResponse.json({ error: 'Cannot connect with yourself' }, { status: 400 });
    }

    // Check if a connection already exists in either direction
    const { data: existingConnection, error: checkError } = await supabase
      .from('force_connections')
      .select('id, status, cooldown_until')
      .or(`and(requester_id.eq.${user.id},recipient_id.eq.${recipient_id}),and(requester_id.eq.${recipient_id},recipient_id.eq.${user.id})`)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing connection:', checkError);
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }

    if (existingConnection) {
      if (existingConnection.status === 'blocked') {
        return NextResponse.json({ error: 'Cannot send connection request' }, { status: 403 });
      }
      if (['pending', 'accepted'].includes(existingConnection.status)) {
        return NextResponse.json({ error: 'Connection already exists or is pending' }, { status: 409 });
      }
      if (existingConnection.cooldown_until && new Date(existingConnection.cooldown_until) > new Date()) {
        return NextResponse.json({ error: 'Please wait before sending another request' }, { status: 429 });
      }

      // If dissolved/expired and past cooldown, we can update it or delete and recreate.
      // Recreating is cleaner to reset timestamps and states.
      await supabase.from('force_connections').delete().eq('id', existingConnection.id);
    }

    // Insert new connection request
    const { data: newConnection, error: insertError } = await supabase
      .from('force_connections')
      .insert({
        requester_id: user.id,
        recipient_id: recipient_id,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating connection request:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ connection: newConnection });
  } catch (error: any) {
    console.error('Error in POST /api/connections/request:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

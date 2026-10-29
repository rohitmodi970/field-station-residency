import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { buildRelationshipContextSnapshot } from '@/lib/agent/v2/relationshipContextService';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: connectionId } = await params;

    // 1. Fetch connection details without PostgREST FK join
    const { data: conn, error: connErr } = await supabase
      .from('force_connections')
      .select(`
        id,
        status,
        requested_at,
        responded_at,
        requester_id,
        recipient_id,
        requester_allows_modeling,
        recipient_allows_modeling
      `)
      .eq('id', connectionId)
      .maybeSingle();

    if (connErr || !conn) {
      console.error('Error fetching connection:', connErr);
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const isRequester = conn.requester_id === user.id;
    const isRecipient = conn.recipient_id === user.id;

    if (!isRequester && !isRecipient) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Hydrate partner profile using admin client (bypassing RLS on users table)
    const partnerId = isRequester ? conn.recipient_id : conn.requester_id;
    const admin = createAdminClient();
    const { data: partner } = await admin
      .from('users')
      .select('id, name, email, username, profile_image')
      .eq('id', partnerId)
      .maybeSingle();
    const myAllowsModeling = isRequester ? conn.requester_allows_modeling : conn.recipient_allows_modeling;
    const partnerAllowsModeling = isRequester ? conn.recipient_allows_modeling : conn.requester_allows_modeling;
    const bothOptedIn = Boolean(myAllowsModeling && partnerAllowsModeling);

    // 2. Fetch Tri-Context isolated snapshot
    const contextResult = await buildRelationshipContextSnapshot(supabase, connectionId, user.id);

    return NextResponse.json({
      success: true,
      connection: {
        id: conn.id,
        status: conn.status,
        requested_at: conn.requested_at,
        partner,
        my_allows_modeling: myAllowsModeling,
        partner_allows_modeling: partnerAllowsModeling,
        both_opted_in: bothOptedIn,
      },
      relationship_context: contextResult.snapshot?.relationship_context || {},
      is_modeling_permitted: contextResult.permitted,
      reason: contextResult.reason,
    });
  } catch (err: any) {
    console.error('💥 [API:Connections:Context] Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

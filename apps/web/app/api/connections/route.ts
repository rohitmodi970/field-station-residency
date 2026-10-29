import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch connections (flat, no FK join — FKs point to auth.users not public.users)
    const { data: rawConnections, error } = await supabase
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
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .not('status', 'in', '("dissolved","expired")')
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Error fetching connections:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!rawConnections || rawConnections.length === 0) {
      return NextResponse.json({ connections: [] });
    }

    // Collect unique user IDs to hydrate profiles
    const userIds = new Set<string>();
    for (const c of rawConnections) {
      userIds.add(c.requester_id);
      userIds.add(c.recipient_id);
    }

    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from('users')
      .select('id, name, email, username, profile_image')
      .in('id', Array.from(userIds));

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p])
    );

    // Attach requester/recipient profiles to each connection
    const connections = rawConnections.map((c) => ({
      ...c,
      requester: profileMap.get(c.requester_id) || null,
      recipient: profileMap.get(c.recipient_id) || null,
    }));

    return NextResponse.json({ connections });
  } catch (error: any) {
    console.error('Error in GET /api/connections:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


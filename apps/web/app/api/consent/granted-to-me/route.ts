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

    // List grants where I am the grantee
    // Only return active or pending_acceptance
    const { data: grants, error } = await supabase
      .from('consent_grants')
      .select(`
        id,
        grant_type,
        status,
        expires_at,
        granted_at,
        journal_id,
        entry_id,
        grantor_id,
        connection_id,
        grantee_wrapped_key,
        requires_acceptance,
        shared_entry_snapshots(id, title_encrypted, title_iv, content_encrypted, snapshot_at)
      `)
      .eq('grantee_id', user.id)
      .in('status', ['active', 'pending_acceptance'])
      .order('granted_at', { ascending: false });

    if (error) {
      console.error('Error fetching grants received:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!grants || grants.length === 0) {
      return NextResponse.json({ grants: [] });
    }

    // Hydrate grantor profiles using admin client (bypassing RLS on users table)
    const grantorIds = Array.from(new Set(grants.map(g => g.grantor_id).filter(Boolean)));
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from('users')
      .select('id, name, email, username, profile_image')
      .in('id', grantorIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const populatedGrants = grants.map(g => ({
      ...g,
      grantor: profileMap.get(g.grantor_id) || null
    }));

    // Filter out expired grants on the fly, just in case cron hasn't run
    const validGrants = populatedGrants.filter(g => !g.expires_at || new Date(g.expires_at) > new Date());

    return NextResponse.json({ grants: validGrants });
  } catch (error: any) {
    console.error('Error in GET /api/consent/granted-to-me:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

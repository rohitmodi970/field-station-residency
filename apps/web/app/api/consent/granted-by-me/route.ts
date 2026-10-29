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

    // List grants where I am the grantor
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
        grantee_id,
        connection_id
      `)
      .eq('grantor_id', user.id)
      .in('status', ['active', 'pending_acceptance'])
      .order('granted_at', { ascending: false });

    if (error) {
      console.error('Error fetching grants:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!grants || grants.length === 0) {
      return NextResponse.json({ grants: [] });
    }

    // Hydrate grantee profiles using admin client (bypassing RLS on users table)
    const granteeIds = Array.from(new Set(grants.map(g => g.grantee_id).filter(Boolean)));
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from('users')
      .select('id, name, email, username, profile_image')
      .in('id', granteeIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const populatedGrants = grants.map(g => ({
      ...g,
      grantee: profileMap.get(g.grantee_id) || null
    }));

    return NextResponse.json({ grants: populatedGrants });
  } catch (error: any) {
    console.error('Error in GET /api/consent/granted-by-me:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

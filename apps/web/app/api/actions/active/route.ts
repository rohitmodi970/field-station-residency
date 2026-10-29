// apps/web/app/api/actions/active/route.ts
// GET: Fetch all active actions for the current user
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Get active actions and recently completed (for showing progress)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: actions, error } = await adminClient
      .from('user_actions')
      .select('*')
      .eq('user_id', user.id)
      .or(`status.eq.active,and(status.eq.completed,completed_at.gte.${sevenDaysAgo.toISOString()})`)
      .order('accepted_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    return NextResponse.json({ actions: actions || [] });
  } catch (error: any) {
    console.error('Fetch active actions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active actions', details: error.message },
      { status: 500 }
    );
  }
}

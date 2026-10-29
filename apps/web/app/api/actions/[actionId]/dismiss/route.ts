// apps/web/app/api/actions/[actionId]/dismiss/route.ts
// POST: Dismiss an action (remove from active list)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ actionId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { actionId } = await params;
    const adminClient = createAdminClient();

    // Verify action belongs to user
    const { data: action, error: fetchError } = await adminClient
      .from('user_actions')
      .select('id, user_id')
      .eq('id', actionId)
      .single();

    if (fetchError || !action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    if (action.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Mark as dismissed
    const { error: updateError } = await adminClient
      .from('user_actions')
      .update({
        status: 'dismissed',
        dismissed_at: new Date().toISOString(),
      })
      .eq('id', actionId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Dismiss action error:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss action', details: error.message },
      { status: 500 }
    );
  }
}

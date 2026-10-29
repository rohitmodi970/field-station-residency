// apps/web/app/api/actions/[actionId]/complete/route.ts
// POST: Mark an action as completed
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
      .select('id, user_id, status')
      .eq('id', actionId)
      .single();

    if (fetchError || !action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    if (action.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (action.status === 'completed') {
      return NextResponse.json({ message: 'Action already completed', action });
    }

    // Mark as completed
    const { data: updatedAction, error: updateError } = await adminClient
      .from('user_actions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ action: updatedAction, success: true });
  } catch (error: any) {
    console.error('Complete action error:', error);
    return NextResponse.json(
      { error: 'Failed to complete action', details: error.message },
      { status: 500 }
    );
  }
}

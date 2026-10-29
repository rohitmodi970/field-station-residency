import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: grantId } = await params;

    // Verify the grant exists and belongs to the current user (as grantee)
    const { data: grant, error: fetchError } = await supabase
      .from('consent_grants')
      .select('id, grantee_id, status')
      .eq('id', grantId)
      .single();

    if (fetchError || !grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    if (grant.grantee_id !== user.id) {
      return NextResponse.json({ error: 'Only the grantee can decline a grant' }, { status: 403 });
    }

    if (grant.status !== 'pending_acceptance') {
      return NextResponse.json({ error: `Cannot decline grant with status: ${grant.status}` }, { status: 400 });
    }

    // Decline the grant (set status to declined_by_grantee)
    const { data: updatedGrant, error: updateError } = await supabase
      .from('consent_grants')
      .update({
        status: 'declined_by_grantee',
        revoked_at: new Date().toISOString()
      })
      .eq('id', grantId)
      .select()
      .single();

    if (updateError) {
      console.error('Error declining grant:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log the decline
    await supabase.from('consent_audit_log').insert({
      grant_id: grantId,
      actor_id: user.id,
      action: 'grant_declined'
    });

    return NextResponse.json({ grant: updatedGrant });
  } catch (error: any) {
    console.error('Error in POST /api/consent/[id]/decline:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

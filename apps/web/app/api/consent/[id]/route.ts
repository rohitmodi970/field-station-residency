import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: grantId } = await params;

    // Verify the grant belongs to the current user (as grantor)
    const { data: grant, error: fetchError } = await supabase
      .from('consent_grants')
      .select('id, grantor_id, status')
      .eq('id', grantId)
      .single();

    if (fetchError || !grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    if (grant.grantor_id !== user.id) {
      return NextResponse.json({ error: 'Only the grantor can revoke a grant' }, { status: 403 });
    }

    // Revoke the grant (set status to revoked)
    const { error: revokeError } = await supabase
      .from('consent_grants')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_reason: 'user_revoked'
      })
      .eq('id', grantId);

    if (revokeError) {
      console.error('Error revoking grant:', revokeError);
      return NextResponse.json({ error: revokeError.message }, { status: 500 });
    }

    // Log the revocation
    await supabase.from('consent_audit_log').insert({
      grant_id: grantId,
      actor_id: user.id,
      action: 'grant_revoked',
      metadata: { reason: 'user_revoked' }
    });

    // Note: The snapshot is NOT deleted immediately here. It will be garbage collected 
    // by the `consent-cleanup` cron job after 90 days. But it becomes instantly inaccessible 
    // to the grantee because of the `grantee_snapshot_read` RLS policy which checks for an active status.

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/consent/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

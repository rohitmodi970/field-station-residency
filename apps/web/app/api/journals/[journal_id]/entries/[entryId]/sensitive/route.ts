import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { clearVektoriMemory } from '@/utils/vektori/client';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ journal_id: string; entryId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { journal_id: journalId, entryId } = await params;

    // Verify ownership of the journal/entry
    const { data: journal, error: journalError } = await supabase
      .from('journals')
      .select('user_id')
      .eq('journal_id', journalId)
      .single();

    if (journalError || !journal || journal.user_id !== user.id) {
      return NextResponse.json({ error: 'Journal not found or access denied' }, { status: 403 });
    }

    // Insert sensitivity tag (upsert to handle if it already exists)
    const { error: tagError } = await supabase
      .from('journal_sensitivity_tags')
      .upsert({
        journal_id: journalId,
        entry_id: entryId,
        user_id: user.id
      }, { onConflict: 'journal_id,entry_id,block_id' }); // Note: COALESCE block_id might need special handling if we introduce blocks, but this works for full entry.

    if (tagError) {
      console.error('Error tagging entry as sensitive:', tagError);
      return NextResponse.json({ error: tagError.message }, { status: 500 });
    }

    // Auto-revoke any existing active/pending grants for this entry (Edge Case E1)
    const { data: activeGrants, error: fetchGrantsError } = await supabase
      .from('consent_grants')
      .select('id')
      .eq('entry_id', entryId)
      .in('status', ['active', 'pending_acceptance']);

    if (fetchGrantsError) {
      console.error('Error fetching grants to revoke:', fetchGrantsError);
      // Don't fail the request, but it's an issue
    } else if (activeGrants && activeGrants.length > 0) {
      const grantIds = activeGrants.map(g => g.id);

      // Revoke the grants
      await supabase
        .from('consent_grants')
        .update({
          status: 'revoked',
          revoked_at: new Date().toISOString(),
          revoked_reason: 'sensitivity_tagged'
        })
        .in('id', grantIds);

      // Log the revocation actions
      const auditLogs = grantIds.map(grantId => ({
        grant_id: grantId,
        actor_id: user.id,
        action: 'snapshot_retroactively_revoked',
        metadata: { reason: 'sensitivity_tagged' }
      }));
      
      await supabase.from('consent_audit_log').insert(auditLogs);
    }

    // Log the tagging action itself
    await supabase.from('consent_audit_log').insert({
      actor_id: user.id,
      action: 'sensitivity_tagged',
      metadata: { journal_id: journalId, entry_id: entryId }
    });

    // Retroactively purge this journal from Vektori semantic memory
    clearVektoriMemory({
      userId: user.id,
      sessionId: `journal-${journalId}`,
    }).catch((err) => console.error('[Vektori] Failed to retroactively purge sensitive memory:', err));

    return NextResponse.json({ success: true, message: 'Entry tagged sensitive and grants revoked' });
  } catch (error: any) {
    console.error('Error in POST /api/journals/.../sensitive:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ journal_id: string; entryId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { journal_id: journalId, entryId } = await params;

    // Verify ownership
    const { data: tag, error: tagError } = await supabase
      .from('journal_sensitivity_tags')
      .select('id, user_id')
      .eq('journal_id', journalId)
      .eq('entry_id', entryId)
      .is('block_id', null)
      .single();

    if (tagError && tagError.code !== 'PGRST116') {
      return NextResponse.json({ error: tagError.message }, { status: 500 });
    }
    
    if (!tag) {
      return NextResponse.json({ success: true, message: 'No sensitivity tag found' });
    }

    if (tag.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Remove the tag
    const { error: deleteError } = await supabase
      .from('journal_sensitivity_tags')
      .delete()
      .eq('id', tag.id);

    if (deleteError) {
      console.error('Error removing sensitivity tag:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Log the action
    await supabase.from('consent_audit_log').insert({
      actor_id: user.id,
      action: 'sensitivity_removed',
      metadata: { journal_id: journalId, entry_id: entryId }
    });

    // Note: This does NOT automatically un-revoke grants. The user must explicitly re-share.

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/journals/.../sensitive:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

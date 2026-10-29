import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    let {
      grantee_id,
      connection_id,
      grant_type = 'entry_snapshot',
      journal_id,
      entry_id,
      grantee_wrapped_key,
      requires_acceptance = false,
      expires_at = null,
      is_sensitive = false,
      title_encrypted,
      title_iv,
      content_encrypted,
      content_iv,
      title = 'Shared Reflection',
      content = ''
    } = body;

    // For Phase 4 we only support entry_snapshot initially
    if (grant_type !== 'entry_snapshot') {
      return NextResponse.json({ error: 'Unsupported grant_type for this phase' }, { status: 400 });
    }

    if (!grantee_id || !connection_id || !journal_id || !entry_id) {
      return NextResponse.json({ error: 'Missing required fields for entry_snapshot grant' }, { status: 400 });
    }

    // Resolve canonical journal_id from public.journals table
    // (public.journals has row UUID 'id' and custom string 'journal_id'; consent_grants references 'journal_id')
    const admin = createAdminClient();
    let canonicalJournalId = journal_id;
    let canonicalEntryId = entry_id;

    // Check by id or journal_id
    const { data: journalRow } = await admin
      .from('journals')
      .select('id, journal_id')
      .or(`id.eq.${journal_id},journal_id.eq.${journal_id}`)
      .maybeSingle();

    if (journalRow) {
      canonicalJournalId = journalRow.journal_id || journalRow.id;
      canonicalEntryId = journalRow.id || canonicalJournalId;
    }

    // Verify connection is active and accepted
    const { data: connection, error: connError } = await supabase
      .from('force_connections')
      .select('status, requester_allows_modeling, recipient_allows_modeling')
      .eq('id', connection_id)
      .maybeSingle();

    if (connError || !connection || connection.status !== 'accepted') {
      return NextResponse.json({ error: 'Invalid or unaccepted connection' }, { status: 403 });
    }

    // Check if the entry itself is marked sensitive globally
    const { data: sensitiveTag } = await supabase
      .from('journal_sensitivity_tags')
      .select('id')
      .or(`entry_id.eq.${journal_id},entry_id.eq.${canonicalJournalId}`)
      .maybeSingle();

    if (sensitiveTag) {
      return NextResponse.json({ error: 'Cannot share a sensitive entry' }, { status: 403 });
    }

    // Insert the grant
    const { data: newGrant, error: grantError } = await supabase
      .from('consent_grants')
      .insert({
        grantor_id: user.id,
        grantee_id,
        connection_id,
        grant_type,
        journal_id: canonicalJournalId,
        entry_id: canonicalEntryId,
        grantee_wrapped_key: grantee_wrapped_key || 'direct_share',
        requires_acceptance,
        is_sensitive,
        expires_at,
        status: requires_acceptance ? 'pending_acceptance' : 'active'
      })
      .select()
      .single();

    if (grantError) {
      console.error('Error creating consent grant:', grantError);
      return NextResponse.json({ error: grantError.message }, { status: 500 });
    }

    // Insert snapshot into shared_entry_snapshots
    try {
      await supabase.from('shared_entry_snapshots').insert({
        grant_id: newGrant.id,
        journal_id: String(canonicalJournalId),
        entry_id: String(canonicalEntryId),
        title_encrypted: title_encrypted || title || 'Shared Reflection',
        title_iv: title_iv || 'none',
        content_encrypted: content_encrypted || content || '',
        content_iv: content_iv || 'none',
        snapshot_at: new Date().toISOString()
      });
    } catch (snapErr) {
      console.warn('Could not insert shared_entry_snapshot:', snapErr);
    }

    // Log the action
    try {
      await supabase.from('consent_audit_log').insert({
        grant_id: newGrant.id,
        actor_id: user.id,
        action: 'grant_created',
        metadata: { grant_type, requires_acceptance }
      });
    } catch (auditErr) {
      console.warn('Audit log insert skipped:', auditErr);
    }

    // Auto-nudge: If both partners enabled modeling, trigger evaluation in background
    if (connection.requester_allows_modeling && connection.recipient_allows_modeling) {
      (async () => {
        try {
          const { buildMediationContextSnapshot, persistMediationIntervention } = await import('@/lib/agent/v2/mediationContextService');
          const { evaluateMediationDecision } = await import('@/lib/agent/v2/mediationEngine');
          
          const snapResult = await buildMediationContextSnapshot(supabase, connection_id, user.id);
          if (snapResult.permitted && snapResult.snapshot) {
            const decision = await evaluateMediationDecision({
              snapshot: snapResult.snapshot,
              triggerContext: { type: 'shared_snapshot_added', note: `Journal shared: ${title}` }
            });
            if (decision.should_persist && decision.action !== 'silence') {
              await persistMediationIntervention(supabase, connection_id, decision, user.id);
            }
          }
        } catch (nudgeErr) {
          console.warn('Auto-nudge evaluation background error:', nudgeErr);
        }
      })();
    }

    return NextResponse.json({ grant: newGrant });
  } catch (error: any) {
    console.error('Error in POST /api/consent/grant:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

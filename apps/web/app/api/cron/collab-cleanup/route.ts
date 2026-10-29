// apps/web/app/api/cron/collab-cleanup/route.ts
// GET /api/cron/collab-cleanup
// Daily cron job — expires old invitations + compacts Yjs ops per active journal.
// Protected by CRON_SECRET env variable.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(request: NextRequest) {
  // Validate cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createAdminClient();
  const results: Record<string, unknown> = {};

  // ── 1. Expire pending invitations ──────────────────────────────
  try {
    const { data: expiredResult } = await adminClient.rpc('expire_old_invitations');
    results.expired_invitations = expiredResult ?? 0;

    // Write audit entries for expired invitations
    const { data: expiredInvites } = await adminClient
      .from('journal_invitations')
      .select('id, journal_id, invited_by, invited_email')
      .eq('status', 'expired')
      .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (expiredInvites && expiredInvites.length > 0) {
      await adminClient.from('journal_audit_log').insert(
        expiredInvites.map((inv) => ({
          journal_id: inv.journal_id,
          actor_id: null,
          action: 'invite_expired',
          target_id: inv.invited_by,
          metadata: { invited_email: inv.invited_email },
        }))
      );
    }
  } catch (error) {
    console.error('[collab-cleanup] Invitation expiry error:', error);
    results.invitation_expiry_error = String(error);
  }

  // ── 2. Compact Yjs ops for active collaborative journals ────────
  try {
    // Find journals with > 100 incremental ops (compaction needed)
    const { data: journalsToCompact } = await adminClient
      .from('journal_collab_ops')
      .select('journal_id')
      .eq('is_snapshot', false)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(50);  // Process max 50 journals per run

    // Get unique journal IDs
    const uniqueJournalIds = [...new Set((journalsToCompact ?? []).map((j) => j.journal_id))];
    results.journals_to_compact = uniqueJournalIds.length;

    // For each journal, count ops and compact if needed
    let compacted = 0;
    for (const journalId of uniqueJournalIds) {
      const { count } = await adminClient
        .from('journal_collab_ops')
        .select('*', { count: 'exact', head: true })
        .eq('journal_id', journalId)
        .eq('is_snapshot', false);

      if ((count ?? 0) > 100) {
        // The actual Yjs compaction happens in the WS server (Phase 3).
        // In Phase 1, we just log that this journal needs compaction.
        // The compact_journal_ops RPC will be called by the WS server.
        console.log(`[collab-cleanup] Journal ${journalId} has ${count} ops — queued for compaction`);
        compacted++;
      }
    }

    results.journals_compacted = compacted;
  } catch (error) {
    console.error('[collab-cleanup] Yjs compaction error:', error);
    results.compaction_error = String(error);
  }

  // ── 3. Clean up cancelled invitations older than 30 days ───────
  try {
    const { count: deletedCount } = await adminClient
      .from('journal_invitations')
      .delete({ count: 'exact' })
      .in('status', ['declined', 'expired', 'cancelled'])
      .lte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    results.old_invitations_deleted = deletedCount ?? 0;
  } catch (error) {
    console.error('[collab-cleanup] Old invitation cleanup error:', error);
    results.cleanup_error = String(error);
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    ...results,
  });
}

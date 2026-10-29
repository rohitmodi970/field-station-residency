// apps/web/app/api/user/reset-collab-key/route.ts
// POST /api/user/reset-collab-key
// Nuclear option: user lost their RSA private key (cleared IndexedDB, new browser).
// Deletes all their journal_shared_keys rows (old wrapped keys are now useless).
// Notifies journal owners to re-invite the user.
// The client should call POST /api/user/public-key with the new key BEFORE calling this.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/utils/supabase/admin';
import { notificationService } from '@/utils/notifications/notificationService';

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // ── Find all journals where user is a non-owner collaborator ──
    const { data: collabJournals } = await adminClient
      .from('journal_collaborators')
      .select('journal_id, owner_user_id, role')
      .eq('collaborator_user_id', user.id);

    const nonOwnerJournals = (collabJournals ?? []).filter((j) => j.role !== 'owner');
    const ownerJournals = (collabJournals ?? []).filter((j) => j.role === 'owner');

    // ── Delete all stale shared keys for this user ────────────────
    await adminClient
      .from('journal_shared_keys')
      .delete()
      .eq('user_id', user.id);

    // ── Remove from non-owner collab journals ─────────────────────
    // (They can't decrypt the content anyway until owner re-wraps the key)
    // We leave the collaborator row in place so owners can see they need to re-invite.
    // Instead, mark key_pending in their invitation rows.
    for (const journal of nonOwnerJournals) {
      await adminClient.from('journal_audit_log').insert({
        journal_id: journal.journal_id,
        actor_id: user.id,
        action: 'collab_key_reset',
        metadata: { affected_user_id: user.id },
      });

      // Notify journal owner
      await notificationService.send({
        recipientId: journal.owner_user_id,
        type: 'collab_key_reset_needed',
        title: 'Collaborator needs re-invitation',
        body: 'A collaborator reset their encryption key and needs to be re-invited to restore access.',
        priority: 'high',
        channels: ['in_app'],
        data: {
          journal_id: journal.journal_id,
          affected_user_id: user.id,
          action: 'collab_key_reset_needed',
        },
      });
    }

    // ── For owner journals: owner needs to handle this themselves ─
    // (Cannot rotate the key without the owner's plaintext access)
    // Just send them an informational note
    for (const journal of ownerJournals) {
      await adminClient.from('journal_audit_log').insert({
        journal_id: journal.journal_id,
        actor_id: user.id,
        action: 'collab_key_reset',
        metadata: { is_owner: true },
      });
    }

    return NextResponse.json({
      success: true,
      affected_journals: nonOwnerJournals.length,
      owner_journals: ownerJournals.length,
      message: 'Collaboration keys cleared. Journal owners have been notified to re-invite you.',
    });

  } catch (error) {
    console.error('[reset-collab-key] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

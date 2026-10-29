// apps/web/app/api/collab/decline/[token]/route.ts
// POST /api/collab/decline/:token
// Unauthenticated — invitee declines a collaboration invitation.
// Only requires the raw token (hashed server-side).

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { notificationService } from '@/utils/notifications/notificationService';
import crypto from 'node:crypto';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    if (!token || typeof token !== 'string' || token.length < 10) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const adminClient = createAdminClient();

    // ── Fetch invitation ──────────────────────────────────────────
    const { data: invitation, error: inviteError } = await adminClient
      .from('journal_invitations')
      .select('id, status, journal_id, invited_by, invited_email')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation is already ${invitation.status}` },
        { status: 409 }
      );
    }

    // ── Update invitation status ──────────────────────────────────
    const { error: updateError } = await adminClient
      .from('journal_invitations')
      .update({ status: 'declined' })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('[decline] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to decline invitation' }, { status: 500 });
    }

    // ── Audit log ─────────────────────────────────────────────────
    await adminClient.from('journal_audit_log').insert({
      journal_id: invitation.journal_id,
      actor_id: null,  // May not be logged in
      action: 'invite_declined',
      target_id: invitation.invited_by,
      metadata: { invited_email: invitation.invited_email },
    });

    // ── Notify inviter ────────────────────────────────
    await notificationService.send({
      recipientId: invitation.invited_by,
      type: 'collab_invite_declined',
      title: 'Collaboration invitation declined',
      body: `${invitation.invited_email} declined your journal collaboration invitation`,
      priority: 'low',
      channels: ['in_app'],
      data: { journal_id: invitation.journal_id },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[decline] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

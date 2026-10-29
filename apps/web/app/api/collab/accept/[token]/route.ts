// apps/web/app/api/collab/accept/[token]/route.ts
// POST /api/collab/accept/:token
// Authenticated endpoint — invitee accepts a collaboration invitation.
// Validates token, email match, expiry, creates collaborator row, stores wrapped key.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/utils/supabase/admin';
import { notificationService } from '@/utils/notifications/notificationService';
import crypto from 'node:crypto';

interface AcceptBody {
  // RSA-wrapped journal AES key (base64), encrypted with the invitee's public key.
  // Required if the invitation had key_pending=true (invitee now has a public key).
  invitee_wrapped_key?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    // ── Auth — must be logged in ──────────────────────────────────
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'You must be logged in to accept an invitation' }, { status: 401 });
    }

    if (!token || typeof token !== 'string' || token.length < 10) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 400 });
    }

    // Hash the raw token to look up in DB
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const adminClient = createAdminClient();

    // ── Fetch invitation ──────────────────────────────────────────
    const { data: invitation, error: inviteError } = await adminClient
      .from('journal_invitations')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // ── Validate status ───────────────────────────────────────────
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation is ${invitation.status} and can no longer be accepted` },
        { status: 409 }
      );
    }

    // ── Check expiry ──────────────────────────────────────────────
    if (new Date(invitation.expires_at) < new Date()) {
      await adminClient
        .from('journal_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }

    // ── Verify invitee email matches ──────────────────────────────
    const userEmail = user.email?.toLowerCase();
    if (userEmail !== invitation.invited_email.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation was sent to a different email address' },
        { status: 403 }
      );
    }

    // ── Parse optional body (wrapped key if key was pending) ──────
    let body: AcceptBody = {};
    try {
      const text = await request.text();
      if (text) body = JSON.parse(text);
    } catch {
      // Body is optional
    }

    // Determine which wrapped key to store
    const wrappedKeyToStore = body.invitee_wrapped_key ?? invitation.invitee_wrapped_key;

    // ── Create collaborator row ────────────────────────────
    const { error: collabInsertError } = await adminClient
      .from('journal_collaborators')
      .upsert(
        {
          journal_id: invitation.journal_id,
          owner_user_id: invitation.invited_by,
          collaborator_user_id: user.id,
          role: invitation.role,
          invited_by: invitation.invited_by,
        },
        { onConflict: 'journal_id,collaborator_user_id', ignoreDuplicates: false }
      );

    if (collabInsertError) {
      console.error('[accept] Collaborator insert error:', collabInsertError);
      return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
    }

    // ── Store wrapped key (if available) ─────────────────────────
    if (wrappedKeyToStore) {
      await adminClient
        .from('journal_shared_keys')
        .upsert({
          journal_id: invitation.journal_id,
          user_id: user.id,
          encrypted_journal_key: wrappedKeyToStore,
          key_version: 1,
          granted_by: invitation.invited_by,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'journal_id,user_id' });
    }

    // ── Update invitation status ──────────────────────────────────
    await adminClient
      .from('journal_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        invited_user_id: user.id,
        key_pending: !wrappedKeyToStore,
      })
      .eq('id', invitation.id);

    // ── Audit log ─────────────────────────────────────────────────
    await adminClient.from('journal_audit_log').insert({
      journal_id: invitation.journal_id,
      actor_id: user.id,
      action: 'invite_accepted',
      target_id: invitation.invited_by,
      metadata: { role: invitation.role, key_stored: !!wrappedKeyToStore },
    });

    // ── Notify inviter ────────────────────────────────
    await notificationService.send({
      recipientId: invitation.invited_by,
      type: 'collab_invite_accepted',
      title: 'Collaboration invitation accepted',
      body: `${user.email} accepted your journal collaboration invitation`,
      priority: 'normal',
      channels: ['in_app'],
      data: {
        journal_id: invitation.journal_id,
        accepted_user_id: user.id,
      },
    });

    // ── Return: key_ready tells client whether key is available ──
    return NextResponse.json({
      success: true,
      journal_id: invitation.journal_id,
      role: invitation.role,
      key_ready: !!wrappedKeyToStore,
    });

  } catch (error) {
    console.error('[accept] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

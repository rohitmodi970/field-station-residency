// apps/web/app/api/journals/[journal_id]/invite/route.ts
// POST /api/journals/:journal_id/invite
// Creates a collaboration invitation.
// When is_conversion=true: atomically converts a solo journal to collaborative.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendCollaborationInviteEmail } from '@/utilities/mailService';
import { notificationService } from '@/utils/notifications/notificationService';
import crypto from 'node:crypto';

const MAX_COLLABORATORS = 10;
const INVITE_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const INVITE_RATE_LIMIT_MAX = 10;

interface InviteRequestBody {
  email: string;
  role: 'viewer' | 'editor';
  // Solo → collab conversion fields (all required when is_conversion=true)
  is_conversion?: boolean;
  new_content_encrypted?: string;
  new_content_iv?: string;
  owner_wrapped_key?: string;
  invitee_wrapped_key?: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ journal_id: string }> }
) {
  const { journal_id } = await params;

  try {
    // ── Auth ──────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // ── Parse & validate body ─────────────────────────────────────
    let body: InviteRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { email, role, is_conversion, new_content_encrypted, new_content_iv, owner_wrapped_key, invitee_wrapped_key } = body;

    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    if (!role || !['viewer', 'editor'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be "viewer" or "editor"' }, { status: 400 });
    }
    if (email.toLowerCase() === user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'Cannot invite yourself' }, { status: 400 });
    }

    // Validate conversion fields if this is a conversion request
    if (is_conversion) {
      if (!new_content_encrypted || !new_content_iv || !owner_wrapped_key) {
        return NextResponse.json(
          { error: 'Conversion requires: new_content_encrypted, new_content_iv, owner_wrapped_key' },
          { status: 400 }
        );
      }
    }

    // ── Rate limit (10 invites/hour per user) ────────────────────
    const windowStart = new Date(Date.now() - INVITE_RATE_LIMIT_WINDOW_MS).toISOString();
    const { count: recentInvites } = await adminClient
      .from('journal_invitations')
      .select('*', { count: 'exact', head: true })
      .eq('invited_by', user.id)
      .gte('created_at', windowStart);

    if ((recentInvites ?? 0) >= INVITE_RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 10 invitations per hour.' },
        { status: 429 }
      );
    }

    // ── Fetch journal — verify ownership ──────────────────────────
    const { data: journal, error: journalError } = await adminClient
      .from('journals')
      .select('journal_id, user_id, is_collaborative, collab_key_version')
      .eq('journal_id', journal_id)
      .single();

    if (journalError || !journal) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }
    if (journal.user_id !== user.id) {
      return NextResponse.json({ error: 'Only the journal owner can send invitations' }, { status: 403 });
    }

    // ── If already collaborative, verify not re-converting ────────
    if (journal.is_collaborative && is_conversion) {
      return NextResponse.json(
        { error: 'Journal is already collaborative. Use the invite endpoint without is_conversion.' },
        { status: 409 }
      );
    }

    // ── Check collaborator limit ──────────────────────────────────
    const { count: collabCount } = await adminClient
      .from('journal_collaborators')
      .select('*', { count: 'exact', head: true })
      .eq('journal_id', journal_id);

    if ((collabCount ?? 0) >= MAX_COLLABORATORS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_COLLABORATORS} collaborators per journal` },
        { status: 409 }
      );
    }

    // ── Check for existing active invite for this email ───────────
    const { data: existingInvite } = await adminClient
      .from('journal_invitations')
      .select('id, status')
      .eq('journal_id', journal_id)
      .eq('invited_email', email.toLowerCase())
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      return NextResponse.json(
        { error: 'A pending invitation already exists for this email address' },
        { status: 409 }
      );
    }

    // ── Check if this user is already a collaborator ──────────────
    const { data: inviteeUser } = await adminClient
      .from('auth.users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (inviteeUser) {
      const { data: existingCollab } = await adminClient
        .from('journal_collaborators')
        .select('id')
        .eq('journal_id', journal_id)
        .eq('collaborator_user_id', inviteeUser.id)
        .maybeSingle();

      if (existingCollab) {
        return NextResponse.json(
          { error: 'This user is already a collaborator' },
          { status: 409 }
        );
      }
    }

    // ── Generate secure invite token ──────────────────────────────
    const rawToken = crypto.randomBytes(32).toString('hex'); // 256-bit token
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // ── Determine if invitee has an RSA public key ────────────────
    const keyPending = !invitee_wrapped_key;

    // ── Execute — single transaction for conversion or plain invite ──
    if (is_conversion) {
      // Atomic solo→collab conversion:
      // 1. Update journal content + set is_collaborative=true
      // 2. Insert owner's shared key
      // 3. Insert invitation (+ invitee key if available)
      // 4. Insert owner collaborator row (role=owner)
      // 5. Write audit log

      const { error: updateError } = await adminClient
        .from('journals')
        .update({
          content_encrypted: new_content_encrypted,
          content_iv: new_content_iv,
          is_collaborative: true,
          collaboration_enabled_at: new Date().toISOString(),
          collab_key_version: 1,
        })
        .eq('journal_id', journal_id)
        .eq('user_id', user.id);  // Extra safety check

      if (updateError) {
        console.error('[invite/conversion] Journal update failed:', updateError);
        return NextResponse.json({ error: 'Failed to convert journal to collaborative mode' }, { status: 500 });
      }

      // Insert owner's wrapped key
      const { error: ownerKeyError } = await adminClient
        .from('journal_shared_keys')
        .insert({
          journal_id,
          user_id: user.id,
          encrypted_journal_key: owner_wrapped_key,
          key_version: 1,
          granted_by: user.id,
        });

      if (ownerKeyError) {
        // Rollback: revert the journal update
        await adminClient
          .from('journals')
          .update({ is_collaborative: false, collaboration_enabled_at: null })
          .eq('journal_id', journal_id);

        console.error('[invite/conversion] Owner key insert failed:', ownerKeyError);
        return NextResponse.json({ error: 'Failed to store owner key — conversion rolled back' }, { status: 500 });
      }

      // Insert owner as collaborator with role=owner
      await adminClient
        .from('journal_collaborators')
        .upsert(
          {
            journal_id,
            owner_user_id: user.id,
            collaborator_user_id: user.id,
            role: 'owner',
            invited_by: user.id,
          },
          { onConflict: 'journal_id,collaborator_user_id' }
        );

      // Write audit log entry
      await adminClient.from('journal_audit_log').insert({
        journal_id,
        actor_id: user.id,
        action: 'collab_enabled',
        metadata: { triggered_by: 'first_invite', invitee_email: email.toLowerCase() },
      });
    }

    // ── Insert the invitation ─────────────────────────────────────
    const { data: invitation, error: inviteError } = await adminClient
      .from('journal_invitations')
      .insert({
        journal_id,
        invited_by: user.id,
        invited_email: email.toLowerCase(),
        invited_user_id: inviteeUser?.id ?? null,
        role,
        token_hash: tokenHash,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        key_pending: keyPending,
        invitee_wrapped_key: invitee_wrapped_key ?? null,
      })
      .select('id')
      .single();

    if (inviteError || !invitation) {
      console.error('[invite] Invitation insert failed:', inviteError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // ── Audit log: invite_sent ────────────────────────────────────
    await adminClient.from('journal_audit_log').insert({
      journal_id,
      actor_id: user.id,
      action: 'invite_sent',
      target_id: inviteeUser?.id ?? null,
      metadata: { role, invited_email: email.toLowerCase(), key_pending: keyPending },
    });

    // ── Send invitation email ─────────────────────────────────────
    // Fetch inviter's display name for the email
    const { data: inviterProfile } = await adminClient
      .from('user_settings')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const inviterName = inviterProfile?.display_name ?? user.email ?? 'Someone';
    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/collab/accept/${rawToken}`;
    const declineUrl = `${process.env.NEXT_PUBLIC_APP_URL}/collab/decline/${rawToken}`;

    await sendCollaborationInviteEmail({
      to: email,
      inviterName,
      role,
      acceptUrl,
      declineUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // ── In-app notification (if invitee has an account) ───────────
    if (inviteeUser) {
      await notificationService.send({
        recipientId: inviteeUser.id,
        type: 'collab_invite_received',
        title: 'Journal collaboration invite',
        body: `${inviterName} invited you to collaborate on a journal as ${role}`,
        priority: 'normal',
        channels: ['in_app'],
        data: {
          journal_id,
          link: acceptUrl,
          invitation_id: invitation.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      invitation_id: invitation.id,
      key_pending: keyPending,
      message: is_conversion
        ? 'Journal converted to collaborative mode and invitation sent'
        : 'Invitation sent successfully',
    });

  } catch (error) {
    console.error('[invite] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

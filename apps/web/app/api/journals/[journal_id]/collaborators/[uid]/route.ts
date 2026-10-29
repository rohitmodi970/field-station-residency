// apps/web/app/api/journals/[journal_id]/collaborators/[uid]/route.ts
// PUT  /api/journals/:journal_id/collaborators/:uid — change role
// DELETE /api/journals/:journal_id/collaborators/:uid — remove collaborator (with key rotation)

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/utils/supabase/admin';
import { notificationService } from '@/utils/notifications/notificationService';
import { createHmac, timingSafeEqual } from 'node:crypto';

interface RoleChangeBody {
  new_role: 'viewer' | 'editor';
}

interface RemoveCollaboratorBody {
  // After key rotation on the client, owner submits:
  new_content_encrypted: string;
  new_content_iv: string;
  // Array of { user_id, encrypted_journal_key } for all REMAINING collaborators
  remaining_wrapped_keys: Array<{ user_id: string; encrypted_journal_key: string }>;
}

// ── Helper: signal WS server to kick / notify role change ────────────────
async function signalWsServer(
  path: '/admin/kick' | '/admin/role-change' | '/admin/ownership-changed',
  body: Record<string, unknown>
): Promise<void> {
  const wsAdminUrl = process.env.COLLAB_WS_INTERNAL_URL;
  const wsSecret = process.env.COLLAB_WS_INTERNAL_SECRET;
  if (!wsAdminUrl || !wsSecret) return; // WS server not yet deployed (Phase 1)

  const bodyStr = JSON.stringify(body);
  const method = 'POST';
  const timestamp = Date.now().toString();
  const sig = createHmac('sha256', wsSecret)
    .update(`${method}:${path}:${bodyStr}:${timestamp}`)
    .digest('hex');

  try {
    await fetch(`${wsAdminUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Timestamp': timestamp,
        'X-Internal-Sig': sig,
      },
      body: bodyStr,
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // WS server not running yet — silently ignore during Phase 1
  }
}

// ── PUT — Change role ─────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ journal_id: string; uid: string }> }
) {
  const { journal_id, uid } = await params;

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

    let body: RoleChangeBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { new_role } = body;
    if (!new_role || !['viewer', 'editor'].includes(new_role)) {
      return NextResponse.json({ error: 'Invalid role. Must be "viewer" or "editor"' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verify ownership
    const { data: journal } = await adminClient
      .from('journals')
      .select('user_id')
      .eq('journal_id', journal_id)
      .single();

    if (!journal || journal.user_id !== user.id) {
      return NextResponse.json({ error: 'Only the journal owner can change roles' }, { status: 403 });
    }

    // Cannot change owner's own role via this endpoint
    if (uid === user.id) {
      return NextResponse.json({ error: 'Cannot change the owner\'s role' }, { status: 400 });
    }

    // Fetch current role
    const { data: collab } = await adminClient
      .from('journal_collaborators')
      .select('role')
      .eq('journal_id', journal_id)
      .eq('collaborator_user_id', uid)
      .single();

    if (!collab) {
      return NextResponse.json({ error: 'Collaborator not found' }, { status: 404 });
    }

    const old_role = collab.role;

    // Update role
    const { error: updateError } = await adminClient
      .from('journal_collaborators')
      .update({ role: new_role, updated_at: new Date().toISOString() })
      .eq('journal_id', journal_id)
      .eq('collaborator_user_id', uid);

    if (updateError) {
      console.error('[collaborators/uid/PUT] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }

    // Write audit log
    await adminClient.from('journal_audit_log').insert({
      journal_id,
      actor_id: user.id,
      action: 'role_changed',
      target_id: uid,
      metadata: { old_role, new_role },
    });

    // Signal WS server (Phase 3: will kick viewer from editing in real-time)
    await signalWsServer('/admin/role-change', { journal_id, user_id: uid, new_role });

    // In-app notification to collaborator
    await notificationService.send({
      recipientId: uid,
      type: 'collab_role_changed',
      title: 'Your journal role was updated',
      body: `Your role in a shared journal changed from ${old_role} to ${new_role}`,
      priority: 'normal',
      channels: ['in_app'],
      data: { journal_id },
    });

    return NextResponse.json({ success: true, new_role });

  } catch (error) {
    console.error('[collaborators/uid/PUT] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE — Remove collaborator (with key rotation) ──────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ journal_id: string; uid: string }> }
) {
  const { journal_id, uid } = await params;

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

    // Allow self-removal (leave) or owner removal
    const adminClient = createAdminClient();

    const { data: journal } = await adminClient
      .from('journals')
      .select('user_id')
      .eq('journal_id', journal_id)
      .single();

    if (!journal) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }

    const isOwner = journal.user_id === user.id;
    const isSelf = uid === user.id;

    if (!isOwner && !isSelf) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Owner cannot remove themselves (use transfer-ownership first)
    if (isOwner && isSelf) {
      return NextResponse.json(
        { error: 'Owner cannot remove themselves. Transfer ownership first.' },
        { status: 400 }
      );
    }

    // For owner-initiated removal, key rotation data is required
    let body: Partial<RemoveCollaboratorBody> = {};
    try {
      const text = await request.text();
      if (text) body = JSON.parse(text);
    } catch {
      // Self-removal (leave) doesn't require body
    }

    // If owner is removing someone else, they must provide new key rotation data
    if (isOwner && !isSelf) {
      if (!body.new_content_encrypted || !body.new_content_iv || !body.remaining_wrapped_keys) {
        return NextResponse.json(
          {
            error: 'Key rotation data required: new_content_encrypted, new_content_iv, remaining_wrapped_keys',
          },
          { status: 400 }
        );
      }
    }

    // ── Execute removal ───────────────────────────────────────────
    // 1. Remove collaborator row
    const { error: deleteError } = await adminClient
      .from('journal_collaborators')
      .delete()
      .eq('journal_id', journal_id)
      .eq('collaborator_user_id', uid);

    if (deleteError) {
      console.error('[collaborators/uid/DELETE] Delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to remove collaborator' }, { status: 500 });
    }

    // 2. Delete their shared key row
    await adminClient
      .from('journal_shared_keys')
      .delete()
      .eq('journal_id', journal_id)
      .eq('user_id', uid);

    // 3. If owner is removing, rotate key
    if (isOwner && body.new_content_encrypted && body.new_content_iv && body.remaining_wrapped_keys) {
      // Update journal content with re-encrypted data
      const { data: currentJournal } = await adminClient
        .from('journals')
        .select('collab_key_version')
        .eq('journal_id', journal_id)
        .single();

      await adminClient
        .from('journals')
        .update({
          content_encrypted: body.new_content_encrypted,
          content_iv: body.new_content_iv,
          collab_key_version: (currentJournal?.collab_key_version ?? 1) + 1,
        })
        .eq('journal_id', journal_id);

      // Upsert wrapped keys for remaining collaborators
      if (body.remaining_wrapped_keys.length > 0) {
        await adminClient
          .from('journal_shared_keys')
          .upsert(
            body.remaining_wrapped_keys.map((k) => ({
              journal_id,
              user_id: k.user_id,
              encrypted_journal_key: k.encrypted_journal_key,
              key_version: (currentJournal?.collab_key_version ?? 1) + 1,
              granted_by: user.id,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: 'journal_id,user_id' }
          );
      }

      // Audit: key_rotated
      await adminClient.from('journal_audit_log').insert({
        journal_id,
        actor_id: user.id,
        action: 'key_rotated',
        target_id: uid,
        metadata: { reason: 'collaborator_removed' },
      });
    }

    // 4. Audit log: collaborator_removed or collaborator_left
    await adminClient.from('journal_audit_log').insert({
      journal_id,
      actor_id: user.id,
      action: isSelf ? 'collaborator_left' : 'collaborator_removed',
      target_id: uid,
    });

    // 5. Signal WS server to force disconnect (Phase 3)
    await signalWsServer('/admin/kick', { journal_id, user_id: uid, reason: 'access_revoked' });

    // 6. In-app notification
    if (!isSelf) {
      await notificationService.send({
        recipientId: uid,
        type: 'collab_removed',
        title: 'Journal access revoked',
        body: 'Your access to a shared journal has been removed',
        priority: 'high',
        channels: ['in_app'],
        data: { journal_id },
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[collaborators/uid/DELETE] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// apps/web/app/api/journals/[journal_id]/transfer-ownership/route.ts
// POST /api/journals/:journal_id/transfer-ownership
// Transfers journal ownership from current owner to an existing editor collaborator.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/utils/supabase/admin';
import { notificationService } from '@/utils/notifications/notificationService';
import { createHmac } from 'node:crypto';

interface TransferOwnershipBody {
  new_owner_id: string;
}

async function signalWsServer(body: Record<string, unknown>): Promise<void> {
  const wsAdminUrl = process.env.COLLAB_WS_INTERNAL_URL;
  const wsSecret = process.env.COLLAB_WS_INTERNAL_SECRET;
  if (!wsAdminUrl || !wsSecret) return;

  const path = '/admin/ownership-changed';
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
    // Phase 3: WS server not running yet — silently ignore
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ journal_id: string }> }
) {
  const { journal_id } = await params;

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

    let body: TransferOwnershipBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { new_owner_id } = body;
    if (!new_owner_id) {
      return NextResponse.json({ error: 'new_owner_id is required' }, { status: 400 });
    }
    if (new_owner_id === user.id) {
      return NextResponse.json({ error: 'You are already the owner' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Verify current ownership
    const { data: journal } = await adminClient
      .from('journals')
      .select('user_id, is_collaborative')
      .eq('journal_id', journal_id)
      .single();

    if (!journal) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }
    if (journal.user_id !== user.id) {
      return NextResponse.json({ error: 'Only the current owner can transfer ownership' }, { status: 403 });
    }
    if (!journal.is_collaborative) {
      return NextResponse.json({ error: 'Only collaborative journals support ownership transfer' }, { status: 400 });
    }

    // Verify new owner is a current editor collaborator
    const { data: newOwnerCollab } = await adminClient
      .from('journal_collaborators')
      .select('role')
      .eq('journal_id', journal_id)
      .eq('collaborator_user_id', new_owner_id)
      .single();

    if (!newOwnerCollab) {
      return NextResponse.json({ error: 'New owner must be an existing collaborator' }, { status: 400 });
    }
    if (newOwnerCollab.role === 'viewer') {
      return NextResponse.json({ error: 'Viewers cannot receive ownership. Promote to editor first.' }, { status: 400 });
    }

    // ── Execute transfer ──────────────────────────────────────────
    // 1. Update journal.user_id
    const { error: journalUpdateError } = await adminClient
      .from('journals')
      .update({ user_id: new_owner_id })
      .eq('journal_id', journal_id);

    if (journalUpdateError) {
      console.error('[transfer-ownership] Journal update error:', journalUpdateError);
      return NextResponse.json({ error: 'Failed to transfer ownership' }, { status: 500 });
    }

    // 2. Update journal_collaborators: new owner → role='owner', old owner → role='editor'
    await adminClient
      .from('journal_collaborators')
      .update({ role: 'owner', owner_user_id: new_owner_id, updated_at: new Date().toISOString() })
      .eq('journal_id', journal_id)
      .eq('collaborator_user_id', new_owner_id);

    await adminClient
      .from('journal_collaborators')
      .update({ role: 'editor', owner_user_id: new_owner_id, updated_at: new Date().toISOString() })
      .eq('journal_id', journal_id)
      .eq('collaborator_user_id', user.id);

    // Update owner_user_id for all other collaborators
    await adminClient
      .from('journal_collaborators')
      .update({ owner_user_id: new_owner_id, updated_at: new Date().toISOString() })
      .eq('journal_id', journal_id)
      .neq('collaborator_user_id', new_owner_id)
      .neq('collaborator_user_id', user.id);

    // 3. Audit log
    await adminClient.from('journal_audit_log').insert({
      journal_id,
      actor_id: user.id,
      action: 'ownership_transferred',
      target_id: new_owner_id,
    });

    // 4. Signal WS server
    await signalWsServer({ journal_id, old_owner_id: user.id, new_owner_id });

    // 5. Notify new owner
    await notificationService.send({
      recipientId: new_owner_id,
      type: 'collab_ownership_transferred',
      title: 'You are now a journal owner',
      body: 'Journal ownership was transferred to you',
      priority: 'high',
      channels: ['in_app'],
      data: { journal_id },
    });

    return NextResponse.json({ success: true, new_owner_id });

  } catch (error) {
    console.error('[transfer-ownership] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

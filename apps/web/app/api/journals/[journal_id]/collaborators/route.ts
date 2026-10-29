// apps/web/app/api/journals/[journal_id]/collaborators/route.ts
// GET /api/journals/:journal_id/collaborators
// Returns: list of active collaborators + pending invitations.
// Access: journal owner only.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(
  _request: NextRequest,
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

    // ── Verify ownership ──────────────────────────────────────────
    const { data: journal } = await adminClient
      .from('journals')
      .select('journal_id, user_id, is_collaborative')
      .eq('journal_id', journal_id)
      .single();

    if (!journal) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }

    // Only owner or active collaborators can view the collaborators list
    const isOwner = journal.user_id === user.id;

    if (!isOwner) {
      // Check if user is a collaborator
      const { data: collabRow } = await adminClient
        .from('journal_collaborators')
        .select('role')
        .eq('journal_id', journal_id)
        .eq('collaborator_user_id', user.id)
        .maybeSingle();

      if (!collabRow) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // ── Fetch collaborators ───────────────────────────────────────
    const { data: collaborators, error: collabError } = await adminClient
      .from('journal_collaborators')
      .select(`
        id,
        collaborator_user_id,
        role,
        invited_by,
        joined_at,
        updated_at
      `)
      .eq('journal_id', journal_id)
      .order('joined_at', { ascending: true });

    if (collabError) {
      console.error('[collaborators/GET] Fetch error:', collabError);
      return NextResponse.json({ error: 'Failed to fetch collaborators' }, { status: 500 });
    }

    // ── Enrich collaborators with profile info ────────────────────
    const userIds = (collaborators ?? [])
      .map((c) => c.collaborator_user_id)
      .filter(Boolean);

    let profileMap: Record<string, { display_name?: string; avatar_url?: string; email?: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await adminClient
        .from('user_settings')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      // Fetch emails from auth.users via admin API
      for (const uid of userIds) {
        const { data: authUser } = await adminClient.auth.admin.getUserById(uid);
        profileMap[uid] = {
          display_name: profiles?.find((p) => p.user_id === uid)?.display_name,
          avatar_url: profiles?.find((p) => p.user_id === uid)?.avatar_url,
          email: authUser?.user?.email,
        };
      }
    }

    const enrichedCollaborators = (collaborators ?? []).map((c) => ({
      ...c,
      display_name: profileMap[c.collaborator_user_id]?.display_name ?? null,
      avatar_url: profileMap[c.collaborator_user_id]?.avatar_url ?? null,
      email: profileMap[c.collaborator_user_id]?.email ?? null,
    }));

    // ── Fetch pending invitations (owner only) ────────────────────
    let pendingInvitations: unknown[] = [];
    if (isOwner) {
      const { data: invitations } = await adminClient
        .from('journal_invitations')
        .select('id, invited_email, role, status, created_at, expires_at, key_pending')
        .eq('journal_id', journal_id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      pendingInvitations = invitations ?? [];
    }

    return NextResponse.json({
      collaborators: enrichedCollaborators,
      pendingInvitations,
      isCollaborative: journal.is_collaborative,
    });

  } catch (error) {
    console.error('[collaborators/GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

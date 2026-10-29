// apps/web/app/api/journals/[journal_id]/rotate-key/route.ts
// POST /api/journals/:journal_id/rotate-key
// Owner submits new ciphertext + all remaining wrapped keys after a key rotation event.
// This is called by the client after a collaborator is removed and their key re-derived.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/utils/supabase/admin';

interface RotateKeyBody {
  new_content_encrypted: string;
  new_content_iv: string;
  // Wrapped keys for ALL remaining collaborators (including owner)
  wrapped_keys: Array<{
    user_id: string;
    encrypted_journal_key: string;
  }>;
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

    let body: RotateKeyBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { new_content_encrypted, new_content_iv, wrapped_keys } = body;

    if (!new_content_encrypted || !new_content_iv) {
      return NextResponse.json({ error: 'Missing new_content_encrypted or new_content_iv' }, { status: 400 });
    }
    if (!Array.isArray(wrapped_keys) || wrapped_keys.length === 0) {
      return NextResponse.json({ error: 'wrapped_keys must be a non-empty array' }, { status: 400 });
    }

    // Validate each wrapped key entry
    for (const entry of wrapped_keys) {
      if (!entry.user_id || !entry.encrypted_journal_key) {
        return NextResponse.json({ error: 'Each wrapped_key must have user_id and encrypted_journal_key' }, { status: 400 });
      }
    }

    const adminClient = createAdminClient();

    // Verify ownership
    const { data: journal } = await adminClient
      .from('journals')
      .select('user_id, is_collaborative, collab_key_version')
      .eq('journal_id', journal_id)
      .single();

    if (!journal) {
      return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
    }
    if (journal.user_id !== user.id) {
      return NextResponse.json({ error: 'Only the journal owner can rotate the journal key' }, { status: 403 });
    }
    if (!journal.is_collaborative) {
      return NextResponse.json({ error: 'Journal is not in collaborative mode' }, { status: 400 });
    }

    // Verify all user_ids are legitimate collaborators
    const { data: currentCollabs } = await adminClient
      .from('journal_collaborators')
      .select('collaborator_user_id')
      .eq('journal_id', journal_id);

    const collabIds = new Set((currentCollabs ?? []).map((c) => c.collaborator_user_id));
    for (const entry of wrapped_keys) {
      if (!collabIds.has(entry.user_id)) {
        return NextResponse.json(
          { error: `user_id ${entry.user_id} is not a collaborator on this journal` },
          { status: 400 }
        );
      }
    }

    const newKeyVersion = (journal.collab_key_version ?? 1) + 1;

    // Update journal content + increment key version
    const { error: journalUpdateError } = await adminClient
      .from('journals')
      .update({
        content_encrypted: new_content_encrypted,
        content_iv: new_content_iv,
        collab_key_version: newKeyVersion,
      })
      .eq('journal_id', journal_id);

    if (journalUpdateError) {
      console.error('[rotate-key] Journal update error:', journalUpdateError);
      return NextResponse.json({ error: 'Failed to update journal content' }, { status: 500 });
    }

    // Upsert all wrapped keys
    const { error: keysUpsertError } = await adminClient
      .from('journal_shared_keys')
      .upsert(
        wrapped_keys.map((k) => ({
          journal_id,
          user_id: k.user_id,
          encrypted_journal_key: k.encrypted_journal_key,
          key_version: newKeyVersion,
          granted_by: user.id,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'journal_id,user_id' }
      );

    if (keysUpsertError) {
      console.error('[rotate-key] Keys upsert error:', keysUpsertError);
      return NextResponse.json({ error: 'Failed to update wrapped keys' }, { status: 500 });
    }

    // Audit log
    await adminClient.from('journal_audit_log').insert({
      journal_id,
      actor_id: user.id,
      action: 'key_rotated',
      metadata: {
        new_key_version: newKeyVersion,
        remaining_collaborators: wrapped_keys.length,
      },
    });

    return NextResponse.json({
      success: true,
      new_key_version: newKeyVersion,
    });

  } catch (error) {
    console.error('[rotate-key] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

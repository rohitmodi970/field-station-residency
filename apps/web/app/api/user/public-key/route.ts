// apps/web/app/api/user/public-key/route.ts
// GET  /api/user/public-key?userId=<id>  OR  ?email=<email>
//   Returns the RSA public key + key_version for a user (by userId or email).
//   Used by the inviter to wrap the journal AES key for the invitee.
//
// POST /api/user/public-key
//   Uploads or replaces the authenticated user's RSA public key.
//   On version change, notifies affected journal owners whose wrapped keys may be stale.

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/utils/supabase/admin';
import { notificationService } from '@/utils/notifications/notificationService';

// ── GET — Fetch RSA public key for a user ─────────────────────────────────
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');

    if (!userId && !email) {
      return NextResponse.json({ error: 'Provide userId or email query parameter' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    let targetUserId: string | null = userId;

    // If email provided, look up userId
    if (email && !userId) {
      const { data: authUser } = await adminClient.auth.admin.listUsers();
      const found = authUser?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!found) {
        // User doesn't have an account yet — return null (invitation will set key_pending=true)
        return NextResponse.json({ collaboration_public_key: null, key_version: null });
      }
      targetUserId = found.id;
    }

    if (!targetUserId) {
      return NextResponse.json({ collaboration_public_key: null, key_version: null });
    }

    const { data: settings } = await adminClient
      .from('user_settings')
      .select('collaboration_public_key, collaboration_key_version, collaboration_key_created_at')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (!settings?.collaboration_public_key) {
      return NextResponse.json({ collaboration_public_key: null, key_version: null });
    }

    return NextResponse.json({
      user_id: targetUserId,
      collaboration_public_key: settings.collaboration_public_key,
      key_version: settings.collaboration_key_version,
      key_created_at: settings.collaboration_key_created_at,
    });

  } catch (error) {
    console.error('[public-key/GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST — Upload / replace RSA public key ───────────────────────────────
interface PublicKeyBody {
  public_key: string;    // Base64 SPKI-encoded RSA-4096 public key
}

export async function POST(request: NextRequest) {
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

    let body: PublicKeyBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { public_key } = body;
    if (!public_key || typeof public_key !== 'string' || public_key.length < 100) {
      return NextResponse.json({ error: 'Invalid public_key' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Fetch current key version
    const { data: currentSettings } = await adminClient
      .from('user_settings')
      .select('collaboration_public_key, collaboration_key_version')
      .eq('user_id', user.id)
      .maybeSingle();

    const oldKeyVersion = currentSettings?.collaboration_key_version ?? 0;
    const newKeyVersion = oldKeyVersion + 1;
    const isFirstKey = !currentSettings?.collaboration_public_key;

    // Update (or insert) the public key
    const { error: updateError } = await adminClient
      .from('user_settings')
      .upsert({
        user_id: user.id,
        collaboration_public_key: public_key,
        collaboration_key_version: newKeyVersion,
        collaboration_key_created_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (updateError) {
      console.error('[public-key/POST] Upsert error:', updateError);
      return NextResponse.json({ error: 'Failed to store public key' }, { status: 500 });
    }

    // If this is a key rotation (not first upload), notify affected journal owners
    if (!isFirstKey) {
      // Find journals where this user is a non-owner collaborator
      const { data: collabJournals } = await adminClient
        .from('journal_collaborators')
        .select('journal_id, owner_user_id')
        .eq('collaborator_user_id', user.id)
        .neq('role', 'owner');

      if (collabJournals && collabJournals.length > 0) {
        const ownerIds = [...new Set(collabJournals.map((j) => j.owner_user_id))];

        // Notify each unique owner
        await Promise.all(
          ownerIds.map((ownerId) =>
            notificationService.send({
              recipientId: ownerId,
              type: 'collab_key_reset_needed',
              title: 'Collaborator key changed',
              body: 'A collaborator reset their encryption key. Re-invite them to restore access.',
              priority: 'high',
              channels: ['in_app'],
              data: {
                affected_user_id: user.id,
                action: 'collab_key_reset_needed',
              },
            })
          )
        );
      }
    }

    return NextResponse.json({
      success: true,
      key_version: newKeyVersion,
      is_first_key: isFirstKey,
    });

  } catch (error) {
    console.error('[public-key/POST] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

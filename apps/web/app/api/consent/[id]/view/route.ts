import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: grantId } = await params;

    // Fetch the grant - user must be either grantor or grantee
    const { data: grant, error: grantError } = await supabase
      .from('consent_grants')
      .select('id, grantor_id, grantee_id, status, journal_id, entry_id, granted_at, grantee_wrapped_key')
      .eq('id', grantId)
      .maybeSingle();

    if (grantError || !grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    // Must be a participant (grantor or grantee)
    if (grant.grantor_id !== user.id && grant.grantee_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Must be active
    if (grant.status !== 'active') {
      return NextResponse.json({ error: 'This shared entry is no longer active' }, { status: 403 });
    }

    const admin = createAdminClient();

    // Fetch the snapshot content (using admin client to ensure both grantor and grantee can view)
    const { data: snapshot } = await admin
      .from('shared_entry_snapshots')
      .select('title_encrypted, title_iv, content_encrypted, content_iv, snapshot_at')
      .eq('grant_id', grantId)
      .maybeSingle();

    // Get grantor's name
    const { data: grantorProfile } = await admin
      .from('users')
      .select('name')
      .eq('id', grant.grantor_id)
      .maybeSingle();

    const isEncrypted = Boolean(
      snapshot?.content_iv && snapshot.content_iv !== 'none'
    );

    return NextResponse.json({
      entry: {
        title_encrypted: snapshot?.title_encrypted || null,
        title_iv: snapshot?.title_iv || null,
        content_encrypted: snapshot?.content_encrypted || null,
        content_iv: snapshot?.content_iv || null,
        grantee_wrapped_key: grant.grantee_wrapped_key || null,
        is_encrypted: isEncrypted,
        // Fallbacks for unencrypted / legacy records
        title: isEncrypted ? 'Encrypted Reflection' : (snapshot?.title_encrypted || 'Journal Reflection'),
        content: isEncrypted ? '' : (snapshot?.content_encrypted || ''),
        shared_at: grant.granted_at,
        grantor_id: grant.grantor_id,
        grantee_id: grant.grantee_id,
        grantor_name: grantorProfile?.name || 'Your Friend',
      },
    });
  } catch (error: any) {
    console.error('Error in GET /api/consent/[id]/view:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

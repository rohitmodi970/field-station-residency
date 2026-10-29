import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: 'Unauthorized', status: 401 };
  return { user };
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const body = await req.json();
    const { provider, external_id } = body;

    if (!provider || !external_id) {
      return NextResponse.json({ error: 'provider and external_id are required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Insert mapping; on conflict update the user_id to the current user
    const { data, error } = await admin
      .from('external_accounts')
      .upsert({ provider, external_id, user_id: user.id }, { onConflict: 'provider,external_id' })
      .select()
      .limit(1);

    if (error) {
      console.error('Failed to upsert external_account:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, mapping: data?.[0] ?? null });
  } catch (err: any) {
    console.error('Error in POST /api/user/external-account:', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider');
    const external_id = url.searchParams.get('external_id');

    if (!provider || !external_id) {
      return NextResponse.json({ error: 'provider and external_id required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('external_accounts')
      .delete()
      .match({ provider, external_id, user_id: user.id });

    if (error) {
      console.error('Failed to delete external_account:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Error in DELETE /api/user/external-account:', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

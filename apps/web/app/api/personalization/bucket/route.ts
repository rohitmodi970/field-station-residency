import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { isEnergyBucket } from '@/lib/personalization/bucket';
import { resolveBucketState } from '@/lib/personalization/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const state = await resolveBucketState(user.id, user.email);
    return NextResponse.json({ success: true, ...state });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch bucket state', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const bucket = body?.bucket;
    const reflection = typeof body?.reflection === 'string' && body.reflection.trim() ? body.reflection.trim() : null;

    if (!bucket && !reflection) {
      return NextResponse.json({ error: 'Either bucket or reflection must be provided' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const upsertPayload: Record<string, unknown> = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    if (bucket && isEnergyBucket(bucket)) {
      upsertPayload.energy_level = bucket;
    } else if (bucket) {
      return NextResponse.json({ error: 'Invalid bucket value' }, { status: 400 });
    }

    if (reflection) {
      upsertPayload.reflection = reflection;
    }

    const { error: upsertError } = await adminClient
      .from('user_onboarding')
      .upsert(upsertPayload, { onConflict: 'user_id' });

    if (upsertError) {
      return NextResponse.json(
        { error: 'Failed to save onboarding data', details: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, bucket: upsertPayload.energy_level || null, reflection: upsertPayload.reflection || null });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save bucket', details: (error as Error).message },
      { status: 500 }
    );
  }
}

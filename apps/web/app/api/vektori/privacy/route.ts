import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { clearVektoriMemory } from '@/utils/vektori/client';

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { user };
}

export async function GET() {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const adminClient = createAdminClient();
    const { data: settings } = await adminClient
      .from('user_settings')
      .select('memory_opt_in,memory_retention_days,memory_rollout_percent,memory_last_cleared_at')
      .eq('user_id', authResult.user.id)
      .single();

    return NextResponse.json({
      privacy: {
        memory_opt_in: settings?.memory_opt_in ?? true,
        memory_retention_days: settings?.memory_retention_days ?? 365,
        memory_rollout_percent: settings?.memory_rollout_percent ?? 100,
        memory_last_cleared_at: settings?.memory_last_cleared_at ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '');
    const adminClient = createAdminClient();

    if (action === 'clear') {
      await adminClient
        .from('user_knowledge')
        .update({ is_active: false, forget_reason: 'User requested memory clear' })
        .eq('user_id', user.id)
        .eq('is_active', true);

      await clearVektoriMemory({ userId: user.id, sessionId: body.sessionId || undefined });

      const { data: settings } = await adminClient
        .from('user_settings')
        .update({ memory_last_cleared_at: new Date().toISOString(), memory_opt_in: true })
        .eq('user_id', user.id)
        .select('memory_opt_in,memory_retention_days,memory_rollout_percent,memory_last_cleared_at')
        .single();

      return NextResponse.json({ success: true, privacy: settings });
    }

    if (action === 'clear_onboarding') {
      await clearVektoriMemory({ userId: user.id, sessionId: 'onboarding-day1' });
      return NextResponse.json({ success: true, message: 'Onboarding Day-1 memory cleared from Vektori' });
    }

    if (action === 'opt_out' || action === 'opt_in') {
      const memoryOptIn = action === 'opt_in';
      const { data: settings } = await adminClient
        .from('user_settings')
        .update({ memory_opt_in: memoryOptIn })
        .eq('user_id', user.id)
        .select('memory_opt_in,memory_retention_days,memory_rollout_percent,memory_last_cleared_at')
        .single();

      return NextResponse.json({ success: true, privacy: settings });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

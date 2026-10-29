// apps/web/app/api/residency/intent/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { refreshUserSnapshotFromLatestData } from '@/lib/residency/residencyStore';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body = await req.json().catch(() => ({}));
    const userId = user?.id || body.user_id;
    const cohortId = body.cohort_id || 'dhun-oct-2026';

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized or userId required' }, { status: 401 });
    }

    console.log(`🔄 [API:Residency:Refresh] Refreshing snapshot for user: ${userId}`);

    // Refresh user's snapshot from latest onboarding answers, Onairos profile & recent journals
    const updatedSnapshot = await refreshUserSnapshotFromLatestData(userId, cohortId);

    return NextResponse.json({
      success: true,
      refreshed_at: new Date().toISOString(),
      snapshot: updatedSnapshot,
    });
  } catch (err: any) {
    console.error('❌ [API:Residency:Refresh] Error:', err);
    return NextResponse.json({ error: 'Failed to refresh residency snapshot', details: err.message }, { status: 500 });
  }
}

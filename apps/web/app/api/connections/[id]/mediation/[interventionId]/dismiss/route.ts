import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { updateMediationInterventionStatus } from '@/lib/agent/v2/mediationContextService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; interventionId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const interventionId = resolvedParams.interventionId;

    let actionStatus: 'acted_upon' | 'dismissed' = 'dismissed';
    try {
      const body = await req.json();
      if (body?.status === 'acted_upon') {
        actionStatus = 'acted_upon';
      }
    } catch {
      // Default to dismissed if no body provided
    }

    const result = await updateMediationInterventionStatus(
      supabase,
      interventionId,
      user.id,
      actionStatus
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update intervention status' }, { status: 400 });
    }

    return NextResponse.json({ success: true, status: actionStatus });
  } catch (err: any) {
    console.error('💥 [API:Connections:Mediation:Dismiss] Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

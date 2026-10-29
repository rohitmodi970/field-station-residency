import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getMediationInterventionsForUser } from '@/lib/agent/v2/mediationContextService';

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

    const resolvedParams = await params;
    const connectionId = resolvedParams.id;

    // Fetch interventions scoped by visibility rules
    const interventions = await getMediationInterventionsForUser(
      supabase,
      connectionId,
      user.id
    );

    return NextResponse.json({
      success: true,
      interventions,
    });
  } catch (err: any) {
    console.error('💥 [API:Connections:Mediation:List] Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  buildMediationContextSnapshot,
  persistMediationIntervention,
} from '@/lib/agent/v2/mediationContextService';
import { evaluateMediationDecision } from '@/lib/agent/v2/mediationEngine';

export async function POST(
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

    // Optional trigger context from client
    let triggerContext: any = undefined;
    try {
      const body = await req.json();
      triggerContext = body.triggerContext;
    } catch {
      // Empty body is acceptable for a routine evaluation
    }

    // 1. Build Scoped Mediation Context Snapshot (verifies dual-key consent)
    const contextResult = await buildMediationContextSnapshot(supabase, connectionId, user.id);

    if (!contextResult.permitted || !contextResult.snapshot) {
      return NextResponse.json({
        success: false,
        action: 'silence',
        reason: contextResult.reason || 'Mediation not permitted under current consent settings.',
      }, { status: 200 });
    }

    // 2. Evaluate with Anthropic Claude Haiku 4.5
    const decision = await evaluateMediationDecision({
      snapshot: contextResult.snapshot,
      triggerContext,
    });

    // 3. Persist intervention if not silent
    let persistedIntervention = undefined;
    if (decision.action !== 'silence' && decision.should_persist) {
      const persistResult = await persistMediationIntervention(
        supabase,
        connectionId,
        decision,
        user.id
      );
      if (persistResult.success) {
        persistedIntervention = persistResult.intervention;
      }
    }

    return NextResponse.json({
      success: true,
      decision,
      persisted: Boolean(persistedIntervention),
      intervention: persistedIntervention,
    });
  } catch (err: any) {
    console.error('💥 [API:Connections:Mediation:Evaluate] Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

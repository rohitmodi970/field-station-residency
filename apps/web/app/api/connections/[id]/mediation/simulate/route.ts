import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import {
  buildMediationContextSnapshot,
  persistMediationIntervention,
} from '@/lib/agent/v2/mediationContextService';
import { evaluateMediationDecision } from '@/lib/agent/v2/mediationEngine';

/**
 * Force V2 — Phase 5 Mediation Simulation Harness
 * Simulates a realistic dialogue or friction moment between connected partners
 * to test bridging question generation and epistemic confidence.
 */
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

    const body = await req.json().catch(() => ({}));
    const scenario = body.scenario || 'decision_pace_friction';

    // 1. Build Scoped Mediation Context Snapshot
    const contextResult = await buildMediationContextSnapshot(supabase, connectionId, user.id);

    if (!contextResult.permitted || !contextResult.snapshot) {
      return NextResponse.json({
        success: false,
        error: contextResult.reason || 'Mediation not permitted. Verify mutual consent is active.',
      }, { status: 400 });
    }

    // 2. Inject simulated scenario for testing
    let simulatedTriggerNote = 'Routine check';
    if (scenario === 'decision_pace_friction') {
      simulatedTriggerNote = 'Both partners have active unresolved threads regarding a major upcoming relocation and feel unaligned on timing.';
    } else if (scenario === 'work_life_asymmetry') {
      simulatedTriggerNote = 'Partner A has been working late consistently; Partner B noted feeling disconnected in recent reflections.';
    }

    // 3. Evaluate decision with Claude Haiku 4.5
    const decision = await evaluateMediationDecision({
      snapshot: contextResult.snapshot,
      triggerContext: {
        type: 'partner_checkin',
        note: simulatedTriggerNote,
      },
    });

    // 4. Persist if non-silent
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
      scenario,
      decision,
      persisted: Boolean(persistedIntervention),
      intervention: persistedIntervention,
    });
  } catch (err: any) {
    console.error('💥 [API:Connections:Mediation:Simulate] Error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

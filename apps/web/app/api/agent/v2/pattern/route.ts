/**
 * Force V2 — Pattern Deletion API
 * Enables users to directly delete observed patterns and agent inferences
 * from their user_context_model, upholding strict user consent and epistemic agency.
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { AgentInference, ObservedPattern } from '@/types/context-schemas';

export async function DELETE(req: NextRequest) {
  return handlePatternDeletion(req);
}

export async function POST(req: NextRequest) {
  return handlePatternDeletion(req);
}

async function handlePatternDeletion(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const patternId = body.patternId || body.id;

    if (!patternId || typeof patternId !== 'string') {
      return NextResponse.json({ error: 'patternId is required' }, { status: 400 });
    }

    // 1. Fetch current user context model
    const { data: model, error: modelErr } = await supabase
      .from('user_context_model')
      .select('id, agent_inferences, observed_patterns, corrections')
      .eq('user_id', user.id)
      .maybeSingle();

    if (modelErr || !model) {
      return NextResponse.json({ error: 'Context model not found' }, { status: 404 });
    }

    const rawInferences: AgentInference[] = Array.isArray(model.agent_inferences)
      ? model.agent_inferences
      : [];
    const rawPatterns: ObservedPattern[] = Array.isArray(model.observed_patterns)
      ? model.observed_patterns
      : [];

    // Find target pattern/inference
    const targetInference = rawInferences.find((inf) => inf.id === patternId);
    const targetPattern = rawPatterns.find((p) => p.id === patternId);

    if (!targetInference && !targetPattern) {
      return NextResponse.json({ error: 'Pattern not found in memory' }, { status: 404 });
    }

    // 2. Filter out deleted pattern
    const updatedInferences = rawInferences.filter((inf) => inf.id !== patternId);
    const updatedPatterns = rawPatterns.filter((p) => p.id !== patternId);

    // 3. Record correction/refusal event in corrections array for model alignment
    const corrections = Array.isArray(model.corrections) ? [...model.corrections] : [];
    const deletedContent = targetInference?.inference || targetPattern?.pattern || 'Observed pattern';
    const premise = targetInference?.premise || targetPattern?.domain || 'Observation';

    corrections.push({
      id: `corr-${Date.now()}`,
      original_claim: `${deletedContent} (Basis: ${premise})`,
      user_correction: 'User manually deleted this observed pattern from memory.',
      corrected_at: new Date().toISOString(),
    });

    // 4. Update user_context_model atomically
    const { error: updateErr } = await supabase
      .from('user_context_model')
      .update({
        agent_inferences: updatedInferences,
        observed_patterns: updatedPatterns,
        corrections: corrections.slice(-30), // keep recent 30 corrections
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateErr) {
      console.error('[API:Agent:Pattern:Delete] Error updating user_context_model:', updateErr);
      return NextResponse.json({ error: 'Failed to update memory model' }, { status: 500 });
    }

    // 5. Audit event in interaction_events
    await supabase.from('interaction_events').insert({
      user_id: user.id,
      source: 'user',
      event_type: 'pattern_deleted',
      event_data: {
        pattern_id: patternId,
        pattern_type: targetInference ? 'inference' : 'observed_pattern',
        deleted_content: deletedContent,
        premise,
        deleted_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      deletedId: patternId,
      remainingInferencesCount: updatedInferences.length,
      remainingPatternsCount: updatedPatterns.length,
      message: 'Observed pattern deleted successfully.',
    });
  } catch (err: any) {
    console.error('[API:Agent:Pattern:Delete] Unexpected error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

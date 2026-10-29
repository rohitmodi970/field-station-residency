import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('ℹ️ [API:OnboardingV2:Model:Correct] Public test mode correction accepted');
      return NextResponse.json({ success: true, is_public_test: true });
    }

    const body = await req.json();
    const { original_claim, user_correction, action, updated_reflection } = body;

    const { data: context, error: fetchError } = await supabase
      .from('user_context_model')
      .select('corrections, initial_model, current_model')
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Context model not found' }, { status: 404 });
    }

    const existingCorrections = Array.isArray(context.corrections) ? context.corrections : [];
    const newCorrection = {
      id: `corr-${Date.now()}`,
      original_claim: original_claim || '',
      user_correction: user_correction || '',
      action: action || 'modify',
      corrected_at: new Date().toISOString(),
    };

    const updatePayload: Record<string, any> = {
      corrections: [...existingCorrections, newCorrection],
      updated_at: new Date().toISOString(),
    };

    if (updated_reflection) {
      updatePayload.current_model = {
        ...(context.current_model || {}),
        narrative_reflection: updated_reflection,
      };
    }

    const { error: updateError } = await supabase
      .from('user_context_model')
      .update(updatePayload)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('[OnboardingV2:Correct] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to record correction' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      correction: newCorrection,
    });
  } catch (err: any) {
    console.error('[OnboardingV2:Correct] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

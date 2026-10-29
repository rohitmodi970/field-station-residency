import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: context, error: fetchError } = await supabase
      .from('user_context_model')
      .select('id, initial_model, current_model, explicit_facts, corrections, onboarding_step, onboarding_completed_at')
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ model: null });
      }
      console.error('[OnboardingV2:Model] Error:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      model: context,
    });
  } catch (err: any) {
    console.error('[OnboardingV2:Model] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

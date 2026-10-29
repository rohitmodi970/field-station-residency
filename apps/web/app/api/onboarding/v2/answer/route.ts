import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('ℹ️ [API:OnboardingV2:Answer] Public test mode answer accepted');
      return NextResponse.json({ success: true, is_public_test: true });
    }

    const body = await req.json();
    const { question_id, question_prompt, answer, chips_selected, step_index } = body;

    if (!question_id || typeof answer !== 'string') {
      return NextResponse.json({ error: 'question_id and answer are required' }, { status: 400 });
    }

    console.log(`💬 [API:OnboardingV2:Answer] Received answer for "${question_id}" (User: ${user.id}):`, {
      chips: chips_selected,
      preview: answer.slice(0, 80),
    });

    // 1. Fetch current answers
    const { data: currentContext, error: fetchError } = await supabase
      .from('user_context_model')
      .select('onboarding_answers, explicit_facts')
      .eq('user_id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ [API:OnboardingV2:Answer] Fetch error:', fetchError);
      return NextResponse.json({ error: 'Database fetch error' }, { status: 500 });
    }

    const updatedAnswers = {
      ...(currentContext?.onboarding_answers || {}),
      [question_id]: {
        question_id,
        question_prompt: question_prompt || '',
        raw_answer: answer,
        chips_selected: chips_selected || [],
        answered_at: new Date().toISOString(),
      },
    };

    const updatePayload: Record<string, any> = {
      onboarding_answers: updatedAnswers,
      onboarding_step: step_index ? Math.max(step_index, 3) : 3,
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from('user_context_model')
      .upsert(
        {
          user_id: user.id,
          ...updatePayload,
        },
        { onConflict: 'user_id' }
      );

    if (updateError) {
      console.error('❌ [API:OnboardingV2:Answer] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to record answer' }, { status: 500 });
    }

    console.log(`✅ [API:OnboardingV2:Answer] Saved answer for "${question_id}" (Total answered: ${Object.keys(updatedAnswers).length})`);

    return NextResponse.json({
      success: true,
    });
  } catch (err: any) {
    console.error('❌ [API:OnboardingV2:Answer] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

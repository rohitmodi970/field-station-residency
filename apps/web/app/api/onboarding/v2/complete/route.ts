import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('ℹ️ [API:OnboardingV2:Complete] Public test mode completed without user session');
      return NextResponse.json({ success: true, is_public_test: true });
    }

    console.log(`🎉 [API:OnboardingV2:Complete] Finalizing onboarding for user: ${user.id}`);

    const now = new Date().toISOString();

    const { data: updatedContext, error: updateError } = await supabase
      .from('user_context_model')
      .update({
        onboarding_completed_at: now,
        onboarding_step: 6,
        model_version: 1,
        updated_at: now,
      })
      .eq('user_id', user.id)
      .select('id, onboarding_completed_at, initial_model')
      .single();

    if (updateError) {
      console.error('❌ [API:OnboardingV2:Complete] Error:', updateError);
      return NextResponse.json({ error: 'Failed to complete onboarding' }, { status: 500 });
    }

    // Also update public.users.onboarding_complete so middleware recognizes completion
    const { error: usersUpdateError } = await supabase
      .from('users')
      .update({ onboarding_complete: true })
      .eq('id', user.id);

    if (usersUpdateError) {
      console.warn('⚠️ [API:OnboardingV2:Complete] users table update warning:', usersUpdateError);
    } else {
      console.log(`✅ [API:OnboardingV2:Complete] Updated public.users.onboarding_complete = true`);
    }

    // Also update auth.user metadata if helpful
    await supabase.auth.updateUser({
      data: {
        onboarding_v2_completed: true,
        onboarding_v2_completed_at: now,
      },
    });

    // Trigger residency intent snapshot creation & cohort graph placement in background
    try {
      const { refreshUserSnapshotFromLatestData } = await import('@/lib/residency/residencyStore');
      refreshUserSnapshotFromLatestData(user.id).catch((err) => {
        console.warn('⚠️ [API:OnboardingV2:Complete] Residency snapshot refresh error:', err?.message);
      });
    } catch (e) {}

    console.log(`🚀 [API:OnboardingV2:Complete] Onboarding model ${updatedContext.id} locked & complete at ${now}`);

    return NextResponse.json({
      success: true,
      completed_at: now,
      model_id: updatedContext.id,
    });
  } catch (err: any) {
    console.error('❌ [API:OnboardingV2:Complete] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

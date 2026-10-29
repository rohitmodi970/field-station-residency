import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('ℹ️ [API:OnboardingV2:Start] [TEMPORARY] Public testing session initialized without user session');
      return NextResponse.json({
        is_public_test: true,
        user_email: 'tester@onairos.force',
        onairos_connected: false,
        onboarding_step: 0,
        skipped_questions: [],
        answers: {},
      });
    }

    console.log(`🚀 [API:OnboardingV2:Start] Initializing onboarding for user: ${user.id} (${user.email})`);

    // Check user's onboarding_complete flag in public.users
    const { data: userData } = await supabase
      .from('users')
      .select('onboarding_complete')
      .eq('id', user.id)
      .maybeSingle();

    const isUserMarkedIncomplete = userData && userData.onboarding_complete === false;

    // Check if user_context_model exists
    const { data: existingModel } = await supabase
      .from('user_context_model')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingModel) {
      // SCENARIO A: User was previously completed, but onboarding_complete was reset to false (Re-onboarding)
      if (isUserMarkedIncomplete && (existingModel.onboarding_completed_at || existingModel.onboarding_step === 6)) {
        console.log(`🔄 [API:OnboardingV2:Start] User ${user.id} is restarting onboarding! Archiving Version ${existingModel.model_version || 1} to model_history...`);

        const history = Array.isArray(existingModel.model_history) ? existingModel.model_history : [];
        const archivedEntry = {
          version: existingModel.model_version || 1,
          initial_model: existingModel.initial_model,
          current_model: existingModel.current_model,
          onboarding_answers: existingModel.onboarding_answers,
          explicit_facts: existingModel.explicit_facts,
          onboarding_completed_at: existingModel.onboarding_completed_at,
          archived_at: new Date().toISOString(),
        };

        const updatedHistory = [...history, archivedEntry];
        const nextVersion = (existingModel.model_version || 1) + 1;

        const { data: resetModel, error: resetError } = await supabase
          .from('user_context_model')
          .update({
            model_history: updatedHistory,
            model_version: nextVersion,
            onboarding_step: 1,
            onboarding_answers: {},
            onboarding_completed_at: null,
            initial_model: null,
            current_model: null,
            onairos_connected_at: null,
            onairos_jwt: null,
            onairos_payload: null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .select('id, onboarding_step, onboarding_completed_at, initial_model, model_version, model_history')
          .single();

        if (resetError) {
          console.error('❌ [API:OnboardingV2:Start] Error resetting model for re-onboarding:', resetError);
        } else {
          console.log(`✅ [API:OnboardingV2:Start] Successfully archived V${existingModel.model_version || 1} and started V${nextVersion} (Total history entries: ${updatedHistory.length})`);
          return NextResponse.json({
            success: true,
            model_id: resetModel.id,
            onboarding_step: 1,
            is_completed: false,
            initial_model: null,
            model_version: nextVersion,
            archived_versions_count: updatedHistory.length,
          });
        }
      }

      // Fetch existing social profiles for pre-population
      const { data: socialProfiles } = await supabase
        .from('user_social_profiles')
        .select('platform, profile_url, handle')
        .eq('user_id', user.id);

      const socialLinks: Record<string, string> = {
        linkedin: '',
        twitter: '',
        instagram: '',
        facebook: '',
        website: '',
        github: '',
      };
      for (const p of socialProfiles || []) {
        if (p.platform in socialLinks) {
          socialLinks[p.platform] = p.profile_url || (p.handle ? `@${p.handle}` : '');
        }
      }

      // SCENARIO B: Existing in-progress session
      console.log(`ℹ️ [API:OnboardingV2:Start] Resuming context model ${existingModel.id} (V${existingModel.model_version || 1}, step: ${existingModel.onboarding_step}, completed: ${!!existingModel.onboarding_completed_at})`);
      return NextResponse.json({
        success: true,
        model_id: existingModel.id,
        onboarding_step: existingModel.onboarding_step,
        is_completed: !!existingModel.onboarding_completed_at,
        initial_model: existingModel.initial_model,
        model_version: existingModel.model_version || 1,
        social_links: socialLinks,
        answers: existingModel.onboarding_answers || {},
        onairos_connected: !!existingModel.onairos_connected_at,
        personality_assessment: existingModel.personality_assessment || null,
      });
    }

    console.log(`🆕 [API:OnboardingV2:Start] Creating fresh user_context_model for user: ${user.id}`);

    // Upsert to gracefully handle concurrent React StrictMode requests
    const { data: newModel, error: insertError } = await supabase
      .from('user_context_model')
      .upsert(
        {
          user_id: user.id,
          onboarding_step: 1,
          onboarding_answers: {},
          explicit_facts: [],
          observed_patterns: [],
          agent_inferences: [],
          corrections: [],
          unresolved_threads: [],
          active_intentions: [],
        },
        { onConflict: 'user_id' }
      )
      .select('id, onboarding_step, onboarding_completed_at, initial_model')
      .single();

    if (insertError) {
      // Fallback: query again in case another concurrent request won the insert
      const { data: fallbackModel } = await supabase
        .from('user_context_model')
        .select('id, onboarding_step, onboarding_completed_at, initial_model')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fallbackModel) {
        console.log(`[API:OnboardingV2:Start] Concurrent insert resolved to model ${fallbackModel.id}`);
        return NextResponse.json({
          success: true,
          model_id: fallbackModel.id,
          user_email: user.email || null,
          onboarding_step: fallbackModel.onboarding_step,
          is_completed: !!fallbackModel.onboarding_completed_at,
          initial_model: fallbackModel.initial_model,
          social_links: { linkedin: '', twitter: '', instagram: '', facebook: '', website: '', github: '' },
          answers: {},
        });
      }

      console.error('❌ [API:OnboardingV2:Start] Upsert error:', insertError);
      return NextResponse.json({ error: 'Failed to initialize onboarding model' }, { status: 500 });
    }

    console.log(`✅ [API:OnboardingV2:Start] Successfully initialized new model ${newModel.id}`);

    return NextResponse.json({
      success: true,
      model_id: newModel.id,
      user_email: user.email || null,
      onboarding_step: newModel.onboarding_step,
      is_completed: !!newModel.onboarding_completed_at,
      initial_model: newModel.initial_model,
      social_links: { linkedin: '', twitter: '', instagram: '', facebook: '', website: '', github: '' },
      answers: {},
    });
  } catch (err: any) {
    console.error('❌ [API:OnboardingV2:Start] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

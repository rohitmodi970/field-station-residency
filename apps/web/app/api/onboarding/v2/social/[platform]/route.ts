import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { platform } = await params;

    if (!platform) {
      return NextResponse.json({ error: 'Platform parameter required' }, { status: 400 });
    }

    // Purge from user_social_profiles
    const { error: deleteError } = await supabase
      .from('user_social_profiles')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', platform);

    if (deleteError) {
      console.error('[OnboardingV2:DeletePlatform] Error:', deleteError);
      return NextResponse.json({ error: 'Failed to revoke platform data' }, { status: 500 });
    }

    // Also remove from explicit_facts if source matches
    const { data: context } = await supabase
      .from('user_context_model')
      .select('explicit_facts')
      .eq('user_id', user.id)
      .single();

    if (context && Array.isArray(context.explicit_facts)) {
      const filteredFacts = context.explicit_facts.filter(
        (f: any) => !f.source?.toLowerCase().includes(platform.toLowerCase())
      );
      await supabase
        .from('user_context_model')
        .update({ explicit_facts: filteredFacts })
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      success: true,
      revoked_platform: platform,
    });
  } catch (err: any) {
    console.error('[OnboardingV2:DeletePlatform] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

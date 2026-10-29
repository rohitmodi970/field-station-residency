import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profiles, error: fetchError } = await supabase
      .from('user_social_profiles')
      .select('platform, handle, profile_url, fetch_status, extracted_insights, fetch_error')
      .eq('user_id', user.id);

    if (fetchError) {
      console.error('[OnboardingV2:Status] Fetch error:', fetchError);
      return NextResponse.json({ error: 'Database fetch error' }, { status: 500 });
    }

    const discoveries = (profiles || [])
      .filter((p) => p.extracted_insights)
      .map((p) => ({
        id: `profile-${p.platform}`,
        platform: p.platform,
        title: p.extracted_insights?.title || `${p.platform.toUpperCase()} Profile`,
        summary: p.extracted_insights?.summary || '',
        url: p.profile_url || '',
        badgeLabel: p.extracted_insights?.badge || `🔗 ${p.platform}`,
      }));

    const isAllFastTierResolved = (profiles || []).every((p) =>
      ['completed', 'partial', 'failed', 'revoked'].includes(p.fetch_status)
    );

    return NextResponse.json({
      success: true,
      discoveries,
      is_ready_to_continue: isAllFastTierResolved || (profiles || []).length === 0,
      profiles: profiles || [],
    });
  } catch (err: any) {
    console.error('[OnboardingV2:Status] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

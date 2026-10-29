import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { runFastTierEnrichment } from '@/lib/enrichment/pipeline';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { full_name, location } = body;

    console.log(`🌐 [API:OnboardingV2:SocialFetch] Fetching linked profiles for user: ${user.id}`);

    // Fetch linked profiles
    const { data: profiles, error: fetchProfilesError } = await supabase
      .from('user_social_profiles')
      .select('platform, profile_url, handle, consent_given')
      .eq('user_id', user.id);

    if (fetchProfilesError) {
      console.error('❌ [API:OnboardingV2:SocialFetch] Error getting profiles:', fetchProfilesError);
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
    }

    const linkMap: Record<string, string> = {};
    for (const p of profiles || []) {
      if (p.consent_given) {
        linkMap[p.platform] = p.profile_url || p.handle || '';
      }
    }

    console.log(`🌐 [API:OnboardingV2:SocialFetch] User ${user.id} has ${Object.keys(linkMap).length} consented social links:`, linkMap);

    // Run parallel fast-tier enrichment
    const enrichmentResult = await runFastTierEnrichment({
      userId: user.id,
      fullName: full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
      location: location || user.user_metadata?.location,
      linkedinUrl: linkMap.linkedin,
      twitterHandle: linkMap.twitter,
      instagramHandle: linkMap.instagram,
      facebookUrl: linkMap.facebook,
      websiteUrl: linkMap.website,
      githubUsername: linkMap.github,
    });

    console.log(`💾 [API:OnboardingV2:SocialFetch] Updating user_social_profiles with ${enrichmentResult.discoveries.length} discoveries...`);

    // Update status in user_social_profiles
    for (const p of profiles || []) {
      const match = enrichmentResult.discoveries.find((d) => d.platform === p.platform);
      await supabase
        .from('user_social_profiles')
        .update({
          fetch_status: match ? 'completed' : 'partial',
          extracted_insights: match ? { summary: match.summary, title: match.title, badge: match.badgeLabel } : null,
          last_fetched_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('platform', p.platform);
    }

    console.log(`✅ [API:OnboardingV2:SocialFetch] Complete in ${enrichmentResult.fastTierLatencyMs}ms — Returning ${enrichmentResult.discoveries.length} items`);

    return NextResponse.json({
      success: true,
      discoveries: enrichmentResult.discoveries,
      latency_ms: enrichmentResult.fastTierLatencyMs,
      completed_count: enrichmentResult.completedCount,
    });
  } catch (err: any) {
    console.error('❌ [API:OnboardingV2:SocialFetch] Unexpected error:', err);
    return NextResponse.json({ error: 'Enrichment failed' }, { status: 500 });
  }
}

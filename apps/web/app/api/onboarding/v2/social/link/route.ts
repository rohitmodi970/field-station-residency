import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { links, consent_given } = body; // links: { linkedin?: string, twitter?: string, website?: string, github?: string, instagram?: string }

    if (!links || typeof links !== 'object') {
      return NextResponse.json({ error: 'links object is required' }, { status: 400 });
    }

    console.log(`🔗 [API:OnboardingV2:SocialLink] Saving links for user ${user.id}:`, links, `(Consent: ${!!consent_given})`);

    const now = new Date().toISOString();
    const recordsToUpsert: Array<{
      user_id: string;
      platform: string;
      profile_url?: string;
      handle?: string;
      enrichment_tool: string;
      consent_given: boolean;
      consent_given_at: string;
      fetch_status: string;
    }> = [];

    const sanitizeHandle = (input: string, domainRegex?: RegExp) => {
      let s = input.trim();
      if (domainRegex) s = s.replace(domainRegex, '');
      return s.replace(/^@/, '').replace(/\/.*$/, '').replace(/^[^\w]+/, '').trim();
    };

    const normalizeUrl = (input: string) => {
      let s = input.trim();
      if (s && !/^https?:\/\//i.test(s)) {
        s = `https://${s}`;
      }
      return s.split('?')[0];
    };

    if (links.linkedin) {
      const cleanLinkedin = normalizeUrl(links.linkedin);
      recordsToUpsert.push({
        user_id: user.id,
        platform: 'linkedin',
        profile_url: cleanLinkedin,
        enrichment_tool: 'apify_linkedin',
        consent_given: !!consent_given,
        consent_given_at: now,
        fetch_status: 'pending',
      });
    }

    if (links.twitter) {
      const handle = sanitizeHandle(links.twitter, /^https?:\/\/(www\.)?(twitter|x)\.com\//i);
      if (handle) {
        recordsToUpsert.push({
          user_id: user.id,
          platform: 'twitter',
          handle,
          profile_url: `https://x.com/${handle}`,
          enrichment_tool: 'apify_twitter',
          consent_given: !!consent_given,
          consent_given_at: now,
          fetch_status: 'pending',
        });
      }
    }

    if (links.website) {
      recordsToUpsert.push({
        user_id: user.id,
        platform: 'website',
        profile_url: normalizeUrl(links.website),
        enrichment_tool: 'firecrawl',
        consent_given: !!consent_given,
        consent_given_at: now,
        fetch_status: 'pending',
      });
    }

    if (links.instagram) {
      const handle = sanitizeHandle(links.instagram, /^https?:\/\/(www\.)?instagram\.com\//i);
      if (handle) {
        recordsToUpsert.push({
          user_id: user.id,
          platform: 'instagram',
          handle,
          profile_url: `https://instagram.com/${handle}`,
          enrichment_tool: 'apify_instagram',
          consent_given: !!consent_given,
          consent_given_at: now,
          fetch_status: 'pending',
        });
      }
    }

    if (links.facebook) {
      recordsToUpsert.push({
        user_id: user.id,
        platform: 'facebook',
        profile_url: normalizeUrl(links.facebook),
        enrichment_tool: 'apify_facebook',
        consent_given: !!consent_given,
        consent_given_at: now,
        fetch_status: 'pending',
      });
    }

    if (links.github) {
      const handle = sanitizeHandle(links.github, /^https?:\/\/(www\.)?github\.com\//i);
      if (handle) {
        recordsToUpsert.push({
          user_id: user.id,
          platform: 'github',
          handle,
          profile_url: `https://github.com/${handle}`,
          enrichment_tool: 'github_api',
          consent_given: !!consent_given,
          consent_given_at: now,
          fetch_status: 'pending',
        });
      }
    }

    // 1. Remove any platforms explicitly cleared by the user
    const platformsToRemove = Object.entries(links)
      .filter(([_, val]) => typeof val === 'string' && val.trim() === '')
      .map(([platform]) => platform);

    if (platformsToRemove.length > 0) {
      console.log(`🗑️ [API:OnboardingV2:SocialLink] Removing cleared platforms for user ${user.id}:`, platformsToRemove);
      await supabase
        .from('user_social_profiles')
        .delete()
        .eq('user_id', user.id)
        .in('platform', platformsToRemove);
    }

    // 2. Upsert active platforms with reset insights
    if (recordsToUpsert.length > 0) {
      const records = recordsToUpsert.map((r) => ({
        ...r,
        extracted_insights: null, // Clear past insights so new profile is parsed cleanly
        last_fetched_at: null,
      }));

      const { error: upsertError } = await supabase
        .from('user_social_profiles')
        .upsert(records, { onConflict: 'user_id,platform' });

      if (upsertError) {
        console.error('❌ [API:OnboardingV2:SocialLink] Upsert error:', upsertError);
        return NextResponse.json({ error: 'Failed to save social profiles' }, { status: 500 });
      }
      console.log(`✅ [API:OnboardingV2:SocialLink] Successfully upserted ${records.length} social profile records`);
    }

    // Update consent map on user_context_model
    const { error: contextError } = await supabase
      .from('user_context_model')
      .update({
        external_data_consents: links,
        onboarding_step: 2,
        updated_at: now,
      })
      .eq('user_id', user.id);

    if (contextError) {
      console.warn('⚠️ [API:OnboardingV2:SocialLink] Context update warning:', contextError);
    }

    return NextResponse.json({
      success: true,
      linked_count: recordsToUpsert.length,
    });
  } catch (err: any) {
    console.error('❌ [API:OnboardingV2:SocialLink] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

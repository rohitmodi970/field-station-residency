/**
 * Force V2 — Apify Social Scraper Client
 * Scrapes walled social platforms (Twitter/X, Instagram, LinkedIn) using Apify Actors.
 * NOTE: Proxycurl was shut down July 2025 (LinkedIn legal action). LinkedIn scraping
 * is now handled entirely via this Apify actor (apify/linkedin-profile-scraper).
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 2.1.0
 */

export interface ApifyScrapeResult {
  platform: 'twitter' | 'instagram' | 'facebook' | 'linkedin';
  success: boolean;
  title: string;
  summary: string;
  posts: Array<{ text: string; date?: string; url?: string }>;
  badgeLabel: string;
  error?: string;
}

export interface LinkedInExperience {
  title: string;
  company: string;
  description?: string;
  starts_at?: string;
  ends_at?: string;
}

export interface LinkedInScrapedData {
  full_name?: string;
  headline?: string;
  summary?: string;
  current_role?: string;
  current_company?: string;
  experiences?: LinkedInExperience[];
  skills?: string[];
  education?: Array<{ school: string; degree?: string }>;
  location?: string;
}

// ─────────────────────────────────────────────────────────────────
// Helper: Run Apify actor synchronously and return JSON items
// ─────────────────────────────────────────────────────────────────
async function runApifyActor(
  actorSlug: string,
  inputBody: Record<string, unknown>,
  timeoutMs: number
): Promise<unknown[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.warn(`⚠️ [Enrichment:Apify] APIFY_API_TOKEN is missing — skipping actor ${actorSlug}`);
    throw new Error('APIFY_API_TOKEN not configured');
  }

  const startTime = Date.now();
  console.log(`🤖 [Enrichment:Apify] Calling actor "${actorSlug}" (timeout: ${timeoutMs}ms)...`, JSON.stringify(inputBody));

  const response = await fetch(
    `https://api.apify.com/v2/acts/${actorSlug}/run-sync-get-dataset-items?token=${token}&timeout=${Math.floor(timeoutMs / 1000)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inputBody),
      signal: AbortSignal.timeout(timeoutMs + 3000), // give 3s buffer over server timeout
    }
  );

  const durationMs = Date.now() - startTime;

  if (!response.ok) {
    const errText = await response.text();
    console.error(`❌ [Enrichment:Apify] Actor "${actorSlug}" failed in ${durationMs}ms (HTTP ${response.status}):`, errText.slice(0, 200));
    throw new Error(`Apify actor ${actorSlug} error (${response.status}): ${errText.slice(0, 120)}`);
  }

  const items = await response.json();
  const resArr = Array.isArray(items) ? items : [];
  console.log(`✅ [Enrichment:Apify] Actor "${actorSlug}" succeeded in ${durationMs}ms — Received ${resArr.length} dataset items`);
  return resArr;
}

// ─────────────────────────────────────────────────────────────────
// 1. LinkedIn Profile Scraper (replaces Proxycurl)
// Actors: harvestapi/linkedin-profile-scraper (primary) or dev_fusion/linkedin-profile-scraper
// Cost per run: ~$0.002–$0.005 (Apify $5 free credit covers ~1,000+ runs)
// ─────────────────────────────────────────────────────────────────
export async function scrapeLinkedInWithApify(linkedinUrl: string): Promise<{
  success: boolean;
  data?: LinkedInScrapedData;
  badgeLabel: string;
  error?: string;
}> {
  let cleanUrl = linkedinUrl.trim().split('?')[0] ?? ''; // remove tracking params
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }
  if (!cleanUrl.endsWith('/')) {
    cleanUrl = `${cleanUrl}/`;
  }

  // Extract handle/public identifier e.g. "rohitmodi970" from "https://www.linkedin.com/in/rohitmodi970/"
  const publicIdMatch = cleanUrl.match(/\/in\/([^\/\?]+)/i);
  const publicIdentifier = publicIdMatch ? publicIdMatch[1] : '';

  console.log(`🔗 [Enrichment:Apify:LinkedIn] Starting scrape for URL: ${cleanUrl} (ID: ${publicIdentifier})`);

  try {
    let items: unknown[] = [];
    try {
      // Primary: harvestapi/linkedin-profile-scraper
      // HarvestAPI accepts 'urls', 'publicIdentifiers', and 'profileUrls'
      items = await runApifyActor(
        'harvestapi~linkedin-profile-scraper',
        {
          urls: [cleanUrl],
          profileUrls: [cleanUrl],
          ...(publicIdentifier ? { publicIdentifiers: [publicIdentifier] } : {}),
          profileScraperMode: 'Profile details no email ($4 per 1k)',
        },
        30000 // LinkedIn scraping can take 15-25s on Apify
      );
    } catch (e1: any) {
      console.warn(`⚠️ [Enrichment:Apify:LinkedIn] harvestapi actor failed (${e1.message}), trying dev_fusion fallback...`);
      try {
        items = await runApifyActor(
          'dev_fusion~linkedin-profile-scraper',
          { profileUrls: [cleanUrl], urls: [cleanUrl] },
          30000
        );
      } catch (e2: any) {
        console.warn(`⚠️ [Enrichment:Apify:LinkedIn] dev_fusion also failed (${e2.message})`);
        throw e2;
      }
    }

    const profile = (items[0] || {}) as Record<string, any>;
    if (!profile || Object.keys(profile).length === 0) {
      console.warn(`⚠️ [Enrichment:Apify:LinkedIn] Empty dataset returned for ${cleanUrl}`);
      return { success: false, badgeLabel: '🔗 LinkedIn', error: 'No profile data returned' };
    }

    const rawPositions = profile.positions?.positionHistory || profile.experiences || profile.positions || profile.experience || [];
    const experiences: LinkedInExperience[] = (Array.isArray(rawPositions) ? rawPositions : [])
      .slice(0, 3)
      .map((p: any) => ({
        title: p.title || p.role || p.position || '',
        company: p.companyName || p.company || p.company_name || '',
        description: p.description || p.summary,
        starts_at: p.startEndDate?.start ? `${p.startEndDate.start.year}` : (p.startDate || p.start_date),
        ends_at: p.startEndDate?.end ? `${p.startEndDate.end.year}` : (p.endDate || p.end_date),
      }));

    const rawSkills = profile.skills || profile.skillsList || profile.topSkills || [];
    const skills: string[] = (Array.isArray(rawSkills) ? rawSkills : [])
      .slice(0, 8)
      .map((s: any) => (typeof s === 'string' ? s : s.name || s.title || s.skill || ''))
      .filter(Boolean);

    const fullName =
      profile.fullName ||
      profile.name ||
      profile.formattedName ||
      (profile.firstName && profile.lastName ? `${profile.firstName} ${profile.lastName}` : profile.firstName || 'LinkedIn Member');

    const headline = profile.headline || profile.title || profile.occupation || experiences[0]?.title || '';
    const summary = profile.summary || profile.about || profile.bio || profile.description || '';
    const location = profile.geoLocationName || profile.location || profile.city || profile.country || '';

    const data: LinkedInScrapedData = {
      full_name: fullName,
      headline,
      summary,
      current_role: experiences[0]?.title || headline,
      current_company: experiences[0]?.company,
      experiences,
      skills,
      location,
    };

    console.log(`✅ [Enrichment:Apify:LinkedIn] Parsed profile for "${data.full_name}":`, {
      role: data.current_role,
      company: data.current_company,
      skillsCount: data.skills?.length,
      headline: data.headline,
    });

    return { success: true, data, badgeLabel: '🔗 LinkedIn' };
  } catch (error: any) {
    console.error('❌ [Enrichment:Apify:LinkedIn] Scrape failed:', error?.message);
    return {
      success: false,
      badgeLabel: '🔗 LinkedIn',
      error: error?.name === 'TimeoutError' ? 'LinkedIn scrape timed out' : error?.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// 2. Twitter / X Recent Tweets
// Actor: apidojo/tweet-scraper
// ─────────────────────────────────────────────────────────────────
export async function scrapeTwitterWithApify(twitterHandle: string): Promise<ApifyScrapeResult> {
  const cleanHandle = twitterHandle.trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, '')
    .replace(/\/.*$/, '');

  console.log(`𝕏 [Enrichment:Apify:Twitter] Scraping tweets for handle: @${cleanHandle}`);

  try {
    const items = await runApifyActor(
      'apidojo~tweet-scraper',
      { handles: [cleanHandle], tweetsDesired: 10, includeReplies: false },
      15000 // Twitter scraping needs browser time
    );

    const posts = (items as any[]).slice(0, 8).map((item: any) => ({
      text: item.full_text || item.text || '',
      date: item.created_at,
      url: item.url,
    })).filter((p) => p.text.trim().length > 0);

    const summaryText = posts.slice(0, 3).map((p) => p.text).join(' | ').slice(0, 200);

    console.log(`✅ [Enrichment:Apify:Twitter] Found ${posts.length} tweets for @${cleanHandle}:`, summaryText);

    return {
      platform: 'twitter',
      success: posts.length > 0,
      title: `@${cleanHandle} on Twitter/X`,
      summary: summaryText || 'Public ideas, discussions, and tweets.',
      posts,
      badgeLabel: '𝕏 Twitter',
    };
  } catch (error: any) {
    console.error('❌ [Enrichment:Apify:Twitter] Twitter scrape failed:', error?.message);
    return {
      platform: 'twitter',
      success: false,
      title: `@${cleanHandle} on Twitter/X`,
      summary: '',
      posts: [],
      badgeLabel: '𝕏 Twitter',
      error: error?.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// 3. Instagram Profile & Captions
// Actor: apify/instagram-profile-scraper
// ─────────────────────────────────────────────────────────────────
export async function scrapeInstagramWithApify(instagramHandle: string): Promise<ApifyScrapeResult> {
  const cleanHandle = instagramHandle.trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/.*$/, '');

  console.log(`📸 [Enrichment:Apify:Instagram] Scraping profile: @${cleanHandle}`);

  try {
    const items = await runApifyActor(
      'apify~instagram-profile-scraper',
      { usernames: [cleanHandle], resultsLimit: 5 },
      20000 // Instagram scraping needs browser rendering time
    );

    const profile = (items as any[])[0] ?? null;
    if (!profile) {
      console.warn(`⚠️ [Enrichment:Apify:Instagram] No profile data returned for @${cleanHandle}`);
      return {
        platform: 'instagram', success: false,
        title: `@${cleanHandle} on Instagram`, summary: '', posts: [], badgeLabel: '📸 Instagram',
      };
    }

    const bio = profile.biography || '';
    const latestPosts = (profile.latestPosts || []).slice(0, 4).map((p: any) => ({
      text: p.caption || '',
      url: p.url,
      date: p.timestamp,
    }));

    console.log(`✅ [Enrichment:Apify:Instagram] Scraped profile for @${cleanHandle} (Bio: "${bio.slice(0, 60)}...", Posts: ${latestPosts.length})`);

    return {
      platform: 'instagram',
      success: true,
      title: profile.fullName || `@${cleanHandle} on Instagram`,
      summary: bio ? `Bio: ${bio}` : 'Visual interests and personal highlights.',
      posts: latestPosts,
      badgeLabel: '📸 Instagram',
    };
  } catch (error: any) {
    console.error('❌ [Enrichment:Apify:Instagram] Instagram scrape failed:', error?.message);
    return {
      platform: 'instagram', success: false,
      title: `@${cleanHandle} on Instagram`, summary: '', posts: [],
      badgeLabel: '📸 Instagram', error: error?.message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// 4. Facebook Profile / Page Scraper
// Actor: apify/facebook-posts-scraper
// ─────────────────────────────────────────────────────────────────
export async function scrapeFacebookWithApify(facebookUrl: string): Promise<ApifyScrapeResult> {
  const cleanUrl = facebookUrl.trim().split('?')[0] ?? '';
  console.log(`👥 [Enrichment:Apify:Facebook] Scraping Facebook profile: ${cleanUrl}`);

  try {
    const items = await runApifyActor(
      'apify~facebook-posts-scraper',
      { startUrls: [{ url: cleanUrl }], resultsLimit: 3 },
      20000 // Facebook scraping needs browser rendering time
    );

    const posts = (items as any[]).slice(0, 3).map((item: any) => ({
      text: item.text || item.message || '',
      date: item.time,
      url: item.url,
    })).filter((p) => p.text.trim().length > 0);

    const summaryText = posts.slice(0, 2).map((p) => p.text).join(' | ').slice(0, 200);

    console.log(`✅ [Enrichment:Apify:Facebook] Found ${posts.length} posts for ${cleanUrl}`);

    return {
      platform: 'facebook',
      success: posts.length > 0,
      title: 'Facebook Profile',
      summary: summaryText || 'Public updates and community activity.',
      posts,
      badgeLabel: '👥 Facebook',
    };
  } catch (error: any) {
    console.error('❌ [Enrichment:Apify:Facebook] Facebook scrape failed:', error?.message);
    return {
      platform: 'facebook',
      success: false,
      title: 'Facebook Profile',
      summary: '',
      posts: [],
      badgeLabel: '👥 Facebook',
      error: error?.message,
    };
  }
}

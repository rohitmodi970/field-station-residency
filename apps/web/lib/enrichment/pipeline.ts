/**
 * Force V2 — Master Enrichment Pipeline Orchestrator
 * Executes parallel fast-tier queries (Exa, Apify, Firecrawl, GitHub)
 * and pipes disambiguated results into public.user_social_profiles.
 *
 * NOTE: Proxycurl was shut down July 2025 (LinkedIn legal action).
 * LinkedIn enrichment is now handled via Apify (apify/linkedin-profile-scraper).
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 2.1.0
 */

import { searchExaWeb } from './exa-client';
import {
  scrapeLinkedInWithApify,
  scrapeTwitterWithApify,
  scrapeInstagramWithApify,
  scrapeFacebookWithApify,
} from './apify-client';
import { scrapeFirecrawlSite } from './firecrawl-client';
import { fetchGitHubProfile } from './github-client';
import { filterAndDisambiguateDiscoveries } from './disambiguation';

export interface EnrichmentInputPayload {
  userId: string;
  fullName: string;
  location?: string;
  linkedinUrl?: string;
  twitterHandle?: string;
  instagramHandle?: string;
  facebookUrl?: string;
  websiteUrl?: string;
  githubUsername?: string;
}

export interface PipelineDiscoveryItem {
  id: string;
  platform: 'linkedin' | 'twitter' | 'instagram' | 'facebook' | 'github' | 'website' | 'exa_web_search' | 'other';
  title: string;
  summary: string;
  url?: string;
  confidence: number;
  badgeLabel: string;
}

export interface EnrichmentPipelineResult {
  discoveries: PipelineDiscoveryItem[];
  completedCount: number;
  failedCount: number;
  fastTierLatencyMs: number;
}

/**
 * Runs the fast-tier parallel enrichment pipeline (~1.5–3.5s).
 */
export async function runFastTierEnrichment(
  input: EnrichmentInputPayload
): Promise<EnrichmentPipelineResult> {
  const startTime = Date.now();
  const discoveries: PipelineDiscoveryItem[] = [];
  let completedCount = 0;
  let failedCount = 0;

  console.log(`\n⚡ =========================================================================`);
  console.log(`⚡ [Enrichment:Pipeline] Launching Fast-Tier Enrichment for "${input.fullName}" (User: ${input.userId})`);
  console.log(`⚡ [Enrichment:Pipeline] Provided Signals:`, {
    linkedin: input.linkedinUrl || '(none)',
    twitter: input.twitterHandle || '(none)',
    website: input.websiteUrl || '(none)',
    github: input.githubUsername || '(none)',
    location: input.location || '(none)',
  });
  console.log(`⚡ =========================================================================\n`);

  const knownHandles: string[] = [];
  if (input.twitterHandle) knownHandles.push(input.twitterHandle);
  if (input.githubUsername) knownHandles.push(input.githubUsername);

  // Build parallel fast-tier promises
  const tasks: Array<Promise<void>> = [];

  // 1. LinkedIn (via Apify — replaces Proxycurl which was shut down July 2025)
  if (input.linkedinUrl) {
    tasks.push(
      (async () => {
        try {
          const res = await scrapeLinkedInWithApify(input.linkedinUrl!);
          if (res.success && res.data) {
            completedCount++;
            const role = res.data.current_role
              ? `${res.data.current_role}${res.data.current_company ? ` at ${res.data.current_company}` : ''}`
              : res.data.headline;
            discoveries.push({
              id: `linkedin-${Date.now()}`,
              platform: 'linkedin',
              title: res.data.full_name || 'LinkedIn Profile',
              summary: `${role || 'Professional experience'}. Skills: ${(res.data.skills || []).slice(0, 4).join(', ')}`,
              url: input.linkedinUrl,
              confidence: 0.95,
              badgeLabel: '🔗 LinkedIn',
            });
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      })()
    );
  }

  // 2. Personal Website / Portfolio (Firecrawl)
  if (input.websiteUrl) {
    tasks.push(
      (async () => {
        try {
          const res = await scrapeFirecrawlSite(input.websiteUrl!);
          if (res.success && res.markdown) {
            completedCount++;
            const cleanSummary = res.description || res.markdown.slice(0, 180).replace(/[#*`]/g, '').trim();
            discoveries.push({
              id: `website-${Date.now()}`,
              platform: 'website',
              title: res.title || 'Personal Site / Portfolio',
              summary: cleanSummary,
              url: input.websiteUrl,
              confidence: 0.90,
              badgeLabel: '🌐 Personal Site',
            });
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      })()
    );
  }

  // 3. GitHub Developer Profile
  if (input.githubUsername) {
    tasks.push(
      (async () => {
        try {
          const res = await fetchGitHubProfile(input.githubUsername!);
          if (res.success && res.data) {
            completedCount++;
            const topLangs = res.data.top_languages.slice(0, 3).join(', ');
            discoveries.push({
              id: `github-${Date.now()}`,
              platform: 'github',
              title: `@${res.data.username} on GitHub`,
              summary: `${res.data.bio || 'Developer'} (${res.data.public_repos} public repos). Languages: ${topLangs || 'Code'}`,
              url: res.data.public_url,
              confidence: 0.95,
              badgeLabel: '🐱 GitHub',
            });
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      })()
    );
  }

  // 4. Twitter / X Scraping (via Apify)
  if (input.twitterHandle) {
    tasks.push(
      (async () => {
        try {
          const apifyRes = await scrapeTwitterWithApify(input.twitterHandle!);
          if (apifyRes.success && apifyRes.posts.length > 0) {
            completedCount++;
            discoveries.push({
              id: `twitter-${Date.now()}`,
              platform: 'twitter',
              title: apifyRes.title,
              summary: apifyRes.summary,
              url: `https://x.com/${input.twitterHandle!.replace('@', '')}`,
              confidence: 0.92,
              badgeLabel: '𝕏 Twitter',
            });
          }
        } catch (e) {
          console.warn('⚠️ [Enrichment:Pipeline] Apify Twitter skip:', e);
        }
      })()
    );
  }

  // 5. Instagram Scraping (via Apify)
  if (input.instagramHandle) {
    tasks.push(
      (async () => {
        try {
          const igRes = await scrapeInstagramWithApify(input.instagramHandle!);
          if (igRes.success) {
            completedCount++;
            discoveries.push({
              id: `instagram-${Date.now()}`,
              platform: 'instagram',
              title: igRes.title,
              summary: igRes.summary,
              url: `https://instagram.com/${input.instagramHandle!.replace('@', '')}`,
              confidence: 0.90,
              badgeLabel: '📸 Instagram',
            });
          }
        } catch (e) {
          console.warn('⚠️ [Enrichment:Pipeline] Apify Instagram skip:', e);
        }
      })()
    );
  }

  // 6. Facebook Scraping (via Apify)
  if (input.facebookUrl) {
    tasks.push(
      (async () => {
        try {
          const fbRes = await scrapeFacebookWithApify(input.facebookUrl!);
          if (fbRes.success) {
            completedCount++;
            discoveries.push({
              id: `facebook-${Date.now()}`,
              platform: 'facebook',
              title: fbRes.title,
              summary: fbRes.summary,
              url: input.facebookUrl,
              confidence: 0.88,
              badgeLabel: '👥 Facebook',
            });
          }
        } catch (e) {
          console.warn('⚠️ [Enrichment:Pipeline] Apify Facebook skip:', e);
        }
      })()
    );
  }

  // 7. Exa.ai Semantic Web Search (always run if user has a name)
  if (input.fullName && input.fullName.trim().length > 2) {
    const cleanGH = input.githubUsername ? input.githubUsername.replace(/.*github\.com\//i, '').replace(/[\/@]/g, '') : '';
    const cleanTW = input.twitterHandle ? input.twitterHandle.replace(/.*(twitter|x)\.com\//i, '').replace(/[\/@]/g, '') : '';
    const cleanIG = input.instagramHandle ? input.instagramHandle.replace(/.*instagram\.com\//i, '').replace(/[\/@]/g, '') : '';
    const searchQuery = `${input.fullName} ${input.location || ''} ${cleanTW} ${cleanGH} ${cleanIG}`.trim();
    tasks.push(
      (async () => {
        try {
          const exaRes = await searchExaWeb(searchQuery, { numResults: 4, includeHighlights: true });
          if (exaRes.success && exaRes.results.length > 0) {
            completedCount++;
            const disambiguated = filterAndDisambiguateDiscoveries(exaRes.results, {
              fullName: input.fullName,
              knownLocation: input.location,
              knownHandles,
            });

            for (const item of disambiguated.acceptedItems) {
              discoveries.push({
                id: `exa-${Math.random().toString(36).substring(2, 9)}`,
                platform: 'exa_web_search',
                title: item.title,
                summary: item.summary,
                url: item.url,
                confidence: item.confidence,
                badgeLabel: `📝 ${item.source_platform}`,
              });
            }
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      })()
    );
  }

  // Execute all fast-tier tasks in parallel
  await Promise.allSettled(tasks);

  const durationMs = Date.now() - startTime;

  console.log(`\n🏁 =========================================================================`);
  console.log(`🏁 [Enrichment:Pipeline] Fast-Tier Complete in ${durationMs}ms`);
  console.log(`🏁 [Enrichment:Pipeline] Stats: ${completedCount} successful, ${failedCount} failed`);
  console.log(`🏁 [Enrichment:Pipeline] Total Discoveries: ${discoveries.length}`);
  discoveries.forEach((d, i) => {
    console.log(`   ${i + 1}. [${d.badgeLabel}] ${d.title} — "${d.summary.slice(0, 100)}..."`);
  });
  console.log(`🏁 =========================================================================\n`);

  return {
    discoveries,
    completedCount,
    failedCount,
    fastTierLatencyMs: durationMs,
  };
}

/**
 * Force V2 — Identity Disambiguation & Content Safety Guardrail
 * Cross-references discovered internet data against verified user signals (city, company, handle)
 * and strips medical/legal sensitive data before synthesis.
 *
 * @author Rohit (Context & Platform Engineering)
 * @version 2.0.0
 */

import type { ExaSearchResultItem } from './exa-client';

export interface UserDisambiguationProfile {
  fullName: string;
  knownLocation?: string;
  knownCompany?: string;
  knownHandles?: string[];
}

export interface DisambiguatedResult {
  acceptedItems: Array<{
    title: string;
    url: string;
    summary: string;
    source_platform: string;
    confidence: number;
  }>;
  discardedCount: number;
}

// Blocklist for sensitive categories that should NEVER be ingested or reflected
const SENSITIVE_CONTENT_PATTERNS = [
  /\b(arrest|court record|dui|criminal charges|felony|lawsuit against)\b/i,
  /\b(medical diagnosis|psychiatric admission|prescription drugs for|biopsy)\b/i,
];

/**
 * Filters out search results that don't match the user or contain sensitive private content.
 */
export function filterAndDisambiguateDiscoveries(
  rawExaItems: ExaSearchResultItem[],
  userProfile: UserDisambiguationProfile
): DisambiguatedResult {
  const acceptedItems: DisambiguatedResult['acceptedItems'] = [];
  let discardedCount = 0;

  const normalizedName = userProfile.fullName.toLowerCase().trim();
  const nameParts = normalizedName.split(/\s+/).filter((p) => p.length > 1);

  for (const item of rawExaItems) {
    const combinedContent = `${item.title} ${item.summary || ''} ${item.text || ''} ${item.url}`.toLowerCase();

    // 1. Safety check — discard sensitive legal/medical content silently (E8)
    const isSensitive = SENSITIVE_CONTENT_PATTERNS.some((pattern) => pattern.test(combinedContent));
    if (isSensitive) {
      discardedCount++;
      continue;
    }

    // 2. Name check — result must mention at least the user's name parts
    const matchesName = nameParts.every((part) => combinedContent.includes(part));
    if (!matchesName && rawExaItems.length > 2) {
      discardedCount++;
      continue;
    }

    // 3. Confidence scoring
    let confidence = 0.70;

    if (userProfile.knownCompany && combinedContent.includes(userProfile.knownCompany.toLowerCase())) {
      confidence += 0.20;
    }

    if (userProfile.knownLocation && combinedContent.includes(userProfile.knownLocation.toLowerCase())) {
      confidence += 0.10;
    }

    if (userProfile.knownHandles?.some((h) => combinedContent.includes(h.toLowerCase()))) {
      confidence += 0.15;
    }

    // Cap confidence
    confidence = Math.min(0.98, Math.max(0.60, confidence));

    acceptedItems.push({
      title: item.title,
      url: item.url,
      summary: item.summary || item.highlights?.[0] || item.title,
      source_platform: determineSourcePlatform(item.url),
      confidence,
    });
  }

  return {
    acceptedItems,
    discardedCount,
  };
}

function determineSourcePlatform(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host.includes('linkedin.com')) return 'LinkedIn';
    if (host.includes('twitter.com') || host.includes('x.com')) return 'Twitter/X';
    if (host.includes('github.com')) return 'GitHub';
    if (host.includes('substack.com')) return 'Substack';
    if (host.includes('medium.com')) return 'Medium';
    if (host.includes('youtube.com')) return 'YouTube';
    if (host.includes('notion.site') || host.includes('notion.so')) return 'Notion';
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return 'Web Search';
  }
}

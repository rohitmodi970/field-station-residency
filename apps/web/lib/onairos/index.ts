/**
 * Onairos Web SDK Integration & Data Export Utilities
 * Follows official Onairos documentation and llm.txt specifications.
 */

import { getOnairosApiKey, getOnairosHeaders, validateOnairosApiKey, preVerifyOnairosEmail } from './client';
import type { OnairosCompleteData } from 'onairos';

export * from './client';

export interface OnairosInitOptions {
  apiKey?: string;
  environment?: 'production' | 'staging' | 'development';
  enableLogging?: boolean;
  timeout?: number;
  retryAttempts?: number;
}

// ── Onairos Persona Data Model (docs.onairos.io/personas) ──────────────────────
export interface Nudge {
  text: string;
}

export interface TraitDetail {
  score: number;
  emoji?: string;
  evidence?: string;
}

export interface PersonalityTraitsStandard {
  positive_traits: Record<string, number>;
  traits_to_improve: Record<string, number>;
  user_summary: string;
  top_traits_explanation: string;
  archetype: string;
  nudges: Nudge[];
}

export interface PersonalityTraitsEvidence {
  positive_traits: Record<string, TraitDetail>;
  traits_to_improve: Record<string, TraitDetail>;
  user_summary: string;
  top_traits_explanation: string;
  archetype: string;
  nudges: Nudge[];
}

export type PersonalityTraits = PersonalityTraitsStandard | PersonalityTraitsEvidence | Record<string, any>;

export interface PlatformBreakdown {
  [platform: string]: {
    liked?: number;
    disliked?: number;
    [key: string]: any;
  };
}

export interface PersonaMetadata {
  total_items_analyzed?: number;
  items_sampled?: number;
  total_liked?: number;
  total_disliked?: number;
  chunks_processed?: number;
  total_chunks?: number;
  coverage?: string;
  platform_breakdown?: PlatformBreakdown;
  [key: string]: any;
}

export interface PersonaResponse {
  DataAnalysis?: {
    personality_traits?: PersonalityTraits;
    [key: string]: any;
  };
  metadata?: PersonaMetadata;
  [key: string]: any;
}

export interface OnairosExportedData {
  userId?: string;
  source: 'onairos';
  schemaVersion: number;
  capturedAt: string;
  token?: string;
  apiUrl?: string;
  authorizedData?: {
    traits?: boolean;
    personality?: boolean;
    preferences?: boolean;
    rawData?: boolean;
    rawMemories?: boolean;
    llmData?: boolean;
  } | null;
  traits: Record<string, any> | null;
  persona?: PersonaResponse | null;
  archetype?: string | null;
  userSummary?: string | null;
  topTraits?: Array<[string, number | TraitDetail]>;
  traitsToImprove?: Array<[string, number | TraitDetail]>;
  nudges?: Nudge[];
  preferences: Record<string, any> | null;
  profile: Record<string, any> | null;
  rawMemories: any | null;
  connectedSources: string[];
  rawPayload: any;
}

let initPromise: Promise<any> | null = null;
let initializedKey: string | null = null;

/**
 * Initialize Onairos Web SDK with Developer API Key
 *
 * Implements two-tier developer authentication as detailed in llm.txt:
 * Uses developer API key (dev_*, pk_*, ona_* prefixes) to validate permissions,
 * configure environment ('production' | 'staging' | 'development'), and prepare SDK.
 */
export async function initOnairosWebSdk(options?: OnairosInitOptions): Promise<any> {
  if (typeof window === 'undefined') {
    return null;
  }

  const resolvedKey =
    options?.apiKey?.trim() ||
    process.env.NEXT_PUBLIC_ONAIROS_API_KEY?.trim() ||
    process.env.ONAIROS_API_KEY?.trim() ||
    '';

  if (!resolvedKey || resolvedKey === '{Your_API_Key}') {
    throw new Error('Onairos API key is missing or not configured.');
  }

  // If already initialized with this exact key, reuse existing instance
  if (initPromise && initializedKey === resolvedKey) {
    return initPromise;
  }

  const environment = options?.environment || 'production';
  const enableLogging = options?.enableLogging ?? false;
  const timeout = options?.timeout ?? 30000;
  const retryAttempts = options?.retryAttempts ?? 3;

  initializedKey = resolvedKey;
  initPromise = (async () => {
    try {
      const { initializeApiKey } = await import('onairos');
      const res = await initializeApiKey({
        apiKey: resolvedKey,
        environment,
        enableLogging,
        timeout,
        retryAttempts,
      });
      return res;
    } catch (err: any) {
      // Clear cache on failure to allow retry
      initPromise = null;
      initializedKey = null;
      console.warn('⚠️ [Onairos Web SDK] initializeApiKey notice:', err?.message || err);
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Standard Callback & Extraction Function to Export Onairos Data
 *
 * Implements Section 1 of llm.txt:
 * Resolves result.apiResponse (or fallback POST to result.apiUrl with Bearer token),
 * extracts consented traits, preferences, basic profile, and rawMemories,
 * returning a normalized OnairosExportedData object for easy consumption.
 */
export async function exportOnairosData(
  result: OnairosCompleteData | any,
  appUserId?: string
): Promise<OnairosExportedData> {
  if (!result) {
    return {
      userId: appUserId,
      source: 'onairos',
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      traits: null,
      preferences: null,
      profile: null,
      rawMemories: null,
      connectedSources: [],
      rawPayload: null,
    };
  }

  let payload = result.apiResponse;

  // 1. Resolve payload from known SDK v8 structures if apiResponse is empty
  if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
    if (result.userData?.aiData && typeof result.userData.aiData === 'object') {
      payload = result.userData.aiData;
    } else if (result.userDataSummary?.aiData && typeof result.userDataSummary.aiData === 'object') {
      payload = result.userDataSummary.aiData;
    } else if (result.personality && typeof result.personality === 'object') {
      payload = result;
    }
  }

  // 2. Fallback fetch to apiUrl if payload is still missing (per llm.txt Section 1)
  if ((!payload || Object.keys(payload).length === 0) && result.apiUrl && result.token) {
    try {
      const response = await fetch(result.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${result.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: result.token || result.accessToken || '',
          token: result.token || result.accessToken || '',
        }),
      });
      if (response.ok) {
        payload = await response.json();
      } else {
        console.warn(`[Onairos] Direct apiUrl fetch failed with status ${response.status}`);
      }
    } catch (fetchErr) {
      console.warn('[Onairos] Error during fallback apiUrl fetch:', fetchErr);
    }
  }

  const p = payload || {};

  // Extract personality / traits
  const traits =
    p.traits ??
    p.personality ??
    p.DataAnalysis?.personality_traits ??
    p.data?.personality ??
    result.userData?.personality ??
    result.userDataSummary?.aiData?.personality ??
    null;

  // Extract Persona Data Model (docs.onairos.io/personas)
  const personaTraits: any =
    p.DataAnalysis?.personality_traits ??
    p.personality_traits ??
    (p.positive_traits || p.archetype ? p : null);

  const archetype: string | null =
    personaTraits?.archetype ||
    p.archetype ||
    p.userProfile?.archetype ||
    null;

  const userSummary: string | null =
    personaTraits?.user_summary ||
    p.user_summary ||
    p.userProfile?.user_summary ||
    null;

  const nudges: Nudge[] = Array.isArray(personaTraits?.nudges)
    ? personaTraits.nudges
    : Array.isArray(p.nudges)
    ? p.nudges
    : Array.isArray(p.userProfile?.nudges)
    ? p.userProfile.nudges
    : [];

  const positiveTraitsObj: Record<string, number | TraitDetail> | null =
    personaTraits?.positive_traits || p.positive_traits || null;
  const topTraits: Array<[string, number | TraitDetail]> =
    positiveTraitsObj && typeof positiveTraitsObj === 'object'
      ? (Object.entries(positiveTraitsObj) as Array<[string, number | TraitDetail]>).sort(([, a], [, b]) => {
          const scoreA = typeof a === 'number' ? a : (a as TraitDetail)?.score ?? 0;
          const scoreB = typeof b === 'number' ? b : (b as TraitDetail)?.score ?? 0;
          return scoreB - scoreA;
        })
      : [];

  const traitsToImproveObj: Record<string, number | TraitDetail> | null =
    personaTraits?.traits_to_improve || p.traits_to_improve || null;
  const traitsToImprove: Array<[string, number | TraitDetail]> =
    traitsToImproveObj && typeof traitsToImproveObj === 'object'
      ? (Object.entries(traitsToImproveObj) as Array<[string, number | TraitDetail]>)
      : [];

  // Extract preferences
  const preferences = p.preferences ?? p.data?.preferences ?? null;

  // Extract basic profile
  const profile = p.userProfile ?? p.data?.basic ?? result.userData?.basic ?? null;

  // Extract raw memories / LLM data
  const rawMemories = p.rawMemories ?? p.data?.rawMemories ?? p.llmData ?? null;

  // Extract connected sources
  const connectedSources: string[] =
    (Array.isArray(result.connectedSources) && result.connectedSources.length > 0
      ? result.connectedSources
      : null) ||
    (Array.isArray(result.userData?.connectedAccounts) && result.userData.connectedAccounts.length > 0
      ? result.userData.connectedAccounts
      : null) ||
    (Array.isArray(result.userDataSummary?.connectedAccounts) && result.userDataSummary.connectedAccounts.length > 0
      ? result.userDataSummary.connectedAccounts
      : null) ||
    (Array.isArray(p.source_platforms) && p.source_platforms.length > 0
      ? p.source_platforms
      : null) ||
    [];

  return {
    userId: appUserId,
    source: 'onairos',
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    token: result.token,
    apiUrl: result.apiUrl,
    authorizedData: result.authorizedData ?? null,
    traits: traits && typeof traits === 'object' ? traits : null,
    persona: p.DataAnalysis ? p : { DataAnalysis: { personality_traits: personaTraits || traits } },
    archetype,
    userSummary,
    topTraits,
    traitsToImprove,
    nudges,
    preferences: preferences && typeof preferences === 'object' ? preferences : null,
    profile: profile && typeof profile === 'object' ? profile : null,
    rawMemories,
    connectedSources,
    rawPayload: p,
  };
}

/**
 * Handle Onairos Complete Event & Persist/Export
 *
 * Combines exportOnairosData with ingestion to the Force onboarding API
 * (/api/onboarding/v2/onairos) so that personality, interests, and connected
 * platforms are immediately seeded into user_context_model.
 */
export async function handleOnairosComplete(
  result: OnairosCompleteData | any,
  appUserId?: string
): Promise<{ exported: OnairosExportedData; backendResult?: any }> {
  const exported = await exportOnairosData(result, appUserId);

  let backendResult: any = null;
  try {
    const res = await fetch('/api/onboarding/v2/onairos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: exported.token || 'onairos-token-' + Date.now(),
        approved: result.approved || result.approvedData || ['preferences', 'personality'],
        apiResponse: {
          ...(exported.traits ? { personality: exported.traits } : {}),
          ...(exported.archetype ? { archetype: exported.archetype } : {}),
          ...(exported.userSummary ? { user_summary: exported.userSummary } : {}),
          ...(exported.nudges && exported.nudges.length > 0 ? { nudges: exported.nudges } : {}),
          ...(exported.topTraits && exported.topTraits.length > 0 ? { positive_traits: Object.fromEntries(exported.topTraits) } : {}),
          ...(exported.preferences ? { preferences: exported.preferences } : {}),
          ...(Array.isArray(exported.rawPayload?.interests) ? { interests: exported.rawPayload.interests } : {}),
          ...(Array.isArray(exported.rawPayload?.sentiment) ? { sentiment: exported.rawPayload.sentiment } : {}),
          source_platforms: exported.connectedSources,
          _raw_exported: exported,
        },
      }),
    });

    if (res.ok) {
      backendResult = await res.json();
    }
  } catch (err) {
    console.warn('⚠️ [Onairos] Ingestion to /api/onboarding/v2/onairos failed:', err);
  }

  return { exported, backendResult };
}

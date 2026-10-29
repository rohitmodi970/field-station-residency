import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type {
  BigFiveTraits,
  PersonalityAssessment,
  ExplicitFact,
  AgentInference,
  OnairosIngestPayload,
} from '@/types/context-schemas';

/**
 * Prompt-Injection Defense & String Sanitizer
 * Strips known injection phrases, control tags, and excessive length.
 */
function sanitizeUntrustedString(input: unknown, maxLength = 160): string {
  if (typeof input !== 'string') return '';
  let cleaned = input
    .replace(/[<>]/g, '') // strip HTML/XML tags
    .replace(/ignore\s+(all\s+)?(previous|prior)\s+instructions/gi, '')
    .replace(/system\s*:\s*/gi, '')
    .replace(/\[\s*system\s*\]/gi, '')
    .replace(/assistant\s*:\s*/gi, '')
    .replace(/you\s+are\s+now\s+/gi, '')
    .replace(/override\s+rules/gi, '')
    .trim();

  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }
  return cleaned;
}

function clampUnitFloat(val: unknown, fallback = 0.5): number {
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return fallback;
  return Math.max(0.0, Math.min(1.0, Math.round(num * 100) / 100));
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    const isPublicTest = !user;
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';

    if (isPublicTest) {
      console.log('ℹ️ [API:OnboardingV2:Onairos] [TEMPORARY] Public testing request without user session');
    } else {
      console.log(`🌐 [API:OnboardingV2:Onairos] Processing Onairos persona ingest for user: ${userId}`);
    }

    const body: OnairosIngestPayload = await req.json();
    const { token, approved = [], apiResponse = {} } = body;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 [Onairos:Ingest] Raw Data Received from Onairos:');
    console.log('  • Scoped Token:', token ? `${String(token).slice(0, 24)}... (length: ${String(token).length})` : 'none');
    console.log('  • Approved Scopes:', approved);
    console.log('  • Raw Payload:', JSON.stringify(apiResponse, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const rawPersonality: any = apiResponse.personality || null;
    const rawInterests = Array.isArray(apiResponse.interests) ? apiResponse.interests : [];
    const rawPlatforms = Array.isArray(apiResponse.source_platforms)
      ? apiResponse.source_platforms
      : [];

    // Parse sentiment signals (either array of {topic, sentiment} or record)
    const sentimentSignals: Array<{ topic: string; sentiment: number }> = [];
    if (Array.isArray(apiResponse.sentiment)) {
      for (const item of apiResponse.sentiment) {
        if (item && typeof item.topic === 'string') {
          sentimentSignals.push({
            topic: sanitizeUntrustedString(item.topic, 50),
            sentiment: clampUnitFloat(item.sentiment),
          });
        }
      }
    } else if (apiResponse.sentiment && typeof apiResponse.sentiment === 'object') {
      for (const [topic, score] of Object.entries(apiResponse.sentiment)) {
        sentimentSignals.push({
          topic: sanitizeUntrustedString(topic, 50),
          sentiment: clampUnitFloat(score),
        });
      }
    }

    // 1. Extract Persona Data Model (docs.onairos.io/personas)
    const rawArchetype =
      typeof apiResponse.archetype === 'string'
        ? sanitizeUntrustedString(apiResponse.archetype, 60)
        : typeof rawPersonality?.archetype === 'string'
        ? sanitizeUntrustedString(rawPersonality.archetype, 60)
        : null;

    const rawUserSummary =
      typeof apiResponse.user_summary === 'string'
        ? sanitizeUntrustedString(apiResponse.user_summary, 600)
        : typeof rawPersonality?.user_summary === 'string'
        ? sanitizeUntrustedString(rawPersonality.user_summary, 600)
        : null;

    const rawPositiveTraits =
      apiResponse.positive_traits ||
      rawPersonality?.positive_traits ||
      null;

    const rawTraitsToImprove =
      apiResponse.traits_to_improve ||
      rawPersonality?.traits_to_improve ||
      null;

    const rawNudges: Array<{ text: string }> = Array.isArray(apiResponse.nudges)
      ? apiResponse.nudges
      : Array.isArray(rawPersonality?.nudges)
      ? rawPersonality.nudges
      : [];

    // 2. Strict Raw Mode: Only compute Big Five traits if Onairos actually provided numeric traits
    const hasRawPersonality =
      rawPersonality &&
      typeof rawPersonality === 'object' &&
      Object.keys(rawPersonality).length > 0 &&
      (rawPersonality.openness !== undefined ||
        rawPersonality.conscientiousness !== undefined ||
        rawPersonality.extraversion !== undefined ||
        rawPersonality.agreeableness !== undefined ||
        rawPersonality.neuroticism !== undefined);

    const bigFive: BigFiveTraits | null = hasRawPersonality
      ? {
          openness: clampUnitFloat(rawPersonality.openness, 0.5),
          conscientiousness: clampUnitFloat(rawPersonality.conscientiousness, 0.5),
          extraversion: clampUnitFloat(rawPersonality.extraversion, 0.5),
          agreeableness: clampUnitFloat(rawPersonality.agreeableness, 0.5),
          neuroticism: clampUnitFloat(rawPersonality.neuroticism, 0.5),
        }
      : null;

    const sourcePlatforms = rawPlatforms.map((p) => sanitizeUntrustedString(p, 30)).filter(Boolean);

    // 3. Build PersonalityAssessment (supports both Big Five and Onairos Persona Data Model)
    const hasAnyPersonality = Boolean(bigFive || rawArchetype || rawUserSummary || rawPositiveTraits);
    const personalityAssessment: PersonalityAssessment | null = hasAnyPersonality
      ? {
          big_five: bigFive || undefined,
          cognitive_style: bigFive
            ? bigFive.openness >= 0.70
              ? 'intuitive'
              : 'systematic'
            : 'analytical',
          communication_preference: bigFive
            ? bigFive.openness >= 0.60
              ? 'exploratory'
              : 'direct_concise'
            : 'exploratory',
          core_values: rawArchetype ? [rawArchetype] : [],
          synthesis_summary:
            rawUserSummary ||
            `Inferred via Onairos cross-platform signals (${sourcePlatforms.join(', ') || 'connected platforms'}).`,
          source: 'onairos',
          confidence: 0.85,
          sentiment_signals: sentimentSignals,
          raw_traits: {
            raw_personality: rawPersonality,
            archetype: rawArchetype,
            user_summary: rawUserSummary,
            positive_traits: rawPositiveTraits,
            traits_to_improve: rawTraitsToImprove,
            nudges: rawNudges,
            platforms: sourcePlatforms,
          },
        }
      : null;

    // 3. Fetch existing user context model (if authenticated)
    let existingModel: any = null;
    if (user?.id) {
      const { data } = await supabase
        .from('user_context_model')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      existingModel = data;
    }

    const existingFacts: ExplicitFact[] = Array.isArray(existingModel?.explicit_facts)
      ? existingModel.explicit_facts
      : [];
    const existingInferences: AgentInference[] = Array.isArray(existingModel?.agent_inferences)
      ? existingModel.agent_inferences
      : [];
    const existingConsents = existingModel?.external_data_consents || {};

    // 4. Map interest tags to explicit facts (untrusted / inferred signal)
    const newFacts: ExplicitFact[] = [];
    const cleanInterests = rawInterests
      .map((i) => sanitizeUntrustedString(i, 60))
      .filter((i) => i.length > 1);

    for (let idx = 0; idx < cleanInterests.length; idx++) {
      const interest = cleanInterests[idx]!;
      // Avoid duplicate facts
      if (!existingFacts.some((f) => f.fact.toLowerCase().includes(interest.toLowerCase()))) {
        newFacts.push({
          id: `fact-onairos-${Date.now()}-${idx}`,
          fact: `User shows interest in ${interest}`,
          category: 'interest',
          source: 'onairos_import',
          source_label: `Onairos (${sourcePlatforms.join(', ') || 'Connected Platforms'})`,
          verified_by_user: false,
          confidence: 0.80,
          created_at: new Date().toISOString(),
        });
      }
    }

    // 4b. Map Onairos positive traits to facts / strengths
    if (rawPositiveTraits && typeof rawPositiveTraits === 'object') {
      let traitIdx = 0;
      for (const [traitName, traitVal] of Object.entries(rawPositiveTraits)) {
        const cleanName = sanitizeUntrustedString(traitName, 60);
        const score = typeof traitVal === 'number' ? traitVal : (traitVal as any)?.score ?? 85;
        if (cleanName && !existingFacts.some((f) => f.fact.toLowerCase().includes(cleanName.toLowerCase()))) {
          newFacts.push({
            id: `fact-onairos-trait-${Date.now()}-${traitIdx++}`,
            fact: `Exhibits high ${cleanName} (score: ${score}/100)`,
            category: 'identity',
            source: 'onairos_import',
            source_label: `Onairos (${rawArchetype || 'Persona Analysis'})`,
            verified_by_user: false,
            confidence: Math.min(1.0, score / 100),
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    // 5. Map sentiment signals to agent hypotheses / inferences
    const newInferences: AgentInference[] = [];
    for (let idx = 0; idx < sentimentSignals.length; idx++) {
      const sig = sentimentSignals[idx]!;
      const toneDescriptor =
        sig.sentiment < 0.35
          ? 'unresolved tension or stress'
          : sig.sentiment > 0.65
          ? 'positive affinity and high resonance'
          : 'neutral engagement';

      newInferences.push({
        id: `inference-onairos-${Date.now()}-${idx}`,
        inference: `User may experience ${toneDescriptor} regarding "${sig.topic}"`,
        premise: `Onairos cross-platform sentiment score of ${sig.sentiment} for ${sig.topic}`,
        confidence: 0.65,
        is_confirmed: null,
        created_at: new Date().toISOString(),
      });
    }

    // 5b. Map Onairos nudges to agent hypotheses / actionable interventions
    for (let idx = 0; idx < rawNudges.length; idx++) {
      const nudge = rawNudges[idx];
      if (nudge && typeof nudge.text === 'string') {
        const cleanNudge = sanitizeUntrustedString(nudge.text, 200);
        if (cleanNudge) {
          newInferences.push({
            id: `inference-onairos-nudge-${Date.now()}-${idx}`,
            inference: cleanNudge,
            premise: `Onairos behavioral nudge for ${rawArchetype || 'aligned focus'}`,
            confidence: 0.85,
            is_confirmed: null,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    const mergedFacts = [...existingFacts, ...newFacts];
    const mergedInferences = [...existingInferences, ...newInferences];

    const updatedConsents = {
      ...existingConsents,
      onairos: {
        platform: 'onairos',
        consented: true,
        consented_at: new Date().toISOString(),
        approved_scopes: approved.length > 0 ? approved : ['personality', 'sentiment', 'interests'],
      },
    };

    // 6. Persist to public.user_context_model if user is authenticated
    const nowIso = new Date().toISOString();
    const tokenExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    if (!isPublicTest && user) {
      const { error: upsertError } = await supabase
        .from('user_context_model')
        .upsert(
          {
            user_id: user.id,
            personality_assessment: personalityAssessment,
            explicit_facts: mergedFacts,
            agent_inferences: mergedInferences,
            external_data_consents: updatedConsents,
            onairos_jwt: token ? String(token).slice(0, 512) : null,
            onairos_connected_at: nowIso,
            onairos_token_expires_at: tokenExpiresAt,
            onairos_payload: {
              personality: bigFive,
              interests: cleanInterests,
              sentiment: sentimentSignals,
              platforms: sourcePlatforms,
              _raw_onairos_payload: apiResponse, // Full unadulterated payload
              ingested_at: nowIso,
            },
            updated_at: nowIso,
          },
          { onConflict: 'user_id' }
        );

      if (upsertError) {
        console.error('❌ [API:OnboardingV2:Onairos] Upsert error:', upsertError);
        return NextResponse.json({ error: 'Failed to save Onairos context' }, { status: 500 });
      }

      // 7. Seed user_social_profiles so Step 4 Discovery Feed populates immediately
      for (const platform of sourcePlatforms) {
        const normalizedPlatform = platform.toLowerCase();
        const validPlatform = ['linkedin', 'twitter', 'instagram', 'facebook', 'github', 'website'].includes(normalizedPlatform)
          ? normalizedPlatform
          : 'other';

        await supabase
          .from('user_social_profiles')
          .upsert(
            {
              user_id: user.id,
              platform: validPlatform,
              consent_given: true,
              consent_given_at: nowIso,
              fetch_status: 'completed',
              extracted_insights: {
                summary: `Connected via Onairos with ${cleanInterests.length} interest archetypes identified.`,
                topics: cleanInterests.slice(0, 5),
              },
              retry_count: 0,
              updated_at: nowIso,
            },
            { onConflict: 'user_id,platform' }
          )
          .select('id')
          .maybeSingle();
      }
    }

    console.log(
      `✅ [API:OnboardingV2:Onairos] Processed ${newFacts.length} facts, ${newInferences.length} inferences, and Big Five:`, bigFive
    );
    console.log('🧬 [Onairos:Ingest] Extracted Persona Breakdown:');
    console.log('  • Big Five Psychometrics:', bigFive);
    console.log('  • Interest Archetypes:', cleanInterests);
    console.log('  • Sentiment & Tensions:', sentimentSignals);
    console.log('  • Source Platforms:', sourcePlatforms);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Format instant discovery items for the client (strictly real interests only)
    const discoveries = cleanInterests.slice(0, 6).map((interest, idx) => ({
      id: `onairos-${idx}`,
      platform: 'onairos',
      source_label: `Onairos (${sourcePlatforms[idx % sourcePlatforms.length] || 'Cross-Platform'})`,
      badge_icon: '🌐',
      title: interest,
      summary: `Inferred behavioral archetype connected to ${interest}`,
      confidence: 0.85,
    }));

    // Combine interest discoveries and positive trait discoveries
    const traitDiscoveries =
      rawPositiveTraits && typeof rawPositiveTraits === 'object'
        ? Object.entries(rawPositiveTraits).slice(0, 4).map(([trait, val], idx) => {
            const score = typeof val === 'number' ? val : (val as any)?.score ?? 85;
            return {
              id: `onairos-trait-${idx}`,
              platform: 'onairos',
              source_label: `Onairos (${rawArchetype || 'Strength'})`,
              badge_icon: '✨',
              title: sanitizeUntrustedString(trait, 50),
              summary: `High behavioral resonance score of ${score}/100`,
              confidence: Math.min(1.0, score / 100),
            };
          })
        : [];

    return NextResponse.json({
      success: true,
      is_public_test: isPublicTest,
      has_personality: Boolean(bigFive || rawArchetype || rawPositiveTraits),
      archetype: rawArchetype,
      user_summary: rawUserSummary,
      positive_traits: rawPositiveTraits,
      traits_to_improve: rawTraitsToImprove,
      nudges: rawNudges,
      big_five: bigFive, // Strict raw mode: null if Onairos returned null
      seeded_facts_count: newFacts.length,
      seeded_inferences_count: newInferences.length,
      recommended_skip_questions:
        cleanInterests.length > 0 || rawPositiveTraits ? ['q1_current_state', 'q2_values'] : [],
      discoveries: [...traitDiscoveries, ...discoveries],
      raw_payload: apiResponse, // Exact raw un-modified response from Onairos
    });
  } catch (err: any) {
    console.error('❌ [API:OnboardingV2:Onairos] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error processing Onairos data' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('ℹ️ [API:OnboardingV2:Onairos:DELETE] Public test mode reset');
      return NextResponse.json({ success: true, is_public_test: true, message: 'Reset test state' });
    }

    console.log(`🗑️ [API:OnboardingV2:Onairos:DELETE] Resetting Onairos connection for user: ${user.id}`);

    const { data: existingModel } = await supabase
      .from('user_context_model')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingModel) {
      const remainingFacts = Array.isArray(existingModel.explicit_facts)
        ? existingModel.explicit_facts.filter((f: any) => f.source !== 'onairos_import')
        : [];
      const remainingInferences = Array.isArray(existingModel.agent_inferences)
        ? existingModel.agent_inferences.filter((inf: any) => !inf.id?.startsWith('inference-onairos-'))
        : [];
      const consents = { ...(existingModel.external_data_consents || {}) };
      delete consents.onairos;

      const updatedAssessment =
        existingModel.personality_assessment?.source === 'onairos'
          ? null
          : existingModel.personality_assessment;

      await supabase
        .from('user_context_model')
        .update({
          onairos_connected_at: null,
          onairos_jwt: null,
          onairos_payload: null,
          onairos_token_expires_at: null,
          personality_assessment: updatedAssessment,
          explicit_facts: remainingFacts,
          agent_inferences: remainingInferences,
          external_data_consents: consents,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Onairos data disconnected and context reset successfully',
    });
  } catch (err: any) {
    console.error('❌ [API:OnboardingV2:Onairos:DELETE] Error:', err);
    return NextResponse.json({ error: 'Failed to reset Onairos context' }, { status: 500 });
  }
}


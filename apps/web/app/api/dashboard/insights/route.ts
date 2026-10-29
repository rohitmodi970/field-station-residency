import { NextRequest, NextResponse } from "next/server";
import { createClient, getAuthenticatedUser } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { executeLLMRequest } from "@/lib/llm/llmService";
import { deriveKeyFromPassword, decryptText, base64ToUint8Array, importMasterKey } from '@/utils/encryption/crypto';
import { resolveJournalContent } from '@/utilities/journalTitle';
import type {
  DashboardInsights,
  MentalWeatherPattern,
  MindEnergyState,
  RhythmPattern,
  WellnessPriority,
} from "@/lib/dashboard/insights";

const MAX_RECENT_ENTRIES = 15;
const LAST_ENTRY_MAX_CHARS = 1200;
const SNIPPET_MAX_CHARS = 220;
const INSIGHTS_CACHE_VERSION = 3;

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizePattern(value: string | undefined): MentalWeatherPattern {
  const allowed: MentalWeatherPattern[] = ["stormy", "shifting", "calm", "clearing", "bright"];
  if (value && allowed.includes(value as MentalWeatherPattern)) {
    return value as MentalWeatherPattern;
  }
  return "calm";
}

function normalizeEnergyState(value: string | undefined): MindEnergyState | null {
  const allowed: MindEnergyState[] = ["low", "recovering", "steady", "flowing", "peak"];
  if (value && allowed.includes(value as MindEnergyState)) {
    return value as MindEnergyState;
  }
  return null;
}

function normalizeRhythm(value: string | undefined): RhythmPattern {
  const allowed: RhythmPattern[] = ["morning", "midday", "evening", "night"];
  if (value && allowed.includes(value as RhythmPattern)) {
    return value as RhythmPattern;
  }
  return "midday";
}

function normalizePriority(value: string | undefined): WellnessPriority {
  const allowed: WellnessPriority[] = ["emotional", "mental", "physical"];
  if (value && allowed.includes(value as WellnessPriority)) {
    return value as WellnessPriority;
  }
  return "emotional";
}

function inferEnergyState(level: number): MindEnergyState {
  if (level < 40) return "low";
  if (level < 55) return "recovering";
  if (level < 70) return "steady";
  if (level < 82) return "flowing";
  return "peak";
}

function derivePriority(emotional: number, mental: number, physical: number): WellnessPriority {
  const minValue = Math.min(emotional, mental, physical);
  if (minValue === emotional) return "emotional";
  if (minValue === mental) return "mental";
  return "physical";
}

function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function parseFreeformLLM(text: string): any | null {
  if (!text || typeof text !== 'string') return null;
  const out: any = {};

  // helper to capture multi-line blocks after a label like "Analysis:" or "Forecast:"
  const captureBlock = (label: string) => {
    const re = new RegExp(label + "[:\\*\\s]*([\\s\\S]{1,400}?)(?:\\n\\s*\\n|$)", "i");
    const m = text.match(re);
    return m && m[1] ? String(m[1]).trim() : null;
  };

  // Mental weather
  const patternMatch = text.match(/pattern[:\*\s]*\*?\*?\s*([a-zA-Z]+)/i);
    if (patternMatch && patternMatch[1]) {
      out.mentalWeather = out.mentalWeather || {};
      out.mentalWeather.pattern = patternMatch[1].trim().toLowerCase();
  }

  const intensityMatch = text.match(/intensity[:\*\s]*([0-9]{1,3})/i) || text.match(/([0-9]{1,3})\/?100\b/i);
  if (intensityMatch) {
    out.mentalWeather = out.mentalWeather || {};
    out.mentalWeather.intensity = Number(intensityMatch[1]);
  }

  const forecastBlock = captureBlock("forecast") || (() => {
    const m = text.match(/forecast[:\*\s]*([^\n\r]+)/i);
    return m && m[1] ? m[1].trim() : null;
  })();
    if (forecastBlock) {
      out.mentalWeather = out.mentalWeather || {};
      out.mentalWeather.forecast = forecastBlock;
  }

  const analysisBlock = captureBlock("analysis") || (() => {
    const m = text.match(/analysis[:\*\s]*([^\n\r]+)/i);
    return m && m[1] ? m[1].trim() : null;
  })();
    if (analysisBlock) {
      out.mentalWeather = out.mentalWeather || {};
      out.mentalWeather.analysis = analysisBlock;
  }

  // Mind energy
  const levelMatch = text.match(/level[:\*\s]*([0-9]{1,3})/i);
  if (levelMatch) {
    out.mindEnergy = out.mindEnergy || {};
    out.mindEnergy.level = Number(levelMatch[1]);
  }

  const stateMatch = text.match(/state[:\*\s]*([a-zA-Z]+)/i);
  if (stateMatch && stateMatch[1]) {
    out.mindEnergy = out.mindEnergy || {};
    out.mindEnergy.state = stateMatch[1].trim().toLowerCase();
  }

  // Wellness balance (simple numeric captures)
  const emoMatch = text.match(/emotional[:\*\s]*([0-9]{1,3})/i);
  const mentMatch = text.match(/mental[:\*\s]*([0-9]{1,3})/i);
  const physMatch = text.match(/physical[:\*\s]*([0-9]{1,3})/i);
  if (emoMatch || mentMatch || physMatch) {
    out.wellnessBalance = out.wellnessBalance || {};
  }
  if (emoMatch) out.wellnessBalance.emotional = Number(emoMatch[1]);
  if (mentMatch) out.wellnessBalance.mental = Number(mentMatch[1]);
  if (physMatch) out.wellnessBalance.physical = Number(physMatch[1]);

  // Rhythm
  const rhythmMatch = text.match(/(energy pattern|pattern)[:\*\s]*(morning|midday|evening|night)/i);
  if (rhythmMatch && rhythmMatch[2]) {
    out.rhythm = out.rhythm || {};
    out.rhythm.energyPattern = rhythmMatch[2].toLowerCase();
  }

  if (Object.keys(out).length > 0) return out;
  return null;
}

function buildFallbackInsights(
  isNewUser: boolean,
  sourceEntryId: string | null,
  sourceEntryCount: number,
  sourceEntryDate: string | null,
  sourceContext: "entry" | "onboarding" | "fallback"
): DashboardInsights {
  const forecast = isNewUser
    ? "Your space is just opening. Start with one honest line about how today feels."
    : "A steadier day. Use this moment to name what matters most.";

  return {
    version: INSIGHTS_CACHE_VERSION,
    generatedAt: new Date().toISOString(),
    source: "fallback",
    sourceEntryId,
    sourceEntryCount,
    sourceEntryDate,
    sourceContext,
    mentalWeather: {
      pattern: "calm",
      intensity: 58,
      forecast,
      analysis: "Your recent notes feel steady and low-intensity — a gentle moment to notice what's working and give yourself permission to rest or reflect.",
    },
    mindEnergy: {
      level: 58,
      state: "steady",
      message: "You're grounded. This is a good moment to do something meaningful.",
      hint: "Set intention, write clearly, move slowly.",
    },
    wellnessBalance: {
      emotional: 62,
      mental: 58,
      physical: 60,
      priority: "emotional",
      message: "We will learn your rhythm as you write. Start with one small check-in.",
    },
    rhythm: {
      energyPattern: "midday",
      label: "Peak at midday",
      insight: "Your energy rises through the morning. Use lunch time to shift gears.",
      times: ["11am-1pm: Decision time", "Social moment available", "Movement helps"],
    },
  };
}

function normalizeInsights(
  raw: any,
  fallback: DashboardInsights,
  sourceEntryId: string | null,
  sourceEntryCount: number,
  sourceEntryDate: string | null,
  sourceContext: "entry" | "onboarding" | "fallback"
): DashboardInsights {
  const mentalWeather = raw?.mentalWeather ?? {};
  const mindEnergy = raw?.mindEnergy ?? {};
  const wellnessBalance = raw?.wellnessBalance ?? {};
  const rhythm = raw?.rhythm ?? {};

  const energyLevel = clampNumber(Number(mindEnergy.level), 35, 95);
  const emotional = clampNumber(Number(wellnessBalance.emotional), 35, 95);
  const mental = clampNumber(Number(wellnessBalance.mental), 35, 95);
  const physical = clampNumber(Number(wellnessBalance.physical), 35, 95);

  return {
    version: INSIGHTS_CACHE_VERSION,
    generatedAt: new Date().toISOString(),
    source: "llm",
    sourceEntryId,
    sourceEntryCount,
    sourceEntryDate,
    sourceContext,
    mentalWeather: {
      pattern: normalizePattern(mentalWeather.pattern) || fallback.mentalWeather.pattern,
      intensity: clampNumber(Number(mentalWeather.intensity), 35, 95),
      forecast: typeof mentalWeather.forecast === "string" && mentalWeather.forecast.trim().length > 0
        ? mentalWeather.forecast.trim()
        : fallback.mentalWeather.forecast,
      analysis: typeof mentalWeather.analysis === "string" && mentalWeather.analysis.trim().length > 0
        ? mentalWeather.analysis.trim()
        : (fallback.mentalWeather.analysis || ""),
    },
    mindEnergy: {
      level: energyLevel,
      state: normalizeEnergyState(mindEnergy.state) || inferEnergyState(energyLevel),
      message: typeof mindEnergy.message === "string" && mindEnergy.message.trim().length > 0
        ? mindEnergy.message.trim()
        : fallback.mindEnergy.message,
      hint: typeof mindEnergy.hint === "string" && mindEnergy.hint.trim().length > 0
        ? mindEnergy.hint.trim()
        : fallback.mindEnergy.hint,
    },
    wellnessBalance: {
      emotional,
      mental,
      physical,
      priority: normalizePriority(wellnessBalance.priority) || derivePriority(emotional, mental, physical),
      message: typeof wellnessBalance.message === "string" && wellnessBalance.message.trim().length > 0
        ? wellnessBalance.message.trim()
        : fallback.wellnessBalance.message,
    },
    rhythm: {
      energyPattern: normalizeRhythm(rhythm.energyPattern),
      label: typeof rhythm.label === "string" && rhythm.label.trim().length > 0
        ? rhythm.label.trim()
        : fallback.rhythm.label,
      insight: typeof rhythm.insight === "string" && rhythm.insight.trim().length > 0
        ? rhythm.insight.trim()
        : fallback.rhythm.insight,
      times: Array.isArray(rhythm.times) && rhythm.times.length >= 3
        ? rhythm.times.slice(0, 3).map((item: string) => String(item))
        : fallback.rhythm.times,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthenticatedUser(request);
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;

    const adminClient = createAdminClient();

    const { data: journals, error: journalsError } = await adminClient
      .from("journals")
      .select("id, content, content_encrypted, content_iv, voice_transcript_encrypted, voice_transcript_iv, is_encrypted, mood, tags, date, created_at")
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .order("date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(MAX_RECENT_ENTRIES);

    if (journalsError) {
      return NextResponse.json({ error: journalsError.message }, { status: 500 });
    }

    const entries = (journals || []).map((entry) => ({
      ...entry,
      effectiveDate: entry.date || entry.created_at,
    }));
    const hasEntries = entries.length > 0;
    const sourceEntryCount = entries.length;
    const sourceEntryDate = entries[0]?.effectiveDate ?? null;
    const sourceEntryId = entries[0]?.id ?? null;
    let sourceContext: "entry" | "onboarding" | "fallback" = hasEntries ? "entry" : "fallback";

    const { data: cached } = await adminClient
      .from("dashboard_insights_cache")
      .select("insights_json, last_entry_id, source_entry_count, source_entry_date, source_context")
      .eq("user_id", user.id)
      .maybeSingle();

    const forceRegen = request.nextUrl?.searchParams?.get?.('force') === '1';

    // If we have a cached fallback but the user has many entries, prefer re-generating
    // so the LLM output reflects real data instead of a persistent fallback.
    let effectiveForceRegen = Boolean(forceRegen);

    const cacheMatchesEntry = cached
      && (cached.last_entry_id || null) === (sourceEntryId || null)
      && Number((cached.insights_json as any)?.version ?? 0) === INSIGHTS_CACHE_VERSION;
    // If cached insights exist but are a fallback and the user has many entries,
    // force a regen so the LLM can generate a meaningful analysis.
    try {
      const cachedSource = (cached?.insights_json as any)?.source;
      if (cachedSource === 'fallback' && sourceEntryCount >= 10) {
        console.log('[dashboard/insights] cached source is fallback and entry count >= 10 — forcing regen');
        effectiveForceRegen = true;
      }
    } catch {}

    if (!effectiveForceRegen && cacheMatchesEntry && cached?.insights_json) {
      return NextResponse.json(cached.insights_json, { status: 200 });
    }

    let onboardingContext = "";
    if (!hasEntries) {
      const { data: onboarding } = await adminClient
        .from("user_onboarding_results")
        .select("onboarding_context")
        .eq("user_id", user.id)
        .maybeSingle();
      onboardingContext = (onboarding?.onboarding_context || "").trim();
      if (onboardingContext) {
        sourceContext = "onboarding";
      }
    }

    const fallback = buildFallbackInsights(!hasEntries, sourceEntryId, sourceEntryCount, sourceEntryDate, sourceContext);

    if (!hasEntries && !onboardingContext) {
      await adminClient
        .from("dashboard_insights_cache")
        .upsert({
          user_id: user.id,
          last_entry_id: sourceEntryId,
          source_entry_count: sourceEntryCount,
          source_entry_date: sourceEntryDate,
          source_context: sourceContext,
          insights_json: fallback,
          generated_at: fallback.generatedAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      return NextResponse.json(fallback, { status: 200 });
    }

    const lastEntry = entries[0];
    // If entries are encrypted in the DB, attempt server-side decryption using stored encrypted master key.
    // This mirrors the prompts route so the dashboard prompt sees the same real recent-entry text.
    let decryptedEntries: Array<{ content: string; created_at: string; effectiveDate: string }> = [];
    try {
      // Pull user's encryption wrappers from users table
      const { data: userEnc } = await adminClient
        .from('users')
        .select('encryption_salt, encrypted_master_key, master_key_iv')
        .eq('id', user.id)
        .maybeSingle();

      let masterKey: CryptoKey | null = null;
      if (userEnc?.encryption_salt && userEnc?.encrypted_master_key && userEnc?.master_key_iv) {
        try {
          const isOAuthUser = user.app_metadata?.provider !== 'email';
          const password = isOAuthUser ? user.id : user.id;
          const salt = base64ToUint8Array(userEnc.encryption_salt);
          const passwordKey = await deriveKeyFromPassword(password, salt);
          const masterKeyBase64 = await decryptText(
            userEnc.encrypted_master_key,
            userEnc.master_key_iv,
            passwordKey
          );
          const masterKeyBytes = base64ToUint8Array(masterKeyBase64);
          masterKey = await importMasterKey(masterKeyBytes);
        } catch (err) {
          console.warn('[dashboard/insights] failed to derive/import master key:', err);
        }
      }

      decryptedEntries = await Promise.all(
        (entries || []).map(async (entry) => {
          let content = String(entry?.content || '');
          let voiceTranscript = '';

          if (entry?.is_encrypted && entry?.content_encrypted && entry?.content_iv && masterKey) {
            try {
              content = await decryptText(entry.content_encrypted, entry.content_iv, masterKey);
            } catch (decryptError) {
              console.warn('[dashboard/insights] failed to decrypt entry content:', decryptError);
              content = String(entry?.content || '');
            }
          }

          if (entry?.is_encrypted && entry?.voice_transcript_encrypted && entry?.voice_transcript_iv && masterKey) {
            try {
              voiceTranscript = await decryptText(entry.voice_transcript_encrypted, entry.voice_transcript_iv, masterKey);
            } catch (decryptVoiceError) {
              console.warn('[dashboard/insights] failed to decrypt entry transcript:', decryptVoiceError);
              voiceTranscript = '';
            }
          }

          const resolvedContent = resolveJournalContent({
            content,
            transcript: voiceTranscript,
          }).value;

          return {
            content: String(resolvedContent || '').trim(),
            created_at: String(entry?.created_at || ''),
            effectiveDate: String(entry?.date || entry?.created_at || ''),
          };
        })
      );
    } catch (err) {
      // fallback to raw content if anything goes wrong
      decryptedEntries = (entries || []).map((entry) => ({
        content: String(entry?.content || '').trim(),
        created_at: String(entry?.created_at || ''),
        effectiveDate: String(entry?.date || entry?.created_at || ''),
      }));
    }

    const lastEntryText = String(decryptedEntries[0]?.content || lastEntry?.content || '').trim().slice(0, LAST_ENTRY_MAX_CHARS);
    try {
      console.log('[dashboard/insights] lastEntryText length:', String((lastEntryText || '').length));
      console.log('[dashboard/insights] lastEntryText preview:', (lastEntryText || '').slice(0, 320));
    } catch {}
    const recentSnippets = decryptedEntries
      .slice(1)
      .map((entry) => (entry?.content || "").replace(/\s+/g, " ").trim())
      .filter((text) => text.length > 20)
      .map((text) => text.slice(0, SNIPPET_MAX_CHARS));

    const weeklyCutoff = new Date();
    weeklyCutoff.setDate(weeklyCutoff.getDate() - 7);
    const weeklyEntries = entries.filter((entry) => new Date(entry.created_at) >= weeklyCutoff).length;

    const moodSamples = entries
      .map((entry) => String(entry?.mood || "").trim())
      .filter((mood) => mood.length > 0)
      .slice(0, 5);

    const tagSamples = entries
      .flatMap((entry) => Array.isArray(entry?.tags) ? entry.tags : [])
      .map((tag) => String(tag).trim())
      .filter((tag) => tag.length > 0)
      .slice(0, 8);

    // If caller requests expanded mentalWeather, ask the LLM for a longer, example-backed analysis.
    const expand = request.nextUrl?.searchParams?.get?.('expand') === 'mentalWeather';
    const analysisGuidance = expand
      ? 'Provide a longer mentalWeather.analysis (3-5 sentences). Reference specific cues from the last entry or recent snippets and include one gentle, concrete micro-action the user can try.'
      : 'Include a short mentalWeather.analysis (1-3 sentences) that explains, in warm supportive language, why the mental weather is as described based on the last entry. Keep tone positive and avoid clinical phrasing.';

    const prompt = `You are generating dashboard card values for a journaling app.

Return ONLY valid JSON. No markdown or commentary.

IMPORTANT: Base the wellness percentages and labels on the user's LAST ENTRY, not on generic defaults. Do not repeat the same balance numbers unless the entry truly supports it. Make the emotional / mental / physical percentages meaningfully different when the entry shows uneven attention, stress, or fatigue.

Use these meanings:
- emotional = emotional intensity, interpersonal load, and affective weight
- mental = cognitive load, rumination, planning pressure, decision friction
- physical = body tension, energy, sleep pressure, movement needs

Schema:
{
  "mentalWeather": {
    "pattern": "stormy|shifting|calm|clearing|bright",
    "intensity": number (0-100),
    "forecast": string,
    "analysis": string
  },
  "mindEnergy": {
    "level": number (0-100),
    "state": "low|recovering|steady|flowing|peak",
    "message": string,
    "hint": string
  },
  "wellnessBalance": {
    "emotional": number (0-100),
    "mental": number (0-100),
    "physical": number (0-100),
    "priority": "emotional|mental|physical",
    "message": string
  },
  "rhythm": {
    "energyPattern": "morning|midday|evening|night",
    "label": string,
    "insight": string,
    "times": [string, string, string]
  }
}

Rules:
- Speak directly to the user (use "you"), never say "the user".
- Keep copy warm, calm, and practical.
- If context is thin, choose calm/steady defaults.
- Avoid clinical labels or diagnosis.
- Make the wellness percentages reflect the entry's emphasis and tension; do not mirror the fallback evenly-balanced numbers by default.
 - Use the last entry as the primary source of truth, with recent snippets only as supporting context.

Additional output guidance:
 - ${analysisGuidance}

Context:
Last entry (most recent):
${lastEntryText || onboardingContext || "(none)"}

Recent snippets:
${recentSnippets.length ? recentSnippets.map((text, i) => `${i + 1}. ${text}`).join("\n") : "(none)"}

Stats:
- Recent entries: ${entries.length}
- Weekly entries: ${weeklyEntries}
- Recent moods: ${moodSamples.length ? moodSamples.join(", ") : "(none)"}
- Recent tags: ${tagSamples.length ? tagSamples.join(", ") : "(none)"}

Return JSON only.`;

  
    let text = "";
    try {
      const llmResult = await executeLLMRequest({
        prompt,
        provider: "claude",
        options: { rawPrompt: false, temperature: 0.3 },
      });
      text = String(llmResult?.text || "");
    } catch (llmErr) {
      console.warn("[dashboard/insights] LLM execution failed, using fallback:", llmErr);
      await adminClient
        .from("dashboard_insights_cache")
        .upsert({
          user_id: user.id,
          last_entry_id: sourceEntryId,
          source_entry_count: sourceEntryCount,
          source_entry_date: sourceEntryDate,
          source_context: sourceContext,
          insights_json: fallback,
          generated_at: fallback.generatedAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      return NextResponse.json(fallback, { status: 200 });
    }

    console.log('[dashboard/insights] raw LLM text length:', text.length);
    console.log('[dashboard/insights] raw LLM text preview:', text.slice(0, 400));
    // If the LLM output explicitly says there are no journal entries or it's an onboarding message,
    // don't treat this as a successful LLM-derived insights payload — fall back instead.
    const negativeEntryPhrases = [
      "no journal entries",
      "you haven't written any entries",
      "no entries available",
      "onboarding moment",
      "you have no entries",
      "no journal",
    ];
    const lowerText = text.toLowerCase();
    const indicatesNoEntries = negativeEntryPhrases.some((p) => lowerText.includes(p));
    if (indicatesNoEntries) {
      console.warn('[dashboard/insights] LLM indicates no entries or onboarding — using fallback insights instead');
      await adminClient
        .from('dashboard_insights_cache')
        .upsert({
          user_id: user.id,
          last_entry_id: sourceEntryId,
          source_entry_count: sourceEntryCount,
          source_entry_date: sourceEntryDate,
          source_context: sourceContext,
          insights_json: fallback,
          generated_at: fallback.generatedAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      return NextResponse.json(fallback, { status: 200 });
    }
    const extracted = extractJson(text);
    if (!extracted) {
      console.warn('[dashboard/insights] No JSON found in LLM text, attempting freeform parse');
      const free = parseFreeformLLM(text);
      if (free) {
        console.log('[dashboard/insights] Freeform parser produced partial result:', JSON.stringify(free));
        const normalizedFree = normalizeInsights(free, fallback, sourceEntryId, sourceEntryCount, sourceEntryDate, sourceContext);
        await adminClient
          .from("dashboard_insights_cache")
          .upsert({
            user_id: user.id,
            last_entry_id: sourceEntryId,
            source_entry_count: sourceEntryCount,
            source_entry_date: sourceEntryDate,
            source_context: sourceContext,
            insights_json: normalizedFree,
            generated_at: normalizedFree.generatedAt,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        try { console.log('[dashboard/insights] upserted normalizedFree preview:', JSON.stringify(normalizedFree).slice(0,1200)); } catch {}
        return NextResponse.json(normalizedFree, { status: 200 });
      }

      await adminClient
        .from("dashboard_insights_cache")
        .upsert({
          user_id: user.id,
          last_entry_id: sourceEntryId,
          source_entry_count: sourceEntryCount,
          source_entry_date: sourceEntryDate,
          source_context: sourceContext,
          insights_json: fallback,
          generated_at: fallback.generatedAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      return NextResponse.json(fallback, { status: 200 });
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(extracted);
    } catch (err) {
      console.error('[dashboard/insights] JSON.parse failed for extracted text:', err);
      console.error('[dashboard/insights] extracted text preview:', extracted?.slice(0, 800));
      await adminClient
        .from("dashboard_insights_cache")
        .upsert({
          user_id: user.id,
          last_entry_id: sourceEntryId,
          source_entry_count: sourceEntryCount,
          source_entry_date: sourceEntryDate,
          source_context: sourceContext,
          insights_json: fallback,
          generated_at: fallback.generatedAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      return NextResponse.json(fallback, { status: 200 });
    }

    const normalized = normalizeInsights(parsed, fallback, sourceEntryId, sourceEntryCount, sourceEntryDate, sourceContext);
    console.log('[dashboard/insights] normalized mentalWeather.analysis length:', String(normalized?.mentalWeather?.analysis || '').length);
    await adminClient
      .from("dashboard_insights_cache")
      .upsert({
        user_id: user.id,
        last_entry_id: sourceEntryId,
        source_entry_count: sourceEntryCount,
        source_entry_date: sourceEntryDate,
        source_context: sourceContext,
        insights_json: normalized,
        generated_at: normalized.generatedAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    try {
      console.log('[dashboard/insights] upserted normalized preview:', JSON.stringify(normalized).slice(0, 1200));
    } catch {
      // ignore stringify errors
    }
    return NextResponse.json(normalized, { status: 200 });
  } catch (error: any) {
    console.error("[dashboard/insights] Error:", error);
    const fallback = buildFallbackInsights(false, null, 0, null, "fallback");
    return NextResponse.json(fallback, { status: 200 });
  }
}

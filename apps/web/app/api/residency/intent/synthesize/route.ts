// apps/web/app/api/residency/intent/synthesize/route.ts
// POST /api/residency/intent/synthesize (v1.1 §4): three answers, optional offer/need, the
// normalized Onairos subset → a provisional five-field snapshot with at most one next step.
// Written by Claude Haiku 4.5; otherwise, or if it fails, the plain draft.

import cohort from "@/contract/fixtures/cohort.json";
import { synthesize, visible, type Snapshot, type SynthInput } from "@/contract/residency";
import { hasClaude, readSnapshot, readFootprint } from "@/server/claude";
import { saveResidencySnapshot, saveOnairosData } from "@/lib/residency/residencyStore";
import { createAdminClient } from "@/utils/supabase/admin";

export const maxDuration = 60;
const THEMES = [...new Set((cohort.snapshots as Snapshot[]).filter(visible).flatMap((s) => s.approach))];

export async function POST(req: Request) {
  const start = performance.now();
  console.log("📥 [POST /api/residency/intent/synthesize] Request received");

  let body: any;
  try {
    body = await req.json();
  } catch (err: any) {
    console.error("❌ [POST /api/residency/intent/synthesize] Bad JSON body:", err?.message);
    return Response.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const residentId = body.resident_id || body.user_id || body.userId || `r_${Date.now()}`;
  const name = (body.name || body.userName || "Resident").trim();
  console.log(`👤 [Synthesize] Resident: "${name}" (${residentId}), Cohort: ${body.cohort_id || "dhun-oct-2026"}`);

  let answers: string[] = [];
  if (Array.isArray(body.answers)) {
    answers = body.answers.map((a: any) => (typeof a === "string" ? a : a?.text || ""));
  } else if (body.answers && typeof body.answers === "object") {
    answers = [
      body.answers.q1_intent || body.answers.q1 || "",
      body.answers.q2_problem || body.answers.q2 || "",
      body.answers.q3_blocker || body.answers.q3 || "",
    ];
  }
  console.log(`💬 [Synthesize] Raw answers received: Q1(${answers[0]?.length || 0} chars), Q2(${answers[1]?.length || 0} chars), Q3(${answers[2]?.length || 0} chars)`);

  const contribution = {
    can_offer: Array.isArray(body.contribution?.can_offer)
      ? body.contribution.can_offer
      : Array.isArray(body.contributions?.can_offer)
      ? body.contributions.can_offer
      : [],
    seeking: Array.isArray(body.contribution?.seeking)
      ? body.contribution.seeking
      : Array.isArray(body.contributions?.seeking)
      ? body.contributions.seeking
      : [],
  };
  console.log(`🤝 [Synthesize] Contributions: Offers=[${contribution.can_offer.join(", ")}], Seeking=[${contribution.seeking.join(", ")}]`);

  const questions: string[] | undefined = Array.isArray(body.questions)
    ? body.questions.filter((q: any) => typeof q === "string" && q.trim().length > 0)
    : undefined;

  // Extract all external and social links provided by user
  let rawLinks: string[] = [];
  if (Array.isArray(body.links)) {
    rawLinks = body.links.map((l: any) => String(l || ""));
  } else if (body.links && typeof body.links === "object") {
    rawLinks = Object.values(body.links).map((l: any) => String(l || ""));
  }
  if (body.socialLinks && typeof body.socialLinks === "object") {
    rawLinks.push(...Object.values(body.socialLinks).map((l: any) => String(l || "")));
  }
  if (body.social_links && typeof body.social_links === "object") {
    rawLinks.push(...Object.values(body.social_links).map((l: any) => String(l || "")));
  }
  if (Array.isArray(body.extra)) {
    rawLinks.push(...body.extra.map((l: any) => String(l || "")));
  }
  const cleanLinks = [...new Set(rawLinks.map((l) => (typeof l === "string" ? l.trim() : "")).filter((l) => /^https?:\/\//i.test(l) || l.includes(".")))]
    .slice(0, 8);
  console.log(`🔗 [Synthesize] Discovered ${cleanLinks.length} external/social profile links:`, cleanLinks);

  let publicFindings = Array.isArray(body.public) ? body.public : [];

  // If public findings not yet fetched but resident provided links, fetch them with Claude (bounded to 2.5s so synthesis never stalls)!
  if (publicFindings.length === 0 && cleanLinks.length > 0 && hasClaude()) {
    try {
      console.log(`🌐 [Synthesize] Ingesting social media links (${cleanLinks.length}) for "${name}" via Claude readFootprint (capped at 2.5s)...`);
      const fpPromise = readFootprint(name, cleanLinks);
      const fpTimeout = new Promise<null>((r) => setTimeout(() => r(null), 2500));
      const fp = await Promise.race([fpPromise, fpTimeout]);
      if (fp && fp.findings?.length) {
        publicFindings = fp.findings;
        console.log(`✅ [Synthesize] Ingested ${publicFindings.length} public social findings for intent snapshot:`, fp.read);
      }
    } catch (e: any) {
      console.warn("⚠️ [Synthesize] Auto-readFootprint notice:", e?.message);
    }
  }

  const input: SynthInput = {
    resident_id: residentId,
    name,
    answers,
    questions,
    contribution,
    onairos: body.onairos || null,
    public: publicFindings.length ? publicFindings : undefined,
    links: cleanLinks.length ? cleanLinks : undefined,
    voice: body.voice,
  };

  const draft = synthesize(input);
  let finalSnap: Snapshot = draft;

  if (hasClaude()) {
    try {
      console.log("🤖 [Synthesize] Calling Claude Haiku 4.5 readSnapshot()...");
      const aiStart = performance.now();
      finalSnap = await readSnapshot(input, draft, THEMES);
      console.log(`✅ [Synthesize] Claude model synthesis completed in ${Math.round(performance.now() - aiStart)}ms`);
      console.log(`   - Intent: "${finalSnap.intent}"`);
      console.log(`   - Problem: "${finalSnap.problem}"`);
      console.log(`   - Approach: [${finalSnap.approach.join(", ")}]`);
      console.log(`   - Frontier: "${finalSnap.current_frontier}"`);
      console.log(`   - Next Step: "${finalSnap.next_step?.text}"`);
    } catch (e: any) {
      console.warn("⚠️ [Synthesize] Claude model call failed, falling back to plain extractive draft:", e?.message || e);
      finalSnap = draft;
    }
  } else {
    console.warn("ℹ️ [Synthesize] No ANTHROPIC_API_KEY found, using deterministic draft");
  }

  // Ensure Onairos and public social findings from draft/input are preserved on finalSnap
  finalSnap = {
    ...finalSnap,
    archetype: finalSnap.archetype || draft.archetype || null,
    positive_traits: finalSnap.positive_traits || draft.positive_traits || [],
    user_summary: finalSnap.user_summary || draft.user_summary || "",
    top_traits_explanation: finalSnap.top_traits_explanation || draft.top_traits_explanation || "",
    nudges: finalSnap.nudges || draft.nudges || [],
    onairos_metadata: finalSnap.onairos_metadata || draft.onairos_metadata,
    public_findings: finalSnap.public_findings || (publicFindings.length ? publicFindings : draft.public_findings),
  };

  const q1Text = answers[0] || "";
  const q2Text = answers[1] || "";
  const q3Text = answers[2] || "";
  const q1Words = q1Text.split(/\s+/).filter(Boolean).length;
  const q2Words = q2Text.split(/\s+/).filter(Boolean).length;
  const q3Words = q3Text.split(/\s+/).filter(Boolean).length;
  const totalWords = q1Words + q2Words + q3Words;

  const dominantCategory: "intent" | "problem" | "open question" =
    q1Words >= q2Words && q1Words >= q3Words ? "intent" : q2Words >= q3Words ? "problem" : "open question";

  const wordAllocation = {
    total_words: totalWords,
    intent_pct: totalWords ? Math.round((q1Words / totalWords) * 100) : 33,
    problem_pct: totalWords ? Math.round((q2Words / totalWords) * 100) : 33,
    frontier_pct: totalWords ? Math.max(0, 100 - Math.round((q1Words / totalWords) * 100) - Math.round((q2Words / totalWords) * 100)) : 34,
    dominant_category: dominantCategory,
    dominant_pct: totalWords ? Math.round((Math.max(q1Words, q2Words, q3Words) / totalWords) * 100) : 34,
  };
  console.log(`📊 [Synthesize] Word allocation: Total=${totalWords}, Intent=${wordAllocation.intent_pct}%, Problem=${wordAllocation.problem_pct}%, Frontier=${wordAllocation.frontier_pct}%`);

  // Persist to Supabase residency_intent_snapshots table & user_context_model
  try {
    const saved = await saveResidencySnapshot({
      cohort_id: body.cohort_id || "dhun-oct-2026",
      user_id: residentId,
      user_name: name,
      avatar_url: body.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      social_links: (body.socialLinks && Object.keys(body.socialLinks).length)
        ? body.socialLinks
        : (body.social_links && Object.keys(body.social_links).length)
        ? body.social_links
        : Object.fromEntries(cleanLinks.map((l, idx) => [`link_${idx + 1}`, l])),
      intent: finalSnap.intent || "",
      problem: finalSnap.problem || "",
      approach: finalSnap.approach || [],
      archetype: finalSnap.archetype ?? undefined,
      positive_traits: finalSnap.positive_traits as any,
      user_summary: finalSnap.user_summary ?? undefined,
      top_traits_explanation: finalSnap.top_traits_explanation ?? undefined,
      nudges: finalSnap.nudges as any,
      onairos_metadata: finalSnap.onairos_metadata as any,
      current_frontier: finalSnap.current_frontier || "",
      contribution: finalSnap.contribution,
      next_step: finalSnap.next_step || { text: "", why_it_may_help: "", status: "suggested" },
      raw_answers: {
        q1: { text: q1Text, audio_duration: "0:00" },
        q2: { text: q2Text, audio_duration: "0:00" },
        q3: { text: q3Text, audio_duration: "0:00" },
      },
      word_allocation: wordAllocation,
      normalized_onairos_context: body.onairos || null,
      provenance: finalSnap.provenance as any,
      status: "pending_review",
      sharing_consent: false,
    });
    console.log("💾 [Synthesize] Persisted snapshot to Supabase:", saved.id);

    if (body.raw_onairos || body.onairos) {
      await saveOnairosData(residentId, body.raw_onairos || body.onairos, body.onairos, name);
    }

    // Persist participant profile and onboarding entries to Supabase tables
    try {
      const supabase = createAdminClient();

      // Upsert residency_participants
      await supabase.from("residency_participants").upsert(
        {
          unique_id: residentId,
          name,
          links: (body.socialLinks && Object.keys(body.socialLinks).length)
            ? body.socialLinks
            : body.social_links || Object.fromEntries(cleanLinks.map((l, idx) => [`link_${idx + 1}`, l])),
          extra_links: Array.isArray(body.extra) ? body.extra : [],
          onairos_status: (body.onairos || body.raw_onairos) ? "connected" : "off",
          onairos_data: body.raw_onairos || body.onairos || null,
          answers,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "unique_id" }
      );
      console.log(`💾 [Synthesize] Persisted participant profile to residency_participants: ${residentId}`);

      // Upsert residency_entries for onboarding answers
      const qTitles = [
        "What I'm working on here",
        "The part I keep coming back to",
        "What makes this residency a win",
      ];
      for (let i = 0; i < answers.length; i++) {
        const text = answers[i]?.trim();
        if (!text) continue;
        await supabase.from("residency_entries").upsert(
          {
            unique_id: residentId,
            entry_id: `onboarding_q${i + 1}`,
            title: qTitles[i] || `Residency Reflection ${i + 1}`,
            content: text,
            blocks: [{ id: `b_q_${i + 1}`, kind: "text", html: `<p>${text}</p>` }],
            themes: ["Residency", "Intent"],
            mood: 0,
            entry_date: new Date().toISOString().split("T")[0],
            entry_time: `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`,
            metadata: { source: "onboarding", question_index: i + 1 },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "unique_id,entry_id" }
        );
      }
      console.log(`💾 [Synthesize] Persisted onboarding answers to residency_entries for ${residentId}`);
    } catch (partErr: any) {
      console.warn("⚠️ [Synthesize] Participant & entries persistence notice:", partErr?.message);
    }
  } catch (err: any) {
    console.warn("⚠️ [Synthesize] Supabase dual-persistence notice:", err?.message);
  }

  const duration = Math.round(performance.now() - start);
  console.log(`📤 [POST /api/residency/intent/synthesize] 200 OK (${duration}ms) - Returning snapshot: ${finalSnap.id}`);

  return Response.json({
    ...finalSnap,
    public_findings: finalSnap.public_findings || publicFindings,
    success: true,
    snapshot: {
      ...finalSnap,
      public_findings: finalSnap.public_findings || publicFindings,
      word_allocation: wordAllocation,
      status: "pending_review",
      sharing_consent: false,
    },
  });
}

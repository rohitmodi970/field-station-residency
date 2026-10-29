// apps/web/app/api/residency/intent/approve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getResidencySnapshot, saveResidencySnapshot } from "@/lib/residency/residencyStore";
import type { Snapshot } from "@/contract/residency";

export async function POST(req: NextRequest) {
  const start = performance.now();
  console.log("📥 [POST /api/residency/intent/approve] Approval request received");

  try {
    let user: any = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data?.user;
    } catch {
      // Continue
    }

    const body = await req.json().catch(() => ({}));
    const residentId = body.snapshot_id || body.resident_id || body.user_id || body.userId || user?.id || `r_${Date.now()}`;
    const cohortId = body.cohort_id || "dhun-oct-2026";
    console.log(`👤 [Approve] Target resident: ${residentId}, Cohort: ${cohortId}`);

    const existing = await getResidencySnapshot(residentId, cohortId);

    // Support both body.fields (proto) and body.edited_fields (web)
    const incomingFields = body.fields || body.edited_fields || {};
    const shared = typeof body.shared === "boolean" ? body.shared : typeof body.sharing_consent === "boolean" ? body.sharing_consent : (existing?.sharing_consent ?? false);
    console.log(`🔒 [Approve] Decoupled consent setting -> sharing_consent: ${shared}`);

    const incomingPersona = incomingFields.persona !== undefined ? incomingFields.persona : body.persona;
    const persona = incomingPersona !== undefined ? incomingPersona : existing?.normalized_onairos_context;

    const updatedSnapshot = {
      user_id: residentId,
      user_name: body.user_name || body.name || existing?.user_name || user?.user_metadata?.full_name || "Resident",
      avatar_url: body.avatar_url || existing?.avatar_url,
      social_links: body.social_links || existing?.social_links,
      raw_answers: body.raw_answers || existing?.raw_answers,
      word_allocation: body.word_allocation || existing?.word_allocation,
      cohort_id: cohortId,
      intent: incomingFields.intent !== undefined ? incomingFields.intent : (existing?.intent || ""),
      problem: incomingFields.problem !== undefined ? incomingFields.problem : (existing?.problem || ""),
      approach: Array.isArray(incomingFields.approach) ? incomingFields.approach : (existing?.approach || []),
      archetype: incomingFields.archetype !== undefined ? incomingFields.archetype : (existing?.archetype || "Creative Explorer"),
      positive_traits: incomingFields.positive_traits !== undefined ? incomingFields.positive_traits : (existing?.positive_traits || []),
      user_summary: incomingFields.user_summary !== undefined ? incomingFields.user_summary : (existing?.user_summary || ""),
      top_traits_explanation: incomingFields.top_traits_explanation !== undefined ? incomingFields.top_traits_explanation : (existing?.top_traits_explanation || ""),
      nudges: incomingFields.nudges !== undefined ? incomingFields.nudges : (existing?.nudges || []),
      onairos_metadata: incomingFields.onairos_metadata !== undefined ? incomingFields.onairos_metadata : existing?.onairos_metadata,
      current_frontier: incomingFields.current_frontier !== undefined ? incomingFields.current_frontier : (existing?.current_frontier || ""),
      contribution: {
        can_offer: incomingFields.contribution?.can_offer || existing?.contribution?.can_offer || [],
        seeking: incomingFields.contribution?.seeking || existing?.contribution?.seeking || [],
      },
      next_step: incomingFields.next_step || existing?.next_step || {
        text: "Review resident connections in the cohort graph.",
        why_it_may_help: "Discover complementary methodologies.",
        status: "accepted" as const,
      },
      provenance: existing?.provenance || {
        intent: ["user_validated"],
        problem: ["user_validated"],
        approach: ["user_validated"],
        archetype: ["onairos:general_persona"],
        positive_traits: ["onairos:positive_traits"],
        user_summary: ["onairos:user_summary"],
        top_traits_explanation: ["onairos:top_traits_explanation"],
        nudges: ["onairos:nudges"],
      },
      status: "user_approved" as const,
      sharing_consent: shared,
      user_feedback: body.user_feedback,
      normalized_onairos_context: persona || existing?.normalized_onairos_context || null,
    };

    const saved = await saveResidencySnapshot(updatedSnapshot, body.snapshot_id || existing?.id);
    console.log(`💾 [Approve] Snapshot saved in Supabase with status 'user_approved': ${saved.id}`);
    try {
      const { createAdminClient } = await import('@/utils/supabase/admin');
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin
        .from('residency_participants')
        .update({
          onairos_data: persona || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('unique_id', residentId);
    } catch {}

    // Return format compliant with Snapshot
    const outSnapshot: Snapshot = {
      id: saved.id || residentId,
      resident_id: residentId,
      name: saved.user_name || "Resident",
      intent: saved.intent,
      problem: saved.problem,
      approach: saved.approach || [],
      archetype: saved.archetype || "Creative Explorer",
      positive_traits: Array.isArray(saved.positive_traits)
        ? saved.positive_traits.map((t: any) => ({
            name: t.name || t.trait || "",
            strength: t.strength ?? t.score ?? 0,
            evidence: t.evidence,
            emoji: t.emoji,
          }))
        : (saved.positive_traits as Record<string, number>) || [],
      user_summary: saved.user_summary || "",
      top_traits_explanation: saved.top_traits_explanation || "",
      nudges: (saved.nudges as any) || [],
      onairos_metadata: saved.onairos_metadata,
      current_frontier: saved.current_frontier,
      contribution: saved.contribution || { can_offer: [], seeking: [] },
      next_step: saved.next_step ? {
        text: saved.next_step.text || "",
        why_it_may_help: saved.next_step.why_it_may_help || "",
        status: (saved.next_step.status as any) || "accepted",
        source: "user",
      } : null,
      provenance: (saved.provenance as any) || {},
      inferred: [],
      status: "approved",
      shared: saved.sharing_consent,
      persona: persona || existing?.normalized_onairos_context || undefined,
      updated_at: saved.updated_at || new Date().toISOString(),
    };

    const duration = Math.round(performance.now() - start);
    console.log(`📤 [POST /api/residency/intent/approve] 200 OK (${duration}ms) - Approved ${outSnapshot.id}`);

    return NextResponse.json({
      ...outSnapshot,
      success: true,
      status: "user_approved",
      sharing_consent: saved.sharing_consent,
      message: saved.sharing_consent
        ? "Snapshot approved and shared with cohort."
        : "Snapshot approved privately (not visible externally).",
      snapshot: outSnapshot,
    });
  } catch (err: any) {
    const duration = Math.round(performance.now() - start);
    console.error(`❌ [POST /api/residency/intent/approve] 500 Error (${duration}ms):`, err?.message || err);
    return NextResponse.json({ error: "Failed to approve intent snapshot", details: err.message }, { status: 500 });
  }
}

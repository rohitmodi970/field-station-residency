// apps/web/app/api/residency/connections/route.ts
// POST /api/residency/connections: your approved, shared snapshot → the few residents worth
// meeting, each with why, what to explore and evidence from both snapshots. Compared only
// against other approved, shared snapshots; never Onairos. Falls back to the rule-based
// candidates in the contract if the model isn't available.

import cohort from "@/contract/fixtures/cohort.json";
import { suggestConnections, validConnection, visible, type Snapshot } from "@/contract/residency";
import { hasClaude, readConnections } from "@/server/claude";

export const maxDuration = 60;
const COHORT = cohort.snapshots as Snapshot[];

export async function POST(req: Request) {
  const start = performance.now();
  console.log("📥 [POST /api/residency/connections] Match request received");

  let me: Snapshot;
  try {
    const body = await req.json();
    me = body.me || body.snapshot || body;
    if (!me?.resident_id) throw new Error("Missing resident_id");
  } catch (err: any) {
    console.error("❌ [POST /api/residency/connections] Bad body:", err?.message);
    return Response.json({ error: "Expected your snapshot." }, { status: 400 });
  }

  console.log(`👤 [Connections] Resident: "${me.name}" (${me.resident_id}), Intent: "${me.intent}", Shared: ${me.shared}`);
  if (!visible(me)) {
    console.log("ℹ️ [Connections] Resident is not visible (either not approved or sharing_consent is false). Returning 0 connections.");
    return Response.json({ mine: [] });
  }

  const others = COHORT.filter((s) => visible(s) && s.resident_id !== me.resident_id);
  console.log(`👥 [Connections] Comparing against ${others.length} approved & shared peers in cohort: [${others.map((o) => o.name).join(", ")}]`);

  if (!hasClaude()) {
    console.log("ℹ️ [Connections] Using deterministic rule-based matcher (no Anthropic key)");
    const ruleConns = suggestConnections(me, others);
    return Response.json({ mine: ruleConns, source: "rules" });
  }

  try {
    console.log("🤖 [Connections] Asking Claude Haiku 4.5 for grounded peer matches (8–20 words rule)...");
    const ids = new Set([me.id, ...others.map((s) => s.id)]);
    const modelConns = await readConnections(me, others);
    const valid = modelConns.filter((c) => validConnection(c, ids));
    const duration = Math.round(performance.now() - start);

    if (valid.length > 0) {
      console.log(`✅ [Connections] Found ${valid.length} valid Claude model connections in ${duration}ms:`);
      valid.forEach((c, idx) => {
        console.log(`   ${idx + 1}. [${c.type}] Target: ${c.target} | Reason: "${c.why_connected}" | Opener: "${c.opener}"`);
      });
      return Response.json({ mine: valid, source: "model" });
    }

    console.warn("⚠️ [Connections] Model returned 0 valid connections, falling back to rule-based candidates");
    return Response.json({ mine: suggestConnections(me, others), source: "rules" });
  } catch (e: any) {
    console.error("❌ [Connections] Model failed, sending rule-based candidates:", e?.message || e);
    return Response.json({ mine: suggestConnections(me, others), source: "rules" });
  }
}

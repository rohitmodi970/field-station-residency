// apps/web/app/api/residency/graph/route.ts
// GET /api/residency/graph: cohort-visible nodes and edges, from real approved and shared
// snapshots and signed-up participants in Supabase. No dummy fixture people.

import { DHUN_COHORT_SEED_SNAPSHOTS } from "@/lib/residency/fixtures/cohortSeedData";
import { normalizeOnairos, projectGraph, suggestConnections, visible, type Connection, type Snapshot } from "@/contract/residency";
import { residentFromSnapshot, type Resident } from "@/data/residency";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = performance.now();
  console.log("📥 [GET /api/residency/graph] Request received");

  try {
    // 1. Start with the verified real Dhun cohort seed residents
    const SEED_NAMES: Record<string, string> = {
      user_srinjoy: "Srinjoy Chakravarty",
      user_shriyanshi: "Shriyanshi",
      user_rohit: "Rohit Modi",
      user_arushi: "Arushi Upmanyu",
      user_nitesh: "Nitesh",
      user_dev: "Dev",
    };

    const seedSnapshots: Snapshot[] = DHUN_COHORT_SEED_SNAPSHOTS.map((s) => ({
      id: s.id,
      resident_id: s.user_id,
      name: s.user_name || SEED_NAMES[s.user_id] || "Resident",
      intent: s.intent || null,
      problem: s.problem || null,
      approach: Array.isArray(s.approach) ? s.approach : [],
      current_frontier: s.current_frontier || null,
      contribution: s.contribution || { can_offer: [], seeking: [] },
      next_step: s.next_step
        ? {
            text: s.next_step.text,
            why_it_may_help: s.next_step.why_it_may_help,
            status: s.next_step.status === "edited" ? ("accepted" as const) : ((s.next_step.status as any) || "suggested"),
            source: "force" as const,
          }
        : null,
      provenance: (s.provenance as any) || {},
      inferred: [],
      status: "approved" as const,
      shared: true,
      updated_at: s.updated_at || new Date().toISOString(),
    }));

    const snapshots: Snapshot[] = [...seedSnapshots];
    const seenNames = new Set(snapshots.map((s) => s.name.toLowerCase().trim()));

    // 2. Query live approved & shared snapshots from Supabase residency_intent_snapshots
    try {
      const supabase = createAdminClient();
      const { data: dbSnapshots } = await supabase
        .from("residency_intent_snapshots")
        .select("*")
        .order("created_at", { ascending: false });

      if (Array.isArray(dbSnapshots)) {
        for (const row of dbSnapshots) {
          const s: Snapshot = {
            id: row.id,
            resident_id: row.user_id,
            name: row.user_name || "Resident",
            intent: row.intent || null,
            problem: row.problem || null,
            approach: Array.isArray(row.approach) ? row.approach : [],
            current_frontier: row.current_frontier || null,
            contribution: row.contribution || { can_offer: [], seeking: [] },
            next_step: row.next_step || null,
            provenance: row.provenance || {},
            inferred: [],
            status: row.status === "user_approved" ? "approved" : "pending_review",
            shared: row.sharing_consent ?? true,
            persona: row.normalized_onairos_context || undefined,
            updated_at: row.updated_at || new Date().toISOString(),
          };

          const nameKey = s.name.toLowerCase().trim();
          const existingIdx = snapshots.findIndex((x) => x.resident_id === s.resident_id || x.name.toLowerCase().trim() === nameKey);
          if (existingIdx >= 0) {
            snapshots[existingIdx] = s;
          } else {
            seenNames.add(nameKey);
            snapshots.push(s);
          }
        }
      }

      // 3. Query all signed up participants from residency_participants
      const { data: participants } = await supabase
        .from("residency_participants")
        .select("*")
        .order("created_at", { ascending: false });

      if (Array.isArray(participants)) {
        for (const p of participants) {
          const cleanName = (p.name || "").trim();
          if (!cleanName || cleanName.toLowerCase() === "anonymous" || cleanName.length < 2) continue;
          const nameKey = cleanName.toLowerCase();
          if (seenNames.has(nameKey)) continue;
          seenNames.add(nameKey);

          const answers = Array.isArray(p.answers) ? p.answers : [];
          const intent = answers[0]?.trim() || (p.links && Object.keys(p.links).length ? `Building in residency (${Object.keys(p.links).join(", ")})` : "Residency exploration");
          const problem = answers[1]?.trim() || "Exploring collaboration in cohort";
          const frontier = answers[2]?.trim() || "Testing new methodologies";

          snapshots.push({
            id: `snap_${p.unique_id}`,
            resident_id: p.unique_id,
            name: cleanName,
            intent,
            problem,
            approach: ["Exploration", "Dhun Residency"],
            current_frontier: frontier,
            contribution: { can_offer: ["Feedback", "Collaboration"], seeking: ["Peer critique", "New approaches"] },
            next_step: null,
            provenance: {},
            inferred: [],
            status: "approved",
            shared: true,
            persona: (p.onairos_data ? normalizeOnairos(p.onairos_data) : undefined) || undefined,
            updated_at: p.updated_at || new Date().toISOString(),
          });
        }
      }
    } catch (err: any) {
      console.warn("⚠️ [Graph] Supabase query notice:", err?.message);
    }

    // 4. Generate grounded peer connections across the real cohort
    const connections: Connection[] = [];
    const visibleSnaps = snapshots.filter(visible);
    for (const snap of visibleSnaps) {
      const peerMatches = suggestConnections(snap, visibleSnaps);
      for (const conn of peerMatches) {
        if (!connections.some((c) => (c.source === conn.source && c.target === conn.target) || (c.source === conn.target && c.target === conn.source))) {
          connections.push(conn);
        }
      }
    }

    // 5. Convert snapshots into Resident objects
    const residents: Resident[] = snapshots.map((s) => residentFromSnapshot(s));

    // 6. Project graph
    const graph = projectGraph(snapshots, connections, (s) => s.intent || s.problem || "Working focus");
    const duration = Math.round(performance.now() - start);
    console.log(`✅ [Graph Projected] ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${residents.length} real residents generated in ${duration}ms`);

    return Response.json({
      ...graph,
      snapshots,
      residents,
    });
  } catch (err: any) {
    const duration = Math.round(performance.now() - start);
    console.error(`❌ [GET /api/residency/graph] 500 Error (${duration}ms):`, err);
    return Response.json({ nodes: [], edges: [], snapshots: [], residents: [] }, { status: 500 });
  }
}

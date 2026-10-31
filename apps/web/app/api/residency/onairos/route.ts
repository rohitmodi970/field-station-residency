// apps/web/app/api/residency/onairos/route.ts
// POST /api/residency/onairos: Ingests, normalizes, and logs real Onairos persona data on the server.

import { normalizeOnairos, type OnairosNormalized } from "@/contract/residency";
import { saveOnairosData } from "@/lib/residency/residencyStore";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const start = performance.now();
  console.log("\n================================================================================");
  console.log("🧩 [SERVER API: POST /api/residency/onairos] REAL ONAIROS DATA INTAKE RECEIVED");

  try {
    const body = await req.json().catch(() => ({}));
    const raw = body.raw || body;
    const residentName = body.name || "Resident";
    const residentId = body.resident_id || body.user_id || body.userId || (residentName.toLowerCase().includes("srinjoy") ? "user_srinjoy" : `res_${Date.now()}`);

    if (!raw || (typeof raw === "object" && Object.keys(raw).length === 0)) {
      console.warn("⚠️ [SERVER: Onairos] Received empty payload. Aborting.");
      return NextResponse.json({ error: "No Onairos payload received", success: false }, { status: 400 });
    }

    console.log(`📍 [ONAIROS SOURCE]: LIVE_ONAIROS_API`);
    console.log(`👤 [ONAIROS RESIDENT]: ${residentName} (${residentId})`);
    console.log("📦 [ONAIROS RAW PAYLOAD RECEIVED FROM CLIENT]:\n", JSON.stringify(raw, null, 2));

    const normalized: OnairosNormalized | null = normalizeOnairos(raw);

    if (!normalized || normalized.positive.length === 0 && !normalized.summary) {
      console.warn("⚠️ [SERVER: Onairos] Failed to extract real traits/persona from payload");
      return NextResponse.json({ 
        error: "Failed to extract personality traits from Onairos response", 
        success: false 
      }, { status: 400 });
    }

    // Persist raw and normalized Onairos data into the database
    try {
      await saveOnairosData(residentId, raw, normalized, residentName);
    } catch (saveErr: any) {
      console.warn("⚠️ [SERVER: Onairos DB Persistence Error]:", saveErr?.message || saveErr);
    }

    console.log("✨ [SERVER: REAL NORMALIZED ONAIROS DATA READY]:");
    console.log(`   - Summary: "${normalized.summary}"`);
    console.log(`   - Archetype: "${normalized.archetype}"`);
    console.log(`   - Coverage: ${normalized.coverage.label || "Live profile"}`);
    console.log(`   - Positive Traits (${normalized.positive.length}):`, normalized.positive.map((t) => `${t.name} (${t.strength}%)`));
    console.log(`   - Candidate Nudges (${normalized.nudges.length}):`, normalized.nudges);
    console.log(`⏱️ [SERVER: Onairos Processing Time]: ${Math.round(performance.now() - start)}ms`);
    console.log("================================================================================\n");

    return NextResponse.json({
      success: true,
      source: "LIVE_ONAIROS_API",
      persona: normalized,
    });
  } catch (err: any) {
    console.error("❌ [SERVER API: /api/residency/onairos Error]:", err?.message || err);
    return NextResponse.json({ error: "Internal server error", success: false }, { status: 500 });
  }
}

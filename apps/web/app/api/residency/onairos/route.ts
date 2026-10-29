// apps/web/app/api/residency/onairos/route.ts
// POST /api/residency/onairos: Ingests, normalizes, and logs Onairos persona data on the server.

import { normalizeOnairos, type OnairosNormalized } from "@/contract/residency";
import onairosSample from "@/contract/fixtures/onairos-general.json";
import { saveOnairosData } from "@/lib/residency/residencyStore";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const start = performance.now();
  console.log("\n================================================================================");
  console.log("🧩 [SERVER API: POST /api/residency/onairos] ONAIROS DATA INTAKE RECEIVED");

  try {
    const body = await req.json().catch(() => ({}));
    const raw = body.raw || body;
    const residentName = body.name || "Resident";
    const residentId = body.resident_id || body.user_id || body.userId || (residentName.toLowerCase().includes("srinjoy") ? "user_srinjoy" : `res_${Date.now()}`);
    const isSample = body.isSample || !body.raw;

    const source = isSample ? "FIXTURE_SAMPLE (contract/fixtures/onairos-general.json)" : "LIVE_ONAIROS_SDK_WIDGET";
    console.log(`📍 [ONAIROS SOURCE]: ${source}`);
    console.log(`👤 [ONAIROS RESIDENT]: ${residentName} (${residentId})`);

    let normalized: OnairosNormalized | null = null;
    if (raw && Object.keys(raw).length > 0 && !isSample) {
      console.log("📦 [ONAIROS RAW PAYLOAD RECEIVED FROM CLIENT]:\n", JSON.stringify(raw, null, 2));
      normalized = normalizeOnairos(raw);
    } else {
      console.log("ℹ️ [ONAIROS] No raw SDK payload provided, using canonical test fixture sample");
      normalized = normalizeOnairos(onairosSample, true);
    }

    if (!normalized) {
      console.warn("⚠️ [SERVER: Onairos] Failed to normalize payload");
      return NextResponse.json({ error: "Failed to normalize Onairos data" }, { status: 400 });
    }

    // Persist raw and normalized Onairos data into the database
    try {
      await saveOnairosData(residentId, raw, normalized, residentName);
    } catch (saveErr: any) {
      console.warn("⚠️ [SERVER: Onairos DB Persistence Error]:", saveErr?.message || saveErr);
    }

    console.log("✨ [SERVER: NORMALIZED ONAIROS DATA READY FOR SYNTHESIS]:");
    console.log(`   - Summary: "${normalized.summary}"`);
    console.log(`   - Archetype: "${normalized.archetype}"`);
    console.log(`   - Coverage: ${normalized.coverage.label || "Partial sample"}`);
    console.log(`   - Positive Traits (${normalized.positive.length}):`, normalized.positive.map((t) => `${t.name} (${t.strength}%)`));
    console.log(`   - Candidate Nudges (${normalized.nudges.length}):`, normalized.nudges);
    console.log(`⏱️ [SERVER: Onairos Processing Time]: ${Math.round(performance.now() - start)}ms`);
    console.log("================================================================================\n");

    return NextResponse.json({
      success: true,
      source,
      persona: normalized,
    });
  } catch (err: any) {
    console.error("❌ [SERVER API: /api/residency/onairos Error]:", err?.message || err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


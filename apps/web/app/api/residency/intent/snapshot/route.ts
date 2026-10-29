// apps/web/app/api/residency/intent/snapshot/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getResidencySnapshot } from "@/lib/residency/residencyStore";

export async function GET(req: NextRequest) {
  const start = performance.now();
  console.log("📥 [GET /api/residency/intent/snapshot] Request received");

  try {
    let user: any = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      user = data?.user;
    } catch {
      // Continue without session
    }

    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId") || searchParams.get("uniqueId") || user?.id;
    const cohortId = searchParams.get("cohortId") || "dhun-oct-2026";
    console.log(`👤 [Snapshot] Querying active snapshot for: ${userId || "anonymous"} in cohort: ${cohortId}`);

    if (!userId) {
      console.warn("⚠️ [Snapshot] No userId provided in query or auth session");
      return NextResponse.json({
        success: true,
        snapshot: null,
      });
    }

    const snapshot = await getResidencySnapshot(userId, cohortId);
    const duration = Math.round(performance.now() - start);

    if (snapshot) {
      console.log(`✅ [Snapshot] Retrieved snapshot for ${userId} (${duration}ms):`, snapshot.id, `Status: ${snapshot.status}`);
    } else {
      console.log(`ℹ️ [Snapshot] No existing snapshot found for ${userId} (${duration}ms) - Returning null`);
    }

    return NextResponse.json({
      success: true,
      snapshot,
    });
  } catch (err: any) {
    const duration = Math.round(performance.now() - start);
    console.error(`❌ [GET /api/residency/intent/snapshot] 500 Error (${duration}ms):`, err?.message || err);
    return NextResponse.json({ error: "Failed to fetch snapshot", details: err.message }, { status: 500 });
  }
}

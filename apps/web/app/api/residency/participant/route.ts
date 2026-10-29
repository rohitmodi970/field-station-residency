import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uniqueId = searchParams.get("unique_id")?.trim().toUpperCase();
    const email = searchParams.get("email")?.trim().toLowerCase();

    if (!uniqueId && !email) {
      return NextResponse.json({ error: "unique_id or email parameter is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    let query = supabase.from("residency_participants").select("*");

    if (uniqueId) {
      query = query.eq("unique_id", uniqueId);
    } else if (email) {
      query = query.eq("email", email);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("[Residency Lookup] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ success: true, participant: null, message: "Participant not found" });
    }

    return NextResponse.json({ success: true, participant: data });
  } catch (err: any) {
    console.error("[Residency Lookup] Unexpected error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

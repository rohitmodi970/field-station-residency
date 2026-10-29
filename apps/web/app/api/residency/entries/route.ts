import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uniqueId = searchParams.get("uniqueId")?.trim().toUpperCase();

    if (!uniqueId) {
      return NextResponse.json({ error: "uniqueId query parameter required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("residency_entries")
      .select("*")
      .eq("unique_id", uniqueId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Residency Entries] Error fetching:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, entries: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      uniqueId,
      entryId,
      title = "Untitled Entry",
      content = "",
      blocks = [],
      themes = [],
      mood = 0,
      entryDate,
      entryTime,
      metadata = {},
    } = body;

    const cleanUniqueId = typeof uniqueId === "string" ? uniqueId.trim().toUpperCase() : "";
    const cleanEntryId = typeof entryId === "string" ? entryId.trim() : `e_${Date.now()}`;

    if (!cleanUniqueId) {
      return NextResponse.json({ error: "uniqueId is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Look up participant primary key
    const { data: participant } = await supabase
      .from("residency_participants")
      .select("id")
      .eq("unique_id", cleanUniqueId)
      .single();

    const payload: Record<string, any> = {
      unique_id: cleanUniqueId,
      participant_id: participant?.id || null,
      entry_id: cleanEntryId,
      title: title || "Untitled Reflection",
      content: content || (Array.isArray(blocks) ? blocks.map((b: any) => b.html || b.transcript || "").join(" ") : ""),
      blocks: Array.isArray(blocks) ? blocks : [],
      themes: Array.isArray(themes) ? themes : [],
      mood: typeof mood === "number" ? mood : 0,
      entry_date: entryDate || new Date().toISOString().split("T")[0],
      entry_time: entryTime || `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`,
      metadata,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("residency_entries")
      .upsert(payload, { onConflict: "unique_id,entry_id" })
      .select()
      .single();

    if (error) {
      console.error("[Residency Entries] Error saving entry:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Optional cross-post to public.journals in plaintext
    try {
      if (participant?.id) {
        await supabase
          .from("journals")
          .upsert(
            {
              user_id: participant.id,
              journal_id: `${cleanUniqueId}_${cleanEntryId}`,
              title: payload.title,
              content: payload.content,
              journal_type: "residency",
              date: new Date().toISOString(),
              display_date: new Date().toISOString(),
              tags: payload.themes,
              mood: String(payload.mood),
            },
            { onConflict: "journal_id" }
          );
      }
    } catch (crossErr) {
      // Non-blocking cross-post log
      console.warn("[Residency Entries] Non-critical cross-insert to journals skipped:", crossErr);
    }

    return NextResponse.json({ success: true, entry: data });
  } catch (err: any) {
    console.error("[Residency Entries] Exception:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

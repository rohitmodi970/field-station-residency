import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      uniqueId,
      name,
      email,
      links,
      extraLinks,
      onairosStatus,
      onairosData,
      answers,
      audioClips,
      personaPoints,
      agreedPoints,
      removedFound,
      fit,
    } = body;

    let cleanUniqueId = typeof uniqueId === "string" ? uniqueId.trim().toUpperCase() : "";
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" && email.includes("@") ? email.trim().toLowerCase() : null;

    const supabase = createAdminClient();

    // If email provided, look up existing participant by email first, otherwise auto-generate at backend level
    if (cleanEmail) {
      const { data: existing } = await supabase
        .from("residency_participants")
        .select("unique_id")
        .eq("email", cleanEmail)
        .maybeSingle();
      if (existing?.unique_id) {
        cleanUniqueId = existing.unique_id;
      }
    }

    if (!cleanUniqueId) {
      const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
      let rand = "";
      for (let i = 0; i < 6; i++) {
        rand += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      cleanUniqueId = `RES-${rand}`;
    }

    // Capture metadata for telemetry
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded?.split(",")[0]?.trim() || realIp || null;
    const userAgent = request.headers.get("user-agent") || null;

    const payload: Record<string, any> = {
      unique_id: cleanUniqueId,
      name: cleanName || "Anonymous Resident",
      email: cleanEmail,
      links: links || {},
      extra_links: Array.isArray(extraLinks) ? extraLinks : [],
      onairos_status: onairosStatus || "off",
      onairos_data: onairosData || null,
      answers: Array.isArray(answers) ? answers : [],
      audio_clips: Array.isArray(audioClips) ? audioClips : [],
      persona_points: Array.isArray(personaPoints) ? personaPoints : [],
      agreed_points: Array.isArray(agreedPoints) ? agreedPoints : [],
      removed_found: Array.isArray(removedFound) ? removedFound : [],
      fit: fit || null,
      metadata: { ip, userAgent },
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("residency_participants")
      .upsert(payload, { onConflict: "unique_id" })
      .select("id, unique_id, updated_at")
      .single();

    if (error) {
      console.error("[Residency API] Error saving participant:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Auto-create journal entries for onboarding reflections
    if (data?.id && Array.isArray(answers) && answers.length > 0) {
      const titles = [
        "What I'm working on here",
        "The part I keep coming back to",
        "What makes this residency a win",
      ];
      for (let i = 0; i < answers.length; i++) {
        const text = typeof answers[i] === "string" ? answers[i].trim() : "";
        const clip = Array.isArray(audioClips) ? audioClips[i] : null;
        if (!text && !clip) continue;

        const entryId = `onboarding_q${i + 1}`;
        const blocks: any[] = [];
        if (text) {
          blocks.push({ id: `b_txt_${i}`, kind: "text", html: `<p>${text}</p>` });
        }
        if (clip) {
          blocks.push({ id: `b_aud_${i}`, kind: "audio", clip });
        }

        try {
          await supabase.from("residency_entries").upsert(
            {
              participant_id: data.id,
              unique_id: cleanUniqueId,
              entry_id: entryId,
              title: titles[i] || `Residency Reflection ${i + 1}`,
              content: text || clip?.transcript || "",
              blocks,
              themes: ["Residency", "Intent"],
              mood: 0,
              entry_date: new Date().toISOString().split("T")[0],
              entry_time: `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "unique_id,entry_id" }
          );
        } catch (entryErr) {
          console.warn("[Residency API] Non-critical error saving onboarding entry:", entryErr);
        }
      }
    }

    return NextResponse.json({ success: true, participant: data });
  } catch (err: any) {
    console.error("[Residency API] Unexpected error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

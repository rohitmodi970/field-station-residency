import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const uniqueId = (formData.get("uniqueId") as string | null) || "ANON";
    const questionIndex = (formData.get("questionIndex") as string | null) || "0";

    if (!file) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    const cleanUniqueId = uniqueId.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const ext = file.type.includes("mp4") ? "mp4" : file.type.includes("wav") ? "wav" : "webm";
    
    // Unguessable random UUID suffix to prevent enumeration attacks
    const fileName = `${cleanUniqueId}_q${questionIndex}_${randomUUID()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const supabase = createAdminClient();

    const { error: uploadError } = await supabase.storage
      .from("residency-audio")
      .upload(fileName, buffer, {
        contentType: file.type || "audio/webm",
        upsert: false,
      });

    if (uploadError) {
      console.error("[Residency Audio] Upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from("residency-audio")
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      fileName,
    });
  } catch (err: any) {
    console.error("[Residency Audio] Unexpected error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { loadProfile, saveAgentExtras, type AgentExtras } from "@/lib/agent/profileStore";

/**
 * GET /api/agent/profile
 * Returns the authenticated user's agent profile built from Supabase.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await loadProfile(supabase, user.id);
    return NextResponse.json(profile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/agent/profile
 * Saves agent-specific extras (linkedin, twitter, company, role, phone,
 * website, customAnswers) into user_profiles.social_media.agent_extras.
 * Base fields (name, email) come from Supabase auth and cannot be updated here.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const extras: AgentExtras = {
      linkedin:      body.linkedin,
      twitter:       body.twitter,
      company:       body.company,
      role:          body.role,
      phone:         body.phone,
      website:       body.website,
      customAnswers: body.customAnswers,
    };

    const saved = await saveAgentExtras(supabase, user.id, extras);
    const profile = await loadProfile(supabase, user.id);
    return NextResponse.json({ success: true, profile, saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

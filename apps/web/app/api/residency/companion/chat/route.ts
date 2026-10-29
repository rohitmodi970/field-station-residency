// apps/web/app/api/residency/companion/chat/route.ts
// Direct conversation with Force Companion Agent.
// Injects the resident's verified longitudinal context (snapshot, archetype, intent,
// traits, Onairos, and open questions) into Claude so Force knows exactly who it's speaking to.

import { NextRequest, NextResponse } from "next/server";
import { hasClaude, readCompanionReply } from "@/server/claude";
import { getResidencySnapshot, saveCompanionTurn } from "@/lib/residency/residencyStore";

export const maxDuration = 30;

function getSmartFallbackReply(message: string, context?: any) {
  const name = context?.name || "there";
  const intent = context?.intent;
  const problem = context?.problem;
  const t = (message || "").toLowerCase();

  if (t.includes("stuck") || t.includes("help") || t.includes("hard") || t.includes("confused")) {
    return {
      text: problem
        ? `You're tackling ${problem.toLowerCase().slice(0, 60)}. What's the exact friction point right now?`
        : "What's the one part of the problem you keep circling?",
      options: [
        { label: "Break it down", go: "pattern" },
        { label: "Set it down till morning" }
      ],
      note: problem ? `Circling ${problem.slice(0, 30)}` : undefined,
    };
  }
  if (t.includes("people") || t.includes("who") || t.includes("someone") || t.includes("connect")) {
    return {
      text: "Two residents in Dhun have overlapping areas: Shriyanshi on cognitive boundaries, and Dev on local prototyping.",
      options: [
        { label: "Shriyanshi", go: "connection:user_shriyanshi" },
        { label: "Dhun cohort", go: "energy" }
      ],
    };
  }
  if (intent && (t.includes("work") || t.includes("build") || t.includes("make") || t.includes("today") || t.includes("next"))) {
    return {
      text: `Grounded in ${intent.toLowerCase().slice(0, 60)}, what would one clear move look like today?`,
      options: [
        { label: "Test a prototype" },
        { label: "Check my snapshot", go: "persona" }
      ],
    };
  }
  return {
    text: "Hear you. Where is your attention pulling you the most right now?",
    options: [
      { label: "Stay with this" },
      { label: "Map patterns", go: "pattern" }
    ],
  };
}

export async function POST(req: NextRequest) {
  const start = performance.now();
  console.log("📥 [POST /api/residency/companion/chat] Companion chat request received");

  let body: any;
  try {
    body = await req.json();
  } catch (err: any) {
    console.error("❌ [Companion Chat] Invalid JSON body:", err?.message);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = (body.message || "").trim();
  const kind = body.kind || "text";
  const history = Array.isArray(body.history) ? body.history : [];
  let userContext = body.user_context || {};
  const residentId = body.resident_id || userContext.resident_id || "resident";

  if (!message && kind === "text") {
    return NextResponse.json({ error: "Message text is required" }, { status: 400 });
  }

  console.log(`👤 [Companion Chat] Resident: "${userContext.name || 'Resident'}" (${residentId})`);
  console.log(`💬 [Companion Chat] Message: "${message.slice(0, 100)}" (kind: ${kind})`);
  console.log(`🧠 [Companion Chat] Context passed: Intent="${userContext.intent || 'none'}", Problem="${userContext.problem || 'none'}", Archetype="${userContext.archetype || 'none'}"`);

  // Enrich context from database if snapshot fields are incomplete and residentId is provided
  if (!userContext.intent && residentId && residentId !== "resident") {
    try {
      const dbSnap = await getResidencySnapshot(residentId);
      if (dbSnap) {
        userContext = {
          ...dbSnap,
          name: dbSnap.user_name || userContext.name,
          ...userContext,
        };
        console.log(`📚 [Companion Chat] Enriched context from Supabase snapshot for ${residentId}`);
      }
    } catch {
      // Non-blocking
    }
  }

  // If Claude is configured, generate intelligent response
  if (hasClaude()) {
    try {
      const reply = await readCompanionReply({
        message,
        kind,
        history,
        user_context: userContext,
      });

      const elapsed = Math.round(performance.now() - start);
      console.log(`✨ [Companion Chat] Force replied (${elapsed}ms): "${reply.text}"`);

      // Persist conversation turn, user message, agent response, note, and memory updates to Supabase
      try {
        await saveCompanionTurn({
          residentId,
          name: userContext.name || "Resident",
          userMessage: message,
          kind,
          replyText: reply.text,
          options: reply.options ?? undefined,
          note: reply.note ?? undefined,
          memoryUpdate: reply.memory_update
            ? {
                current_frontier: reply.memory_update.current_frontier ?? undefined,
                next_step: reply.memory_update.next_step ?? undefined,
              }
            : undefined,
        });
        console.log(`💾 [Companion Chat] Persisted conversation turn to database for resident: ${residentId}`);
      } catch (dbErr: any) {
        console.warn("⚠️ [Companion Chat] DB persistence notice:", dbErr?.message);
      }

      return NextResponse.json({
        success: true,
        source: "agent",
        text: reply.text,
        options: reply.options || [],
        note: reply.note,
        memory_update: reply.memory_update,
      });
    } catch (err: any) {
      console.warn("⚠️ [Companion Chat] Claude inference error, falling back to smart contextual response:", err?.message);
    }
  } else {
    console.log("ℹ️ [Companion Chat] ANTHROPIC_API_KEY not set, using smart contextual fallback");
  }

  // Graceful fallback grounded in user context
  const fallback = getSmartFallbackReply(message, userContext);

  try {
    await saveCompanionTurn({
      residentId,
      name: userContext.name || "Resident",
      userMessage: message,
      kind,
      replyText: fallback.text,
      options: fallback.options,
      note: fallback.note,
    });
    console.log(`💾 [Companion Chat] Persisted fallback turn to database for resident: ${residentId}`);
  } catch (dbErr: any) {
    console.warn("⚠️ [Companion Chat] DB persistence notice (fallback):", dbErr?.message);
  }

  return NextResponse.json({
    success: true,
    source: "fallback",
    text: fallback.text,
    options: fallback.options,
    note: fallback.note,
  });
}


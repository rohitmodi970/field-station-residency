// apps/web/lib/f/companion.ts
// What Force says back. Short, warm, a little witty, and specific to the resident:
// Connects with the Agent / LLM API, providing longitudinal memory & user_context (intent,
// problem, cognitive archetype, traits, Onairos, and open questions) so Force knows exactly who
// it is speaking with.

import { detectThemes, themeById, entryText, type Entry } from "@/data/mira";
import { PEOPLE, questOfTheme } from "@/data/social";
import type { Msg, Opt } from "./store";
import { useR } from "./residency";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const when = (d: string) => `${MON[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;

const FOLLOW = [
  "Say more?",
  "What part of that is still with you?",
  "And how did that sit with you?",
  "What would you want to happen next?",
];

const ASKED: Record<string, string> = {
  ambition: "What would a good week at work leave room for?",
  workshop: "What were your hands doing?",
  aai: "What would you want her to know this week?",
  running: "Where did it go quiet?",
  nights: "Solve it tonight, or set it down till morning?",
};

// Quick replies that resolve immediately without network delay
export function isQuickReply(text: string): boolean {
  const t = text.trim();
  return /^(something solo|something social|going|not tonight|hold it|let it go|break it down|step away|test a prototype)$/i.test(t);
}

// Extract rich user_context from the resident's store and journal entries
export function getUserContext(entries: Entry[] = []) {
  try {
    const r = useR.getState();
    const snap = r.snapshot;
    return {
      resident_id: r.me || snap?.resident_id || "resident",
      name: r.name?.trim() || snap?.name || "Resident",
      intent: snap?.intent || r.answers?.[0] || null,
      problem: snap?.problem || r.answers?.[1] || null,
      approach: snap?.approach?.length ? snap.approach : [],
      archetype: snap?.archetype || "Creative Explorer",
      positive_traits: snap?.positive_traits || r.persona?.positive || [],
      user_summary: snap?.user_summary || null,
      top_traits_explanation: snap?.top_traits_explanation || null,
      nudges: snap?.nudges || [],
      current_frontier: snap?.current_frontier || r.answers?.[2] || null,
      contribution: r.contribution || snap?.contribution || { can_offer: [], seeking: [] },
      noticed: snap?.noticed || [],
      next_step: snap?.next_step || null,
      raw_answers: r.answers || [],
      onairos: r.persona || null,
      links: r.links || {},
      recent_entries: (entries || []).slice(0, 4).map((e) => ({
        date: e.date,
        title: e.title,
        content: entryText(e) || e.title,
      })),
    };
  } catch (err) {
    console.warn("⚠️ [Companion] Could not read user context:", err);
    return { name: "Resident" };
  }
}

export interface AgentReply {
  text: string;
  options?: Opt[];
  note?: string;
  memory_update?: {
    current_frontier?: string;
    next_step?: string;
  };
}

// Asynchronously query the Agent API with live user_context
export async function replyToAgent(
  input: { kind: "text" | "audio" | "image" | "video"; text: string },
  chat: Msg[],
  entries: Entry[]
): Promise<AgentReply> {
  const t = input.text.trim();

  // 1. If it's a known quick-action tap, answer immediately
  if (isQuickReply(t)) {
    return replyTo(input, chat, entries);
  }

  // 2. Assemble context to give LLM full persona intelligence
  const userContext = getUserContext(entries);
  const history = chat
    .filter((m) => m.kind === "text" || (m.kind === "audio" && m.clip?.transcript))
    .slice(-8)
    .map((m) => ({
      from: m.from === "force" ? ("force" as const) : ("me" as const),
      text: m.kind === "text" ? m.text : (m as any).clip?.transcript || "",
    }));

  console.log(`🤖 [Companion:Agent] Calling Agent API for "${userContext.name}" (${userContext.archetype})...`);

  try {
    const res = await fetch("/api/residency/companion/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: t || (input.kind === "audio" ? "[Audio message]" : "[Media attachment]"),
        kind: input.kind,
        history,
        user_context: userContext,
        resident_id: userContext.resident_id,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.text) {
        console.log(`✅ [Companion:Agent] Agent responded: "${data.text}"`);
        if (data.memory_update?.current_frontier) {
          try {
            const { r } = await import("./residency");
            r.editField("current_frontier", data.memory_update.current_frontier);
            console.log(`📝 [Companion:Agent] Updated resident frontier: "${data.memory_update.current_frontier}"`);
          } catch {}
        }
        return {
          text: data.text,
          options: Array.isArray(data.options) ? data.options : undefined,
          note: typeof data.note === "string" ? data.note : undefined,
          memory_update: data.memory_update,
        };
      }
    }
    console.warn("⚠️ [Companion:Agent] API returned non-OK, using fallback");
  } catch (err: any) {
    console.warn("⚠️ [Companion:Agent] Network/Fetch error, using fallback:", err?.message);
  }

  // 3. Fallback to smart local heuristic if network or API is unavailable
  return replyTo(input, chat, entries);
}

// The most recent time she said something close, quoted short.
function lastSaid(entries: Entry[], theme: string) {
  const past = entries.filter((e) => e.themes.includes(theme)).sort((a, b) => b.date.localeCompare(a.date));
  return past.length >= 2 ? { n: past.length, last: past[0] } : null;
}

const has = (t: string, ...ws: string[]) => ws.some((w) => new RegExp(`\\b${w}`, "i").test(t));

// Synchronous heuristic reply (fallback & quick response engine)
export function replyTo(
  input: { kind: "text" | "audio" | "image" | "video"; text: string },
  chat: Msg[],
  entries: Entry[]
): { text: string; options?: Opt[] } {
  const mineSoFar = chat.filter((m) => m.from === "me").length;
  const t = input.text;
  const mira = entries.length > 0;

  if (input.kind === "image" || input.kind === "video")
    return { text: mineSoFar > 1 ? "Kept. What made you want this one?" : "Kept. What's happening in it?" };

  // Quick replies she tapped
  if (/^something solo$/i.test(t))
    return mira
      ? { text: "Then the table. Dev's downstairs till 9 and that chair sketch is still half-done. One hour?", options: [{ label: "Going" }, { label: "Not tonight" }] }
      : { text: "A long walk somewhere you've never turned left. Phone on silent. Go?", options: [{ label: "Going" }, { label: "Not tonight" }] };
  if (/^something social$/i.test(t))
    return {
      text: "Two people on your side quests are nearby. Kavya has a spare bench at her makerspace Saturday. Leah's group runs Sankey Sunday at 6:15.",
      options: [
        { label: "Kavya", go: "energy:kavya" },
        { label: "Leah", go: "energy:leah" },
      ],
    };
  if (/^going$/i.test(t)) return { text: "Good. Tell me how it went after. I'll keep it with your side quests." };
  if (/^not tonight$/i.test(t)) return { text: "Fair. Rest counts too. Want me to hold it for Saturday?", options: [{ label: "Hold it" }, { label: "Let it go" }] };
  if (/^(hold it|let it go)$/i.test(t)) return { text: /hold/i.test(t) ? "Held. Saturday, the table." : "Gone. No guilt." };

  // Point A: bored, stuck, wanting a plan
  if (has(t, "bored", "scroll", "nothing to do", "what should i do", "plan", "weekend", "tonight"))
    return {
      text: mira ? "You always say your best weeks have one unplanned thing in them. Let's make one. Solo, or with people?" : "Let's make tonight count. Solo, or with people?",
      options: [{ label: "Something solo" }, { label: "Something social" }],
    };
  if (has(t, "stuck", "don't know", "confused", "lost", "struggling"))
    return { text: "Okay. In one line: what's the part you keep circling?" };

  const themes = detectThemes(t);
  const said = chat.filter((m) => m.from === "force" && m.kind === "text").map((m) => (m as { text: string }).text).join(" ");
  const fresh = themes.find((th) => !said.includes(`“${themeById(th)!.name}”`) && !said.includes(ASKED[th]));

  if (input.kind === "audio")
    return fresh ? { text: `Got it. That's ${themeById(fresh)!.name.toLowerCase()} again. ${ASKED[fresh]}` } : { text: "Got it. Keep going, I'm listening." };

  if (fresh) {
    const quest = questOfTheme(fresh);
    const seen = lastSaid(entries, fresh);
    const others = quest ? PEOPLE.filter((p) => p.shares === quest.id).length : 0;
    const opts: Opt[] = [{ label: "Map this", go: "pattern" }];
    if (quest && others) opts.push({ label: "Same energy", go: "energy" });
    if (seen) return { text: `${seen.n} times now, last in ${when(seen.last.date)}. ${ASKED[fresh]}`, options: opts };
    return { text: ASKED[fresh], options: opts };
  }

  return { text: FOLLOW[(mineSoFar - 1 + FOLLOW.length) % FOLLOW.length] };
}

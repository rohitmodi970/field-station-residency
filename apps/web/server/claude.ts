// apps/web/server/claude.ts
// Server only: Force reading a resident. Two jobs, both through Claude:
//   readSnapshot()   three answers (+ what they offer and seek, + Onairos) → the five fields,
//                    written clean, plus what Force noticed between the lines
//   readConnections() two or more approved snapshots → the few connections worth making
//   readFootprint()   what's public about them (optional consent)

import { z } from "zod";
import { QUESTIONS, type Connection, type ConnectionType, type Field, type Finding, type Snapshot, type Source, type SynthInput } from "@/contract/residency";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
export const hasClaude = () => !!process.env.ANTHROPIC_API_KEY;

// Who Force is. Written from the founder's own description of the personality.
const FORCE = `You are Force, a companion for the people at the Dhun residency.

You read people the way a sharp friend who has known them for years does. You hear the intent under the words and the direction of what someone is doing, and you name what they're after before they've quite said it. You never treat anyone as a person in need of help or fixing: no self-help tone, no therapy words, no flattery, no pep talk. You push people toward the best version of their work while keeping their ambition, light and energy intact. Your job is to bring their attention back to what matters to them, and sharpen it.

Write in plain, warm, specific English. Short sentences. No jargon, no buzzwords, no emoji.`;

const ask = async <T extends z.ZodType>(schema: T, system: string, user: string): Promise<z.infer<T>> => {
  const apiKey = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  let rawModel = (process.env.ANTHROPIC_MODEL || MODEL).trim();
  if (rawModel === "claude-haiku-4-5" || rawModel === "haiku-4-5" || rawModel === "claude-haiku-4.5") {
    rawModel = "claude-haiku-4-5-20251001";
  } else if (rawModel === "claude-haiku-5-5" || rawModel === "haiku-5-5") {
    rawModel = "claude-haiku-5-5";
  }

  let lastErr: any = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const start = performance.now();
    console.log(`🤖 [DATA FLOW: AI Inference] Calling Anthropic Messages API (attempt ${attempt}, model: ${rawModel})`);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: rawModel,
          max_tokens: 4096,
          system: `${system}\n\nIMPORTANT: You must respond ONLY with strictly valid, raw JSON with NO markdown formatting, NO backticks or code fences, and NO conversational text.`,
          messages: [{ role: "user", content: user }],
          temperature: 0.2,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`❌ [Anthropic Claude Error] HTTP ${res.status}:`, errText);
        throw new Error(`Claude error (${res.status}): ${errText}`);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const duration = Math.round(performance.now() - start);
      console.log(`📥 [DATA RECEIVED: Claude Response] (${duration}ms) Received ${text.length} chars of JSON`);

      const cleanJson = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("❌ [Claude Unreadable JSON]:", text);
        throw new Error("unreadable JSON from Claude");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = schema.parse(parsed);
      console.log("✅ [DATA VALIDATED: Claude JSON]:", validated);
      return validated;
    } catch (err: any) {
      lastErr = err;
      if (attempt < 2) {
        console.warn(`⚠️ [Claude AI Retry] Attempt ${attempt} failed, retrying in 1200ms...`);
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
  }

  throw lastErr;
};

// ── The snapshot schemas & normalization ──

const StrArray = z.preprocess((v) => {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}, z.array(z.string())).default([]);

const SnapshotOut = z.object({
  intent: z.string().nullable().optional(),
  intent_title: z.string().nullable().optional(),
  problem: z.string().nullable().optional(),
  problem_title: z.string().nullable().optional(),
  approach: StrArray,
  approach_inferred: StrArray,
  current_frontier: z.string().nullable().optional(),
  next_step: z
    .preprocess((v) => {
      if (!v) return null;
      if (typeof v === "string") return { text: v.trim(), why_it_may_help: "", from_onairos_nudge: false };
      if (typeof v === "object") {
        const raw = v as any;
        return {
          text: String(raw.text || raw.action || raw.step || "").trim(),
          why_it_may_help: String(raw.why_it_may_help || raw.why || "").trim(),
          from_onairos_nudge: Boolean(raw.from_onairos_nudge),
        };
      }
      return null;
    }, z.object({
      text: z.string(),
      why_it_may_help: z.string().default(""),
      from_onairos_nudge: z.boolean().default(false),
    }))
    .nullable()
    .optional(),
  noticed: z
    .preprocess((v) => {
      if (!Array.isArray(v)) return [];
      return v.map((item) => {
        if (typeof item === "string") return { text: item.trim(), from: [] };
        if (item && typeof item === "object") {
          return {
            text: String(item.text || item.observation || item.note || "").trim(),
            from: Array.isArray(item.from) ? item.from.map(String) : typeof item.from === "string" ? [item.from] : [],
          };
        }
        return { text: String(item).trim(), from: [] };
      }).filter((n) => n.text.length > 0);
    }, z.array(z.object({ text: z.string(), from: z.array(z.string()).default([]) })))
    .default([]),
  takes: z
    .preprocess((v) => {
      if (!v || typeof v !== "object") return { approach: [] };
      const raw = v as any;
      let app = raw.approach;
      if (app && typeof app === "object" && !Array.isArray(app)) {
        app = Object.entries(app).map(([name, take]) => ({ name: String(name), take: String(take) }));
      } else if (Array.isArray(app)) {
        app = app.map((item) => {
          if (typeof item === "string") return { name: item, take: "" };
          return { name: String(item.name || item.lens || ""), take: String(item.take || item.text || "") };
        });
      } else {
        app = [];
      }
      return {
        intent: raw.intent ? String(raw.intent) : null,
        problem: raw.problem ? String(raw.problem) : null,
        current_frontier: raw.current_frontier ? String(raw.current_frontier) : null,
        approach: app,
      };
    }, z.object({
      intent: z.string().nullable().optional(),
      problem: z.string().nullable().optional(),
      current_frontier: z.string().nullable().optional(),
      approach: z.array(z.object({ name: z.string(), take: z.string() })).default([]),
    }))
    .default({ approach: [] }),
});

// ── Dynamic SNAPSHOT_TASK prompt generator ──
// Dynamically builds the system task prompt grounded in the questions from @/contract/residency.
export function buildSnapshotTask(questions: readonly string[] = QUESTIONS): string {
  const qList = questions.length ? questions : QUESTIONS;
  const qPromptList = qList.map((q, idx) => `  Question ${idx + 1}: "${q}"`).join("\n");
  const q1 = qList[0] || "What are you working toward right now, and why does it matter to you?";
  const q2 = qList[1] || "What problem, question, or opportunity are you focused on?";
  const q3 = qList[2] || "How are you approaching it so far and what are you still trying to figure out?";

  return `A resident has just answered ${qList.length} questions, by voice or by typing:
${qPromptList}

Voice answers are machine transcripts and may mishear words (the product is called "Force", so "forest" or "forced" usually means Force). Read all answers together, alongside any authorized Onairos data and public social media/web findings, and write their Intent Snapshot.

How to write each field:
- Write it the way they'd put it on their clearest day. Fix typos and mishearings, use the other answers to make vague words specific, and keep their meaning. Don't add facts they didn't give.
- The questions map to fields like this. Answer 1 is intent. Answer 2 is problem. Answer 3 has two halves: how they're approaching it (approach) and what they're still trying to figure out (current_frontier).
- intent: what they're working toward right now, and why it matters to them. Synthesized primarily from their answer to Question 1: "${q1}". One sentence, starting with an active verb, at most 25 words.
- problem: the problem underneath, who it's for, and why it's worth solving. Synthesized primarily from their answer to Question 2: "${q2}". One sentence, at most 25 words. Grounded in user tension.
- current_frontier: their biggest open question or blocker, written as the sharp question it really is. Synthesized primarily from their answer to Question 3: "${q3}". At most 20 words.
- intent_title, problem_title: two to four words each, a noun phrase for a map node (for example "Proof of demand", "Forgotten decisions").
- approach: one to four concrete lenses they work through: methods, fields, technical choices or research areas, one to three words each (synthesized from Question 3: "${q3}" and across their answers). Include ones that are clearly implied by how they talk about the work, and list any you implied (rather than ones they said) again in approach_inferred. Onairos strengths and public social footprint (e.g. GitHub repos, technical writing, domains they build in) may support a lens they already touched on or ground their engineering/design methodology, but must never introduce an unrelated one by themselves.
- If an answer is empty, or too thin to understand without guessing (like "nothing", "hey"), return null for that field. Never invent or hallucinate.
- next_step: exactly ONE concrete action, starting with an active verb (e.g. Sketch, Audit, Prototype, Test), doable in 10 to 30 minutes, that directly moves their current_frontier. why_it_may_help: at most 20 words, grounded in what they said. If an Onairos suggestion genuinely fits their frontier, adapt it and set from_onairos_nudge true. If there's too little to go on, return null.
- noticed: one to three things you read between the lines by putting the answers (and Onairos, and public social footprint if given) together: a tension, the real question under the stated one, or what their words and public work show about how they work. Second person, at most 25 words each, specific to them. No compliments, no personality labels, no scores. For each, list where it came from, like "Answer 1", "Answer 3", "Onairos: Curiosity", "Public: GitHub", "Public: X", "Public: Substack".
- takes: your own short take on each part (intent, problem, current_frontier, and each approach lens by the same name): what you make of it, what it tells you, or where you'd push. One or two sentences, at most 30 words, second person, an opinion rather than a restatement. Null for any part that's null.

Respond ONLY with a JSON object following this exact structure:
{
  "intent": "Build verifiable autonomous memory agents that empower genuine human agency.",
  "intent_title": "Verifiable Memory Agents",
  "problem": "Bridging abstract cognitive theories into lightweight local systems without bloat.",
  "problem_title": "Lightweight Local Cognition",
  "approach": ["SimpleMem", "TypeScript / Supabase", "Pragmatic HCI"],
  "approach_inferred": ["Pragmatic HCI"],
  "current_frontier": "Designing dynamic graph retrieval that scales gracefully without clutter.",
  "next_step": {
    "text": "Sketch the 3 Supabase tables on paper before coding the local graph.",
    "why_it_may_help": "Clarifies data boundaries and prevents over-engineering.",
    "from_onairos_nudge": false
  },
  "noticed": [
    { "text": "You talk about architecture to solve what is essentially an interface clarity problem.", "from": ["Answer 1", "Answer 3"] }
  ],
  "takes": {
    "intent": "Clear ambition. Don't let theoretical purity delay running user tests.",
    "problem": "Real pain point. Focus on local latency first.",
    "current_frontier": "Keep the graph flat until user queries demand deep nesting.",
    "approach": [
      { "name": "SimpleMem", "take": "Good lightweight anchor." },
      { "name": "TypeScript / Supabase", "take": "Pragmatic baseline." }
    ]
  }
}`;
}

export const SNAPSHOT_TASK = buildSnapshotTask(QUESTIONS);

// themes: the approach names already in the residency, so shared lenses meet on the map.
export async function readSnapshot(i: SynthInput, base: Snapshot, themes: string[] = []): Promise<Snapshot> {
  const o = i.onairos;
  const questionsList = (i.questions && i.questions.length > 0) ? i.questions : QUESTIONS;
  const parts = [
    ...questionsList.map((q, k) => `Question ${k + 1}: ${q}\nAnswer ${k + 1}: ${(i.answers[k] ?? "").trim() || "(no answer)"}`),
    `They can help others with: ${i.contribution.can_offer.join(", ") || "(skipped)"}`,
    `They would value help with: ${i.contribution.seeking.join(", ") || "(skipped)"}`,
    o
      ? `Onairos (an inference from a ${o.coverage.label ?? "partial"} sample of their apps, not fact):\nSummary: ${o.summary ?? "none"}\nStrengths: ${o.positive.map((t) => `${t.name}${t.evidence ? ` (${t.evidence})` : ""}`).join("; ") || "none"}\nSuggestions: ${o.nudges.join(" | ") || "none"}`
      : "Onairos: not connected.",
    i.public?.length ? `What's public about them, which they asked Force to read (an outside view; use it to understand them, quote it only through "noticed" sources like "Public: GitHub"):\n${i.public.map((f) => `- ${f.label}: ${f.text} (${f.sources.map((x) => x.title).join(", ")})`).join("\n")}` : "",
    i.voice?.length ? `How they said it (measured from their recordings; mention only a clear difference between answers, sourced like "Voice: answer 3"):\n${i.voice.map((v) => `- Answer ${v.answer}: ${Math.round(v.secs)}s, ${v.pace ? `${v.pace} words a minute` : "pace unknown"}, ${v.pauses} pauses, longest ${v.longest_pause.toFixed(1)}s`).join("\n")}` : "",
    themes.length ? `Approach names other residents already use (reuse one exactly when it genuinely fits; otherwise name your own): ${themes.join(", ")}` : "",
  ].filter(Boolean);

  const dynamicTask = buildSnapshotTask(questionsList);
  const out = await ask(SnapshotOut, `${FORCE}\n\n${dynamicTask}`, `Resident: ${i.name || "unnamed"}\n\n${parts.join("\n\n")}`);
  const approach = (out.approach || []).map((a: string) => a.trim()).filter(Boolean).slice(0, 4);
  const provenance: Snapshot["provenance"] = { ...base.provenance };
  if (out.intent) provenance.intent = ["user_answer:q1"];
  else delete provenance.intent;
  if (out.problem) provenance.problem = ["user_answer:q2"];
  else delete provenance.problem;
  if (out.current_frontier) provenance.current_frontier = ["user_answer:q3"];
  else delete provenance.current_frontier;
  if (approach.length) {
    const prov: Source[] = ["user_answer"];
    if (o?.positive.length) prov.push("onairos:positive_traits");
    if (i.public?.length) prov.push("public:footprint");
    provenance.approach = prov;
  } else {
    delete provenance.approach;
  }

  return {
    ...base,
    intent: out.intent ?? null,
    problem: out.problem ?? null,
    current_frontier: out.current_frontier ?? null,
    approach,
    inferred: approach.filter((a: string) => (out.approach_inferred || []).some((x: string) => x.trim().toLowerCase() === a.toLowerCase())),
    provenance,
    next_step: out.next_step ? { text: out.next_step.text.replace(/\.$/, ""), why_it_may_help: out.next_step.why_it_may_help, status: "suggested", source: out.next_step.from_onairos_nudge ? "onairos_nudge" : "force" } : null,
    titles: { intent: out.intent_title ?? undefined, problem: out.problem_title ?? undefined },
    noticed: (out.noticed || []).slice(0, 3),
    takes: {
      intent: out.takes?.intent ?? undefined,
      problem: out.takes?.problem ?? undefined,
      current_frontier: out.takes?.current_frontier ?? undefined,
      approach: Object.fromEntries((out.takes?.approach || []).filter((x: any) => approach.some((a: string) => a.toLowerCase() === x.name.trim().toLowerCase())).map((x: any) => [approach.find((a: string) => a.toLowerCase() === x.name.trim().toLowerCase())!, x.take])),
    },
    public_findings: i.public,
    source: "model",
  };
}

// ── Connections ──

const TYPES = ["shared_problem", "complementary_approach", "shared_exploration", "potential_contribution"] as const;
const VALID_TYPES = new Set(TYPES);
const FIELD_KEYS = ["intent", "problem", "approach", "current_frontier", "contribution"] as const;

const normalizeType = (t: any): ConnectionType => {
  if (typeof t === "string") {
    const s = t.toLowerCase().trim().replace(/[-\s]+/g, "_");
    if (VALID_TYPES.has(s as any)) return s as ConnectionType;
    if (s.includes("problem")) return "shared_problem";
    if (s.includes("complement") || s.includes("approach")) return "complementary_approach";
    if (s.includes("explor")) return "shared_exploration";
    if (s.includes("contribut") || s.includes("offer") || s.includes("seek")) return "potential_contribution";
  }
  return "shared_problem";
};

const normalizeEvidence = (ev: any, fallbackField: Field = "problem") => {
  if (!ev) return { field: fallbackField, text: "" };
  if (typeof ev === "string") return { field: fallbackField, text: ev.trim() };
  let f = (ev.field || ev.target || fallbackField).toString().toLowerCase().trim();
  if (f.includes("q1") || f.includes("intent")) f = "intent";
  else if (f.includes("q2") || f.includes("problem")) f = "problem";
  else if (f.includes("q3") || f.includes("frontier") || f.includes("blocker")) f = "current_frontier";
  else if (f.includes("approach")) f = "approach";
  else if (f.includes("contribution") || f.includes("offer") || f.includes("seek")) f = "contribution";
  const field = (FIELD_KEYS.includes(f as any) ? f : fallbackField) as Field;
  return { field, text: String(ev.text || ev.quote || ev.content || "").trim() };
};

const ConnectionItemOut = z.preprocess((v: any) => {
  if (!v || typeof v !== "object") return null;
  const resident_id = String(v.resident_id || v.id || v.userId || v.user_id || "");
  const type = normalizeType(v.type || v.connection_type || v.category || v.kind);
  const why_connected = String(v.why_connected || v.reason || v.why || "").trim();
  const what_to_explore = String(v.what_to_explore || v.topic || v.question || "").trim();
  const your_evidence = normalizeEvidence(v.your_evidence || v.my_evidence || v.evidence?.you || v.evidence?.me, "intent");
  const their_evidence = normalizeEvidence(v.their_evidence || v.other_evidence || v.evidence?.them || v.evidence?.other, "problem");
  const opener = String(v.opener || v.first_message || v.draft_opener || "").trim();
  return {
    resident_id,
    type,
    why_connected,
    what_to_explore,
    your_evidence,
    their_evidence,
    opener,
  };
}, z.object({
  resident_id: z.string(),
  type: z.enum(TYPES),
  why_connected: z.string(),
  what_to_explore: z.string(),
  your_evidence: z.object({ field: z.enum(FIELD_KEYS), text: z.string() }),
  their_evidence: z.object({ field: z.enum(FIELD_KEYS), text: z.string() }),
  opener: z.string(),
}));

const ConnectionsOut = z.object({
  connections: z.preprocess((v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === "object" && Array.isArray((v as any).connections)) return (v as any).connections.filter(Boolean);
    return [];
  }, z.array(ConnectionItemOut)).default([]),
});

const CONNECT_TASK = `You suggest connections between residents, from their approved Intent Snapshots only.

For the resident you're writing to ("you"), look at each other resident and connect them only when there is a clear, specific reason in both snapshots. The kinds:
- shared_problem: both are working on materially the same underlying problem.
- complementary_approach: their approaches or skills could complement each other on what they're making.
- shared_exploration: they're actively exploring a related open question.
- potential_contribution: one person's explicitly stated offer may meet the other's explicitly stated need.

Rules:
- At most three connections, strongest first.
- Zero is a good answer when nothing is clear; never connect people just to fill the list.
- why_connected: one sentence of 8 to 20 words, addressed to "you", naming what you and they share in plain words.
- what_to_explore: one question the two of them could talk through.
- Evidence: for each side, the field it comes from and a short quote (at most 16 words) close to that snapshot's own words.
- opener: the first message "you" could send them, in a resident's own casual voice, at most 40 words: name the specific thing you share, then one small, concrete ask (ten minutes, a coffee, one question). No greetings like "I hope you're well", no flattery.

Respond ONLY with a JSON object following this exact structure:
{
  "connections": [
    {
      "resident_id": "r_...",
      "type": "shared_problem",
      "why_connected": "You are both building verifiable local memory engines to eliminate synthetic agent hallucination.",
      "what_to_explore": "How to structure graph index caching without consuming local RAM.",
      "your_evidence": { "field": "intent", "text": "Build verifiable autonomous memory agents" },
      "their_evidence": { "field": "problem", "text": "Eliminating memory retrieval latency in local systems" },
      "opener": "Hey, noticed we're both tackling local memory graph scaling. Want to compare caching strategies over coffee tomorrow?"
    }
  ]
}`;

const view = (s: Snapshot) =>
  `id: ${s.resident_id}\nname: ${s.name}\nintent: ${s.intent ?? "unknown"}\nproblem: ${s.problem ?? "unknown"}\napproach: ${s.approach.join(", ") || "unknown"}\ncurrent_frontier: ${s.current_frontier ?? "unknown"}\ncan offer: ${s.contribution?.can_offer?.join(", ") || "none"}\nseeking: ${s.contribution?.seeking?.join(", ") || "none"}`;

export async function readConnections(me: Snapshot, others: Snapshot[]): Promise<Connection[]> {
  if (!others.length) return [];
  const out = await ask(ConnectionsOut, `${FORCE}\n\n${CONNECT_TASK}`, `You:\n${view(me)}\n\nOther residents:\n\n${others.map(view).join("\n\n")}`);
  const byId = new Map(others.map((s) => [s.resident_id, s]));
  return (out.connections || [])
    .filter((c: any) => byId.has(c.resident_id) && c.resident_id !== me.resident_id)
    .slice(0, 3)
    .map((c: any) => {
      const o = byId.get(c.resident_id)!;
      return {
        id: `auto_${me.resident_id}_${o.resident_id}`,
        source: `person_${me.resident_id}`,
        target: `person_${o.resident_id}`,
        type: c.type as ConnectionType,
        why_connected: c.why_connected.trim(),
        what_to_explore: c.what_to_explore.trim(),
        evidence_refs: [me.id, o.id],
        evidence: [
          { snapshot_id: me.id, field: c.your_evidence.field as Field, text: c.your_evidence.text },
          { snapshot_id: o.id, field: c.their_evidence.field as Field, text: c.their_evidence.text },
        ],
        origin: "automated" as const,
        opener: c.opener.trim(),
      };
    });
}

// ── What's public about you ──

const FootprintSource = z.preprocess((val) => {
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return { title: "Web", url: "" };
    const isHttp = /^https?:\/\//i.test(trimmed);
    if (isHttp) {
      try {
        const u = new URL(trimmed);
        return {
          title: u.hostname.replace(/^www\./i, ""),
          url: trimmed,
        };
      } catch {
        return { title: trimmed.split("/")[0] || "Web", url: trimmed };
      }
    }
    if (trimmed.includes(".") && !trimmed.includes(" ")) {
      return {
        title: trimmed.split("/")[0],
        url: `https://${trimmed}`,
      };
    }
    return {
      title: trimmed,
      url: "",
    };
  }
  if (typeof val === "object" && val !== null) {
    const o = val as Record<string, any>;
    const title = String(o.title || o.name || o.label || o.platform || "Web").trim();
    let url = String(o.url || o.link || o.href || "").trim();
    if (url && !/^https?:\/\//i.test(url) && (url.includes(".") || url.includes("/"))) {
      url = `https://${url}`;
    }
    return { title: title || "Web", url };
  }
  return { title: "Web", url: "" };
}, z.object({
  title: z.string().default("Web"),
  url: z.string().default(""),
}));

const FootprintOut = z.object({
  findings: z
    .preprocess((val) => (Array.isArray(val) ? val : []), z.array(
      z.object({
        label: z.preprocess((v) => String(v ?? "Known for").trim() || "Known for", z.string()),
        text: z.preprocess((v) => String(v ?? "").trim(), z.string()),
        sources: z
          .preprocess((val) => {
            if (Array.isArray(val)) return val;
            if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean);
            if (val && typeof val === "object") return [val];
            return [];
          }, z.array(FootprintSource))
          .default([]),
      })
    ))
    .default([]),
  read: z
    .preprocess((val) => {
      if (Array.isArray(val)) return val.map((x) => String(x ?? "").trim()).filter(Boolean);
      if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean);
      return [];
    }, z.array(z.string()))
    .default([]),
});

const FOOTPRINT_TASK = `The resident has asked Force to read what's public about them, so it can understand them better before the residency.
Start from the links and name they gave. Synthesize what's visible publicly about their work, background, and interests.
Never include private details: home address, phone, email, family, finances, or health.
Return 3 to 6 findings with:
- "label": Short phrase, e.g. "Known for", "Makes", "Writes about", "Into"
- "text": 1 to 2 grounded sentences about their public work or interests
- "sources": Array of objects: [{ "title": "Platform Name (e.g. GitHub, Instagram)", "url": "https://..." }]
- "read": Array of source names checked (e.g. ["GitHub", "Twitter", "Instagram"])`;

export async function readFootprint(name: string, links: string[]): Promise<{ findings: Finding[]; read: string[] }> {
  let enrichedInfo = "";
  const ghLink = links.find((l) => /github\.com/i.test(l));
  if (ghLink) {
    try {
      const { fetchGitHubProfile } = await import("@/lib/enrichment/github-client");
      const gh = await fetchGitHubProfile(ghLink);
      if (gh.success && gh.data) {
        enrichedInfo += `\nVerified GitHub Technical Footprint:
- Bio: ${gh.data.bio || "none"}
- Primary Languages: ${gh.data.top_languages.join(", ") || "none"}
- Top Repositories: ${gh.data.top_repositories.slice(0, 5).map((r) => `${r.name} (${r.language || "code"}${r.description ? `: ${r.description}` : ""})`).join("; ")}`;
      }
    } catch {
      // Non-blocking fallback
    }
  }

  const user = `Name: ${name}\nLinks they gave:\n${links.length ? links.map((l: string) => `- ${l}`).join("\n") : "- none"}${enrichedInfo}`;
  const out = await ask(FootprintOut, `${FORCE}\n\n${FOOTPRINT_TASK}`, user);
  return {
    findings: (out.findings || []).slice(0, 6).map((f: any, i: number) => {
      const sources: { title: string; url: string }[] = (f.sources || []).map((s: { title: string; url: string }) => {
        let u = s.url;
        if (!u || !/^https?:\/\//i.test(u)) {
          const matchedLink = links.find((l) => {
            const cleanL = l.toLowerCase();
            const cleanT = (s.title || "").toLowerCase();
            return cleanL.includes(cleanT) || (cleanT.length > 2 && cleanT.includes(cleanL));
          });
          if (matchedLink) {
            u = /^https?:\/\//i.test(matchedLink) ? matchedLink : `https://${matchedLink}`;
          } else if (u) {
            u = `https://${u}`;
          } else if (links.length > 0) {
            const first = links[0];
            u = /^https?:\/\//i.test(first) ? first : `https://${first}`;
          } else {
            u = "https://force.computer";
          }
        }
        return {
          title: s.title || "Web",
          url: u,
        };
      }).slice(0, 4);

      return {
        id: `f${i}`,
        label: f.label.trim(),
        text: f.text.trim(),
        sources: sources.length > 0 ? sources : links.slice(0, 1).map((l) => ({
          title: "Public Link",
          url: /^https?:\/\//i.test(l) ? l : `https://${l}`,
        })),
      };
    }),
    read: (out.read || []).map((x: any) => String(x).trim()).filter((x: string) => x && x.length <= 32).slice(0, 6),
  };
}

// ── Companion Agent ──
// Direct conversation with Force on the canvas. Force knows the resident's longitudinal
// memory, intent snapshot, cognitive style, and open questions, speaking with warmth,
// insight, and brevity.

const CompanionReplyOut = z.object({
  text: z.string().describe("Force's grounded companion response, 1-3 sentences, direct, warm, witty, specific to who they are"),
  options: z.array(z.object({
    label: z.string().describe("Short 1-4 word quick reply choice for the resident"),
    go: z.string().nullable().optional().describe("Optional navigation target: 'pattern', 'energy', 'persona', 'memory', or 'connection:<resident_id>'"),
  })).nullable().optional(),
  note: z.string().nullable().optional().describe("Optional concise memory note (under 6 words, e.g. 'Noted: local SQLite caching') when a key decision or insight is articulated"),
  memory_update: z.object({
    current_frontier: z.string().nullable().optional().describe("Updated open question or blocker if the user articulated one"),
    next_step: z.string().nullable().optional().describe("Immediate next action if decided"),
  }).nullable().optional(),
});

export type CompanionReply = z.infer<typeof CompanionReplyOut>;

const DHUN_COHORT_SUMMARY = `
- Shriyanshi (id: user_shriyanshi): Cognitive Psychology & Mentalizing Boundaries. Can offer: Cognitive psychology critique, behavioral analysis. Seeking: Intentional UX patterns.
- Dev (id: user_dev): AI tutor pilots in rural schools, hardware prototypes. Can offer: Edge prototypes, education testing.
- Kabir (id: user_kabir): Sensor prototypes & environmental telemetry. Can offer: Embedded hardware, sensors.
- Meera (id: user_meera): Community research & field interviews with farmers. Can offer: Field interviews, user research.
- Ananya (id: user_ananya): Cultural research & book chapters. Can offer: Editorial writing, narrative framing.
`;

export async function readCompanionReply(input: {
  message: string;
  kind?: string;
  history?: Array<{ from: "me" | "force"; text: string }>;
  user_context?: {
    name?: string;
    resident_id?: string;
    intent?: string | null;
    problem?: string | null;
    approach?: string[];
    archetype?: string | null;
    positive_traits?: any;
    user_summary?: string | null;
    top_traits_explanation?: string | null;
    nudges?: any;
    current_frontier?: string | null;
    contribution?: { can_offer?: string[]; seeking?: string[] };
    noticed?: any;
    next_step?: any;
    raw_answers?: string[];
    recent_entries?: Array<{ date?: string; title?: string; content?: string }>;
    links?: Record<string, string>;
  };
}): Promise<CompanionReply> {
  const ctx = input.user_context || {};
  const name = ctx.name || "Resident";

  let traitsDesc = "";
  if (Array.isArray(ctx.positive_traits)) {
    traitsDesc = ctx.positive_traits.map((t: any) => `${t.name || t.trait || "Trait"} (${t.strength || t.score || 80}%)`).join(", ");
  } else if (ctx.positive_traits && typeof ctx.positive_traits === "object") {
    traitsDesc = Object.entries(ctx.positive_traits).map(([k, v]) => `${k} (${v}%)`).join(", ");
  }

  const prompt = `${FORCE}

You are in a live, direct 1-on-1 companion conversation with ${name} at the Dhun residency.

RESIDENT LONGITUDINAL MEMORY & PROFILE:
- Name: ${name}
- Primary Intent: ${ctx.intent || "Clarifying and building their core creative/technical work"}
- Core Problem / Obstacle: ${ctx.problem || "Working through technical or creative challenges"}
- Working Approach & Themes: ${Array.isArray(ctx.approach) ? ctx.approach.join(", ") : "Exploratory"}
- Cognitive Archetype: ${ctx.archetype || "Creative Explorer"}
- Behavioral Strengths / Traits: ${traitsDesc || "Intuitive and exploratory problem solving"}
- User Summary: ${ctx.user_summary || "Independent thinker and builder"}
- Current Frontier / Open Questions: ${ctx.current_frontier || "Navigating the next milestone"}
- Can Offer: ${ctx.contribution?.can_offer?.join(", ") || "Skills and perspectives"}
- Seeking: ${ctx.contribution?.seeking?.join(", ") || "Feedback and introductions"}
${ctx.next_step?.text ? `- Suggested Next Step: ${ctx.next_step.text}` : ""}
${ctx.recent_entries?.length ? `- Recent Journal Moments: ${ctx.recent_entries.map((e) => `[${e.date || "recent"}] ${e.title || ""}: ${e.content || ""}`).slice(0, 3).join("; ")}` : ""}

DHUN COHORT RESIDENTS (Peers nearby in the residency):${DHUN_COHORT_SUMMARY}

ROLE & VOICE INSTRUCTIONS:
- You know ${name}. When appropriate, naturally weave in what they're building, their strengths, or their approach. Never recite their profile mechanically.
- Keep your reply to 1 to 3 punchy sentences (under 60 words). Two or three lines at most; anything longer belongs in a thread.
- Sound like a sharp, trusted friend who understands their ambition.
- Zero corporate HR speak, no sycophantic praise, no generic assistant clichés ("How can I help you today?", "I understand that must be difficult").
- Cohort Cross-pollination: If ${name} mentions needing a skill, feedback, or tackling an area where another Dhun resident has expertise or interest, mention them naturally by name (e.g., "Shriyanshi is thinking about mentalizing boundaries and offered cognitive critique—want to compare notes?").
- Actionable Options: Provide 0 to 2 short quick-reply options (under 4 words each) in the "options" array. When relevant, you can include "go": "connection:user_shriyanshi", "go": "energy", "go": "pattern", or "go": "persona".
- Memory Capture: When ${name} articulates a key breakthrough, design decision, or direction (e.g. choosing SQLite, isolating the latency loop), provide a concise "note" (under 6 words, e.g. "Noted: local SQLite caching") so it gets preserved into their memory stream.

Format response as strictly valid JSON:
{
  "text": "Your sharp, grounded response",
  "options": [ { "label": "...", "go": "..." } ],
  "note": "Optional short memory note",
  "memory_update": { "current_frontier": "..." }
}`;

  const historyLines = (input.history || [])
    .slice(-8)
    .map((m) => `${m.from === "me" ? name : "Force"}: ${m.text}`)
    .join("\n");

  const user = `Conversation history:
${historyLines || "(Beginning of conversation)"}

${name} says:
"${input.message}"`;

  return await ask(CompanionReplyOut, prompt, user);
}

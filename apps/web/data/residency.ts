// The residency: everyone here is already on Force. The questions, the snapshot and the graph
// follow the v1.1 contract in contract/residency.ts; this file holds what the screens need
// around it: link kinds, faces, and the residents' painted covers. The pattern maps are drawn
// from real snapshots and the cohort graph, never from made-up patterns.

import type { Art } from "./mira";
import type { Person } from "./social";
import { CONNECTION_LABEL, condense, isConnection, personId, type Connection, type Graph, type Snapshot } from "@/contract/residency";

export { QUESTIONS } from "@/contract/residency";

export type LinkKind = "linkedin" | "x" | "instagram" | "github" | "site";
// Each link is a glass bubble with its own crop of a painting inside.
export const LINKS: { kind: LinkKind; name: string; art: Art; x: number; y: number }[] = [
  { kind: "linkedin", name: "LinkedIn", art: "water", x: 30, y: 60 },
  { kind: "x", name: "X", art: "dusk", x: 50, y: 30 },
  { kind: "instagram", name: "Instagram", art: "hills", x: 72, y: 22 },
  { kind: "github", name: "GitHub", art: "park", x: 45, y: 35 },
  { kind: "site", name: "Website or Substack", art: "meadow", x: 55, y: 30 },
];
// Your own face in the residency, until there's a photo: a crop of the park painting.
export const ME_FACE = { art: "park" as Art, x: 45, y: 30 };

// A pasted link, shown as the handle it points to: no https, no www, no trailing slash.
export function pretty(kind: LinkKind | "extra", raw: string) {
  const s = raw.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[/?#].*$/, (m) => (kind === "site" || kind === "extra" ? "" : m)).replace(/\/+$/, "");
  const after = (re: RegExp) => s.replace(re, "").split(/[/?#]/)[0];
  if (kind === "linkedin") return after(/^[a-z.]*linkedin\.com\/(in\/)?/i);
  if (kind === "x") return `@${after(/^(x|twitter)\.com\//i).replace(/^@/, "")}`;
  if (kind === "instagram") return `@${after(/^instagram\.com\//i).replace(/^@/, "")}`;
  if (kind === "github") return after(/^github\.com\//i);
  return s;
}

// ── Pattern maps as nodes ──
// The founder's three kinds: a person, what they want to change (intent & problem), and the
// themes & approaches around it, which is where people meet. The map shows each node's
// title (a few words); opening it shows the whole thought and where it came from.
export type NodeKind = "you" | "intent" | "theme" | "person";
export interface WNode {
  id: string;
  kind: NodeKind;
  title: string; // a few words: what the map shows
  label: string; // the whole thought, for when you open it
  line?: string; // what it means, in a sentence
  from?: string; // where it came from
  art: Art;
  person?: string; // a resident's id
}

const ARTS: Art[] = ["meadow", "hills", "water", "park", "dusk"];
const artOf = (s: string) => ARTS[[...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % ARTS.length];
// The first few words, ending on a word that carries meaning: "Run an AI tutor", not "Run an AI".
const title = (s: string, n = 4) => {
  const w = condense(s, n).replace(/…$/, "").replace(/[,.;:?!]+$/, "").split(" ");
  while (w.length > 2 && /^(of|a|an|the|and|to|in|for|on|with|that|my|our|is|are)$/i.test(w[w.length - 1])) w.pop();
  return w.join(" ");
};
const faceOf = (resident: string) => residentById(resident)?.face.art;

// Yours: you, your intent and problem, the approaches around them, and the residents Force
// connected you with, each hanging off what you share.
export function youWorld(s: Snapshot | null, name: string, mine: Connection[] = [], dynamicList?: Resident[]): { nodes: WNode[]; edges: [string, string][] } {
  const first = name.trim().split(/\s+/)[0] || "You";
  const nodes: WNode[] = [{ id: "you", kind: "you", title: first, label: name.trim() || "You", line: s?.noticed?.[0]?.text, from: s?.noticed?.[0] ? `From ${s.noticed[0].from.join(", ")}` : undefined, art: ME_FACE.art }];
  const edges: [string, string][] = [];
  if (!s) return { nodes, edges };
  if (s.intent) {
    nodes.push({ id: "intent", kind: "intent", title: s.titles?.intent ?? title(s.intent), label: s.intent, line: s.takes?.intent, from: s.provenance.intent?.includes("user_edit") ? "You wrote this" : "Your answer to question 1", art: "water" });
    edges.push(["you", "intent"]);
  }
  if (s.problem) {
    nodes.push({ id: "problem", kind: "intent", title: s.titles?.problem ?? title(s.problem), label: s.problem, line: s.takes?.problem, from: s.provenance.problem?.includes("user_edit") ? "You wrote this" : "Your answer to question 2", art: "hills" });
    edges.push(["you", "problem"]);
  }
  if (s.current_frontier) {
    nodes.push({ id: "frontier", kind: "intent", title: "Open question", label: s.current_frontier, line: s.takes?.current_frontier, from: s.provenance.current_frontier?.includes("user_edit") ? "You wrote this" : "Your answer to question 3", art: "park" });
    edges.push([s.intent ? "intent" : "you", "frontier"]);
  }
  const hub = s.intent ? "intent" : s.problem ? "problem" : "you";
  s.approach.forEach((a) => {
    nodes.push({ id: `theme:${a}`, kind: "theme", title: a, label: a, line: s.takes?.approach?.[a], from: s.inferred.includes(a) ? "Read from your wording, so check it" : "You confirmed this", art: artOf(a) });
    edges.push([hub, `theme:${a}`]);
  });
  mine.forEach((c) => {
    const other = c.source === personId(s.resident_id) ? c.target : c.source;
    const rid = other.replace(/^person_/, "");
    const p = residentById(rid, dynamicList);
    if (!p) return;
    const shared = c.type === "complementary_approach" ? s.approach.find((a) => nodes.some((n) => n.id === `theme:${a}`)) : undefined;
    const at = shared ? `theme:${shared}` : c.type === "shared_problem" && s.problem ? "problem" : hub;
    nodes.push({ id: `p:${rid}`, kind: "person", title: p.name, label: p.name, line: c.why_connected, from: CONNECTION_LABEL[c.type], art: p.face.art, person: rid });
    edges.push([at, `p:${rid}`]);
  });
  return { nodes, edges };
}

// The cohort: every resident who approved and shared, their intents, the themes between
// them, and the connections. Built only from what GET /api/residency/graph returns.
export function cohortWorld(g: Graph, me: string): { nodes: WNode[]; edges: [string, string][] } {
  const nodes: WNode[] = g.nodes.map((n) =>
    n.type === "person"
      ? { id: n.id, kind: n.resident_id === me ? "you" : "person", title: n.resident_id === me ? "You" : n.label, label: n.label, art: n.resident_id === me ? ME_FACE.art : (faceOf(n.resident_id!) ?? artOf(n.id)), person: n.resident_id }
      : n.type === "intent_problem"
        ? { id: n.id, kind: "intent", title: title(n.label), label: n.label, line: n.resident_id === me ? "What you want to make progress on." : `What ${residentById(n.resident_id!)?.name ?? "they"} want${residentById(n.resident_id!) ? "s" : ""} to make progress on.`, art: n.resident_id === me ? "meadow" : (faceOf(n.resident_id!) ?? artOf(n.id)), person: n.resident_id }
        : { id: n.id, kind: "theme", title: n.label, label: n.label, line: "A theme or approach.", art: artOf(n.label) },
  );
  const edges: [string, string][] = g.edges.map((e) => [e.source, e.target]);
  return { nodes, edges };
}

export const connectionsIn = (g: Graph) => g.edges.filter(isConnection);

// The residency. Faces are painting crops until the real photos come in. What each resident
// is working on comes from their approved snapshot; this is only how they look and talk.
export interface Resident extends Person {
  pattern?: string;
  work: string; // what they're working on, in a line
  quest?: string; // a side quest you two could do, shown as a preview after the residency
  socials: LinkKind[]; // where else they are
}

const r = (p: Partial<Resident> & { id: string; name: string; art: Art; face: { art: Art; x: number; y: number }; work: string }): Resident => ({
  energy: 0.6,
  socials: ["linkedin", "instagram"],
  age: 0,
  where: "In the residency",
  km: 0,
  story: p.work,
  differs: "",
  words: "",
  shares: "",
  together: p.together || `Explore ${p.work}`,
  quests: p.quests || [{ name: p.pattern || "Exploration", art: p.art }],
  reply: p.reply || `Hi! I saw you're working on ${p.work}.`,
  pattern: p.pattern || "Exploration",
  ...p,
});

export const DHUN_REAL_RESIDENTS: Resident[] = [
  r({
    id: "user_srinjoy",
    name: "Srinjoy Chakravarty",
    art: "water",
    face: { art: "water", x: 45, y: 35 },
    work: "Autonomous memory agents and verifiable SimpleMem",
    pattern: "Autonomous memory",
    together: "Explore verifiable SimpleMem architectures and graph retrieval",
    socials: ["github", "x", "site"],
  }),
  r({
    id: "user_shriyanshi",
    name: "Shriyanshi",
    art: "meadow",
    face: { art: "meadow", x: 30, y: 25 },
    work: "Cognitive psychology and mentalizing boundaries in AI",
    pattern: "Cognitive psychology",
    together: "Explore reflective boundaries and human agency",
    socials: ["linkedin", "site"],
  }),
  r({
    id: "user_rohit",
    name: "Rohit Modi",
    art: "hills",
    face: { art: "hills", x: 60, y: 60 },
    work: "Zero-knowledge security, auth and state persistence",
    pattern: "Security & state",
    together: "Explore local state synchronization and Supabase persistence",
    socials: ["linkedin", "github"],
  }),
  r({
    id: "user_arushi",
    name: "Arushi Upmanyu",
    art: "dusk",
    face: { art: "dusk", x: 20, y: 70 },
    work: "Spatial UI and tactile cognitive interfaces",
    pattern: "Spatial UI",
    together: "Explore multi-lens projection and tactile UI design",
    socials: ["instagram", "site"],
  }),
];

export function residentFromSnapshot(s: Snapshot): Resident {
  const art = artOf(s.name || s.resident_id);
  const work = s.titles?.intent || s.intent || s.problem || "Residency participant";
  const pattern = s.approach?.[0] || "Exploration";
  return r({
    id: s.resident_id,
    name: s.name,
    art,
    face: { art, x: 45, y: 35 },
    work,
    pattern,
    together: s.next_step?.text || `Explore ${work.toLowerCase().slice(0, 50)}`,
    socials: ["linkedin", "x", "github"],
    reply: `Hi! I saw you're working on ${work}.`,
  });
}

export const RESIDENTS: Resident[] = DHUN_REAL_RESIDENTS;

export function residentById(id: string, dynamicList?: Resident[]): Resident | null {
  if (dynamicList && dynamicList.length > 0) {
    const found = dynamicList.find((x) => x.id === id || x.id === `user_${id}` || id.includes(x.id));
    if (found) return found;
  }
  const real = DHUN_REAL_RESIDENTS.find((x) => x.id === id || x.id === `user_${id}` || id.includes(x.id));
  if (real) return real;
  return null;
}


export interface Found {
  id: string;
  source: string;
  title?: string;
  quote?: string;
  text?: string;
  byName?: boolean;
  art?: Art;
  url?: string;
}

export const SAMPLE_ANSWERS = [
  "By the end of this residency, I want to build verifiable autonomous memory agents.",
  "Bridging cognitive theories into verifiable lightweight local systems for genuine human agency.",
  "Designing dynamic graph retrieval that scales gracefully without cluttering mental bandwidth.",
];

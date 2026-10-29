import type { Art } from "./mira";
import type { Person } from "./social";

export const QUESTIONS = [
  "What are you working on here? A sentence or two is plenty.",
  "What's the part of it you keep coming back to, even when nobody asks?",
  "What would make this residency a win for you, beyond the work?",
] as const;

export const SAMPLE_ANSWERS = [
  "I'm building a tool that helps small farmers price their crops before they go to market.",
  "Honestly the calls. I keep going back to talking to the people themselves, even when I should be writing code.",
  "If I leave with two or three people I'd call at midnight about this, that's a win.",
];

export type LinkKind = "linkedin" | "x" | "instagram" | "github" | "site";

export const LINKS: { kind: LinkKind; name: string; art: Art; x: number; y: number }[] = [
  { kind: "linkedin", name: "LinkedIn", art: "water", x: 30, y: 60 },
  { kind: "x", name: "X", art: "dusk", x: 50, y: 30 },
  { kind: "instagram", name: "Instagram", art: "hills", x: 72, y: 22 },
  { kind: "github", name: "GitHub", art: "park", x: 45, y: 35 },
  { kind: "site", name: "Website or Substack", art: "meadow", x: 55, y: 30 },
];

export const ME_FACE = { art: "park" as Art, x: 45, y: 30 };

export function pretty(kind: LinkKind | "extra", raw: string) {
  const s = raw.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[/?#].*$/, (m) => (kind === "site" || kind === "extra" ? "" : m)).replace(/\/+$/, "");
  const after = (re: RegExp) => s.replace(re, "").split(/[/?#]/)[0];
  if (kind === "linkedin") return after(/^[a-z.]*linkedin\.com\/(in\/)?/i);
  if (kind === "x") return `@${after(/^(x|twitter)\.com\//i).replace(/^@/, "")}`;
  if (kind === "instagram") return `@${after(/^instagram\.com\//i).replace(/^@/, "")}`;
  if (kind === "github") return after(/^github\.com\//i);
  return s;
}

const FROM_LINK: Record<LinkKind, string> = {
  linkedin: "Founder, Mandi Price. Product at a food delivery company.",
  x: "Posts mostly about farming, pricing and local infrastructure.",
  instagram: "Photos from visits around rural clusters.",
  github: "Twelve public repositories, mostly Python and local bots.",
  site: "Three essays on how small producers set prices.",
};

export interface Found {
  id: string;
  source: string;
  text: string;
  byName?: boolean;
}

export function foundFor(name: string, links: Partial<Record<LinkKind, string>>): Found[] {
  const first = name.trim() || "Someone with your name";
  const out: Found[] = LINKS.filter((l) => links[l.kind]?.trim()).map((l) => ({ id: l.kind, source: l.name, text: FROM_LINK[l.kind] }));
  out.push({ id: "talk", source: "Search", text: "Spoke on a panel about rural technology in 2024.", byName: true });
  out.push({ id: "namesake", source: "Search", text: `${first}, co-founder of a payments startup.`, byName: true });
  return out;
}

export const TRAITS: { name: string; level: string; line: string }[] = [
  { name: "Openness", level: "High", line: "You go looking for new ways in." },
  { name: "Conscientiousness", level: "In bursts", line: "Deep focus, then a reset." },
  { name: "Extraversion", level: "Middle", line: "One-to-one lifts you; rooms drain you." },
  { name: "Agreeableness", level: "High", line: "You lead with the other person's side." },
  { name: "Emotional range", level: "Steady", line: "Short fuse only for wasted time." },
];

export function traitsFromOnairos(data: any): { name: string; level: string; line: string }[] {
  if (!data) return TRAITS;
  const p = data.traits || data.personality || data;
  if (!p || typeof p !== "object") return TRAITS;

  const scoreOf = (key: string): number => {
    const val = p[key] ?? p[key.toLowerCase()] ?? p[`${key}_score`];
    return typeof val === "number" ? val : 0.5;
  };

  const o = scoreOf("openness");
  const c = scoreOf("conscientiousness");
  const e = scoreOf("extraversion");
  const a = scoreOf("agreeableness");
  const n = scoreOf("neuroticism") || scoreOf("emotional_stability");

  return [
    {
      name: "Openness",
      level: o >= 0.65 ? "High" : o <= 0.35 ? "Grounded" : "Curious",
      line: o >= 0.65 ? "You go looking for unexpected angles." : "You build from direct practical evidence.",
    },
    {
      name: "Conscientiousness",
      level: c >= 0.65 ? "High" : c <= 0.35 ? "Flexible" : "In bursts",
      line: c >= 0.65 ? "Meticulous execution, finished loops." : "Deep intense focus, then a wide reset.",
    },
    {
      name: "Extraversion",
      level: e >= 0.65 ? "Expansive" : e <= 0.35 ? "Selective" : "Middle",
      line: e >= 0.65 ? "Energized by discussion and shared craft." : "One-to-one lifts you; big rooms drain you.",
    },
    {
      name: "Agreeableness",
      level: a >= 0.65 ? "High" : a <= 0.35 ? "Direct" : "Empathic",
      line: a >= 0.65 ? "You lead by understanding the user's side." : "You prioritize clarity over comfort.",
    },
    {
      name: "Emotional range",
      level: n <= 0.4 ? "Steady" : n >= 0.7 ? "Intense" : "Responsive",
      line: n <= 0.4 ? "Calm in ambiguity; short fuse only for waste." : "High resonance with what's at stake.",
    },
  ];
}

export interface Point {
  id: string;
  text: string;
  why: string;
}

const STOP = new Set("about after again also always because been before being both could didn doing dont even every from have here into just know like little lot make more most much need only other really right said should some something still than that thats their them then there these they thing think this those through time very want what when where which while will with would your youre honestly finally okay yeah kind sort mean actually basically going thing maybe guess right well".split(" "));

const clause = (s: string) => {
  const w = s.trim().replace(/[.!?]$/, "").split(/\s+/);
  return w.length <= 16 ? w.join(" ") : `${w.slice(0, 14).join(" ").replace(/[,;:]$/, "")}…`;
};

function repeated(answers: string[]) {
  const seen = new Map<string, Set<number>>();
  answers.forEach((a, i) =>
    a
      .toLowerCase()
      .replace(/[^a-z\s']/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/'s$/, "").replace(/s$/, ""))
      .filter((w) => w.length > 3 && !STOP.has(w))
      .forEach((w) => seen.set(w, (seen.get(w) ?? new Set()).add(i))),
  );
  return [...seen.entries()].filter(([, s]) => s.size > 1).sort((a, b) => b[1].size - a[1].size)[0];
}

export function pointsFrom(answers: string[]): Point[] {
  const a = answers.map((x, i) => x.trim() || SAMPLE_ANSWERS[i] || "");
  const r = repeated(a);
  const out: Point[] = [
    { id: "p1", text: "You learn by talking to people, not by reading about them.", why: `Answer 2: “${clause(a[1] || "")}”` },
    { id: "p2", text: "You're building for someone specific, not for a market.", why: `Answer 1: “${clause(a[0] || "")}”` },
    { id: "p3", text: "You came here for people more than for output.", why: `Answer 3: “${clause(a[2] || "")}”` },
  ];
  if (r) out.push({ id: "p4", text: `“${r[0]}” is on your mind.`, why: `It came up in ${r[1].size === 3 ? "all three" : "two"} of your answers.` });
  return out;
}

export const HEADLINE = "A builder who learns by listening, and came here for the people.";

export type NodeKind = "you" | "intent" | "theme" | "person";

export interface WNode {
  id: string;
  kind: NodeKind;
  title: string;
  label: string;
  line?: string;
  from?: string;
  art: Art;
  person?: string;
}

export function worldFor(
  answers: string[],
  name: string,
  aiIntents?: { id: string; title: string; label: string; line: string; quote: string }[] | null,
  aiThemes?: { id: string; title: string; label: string; art?: Art }[] | null
): { nodes: WNode[]; edges: [string, string][] } {
  const a = answers.map((x, i) => x.trim() || SAMPLE_ANSWERS[i] || "");
  const first = name.trim().split(/\s+/)[0] || "You";

  const intentNodes: WNode[] = (aiIntents && aiIntents.length === 3)
    ? aiIntents.map((it, idx) => ({
        id: it.id || `i${idx + 1}`,
        kind: "intent" as NodeKind,
        title: it.title || `Drive ${idx + 1}`,
        label: it.label || it.title,
        line: it.line || "What you're building toward.",
        from: it.quote ? `“${it.quote}”` : `Answer ${idx + 1}: “${clause(a[idx] || "")}”`,
        art: (["meadow", "park", "dusk"] as Art[])[idx % 3],
      }))
    : [
        { id: "i1", kind: "intent", title: "Fair prices", label: "Fair prices for small farmers", line: "What you're building toward.", from: `Answer 1: “${clause(a[0] || "")}”`, art: "meadow" },
        { id: "i2", kind: "intent", title: "Listening first", label: "Learning from the people you build for", line: "How you like to work it out.", from: `Answer 2: “${clause(a[1] || "")}”`, art: "park" },
        { id: "i3", kind: "intent", title: "People first", label: "Leaving with people, not just output", line: "What would make this residency a win.", from: `Answer 3: “${clause(a[2] || "")}”`, art: "dusk" },
      ];

  const themeNodes: WNode[] = (aiThemes && aiThemes.length > 0)
    ? aiThemes.map((th, idx) => ({
        id: th.id || `t${idx + 1}`,
        kind: "theme" as NodeKind,
        title: th.title,
        label: th.label || th.title,
        from: "Your answers and reflections",
        art: th.art || (["meadow", "hills", "water", "park", "dusk"] as Art[])[idx % 5],
      }))
    : [
        { id: "t1", kind: "theme", title: "Markets", label: "Agricultural markets", from: "Your answers and LinkedIn", art: "meadow" },
        { id: "t2", kind: "theme", title: "Pricing", label: "Pricing", from: "Your answers and your essays", art: "hills" },
        { id: "t3", kind: "theme", title: "WhatsApp", label: "WhatsApp-first products", from: "GitHub", art: "water" },
        { id: "t4", kind: "theme", title: "Field research", label: "Field research", from: "Your answers", art: "park" },
        { id: "t5", kind: "theme", title: "Rural tech", label: "Rural tech", from: "A panel you spoke on", art: "water" },
        { id: "t6", kind: "theme", title: "Community", label: "Community", from: "Your answers", art: "dusk" },
      ];

  const residentNodes: WNode[] = [
    { id: "p-meera", kind: "person", title: "Meera", label: "Meera", person: "meera", art: "meadow" },
    { id: "p-kabir", kind: "person", title: "Kabir", label: "Kabir", person: "kabir", art: "water" },
    { id: "p-ananya", kind: "person", title: "Ananya", label: "Ananya", person: "ananya", art: "dusk" },
  ];

  const nodes: WNode[] = [
    { id: "you", kind: "you", title: first, label: name.trim() || "You", art: "hills" },
    ...intentNodes,
    ...themeNodes,
    ...residentNodes,
  ];

  const edges: [string, string][] = [
    ["you", intentNodes[0].id],
    ["you", intentNodes[1].id],
    ["you", intentNodes[2].id],
  ];

  themeNodes.forEach((t, i) => {
    const parentIntent = intentNodes[i % intentNodes.length];
    edges.push([parentIntent.id, t.id]);
  });

  if (themeNodes.length >= 2) {
    edges.push([themeNodes[0].id, "p-meera"]);
    edges.push([themeNodes[1].id, "p-kabir"]);
    edges.push([themeNodes[themeNodes.length - 1].id, "p-ananya"]);
  }

  return { nodes, edges };
}

export interface Resident extends Person {
  work: string;
  pattern?: string;
  quest?: string;
  socials: LinkKind[];
}

const makeResident = (p: Omit<Resident, "energy" | "age" | "where" | "km" | "story" | "differs" | "words" | "shares" | "socials"> & { art: Art; energy?: number; socials?: LinkKind[] }): Resident => ({
  energy: p.pattern ? 0.8 : 0.4,
  socials: ["linkedin", "instagram"],
  age: 0,
  where: "In the residency",
  km: 0,
  story: p.work,
  differs: "",
  words: "",
  shares: "",
  ...p,
});

export const RESIDENTS: Resident[] = [
  makeResident({
    id: "meera",
    name: "Meera",
    art: "meadow",
    face: { art: "meadow", x: 30, y: 25 },
    work: "Field research on how farming families borrow money",
    pattern: "You both learn by talking to people.",
    quest: "A morning of farmer calls, together",
    energy: 0.92,
    socials: ["linkedin", "x", "site"],
    together: "You've both spent this month on the phone with farmers. Side quest: run one morning of calls together on Thursday, swap what you hear over lunch?",
    quests: [{ name: "Farmer credit research", art: "meadow" }, { name: "Learning Marathi properly", art: "park" }],
    reply: "Hi! Force says you're doing farmer calls too. I have a list of questions that took me months to get right, happy to share.",
  }),
  makeResident({
    id: "kabir",
    name: "Kabir",
    art: "water",
    face: { art: "water", x: 70, y: 40 },
    work: "Cheap water sensors for village tanks",
    pattern: "You both build for someone specific.",
    quest: "Saturday at Kabir's test tank",
    energy: 0.84,
    socials: ["linkedin", "github", "instagram"],
    together: "You're both building for villages you've actually visited. Side quest: a Saturday trip to the tank Kabir's testing at, an hour out of town?",
    quests: [{ name: "Water sensors", art: "water" }, { name: "Soldering on Sundays", art: "hills" }],
    reply: "Hey, I'm heading to the test site Saturday morning. There's a seat in the car if you want to see it.",
  }),
  makeResident({
    id: "ananya",
    name: "Ananya",
    art: "dusk",
    face: { art: "dusk", x: 20, y: 70 },
    work: "A book about the markets of Pune",
    pattern: "You both came here for people.",
    quest: "Mandai market at 6 a.m.",
    energy: 0.76,
    socials: ["instagram", "site"],
    together: "She's writing about markets, you're pricing what's sold in them. Side quest: walk Mandai market together early one morning?",
    quests: [{ name: "Writing a book", art: "dusk" }, { name: "Early morning walks", art: "meadow" }],
    reply: "Mandai at 6 is the best hour. I'm going Friday, come?",
  }),
];

export const residentById = (id: string) => RESIDENTS.find((x) => x.id === id);

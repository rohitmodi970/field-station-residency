// The person this prototype is built around.
//
// Mira Rao, 31. Design lead at Sora, a solar-grid startup in Bengaluru, since August 2023.
// Her partner Dev makes furniture in a workshop on the ground floor of their building. Her
// mother (Aai) lives alone in Pune. She runs on Sundays, around Sankey Tank.
//
// The question running under three years of entries: she always said she wanted to build
// "something significant". Now she's being offered the thing, and her best days look like a
// table in Dev's workshop. Force should help her see that in her own words, not tell her.
//
// Why Force: she talks more easily than she writes, she sends herself voice notes walking
// home, and she has never kept a journal past February.

export const USUAL = { pace: 148, pausesPerMin: 3 };

export type Kind = "thread" | "pattern" | "voice";

export interface Moment {
  t: number; // seconds into the clip
  kind: "flat" | "lift" | "pause" | "slow";
  phrase: string;
  note: string;
}

export interface Clip {
  id: string;
  name: string;
  secs: number;
  transcript: string;
  energy: number[]; // 0..1 across the clip
  pace: number; // words a minute
  pauses: number;
  longest: number; // seconds
  moments: Moment[];
  tones?: { name: string; v: number }[]; // what the voice carried, strongest first
  src?: string; // a real recording, when there is one
}

export type Block =
  | { id: string; kind: "text"; html: string }
  | { id: string; kind: "audio"; clip: Clip }
  | { id: string; kind: "image"; src: string; name?: string }
  | { id: string; kind: "video"; src: string; name?: string };

export interface Entry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  title: string;
  blocks: Block[];
  themes: string[];
  mood: number; // -2 heavy … 2 light, read from the words
  fresh?: boolean;
  via?: "chat"; // kept from a conversation with Force
}

// The oil paintings. Each theme has its own, so the world, the dots and the tree carry
// different light depending on what an entry is about.
export type Art = "hills" | "park" | "meadow" | "water" | "dusk";
export const ART_SRC: Record<Art, string> = { hills: "/art/hills.jpg", park: "/art/park.jpg", meadow: "/art/meadow.jpg", water: "/art/water.jpg", dusk: "/art/ground-3.jpg" };
// The light version: each theme is a flat hue instead of a painting. Same keys as tokens.css.
export const ART_TONE: Record<Art, { tint: string; main: string; deep: string }> = {
  hills: { tint: "#fdf1e3", main: "#f2b26e", deep: "#8f5317" },
  park: { tint: "#fcebee", main: "#eb96a8", deep: "#973449" },
  meadow: { tint: "#e9f3e7", main: "#8dc08b", deep: "#3b6a39" },
  water: { tint: "#e5f0fb", main: "#76ade2", deep: "#245a8f" },
  dusk: { tint: "#efecfb", main: "#a596e2", deep: "#4d3e97" },
};
export const toneOf = (themeId?: string) => ART_TONE[THEMES.find((t) => t.id === themeId)?.art ?? "water"];

// Life areas: how she'd file things herself. Each theme belongs to one or two.
export const AREAS = [
  { id: "work", name: "Work", themes: ["ambition"] },
  { id: "family", name: "Family", themes: ["aai"] },
  { id: "love", name: "Love", themes: ["workshop"] },
  { id: "creative", name: "Creative", themes: ["workshop"] },
  { id: "health", name: "Health", themes: ["running"] },
  { id: "rest", name: "Rest", themes: ["nights", "running"] },
] as const;

export interface Theme {
  id: string;
  name: string;
  keywords: string[];
  art: Art;
  questions: [string, string, string];
  // Pattern map: what you keep doing (in your words), what it might mean, one small experiment
  mirror: string;
  meaning: string;
  movement: string;
  // Thought thread: the tension it usually holds
  tension: string;
  seeds: string[]; // small moves this theme suggests
}

// A seed: a small move you plant at the end of a thought thread or from a pattern. Tend it,
// and if it makes your days lighter it grows a leaf on your happiness tree.
export interface Seed {
  id: string;
  text: string;
  why: string;
  theme?: string;
  when: "today" | "week" | "someday";
  planted: string;
  done?: { on: string; felt: "lighter" | "same" | "heavier" };
}

export const REBALANCE_SEEDS = ["Five slow breaths before you open your messages tomorrow", "A twenty-minute walk with no headphones", "Phone in another room by eleven tonight"];

// For someone whose memory is still empty: small moves that fit anyone.
export const GENERIC_SEEDS = ["Write the one thing you're avoiding, in one line", "Tell one person how this week actually is", "Leave one evening this week with nothing in it"];

// Mira's themes only exist in Mira's demo. A new person starts with none; they'd grow from
// their own entries.
export const persona = { mira: true };

export const THEMES: Theme[] = [
  {
    id: "ambition",
    name: "A quieter ambition",
    keywords: ["ambition", "significant", "launch", "promotion", "head of design", "career", "work", "arjun", "roadmap", "lead", "big", "review", "sprint"],
    art: "hills",
    questions: [
      "When you picture the good version of this year, what's actually in the room?",
      "Which part of “significant” is yours, and which part did you pick up from somewhere?",
      "What would you keep if nobody ever saw it?",
    ],
    mirror: "Every time you picture a good day, it's a table and someone making something, not a launch.",
    meaning: "Maybe the ambition is real, and it's the shape you were handed that doesn't fit.",
    movement: "Before you answer Arjun, write what a good Friday in the new role would look like.",
    tension: "Wanting to build something significant, and wanting a life that has room in it",
    seeds: ["Ask Arjun what the role looks like on a Friday", "Write your own one-line meaning of “significant”", "Keep one Saturday morning a month for the workshop, before anything else"],
  },
  {
    id: "workshop",
    name: "The workshop table",
    keywords: ["dev", "workshop", "table", "chair", "walnut", "making", "made", "hands", "glue", "saturday", "half-finished"],
    art: "park",
    questions: ["What were your hands doing?", "What went quiet while you were there?", "How could a little of that reach a weekday?"],
    mirror: "Your lightest entries happen at Dev's table, hands busy, phone away.",
    meaning: "Making things might be where you rest, not a break from what matters.",
    movement: "Two hours at the workshop this Saturday, phone in the other room.",
    tension: "Making things for yourself, and making things that count at work",
    seeds: ["Two hours at Dev's table this Saturday, no phone", "Sketch something with no brief, for ten minutes"],
  },
  {
    id: "aai",
    name: "Aai, from far",
    keywords: ["aai", "mother", "mom", "pune", "birthday", "called her", "flight"],
    art: "meadow",
    questions: ["What did you hear from Aai?", "What part of it did you wish you'd been there for?", "What's one thing you could do from here this week?"],
    mirror: "You hear about Aai's life second-hand, and the distance feels heavier when you do.",
    meaning: "Maybe it isn't the distance that hurts, but finding out late.",
    movement: "Call Aai on your Sunday run, every week, even for five minutes.",
    tension: "Being there for Aai, and being where the work is",
    seeds: ["Call Aai on your Sunday run", "Book the Diwali flight before the launch plan is final"],
  },
  {
    id: "running",
    name: "Sunday runs",
    keywords: ["run", "ran", "running", "lake", "sankey", "10k", "sunday", "legs", "breath"],
    art: "water",
    questions: ["What were you carrying when you set out?", "Where did it go quiet?", "What did you bring back with you?"],
    mirror: "After a long run you write shorter, lighter sentences.",
    meaning: "Your body might settle what your head can't.",
    movement: "Keep one empty day this week and guard it like a meeting.",
    tension: "Filling the week, and leaving a day empty",
    seeds: ["Keep one day this week completely empty", "A slow 5k this Sunday, no watch"],
  },
  {
    id: "nights",
    name: "2 a.m. thinking",
    keywords: ["2am", "2:40", "3:10", "awake", "sleep", "night", "tired", "can't sleep", "insomnia"],
    art: "dusk",
    questions: ["What's awake with you right now?", "Is this something to solve tonight, or to set down?", "What would morning-you want you to know?"],
    mirror: "Both of your 2 a.m. entries come right before a review.",
    meaning: "The fear isn't failing; it's being forgettable, and it peaks just before you're judged.",
    movement: "The night before a review, write the one thing you're proud of, then close the laptop.",
    tension: "Being good at the work, and being tired of being good at being tired",
    seeds: ["The night before the review, write one thing you're proud of and close the laptop"],
  },
];

const p = (t: string) =>
  t
    .split("\n\n")
    .map((x) => `<p>${x}</p>`)
    .join("");

let bid = 0;
const text = (t: string): Block => ({ id: `b${++bid}`, kind: "text", html: p(t) });
const audio = (clip: Clip): Block => ({ id: `b${++bid}`, kind: "audio", clip });

const wave = (pts: number[]) => pts;

export const CLIPS = {
  quieter: {
    id: "c13",
    name: "A quieter kind of ambition.m4a",
    secs: 84,
    transcript:
      "I've been thinking about what I actually want from work. I keep saying I want to build something significant, but whenever I picture a good day, it isn't a launch or an announcement. It's a table with half-finished things on it, someone across from me making something completely different, and enough time to follow an idea without checking the clock. Maybe I don't want less ambition. Maybe I want ambition that leaves room for a life.",
    energy: wave([0.52, 0.5, 0.46, 0.4, 0.34, 0.3, 0.31, 0.33, 0.36, 0.48, 0.62, 0.74, 0.8, 0.82, 0.78, 0.72, 0.66, 0.58, 0.44, 0.3, 0.18, 0.12, 0.28, 0.4, 0.46, 0.5]),
    pace: 126,
    pauses: 7,
    longest: 2.6,
    tones: [
      { name: "Calm", v: 0.46 },
      { name: "Longing", v: 0.32 },
      { name: "Tired", v: 0.22 },
    ],
    moments: [
      { t: 14, kind: "flat", phrase: "something significant", note: "Your voice went flat here, the way it does when you're reading a line rather than meaning it." },
      { t: 41, kind: "lift", phrase: "a table with half-finished things on it", note: "Pitch and pace came up together. The most alive 15 seconds of the clip." },
      { t: 69, kind: "pause", phrase: "for a life", note: "The longest pause, 2.6 seconds, right before the last three words." },
    ],
  },
  big: {
    id: "c06",
    name: "Something big.m4a",
    secs: 61,
    transcript:
      "Review went well. Arjun said head of design by next year. I smiled the whole meeting and then felt nothing on the way home. I wanted my name on something big. So why does it feel like a coat that doesn't fit.",
    energy: wave([0.6, 0.62, 0.58, 0.5, 0.38, 0.3, 0.28, 0.26, 0.24, 0.22, 0.2, 0.22, 0.2, 0.18, 0.16, 0.18, 0.15, 0.12]),
    pace: 131,
    pauses: 5,
    longest: 2.1,
    tones: [
      { name: "Flat", v: 0.5 },
      { name: "Disappointed", v: 0.3 },
      { name: "Tired", v: 0.2 },
    ],
    moments: [
      { t: 9, kind: "flat", phrase: "head of design by next year", note: "Said almost without inflection, though it was the good news." },
      { t: 47, kind: "slow", phrase: "a coat that doesn't fit", note: "You slowed to under 100 words a minute for the last line." },
    ],
  },
  review: {
    id: "c11",
    name: "After the review.m4a",
    secs: 73,
    transcript:
      "Recording this walking out. They want me to lead the whole platform. It's the thing I said I wanted for three years. I didn't say yes yet. I said I'd think. I don't know why I said that. Actually I do.",
    energy: wave([0.7, 0.72, 0.68, 0.6, 0.55, 0.5, 0.4, 0.32, 0.3, 0.34, 0.3, 0.26, 0.2, 0.3, 0.42, 0.5]),
    pace: 152,
    pauses: 6,
    longest: 1.9,
    tones: [
      { name: "Unsure", v: 0.44 },
      { name: "Tense", v: 0.34 },
      { name: "Steady", v: 0.22 },
    ],
    moments: [
      { t: 22, kind: "flat", phrase: "the thing I said I wanted", note: "Flat, like the April clip." },
      { t: 58, kind: "lift", phrase: "Actually I do", note: "Your voice came back up on the last three words, quieter but steadier." },
    ],
  },
  chair: {
    id: "c12",
    name: "Walking back from the workshop.m4a",
    secs: 49,
    transcript:
      "Walking back from Dev's. I helped glue a chair. Clamps everywhere, sawdust in my hair. I was happier for that one hour than for the whole sprint. Is that a sign, or is it just a Saturday.",
    energy: wave([0.6, 0.68, 0.74, 0.8, 0.84, 0.86, 0.82, 0.78, 0.74, 0.7, 0.58, 0.5, 0.46]),
    pace: 158,
    pauses: 2,
    longest: 1.1,
    tones: [
      { name: "Joy", v: 0.55 },
      { name: "Playful", v: 0.3 },
      { name: "Calm", v: 0.15 },
    ],
    moments: [{ t: 18, kind: "lift", phrase: "sawdust in my hair", note: "You laughed through this line. Your fastest, brightest stretch this year." }],
  },
} satisfies Record<string, Clip>;

function entry(id: string, date: string, time: string, title: string, blocks: Block[], themes: string[], mood: number): Entry {
  return { id, date, time, title, blocks, themes, mood };
}

export const ENTRIES: Entry[] = [
  entry("e01", "2023-08-05", "22:10", "First week at Sora", [text("First week at Sora. Everyone talks fast and ships faster. I want my name on something that matters, something significant, something people remember.")], ["ambition"], 1),
  entry("e02", "2024-05-24", "23:40", "Aai's knee", [text("Aai fell on the stairs in Pune. She told me three days later, like it was weather. I booked a flight and then moved it because of the launch.\n\nI keep doing the maths of distance. Three hours away is not far. It's just never this week.")], ["aai", "ambition"], -2),
  entry("e03", "2024-08-10", "09:20", "First 10k", [text("Ran 10k around Sankey for the first time. Somewhere after 7k my head went quiet. I didn't solve anything. I just stopped holding it.")], ["running"], 2),
  entry("e04", "2024-11-14", "02:40", "2:40 a.m.", [text("Awake at 2:40 rewriting the launch deck in my head. The thing I'm most scared of isn't failing. It's it being fine, and forgettable.")], ["nights", "ambition"], -2),
  entry("e05", "2025-02-08", "19:05", "Dev's workshop", [text("Spent Saturday downstairs in Dev's workshop. He was planing a walnut top, I was sketching nothing in particular. Four hours. Neither of us checked a phone.")], ["workshop"], 2),
  entry("e06", "2025-04-28", "20:15", "Something big", [text("Voice note on the way home."), audio(CLIPS.big), text("I wanted my name on something big. So why does it feel like a coat that doesn't fit.")], ["ambition"], -1),
  entry("e07", "2025-07-19", "08:30", "Called Aai mid-run", [text("Called Aai at 6k, out of breath. She laughed at me panting. We talked more than we have in months. Maybe the trick is to not sit down for it.")], ["aai", "running"], 2),
  entry("e08", "2025-10-11", "21:00", "Aai at the workshop", [text("Aai visited. Dev showed her the workshop and she sat at the half-finished table peeling oranges for everyone, telling him how to sand.\n\nI want more of exactly this.")], ["workshop", "aai"], 2),
  entry("e09", "2026-01-17", "18:30", "Sunday, nothing planned", [text("Long run, then a nap, then nothing. I keep noticing that my best weeks have one empty day in them.")], ["running"], 1),
  entry("e10", "2026-03-03", "03:10", "3:10 a.m. again", [text("3:10. Roadmap review is Thursday. I keep imagining Arjun's face. I'm tired of being someone who's good at being tired.")], ["nights", "ambition"], -2),
  entry("e11", "2026-05-20", "18:50", "After the review", [audio(CLIPS.review), text("They want me to lead the platform. I said I'd think about it.")], ["ambition"], -1),
  entry("e12", "2026-06-28", "17:40", "Walking back from the workshop", [audio(CLIPS.chair)], ["workshop", "ambition"], 2),
  entry(
    "e13",
    "2026-07-08",
    "16:37",
    "A quieter kind of ambition",
    [
      text("I've been thinking about what I actually want from work. I keep saying I want to build something significant, but whenever I picture a good day, it isn't a launch or an announcement."),
      text("It's a table with half-finished things on it, someone across from me making something completely different, and enough time to follow an idea without checking the clock. Maybe I don't want less ambition. Maybe I want ambition that leaves room for a life."),
      audio(CLIPS.quieter),
    ],
    ["ambition", "workshop"],
    1,
  ),
  entry("e14", "2026-09-03", "11:20", "Aai's birthday", [text("Took the early flight to Pune for Aai's birthday. Told Arjun I'd be offline. Nothing broke. She made puran poli and we ate on the floor like I was twelve.")], ["aai", "ambition"], 2),
];

export const SEEDS: Seed[] = [
  { id: "s1", text: "Call Aai on your Sunday run", why: "From “Calling Aai more”", theme: "aai", when: "week", planted: "2025-07-19", done: { on: "2025-07-27", felt: "lighter" } },
  { id: "s2", text: "Ask Arjun what the role looks like on a Friday", why: "From “Why I said I'd think about it”", theme: "ambition", when: "week", planted: "2026-05-21" },
  { id: "s3", text: "Two hours at Dev's table this Saturday, no phone", why: "From the pattern “The workshop table”", theme: "workshop", when: "week", planted: "2026-07-09", done: { on: "2026-07-11", felt: "lighter" } },
];

// What Force has already done: the memory trail.
export interface ThreadTurn {
  q: string;
  a: string;
}
export interface TrailItem {
  id: string;
  kind: Kind;
  title: string;
  date: string;
  scope: string; // what it ran on, in words
  entryIds: string[];
  turns?: ThreadTurn[]; // thought threads
  landed?: string; // thought threads: where you ended up, in your words
  clipIds?: string[]; // voice signals
  text?: string; // extra unsaved text it ran on
}

export const TRAIL: TrailItem[] = [
  {
    id: "t1",
    kind: "thread",
    title: "Ambition that leaves room for a life",
    date: "2026-07-08",
    scope: "A quieter kind of ambition",
    entryIds: ["e13"],
    turns: [
      { q: "When you picture the good version of this year, what's actually in the room?", a: "The workshop table. Dev. Something I'm making that isn't due." },
      { q: "Which part of “significant” is yours, and which part did you pick up from somewhere?", a: "Wanting to make things that last is mine. Wanting people to see it is probably from Sora." },
      { q: "What would you keep if nobody ever saw it?", a: "The making. Honestly the making." },
    ],
    landed: "Wanting to make things that last is mine. Wanting people to see it is probably from Sora.",
  },
  {
    id: "t2",
    kind: "thread",
    title: "Why I said I'd think about it",
    date: "2026-05-21",
    scope: "After the review",
    entryIds: ["e11"],
    turns: [
      { q: "What did you not say in the room?", a: "That I'd want Fridays. That I'd want to keep designing, not just managing." },
      { q: "What would you need for a yes to feel like yours?", a: "Fridays. And to not be the person who answers at 11pm." },
      { q: "What's one thing you could ask for this week?", a: "Ask Arjun what the role looks like on a Friday." },
    ],
    landed: "Fridays. And to not be the person who answers at 11pm.",
  },
  {
    id: "t3",
    kind: "thread",
    title: "Calling Aai more",
    date: "2025-07-19",
    scope: "Called Aai mid-run",
    entryIds: ["e07"],
    turns: [
      { q: "What did you hear from Aai?", a: "That she's been walking to the temple every morning. She sounded proud of it." },
      { q: "What's one thing you could do from here this week?", a: "Call on Sunday runs. Make it a thing." },
    ],
    landed: "Call on Sunday runs. Make it a thing.",
  },
  { id: "p1", kind: "pattern", title: "Work and the good day", date: "2026-07-09", scope: "6 entries · A quieter ambition", entryIds: ["e01", "e04", "e06", "e10", "e11", "e13"] },
  { id: "p2", kind: "pattern", title: "The nights before reviews", date: "2026-03-04", scope: "2 entries · 2 a.m. thinking", entryIds: ["e04", "e10"] },
  { id: "p3", kind: "pattern", title: "Aai, a year on", date: "2025-10-12", scope: "3 entries · Aai, from far", entryIds: ["e02", "e07", "e08"] },
  { id: "v1", kind: "voice", title: "A quieter kind of ambition.m4a", date: "2026-07-08", scope: "1 clip · 1:24", entryIds: ["e13"], clipIds: ["c13"] },
  { id: "v2", kind: "voice", title: "Walking back from the workshop.m4a", date: "2026-06-28", scope: "1 clip · 0:49", entryIds: ["e12"], clipIds: ["c12"] },
  { id: "v3", kind: "voice", title: "Three clips about the role", date: "2026-05-20", scope: "3 clips · 2025–26", entryIds: ["e06", "e11", "e13"], clipIds: ["c06", "c11", "c13"] },
];

// A recording made in the prototype, when the microphone isn't available or nothing was transcribed.
export const SAMPLE_CLIP: Omit<Clip, "id" | "name" | "secs" | "src"> = {
  transcript:
    "Okay. Walking to the bus. Arjun wants an answer by Friday. And the thing is I'm not scared of the work. I'm scared of not having Saturdays. Of the workshop becoming a place I used to go.",
  energy: [0.62, 0.66, 0.6, 0.5, 0.42, 0.36, 0.3, 0.26, 0.22, 0.3, 0.24, 0.18, 0.2, 0.16],
  pace: 134,
  pauses: 6,
  longest: 2.2,
  moments: [
    { t: 9, kind: "flat", phrase: "an answer by Friday", note: "Flat, the same tone as the April and May clips about the role." },
    { t: 24, kind: "pause", phrase: "a place I used to go", note: "The longest pause, 2.2 seconds, right before this." },
  ],
};

export const themeById = (id: string) => THEMES.find((t) => t.id === id);

// A theme is touched when one of its words shows up. Simple and visible.
export function detectThemes(t: string): string[] {
  if (!persona.mira) return [];
  const s = t.toLowerCase();
  return THEMES.filter((th) => th.keywords.some((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(s))).map((th) => th.id);
}

const LIGHT = ["laughed", "laughing", "good", "best", "happier", "happy", "quiet", "proud", "calm", "loved", "easy", "glad", "more of exactly this", "nothing broke"];
const HEAVY = ["tired", "heavy", "scared", "anxious", "can't", "don't know", "exhausted", "alone", "sad", "worried", "stuck", "awake", "nothing on the way"];
export function readMood(t: string) {
  const s = t.toLowerCase();
  const n = (ws: string[]) => ws.filter((w) => s.includes(w)).length;
  return Math.max(-2, Math.min(2, n(LIGHT) - n(HEAVY)));
}

// HTML from the editor back to plain text: block ends become line breaks, entities decode.
export function plain(html: string) {
  const s = html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>\s*/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  let out: string;
  if (typeof document !== "undefined") {
    const t = document.createElement("textarea");
    t.innerHTML = s;
    out = t.value;
  } else out = s.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  return out.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export const entryText = (e: Entry) =>
  e.blocks
    .map((b) => (b.kind === "text" ? plain(b.html) : b.kind === "audio" ? b.clip.transcript : ""))
    .filter(Boolean)
    .join("\n\n");

export const entryClips = (e: Entry) => e.blocks.flatMap((b) => (b.kind === "audio" ? [b.clip] : []));

// The sentence that best shows a thread, in her own words.
export function quoteFor(t: string, themeId?: string) {
  const th = themeId ? themeById(themeId) : undefined;
  const ss = t.split(/(?<=[.!?])\s+/).filter((x) => x.split(" ").length > 3);
  return (th && ss.find((x) => th.keywords.some((k) => x.toLowerCase().includes(k)))) ?? ss[0] ?? t;
}

// ── Patterns across entries ─────────────────────────────────────────────
//
// What a pattern map finds when it reads several entries together. Each pattern runs through
// specific entries; its chain is the moments, in order, where it showed. A map over any set of
// entries surfaces the patterns those entries share, and builds the chain only from them.

export interface Pattern {
  id: string;
  name: string;
  themes: string[];
  mirror: string; // what you keep doing
  meaning: string; // what it might mean
  movement: string; // one small experiment
  edge: string; // where it could grow next
  chain: { entry: string; step: string }[];
}

export const PATTERNS: Pattern[] = [
  {
    id: "significance",
    name: "Chasing significant, feeling nothing",
    themes: ["ambition"],
    mirror: "You aim for something significant, and when it arrives you feel almost nothing.",
    meaning: "The goal may be borrowed. The days you describe wanting are quieter than the ones you're working toward.",
    movement: "Before saying yes to the next big thing, write the ordinary Tuesday it would give you.",
    edge: "Letting a good day count, even when nobody sees it.",
    chain: [
      { entry: "e01", step: "Wants her name on something significant" },
      { entry: "e04", step: "Scared it'll be fine, and forgettable" },
      { entry: "e06", step: "Promotion offered; feels nothing on the way home" },
      { entry: "e11", step: "Offered the platform; says she'll think" },
      { entry: "e13", step: "Pictures a table, not a launch" },
    ],
  },
  {
    id: "judgement",
    name: "Awake before being judged",
    themes: ["nights", "ambition"],
    mirror: "The nights you can't sleep come right before someone evaluates your work.",
    meaning: "The weight is less the work than being seen doing it.",
    movement: "The night before a review, write one thing you're proud of, then close the laptop.",
    edge: "Separating how good the work is from how it will be received.",
    chain: [
      { entry: "e04", step: "2:40 a.m., rewriting the launch deck" },
      { entry: "e10", step: "3:10 a.m., two days before the roadmap review" },
      { entry: "e11", step: "Walks out of the review unsure" },
    ],
  },
  {
    id: "making",
    name: "Making as rest",
    themes: ["workshop"],
    mirror: "You're lightest with your hands busy, nothing due, and someone making something beside you.",
    meaning: "For you, rest isn't stopping. It's making without being measured.",
    movement: "Keep one Saturday morning at the workshop before anything else gets the time.",
    edge: "Bringing a little unmeasured making into a weekday.",
    chain: [
      { entry: "e05", step: "Four hours at Dev's workshop, no phones" },
      { entry: "e08", step: "Aai peels oranges at the half-finished table" },
      { entry: "e12", step: "Happier gluing a chair than the whole sprint" },
      { entry: "e13", step: "The good day is a table with half-finished things" },
    ],
  },
  {
    id: "distance",
    name: "Finding out late",
    themes: ["aai"],
    mirror: "You hear about Aai's life second-hand and late, and the distance feels heaviest then.",
    meaning: "It may not be the miles. It's being the last to know.",
    movement: "Call Aai on your Sunday run, every week, even for five minutes.",
    edge: "Choosing to show up before there's a reason to.",
    chain: [
      { entry: "e02", step: "Aai tells her about the fall three days later" },
      { entry: "e07", step: "Calls mid-run; they talk more than in months" },
      { entry: "e08", step: "Aai visits, sits at the workshop table" },
      { entry: "e14", step: "Flies home for her birthday; nothing breaks" },
    ],
  },
  {
    id: "empty",
    name: "The empty day",
    themes: ["running", "aai"],
    mirror: "Your best weeks have one day with nothing in it, and you keep losing it to work.",
    meaning: "Space isn't a reward for finishing; it's what lets you think at all.",
    movement: "Protect one empty day this week like a meeting you can't move.",
    edge: "Planning the empty day before the week fills itself.",
    chain: [
      { entry: "e03", step: "After 7k, her head goes quiet" },
      { entry: "e07", step: "Talking to Aai without sitting down for it" },
      { entry: "e09", step: "A run, a nap, then nothing" },
      { entry: "e14", step: "Offline for a day; nothing breaks" },
    ],
  },
  {
    id: "yes",
    name: "From yes to “I'll think”",
    themes: ["ambition", "aai"],
    mirror: "You used to say yes on the spot. Lately you've started saying “I'll think” and “offline”.",
    meaning: "You're learning that a pause is an answer too.",
    movement: "Next time you're asked for more, say “I'll come back to you tomorrow” and mean it.",
    edge: "Making the pause a habit, not an exception.",
    chain: [
      { entry: "e02", step: "Moves the flight for the launch" },
      { entry: "e06", step: "Smiles through the promotion, says nothing" },
      { entry: "e11", step: "“I said I'd think about it”" },
      { entry: "e14", step: "Tells Arjun she'll be offline" },
    ],
  },
];

// The three ways Force looks at something. Every line here is counted from her entries or
// quoted from them. Nothing is scored, nothing is diagnosed.

import { CLIPS, PATTERNS, USUAL, detectThemes, entryClips, entryText, quoteFor, themeById, type Art, type Clip, type Entry, type Pattern } from "@/data/mira";
import type { Scope } from "./store";
import { fmtMonth, iso } from "./store";

const listOf = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export interface ThreadRead {
  id: string;
  name: string;
  art: string;
  total: number;
  inScope: number;
  since: string;
  dots: { id: string; date: string; mood: number; inScope: boolean }[];
  then?: { date: string; quote: string };
  now?: { date: string; quote: string };
  late: number; // written after 11pm
  lighter: number; // of total, how many read light
}

export interface PatternRead {
  headline: string;
  threads: ThreadRead[];
  together?: string;
  first?: string;
  span: [string, string];
}

export function scopeText(scope: Scope, entries: Entry[]) {
  const es = entries.filter((e) => scope.entryIds.includes(e.id));
  return [scope.text ?? "", ...es.map(entryText)].filter(Boolean).join("\n\n");
}

export function patternFor(scope: Scope, all: Entry[]): PatternRead {
  const es = all.filter((e) => scope.entryIds.includes(e.id));
  const words = scopeText(scope, all);
  const ids = Array.from(new Set([...es.flatMap((e) => e.themes), ...detectThemes(words)]));
  const sorted = [...all].sort((a, b) => a.date.localeCompare(b.date));
  const span: [string, string] = [sorted[0]?.date ?? "2026-01-01", sorted[sorted.length - 1]?.date ?? "2026-12-31"];

  const threads: ThreadRead[] = ids
    .map((id) => {
      const th = themeById(id)!;
      const with_ = sorted.filter((e) => e.themes.includes(id));
      const old = with_.filter((e) => !scope.entryIds.includes(e.id));
      // Then: the earliest time it came up. Now: what you're looking at, in your words.
      const then = old[0] ?? with_[0];
      const inScope = with_.filter((e) => scope.entryIds.includes(e.id));
      const scopeQuote = scope.text && detectThemes(scope.text).includes(id) ? quoteFor(scope.text, id) : null;
      const now = inScope[inScope.length - 1] ?? with_[with_.length - 1];
      return {
        id,
        name: th.name,
        art: th.art,
        total: with_.length,
        inScope: with_.filter((e) => scope.entryIds.includes(e.id)).length + (scope.text && detectThemes(scope.text).includes(id) ? 1 : 0),
        since: with_[0]?.date ?? "",
        dots: with_.map((e) => ({ id: e.id, date: e.date, mood: e.mood, inScope: scope.entryIds.includes(e.id) })),
        then: then && now && then.id !== now.id ? { date: then.date, quote: quoteFor(entryText(then), id) } : undefined,
        now: scopeQuote ? { date: iso(new Date()), quote: scopeQuote } : now ? { date: now.date, quote: quoteFor(entryText(now), id) } : undefined,
        late: with_.filter((e) => +e.time.slice(0, 2) >= 23 || +e.time.slice(0, 2) < 5).length,
        lighter: with_.filter((e) => e.mood >= 1).length,
      };
    })
    .sort((a, b) => b.inScope - a.inScope || b.total - a.total);

  let headline: string;
  if (!threads.length) headline = "This is new. Patterns appear once something comes up more than once, so keep going.";
  else if (threads.length === 1) {
    const t = threads[0];
    headline = t.total > 1 ? `${t.name} has come up in ${t.total} entries since ${fmtMonth(t.since)}.` : `This is the first entry in ${t.name}.`;
  } else headline = `This touches ${threads.length} themes: ${listOf(threads.slice(0, 3).map((t) => t.name))}.`;

  // Do two threads keep meeting? And how do those days read?
  let together: string | undefined;
  if (threads.length >= 2) {
    const [a, b] = threads;
    const both = all.filter((e) => e.themes.includes(a.id) && e.themes.includes(b.id));
    if (both.length >= 2) {
      const light = both.filter((e) => e.mood >= 1).length;
      together = `${a.name} and ${b.name} have shown up together ${both.length} times. ${light === both.length ? "Every one of those days read light." : light === 0 ? "None of those days read light." : `${light} of those days read light.`}`;
    }
  }

  const fresh = threads.find((t) => t.total <= 1);
  const first = fresh ? `First time ${fresh.name} has come up.` : undefined;

  return { headline, threads, together, first, span };
}

// ── Voice ──

export interface VoiceRead {
  clip: Clip;
  line: string;
  similar?: { clip: Clip; why: string };
}

const ALL_CLIPS: Clip[] = Object.values(CLIPS);

export function voiceFor(clips: Clip[]): VoiceRead[] {
  return clips.map((clip) => {
    const flat = clip.moments.find((m) => m.kind === "flat");
    const lift = clip.moments.find((m) => m.kind === "lift");
    const pause = clip.moments.find((m) => m.kind === "pause" || m.kind === "slow");
    let line: string;
    if (flat && lift) line = `You sounded flattest on “${flat.phrase}” and most alive on “${lift.phrase}”.`;
    else if (lift) line = `Your voice was brightest on “${lift.phrase}”.`;
    else if (flat && pause) line = `Flat on “${flat.phrase}”, then the longest pause before “${pause.phrase}”.`;
    else if (pause) line = `The longest pause came right before “${pause.phrase}”.`;
    else if (clip.pace) line = `${clip.pace < USUAL.pace ? "Slower" : "Faster"} than you usually speak, at ${clip.pace} words a minute.`;
    else line = "No words came through on this one, so this is the shape of your voice.";

    // The clip in her past that sounded most like this one
    const others = ALL_CLIPS.filter((c) => c.id !== clip.id);
    const close = others.sort((a, b) => Math.abs(a.pace - clip.pace) + Math.abs(a.pauses - clip.pauses) * 4 - (Math.abs(b.pace - clip.pace) + Math.abs(b.pauses - clip.pauses) * 4))[0];
    const sharedFlat = flat && close?.moments.some((m) => m.kind === "flat");
    const similar = close
      ? { clip: close, why: sharedFlat ? `The same flat tone, on “${close.moments.find((m) => m.kind === "flat")!.phrase}”.` : `A similar pace, ${close.pace} words a minute.` }
      : undefined;
    return { clip, line, similar };
  });
}

export const clipsIn = (scope: Scope, entries: Entry[]) => [
  ...(scope.clips ?? []),
  ...entries.filter((e) => scope.entryIds.includes(e.id)).flatMap(entryClips),
];

export const findClip = (id: string, entries: Entry[]) => ALL_CLIPS.find((c) => c.id === id) ?? entries.flatMap(entryClips).find((c) => c.id === id);

// ── Thought thread: the lines of thought running through something ──
//
// Everything is taken into account in order: every sentence of the conversation (or of the
// entries, oldest first). Sentences are strung onto strands by the theme they touch; a
// sentence that touches none continues the strand before it. Where one sentence touches two
// themes, those strands meet. Questions and half-sentences ("maybe", "I don't know") are
// what's left open.

export interface Step {
  i: number; // order in the whole
  text: string;
  where?: string; // a date, for entries
  lanes: number[]; // which strands it sits on (two when strands meet)
}
export interface Strand {
  id: string;
  name: string;
  lane: number;
  steps: number[]; // indexes into steps
  before: number; // entries about this in memory, outside what you're looking at
  since?: string;
}
export interface ThreadMap {
  steps: Step[];
  strands: Strand[];
  meets: Step[];
  open: Step[];
  start?: Step;
  end?: Step;
}

const OPEN = /\?|\bmaybe\b|\bi don'?t know\b|\bnot sure\b|\bi wonder\b|\bwhy\b|\bor is it\b/i;

export function threadMapFor(scope: Scope, all: Entry[]): ThreadMap {
  const es = all.filter((e) => scope.entryIds.includes(e.id)).sort((a, b) => a.date.localeCompare(b.date));
  const chunks: { text: string; where?: string }[] = [
    ...es.map((e) => ({ text: entryText(e), where: e.date })),
    ...(scope.text ? [{ text: scope.text }] : []),
  ];
  const sentences: { text: string; where?: string }[] = [];
  chunks.forEach((c) =>
    c.text
      .split(/\n+/)
      .flatMap((p) => p.split(/(?<=[.!?])\s+/))
      .map((x) => x.trim())
      .filter((x) => x.split(/\s+/).length >= 2)
      // A voice note's transcript often repeats what's written; count each sentence once.
      .forEach((x) => !sentences.some((y) => y.text.toLowerCase() === x.toLowerCase()) && sentences.push({ text: x, where: c.where })),
  );

  const order: string[] = [];
  let prev: string[] = [];
  // Opening sentences that touch no theme belong to the first line of thought that follows.
  const found = sentences.map((x) => detectThemes(x.text));
  const firstTheme = found.find((t) => t.length)?.[0] ?? "_start";
  const steps: Step[] = sentences.map((s, i) => {
    let ts = found[i];
    if (!ts.length) ts = prev.length ? [prev[0]] : [firstTheme];
    ts.forEach((t) => !order.includes(t) && order.push(t));
    prev = ts;
    return { i, text: s.text, where: s.where, lanes: ts.slice(0, 2).map((t) => order.indexOf(t)) };
  });

  const strands: Strand[] = order.map((id, lane) => {
    const th = themeById(id);
    const outside = all.filter((e) => e.themes.includes(id) && !scope.entryIds.includes(e.id)).sort((a, b) => a.date.localeCompare(b.date));
    return {
      id,
      name: th?.name ?? "Your words",
      lane,
      steps: steps.filter((s) => s.lanes.includes(lane)).map((s) => s.i),
      before: outside.length,
      since: outside[0]?.date,
    };
  });

  return {
    steps,
    strands,
    meets: steps.filter((s) => s.lanes.length > 1),
    open: steps.filter((s, i) => OPEN.test(s.text) && i !== steps.length - 1),
    start: steps[0],
    end: steps[steps.length - 1],
  };
}

// ── Pattern map over a set: reads the selected entries together ──

export interface Collective {
  count: number;
  span?: [string, string];
  summary: string;
  trend?: string;
  topics: { id: string; name: string; art: Art; share: number }[];
  patterns: { p: Pattern; steps: { entry: Entry; step: string; quote: string }[]; inScope: number }[];
}

export function collectiveFor(scope: Scope, all: Entry[]): Collective {
  const es = all.filter((e) => scope.entryIds.includes(e.id)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const textThemes = scope.text ? detectThemes(scope.text) : [];
  const ids = new Set(es.map((e) => e.id));
  const byId = new Map(all.map((e) => [e.id, e]));

  // Patterns these entries share: ranked by how many of the selected entries they run through.
  const patterns = PATTERNS.map((p) => {
    const inScope = p.chain.filter((c) => ids.has(c.entry)).length;
    const themed = textThemes.some((t) => p.themes.includes(t)) || es.some((e) => e.themes.some((t) => p.themes.includes(t)));
    // With entries picked, the chain is only theirs; for a conversation, it's the memory behind it.
    const chain = es.length ? p.chain.filter((c) => ids.has(c.entry)) : p.chain;
    const steps = chain.flatMap((c) => {
      const e = byId.get(c.entry);
      return e ? [{ entry: e, step: c.step, quote: quoteFor(entryText(e), p.themes[0]) }] : [];
    });
    return { p, steps, inScope, weight: inScope * 2 + (themed ? 1 : 0) };
  })
    .filter((x) => (es.length ? x.inScope > 0 : x.weight > 0))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  // What's taking up room: how much of this is each theme
  const counts: Record<string, number> = {};
  es.forEach((e) => e.themes.forEach((t) => (counts[t] = (counts[t] ?? 0) + 1)));
  textThemes.forEach((t) => (counts[t] = (counts[t] ?? 0) + 1));
  const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
  const topics = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => ({ id, name: themeById(id)!.name, art: themeById(id)!.art, share: n / total }));

  // Lighter or heavier over the span?
  let trend: string | undefined;
  if (es.length >= 4) {
    const half = Math.floor(es.length / 2);
    const avg = (xs: Entry[]) => xs.reduce((s, e) => s + e.mood, 0) / xs.length;
    const d = avg(es.slice(es.length - half)) - avg(es.slice(0, half));
    trend = d > 0.6 ? "They get lighter over time." : d < -0.6 ? "They get heavier over time." : "The weight stays about the same throughout.";
  }

  const top = patterns[0]?.p;
  const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
  const summary = !top
    ? es.length > 1
      ? `These ${es.length} entries don't share a pattern yet. They sit in different parts of your life.`
      : "Nothing here repeats yet. Patterns show once something comes up more than once."
    : es.length > 1
      ? `Read together, these ${es.length} entries say one thing clearly: ${lower(top.mirror)}`
      : es.length === 1
        ? `This entry is part of a longer pattern: ${lower(top.mirror)}`
        : `What you said here is part of a longer pattern: ${lower(top.mirror)}`;

  return { count: es.length, span: es.length ? [es[0].date, es[es.length - 1].date] : undefined, summary, trend, topics, patterns };
}

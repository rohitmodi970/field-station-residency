"use client";

import { create } from "zustand";
import { ENTRIES, TRAIL, persona, detectThemes, entryText, readMood, type Block, type Clip, type Entry, type TrailItem } from "@/data/mira";
import { INCOMING, QUESTS, personById, type Quest } from "@/data/social";
import { replyTo, replyToAgent, isQuickReply } from "./companion";

// A quick reply under one of Force's messages. Tapping it says the label, or goes somewhere.
export interface Opt {
  label: string;
  go?: "pattern" | "energy" | "persona" | "memory" | `energy:${string}` | `connection:${string}` | string;
}

export type Msg =
  | { id: string; from: "force"; kind: "text"; text: string; options?: Opt[] }
  | { id: string; from: "force"; kind: "typing" }
  | { id: string; from: "force"; kind: "note"; text: string; quest?: string } // "Added to Sunday runs"
  | { id: string; from: "me"; kind: "text"; text: string }
  | { id: string; from: "me"; kind: "audio"; clip: Clip }
  | { id: string; from: "me"; kind: "image" | "video"; src: string; name: string };

export interface Scope {
  label: string; // what it runs on, in words
  entryIds: string[];
  text?: string; // words not saved anywhere yet (a conversation, a selection)
  clips?: Clip[]; // clips not saved anywhere yet
}

export type Screen =
  | { name: "memory" }
  | { name: "entry"; id: string }
  | { name: "quest"; id: string }
  | { name: "energy"; focus?: string }
  | { name: "dive"; id: string; from?: { x: number; y: number; w: number; h: number } } // into a painting, from its cover
  | { name: "dm"; id: string }
  | { name: "profile" }
  | { name: "force" } // the residency: talking to Force, opened from the conversations
  | { name: "persona" }
  | { name: "connection"; id: string; say?: boolean }; // the residency: who Force thinks you are

export interface Sheet {
  key: number;
  scope: Scope;
  trailId?: string; // reopening a map you've already made
  at?: "voice"; // open scrolled to the voice part
}

export interface DmMsg {
  id: string;
  from: "me" | "them" | "force";
  text: string;
  poll?: { options: string[]; votes: Record<string, ("me" | "them")[]> }; // Force asks the group
}

// A next move from a pattern map. Keep it and Force nudges you; drop it and it's gone.
export interface Move {
  id: string;
  text: string;
  kept: boolean;
}

export interface Settings {
  mic: boolean;
  bell: boolean;
  pin: boolean;
  calendar: boolean;
  photos: boolean;
  notes: boolean;
}

interface State {
  demo: "mira" | "new";
  onboarded: boolean;
  settings: Settings;
  chat: Msg[];
  stack: Screen[];
  from: { x: number; y: number } | null; // where the open page grew from: the spot you tapped
  entries: Entry[];
  quests: Quest[];
  trail: TrailItem[]; // pattern maps you've made
  sheet: Sheet | null;
  toast: { key: number; text: string } | null;
  fresh: string | null;
  // Energy mapping: who you've reached out to, and the one request waiting for you.
  reached: Record<string, "asked" | "yes">;
  incoming: "new" | "yes" | "no";
  dms: Record<string, DmMsg[]>;
  moves: Move[];
  // Memory's own state, kept so it's still there when you come back from an entry.
  // focus: the one entry you're looking at. selecting: Select mode, where taps tick entries.
  mem: { filter: string; range: [string, string] | null; focus: string | null; selecting: boolean; sel: string[] };
}

let n = 0;
export const uid = (p = "m") => `${p}${Date.now().toString(36)}${(++n).toString(36)}`;

const ONBOARDED = "force.onboarded";
const wasOnboarded = () => {
  try {
    return typeof window !== "undefined" && localStorage.getItem(ONBOARDED) === "1";
  } catch {
    return false;
  }
};

export const useF = create<State>(() => ({
  demo: "mira",
  onboarded: wasOnboarded(),
  settings: { mic: true, bell: true, pin: true, calendar: true, photos: false, notes: false },
  chat: [],
  stack: [],
  from: null,
  entries: ENTRIES,
  quests: QUESTS,
  trail: TRAIL.filter((t) => t.kind === "pattern"),
  sheet: null,
  toast: null,
  fresh: null,
  reached: {},
  incoming: "new",
  dms: {},
  moves: [],
  mem: { filter: "all", range: null, focus: null, selecting: false, sel: [] },
}));

const set = useF.setState;
const get = useF.getState;

export const hour = () => new Date().getHours();
export const greeting = () => {
  const h = hour();
  return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

// The last place you touched, inside the app; App keeps it up to date.
export const tapped = { x: -1, y: -1 };

let typingTimer: ReturnType<typeof setTimeout> | undefined;

function forceSays(text: string, delay = 900, options?: Opt[], note?: Msg) {
  // Shortcuts into the demo's energy map only make sense in the demo
  if (get().demo === "new") options = options?.filter((o) => !o.go);
  const tid = uid("t");
  set((s) => ({ chat: [...s.chat.filter((m) => m.kind !== "typing"), { id: tid, from: "force", kind: "typing" }] }));
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {
    set((s) => ({ chat: [...s.chat.filter((m) => m.kind !== "typing"), { id: uid("f"), from: "force", kind: "text", text, options }, ...(note ? [note] : [])] }));
  }, delay);
}

// Everything you say is kept, as a moment on the side quest it belongs to. Nothing to save.
function keep(m: Msg): Msg | undefined {
  if (m.from !== "me") return;
  const now = new Date();
  const words = m.kind === "text" ? m.text : m.kind === "audio" ? m.clip.transcript : "";
  const block: Block = m.kind === "text" ? { id: uid("b"), kind: "text", html: m.text.split(/\n{2,}/).map((x) => `<p>${esc(x)}</p>`).join("") } : m.kind === "audio" ? { id: uid("b"), kind: "audio", clip: m.clip } : { id: uid("b"), kind: m.kind, src: m.src, name: m.name };
  const e: Entry = {
    id: uid("e"),
    date: iso(now),
    time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    title: titleFrom([m]),
    blocks: [block],
    themes: detectThemes(words),
    mood: readMood(words),
    fresh: true,
    via: "chat",
  };
  set((s) => ({ entries: [...s.entries, e], fresh: e.id }));
  const q = get().quests.find((x) => e.themes.includes(x.theme));

  // Persist entry to Supabase residency_entries table
  try {
    if (typeof window !== "undefined") {
      const { useR } = require("./residency");
      const rState = useR.getState();
      const uniqueId = rState.me || rState.uniqueId || "resident";
      fetch("/api/residency/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uniqueId,
          entryId: e.id,
          title: e.title,
          content: words,
          blocks: e.blocks,
          themes: e.themes,
          mood: e.mood,
          entryDate: e.date,
          entryTime: e.time,
          metadata: { via: e.via, quest: q?.id, questName: q?.name },
        }),
      }).catch(() => {});
    }
  } catch {}

  return { id: uid("n"), from: "force", kind: "note", text: q ? `Saved to memory · ${q.name}` : "Saved to memory", quest: q?.id };
}

const QUICK = /^(something solo|something social|going|not tonight|hold it|let it go|i'm bored tonight|plan my weekend|something's on my mind)$/i;

export const f = {
  // Onboarding ends with three answers in your own voice: they become your first moments.
  keepClips(clips: Clip[]): string[] {
    const before = new Set(get().entries.map((e) => e.id));
    clips.forEach((clip) => keep({ id: uid(), from: "me", kind: "audio", clip }));
    return get().entries.filter((e) => !before.has(e.id)).map((e) => e.id);
  },
  keepTexts(texts: string[]) {
    texts.forEach((text) => keep({ id: uid(), from: "me", kind: "text", text }));
  },
  // The residency: every thread opens with Force saying why, and a side quest to vote on.
  openThread(id: string) {
    const p = personById(id);
    if (!p || get().dms[id]?.length) return;
    const why = (p as { pattern?: string }).pattern;
    set((s) => ({
      reached: { ...s.reached, [id]: "yes" },
      dms: { ...s.dms, [id]: [{ id: uid("d"), from: "force", text: why ? `${why} I'm here too.` : `You and ${p.name}, with me in the middle.` }, { id: uid("d"), from: "force", text: p.together, poll: { options: ["We're in", "Something else"], votes: {} } }] },
    }));
  },
  setSetting(k: keyof Settings, v: boolean) {
    set((s) => ({ settings: { ...s.settings, [k]: v } }));
  },
  finishOnboarding() {
    set({ onboarded: true });
    try {
      localStorage.setItem(ONBOARDED, "1");
    } catch {}
  },
  restartOnboarding() {
    set({ onboarded: false });
    try {
      localStorage.removeItem(ONBOARDED);
    } catch {}
  },

  setDemo(demo: "mira" | "new") {
    persona.mira = demo === "mira";
    set({ demo, quests: demo === "new" ? [] : QUESTS, entries: demo === "new" ? [] : ENTRIES, trail: demo === "new" ? [] : TRAIL.filter((t) => t.kind === "pattern") });
  },

  // Home is the conversation. It opens with a hello and a few ways in.
  openChat() {
    if (get().chat.length) return;
    const name = get().demo === "new" ? "" : ", Mira";
    set({ chat: [{ id: uid("f"), from: "force", kind: "text", text: `${greeting()}${name}. What's on your mind?`, options: [{ label: "I'm bored tonight" }, { label: "Something's on my mind" }, { label: "Plan my weekend" }] }] });
  },

  closeChat() {
    clearTimeout(typingTimer);
    set({ chat: [] });
    f.openChat();
  },

  async send(text: string) {
    const t = text.trim();
    if (!t) return;
    const m: Msg = { id: uid(), from: "me", kind: "text", text: t };
    set((s) => ({ chat: [...s.chat.map((x) => (x.from === "force" && x.kind === "text" ? { ...x, options: undefined } : x)), m] }));

    if (isQuickReply(t)) {
      const r = replyTo({ kind: "text", text: t }, get().chat, get().entries);
      forceSays(r.text, 500, r.options, QUICK.test(t) ? undefined : keep(m));
      return;
    }

    const tid = uid("t");
    set((s) => ({ chat: [...s.chat.filter((x) => x.kind !== "typing"), { id: tid, from: "force", kind: "typing" }] }));

    try {
      const r = await replyToAgent({ kind: "text", text: t }, get().chat, get().entries);
      const noteMsg: Msg | undefined = r.note
        ? { id: uid("n"), from: "force", kind: "note", text: r.note }
        : keep(m);
      set((s) => ({
        chat: [
          ...s.chat.filter((x) => x.kind !== "typing"),
          { id: uid("f"), from: "force", kind: "text", text: r.text, options: r.options },
          ...(noteMsg ? [noteMsg] : []),
        ],
      }));
    } catch {
      const r = replyTo({ kind: "text", text: t }, get().chat, get().entries);
      forceSays(r.text, 500, r.options, keep(m));
    }
  },

  // A quick reply: it's said in the chat, or it takes you where it points.
  pick(o: Opt) {
    set((s) => ({ chat: s.chat.map((m) => (m.from === "force" && m.kind === "text" && m.options ? { ...m, options: undefined } : m)) }));
    if (!o.go) return f.send(o.label);
    if (o.go === "pattern") return f.open(f.chatScope());
    if (o.go === "energy") return f.push({ name: "energy" });
    if (o.go === "persona") return f.push({ name: "persona" });
    if (o.go === "memory") return f.push({ name: "memory" });
    if (o.go.startsWith("energy:")) return f.push({ name: "energy", focus: o.go.slice(7) });
    if (o.go.startsWith("connection:")) return f.push({ name: "connection", id: o.go.slice(11) });
    return f.send(o.label);
  },

  async addClip(clip: Clip) {
    f.openChat();
    const m: Msg = { id: uid(), from: "me", kind: "audio", clip };
    set((s) => ({ chat: [...s.chat, m] }));

    const tid = uid("t");
    set((s) => ({ chat: [...s.chat.filter((x) => x.kind !== "typing"), { id: tid, from: "force", kind: "typing" }] }));

    try {
      const r = await replyToAgent({ kind: "audio", text: clip.transcript }, get().chat, get().entries);
      const noteMsg: Msg | undefined = r.note
        ? { id: uid("n"), from: "force", kind: "note", text: r.note }
        : keep(m);
      set((s) => ({
        chat: [
          ...s.chat.filter((x) => x.kind !== "typing"),
          { id: uid("f"), from: "force", kind: "text", text: r.text, options: r.options },
          ...(noteMsg ? [noteMsg] : []),
        ],
      }));
    } catch {
      const r = replyTo({ kind: "audio", text: clip.transcript }, get().chat, get().entries);
      forceSays(r.text, 600, r.options, keep(m));
    }
  },

  async addMedia(kind: "image" | "video", src: string, name: string) {
    f.openChat();
    const m: Msg = { id: uid(), from: "me", kind, src, name };
    set((s) => ({ chat: [...s.chat, m] }));

    const tid = uid("t");
    set((s) => ({ chat: [...s.chat.filter((x) => x.kind !== "typing"), { id: tid, from: "force", kind: "typing" }] }));

    try {
      const r = await replyToAgent({ kind, text: `[${kind}: ${name}]` }, get().chat, get().entries);
      set((s) => ({
        chat: [
          ...s.chat.filter((x) => x.kind !== "typing"),
          { id: uid("f"), from: "force", kind: "text", text: r.text, options: r.options },
          ...(keep(m) ? [keep(m)!] : []),
        ],
      }));
    } catch {
      forceSays(replyTo({ kind, text: "" }, get().chat, get().entries).text, 800, undefined, keep(m));
    }
  },

  // The whole conversation so far, as something a pattern map can run on.
  chatScope(): Scope {
    const chat = get().chat;
    return { label: "This conversation", entryIds: [], text: chatWords(chat), clips: chat.flatMap((m) => (m.from === "me" && m.kind === "audio" ? [m.clip] : [])) };
  },

  updateEntry(id: string, patch: Partial<Entry>) {
    set((s) => ({
      entries: s.entries.map((e) => {
        if (e.id !== id) return e;
        const next = { ...e, ...patch };
        const words = entryText(next);
        return { ...next, themes: Array.from(new Set([...e.themes, ...detectThemes(words)])), mood: readMood(words) || e.mood };
      }),
    }));
    try {
      if (typeof window !== "undefined") {
        const updated = get().entries.find((e) => e.id === id);
        if (updated) {
          const { useR } = require("./residency");
          const rState = useR.getState();
          const uniqueId = rState.me || rState.uniqueId || "resident";
          fetch("/api/residency/entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uniqueId,
              entryId: updated.id,
              title: updated.title,
              content: entryText(updated),
              blocks: updated.blocks,
              themes: updated.themes,
              mood: updated.mood,
              entryDate: updated.date,
              entryTime: updated.time,
              metadata: { via: updated.via },
            }),
          }).catch(() => {});
        }
      }
    } catch {}
  },

  deleteEntry(id: string) {
    set((s) => ({
      entries: s.entries.filter((e) => e.id !== id),
      // A map keeps what it found, minus the entry; one left with nothing goes.
      trail: s.trail.map((t) => ({ ...t, entryIds: t.entryIds.filter((x) => x !== id) })).filter((t) => t.entryIds.length || t.text),
      fresh: s.fresh === id ? null : s.fresh,
      mem: { ...s.mem, focus: s.mem.focus === id ? null : s.mem.focus, sel: s.mem.sel.filter((x) => x !== id) },
      stack: s.stack.filter((x) => !(x.name === "entry" && x.id === id)),
    }));
  },

  // Opening the first page remembers the spot you tapped, so the page grows out of it and
  // goes back into it, whatever you tapped and wherever it sits.
  push(s: Screen) {
    set((st) => ({ stack: [...st.stack, s], from: st.stack.length ? st.from : tapped.x < 0 ? null : { ...tapped } }));
  },
  pop() {
    set((st) => ({ stack: st.stack.slice(0, -1) }));
  },
  home() {
    set({ stack: [] });
  },

  mem(patch: Partial<State["mem"]>) {
    set((s) => ({ mem: { ...s.mem, ...patch } }));
  },

  startQuest(q: Quest) {
    set((s) => ({ quests: s.quests.some((x) => x.id === q.id) ? s.quests : [...s.quests, q] }));
  },

  // Pattern map: a sheet over whatever you're on.
  open(scope: Scope, trailId?: string, at?: "voice") {
    set({ sheet: { key: Date.now(), scope, trailId, at } });
  },
  closeSheet() {
    set({ sheet: null });
  },
  remember(item: Omit<TrailItem, "id" | "date">) {
    const t: TrailItem = { ...item, id: uid("r"), date: iso(new Date()) };
    set((s) => ({ trail: [t, ...s.trail] }));
    return t;
  },

  // Energy mapping. Reach out, and they're asked; a moment later they say yes, and a thread
  // opens with their first message. Only then is the rest of them disclosed.
  reach(id: string) {
    const p = personById(id);
    if (!p || get().reached[id]) return;
    set((s) => ({ reached: { ...s.reached, [id]: "asked" } }));
    setTimeout(() => {
      set((s) => ({
        reached: { ...s.reached, [id]: "yes" },
        dms: { ...s.dms, [id]: [{ id: uid("d"), from: "force", text: `${p.name} said yes. I'm here too.` }, { id: uid("d"), from: "them", text: p.reply }, { id: uid("d"), from: "force", text: p.together, poll: { options: ["We're in", "Something else"], votes: {} } }] },
      }));
      f.toast(`${p.name} said yes`);
    }, 2400);
  },
  // Someone reached out to you.
  answer(yes: boolean) {
    const p = personById(INCOMING.id)!;
    set((s) => ({
      incoming: yes ? "yes" : "no",
      reached: yes ? { ...s.reached, [p.id]: "yes" } : s.reached,
      dms: yes ? { ...s.dms, [p.id]: [{ id: uid("d"), from: "force", text: `You said yes to ${p.name}. I'm here too.` }, { id: uid("d"), from: "them", text: p.reply }, { id: uid("d"), from: "force", text: p.together, poll: { options: ["We're in", "Something else"], votes: {} } }] } : s.dms,
    }));
  },
  dmSend(id: string, text: string) {
    const t = text.trim();
    if (!t) return;
    set((s) => ({ dms: { ...s.dms, [id]: [...(s.dms[id] ?? []), { id: uid("d"), from: "me", text: t }] } }));
    // A thread that opened with Force alone: they answer your first message.
    const p = personById(id);
    if (p && !get().dms[id].some((m) => m.from === "them"))
      setTimeout(() => set((s) => (s.dms[id].some((m) => m.from === "them") ? s : { dms: { ...s.dms, [id]: [...s.dms[id], { id: uid("d"), from: "them", text: p.reply }] } })), 1500);
  },
  // Voting in one of Force's polls. They vote a moment later.
  vote(id: string, msgId: string, option: string) {
    const p = personById(id);
    const cast = (who: "me" | "them", opt: string) =>
      set((s) => ({
        dms: {
          ...s.dms,
          [id]: s.dms[id].map((m) => {
            if (m.id !== msgId || !m.poll) return m;
            const votes: Record<string, ("me" | "them")[]> = {};
            m.poll.options.forEach((o) => (votes[o] = (m.poll!.votes[o] ?? []).filter((v) => v !== who)));
            votes[opt] = [...(votes[opt] ?? []), who];
            return { ...m, poll: { ...m.poll, votes } };
          }),
        },
      }));
    cast("me", option);
    const already = get().dms[id].find((m) => m.id === msgId)?.poll?.votes;
    if (already && Object.values(already).some((v) => v.includes("them"))) return;
    setTimeout(() => {
      cast("them", option);
      setTimeout(() => {
        const yes = /in$/i.test(option);
        set((s) => ({ dms: { ...s.dms, [id]: [...(s.dms[id] ?? []), yes ? { id: uid("d"), from: "them", text: p?.group ? "See you Sunday!" : "Yes! Let's do it." } : { id: uid("d"), from: "force", text: "Okay. Tell me what you'd both rather do and I'll find a time for it." }] } }));
      }, 900);
    }, 1400);
  },

  // Next moves from a pattern map: keep one and you'll be nudged; drop one and it's gone.
  keepMove(text: string) {
    set((s) => ({ moves: s.moves.some((m) => m.text === text) ? s.moves.map((m) => (m.text === text ? { ...m, kept: true } : m)) : [...s.moves, { id: uid("v"), text, kept: true }] }));
    f.toast("Kept. Force will nudge you.");
  },
  dropMove(text: string) {
    set((s) => ({ moves: s.moves.some((m) => m.text === text) ? s.moves.map((m) => (m.text === text ? { ...m, kept: false } : m)) : [...s.moves, { id: uid("v"), text, kept: false }] }));
  },

  toast(text: string) {
    set({ toast: { key: Date.now(), text } });
  },
  clearToast() {
    set({ toast: null });
  },
  clearFresh() {
    set({ fresh: null });
  },
};

// ── helpers ──

export const chatWords = (chat: Msg[]) =>
  chat
    .filter((m) => m.from === "me")
    .map((m) => (m.kind === "text" ? m.text : m.kind === "audio" ? m.clip.transcript : ""))
    .filter(Boolean)
    .join("\n\n");

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const parse = (d: string) => new Date(`${d}T12:00:00`);
/** July 08, 2026 */
export const fmtLong = (d: string) => {
  const x = parse(d);
  return `${MONTHS[x.getMonth()]} ${String(x.getDate()).padStart(2, "0")}, ${x.getFullYear()}`;
};
/** Jul 8, 2026 */
export const fmtShort = (d: string) => {
  const x = parse(d);
  return `${MON[x.getMonth()]} ${x.getDate()}, ${x.getFullYear()}`;
};
export const fmtMonth = (d: string) => {
  const x = parse(d);
  return `${MON[x.getMonth()]} ${x.getFullYear()}`;
};
/** on 8 July */
export const fmtDay = (d: string) => {
  const x = parse(d);
  const today = iso(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (d === today) return "earlier today";
  if (d === iso(y)) return "yesterday";
  const sameYear = x.getFullYear() === new Date().getFullYear();
  return `on ${MONTHS[x.getMonth()]} ${x.getDate()}${sameYear ? "" : `, ${x.getFullYear()}`}`;
};
export const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
export const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function titleFrom(mine: Msg[]) {
  const firstText = mine.find((m) => m.kind === "text") as { text: string } | undefined;
  const firstClip = mine.find((m) => m.kind === "audio") as { clip: Clip } | undefined;
  const src = firstText?.text ?? firstClip?.clip.transcript;
  if (!src) return mine[0].kind === "image" ? "A photo" : "A moment";
  // The first clause of the first sentence, short enough to read as a title.
  const first = src.split(/(?<=[.!?])\s+/)[0].replace(/[.!?]$/, "");
  const clause = first.split(/,|;|\s+(?:but|and|because|so)\s+/i)[0].trim();
  const w = clause.split(/\s+/);
  const t = w.length <= 7 ? clause : w.slice(0, 6).join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

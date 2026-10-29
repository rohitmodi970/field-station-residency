"use client";

// The residency's own state: who you are, your three answers and what you offer and seek,
// Onairos, and the Intent Snapshot Force drafts from them, with your edits, your approval and
// your sharing choice. It survives a refresh and reopening (the v1.1 definition of done);
// ?reset=1 starts over.

import { create } from "zustand";
import type { Clip } from "@/data/mira";
import type { LinkKind } from "@/data/residency";
import { visible, type Connection, type Field, type Finding, type NextStep, type OnairosNormalized, type Snapshot, type SynthInput, type VoiceSignal } from "@/contract/residency";
import * as api from "@/lib/r/api";

interface R {
  done: boolean;
  uniqueId?: string;
  email?: string;
  me: string; // your resident id
  name: string;
  links: Partial<Record<LinkKind, string>>;
  extra: string[]; // links that aren't one of the five
  onairos: "off" | "busy" | "on" | "failed";
  persona: OnairosNormalized | null; // the normalized minimum
  rawOnairos?: any; // raw payload from Onairos widget for database persistence
  answers: string[];
  contribution: { can_offer: string[]; seeking: string[] };
  snapshot: Snapshot | null;
  synth: "idle" | "busy" | "failed";
  lookup: boolean;
  sharePersona: boolean; // you said yes to Force reading what's public about you
  footprint: { status: "idle" | "busy" | "done" | "failed"; findings: Finding[]; read: string[] };
  dropped: string[]; // findings you said weren't you
  mine: Connection[]; // your connections, once you've approved and shared
  linking: boolean; // Force is looking for them
  clips: Clip[]; // your recorded answers, for this visit only (the audio doesn't survive a refresh)
  tab: "conversations" | "people"; // which half of home is showing
  tip: boolean; // you've seen how to correct the snapshot
}

const KEY = "force.residency.v2";
const id = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const fresh = (): R => ({ done: false, uniqueId: id(), email: '', me: id(), name: "", links: {}, extra: [], onairos: "off", persona: null, rawOnairos: null, answers: [], contribution: { can_offer: [], seeking: [] }, snapshot: null, synth: "idle", lookup: false, sharePersona: false, footprint: { status: "idle", findings: [], read: [] }, dropped: [], mine: [], linking: false, clips: [], tab: "people", tip: false });

// Decided before anything renders, so there's never a flash of the wrong step.
const load = (): R => {
  try {
    if (typeof window === "undefined") return fresh();
    if (new URLSearchParams(window.location.search).get("reset") === "1") {
      localStorage.removeItem(KEY);
      return fresh();
    }
    const s = localStorage.getItem(KEY);
    if (!s) return fresh();
    const o = JSON.parse(s) as Partial<R>;
    // Work that was in flight when the page closed isn't any more.
    return { ...fresh(), ...o, uniqueId: o.uniqueId || o.me || id(), email: o.email || '', clips: [], linking: false, footprint: o.footprint?.status === "busy" ? { status: "idle", findings: [], read: [] } : (o.footprint ?? fresh().footprint), onairos: o.onairos === "on" ? "on" : o.onairos === "busy" ? "off" : (o.onairos ?? "off"), synth: o.synth === "busy" ? (o.snapshot ? "idle" : "failed") : (o.synth ?? "idle") };
  } catch {
    return fresh();
  }
};

export const useR = create<R>(load);
const set = useR.setState;
const get = useR.getState;

useR.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...s, clips: [] }));
  } catch {}
});

// How each recorded answer was said, measured from the recording.
const voiceOf = (clips: Clip[]): VoiceSignal[] =>
  clips
    .map((c) => ({ answer: Number(/Answer (\d)/.exec(c.name)?.[1] ?? 0), secs: c.secs, pace: c.pace, pauses: c.pauses, longest_pause: c.longest }))
    .filter((v) => v.answer > 0 && v.secs > 2);

const input = (): SynthInput => {
  const s = get();
  const kept = s.footprint.findings.filter((x) => !s.dropped.includes(x.id));
  const links = [...Object.values(s.links), ...s.extra].filter((l): l is string => !!l?.trim());
  return {
    resident_id: s.me,
    name: s.name,
    answers: s.answers,
    contribution: s.contribution,
    onairos: s.persona,
    raw_onairos: (s as any).rawOnairos || undefined,
    public: kept.length ? kept : undefined,
    links: links.length ? links : undefined,
    voice: voiceOf(s.clips),
  } as any;
};

// Reading what's public runs while you answer; synthesis waits for it, but not for long.
let reading: Promise<void> | null = null;
const readPublic = () => {
  const s = get();
  if (!s.lookup || !s.name.trim() || s.footprint.status === "busy") return;
  set({ footprint: { status: "busy", findings: [], read: [] }, dropped: [] });
  const links = [...Object.values(s.links), ...s.extra].filter((l): l is string => !!l?.trim());
  console.log(`🌐 [DATA FLOW: Public Footprint Lookup] Reading public profile for "${s.name}" with links:`, links);
  reading = api
    .footprint(s.name, links)
    .then((f) => {
      console.log(`✅ [DATA RECEIVED: Public Footprint Findings] Found ${f.findings.length} findings from ${f.read.length} sources for "${s.name}":`, f);
      set({ footprint: { status: "done", ...f } });
    })
    .catch((err) => {
      console.error("❌ [DATA ERROR: Public Footprint Failed]:", err);
      set({ footprint: { status: "failed", findings: [], read: [] } });
    });
};

// Who you're connected with follows what you've approved and shared, and nothing else.
const link = async () => {
  const s = get().snapshot;
  if (!s || !visible(s)) return set({ mine: [], linking: false });
  set({ linking: true });
  console.log(`🔍 [DATA FLOW: Matching Connections] Requesting connections for "${s.name}" (status: ${s.status}, shared: ${s.shared})`);
  try {
    const mine = await api.connections(s);
    console.log(`🤝 [DATA RECEIVED: Connections] Received ${mine.length} peer matches:`, mine);
    set({ mine, linking: false });
  } catch (err) {
    console.warn("⚠️ [DATA FLOW: Connections Error]", err);
    set({ linking: false });
  }
};

// Every change to the snapshot goes through here. Changing what you approved means approving
// it again before the cohort sees the new version.
const publicPersona = () => {
  const s = get();
  return s.sharePersona && s.persona ? { ...s.persona, private_growth: [], nudges: [] } : undefined;
};

const patch = (fn: (s: Snapshot) => Snapshot) => {
  const s = get().snapshot;
  if (!s) return;
  const next = fn(s);
  console.log("✏️ [DATA MUTATION: Snapshot Edited]", { before: s, after: next });
  set({ snapshot: { ...next, status: s.status === "approved" ? "pending_review" : next.status, updated_at: new Date().toISOString() } });
};

export const r = {
  setName(name: string) {
    set({ name });
    patch((s) => ({ ...s, name: name.trim() || "You" }));
  },
  setLink(k: LinkKind, v: string) {
    console.log(`🔗 [DATA STORE: Link Updated] Kind: "${k}" -> "${v}"`);
    set((s) => {
      const nextLinks = { ...s.links, [k]: v };
      console.log("📂 [DATA STORE: Current Links Set]:", nextLinks);
      return { links: nextLinks };
    });
  },
  setExtra(i: number, v: string) {
    console.log(`🔗 [DATA STORE: Extra Link Updated] Index: ${i} -> "${v}"`);
    set((s) => {
      const nextExtra = s.extra.map((x, j) => (j === i ? v : x));
      console.log("📂 [DATA STORE: Current Extra Links]:", nextExtra);
      return { extra: nextExtra };
    });
  },
  addExtra() {
    console.log("➕ [DATA STORE: Extra Link Slot Added]");
    set((s) => ({ extra: [...s.extra, ""] }));
  },
  // The real Onairos button hands its payload in as raw; without it, the labelled sample.
  async connectOnairos(raw?: unknown) {
    if (get().onairos === "busy" || get().onairos === "on") return;
    set({ onairos: "busy" });
    console.log("🧩 [DATA INTAKE: Onairos] Connecting...", {
      source: raw ? "LIVE_ONAIROS_SDK_RESPONSE" : "SAMPLE_FIXTURE",
      rawPayload: raw || "none (fallback)",
    });
    try {
      const persona = await api.onairos(raw, get().name, get().uniqueId || get().me);
      console.log("✅ [DATA PROCESSED: Onairos Persona] Normalized result:", {
        source: persona.fixture ? "contract/fixtures/onairos-general.json" : "Onairos Live API",
        summary: persona.summary,
        positiveTraits: persona.positive,
        nudges: persona.nudges,
      });
      set({ persona, onairos: "on", rawOnairos: raw || null });
    } catch (err) {
      console.error("❌ [DATA ERROR: Onairos Connection Failed]:", err);
      set({ onairos: "failed" });
    }
  },
  disconnectOnairos() {
    console.log("🔌 [DATA EVENT: Onairos Disconnected]");
    set({ onairos: "off", persona: null, rawOnairos: null });
  },
  setAnswers(answers: string[], clips: Clip[] = []) {
    console.log("🎙️ [DATA INTAKE: User Answers]", {
      source: "Resident input (Voice/Text)",
      answers,
      clipsCount: clips.length,
      clipsDetails: clips.map((c) => ({ name: c.name, duration: c.duration, transcript: c.transcript })),
    });
    set({ answers, clips });
  },
  setContribution(c: R["contribution"]) {
    console.log("🤝 [DATA INTAKE: Contribution]", {
      source: "Resident selection (Chips/Custom Text)",
      can_offer: c.can_offer,
      seeking: c.seeking,
    });
    set({ contribution: c });
  },
  // Answers in: Force drafts the snapshot. A failure leaves a way on, never a spinner.
  async synthesize() {
    set({ synth: "busy" });
    if (reading && get().footprint.status === "busy") {
      await Promise.race([reading, new Promise((r) => setTimeout(r, 30000))]);
    }
    const payload = input();
    console.log("🚀 [DATA FLOW: Sending to /api/residency/intent/synthesize]", {
      destination: "POST /api/residency/intent/synthesize",
      payload,
    });
    try {
      const snap = await api.synthesize(payload);
      console.log("✨ [DATA RECEIVED: Synthesized Snapshot]", {
        source: snap.source === "model" ? "Claude Haiku 4.5 AI Model" : "Extractive Draft Rules",
        snapshotId: snap.id,
        intent: snap.intent,
        problem: snap.problem,
        approach: snap.approach,
        frontier: snap.current_frontier,
        next_step: snap.next_step,
        noticed: snap.noticed,
        provenance: snap.provenance,
        publicFindings: snap.public_findings?.length,
      });
      if (snap.public_findings?.length && (!get().footprint.findings.length || get().footprint.status !== "done")) {
        set({
          footprint: {
            status: "done",
            findings: snap.public_findings,
            read: snap.public_findings.flatMap((f: any) => (f.sources || []).map((s: any) => s.title)),
          },
        });
      }
      set({ snapshot: snap, synth: "idle" });
    } catch (err) {
      console.error("❌ [DATA FLOW: Synthesis Failed]:", err);
      set({ synth: "failed" });
    }
  },
  useDraft() {
    const draftSnap = api.draft(input());
    console.log("📋 [DATA FALLBACK: Using Local Draft Snapshot]:", draftSnap);
    set({ snapshot: draftSnap, synth: "idle" });
  },
  editField(k: Field | string, v: any) {
    patch((s) => {
      let value: any = v;
      if (k === "approach") {
        value = Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : String(v).split(/[,·]+/).map((x) => x.trim()).filter(Boolean);
      } else if (k === "positive_traits") {
        if (typeof v === "string") {
          value = v.split("\n").map((line) => {
            const match = line.match(/^([^:]+)(?::\s*(\d+))?$/);
            if (match) {
              return { name: match[1].trim(), strength: match[2] ? parseInt(match[2], 10) : 85 };
            }
            return { name: line.trim(), strength: 85 };
          }).filter((t) => !!t.name);
        } else {
          value = v;
        }
      } else if (k === "nudges") {
        if (typeof v === "string") {
          value = v.split("\n").map((l) => l.trim()).filter(Boolean);
        } else {
          value = v;
        }
      } else if (k === "contribution") {
        value = v;
      } else {
        value = typeof v === "string" ? v.trim() || null : v;
      }
      return {
        ...s,
        [k]: value,
        provenance: {
          ...s.provenance,
          [k]: value && (!Array.isArray(value) || value.length) ? ["user_edit"] : [],
        },
        inferred: k === "approach" ? [] : s.inferred,
      };
    });
  },
  confirmField(k: Field | "current_frontier" | "contribution") {
    patch((s) => ({
      ...s,
      inferred: k === "approach" ? [] : s.inferred,
      provenance: {
        ...s.provenance,
        [k]: [...new Set([...((s.provenance as any)[k] ?? []), "user_edit" as const])],
      },
    }));
  },
  nextStep(status: NextStep["status"]) {
    patch((s) => (s.next_step ? { ...s, next_step: { ...s.next_step, status } } : s));
  },
  // Your own wording, or your own step when Force had nothing good enough to suggest.
  writeNextStep(text: string) {
    const t = text.trim();
    if (!t) return;
    patch((s) => ({ ...s, next_step: { text: t, why_it_may_help: s.next_step?.why_it_may_help ?? "You chose this yourself.", status: "accepted", source: s.next_step && s.next_step.source !== "user" ? s.next_step.source : "user" } }));
  },
  // Sharing is its own choice. Once approved, turning it off takes you out of the graph now.
  async setShared(shared: boolean) {
    const s = get().snapshot;
    if (!s) return;
    console.log(`🔒 [DATA CONSENT: Sharing Toggle Changed] new sharing_consent: ${shared}`);
    if (s.status !== "approved") return set({ snapshot: { ...s, shared } });
    const approvedSnap = await api.approve(s, shared);
    console.log("💾 [DATA PERSISTED: Supabase Sharing Updated]:", approvedSnap);
    set({ snapshot: approvedSnap });
    await link();
  },
  async approve() {
    const s = get().snapshot;
    if (!s) return;
    console.log("✍️ [DATA FLOW: Submitting Approval to /api/residency/intent/approve]", {
      snapshotId: s.id,
      resident: s.name,
      shared: s.shared,
      status: "user_approved",
    });
    const approvedSnap = await api.approve(s, s.shared);
    console.log("🎉 [DATA CONFIRMED: Snapshot Approved & Persisted to Supabase]:", approvedSnap);
    set({ snapshot: approvedSnap });
    void link();
  },
  relink: link,
  finish(tab: R["tab"] = "people") {
    set({ done: true, tab });
  },
  tipSeen() {
    if (!get().tip) set({ tip: true });
  },
  async setSharePersona(v: boolean) {
    set({ sharePersona: v });
    const s = get().snapshot;
    const persona = v && get().persona ? { ...get().persona!, private_growth: [], nudges: [] } : undefined;
    if (s?.status === "approved") {
      const approvedSnap = await api.approve({ ...s, persona }, s.shared);
      set({ snapshot: approvedSnap });
    } else if (s) {
      set({ snapshot: { ...s, persona } });
    }
  },
  setTab(tab: R["tab"]) {
    set({ tab });
  },
  setLookup(v: boolean) {
    set({ lookup: v });
    if (!v) set({ footprint: { status: "idle", findings: [], read: [] }, dropped: [] });
  },
  readPublic,
  dropFinding(id: string) {
    set((s) => ({ dropped: [...s.dropped, id] }));
  },
  undoDrop() {
    set((s) => ({ dropped: s.dropped.slice(0, -1) }));
  },
  startOver() {
    set(fresh());
  },
  logout() {
    set(fresh());
  },
};

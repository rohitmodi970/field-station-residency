// The residency's API, one function per endpoint in the v1.1 contract (§4). Synthesis and
// connections run through this app's own routes (app/api/residency/*, the model behind them
// when there's a key). With NEXT_PUBLIC_RESIDENCY_API set, every call goes to the backend at
// that address instead. The cohort itself is the known-good fixture until the backend serves
// it (fallback rung 2: live synthesis + reviewed edges).
//
//   POST /api/residency/intent/synthesize    synthesize()
//   POST /api/residency/intent/approve       approve()
//   GET  /api/residency/intent/snapshot      the store keeps it (lib/f/residency.ts)
//   GET  /api/residency/graph                graph()
//   GET  /api/residency/graph/connection     connectionWith()
//   POST /api/residency/connections          connections()  (this app's addition)
//   POST /api/residency/onairos              onairos()      (logs & normalizes persona)

import cohort from "@/contract/fixtures/cohort.json";
import onairosSample from "@/contract/fixtures/onairos-general.json";
import { normalizeOnairos, personId, projectGraph, synthesize as localSynth, visible, type Connection, type Finding, type Graph, type OnairosNormalized, type Snapshot, type SynthInput } from "@/contract/residency";

const BASE = process.env.NEXT_PUBLIC_RESIDENCY_API?.replace(/\/$/, "") ?? "";
export const live = !!BASE;

const flag = (k: string) => typeof window !== "undefined" && new URLSearchParams(window.location.search).get(k) === "fail";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call<T>(path: string, body?: unknown): Promise<T> {
  const url = `${BASE}${path}`;
  const start = performance.now();
  console.log(`📡 [API Request] ${body === undefined ? "GET" : "POST"} ${url}`, body !== undefined ? body : "");
  try {
    const res = await fetch(url, body === undefined ? { credentials: "include" } : { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const duration = Math.round(performance.now() - start);
    if (!res.ok) {
      console.error(`❌ [API Error] ${path} returned status ${res.status} (${duration}ms)`);
      throw new Error(`${path} answered ${res.status}`);
    }
    const data = await res.json() as T;
    console.log(`✅ [API Response] ${path} (${duration}ms):`, data);
    return data;
  } catch (err: any) {
    const duration = Math.round(performance.now() - start);
    console.error(`💥 [API Exception] ${path} (${duration}ms):`, err?.message || err);
    throw err;
  }
}

export const COHORT = cohort.snapshots as Snapshot[];
const REVIEWED = cohort.connections as Connection[];

// Onairos: hands its payload to POST /api/residency/onairos for server-side logging and normalization.
export async function onairos(raw?: unknown, name?: string, residentId?: string): Promise<OnairosNormalized> {
  console.log("🧩 [API] onairos() called. Raw payload:", raw ? "PRESENT (from Onairos Widget)" : "NONE (will use sample)");
  try {
    const res = await call<any>("/api/residency/onairos", {
      raw,
      isSample: raw === undefined,
      name,
      resident_id: residentId,
    });
    if (res?.persona) {
      console.log("✅ [API:Onairos] Received normalized persona from server:", res.persona);
      return res.persona;
    }
  } catch (e: any) {
    console.warn("⚠️ [API:Onairos] Server logging call note, falling back to local normalizer:", e?.message || e);
  }

  if (raw !== undefined) {
    const n = normalizeOnairos(raw);
    if (!n) {
      console.warn("⚠️ [API:Onairos] Failed to normalize payload");
      throw new Error("Onairos sent something Force couldn't read");
    }
    console.log("✅ [API:Onairos] Locally normalized persona:", n);
    return n;
  }
  await wait(1400);
  if (flag("onairos")) {
    console.warn("⚠️ [API:Onairos] Simulating failure via ?onairos=fail");
    throw new Error("Onairos didn't answer");
  }
  const norm = normalizeOnairos(onairosSample, true)!;
  console.log("✅ [API:Onairos] Using fixture sample:", norm);
  return norm;
}

export async function synthesize(input: SynthInput): Promise<Snapshot> {
  console.log("🧠 [API] synthesize() called for resident:", input.name, input.resident_id);
  if (flag("synth")) {
    await wait(1200);
    console.warn("⚠️ [API:Synthesize] Simulating failure via ?synth=fail");
    throw new Error("Synthesis didn't answer");
  }
  const res = await call<any>("/api/residency/intent/synthesize", input);
  const snap = (res?.snapshot || res) as Snapshot;
  console.log("✅ [API:Synthesize] Resolved snapshot:", snap.id, snap.intent);
  return snap;
}

// What's public about you, only because you said yes.
export async function footprint(name: string, links: string[]): Promise<{ findings: Finding[]; read: string[] }> {
  console.log("🔍 [API] footprint() called for:", name, links);
  return call("/api/residency/footprint", { consent: true, name, links });
}

// Who you're connected with, once your snapshot is approved and shared.
export async function connections(me: Snapshot): Promise<Connection[]> {
  console.log("🤝 [API] connections() called for:", me.name, "visible:", visible(me));
  if (!visible(me)) return [];
  const res = await call<{ mine: Connection[] }>("/api/residency/connections", { me });
  console.log("✅ [API:Connections] Found connections count:", res.mine?.length ?? 0);
  return res.mine;
}

// The draft Force can always make from the answers alone, if synthesis is down.
export const draft = (input: SynthInput) => {
  console.log("📝 [API] draft() called as local fallback for:", input.name);
  return localSynth(input);
};

export async function approve(s: Snapshot, shared: boolean): Promise<Snapshot> {
  console.log("✍️ [API] approve() called for snapshot:", s.id, "shared:", shared);
  const body = {
    user_id: s.resident_id,
    user_name: s.name,
    snapshot_id: s.id,
    cohort_id: "dhun-oct-2026",
    sharing_consent: shared,
    share_persona: !!s.persona,
    sharePersona: !!s.persona,
    edited_fields: {
      intent: s.intent,
      problem: s.problem,
      approach: s.approach,
      archetype: s.archetype,
      positive_traits: s.positive_traits,
      user_summary: s.user_summary,
      top_traits_explanation: s.top_traits_explanation,
      nudges: s.nudges,
      onairos_metadata: s.onairos_metadata,
      current_frontier: s.current_frontier,
      contribution: s.contribution,
      next_step: s.next_step,
      persona: s.persona ?? null,
    },
    fields: {
      intent: s.intent,
      problem: s.problem,
      approach: s.approach,
      archetype: s.archetype,
      positive_traits: s.positive_traits,
      user_summary: s.user_summary,
      top_traits_explanation: s.top_traits_explanation,
      nudges: s.nudges,
      onairos_metadata: s.onairos_metadata,
      current_frontier: s.current_frontier,
      contribution: s.contribution,
      next_step: s.next_step,
      persona: s.persona ?? null,
    },
    persona: s.persona ?? null,
    approved: true,
    shared,
  };
  try {
    const res = await call<any>("/api/residency/intent/approve", body);
    const snap = (res?.snapshot || res) as Snapshot;
    console.log("✅ [API:Approve] Snapshot approved and persisted:", snap.id, "status:", snap.status);
    return snap;
  } catch (err) {
    console.warn("⚠️ [API:Approve] Remote approve error, fallback to local update:", err);
    return { ...s, status: "approved", shared, updated_at: new Date().toISOString() };
  }
}

// The cohort graph, with you in it only once you've approved and shared. Your connections
// come from connections(); everyone else's are the reviewed ones.
export function localGraph(me: Snapshot | null, mine: Connection[] = []): { graph: Graph; mine: Connection[] } {
  console.log("🗺️ [API] localGraph() projected for:", me?.name || "anonymous", "mine count:", mine.length);
  const others = COHORT.filter((s) => s.resident_id !== me?.resident_id);
  const graph = projectGraph(me ? [...others, me] : others, [...REVIEWED, ...mine], (s) => s.intent ?? s.problem ?? "Unknown");
  return { graph, mine };
}

export async function graph(me: Snapshot | null): Promise<{ graph: Graph; mine: Connection[] }> {
  console.log("🌐 [API] graph() requested for:", me?.name || "anonymous");
  try {
    const g = await call<Graph>("/api/residency/graph");
    if (g && Array.isArray(g.nodes)) {
      const pid = me ? personId(me.resident_id) : "";
      const myEdges = g.edges.filter((e): e is Connection => "why_connected" in e && (e.source === pid || e.target === pid));
      console.log(`✅ [API:Graph] Remote graph fetched: ${g.nodes.length} nodes, ${g.edges.length} edges (my connections: ${myEdges.length})`);
      return { graph: g, mine: myEdges };
    }
  } catch (e: any) {
    console.warn("⚠️ [API:Graph] Remote graph failed, using local projection:", e?.message);
  }
  return localGraph(me);
}

export async function connectionWith(mine: Connection[], resident: string): Promise<Connection | null> {
  console.log("🔎 [API] connectionWith() requested for resident:", resident);
  try {
    const conn = await call<Connection | null>(`/api/residency/graph/connection?resident=${encodeURIComponent(resident)}`);
    if (conn) {
      console.log("✅ [API:ConnectionWith] Found connection:", conn.id);
      return conn;
    }
  } catch {
    // Continue
  }
  const pid = personId(resident);
  const found = mine.find((c) => c.source === pid || c.target === pid) ?? null;
  console.log("ℹ️ [API:ConnectionWith] Local match:", found ? found.id : "none");
  return found;
}

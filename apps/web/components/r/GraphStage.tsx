"use client";

// The residency's graph, for the pitch: everyone who approved and shared, on three rings,
// the founder's three kinds of node: people outside, what each wants to change (intent)
// inside them, and the approaches in the middle where people meet. Not part of a resident's
// flow; it's shown at the end. Tap any node for what Force can say about it.

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CONNECTION_LABEL, isConnection } from "@/contract/residency";
import { cohortWorld, residentById, type WNode } from "@/data/residency";
import { useR } from "@/lib/f/residency";
import { useCohort } from "@/lib/r/cohort";
import Glass from "../f/Glass";
import { I, Logo, SPRING, haptic } from "../f/ui";
import PatternWorld from "./PatternWorld";

const names = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : (xs[0] ?? ""));

export default function GraphStage() {
  const { graph } = useCohort();
  const me = useR((s) => s.me);
  const world = useMemo(() => cohortWorld(graph, me), [graph, me]);
  const [focus, setFocus] = useState<string | null>(null);
  const byId = useMemo(() => new Map(world.nodes.map((x) => [x.id, x])), [world]);
  const around = (id: string) => world.edges.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : [])).map((x) => byId.get(x)!).filter(Boolean);
  const who = (rid?: string) => (rid === me ? "you" : (residentById(rid ?? "")?.name ?? "someone"));
  const count = (k: WNode["kind"][]) => world.nodes.filter((x) => k.includes(x.kind)).length;
  const links = graph.edges.filter(isConnection);
  const n = focus ? (byId.get(focus) ?? null) : null;

  const read = (x: WNode): { head: string; body: string } | null => {
    if (x.kind === "theme") {
      const people = [...new Set(around(x.id).filter((y) => y.kind === "intent").map((y) => who(y.person)))];
      return { head: "Who works through this", body: people.length > 1 ? `${names(people)} all work through ${x.label.toLowerCase()}.` : `Only ${people[0]} so far.` };
    }
    if (x.kind === "intent") return { head: `What ${who(x.person)} want${x.person === me ? "" : "s"} to change`, body: x.label };
    const pid = x.id;
    const theirs = links.filter((c) => c.source === pid || c.target === pid);
    if (theirs.length) return { head: "Connected", body: theirs.map((c) => `${CONNECTION_LABEL[c.type]} with ${who((c.source === pid ? c.target : c.source).replace(/^person_/, ""))}: ${c.why_connected}`).join(" ") };
    return { head: "Connected", body: "No clear reason to connect yet." };
  };

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <header className="flex flex-wrap items-end justify-between gap-4 px-6 pb-2 pt-6 sm:px-10 sm:pt-8">
        <div>
          <p className="flex items-center gap-2 t-label text-ink-3">
            <Glass size={22} art="dusk" x={40} y={40} zoom={300}>
              <Logo size={10} />
            </Glass>
            Force · Dhun residency
          </p>
          <h1 className="mt-2 t-large text-ink">Everyone, by what they&apos;re trying to make happen</h1>
        </div>
        <dl className="flex gap-6">
          {[
            ["People", count(["person", "you"])],
            ["Intents", count(["intent"])],
            ["Approaches", count(["theme"])],
            ["Connections", links.length],
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="t-meta text-ink-3">{k}</dt>
              <dd className="t-title text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </header>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 px-6 t-label text-ink-2 sm:px-10" aria-label="How to read it">
        <li>Outer ring: people</li>
        <li>Middle ring: what each wants to change</li>
        <li>Centre: approaches they share</li>
        <li className="text-ink-3">Tap anything · drag to turn</li>
      </ul>
      <div className="relative min-h-0 flex-1">
        <PatternWorld nodes={world.nodes} edges={world.edges} focus={focus} onTap={setFocus} layout="tiers" />
        <AnimatePresence>
          {n && (
            <motion.div key={n.id} className="absolute bottom-6 left-1/2 w-[min(440px,calc(100%-32px))] -translate-x-1/2 rounded-[24px] bg-paper p-5" style={{ boxShadow: "var(--lift-2)" }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={SPRING.ui}>
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block t-meta text-ink-3">{n.kind === "theme" ? "Approach" : n.kind === "intent" ? "Intent" : "Person"}</span>
                  <span className="mt-[2px] block t-body font-semibold text-ink">{n.kind === "person" ? `${n.label} · ${residentById(n.person ?? "")?.work ?? ""}` : n.label}</span>
                </span>
                <button type="button" aria-label="Close" onClick={() => (haptic(), setFocus(null))} className="press hit grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fill text-ink">
                  <I.Close size={14} />
                </button>
              </div>
              {read(n) && (
                <div className="mt-3 rounded-[20px] bg-fill px-4 py-3">
                  <p className="flex items-center gap-2 t-meta text-ink-3">
                    <Glass size={18} art={n.art} zoom={320} /> {read(n)!.head}
                  </p>
                  <p className="mt-2 t-body text-ink">{read(n)!.body}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

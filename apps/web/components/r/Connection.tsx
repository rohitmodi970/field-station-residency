"use client";

// A resident's page, the way Gigi shows a person: their face and name big, what they're on,
// the themes they work through, then "You and them" (why you're connected, what to explore,
// the evidence from both approved snapshots, reviewed or suggested) and their Scoops. At the
// bottom, a first message Force has drafted for you to change and send. Everything about
// them comes from their approved, shared snapshot; nothing is invented.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy } from "lucide-react";
import { CONNECTION_BADGE, CONNECTION_LABEL, FIELD_LABEL, isConnection, type Connection, type Evidence, type Snapshot } from "@/contract/residency";
import { residentById, residentFromSnapshot } from "@/data/residency";
import { f } from "@/lib/f/store";
import { useR } from "@/lib/f/residency";
import { COHORT } from "@/lib/r/api";
import { useCohort } from "@/lib/r/cohort";
import Face from "../f/Face";
import Nav, { BlurBottom } from "../f/Nav";
import Grow from "./Grow";
import Traits from "./Traits";
import { Band } from "./Painted";
import Glass from "../f/Glass";
import { Logo, SPRING, haptic } from "../f/ui";

// How you're connected, the iOS way: a plain word in secondary text. No pills, no icons
// (they turn to smudges at this size).
export function Kind({ c, className = "" }: { c: Connection; className?: string }) {
  return <span className={`block t-label text-ink-2 ${className}`}>{CONNECTION_BADGE[c.type].label}</span>;
}

// A first hello when Force has no drafted one: plain, specific, small.
const hello = (name: string, s?: Snapshot) => `Hi ${name}! I saw you're working on ${(s?.intent ?? "something I'd love to hear about").replace(/\.$/, "").replace(/^[A-Z]/, (m) => m.toLowerCase())}. Could I steal ten minutes this week to hear how it's going?`;

export default function ConnectionPage({ id, say = false }: { id: string; say?: boolean }) {
  const me = useR((s) => s.me);
  const snapshot = useR((s) => s.snapshot);
  const { graph, people, snapshots } = useCohort();
  const [writing, setWriting] = useState(say);
  const [editing, setEditing] = useState(false);
  const theirs = snapshots?.find((s) => s.resident_id === id) || COHORT.find((s) => s.resident_id === id);
  const p = residentById(id, people) || (theirs ? residentFromSnapshot(theirs) : null);
  const pid = `person_${id}`;
  const conn = graph.edges.filter(isConnection).find((e) => (e.source === pid || e.target === pid) && (e.source === `person_${me}` || e.target === `person_${me}`)) ?? null;
  const [text, setText] = useState(() => conn?.opener ?? hello(p?.name ?? "", theirs));
  if (!p) return null;
  const evTheirs = conn?.evidence.find((e) => e.snapshot_id !== snapshot?.id);
  const evYours = conn?.evidence.find((e) => e.snapshot_id === snapshot?.id);
  const scoops = theirs
    ? ([
        ["Working on", theirs.intent],
        ["The problem", theirs.problem],
        ["Stuck on", theirs.current_frontier],
        ["Can offer", theirs.contribution?.can_offer?.join(", ")],
        ["Looking for", theirs.contribution?.seeking?.join(", ")],
      ].filter(([, v]) => v) as [string, string][])
    : [];
  // Messages between residents don't run inside Force yet, so the hello goes the way people
  // here already talk: WhatsApp, or copied to paste anywhere.
  const whatsapp = () => {
    if (!text.trim()) return;
    haptic("done");
    window.open(`https://wa.me/?text=${encodeURIComponent(text.trim())}`, "_blank", "noopener");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text.trim());
      haptic("done");
      f.toast("Copied. Paste it wherever you two talk.");
    } catch {
      f.toast("Couldn't copy on this browser.");
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      <Nav title={p.name} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-[72px]">
        <div className="px-1">
          <Face face={p.face} size={80} />
          <h1 className="mt-4 t-large text-ink">{p.name}</h1>
          {conn && <Kind c={conn} className="mt-1" />}
          <p className="mt-1 t-body text-ink-3">{p.work}</p>
          {!!theirs?.approach.length && (
            <div className="mt-3 flex flex-wrap gap-[6px]">
              {theirs.approach.map((a) => (
                <span key={a} className="rounded-full bg-paper px-3 py-[6px] t-label text-ink" style={{ boxShadow: "var(--lift-1)" }}>
                  {a}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 flex items-center gap-[6px] t-meta text-ink-3">
            <Logo size={12} /> From {p.name}&apos;s approved snapshot, shared with the residency
          </p>
        </div>

        <section className="mt-8">
          <h3 className="mb-3 px-1 t-body text-ink-3">You and {p.name}</h3>
          {conn ? (
            <div className="rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
              <p className="t-meta text-ink-3">{CONNECTION_LABEL[conn.type]}</p>
              <p className="mt-1 t-title text-ink">{conn.why_connected}</p>
              <div className="mt-4 rounded-[20px] bg-fill px-4 py-3">
                <p className="flex items-center gap-2 t-meta text-ink-3">
                  <Glass size={20} art={p.face.art} x={p.face.x} y={p.face.y} zoom={320} /> Something to explore together
                </p>
                <p className="mt-2 t-body text-ink">{conn.what_to_explore}</p>
              </div>
              <p className="mt-3 flex items-center gap-[6px] t-meta text-ink-3">
                <span className="h-[6px] w-[6px] rounded-full" style={{ background: conn.origin === "reviewed" ? "var(--sage-4)" : "var(--grey-300)" }} aria-hidden />
                {conn.origin === "reviewed" ? `Reviewed by ${conn.reviewed_by ?? "the Force team"}` : "Suggested by Force, not yet reviewed"}
              </p>
            </div>
          ) : (
            <p className="rounded-[28px] bg-fill p-5 t-body text-ink-2">Force hasn&apos;t found a clear reason to connect you two yet. It only suggests one when it can say why.</p>
          )}
        </section>

        {scoops.length > 0 && (
          <section className="mt-8">
            <h3 className="mb-3 px-1 t-body text-ink-3">Scoops</h3>
            <ul className="scroll-row no-scrollbar -mx-4 gap-2 px-4 pb-2">
              {scoops.map(([k, v], j) => (
                <li key={k} className="flex w-[232px] shrink-0 flex-col overflow-hidden rounded-[24px] bg-paper" style={{ boxShadow: "var(--lift-1)" }}>
                  <Band i={j} h={44} />
                  <div className="flex flex-1 flex-col p-4">
                    <span className="t-meta uppercase text-ink-3">{k}</span>
                    <p className="mt-2 flex-1 t-body text-ink">{v}</p>
                    <span className="mt-3 t-meta text-ink-3">Their snapshot</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {theirs?.persona && <Traits p={theirs.persona} who={p?.name} />}

        {conn && (evTheirs || evYours) && (
          <section className="mt-8">
            <h3 className="mb-1 px-1 t-body text-ink-3">Why Force thinks so</h3>
            <p className="mb-3 px-1 t-label text-ink-3">From both of your approved snapshots.</p>
            <ul className="flex flex-col gap-2">
              {evTheirs && <Quote who={p.name} e={evTheirs} />}
              {evYours && <Quote who="You" e={evYours} />}
            </ul>
          </section>
        )}
      </div>

      <div className="relative shrink-0 px-4 pb-3 pt-2">
        <BlurBottom />
        <AnimatePresence initial={false} mode="popLayout">
          {writing ? (
            <motion.div key="write" className="rounded-[26px] bg-paper p-4" style={{ boxShadow: "var(--lift-2)" }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={SPRING.ui}>
              <p className="flex items-center gap-[6px] t-meta text-ink-3">
                <Logo size={12} /> Force drafted this from both snapshots
              </p>
              {editing ? (
                <div className="-mx-1 mt-1 rounded-[18px] bg-fill px-3">
                  <Grow value={text} onChange={setText} onSend={() => setEditing(false)} autoFocus aria-label={`Hello to ${p.name}`} max={5} />
                </div>
              ) : (
                <p className="mt-2 line-clamp-4 t-body text-ink">{text}</p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <button type="button" onClick={() => (haptic(), setEditing(!editing))} className="press h-10 rounded-full bg-fill px-4 t-label font-medium text-ink">
                  {editing ? "Done" : "Edit"}
                </button>
                <span className="flex-1" />
                <button type="button" onClick={copy} disabled={!text.trim()} aria-label="Copy" className="press grid h-10 w-10 place-items-center rounded-full bg-fill text-ink disabled:opacity-20">
                  <Copy size={16} strokeWidth={1.75} absoluteStrokeWidth />
                </button>
                <div className="flex h-10 items-center rounded-full bg-fill px-4 t-label font-medium text-ink-2">
                  Coming after residency
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex h-[52px] w-full items-center justify-center rounded-full bg-fill px-4 t-body font-medium text-ink-2">
              Coming after residency
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Quote({ who, e }: { who: string; e: Evidence }) {
  return (
    <li className="rounded-[28px] bg-fill p-5">
      <p className="t-meta text-ink-3">
        {who} · {FIELD_LABEL[e.field]}
      </p>
      <p className="mt-1 t-body text-ink">“{e.text}”</p>
    </li>
  );
}

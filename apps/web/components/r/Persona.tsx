"use client";

// "Here's what Force understands so far": your Intent Snapshot, the four parts Force drafted
// from your answers, each with where it came from, each yours to correct. Your map first
// (you, what you want to change, the approaches around it, the people you're connected with),
// then the four parts, one useful next step, what Onairos added, and two separate choices:
// approve it, and whether the residency can see it. Nothing that ranks you, nothing that grades your personality.
//
// Correcting works the way next moves do: swipe right if it's right, left if it isn't (it
// clears, for you to say it your way), tap to rewrite.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Settings2 } from "lucide-react";
import { CONNECTION_LABEL, QUESTIONS, FIELD_LABEL, FIELD_MEANING, isEmpty, type Field, type Snapshot } from "@/contract/residency";
import { residentById, youWorld, type NodeKind } from "@/data/residency";
import { f } from "@/lib/f/store";
import { r, useR } from "@/lib/f/residency";
import { otherIn, useCohort } from "@/lib/r/cohort";
import Nav, { BlurBottom } from "../f/Nav";
import MapFrame from "./MapFrame";
import { Band, FIELD_ART, ForceMark, InsightDeck, PARTS, cropOf } from "./Painted";
import Traits from "./Traits";
import Glass from "../f/Glass";
import { LinkList, LookupCard, NameField, OnairosCard } from "./Links";
import { AudioBubble } from "../f/Bubbles";
import Grow from "./Grow";
import { I, SPRING, haptic } from "../f/ui";

// ── Your map ──
export function useYouWorld() {
  const snapshot = useR((s) => s.snapshot);
  const name = useR((s) => s.name);
  const { mine, people } = useCohort();
  return useMemo(() => youWorld(snapshot, name, mine, people), [snapshot, name, mine, people]);
}

const KIND: Record<NodeKind, string> = { you: "You", intent: "Intent & problem", theme: "Theme & approach", person: "Connected in the residency" };

function YouMap() {
  const world = useYouWorld();
  const { people } = useCohort();
  return (
    <MapFrame
      nodes={world.nodes}
      edges={world.edges}
      height={300}
      title="Your map"
      card={(n, setFocus) => {
        const links = world.edges.flatMap(([a, b]) => (a === n.id ? [b] : b === n.id ? [a] : [])).map((id) => world.nodes.find((x) => x.id === id)!);
        const res = n.person ? residentById(n.person, people) : null;
        return (
          <motion.div key={n.id} className="mt-2 rounded-[24px] bg-paper p-4" style={{ boxShadow: "var(--lift-1)" }} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={SPRING.ui}>
            <div className="flex items-start gap-3">
              <span className="min-w-0 flex-1">
                <span className="block t-meta text-ink-3">{res ? n.from : n.id === "frontier" ? "Your open question" : KIND[n.kind]}</span>
                <span className="mt-[2px] block t-body font-semibold text-ink">{res ? `${res.name} · ${res.work}` : n.label}</span>
                {n.from && !res && <span className="mt-1 block t-meta text-ink-3">{n.from}</span>}
              </span>
              <button type="button" aria-label="Close" onClick={() => setFocus(null)} className="press hit grid h-8 w-8 shrink-0 place-items-center rounded-full bg-fill text-ink">
                <I.Close size={14} />
              </button>
            </div>
            {n.line && (
              <div className="mt-3 rounded-[20px] bg-fill px-4 py-3">
                <p className="flex items-center gap-2 t-meta text-ink-3">
                  <Glass size={20} art={n.art} zoom={320} /> {res ? "Why you're connected" : n.kind === "you" ? "What Force noticed" : "Force's take"}
                </p>
                <p className="mt-2 t-body text-ink">{n.line}</p>
              </div>
            )}
            {links.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-[6px]">
                {links.map((l) => (
                  <button key={l.id} type="button" onClick={() => (haptic(), setFocus(l.id))} className="press hit h-8 rounded-full bg-fill px-3 t-label text-ink">
                    {l.title}
                  </button>
                ))}
              </div>
            )}
            {res && (
              <button type="button" onClick={() => (haptic(), f.push({ name: "connection", id: res.id }))} className="press pill-ink mt-3 h-11 w-full justify-center t-body font-medium">
                Why you&apos;re connected
              </button>
            )}
          </motion.div>
        );
      }}
    />
  );
}

// ── Swipe to say ──
// The same gesture as a next move: pull right for yes, left for no.
// peek: once, on arrival, the card shows you both sides by itself, the way iOS Mail does.
function Swipe({ onRight, onLeft, right, left, children, className = "", style, peek }: { onRight?: () => void; onLeft: () => void; right?: string; left: string; children: React.ReactNode; className?: string; style?: React.CSSProperties; peek?: boolean }) {
  const x = useMotionValue(0);
  const dragged = useRef(false);
  const lastDragEnd = useRef(0); // blocks synthetic mobile clicks from triggering child buttons

  useEffect(() => {
    if (!peek) return;
    const id = setTimeout(() => animate(x, [0, 84, 84, 0, -84, -84, 0], { duration: 2.6, times: [0, 0.16, 0.34, 0.5, 0.66, 0.84, 1], ease: "easeInOut" }), 900);
    return () => clearTimeout(id);
  }, [peek, x]);

  const rightA = useTransform(x, [0, 50], [0, 1]);
  const leftA = useTransform(x, [-50, 0], [1, 0]);

  return (
    <div className="relative rounded-[28px]">
      {onRight && (
        <motion.span className="absolute inset-0 flex items-center gap-2 rounded-[28px] pl-5 t-body font-medium" style={{ opacity: rightA, color: "var(--sage-7)", background: "var(--sage-1)" }} aria-hidden>
          <I.Check size={18} /> {right}
        </motion.span>
      )}
      <motion.span className="absolute inset-0 flex items-center justify-end gap-2 rounded-[28px] pr-5 t-body font-medium" style={{ opacity: leftA, color: "var(--rose-7)", background: "var(--rose-1)" }} aria-hidden>
        {left} <I.Close size={18} />
      </motion.span>
      <motion.div
        className={`relative ${className}`}
        style={{ x, touchAction: "pan-y", ...style }}
        drag="x"
        dragDirectionLock={true}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.7, right: onRight ? 0.7 : 0.05 }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onClickCapture={(e) => {
          // Prevent synthetic click from firing on children (e.g. edit button) right after a swipe drag
          if (dragged.current || Date.now() - lastDragEnd.current < 400) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        onDragEnd={(_, i) => {
          lastDragEnd.current = Date.now();
          setTimeout(() => {
            dragged.current = false;
          }, 400);

          // Calibrated thresholds for mobile thumbs (40px offset or 200px/s flick)
          const isRight = onRight && (i.offset.x > 40 || i.velocity.x > 200);
          const isLeft = i.offset.x < -40 || i.velocity.x < -200;

          if (isRight) {
            haptic("done");
            animate(x, 0, { type: "spring", stiffness: 450, damping: 30 });
            onRight();
          } else if (isLeft) {
            haptic("soft");
            animate(x, 0, { type: "spring", stiffness: 450, damping: 30 });
            onLeft();
          } else {
            animate(x, 0, { type: "spring", stiffness: 450, damping: 30 });
          }
        }}
      >
        {children}
      </motion.div>
      {/* The same choices without a swipe, for keyboards and screen readers */}
      <span className="sr-only">
        {onRight && (
          <button type="button" onClick={onRight}>
            {right}
          </button>
        )}
        <button type="button" onClick={onLeft}>
          {left}
        </button>
      </span>
    </div>
  );
}
      {/* The same choices without a swipe, for keyboards and screen readers */}
      <span className="sr-only">
        {onRight && (
          <button type="button" onClick={onRight}>
            {right}
          </button>
        )}
        <button type="button" onClick={onLeft}>
          {left}
        </button>
      </span>
    </div>
  );
}

// ── The four parts ──

const SOURCE: Record<string, string> = {
  "user_answer:q1": "From your answer to question 1",
  "user_answer:q2": "From your answer to question 2",
  "user_answer:q3": "From your answer to question 3",
  user_answer: "Read from the words in your answers",
  user_edit: "You said this",
};

function sourceOf(s: Snapshot, k: Field, onairos: boolean) {
  const p = s.provenance[k] ?? [];
  if (p.includes("user_edit")) return "You said this";
  const base = SOURCE[p[0]] ?? "";
  if (k === "approach") return `${base}${p.includes("onairos:positive_traits") && onairos ? ", supported by Onairos" : ""}${s.inferred.length ? `. ${s.inferred.length === s.approach.length ? "Read between the lines" : `${s.inferred.join(", ")} read between the lines`}, so check it.` : ""}`;
  return base;
}

function valueOf(s: Snapshot, k: Field) {
  if (k === "approach") return s.approach.join(" · ");
  return (s[k] as string | null) ?? "";
}

function FieldCard({ s, k, peek, onairos }: { s: Snapshot; k: Field; peek?: boolean; onairos: boolean }) {
  const [edit, setEdit] = useState<string | null>(null);
  const empty = isEmpty(s, k);
  if (edit !== null)
    return (
      <form
        className="rounded-[28px] bg-paper p-4"
        style={{ boxShadow: "var(--lift-2)" }}
        onSubmit={(e) => {
          e.preventDefault();
          r.editField(k, k === "approach" ? edit.split(",") : edit);
          setEdit(null);
        }}
      >
        <p className="t-meta text-ink-3">{FIELD_LABEL[k]}</p>
        <textarea value={edit} onChange={(e) => setEdit(e.target.value)} autoFocus rows={3} aria-label={`${FIELD_LABEL[k]}, in your words`} placeholder={FIELD_MEANING[k]} className="mt-1 block w-full resize-none bg-transparent t-body font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-3" />
        {k === "approach" && <p className="t-meta text-ink-3">Separate them with commas.</p>}
        <div className="mt-2 flex items-center justify-end gap-1">
          <button type="button" onClick={() => setEdit(null)} className="press h-9 px-3 t-label text-ink-3">
            Cancel
          </button>
          <button type="submit" className="press h-9 rounded-full bg-ink px-4 t-label font-medium text-paper">
            Save
          </button>
        </div>
      </form>
    );
  const open = () => setEdit(k === "approach" ? s.approach.join(", ") : ((s[k] as string | null) ?? ""));
  const said = (s.provenance[k] ?? []).includes("user_edit");
  const art = FIELD_ART[k];
  const [, cx, cy] = cropOf(Object.keys(FIELD_ART).indexOf(k));
  if (empty)
    return (
      <button type="button" onClick={open} className="press block w-full rounded-[28px] bg-paper p-5 text-left" style={{ boxShadow: "var(--lift-1)" }}>
        <span className="block t-meta text-ink-3">{FIELD_LABEL[k]}</span>
        <span className="mt-1 block t-body text-ink-3">Force doesn&apos;t know this yet.</span>
        <span className="mt-2 flex items-center gap-1 t-label font-medium text-ink">
          <I.Plus size={14} /> {FIELD_MEANING[k]}
        </span>
      </button>
    );
  return (
    <Swipe peek={peek} right="That's right" left="Not right" onRight={() => (r.confirmField(k), r.tipSeen())} onLeft={() => (r.tipSeen(), open())} className="rounded-[28px] bg-paper p-5 pr-12" style={{ boxShadow: "var(--lift-1)" }}>
      <span className="pointer-events-none absolute right-4 top-5 text-ink-4" aria-hidden>
        <I.Edit size={16} />
      </span>
      <button type="button" onClick={open} aria-label={`${FIELD_LABEL[k]}: ${valueOf(s, k)}. Tap to rewrite.`} className="block w-full text-left">
        <span className="flex items-center gap-2 t-meta text-ink-3">
          <Glass size={22} art={art} x={cx} y={cy} zoom={320} /> {FIELD_LABEL[k]}
        </span>
        <span className="mt-2 block whitespace-pre-line t-body font-semibold text-ink">{valueOf(s, k)}</span>
        <span className="mt-2 flex items-center gap-[6px] t-label" style={{ color: said ? "var(--sage-7)" : undefined }}>
          {said && <I.Check size={13} />}
          <span className={said ? "" : "text-ink-3"}>{sourceOf(s, k, onairos)}</span>
        </span>
      </button>
    </Swipe>
  );
}

// How to answer Force, shown big the first time: the gestures people already know from Mail
// and every photo app, spelled out once.
function Tip() {
  const seen = useR((s) => s.tip);
  return (
    <AnimatePresence initial={false}>
      {!seen && (
        <motion.div className="overflow-hidden" exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }}>
          <div className="mb-3 rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
            <p className="t-body font-semibold text-ink">Is this right?</p>
            <p className="mt-1 t-label text-ink-3">Force drafted these from what you said. Correct anything; your words win.</p>
            <ul className="mt-4 flex flex-col gap-3">
              <li className="flex items-center gap-3 t-body text-ink">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--sage-1)", color: "var(--sage-7)" }}>
                  <I.Arrow size={18} />
                </span>
                <span>
                  <span className="font-medium">Swipe right</span> if it&apos;s right
                </span>
              </li>
              <li className="flex items-center gap-3 t-body text-ink">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--rose-1)", color: "var(--rose-7)" }}>
                  <I.Arrow size={18} className="rotate-180" />
                </span>
                <span>
                  <span className="font-medium">Swipe left</span> if it isn&apos;t
                </span>
              </li>
              <li className="flex items-center gap-3 t-body text-ink">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fill text-ink-2">
                  <I.Edit size={16} />
                </span>
                <span>
                  <span className="font-medium">Tap</span> to say it your way
                </span>
              </li>
            </ul>
            <button type="button" onClick={() => (haptic(), r.tipSeen())} className="press mt-5 h-11 w-full rounded-full bg-fill t-body font-medium text-ink">
              Got it
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── One useful next step ──
// At most one, tied to what you said. Accept, edit, dismiss; nothing runs by itself. With
// nothing good enough to suggest, Force asks you to choose one.
function NextStep({ s }: { s: Snapshot }) {
  const n = s.next_step;
  const [edit, setEdit] = useState<string | null>(null);
  const save = () => {
    r.writeNextStep(edit ?? "");
    setEdit(null);
  };
  if (edit !== null || !n || n.status === "dismissed")
    return (
      <div>
        {n?.status === "dismissed" && edit === null && (
          <button type="button" onClick={() => r.nextStep("suggested")} className="press mb-2 flex h-11 items-center px-2 t-label text-ink-3">
            Dismissed · <span className="ml-1 font-medium text-ink-2">Undo</span>
          </button>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex min-h-[52px] items-end gap-2 rounded-[26px] bg-paper py-[6px] pl-5 pr-[6px]"
          style={{ boxShadow: "var(--lift-1)" }}
        >
          <Grow value={edit ?? ""} onChange={setEdit} onSend={save} autoFocus={edit !== null} placeholder={n ? "A small step of your own…" : "What one small step would help most?"} aria-label="Your next step" enterKeyHint="done" />
          {!!edit?.trim() && (
            <button type="submit" aria-label="Save" onPointerDown={(e) => e.preventDefault()} className="press grid h-10 w-10 place-items-center rounded-full bg-ink text-paper">
              <I.Up size={18} />
            </button>
          )}
        </form>
      </div>
    );
  const accepted = n.status === "accepted";
  return (
    <Swipe right="Accept" left="Dismiss" onRight={accepted ? undefined : () => r.nextStep("accepted")} onLeft={() => r.nextStep("dismissed")} className="overflow-hidden rounded-[28px] bg-paper" style={{ boxShadow: "var(--lift-1)" }}>
      <Band art="hills" h={44} />
      <span className="pointer-events-none absolute right-4 top-[64px] text-ink-4" aria-hidden>
        <I.Edit size={16} />
      </span>
      <div className="p-5 pr-12">
      <button type="button" onClick={() => setEdit(n.text)} aria-label={`${n.text}. Tap to edit.`} className="block w-full text-left">
        <span className="block t-body font-semibold text-ink">{n.text}</span>
        <span className="mt-2 block t-label text-ink-3">Why this may help: {n.why_it_may_help}</span>
        {n.source === "onairos_nudge" && <span className="mt-1 block t-meta text-ink-3">Picked from Onairos because it fits</span>}
        {accepted && (
          <span className="mt-2 flex items-center gap-[6px] t-meta" style={{ color: "var(--sage-7)" }}>
            <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--sage-4)" }} aria-hidden />
            Accepted
          </span>
        )}
      </button>
      </div>
    </Swipe>
  );
}

// ── What Force found about you ──
// Scoops, the way Gigi shows a person: a label, what was found, and where. Each is yours to
// remove; only what you keep shapes your snapshot, and none of it goes to the residency.
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

function Found() {
  const { lookup, footprint, dropped } = useR();
  if (!lookup) return null;
  if (footprint.status === "idle")
    return (
      <section className="mt-8">
        <H>What Force found about you</H>
        <button type="button" onClick={() => (haptic(), r.readPublic())} className="press h-11 w-full rounded-full bg-fill t-body font-medium text-ink">
          Look me up now
        </button>
      </section>
    );
  const kept = footprint.findings.filter((x) => !dropped.includes(x.id));
  return (
    <section className="mt-8">
      <H hint={footprint.read.length ? `Read: ${footprint.read.join(" · ")}` : undefined}>What Force found about you</H>
      {footprint.status === "busy" ? (
        <p className="rounded-[28px] bg-fill p-5 t-body text-ink-2">Still reading what&apos;s public about you…</p>
      ) : footprint.status === "failed" ? (
        <div className="rounded-[28px] bg-fill p-5">
          <p className="t-body text-ink-2">Couldn&apos;t read what&apos;s public just now.</p>
          <button type="button" onClick={() => (haptic(), r.readPublic())} className="press mt-3 h-10 rounded-full bg-paper px-4 t-label font-medium text-ink" style={{ boxShadow: "var(--lift-1)" }}>
            Try again
          </button>
        </div>
      ) : !footprint.findings.length ? (
        <p className="rounded-[28px] bg-fill p-5 t-body text-ink-2">Nothing public Force could tie to you with confidence, so it kept nothing.</p>
      ) : (
        <>
          <ul className="scroll-row no-scrollbar -mx-4 gap-2 px-4 pb-2" aria-label="What Force found">
            <AnimatePresence initial={false}>
              {kept.map((x, i) => (
                <motion.li key={x.id} layout exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }} transition={SPRING.move} className="flex w-[264px] shrink-0 flex-col overflow-hidden rounded-[24px] bg-paper" style={{ boxShadow: "var(--lift-1)" }}>
                  <Band i={i + 2} h={48} />
                  <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="t-meta uppercase text-ink-3">{x.label}</span>
                    <button type="button" aria-label="Not me, remove" onClick={() => (haptic("soft"), r.dropFinding(x.id))} className="press hit -mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-fill text-ink-3">
                      <I.Close size={12} />
                    </button>
                  </div>
                  <p className="mt-2 flex-1 t-body text-ink">{x.text}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="flex -space-x-1">
                      {x.sources.slice(0, 3).map((src) => (
                        <a key={src.url} href={src.url} target="_blank" rel="noreferrer" aria-label={src.title} className="grid h-6 w-6 place-items-center rounded-full bg-fill t-meta font-medium uppercase text-ink-2 ring-2 ring-[var(--paper)]">
                          {host(src.url)[0]}
                        </a>
                      ))}
                    </span>
                    <span className="truncate t-meta text-ink-3">
                      {x.sources.length === 1 ? host(x.sources[0].url) : `${x.sources.length} sources`}
                    </span>
                  </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {dropped.length > 0 && (
            <button type="button" onClick={() => r.undoDrop()} className="press flex h-11 items-center px-2 t-label text-ink-3">
              {dropped.length} not you · <span className="ml-1 font-medium text-ink-2">Undo</span>
            </button>
          )}
        </>
      )}
    </section>
  );
}

// ── Your answers, to hear again ──
function Answers() {
  const { answers, clips } = useR();
  if (!answers.length) return null;
  return (
    <section className="mt-8">
      <H hint="What you said, the way you said it.">Your answers</H>
      <ul className="flex flex-col gap-2">
        {QUESTIONS.map((q, i) => {
          const clip = clips.find((c) => c.name === `Answer ${i + 1}`);
          return (
            <li key={i} className="rounded-[24px] bg-paper p-4" style={{ boxShadow: "var(--lift-1)" }}>
              <p className="t-meta text-ink-3">{q}</p>
              {clip ? (
                <div className="mt-2">
                  <AudioBubble clip={clip} />
                </div>
              ) : null}
              {answers[i] && <p className="mt-2 t-body text-ink">{answers[i]}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Settings ──
// Everything that isn't the snapshot itself: your name, being looked up, your links,
// Onairos, starting over. Pushed over your page the iOS way.
function SettingsPage({ onClose }: { onClose: () => void }) {
  const onairos = useR((x) => x.onairos);
  return (
    <motion.div className="absolute inset-0 z-[5] flex flex-col bg-canvas" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%", transition: { type: "spring", duration: 0.28, bounce: 0 } }} transition={{ type: "spring", duration: 0.36, bounce: 0 }} style={{ boxShadow: "var(--lift-2)" }}>
      <Nav title="Settings" onBack={onClose} />
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-[64px]">
        <section className="mt-2">
          <H>Your name</H>
          <NameField />
        </section>
        <section className="mt-8">
          <H hint="What Force reads to understand you better. Change it any time.">Sources</H>
          <OnairosCard />
          <LookupCard className="mt-2" />
        </section>
        <section className="mt-8">
          <H hint="Optional. Force reads these only if you let it look you up.">Where people can find you</H>
          <LinkList />
        </section>
        <button
          type="button"
          onClick={() => {
            if (!window.confirm("Start over? Your answers and snapshot on this phone will be cleared.")) return;
            f.home();
            r.startOver();
          }}
          className="press mt-8 flex h-11 w-full items-center justify-center t-label text-ink-3"
        >
          Start over
        </button>
        {onairos === "on" && <p className="px-1 text-center t-meta text-ink-3">Onairos is connected.</p>}
      </div>
    </motion.div>
  );
}

// iOS switch, the same as on your profile.
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => (haptic(), onChange(!on))} className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-ink" : "bg-[var(--grey-300)]"}`}>
      <span className="absolute top-1 h-6 w-6 rounded-full bg-paper transition-[left] duration-200" style={{ left: on ? 24 : 4, boxShadow: "0 1px 3px rgb(28 27 26 / 0.2)" }} />
    </button>
  );
}

function H({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <>
      <h3 className={`${hint ? "mb-1" : "mb-3"} px-1 t-body text-ink-3`}>{children}</h3>
      {hint && <p className="mb-3 px-1 t-label text-ink-3">{hint}</p>}
    </>
  );
}

// Your page: the same from the snapshot in the conversation and from your face on home.
// onContinue: on the way in, approving takes you on to the residency.
export default function Persona({ onBack, onContinue }: { onBack?: () => void; onContinue?: () => void }) {
  const { name, snapshot: s, persona, onairos, tip, sharePersona } = useR();
  const { mine, people } = useCohort();
  const first = name.trim().split(/\s+/)[0];
  const [settings, setSettings] = useState(false);

  if (!s)
    return (
      <div className="relative flex h-full flex-col">
        <Nav title={first || "You"} onBack={onBack} />
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p className="t-body text-ink-3">Force hasn&apos;t drafted your snapshot yet.</p>
          <button type="button" onClick={() => (haptic(), r.useDraft())} className="press pill-ink mt-4 h-11 px-5 t-body font-medium">
            Draft it from my answers
          </button>
        </div>
      </div>
    );

  const approved = s.status === "approved";
  const canApprove = !!(s.intent || s.problem);
  const from = ["your three answers", onairos === "on" ? "Onairos" : ""].filter(Boolean);
  const status = s.shared ? "Approved and shared. You're in the cohort graph." : "Approved. Only you can see it.";

  return (
    <div className="relative flex h-full flex-col">
      <Nav
        title={first || "You"}
        onBack={onBack}
        right={
          <button type="button" aria-label="Settings" onClick={() => (haptic(), setSettings(true))} className="press pill hit h-11 w-11 justify-center p-0">
            <Settings2 size={19} strokeWidth={1.75} absoluteStrokeWidth />
          </button>
        }
      />
      <AnimatePresence>{settings && <SettingsPage key="settings" onClose={() => setSettings(false)} />}</AnimatePresence>
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-[64px]">
        <YouMap />

        <p className="mt-6 px-1 t-title text-ink">Here&apos;s what Force understands so far</p>
        <p className="mt-2 px-1 t-body text-ink-3">
          From {from.length > 1 ? `${from.slice(0, -1).join(", ")} and ${from.at(-1)}` : from[0]}. Check each part. Nothing is shared until you choose.
        </p>

        {!!s.noticed?.length && (
          <section className="mt-8">
            <h3 className="mb-4 flex items-center gap-2 px-1 t-body font-medium text-ink">
              <ForceMark size={26} /> What Force noticed
              <span className="t-meta font-normal text-ink-3">swipe</span>
            </h3>
            <InsightDeck items={s.noticed} />
          </section>
        )}

        {persona ? (
          <Traits p={persona}>
            <div id="next-step" className="mt-6 scroll-mt-20">
              <H hint="Swipe right to accept, left to dismiss, tap to change it.">{s.next_step?.source === "onairos_nudge" ? "Suggested action · from Onairos" : "Suggested action"}</H>
              <NextStep s={s} />
            </div>
          </Traits>
        ) : (
          // Not connected yet: the section is still here, with Onairos itself to connect in
          // place. It fills in the moment it's connected.
          <section className="mt-8">
            <h3 className="mb-1 flex items-center gap-2 px-1 t-body font-medium text-ink">
              <Glass size={26} art="dusk" x={40} y={55} zoom={300} /> How you come across
            </h3>
            <p className="mb-3 px-1 t-label text-ink-3">Your archetype, strengths, a short summary and why, from the apps you connect to Onairos. Only you see it.</p>
            <OnairosCard id="onairos-here" />
          </section>
        )}

        <Found />

        <section className="mt-8">
          <H hint="Force wrote these from what you said. Your words win.">The four parts</H>
          <Tip />
          <div className="flex flex-col gap-2">
            {PARTS.map((k, i) => (
              <FieldCard key={k} s={s} k={k} onairos={onairos === "on"} peek={!tip && i === 0} />
            ))}
          </div>
        </section>

{!persona && (
        <section id="next-step" className="mt-8 scroll-mt-20">
          <H hint="Swipe right to accept, left to dismiss, tap to change it.">A useful next step</H>
          <NextStep s={s} />
        </section>
        )}

        <Answers />

        <section className="mt-8">
          <H>Who sees this</H>
          <div className="rounded-[28px] bg-paper p-5" style={{ boxShadow: "var(--lift-1)" }}>
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block t-body font-medium text-ink">Share with the residency</span>
                <span className="mt-1 block t-label text-ink-3">Your name and these four parts join the cohort graph, so Force can suggest people. Never your recordings or links.</span>
              </span>
              <Toggle on={s.shared} onChange={(v) => r.setShared(v)} label="Share with the residency" />
            </div>
            {persona && s.shared && (
              <div className="mt-4 flex items-center gap-3 border-t border-[var(--fill)] pt-4">
                <span className="min-w-0 flex-1">
                  <span className="block t-body font-medium text-ink">Show how you come across</span>
                  <span className="mt-1 block t-label text-ink-3">Your archetype, summary and strengths on your page for residents.</span>
                </span>
                <Toggle on={sharePersona} onChange={(v) => r.setSharePersona(v)} label="Show how you come across" />
              </div>
            )}
            {approved && (
              <p className="mt-4 flex items-center gap-[6px] t-label" style={{ color: "var(--sage-7)" }}>
                <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: "var(--sage-4)" }} aria-hidden />
                <span>{status}</span>
              </p>
            )}
          </div>
          {approved && s.shared && mine.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2">
              {mine.map((c) => {
                const p = residentById(otherIn(c, s.resident_id), people);
                return p ? (
                  <li key={c.id}>
                    <button type="button" onClick={() => (haptic(), f.push({ name: "connection", id: p.id }))} className="press flex w-full items-center gap-3 rounded-[24px] bg-fill px-4 py-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block t-meta text-ink-3">{CONNECTION_LABEL[c.type]}</span>
                        <span className="block t-body text-ink">{p.name}</span>
                      </span>
                      <I.Chevron size={16} className="text-ink-4" />
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
          )}
        </section>

      </div>
      {(!approved || onContinue) && (
        <div className="relative shrink-0 px-4 pb-3 pt-2">
          <BlurBottom />
          {!approved && !canApprove && <p className="mb-2 px-1 text-center t-label text-ink-3">Add your intent or problem first.</p>}
          <button
            type="button"
            disabled={!approved && !canApprove}
            onClick={async () => {
              haptic("done");
              if (!approved) {
                await r.approve();
                f.toast(s.shared ? "Approved and shared with the residency." : "Approved. Only you can see it.");
              }
              onContinue?.();
            }}
            className="press pill-ink h-[52px] w-full justify-center t-body font-medium disabled:bg-fill disabled:text-ink-3"
          >
            {approved ? "Continue to the residency" : s.shared ? "Approve and share" : "Approve, keep it private"}
          </button>
        </div>
      )}
    </div>
  );
}

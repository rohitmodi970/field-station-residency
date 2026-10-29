"use client";

// Energy mapping. Your energy lately is the side quests you've been moving, shown as painted
// covers. Tap one and you dive into the painting (its own page, DivePage below): a side quest
// for that energy and the people who share it. Below the covers, the map: you in the
// middle, everyone with the same energy strung to you the way moments are strung in your
// world, the shorter the strand the nearer the energy. Tap someone and a card grows out of
// them. Before anyone says yes, the card shows a first name and the side quest you share,
// nothing else. Reach out and they're asked; when they say yes the rest of them is disclosed
// and a thread opens, with Force in it as the third person.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ART_SRC, ART_TONE } from "@/data/mira";
import { INCOMING, MIRA_FACE, PEOPLE, personById, questById, type Person } from "@/data/social";
import { f, useF, type DmMsg } from "@/lib/f/store";
import Glass from "./Glass";
import { ME_FACE } from "@/data/residency";
import Face from "./Face";
import Goo, { string, type Blob } from "./Goo";
import Nav from "./Nav";
import { ago, questEntries, useMyForce } from "./Quests";
import { I, Logo, SPRING, haptic } from "./ui";

const NONE: DmMsg[] = [];
const H = 460;
const ME = 0.6; // you sit low, so the strands fan up into the room

function QuestTag({ id, size = "sm" }: { id: string; size?: "sm" | "md" }) {
  const q = questById(id);
  if (!q) return null;
  return (
    <span className={`inline-flex max-w-full items-center gap-[6px] rounded-full ${size === "md" ? "h-8 pl-[6px] pr-3 t-label" : "h-6 pl-1 pr-2 t-meta"}`} style={{ background: ART_TONE[q.art].tint }}>
      <Face face={{ art: q.art, x: 40, y: 45 }} size={size === "md" ? 20 : 16} />
      <span className="truncate text-ink">{q.name}</span>
    </span>
  );
}

export default function Energy({ focus: initial }: { focus?: string }) {
  const reached = useF((s) => s.reached);
  const incoming = useF((s) => s.incoming);
  const dms = useF((s) => s.dms);
  const quests = useF((s) => s.quests);
  const entries = useF((s) => s.entries);
  const force = useMyForce();
  const talking = PEOPLE.filter((p) => reached[p.id] === "yes" || reached[p.id] === "asked").sort((a, b) => (reached[b.id] === "yes" ? 1 : 0) - (reached[a.id] === "yes" ? 1 : 0));
  const [focus, setFocus] = useState<string | null>(initial ?? (incoming === "new" ? INCOMING.id : null));
  const box = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(361);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (focus && reached[focus] === "yes") haptic("done");
  }, [focus, reached]);

  // Everyone strung to you. Angle spreads them round the upper room; length is how far their
  // energy is from yours. Nearer strands are thicker and brighter: warm near, cool far.
  const { spots, blobs } = useMemo(() => {
    const k = H / w;
    const n = PEOPLE.length;
    const me: Blob = { x: (0.5 * w) / H, y: ME, r: 0, art: "dusk" };
    const blobs: Blob[] = [];
    const spots = PEOPLE.map((p, i) => {
      // Alternate sides so neighbours in the list aren't neighbours on the map
      const slot = i % 2 === 0 ? i / 2 : n - 1 - (i - 1) / 2;
      const a = -Math.PI + 0.3 + ((slot + 0.5) / n) * (Math.PI - 0.6);
      const d = 0.15 + (1 - p.energy) * 0.72;
      const x = Math.max(0.12, Math.min(0.88, 0.5 + Math.cos(a) * d * k));
      const y = Math.max(0.12, ME + Math.sin(a) * d);
      const art = questById(p.shares)?.art ?? "water";
      const dim = (focus && focus !== p.id ? 0.3 : 1) * (0.55 + p.energy * 0.45);
      const end: Blob = { x: (x * w) / H, y, r: 0, art };
      blobs.push(...string(me, end, art, Math.round(10 + d * 30), 0.007 + p.energy * 0.007).map((b) => ({ ...b, a: dim })));
      return { p, x, y };
    });
    return { spots, blobs };
  }, [w, focus]);

  const pickedSpot = spots.find((s) => s.p.id === focus) ?? null;
  const mine = [...quests].sort((a, b) => force.indexOf(a.art) - force.indexOf(b.art)).slice(0, 4);

  return (
    <div ref={page} className="relative flex h-full flex-col">
      <Nav title="Energy map" />
      <div data-scroll="energy" className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-8 pt-[76px]">
        {/* The people you're talking to, and the ones you've reached out to */}
        {talking.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 px-5 t-body text-ink-3">Conversations</h2>
            <ul className="flex flex-col gap-2 px-4">
              {talking.map((p) => {
                const yes = reached[p.id] === "yes";
                const last = yes ? [...(dms[p.id] ?? [])].reverse().find((m) => m.from !== "force") : null;
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => (yes ? f.push({ name: "dm", id: p.id }) : setFocus(p.id))} className="press flex h-16 w-full items-center gap-3 rounded-full bg-paper pl-3 pr-4 text-left" style={{ boxShadow: "var(--lift-1)" }}>
                      <Face face={p.face} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate t-body text-ink">{p.group ? `${p.name} · ${p.group}` : p.name}</span>
                        <span className="block truncate t-label text-ink-3">{yes ? (last ? `${last.from === "me" ? "You: " : ""}${last.text}` : "Say hello") : `Waiting for ${p.group ? "them" : p.name} to say yes`}</span>
                      </span>
                      {yes ? <I.Chevron size={16} className="shrink-0 text-ink-4" /> : <motion.span className="h-2 w-2 shrink-0 rounded-full bg-blue" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <h2 className="mb-3 px-5 t-body text-ink-3">Your energy lately</h2>
        <ul className="grid grid-cols-2 gap-3 px-4">
          {mine.map((q) => {
            const last = questEntries(q, entries)[0];
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={(e) => {
                    haptic("soft");
                    // Where the cover is on the screen, so the painting can grow out of it
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const d = page.current?.parentElement?.getBoundingClientRect();
                    f.push({ name: "dive", id: q.id, from: { x: r.left - (d?.left ?? 0), y: r.top - (d?.top ?? 0), w: r.width, h: r.height } });
                  }}
                  className="press relative block aspect-[4/5] w-full overflow-hidden rounded-[24px] bg-cover bg-center text-left"
                  style={{ backgroundImage: `url(${ART_SRC[q.art]})`, boxShadow: "var(--lift-1)" }}
                >
                  <span className="absolute inset-0 grid place-items-center p-3">
                    <span className="max-w-full truncate rounded-full px-3 py-[5px] text-center t-label font-medium text-paper backdrop-blur-md" style={{ background: "rgb(28 27 26 / 0.28)" }}>
                      {q.name}
                    </span>
                  </span>
                  {last && (
                    <span className="absolute bottom-3 left-3 rounded-full px-2 py-[2px] t-meta text-paper backdrop-blur-md" style={{ background: "rgb(28 27 26 / 0.28)" }}>
                      {ago(last.date)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <h2 className="mb-3 mt-8 px-5 t-body text-ink-3">Same energy</h2>
        <div
          ref={box}
          className="relative mx-4 overflow-hidden rounded-[28px] bg-paper"
          style={{ height: H, boxShadow: "var(--lift-1)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === "CANVAS") setFocus(null);
          }}
        >
          <Goo blobs={blobs} w={w} h={H} className="absolute inset-0" />
          <span className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: "50%", top: `${ME * 100}%` }}>
            <Face face={MIRA_FACE} size={56} className="ring-[3px] ring-paper" />
            <span className="mt-1 t-meta text-ink-3">You</span>
          </span>
          {spots.map(({ p, x, y }) => {
            const on = focus === p.id;
            const asked = reached[p.id] === "asked";
            const yes = reached[p.id] === "yes";
            const wants = p.id === INCOMING.id && incoming === "new";
            return (
              <button
                key={p.id}
                type="button"
                aria-label={p.name}
                aria-pressed={on}
                onClick={() => {
                  haptic();
                  setFocus(on ? null : p.id);
                }}
                className="press absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: `${x * 100}%`, top: `${y * 100}%`, opacity: focus && !on ? 0.4 : 1 }}
              >
                <Face face={p.face} size={p.group ? 46 : 40} className={on ? "ring-[3px] ring-ink" : "ring-[3px] ring-paper"} />
                <span className={`mt-1 flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-[2px] t-meta font-medium ${on ? "bg-ink text-paper" : "bg-paper text-ink"}`} style={on ? undefined : { boxShadow: "var(--lift-1)" }}>
                  {wants && <span className="h-[6px] w-[6px] rounded-full bg-blue" aria-hidden />}
                  {p.group ? `${p.name} · ${p.group}` : p.name}
                  {yes && <I.Check size={12} />}
                  {asked && <span className="text-ink-3">…</span>}
                </span>
              </button>
            );
          })}

          <AnimatePresence>
            {pickedSpot ? (
              <Card key={pickedSpot.p.id} p={pickedSpot.p} x={pickedSpot.x * w} y={pickedSpot.y * H} state={reached[pickedSpot.p.id]} wants={pickedSpot.p.id === INCOMING.id && incoming === "new"} onClose={() => setFocus(null)} />
            ) : (
              <motion.span key="hint" className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-fill px-3 py-[6px] t-meta text-ink-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Shorter strand, nearer energy · tap someone
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}

// Diving into a painting. A page of its own, edge to edge: the cover grows to fill the
// screen while the picture pulls from a blur into focus, as if you'd gone through the
// surface. The energy's name sits in the middle of the painting. At the bottom, a side quest
// for this energy and the people who share it; tap one and their card takes the spot. Back
// is top-right, like every page on this side, and takes you out the way you came.
export function DivePage({ id, from }: { id: string; from?: { x: number; y: number; w: number; h: number } }) {
  const q = useF((s) => s.quests.find((x) => x.id === id)) ?? questById(id);
  const entries = useF((s) => s.entries);
  const reached = useF((s) => s.reached);
  const incoming = useF((s) => s.incoming);
  const [who, setWho] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 393, h: 852 });
  useLayoutEffect(() => {
    const el = root.current?.parentElement;
    if (el) setSize({ w: el.clientWidth, h: el.clientHeight });
  }, []);
  if (!q) return null;
  const sharers = PEOPLE.filter((p) => p.shares === q.id);
  const picked = who ? sharers.find((p) => p.id === who) ?? null : null;
  const last = questEntries(q, entries)[0];
  const cover = from ? { left: from.x, top: from.y, width: from.w, height: from.h, borderRadius: 24 } : { left: size.w * 0.25, top: size.h * 0.3, width: size.w * 0.5, height: size.h * 0.4, borderRadius: 24 };
  const full = { left: 0, top: 0, width: size.w, height: size.h, borderRadius: 0 };
  const leave = () => {
    if (leaving) return;
    setLeaving(true);
    haptic("soft");
    setTimeout(() => f.pop(), 420);
  };
  return (
    <motion.div ref={root} className="absolute overflow-hidden bg-ink" initial={cover} animate={leaving ? cover : full} transition={{ type: "spring", duration: leaving ? 0.45 : 0.75, bounce: 0 }}>
      {/* The painting pulls into focus as you go in */}
      <motion.div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${ART_SRC[q.art]})` }} initial={{ scale: 1.45, filter: "blur(18px)" }} animate={leaving ? { scale: 1.3, filter: "blur(12px)" } : { scale: 1, filter: "blur(0px)" }} transition={{ duration: leaving ? 0.4 : 1.1, ease: [0.2, 0.8, 0.2, 1] }} />
      <motion.div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgb(28 27 26 / 0.3), rgb(28 27 26 / 0) 28%, rgb(28 27 26 / 0) 58%, rgb(28 27 26 / 0.6))" }} initial={{ opacity: 0 }} animate={{ opacity: leaving ? 0 : 1 }} transition={{ delay: leaving ? 0 : 0.35, duration: 0.5 }} />

      <motion.div className="absolute inset-0 flex flex-col" style={{ paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }} initial={{ opacity: 0 }} animate={{ opacity: leaving ? 0 : 1 }} transition={{ delay: leaving ? 0 : 0.55, duration: 0.4 }}>
        <header className="flex h-14 shrink-0 items-center justify-start px-4">
          <button type="button" aria-label="Back" onClick={leave} className="press grid h-11 w-11 place-items-center rounded-full text-paper backdrop-blur-md" style={{ background: "rgb(28 27 26 / 0.3)" }}>
            <I.Back size={22} />
          </button>
        </header>

        {/* The energy, in the middle of the painting */}
        <button type="button" className="flex flex-1 flex-col items-center justify-center px-8 text-center" onClick={() => setWho(null)}>
          <span className="t-large text-paper" style={{ textShadow: "0 2px 24px rgb(28 27 26 / 0.55)" }}>
            {q.name}
          </span>
          {last && (
            <span className="mt-2 rounded-full px-3 py-1 t-label text-paper backdrop-blur-md" style={{ background: "rgb(28 27 26 / 0.28)" }}>
              Moved {ago(last.date)}
            </span>
          )}
        </button>

        <div className="shrink-0 px-4 pb-3">
          <AnimatePresence mode="wait" initial={false}>
            {picked ? (
              <motion.div key={picked.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16, transition: { duration: 0.15 } }} transition={SPRING.ui}>
                <Card p={picked} x={0} y={0} state={reached[picked.id]} wants={picked.id === INCOMING.id && incoming === "new"} onClose={() => setWho(null)} inPlace />
              </motion.div>
            ) : (
              <motion.div key="quest" className="rounded-[28px] p-5 text-paper backdrop-blur-xl" style={{ background: "rgb(28 27 26 / 0.42)" }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16, transition: { duration: 0.15 } }} transition={SPRING.ui}>
                <p className="t-label opacity-70">A side quest for this energy</p>
                <p className="mt-1 t-body font-semibold">{q.next}</p>
                <p className="mt-1 t-body opacity-80">{q.noticed}</p>
                {sharers.length > 0 && (
                  <>
                    <p className="mt-4 t-label opacity-70">{sharers.length === 1 ? "One person" : `${sharers.length} people`} with the same energy</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sharers.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            haptic();
                            setWho(p.id);
                          }}
                          className="press flex h-11 items-center gap-2 rounded-full pl-1 pr-4 t-body font-medium text-paper"
                          style={{ background: "rgb(255 255 255 / 0.16)" }}
                        >
                          <Face face={p.face} size={36} />
                          {p.group ? `${p.name} · ${p.group}` : p.name}
                          {reached[p.id] === "yes" && <I.Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

// The card that grows out of a person into its home at the bottom of the map.
function Card({ p, x, y, state, wants, onClose, inPlace }: { p: Person; x: number; y: number; state?: "asked" | "yes"; wants: boolean; onClose: () => void; inPlace?: boolean }) {
  return (
    <motion.div
      role="dialog"
      aria-label={p.name}
      className={`${inPlace ? "relative" : "absolute inset-x-3 bottom-3 z-10"} rounded-[24px] bg-paper p-4`}
      style={{ boxShadow: "var(--lift-2)", transformOrigin: inPlace ? undefined : `${x - 12}px ${y - H + 200}px` }}
      initial={inPlace ? false : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={inPlace ? undefined : { opacity: 0, scale: 0.8, transition: { duration: 0.12 } }}
      transition={SPRING.ui}
    >
      <div className="flex items-center gap-3">
        <Face face={p.face} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate t-body font-semibold text-ink">{p.group ? `${p.name} · ${p.group} people` : p.name}</p>
          {state === "yes" ? (
            <p className="truncate t-label text-ink-3">
              {p.where} · {p.km} km away
            </p>
          ) : (
            <QuestTag id={p.shares} />
          )}
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="press -mr-1 grid h-8 w-8 place-items-center rounded-full text-ink-3 active:bg-fill">
          <I.Close size={14} />
        </button>
      </div>

      {wants ? (
        <>
          <p className="mt-3 flex items-center gap-1 t-meta text-ink-3">
            <Logo size={12} className="text-ink" /> Found you
          </p>
          <p className="mt-1 t-body text-ink">{p.group ? "Their" : `${p.name}'s`} energy matches yours on this one. Do something together?</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => f.answer(false)} className="press h-11 flex-1 rounded-full bg-fill t-body font-medium text-ink">
              Not now
            </button>
            <button
              type="button"
              onClick={() => {
                haptic("done");
                f.answer(true);
              }}
              className="press h-11 flex-1 rounded-full bg-ink t-body font-medium text-paper"
            >
              Yes
            </button>
          </div>
        </>
      ) : state === "yes" ? (
        <>
          <p className="mt-3 t-body text-ink">{p.differs}</p>
          <p className="mt-1 t-label text-ink-3">“{p.words}”</p>
          <button type="button" onClick={() => f.push({ name: "dm", id: p.id })} className="press mt-3 h-11 w-full rounded-full bg-ink t-body font-medium text-paper">
            Open the thread
          </button>
        </>
      ) : state === "asked" ? (
        <p className="mt-3 flex items-center gap-2 t-body text-ink-2">
          <motion.span className="h-2 w-2 rounded-full bg-blue" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} aria-hidden />
          Asked. Waiting for {p.group ? "them" : p.name}.
        </p>
      ) : (
        <>
          <p className="mt-3 t-body text-ink-2">That&apos;s all either of you sees until you both say yes.</p>
          <button
            type="button"
            onClick={() => {
              haptic("done");
              f.reach(p.id);
            }}
            className="press mt-3 h-11 w-full rounded-full bg-ink t-body font-medium text-paper"
          >
            Reach out
          </button>
        </>
      )}
    </motion.div>
  );
}

// You and them, and the distance between you, drawn rather than written.
function Between({ p }: { p: Person }) {
  // In the residency you're someone new, not the demo's Mira
  const me = useF((s) => s.demo) === "new" ? ME_FACE : MIRA_FACE;
  return (
    <div className="flex w-full items-center justify-center gap-3 px-6">
      <span className="flex flex-col items-center gap-1">
        <Face face={me} size={52} />
        <span className="t-meta text-ink-3">You</span>
      </span>
      <span className="relative flex h-12 flex-1 items-center">
        <span className="h-px w-full" style={{ background: "linear-gradient(to right, var(--grey-300), var(--ink), var(--grey-300))" }} />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper px-3 py-1 t-label font-medium text-ink" style={{ boxShadow: "var(--lift-1)" }}>
          {p.km === 0 ? "Residency" : p.km >= 100 ? `${Math.round(p.km / 10) * 10} km` : `${p.km} km`}
        </span>
      </span>
      <span className="flex flex-col items-center gap-1">
        <Face face={p.face} size={52} />
        <span className="t-meta text-ink-3">{p.group ? `${p.group} people` : p.name}</span>
      </span>
    </div>
  );
}

function ForceFace({ size = 28 }: { size?: number }) {
  return (
    <Glass size={size} art="dusk" x={40} y={40} zoom={300}>
      <Logo size={size * 0.5} />
    </Glass>
  );
}

// Force's poll in the group: tap to vote, see who's in.
function Poll({ m, id, p }: { m: DmMsg; id: string; p: Person }) {
  const poll = m.poll!;
  const myVote = poll.options.find((o) => poll.votes[o]?.includes("me"));
  return (
    <div className="max-w-[300px] rounded-[20px] rounded-tl-[6px] bg-fill p-3">
      <p className="px-1 pb-2 t-body text-ink">{m.text}</p>
      <ul className="flex flex-col gap-[6px]">
        {poll.options.map((o) => {
          const vs = poll.votes[o] ?? [];
          const on = myVote === o;
          return (
            <li key={o}>
              <button type="button" onClick={() => f.vote(id, m.id, o)} aria-pressed={on} className={`press flex h-11 w-full items-center gap-2 rounded-full pl-4 pr-2 text-left t-body font-medium ${on ? "bg-ink text-paper" : "bg-paper text-ink"}`}>
                <span className="min-w-0 flex-1 truncate">{o}</span>
                <span className="flex">
                  {vs.map((v, i) => (
                    <span key={v} className="rounded-full ring-2 ring-paper" style={{ marginLeft: i ? -8 : 0 }}>
                      <Face face={v === "me" ? MIRA_FACE : p.face} size={24} />
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DmPage({ id }: { id: string }) {
  const p = personById(id);
  const msgs = useF((s) => s.dms[id]) ?? NONE;
  const [text, setText] = useState("");
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);
  if (!p) return null;
  const send = () => {
    f.dmSend(id, text);
    setText("");
  };
  return (
    <div className="relative flex h-full flex-col">
      <Nav
        title={p.group ? `${p.name} · ${p.group}` : p.name}
        right={
          <span className="pill h-11 w-11 justify-center p-0" aria-label="Force is in this thread" role="img">
            <Logo size={20} className="text-ink" />
          </span>
        }
      />
      <ul ref={list} className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 pb-3 pt-[64px]">
        <li className="mb-4 flex flex-col items-center gap-3">
          <Between p={p} />
          <ul className="flex flex-wrap justify-center gap-[6px] px-4">
            {p.quests.map((x) => (
              <li key={x.name} className="flex h-7 items-center gap-[6px] rounded-full bg-fill pl-[6px] pr-[10px] t-meta text-ink">
                <Face face={{ art: x.art, x: 50, y: 50 }} size={16} />
                {x.name}
              </li>
            ))}
          </ul>
        </li>
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const first = !prev || prev.from !== m.from;
          if (m.from === "me")
            return (
              <motion.li key={m.id} layout="position" transition={SPRING.move} className={`flex justify-end ${first ? "mt-3" : ""}`}>
                <span className="max-w-[290px] whitespace-pre-wrap rounded-[20px] bg-ink px-[14px] py-[9px] t-body text-paper">{m.text}</span>
              </motion.li>
            );
          // Them and Force: a group, so each voice has a face and a name
          return (
            <motion.li key={m.id} layout="position" transition={SPRING.move} className={`flex items-end gap-2 ${first ? "mt-3" : ""}`}>
              <span className="w-7 shrink-0">{first && (m.from === "force" ? <ForceFace /> : <Face face={p.face} size={28} />)}</span>
              <span className="flex min-w-0 flex-col items-start">
                {first && <span className="mb-1 pl-1 t-meta text-ink-3">{m.from === "force" ? "Force" : p.name}</span>}
                {m.poll ? <Poll m={m} id={id} p={p} /> : <span className="max-w-[290px] whitespace-pre-wrap rounded-[20px] bg-fill px-[14px] py-[9px] t-body text-ink">{m.text}</span>}
              </span>
            </motion.li>
          );
        })}
      </ul>
      <form
        className="shrink-0 px-4 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="flex min-h-[52px] items-center rounded-[26px] bg-paper pl-5 pr-[6px]" style={{ boxShadow: "var(--lift-1)" }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${p.group ? "the group" : p.name}…`} aria-label="Message" enterKeyHint="send" className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3" />
          <button type="submit" aria-label="Send" disabled={!text.trim()} onPointerDown={(e) => e.preventDefault()} className="press grid h-10 w-10 place-items-center rounded-full bg-ink text-paper disabled:opacity-20">
            <I.Up size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}

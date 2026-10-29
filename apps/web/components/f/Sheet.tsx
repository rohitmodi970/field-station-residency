"use client";

// The pattern map: a card that rises over wherever you are. What you said, or what you
// picked, read together. The map itself first (your moments, grouped by what they're about,
// in the paintings), one line that says what it adds up to, the patterns in your own words,
// what your voice did if there was voice, and the next small moves. It ends with the people
// who have this energy.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useTransform } from "motion/react";
import { ART_TONE, USUAL, type Art, type Clip, type Entry, type Moment } from "@/data/mira";
import { PEOPLE, questOfTheme } from "@/data/social";
import { clipsIn, collectiveFor, voiceFor } from "@/lib/f/analyse";
import { f, fmtSecs, useF, type Sheet as SheetT } from "@/lib/f/store";
import { usePlayer } from "@/lib/f/player";
import Goo, { string, type Blob } from "./Goo";
import { Dots } from "./marks";
import { I, Paint, SPRING, haptic } from "./ui";

const recorded = new Set<number>();

export default function SheetHost() {
  const sheet = useF((s) => s.sheet);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (sheet?.key) dialog.current?.focus({ preventScroll: true });
  }, [sheet?.key]);
  const entries = useF((s) => s.entries);
  const y = useMotionValue(0);
  const scrim = useTransform(y, [0, 500], [1, 0]);
  const drag = useDragControls();
  const scoped = sheet ? entries.filter((e) => sheet.scope.entryIds.includes(e.id)) : [];
  return (
    <AnimatePresence>
      {sheet && (
        <motion.div key="host" className="absolute inset-0 z-50">
          <motion.div className="absolute inset-0 bg-[var(--scrim)]" style={{ opacity: scrim }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={f.closeSheet} />
          <motion.section
            key={sheet.key}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            ref={dialog}
            aria-label="Pattern map"
            className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden bg-canvas"
            style={{ top: "calc(var(--sat) + 16px)", borderRadius: "32px 32px 0 0", y, boxShadow: "var(--lift-2)" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", transition: { type: "spring", duration: 0.4, bounce: 0 } }}
            transition={{ type: "spring", duration: 0.5, bounce: 0 }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.9 }}
            onDragEnd={(_, i) => {
              if (i.offset.y > 140 || i.velocity.y > 600) f.closeSheet();
              else animate(y, 0, SPRING.ui);
            }}
          >
            <div className="shrink-0 touch-none" onPointerDown={(e) => drag.start(e)}>
              <div className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-[var(--grey-300)]" />
              <header className="grid grid-cols-[44px_1fr_44px] items-center gap-2 px-4 pb-1 pt-2">
                <span aria-hidden />
                <h2 className="flex items-center justify-center gap-2 truncate text-center t-nav text-ink">
                  <Paint name="pattern-maps" h={18} className="text-ink-2" />
                  Pattern map
                </h2>
                <button type="button" aria-label="Close" onClick={f.closeSheet} className="press hit grid h-11 w-11 place-items-center rounded-full bg-fill text-ink">
                  <I.Close size={18} />
                </button>
              </header>
              <p className="flex min-h-6 items-center gap-2 px-5 pb-3 pt-1">
                {scoped.length > 0 && <Dots es={scoped} size={22} />}
                <span className="min-w-0 flex-1 truncate t-label text-ink-3">{sheet.scope.label}</span>
              </p>
            </div>
            <div className="relative min-h-0 flex-1">
              <PatternView sheet={sheet} />
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (d: string) => `${MON3[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;

// The map: each theme a cluster, each moment a drop in its painting, strung in date order.
function Map({ topics, es }: { topics: { id: string; name: string; art: Art; share: number }[]; es: Entry[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 240;
  const { blobs, labels } = useMemo(() => {
    const n = topics.length;
    const k = H / w;
    const centres = topics.map((t, i) => {
      if (n === 1) return { x: 0.5, y: 0.5 };
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + (n === 2 ? Math.PI / 2 : 0);
      return { x: 0.5 + Math.cos(a) * (n > 3 ? 0.34 : 0.28), y: 0.5 + Math.sin(a) * (n > 3 ? 0.3 : 0.24) };
    });
    const blobs: Blob[] = [];
    const labels: { x: number; y: number; name: string }[] = [];
    topics.forEach((t, i) => {
      const c = centres[i];
      const mine = es.filter((e) => e.themes[0] === t.id || (!topics.some((o) => o.id === e.themes[0]) && e.themes.includes(t.id)));
      if (!mine.length) blobs.push({ x: c.x, y: c.y, r: 0.1 + t.share * 0.12, art: t.art });
      let prev: Blob | null = null;
      mine.forEach((e, j) => {
        const a = j * 2.4 + i;
        const d = j ? 0.09 + Math.sqrt(j) * 0.07 : 0;
        const b: Blob = { x: c.x + Math.cos(a) * d * k, y: c.y + Math.sin(a) * d, r: 0.075 + Math.min(0.03, e.mood > 0 ? e.mood * 0.012 : 0), art: t.art };
        blobs.push(b);
        if (prev) blobs.push(...string(prev, b, t.art, 6, 0.022));
        prev = b;
      });
      labels.push({ x: c.x, y: c.y, name: t.name });
    });
    return { blobs, labels };
  }, [topics, es, w]);
  return (
    <div ref={box} className="relative" style={{ height: H }}>
      <Goo blobs={blobs} w={w} h={H} />
      {labels.map((l) => (
        <span key={l.name} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-fill px-[10px] py-[3px] t-meta font-medium text-ink" style={{ left: `${Math.max(0.18, Math.min(0.82, l.x)) * 100}%`, top: `${l.y * 100}%` }}>
          {l.name}
        </span>
      ))}
    </div>
  );
}

function PatternView({ sheet }: { sheet: SheetT }) {
  const entries = useF((s) => s.entries);
  const read = useMemo(() => collectiveFor(sheet.scope, entries), [sheet.scope, entries]);
  const es = useMemo(() => entries.filter((e) => sheet.scope.entryIds.includes(e.id)), [entries, sheet.scope]);
  const clips = useMemo(() => clipsIn(sheet.scope, entries), [sheet.scope, entries]);
  const voices = useMemo(() => voiceFor(clips), [clips]);
  useEffect(() => {
    if (sheet.trailId || recorded.has(sheet.key)) return;
    recorded.add(sheet.key);
    f.remember({ kind: "pattern", title: read.patterns[0]?.p.name ?? sheet.scope.label, scope: sheet.scope.label, entryIds: sheet.scope.entryIds, text: sheet.scope.text });
  }, [sheet, read]);
  const moves = read.patterns.map((x) => x.p.movement);
  // Opened from a voice note: start at what your voice did.
  const voiceRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (sheet.at === "voice") setTimeout(() => voiceRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 350);
  }, [sheet.at, sheet.key]);

  return (
    <div className="no-scrollbar h-full overflow-y-auto px-4 pb-10">
      {read.topics.length > 0 && (
        <div className="overflow-hidden rounded-[28px] bg-paper" style={{ boxShadow: "var(--lift-1)" }}>
          <Map topics={read.topics} es={es} />
        </div>
      )}

      <p className="mt-6 px-1 t-title text-ink">{read.summary}</p>
      {(read.span || read.trend) && (
        <p className="mt-2 px-1 t-body text-ink-3">
          {read.span && read.span[0] !== read.span[1] ? `${monthYear(read.span[0])} to ${monthYear(read.span[1])}. ` : ""}
          {read.trend ?? ""}
        </p>
      )}

      {read.count === 0 && read.patterns.length === 0 && sheet.scope.text && (
        <blockquote className="mt-6 rounded-[28px] bg-fill p-5 t-body text-ink-2">“{sheet.scope.text.split(/\n+/).slice(0, 3).join(" ")}”</blockquote>
      )}

      {read.patterns.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-3 px-1 t-body text-ink-3">{read.patterns.length > 1 ? "The patterns" : "The pattern"}</h3>
          <div className="flex flex-col gap-2">
            {read.patterns.map(({ p }) => (
              <article key={p.id} className="rounded-[28px] bg-fill p-5">
                <h4 className="t-body font-semibold text-ink">{p.name}</h4>
                <p className="mt-2 t-body text-ink">{p.mirror}</p>
                <p className="mt-2 t-body text-ink-3">{p.meaning}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {voices.length > 0 && (
        <section ref={voiceRef} className="mt-8 scroll-mt-4">
          <h3 className="mb-3 px-1 t-body text-ink-3">In your voice</h3>
          <div className="flex flex-col gap-2">
            {voices.map((v) => (
              <Voice key={v.clip.id} clip={v.clip} line={v.line} />
            ))}
          </div>
        </section>
      )}

      {moves.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-1 px-1 t-body text-ink-3">Next moves</h3>
          <p className="mb-3 px-1 t-label text-ink-3">Swipe right to keep one and Force will nudge you. Swipe left to let it go.</p>
          <ul className="flex flex-col gap-2">
            {moves.map((m) => (
              <MoveRow key={m} text={m} />
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={() => {
          f.closeSheet();
          const q = questOfTheme(read.patterns[0]?.p.themes[0] ?? read.topics[0]?.id ?? "");
          f.push({ name: "energy", focus: PEOPLE.find((p) => q && p.shares === q.id)?.id });
        }}
        className="press pill-ink mt-10 h-[52px] w-full justify-center t-body font-medium"
      >
        Find people with this energy
      </button>
    </div>
  );
}

// ── Voice, inside the map ─────────────────────────────────────────────

const MOMENT: Record<Moment["kind"], string> = { flat: "Went flat", lift: "Lifted", pause: "Long pause", slow: "Slowed down" };

// Your voice as a line, the way it was: the contour of your energy over the clip, the played
// part filled in, the moments where it changed numbered on the line. Tap one to hear it.
function Contour({ clip, active, onMoment }: { clip: Clip; active: number | null; onMoment: (i: number) => void }) {
  const p = usePlayer(clip);
  const W = 320;
  const H = 120;
  const e = clip.energy;
  const yOf = (v: number) => H - 14 - v * (H - 34);
  const pts = e.map((v, i) => [(i / (e.length - 1)) * W, yOf(v)] as const);
  const line = pts.reduce((d, [x, y], i) => {
    if (!i) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const mx = (px + x) / 2;
    return `${d} C${mx},${py} ${mx},${y} ${x},${y}`;
  }, "");
  const at = (t: number) => {
    const u = Math.min(1, t / clip.secs) * (e.length - 1);
    const i = Math.floor(u);
    const v = e[i] + (e[Math.min(e.length - 1, i + 1)] - e[i]) * (u - i);
    return [Math.min(1, t / clip.secs) * W, yOf(v)] as const;
  };
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={`pv-${clip.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={ART_TONE.water.main} stopOpacity={0.5} />
            <stop offset="1" stopColor={ART_TONE.water.main} stopOpacity={0.08} />
          </linearGradient>
          <clipPath id={`pc-${clip.id}`}>
            <rect width={p.progress * W} height={H} />
          </clipPath>
        </defs>
        <motion.path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#pv-${clip.id})`} />
        <path d={`${line} L${W},${H} L0,${H} Z`} fill="var(--paper)" opacity={0.55} clipPath={`url(#pc-${clip.id})`} />
        <motion.path d={line} fill="none" stroke="var(--ink)" strokeWidth={1.4} />
        {clip.moments.map((m, i) => {
          const [x, y] = at(m.t);
          const on = active === i;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={on ? 11 : 9} fill={on ? "var(--ink)" : "var(--paper)"} stroke="var(--ink)" strokeWidth={1.2} />
              <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fill={on ? "var(--paper)" : "var(--ink)"} fontFamily="var(--font-num)">
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      {clip.moments.map((m, i) => {
        const [x, y] = at(m.t);
        return <button key={i} type="button" aria-label={`Moment ${i + 1}: ${MOMENT[m.kind]}`} onClick={() => onMoment(i)} className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }} />;
      })}
    </div>
  );
}


// A next move: swipe right to keep it, left to let it go. The card says what will happen as
// you pull it.
export function MoveRow({ text }: { text: string }) {
  const state = useF((s) => s.moves.find((m) => m.text === text));
  const x = useMotionValue(0);
  const keepA = useTransform(x, [0, 72], [0, 1]);
  const dropA = useTransform(x, [-72, 0], [1, 0]);
  if (state && !state.kept) return null;
  const kept = !!state?.kept;
  return (
    <li className="relative overflow-hidden rounded-[24px]">
      <motion.span className="absolute inset-0 flex items-center gap-2 pl-5 t-body font-medium" style={{ opacity: keepA, color: "var(--sage-7)", background: "var(--sage-1)" }} aria-hidden>
        <I.Check size={18} /> Keep
      </motion.span>
      <motion.span className="absolute inset-0 flex items-center justify-end gap-2 pr-5 t-body font-medium" style={{ opacity: dropA, color: "var(--rose-7)", background: "var(--rose-1)" }} aria-hidden>
        Let go <I.Close size={18} />
      </motion.span>
      <motion.div
        className="relative rounded-[24px] bg-paper p-4"
        style={{ x, boxShadow: "var(--lift-1)", touchAction: "pan-y" }}
        drag={kept ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={(_, i) => {
          if (i.offset.x > 72 || i.velocity.x > 500) {
            haptic("done");
            f.keepMove(text);
          } else if (i.offset.x < -72 || i.velocity.x < -500) {
            haptic("soft");
            f.dropMove(text);
          }
        }}
      >
        <p className="t-body text-ink">{text}</p>
        {kept && (
          <p className="mt-1 flex items-center gap-[6px] t-meta" style={{ color: "var(--sage-7)" }}>
            <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--sage-4)" }} aria-hidden />
            Kept · Force will nudge you
          </p>
        )}
      </motion.div>
    </li>
  );
}

export function Voice({ clip, line }: { clip: Clip; line: string }) {
  const p = usePlayer(clip);
  const [active, setActive] = useState<number | null>(null);
  const moment = (k: number) => {
    setActive(k);
    p.seek(Math.max(0, clip.moments[k].t - 1.5));
  };
  const tones = clip.tones ?? [];
  const paceDelta = clip.pace ? Math.round(((clip.pace - USUAL.pace) / USUAL.pace) * 100) : 0;
  return (
    <article className="rounded-[28px] bg-fill p-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={p.toggle} aria-label={p.playing ? "Pause" : "Play"} className="press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-paper">
          {p.playing ? <I.Pause size={14} /> : <I.Play size={14} />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate t-body text-ink">{clip.name}</p>
          <p className="t-num text-ink-3">
            {fmtSecs(p.t)} / {fmtSecs(clip.secs)}
          </p>
        </div>
      </div>
      <div className="pb-2 pt-5">
        <Contour clip={clip} active={active} onMoment={moment} />
      </div>
      <p className="mt-3 t-body text-ink">{active !== null ? `${MOMENT[clip.moments[active].kind]}: ${clip.moments[active].note}` : line}</p>
      {(tones.length > 0 || clip.pace > 0) && (
        <p className="mt-2 t-body text-ink-3">
          {tones.length > 0 ? `${tones.map((t) => t.name.toLowerCase()).join(", ")}. ` : ""}
          {clip.pace ? `${Math.abs(paceDelta)}% ${paceDelta < 0 ? "slower" : "faster"} than usual.` : ""}
        </p>
      )}
    </article>
  );
}

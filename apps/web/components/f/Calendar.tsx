"use client";

// Picking a date range, the iOS way: a month grid, a dot on days you wrote, tap where it
// starts and where it ends. Swipe or use the chevrons to move between months.

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Entry } from "@/data/mira";
import { iso } from "@/lib/f/store";
import { EASE_OUT, I, SPRING, haptic } from "./ui";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

export default function Calendar({ entries, value, onChange, onClose }: { entries: Entry[]; value: [string, string] | null; onChange: (r: [string, string] | null) => void; onClose: () => void }) {
  const latest = entries.reduce((m, e) => (e.date > m ? e.date : m), iso(new Date()));
  const [month, setMonth] = useState(() => {
    const d = new Date(`${(value?.[1] ?? latest).slice(0, 7)}-01T12:00:00`);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [dir, setDir] = useState(0);
  const [start, setStart] = useState<string | null>(value?.[0] ?? null);
  const [end, setEnd] = useState<string | null>(value?.[1] ?? null);
  const written = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);

  const days = useMemo(() => {
    const first = new Date(month.y, month.m, 1);
    const lead = (first.getDay() + 6) % 7; // weeks start on Monday
    const n = new Date(month.y, month.m + 1, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => iso(new Date(month.y, month.m, i + 1)))] as (string | null)[];
  }, [month]);

  const step = (d: number) => {
    setDir(d);
    setMonth((m) => {
      const x = new Date(m.y, m.m + d, 1);
      return { y: x.getFullYear(), m: x.getMonth() };
    });
  };

  const tap = (d: string) => {
    haptic();
    if (!start || (start && end)) {
      setStart(d);
      setEnd(null);
    } else if (d < start) {
      setEnd(start);
      setStart(d);
    } else setEnd(d);
  };

  const label = start ? `${fmt(start)}${end && end !== start ? ` – ${fmt(end)}` : ""}` : "Pick a start and an end";
  const count = start ? entries.filter((e) => e.date >= start && e.date <= (end ?? start)).length : entries.length;

  return (
    <div className="absolute inset-0 z-30">
      <motion.div className="absolute inset-0 bg-[var(--scrim)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Choose dates"
        className="absolute inset-x-0 bottom-0 rounded-t-[32px] bg-paper px-5 pb-[calc(var(--sab)+16px)] pt-2"
        style={{ boxShadow: "var(--lift-2)" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%", transition: { duration: 0.25, ease: EASE_OUT } }}
        transition={{ type: "spring", duration: 0.45, bounce: 0 }}
      >
        <div className="mx-auto h-[5px] w-9 rounded-full bg-[var(--grey-300)]" />
        <div className="mt-4 flex items-center justify-between">
          <p className="t-nav text-ink">
            {MONTHS[month.m]} {month.y}
          </p>
          <div className="flex gap-1">
            <button type="button" aria-label="Previous month" onClick={() => step(-1)} className="press grid h-10 w-10 place-items-center rounded-full bg-fill text-ink">
              <I.Back size={16} />
            </button>
            <button type="button" aria-label="Next month" onClick={() => step(1)} className="press grid h-10 w-10 place-items-center rounded-full bg-fill text-ink">
              <I.Chevron size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-7 text-center t-meta text-ink-3">
          {WEEK.map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="relative mt-2 h-[264px] overflow-hidden">
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={`${month.y}-${month.m}`}
              custom={dir}
              className="grid grid-cols-7 gap-y-1"
              variants={{ enter: (d: number) => ({ x: d * 40, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: d * -40, opacity: 0 }) }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, i) => (i.offset.x < -50 ? step(1) : i.offset.x > 50 ? step(-1) : undefined)}
            >
              {days.map((d, i) => {
                if (!d) return <span key={`x${i}`} />;
                const isStart = d === start;
                const isEnd = d === end;
                const inRange = start && end && d > start && d < end;
                const edge = isStart || isEnd;
                return (
                  <button key={d} type="button" onClick={() => tap(d)} aria-pressed={edge || !!inRange} aria-label={d} className="relative grid h-10 place-items-center">
                    {inRange && <span className="absolute inset-x-0 inset-y-1 bg-fill" />}
                    {start && end && isStart && end !== start && <span className="absolute inset-y-1 left-1/2 right-0 bg-fill" />}
                    {start && end && isEnd && end !== start && <span className="absolute inset-y-1 left-0 right-1/2 bg-fill" />}
                    <span className={`relative grid h-9 w-9 place-items-center rounded-full font-num text-[13px] transition-colors duration-150 ${edge ? "bg-ink text-paper" : "text-ink"}`}>{+d.slice(8)}</span>
                    {written.has(d) && <span className={`absolute bottom-[3px] h-1 w-1 rounded-full ${edge ? "bg-paper" : "bg-ink-3"}`} />}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="mt-2 text-center t-meta text-ink-3">
          {label}
          {start ? ` · ${count} ${count === 1 ? "entry" : "entries"}` : ""}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              onChange(null);
              onClose();
            }}
            className="press pill h-[52px] flex-1 justify-center t-body font-medium"
          >
            All dates
          </button>
          <motion.button
            layout
            transition={SPRING.ui}
            type="button"
            disabled={!start}
            onClick={() => {
              if (start) onChange([start, end ?? start]);
              onClose();
            }}
            className="press pill-ink h-[52px] flex-1 justify-center t-body font-medium disabled:opacity-30"
          >
            Done
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmt = (d: string) => `${MON3[+d.slice(5, 7) - 1]} ${+d.slice(8)}, ${d.slice(0, 4)}`;
export const fmtRange = (r: [string, string]) => (r[0] === r[1] ? fmt(r[0]) : r[0].slice(0, 4) === r[1].slice(0, 4) ? `${MON3[+r[0].slice(5, 7) - 1]} ${+r[0].slice(8)} – ${fmt(r[1])}` : `${fmt(r[0])} – ${fmt(r[1])}`);

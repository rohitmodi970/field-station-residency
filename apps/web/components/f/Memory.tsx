"use client";

// Memory: everything that's yours, on one page that scrolls.
//   The world first, big: every moment as a drop in its painting, strung to the ones it
//   shares a theme with. Filters sit on top of it. It can go full screen.
//   Under it: what a pattern map would run on right now, and the button. Then your side
//   quests, the pattern maps you've made, and every moment.
// Tap a drop to look at it; Select to pick several (like Photos).

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AREAS, entryClips, themeById, type Entry } from "@/data/mira";
import { MAYBE_QUEST } from "@/data/social";
import { f, fmtShort, useF } from "@/lib/f/store";
import type { Scope } from "@/lib/f/store";
import Calendar, { fmtRange } from "./Calendar";
import Face from "./Face";
import Graph3D from "./Graph3D";
import { Dot, Dots } from "./marks";
import Nav from "./Nav";
import { Row, ago, questEntries, questFace, quiet } from "./Quests";
import { I, Logo, Paint, SPRING, haptic } from "./ui";

type FilterDef = { id: string; label: string; test: (e: Entry) => boolean };

function useFilters(entries: Entry[]): FilterDef[] {
  return useMemo(() => {
    const fs: FilterDef[] = [{ id: "all", label: "All", test: () => true }];
    AREAS.forEach((ar) => {
      const test = (e: Entry) => e.themes.some((t) => (ar.themes as readonly string[]).includes(t));
      if (entries.some(test)) fs.push({ id: `a:${ar.id}`, label: ar.name, test });
    });
    if (entries.some((e) => entryClips(e).length)) fs.push({ id: "voice", label: "Voice notes", test: (e) => entryClips(e).length > 0 });
    return fs;
  }, [entries]);
}

// Filter chips sit on the white world, so off is grey, not white.
function Chip({ on, onClick, children, icon }: { on: boolean; onClick: () => void; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={`press hit flex h-9 shrink-0 items-center gap-[6px] rounded-full px-[14px] t-body font-medium transition-colors duration-150 ${on ? "bg-ink text-paper" : "bg-fill text-ink"}`}>
      {icon}
      {children}
    </button>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span className={`grid h-6 w-6 place-items-center rounded-full transition-colors duration-150 ${on ? "bg-ink text-paper" : "bg-paper"}`} style={on ? undefined : { boxShadow: "inset 0 0 0 1.5px var(--grey-300)" }}>
      {on && <I.Check size={14} />}
    </span>
  );
}

// A section you can fold away, so memory stays short as it grows.
function Section({ id, title, count, open, onToggle, children }: { id: string; title: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="mt-6 px-4">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`sec-${id}`} className="press flex h-11 w-full items-center gap-2 px-1 text-left">
        <span className="t-body font-semibold text-ink">{title}</span>
        <span className="t-body text-ink-3">{count}</span>
        <motion.span className="ml-auto text-ink-4" animate={{ rotate: open ? 90 : 0 }} transition={SPRING.ui}>
          <I.Chevron size={18} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={`sec-${id}`} key="body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={SPRING.ui} className="overflow-hidden">
            <div className="px-0 pb-2 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center px-10 pt-24 text-center">
      <p className="t-title text-ink">Your memory starts with one moment</p>
      <p className="mt-2 t-body text-ink-3">Everything you tell Force lands here and joins the moments it shares a theme with.</p>
      <button type="button" onClick={() => f.home()} className="press pill-ink mt-8 h-[52px] px-6 t-body font-medium">
        Tell Force something
      </button>
    </div>
  );
}

export default function Memory() {
  const entries = useF((s) => s.entries);
  const quests = useF((s) => s.quests);
  const trail = useF((s) => s.trail);
  const mem = useF((s) => s.mem);
  const fresh = useF((s) => s.fresh);
  const sheetOpen = useF((s) => !!s.sheet);
  const filters = useFilters(entries);
  const fl = filters.find((x) => x.id === mem.filter) ?? filters[0];
  const range = mem.range;
  const match = useMemo(() => (e: Entry) => fl.test(e) && (!range || (e.date >= range[0] && e.date <= range[1])), [fl, range]);
  const matching = useMemo(() => entries.filter(match).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), [entries, match]);
  const filtered = mem.filter !== "all" || !!range;
  const [reset, setReset] = useState(0);
  const [picking, setPicking] = useState(false);
  const [full, setFull] = useState(false);
  const focused = entries.find((e) => e.id === mem.focus) ?? null;
  const scroller = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({ quests: true, maps: false, moments: true });
  const toggle = (k: string) => {
    haptic();
    setOpen((o) => ({ ...o, [k]: !o[k] }));
  };
  const hit = (t: string) => !q || t.toLowerCase().includes(q.toLowerCase());
  const foundQuests = quests.filter((x) => hit(x.name) || hit(x.line));
  const foundMaps = trail.filter((t) => hit(t.title) || hit(t.scope));
  const foundMoments = matching.filter((e) => hit(e.title) || e.themes.some((t) => hit(themeById(t)?.name ?? "")));

  // Leaving full screen: back to the top, where the world is.
  useEffect(() => {
    if (!full) scroller.current?.scrollTo({ top: 0 });
  }, [full]);

  const tap = (id: string | null) => {
    if (fresh) f.clearFresh();
    if (mem.selecting) {
      if (!id) return;
      haptic();
      f.mem({ sel: mem.sel.includes(id) ? mem.sel.filter((x) => x !== id) : [...mem.sel, id] });
    } else f.mem({ focus: id && id !== mem.focus ? id : null });
  };

  const filterLabel = [mem.filter !== "all" ? fl.label : null, range ? fmtRange(range) : null].filter(Boolean).join(" · ") || null;

  // What a pattern map runs on right now: what you picked, else what you're looking at,
  // else what the filters show.
  const sel = mem.selecting ? entries.filter((e) => mem.sel.includes(e.id)) : [];
  const es = mem.selecting ? sel : focused ? [focused] : filtered ? matching : entries;
  const onLabel = mem.selecting ? (sel.length === 1 ? sel[0].title : `${sel.length} moments you picked`) : focused ? focused.title : filtered ? `${matching.length} ${matching.length === 1 ? "moment" : "moments"} · ${filterLabel}` : `All ${entries.length} moments`;
  const map = () => {
    haptic();
    if (!es.length) return f.toast(mem.selecting ? "Tap drops to pick some first." : "Nothing matches these filters.");
    const scope: Scope = { label: onLabel, entryIds: es.map((e) => e.id) };
    f.open(scope);
  };

  const selectButton = (
    <button
      type="button"
      onClick={() => {
        haptic();
        f.mem(mem.selecting ? { selecting: false, sel: [] } : { selecting: true, focus: null, sel: [] });
      }}
      className={`press h-11 rounded-full px-[18px] t-body font-medium ${mem.selecting ? "bg-ink text-paper" : "bg-paper text-ink"}`}
      style={mem.selecting ? undefined : { boxShadow: "var(--lift-1)" }}
    >
      {mem.selecting ? "Done" : "Select"}
    </button>
  );

  const chips = (
    <div className="scroll-row" role="radiogroup" aria-label="Filters">
      <Chip on={!!range} onClick={() => setPicking(true)} icon={<I.Calendar size={15} />}>
        {range ? fmtRange(range) : "Dates"}
      </Chip>
      {filters.map((x) => (
        <Chip
          key={x.id}
          on={fl.id === x.id}
          onClick={() => {
            haptic();
            f.mem({ filter: x.id });
          }}
        >
          {x.label}
        </Chip>
      ))}
    </div>
  );

  const dock = (
    <div className="flex items-center gap-3">
      <p className="flex min-w-0 flex-1 items-center gap-2 pl-1 t-body text-ink">
        {mem.selecting && sel.length > 0 && <Dots es={sel} size={22} />}
        <span className="truncate">{mem.selecting && !sel.length ? "Tap drops to pick them" : onLabel}</span>
      </p>
      <button type="button" onClick={map} className="press pill-ink h-11 shrink-0 gap-2 pl-4 pr-[18px] t-body font-medium">
        <Paint name="pattern-maps" h={18} /> Pattern map
      </button>
    </div>
  );

  if (!entries.length)
    return (
      <div className="flex h-full flex-col">
        <Nav title="Memory" />
        <Empty />
      </div>
    );

  return (
    <div className="relative flex h-full flex-col">
      {!full && <Nav title="Memory" right={selectButton} />}
      <div ref={scroller} className={`min-h-0 flex-1 ${full ? "overflow-hidden" : "no-scrollbar overflow-y-auto pb-10 pt-[76px]"}`}>
        {/* Search: moments, side quests and maps, before you scroll for them */}
        {!full && (
          <label className="mx-4 mb-3 flex h-11 items-center gap-2 rounded-full bg-paper pl-4 pr-2" style={{ boxShadow: "var(--lift-1)" }}>
            <I.Search size={18} className="shrink-0 text-ink-3" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your memory" aria-label="Search your memory" className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-ink-3" />
            {q && (
              <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="press grid h-8 w-8 place-items-center rounded-full bg-fill text-ink-2">
                <I.Close size={14} />
              </button>
            )}
          </label>
        )}
        {!full && <div className="mb-3">{chips}</div>}

        {/* The world */}
        <motion.div layout transition={SPRING.surface} className={full ? "absolute inset-0 z-10 bg-canvas" : "relative mx-4 overflow-hidden rounded-[28px] bg-paper"} style={full ? undefined : { height: "clamp(420px, 60vh, 600px)", boxShadow: "var(--lift-1)" }}>
          <Graph3D
            entries={entries}
            marked={mem.selecting ? mem.sel : []}
            focus={mem.selecting ? null : mem.focus}
            match={filtered ? match : null}
            fresh={fresh}
            onTap={tap}
            onHold={(id) => {
              const t = entries.find((x) => x.id === id)?.themes[0];
              if (t) f.mem({ selecting: true, focus: null, sel: entries.filter((x) => x.themes.includes(t)).map((x) => x.id) });
            }}
            resetKey={reset}
            paused={sheetOpen || picking}
            inPage={!full}
          />
          {full && (
            <div className="absolute inset-x-0 top-0 pt-3" style={{ top: "var(--sat)" }}>
              <div className="flex items-center justify-between px-4 pb-2">
                <button type="button" aria-label="Exit full screen" onClick={() => setFull(false)} className="press pill hit h-11 w-11 justify-center p-0">
                  <I.Minimize size={18} />
                </button>
                {selectButton}
              </div>
              {chips}
            </div>
          )}
          <motion.div className="absolute right-3 flex gap-2" animate={{ bottom: full ? 180 : focused && !mem.selecting ? 76 : 12 }} transition={SPRING.ui}>
            <button type="button" aria-label="Recenter the world" onClick={() => setReset((r) => r + 1)} className={`press hit grid h-11 w-11 place-items-center rounded-full text-ink ${full ? "pill" : "bg-fill"}`}>
              <I.Recenter size={18} />
            </button>
            {!full && (
              <button type="button" aria-label="Full screen" onClick={() => setFull(true)} className="press hit grid h-11 w-11 place-items-center rounded-full bg-fill text-ink">
                <I.Expand size={17} />
              </button>
            )}
          </motion.div>
          <AnimatePresence>
            {focused && !mem.selecting && (
              <motion.button
                key={focused.id}
                type="button"
                onClick={() => f.push({ name: "entry", id: focused.id })}
                className="press absolute inset-x-3 flex h-14 items-center gap-3 rounded-full bg-paper pl-2 pr-4 text-left"
                style={{ bottom: full ? "calc(var(--sab) + 84px)" : 12, boxShadow: "var(--lift-2)" }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8, transition: { duration: 0.12 } }}
                transition={SPRING.ui}
              >
                <Dot e={focused} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate t-body text-ink">{focused.title}</span>
                  <span className="block truncate t-label text-ink-3">
                    {fmtShort(focused.date)} · {focused.themes.map((t) => themeById(t)?.name).join(" · ")}
                  </span>
                </span>
                <I.Chevron size={16} className="shrink-0 text-ink-4" />
              </motion.button>
            )}
          </AnimatePresence>
          {full && (
            <div className="absolute inset-x-3 flex flex-col gap-2" style={{ bottom: "calc(var(--sab) + 12px)" }}>
              <div className="rounded-full bg-paper p-1 pl-3" style={{ boxShadow: "var(--lift-2)" }}>
                {dock}
              </div>
            </div>
          )}
        </motion.div>

        {/* What a map runs on, right now */}
        <div className="px-4 pt-4">{dock}</div>
        <AnimatePresence initial={false}>
          {mem.selecting && (
            <motion.div key="picks" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="scroll-row mt-3">
                {filtered && matching.length > 0 && (
                  <button type="button" onClick={() => f.mem({ sel: matching.map((e) => e.id) })} className="press chip hit h-9 shrink-0 rounded-full px-[14px] t-body font-medium">
                    All {matching.length} in {filterLabel}
                  </button>
                )}
                <button type="button" onClick={() => f.mem({ sel: entries.map((e) => e.id) })} className="press chip hit h-9 shrink-0 rounded-full px-[14px] t-body font-medium">
                  Everything
                </button>
                {sel.length > 0 && (
                  <button type="button" onClick={() => f.mem({ sel: [] })} className="press h-9 shrink-0 rounded-full px-[14px] t-body font-medium text-ink-3">
                    Clear
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Side quests */}
        {foundQuests.length > 0 && (
          <Section id="quests" title="Side quests" count={foundQuests.length} open={open.quests || !!q} onToggle={() => toggle("quests")}>
            <ul className="flex flex-col gap-2">
              {[...foundQuests]
                .sort((a, b) => (questEntries(b, entries)[0]?.date ?? "").localeCompare(questEntries(a, entries)[0]?.date ?? ""))
                .map((q) => {
                  const qs = questEntries(q, entries);
                  const last = qs[0]?.date;
                  return (
                    <li key={q.id}>
                      <Row onClick={() => f.push({ name: "quest", id: q.id })} icon={<Face face={questFace(q)} size={44} />} title={q.name} sub={last ? `${quiet(last) ? `Quiet since ${fmtShort(last)}` : `Moved ${ago(last)}`} · ${qs.length} ${qs.length === 1 ? "moment" : "moments"}` : "Just started"} big />
                    </li>
                  );
                })}
            </ul>
            {!q && !quests.some((x) => x.name === MAYBE_QUEST.name) && (
              <div className="mt-3 rounded-[28px] bg-fill p-5">
                <p className="t-label text-ink-3">Force noticed</p>
                <p className="mt-1 t-body font-semibold text-ink">{MAYBE_QUEST.name}?</p>
                <p className="mt-1 t-body text-ink-2">{MAYBE_QUEST.why}</p>
                <button
                  type="button"
                  onClick={() => {
                    haptic("done");
                    f.startQuest({ id: "q-chair", name: MAYBE_QUEST.name, theme: "workshop", art: MAYBE_QUEST.art, line: "Something I made, that I can sit on.", next: "Ask Dev which wood is kindest to a beginner", noticed: MAYBE_QUEST.why });
                    f.toast("New side quest: Build your own chair");
                  }}
                  className="press pill-ink mt-4 h-11 px-5 t-body font-medium"
                >
                  Start this side quest
                </button>
              </div>
            )}
          </Section>
        )}

        {/* Pattern maps you've made */}
        {foundMaps.length > 0 && (
          <Section id="maps" title="Pattern maps" count={foundMaps.length} open={open.maps || !!q} onToggle={() => toggle("maps")}>
            <ul className="flex flex-col gap-2">
              {[...foundMaps]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((t) => (
                  <li key={t.id}>
                    <Row
                      onClick={() => f.open({ label: t.scope, entryIds: t.entryIds, text: t.text }, t.id)}
                      icon={
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-fill text-ink-2">
                          <Paint name="pattern-maps" h={20} />
                        </span>
                      }
                      title={t.title}
                      sub={`${fmtShort(t.date)} · ${t.scope}`}
                      big
                    />
                  </li>
                ))}
            </ul>
          </Section>
        )}

        {/* Every moment */}
        <Section id="moments" title={filtered ? `Moments · ${filterLabel}` : "Moments"} count={foundMoments.length} open={open.moments || !!q} onToggle={() => toggle("moments")}>
          <ul className="px-1">
            {foundMoments.map((e) => {
              const ticked = mem.selecting && mem.sel.includes(e.id);
              return (
                <li key={e.id} className="border-b border-[var(--line)] last:border-0">
                  <button type="button" onClick={() => (mem.selecting ? tap(e.id) : f.push({ name: "entry", id: e.id }))} aria-pressed={ticked} className="press flex h-16 w-full items-center gap-3 text-left">
                    {mem.selecting ? <Check on={ticked} /> : <Dot e={e} size={36} />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate t-body text-ink">{e.title}</span>
                      <span className="flex items-center gap-1 truncate t-label text-ink-3">
                        {e.via === "chat" && (
                          <>
                            <Logo size={11} className="shrink-0 text-ink-3" /> With Force ·{" "}
                          </>
                        )}
                        {e.themes.map((t) => themeById(t)?.name).join(" · ") || "Unsorted"}
                      </span>
                    </span>
                    <span className="t-num shrink-0 text-ink-3">{fmtShort(e.date)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!foundMoments.length && <p className="pt-6 text-center t-body text-ink-3">{q ? `Nothing for “${q}”.` : "Nothing matches these filters."}</p>}
        </Section>
      </div>

      <AnimatePresence>{picking && <Calendar entries={entries} value={range} onChange={(r) => f.mem({ range: r })} onClose={() => setPicking(false)} />}</AnimatePresence>
    </div>
  );
}

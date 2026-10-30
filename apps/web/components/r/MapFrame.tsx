"use client";

// A map in a card that can open to the whole screen: drag to turn, tap a node and its card
// docks underneath (or over the bottom of the map, full screen). The same frame for your own
// map and the residency's graph.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { WNode } from "@/data/residency";
import PatternWorld from "./PatternWorld";
import { I, haptic } from "../f/ui";

export default function MapFrame({ nodes, edges, layout, height, title, card }: { nodes: WNode[]; edges: [string, string][]; layout?: "you" | "cohort"; height: number; title: string; card: (n: WNode, focus: (id: string | null) => void) => React.ReactNode }) {
  const [focus, setFocus] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const n = nodes.find((x) => x.id === focus) ?? null;
  // Full screen, the card sits over the bottom of the map: the map moves up out of its way.
  const dock = useRef<HTMLDivElement>(null);
  const [covered, setCovered] = useState(0);
  useEffect(() => {
    const el = dock.current;
    if (!full || !el) return setCovered(0);
    const ro = new ResizeObserver(() => setCovered(el.offsetHeight ? el.offsetHeight + 12 + 8 : 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, [full]);
  const hint = !n && <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-fill px-3 py-[6px] t-meta text-ink-3">Drag to turn · tap a node</span>;
  return (
    <div>
      <div className="relative overflow-hidden rounded-[28px] bg-paper" style={{ height, boxShadow: "var(--lift-1)" }}>
        {!full && <PatternWorld nodes={nodes} edges={edges} focus={focus} onTap={setFocus} layout={layout} />}
        <button type="button" aria-label="Full screen" onClick={() => (haptic(), setFull(true))} className="press hit absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-fill text-ink">
          <I.Expand size={15} />
        </button>
        {!full && hint}
      </div>
      <AnimatePresence initial={false} mode="popLayout">
        {n && !full && card(n, setFocus)}
      </AnimatePresence>

      <AnimatePresence>
        {full && (
          <motion.div role="dialog" aria-label={title} className="fixed inset-0 z-[90] flex flex-col bg-canvas" style={{ paddingTop: "var(--sat)", paddingBottom: "var(--sab)" }} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.14 } }} transition={{ type: "spring", duration: 0.26, bounce: 0 }}>
            <header className="flex h-14 shrink-0 items-center justify-between px-4">
              <span className="w-11" aria-hidden />
              <h2 className="t-nav text-ink">{title}</h2>
              <button type="button" aria-label="Close full screen" onClick={() => (haptic(), setFull(false))} className="press pill hit grid h-11 w-11 place-items-center p-0">
                <I.Minimize size={18} />
              </button>
            </header>
            <div className="relative min-h-0 flex-1">
              <PatternWorld nodes={nodes} edges={edges} focus={focus} onTap={setFocus} layout={layout} bottom={n ? covered : 0} />
              {hint}
              <div ref={dock} className="absolute inset-x-4 bottom-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {n && card(n, setFocus)}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

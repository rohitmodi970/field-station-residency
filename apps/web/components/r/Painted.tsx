"use client";

// Colour for the analysis, from the paintings: every kind of read has its painting and its
// hue (tint behind, deep for words on the tint), so what Force tells you looks like Force,
// not a form. The five parts keep the same painting as their node on your map.

import { ART_SRC, ART_TONE, type Art } from "@/data/mira";
import type { Field, Noticed } from "@/contract/residency";
import Glass from "../f/Glass";
import { Logo } from "../f/ui";
import { useDragScroll } from "@/lib/r/dragScroll";

// Matched to the chart series and paintings (intent sky, problem amber, open question rose, archetype park, traits meadow, summary dusk).
export const FIELD_ART: Record<Field, Art> = {
  intent: "water",
  problem: "hills",
  approach: "meadow",
  current_frontier: "park",
  contribution: "dusk",
};
export const tone = (art: Art) => ART_TONE[art];

export const PARTS = ["intent", "problem", "approach", "current_frontier"] as const;

// Where to crop each painting so neighbouring cards don't show the same patch.
const CROPS: [Art, number, number][] = [
  ["meadow", 30, 40],
  ["water", 70, 35],
  ["dusk", 25, 65],
  ["hills", 60, 25],
  ["park", 45, 55],
];

// The section mark: Force's glass, with its painting.
export function ForceMark({ size = 28 }: { size?: number }) {
  return (
    <Glass size={size} art="dusk" x={40} y={40} zoom={300}>
      <Logo size={Math.round(size * 0.45)} />
    </Glass>
  );
}

// "What Force noticed": a deck you swipe, one painted card per read, each saying where it
// came from in its own colour.
export function InsightDeck({ items, foot }: { items: Noticed[]; foot?: React.ReactNode }) {
  const row = useDragScroll<HTMLUListElement>();
  return (
    <div>
      <ul ref={row} className="scroll-row no-scrollbar -mx-4 snap-x snap-mandatory px-4 pb-2" aria-label="What Force noticed">
        {items.map((n, i) => {
          const [art, x, y] = CROPS[i % CROPS.length];
          return (
            <li key={i} className="flex w-[80%] max-w-[312px] shrink-0 snap-center flex-col overflow-hidden rounded-[28px] bg-paper" style={{ boxShadow: "var(--lift-1)" }}>
              <div className="relative h-[104px] shrink-0 bg-cover" style={{ backgroundImage: `url(${ART_SRC[art]})`, backgroundPosition: `${x}% ${y}%`, backgroundSize: "220%" }}>
                <span className="absolute right-4 top-4 rounded-full px-2 py-[2px] t-num text-[12px] text-ink backdrop-blur-md" style={{ background: "rgb(255 255 255 / 0.6)" }}>
                  {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
                </span>
                <span className="absolute -bottom-6 left-5">
                  <Glass size={48} art={art} x={x} y={y} zoom={320} />
                </span>
              </div>
              <div className="flex flex-1 flex-col px-5 pb-5 pt-9">
                <p className="t-title text-ink">{n.text}</p>
                <div className="mt-auto flex flex-wrap gap-[6px] pt-4">
                  {n.from.map((f) => (
                    <span key={f} className="rounded-full bg-fill px-[10px] py-[3px] t-meta text-ink-2">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      {foot}
    </div>
  );
}

// A strip of painting along the top of a card.
export function Band({ art, i = 0, h = 56 }: { art?: Art; i?: number; h?: number }) {
  const [a, x, y] = art ? (CROPS.find((c) => c[0] === art) ?? CROPS[0]) : CROPS[i % CROPS.length];
  return <div className="shrink-0 bg-cover" style={{ height: h, backgroundImage: `url(${ART_SRC[a]})`, backgroundPosition: `${x}% ${y}%`, backgroundSize: "260%" }} aria-hidden />;
}

export const cropOf = (i: number) => CROPS[i % CROPS.length];

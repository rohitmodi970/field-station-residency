"use client";

// The small marks shared across screens: an entry's painted drop, and a row of them.

import type { Entry } from "@/data/mira";
import Face, { faceOf } from "./Face";

export function Dot({ e, size = 28 }: { e: Entry; size?: number }) {
  return <Face face={faceOf(e)} size={size} />;
}

// A row of painted dots for a set of entries
export function Dots({ es, size = 20, max = 5 }: { es: Entry[]; size?: number; max?: number }) {
  return (
    <span className="flex shrink-0">
      {es.slice(0, max).map((e, i) => (
        <span key={e.id} className="rounded-full ring-2 ring-paper" style={{ marginLeft: i ? -size * 0.35 : 0 }}>
          <Dot e={e} size={size} />
        </span>
      ))}
    </span>
  );
}

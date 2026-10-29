"use client";

// A glass bubble with an oil painting inside it. Faces, connectors, Force itself: every
// round thing in the residency is one of these. dim: empty glass, waiting for its painting.
// spin: the rim turns while something is connecting.

import { ART_SRC, type Art } from "@/data/mira";

export default function Glass({ size, art, x = 50, y = 50, zoom = 260, img, dim, spin, children, className = "", label }: { size: number; art: Art; x?: number; y?: number; zoom?: number; img?: string; dim?: boolean; spin?: boolean; children?: React.ReactNode; className?: string; label?: string }) {
  return (
    <span className={`glass ${dim ? "g-dim" : ""} ${spin ? "g-spin" : ""} ${className}`} style={{ width: size, height: size, fontSize: size }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <i className="g-img" style={{ backgroundImage: `url(${img ?? ART_SRC[art]})`, backgroundSize: img ? "cover" : `${zoom}%`, backgroundPosition: img ? "center" : `${x}% ${y}%` }} />
      {children && <span className="g-mark">{children}</span>}
      <b className="g-rim" />
      <b className="g-shine" />
    </span>
  );
}

"use client";

// A face: a round crop of an oil pastel painting, until real pictures arrive. Entries use
// the painting of their theme; people use the one they were given.

import { ART_SRC, THEMES, type Entry } from "@/data/mira";
import type { Face as FaceT } from "@/data/social";
import Glass from "./Glass";

// From 28pt up a face is a glass bubble with the painting inside; below that it's too small
// for the glass to read, so it stays a flat crop.
export default function Face({ face, size = 40, className = "", label }: { face: FaceT; size?: number; className?: string; label?: string }) {
  if (size >= 28) return <Glass size={size} art={face.art} x={face.x} y={face.y} img={face.img} zoom={380} className={className} label={label} />;
  return (
    <span
      className={`block shrink-0 rounded-full bg-cover ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${face.img ?? ART_SRC[face.art]})`,
        backgroundPosition: face.img ? "center" : `${face.x}% ${face.y}%`,
        backgroundSize: face.img ? "cover" : "420%",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35), 0 1px 2px rgba(28,27,26,.08)",
      }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

// An entry's drop: its theme's painting, cropped somewhere that's its own.
export function faceOf(e: Entry): FaceT {
  const h = [...e.id].reduce((s, c) => s + c.charCodeAt(0), 0);
  return { art: THEMES.find((t) => t.id === e.themes[0])?.art ?? "water", x: (h * 13) % 100, y: (h * 7) % 100 };
}

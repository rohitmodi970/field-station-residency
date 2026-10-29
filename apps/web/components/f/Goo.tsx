"use client";

// Liquid drops with the oil pastel paintings showing through: the same goo the memory world
// is made of, laid flat. Blobs that share a painting fuse; strings between drops are just
// smaller blobs in a line. Coordinates are 0..1 of the canvas.

import { useEffect, useRef } from "react";
import { ART_SRC, type Art } from "@/data/mira";

export type Blob = { x: number; y: number; r: number; art: Art; a?: number }; // r in units of the height

const CACHE: Partial<Record<Art, HTMLImageElement>> = {};
export function painting(art: Art) {
  if (CACHE[art]) return CACHE[art]!;
  const img = new Image();
  img.src = ART_SRC[art];
  CACHE[art] = img;
  return img;
}

let SOFT: HTMLCanvasElement | null = null;
function soft() {
  if (SOFT) return SOFT;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (let i = 0; i <= 10; i++) gr.addColorStop(i / 10, `rgba(0,0,0,${Math.pow(1 - (i / 10) ** 2, 2).toFixed(3)})`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  SOFT = c;
  return c;
}

// A string of beads from a to b.
export function string(a: Blob, b: Blob, art: Art, n = 9, w = 0.03): Blob[] {
  const out: Blob[] = [];
  for (let i = 1; i < n; i++) {
    const u = i / n;
    out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, r: w * (0.6 + 0.6 * Math.abs(Math.sin(u * 7.3 + 1))), art, a: Math.min(a.a ?? 1, b.a ?? 1) });
  }
  return out;
}

export function drawGoo(ctx: CanvasRenderingContext2D, blobs: Blob[], W: number, H: number, dpr: number) {
  const mask = document.createElement("canvas");
  mask.width = Math.round(W * dpr * 0.75);
  mask.height = Math.round(H * dpr * 0.75);
  const m = mask.getContext("2d", { willReadFrequently: true })!;
  const layer = document.createElement("canvas");
  layer.width = Math.round(W * dpr);
  layer.height = Math.round(H * dpr);
  const l = layer.getContext("2d")!;
  const B = soft();
  const lo = 0.42 * 255 - 12;
  const hi = 0.42 * 255 + 12;
  const MS = 0.75 * dpr;
  // Faded blobs are drawn in their own pass so they never fuse with the bright ones.
  const passes = new Map<string, { art: Art; a: number }>();
  blobs.forEach((b) => passes.set(`${b.art}:${b.a ?? 1}`, { art: b.art, a: b.a ?? 1 }));
  for (const { art, a } of passes.values()) {
    m.globalCompositeOperation = "source-over";
    m.clearRect(0, 0, mask.width, mask.height);
    m.globalCompositeOperation = "lighter";
    for (const b of blobs) {
      if (b.art !== art || (b.a ?? 1) !== a) continue;
      const R = b.r * H * 1.7 * MS;
      m.drawImage(B, b.x * W * MS - R, b.y * H * MS - R, R * 2, R * 2);
    }
    const img = m.getImageData(0, 0, mask.width, mask.height);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] <= lo ? 0 : d[i] >= hi ? 255 : ((d[i] - lo) / (hi - lo)) * 255;
    m.putImageData(img, 0, 0);
    l.setTransform(dpr, 0, 0, dpr, 0, 0);
    l.globalCompositeOperation = "source-over";
    l.clearRect(0, 0, W, H);
    const pi = painting(art);
    if (pi.complete && pi.naturalWidth) {
      const sc = Math.max(W / pi.naturalWidth, H / pi.naturalHeight) * 1.08;
      l.drawImage(pi, (W - pi.naturalWidth * sc) / 2, (H - pi.naturalHeight * sc) / 2, pi.naturalWidth * sc, pi.naturalHeight * sc);
      l.fillStyle = "rgba(255,255,255,.1)";
      l.fillRect(0, 0, W, H);
    } else {
      l.fillStyle = "#d9dde2";
      l.fillRect(0, 0, W, H);
    }
    l.globalCompositeOperation = "destination-in";
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.drawImage(mask, 0, 0, layer.width, layer.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = a;
    ctx.drawImage(layer, 0, 0);
    ctx.globalAlpha = 1;
  }
}

export default function Goo({ blobs, w, h, className = "", label }: { blobs: Blob[]; w: number; h: number; className?: string; label?: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(blobs);
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext("2d")!;
    const paint = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      drawGoo(ctx, blobs, w, h, dpr);
    };
    paint();
    // Paintings still loading: paint again once they're in.
    const pending = Array.from(new Set(blobs.map((b) => b.art))).map(painting).filter((p) => !p.complete);
    pending.forEach((p) => p.addEventListener("load", paint, { once: true }));
    return () => pending.forEach((p) => p.removeEventListener("load", paint));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key stands in for blobs
  }, [key, w, h]);
  return <canvas ref={cv} className={`block shrink-0 ${className}`} style={{ width: w, height: h }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

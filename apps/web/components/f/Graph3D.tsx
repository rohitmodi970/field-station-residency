"use client";

// Mira's world in 3D. Every entry is a painted drop on a sphere; entries that share a thread
// are strung together in the order they were written, so each thread is a string of beads you
// can follow round the sphere. Dates are drawn at the size of their depth: near ones are big,
// far ones small. Drag to turn it, pinch (or scroll) to zoom, tap a drop to select it, hold
// one to select its whole thread, double-tap empty space to settle it back.
//
// Drawn on a canvas: a few hundred painted sprites a frame stays smooth on a phone where an
// SVG filter wouldn't.

import { useEffect, useRef } from "react";
import { ART_SRC, ART_TONE, THEMES, entryText, type Art, type Entry } from "@/data/mira";
import { painting } from "./Goo";
import { fmtLong } from "@/lib/f/store";
import { haptic } from "./ui";

type V3 = [number, number, number];
const norm = (v: V3): V3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const sph = (lon: number, lat: number): V3 => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
};

// Where each thread gathers on the sphere.
const CENTRE: Record<string, V3> = {
  ambition: sph(0.1, 0.35),
  workshop: sph(1.35, -0.15),
  aai: sph(-1.4, 0.1),
  running: sph(-2.6, -0.45),
  nights: sph(-0.5, 1.05),
};
export interface GNode {
  id: string;
  e: Entry;
  p: V3;
  r: number;
  order: number;
  theme: string;
}
export interface GEdge {
  a: GNode;
  b: GNode;
  theme: string;
}

export function layout3D(entries: Entry[]) {
  const sorted = [...entries].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const count: Record<string, number> = {};
  const nodes: GNode[] = sorted.map((e, order) => {
    const ts = e.themes.filter((t) => CENTRE[t]);
    let dir: V3 = ts.length ? norm(ts.reduce<V3>((s, t) => [s[0] + CENTRE[t][0], s[1] + CENTRE[t][1], s[2] + CENTRE[t][2]], [0, 0, 0])) : sph(hash(e.id) * 6.28, hash(e.id + "y") - 0.5);
    // Spread a thread's entries round its centre, like seeds in a head.
    const k = (count[ts[0] ?? "x"] = (count[ts[0] ?? "x"] ?? 0) + 1);
    const a = k * 2.39996 + hash(e.id) * 0.6;
    const d = 0.32 + Math.sqrt(k) * 0.26;
    const up: V3 = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const t1 = norm([up[1] * dir[2] - up[2] * dir[1], up[2] * dir[0] - up[0] * dir[2], up[0] * dir[1] - up[1] * dir[0]]);
    const t2: V3 = [dir[1] * t1[2] - dir[2] * t1[1], dir[2] * t1[0] - dir[0] * t1[2], dir[0] * t1[1] - dir[1] * t1[0]];
    if (ts.length < 2) dir = norm([dir[0] + (t1[0] * Math.cos(a) + t2[0] * Math.sin(a)) * d, dir[1] + (t1[1] * Math.cos(a) + t2[1] * Math.sin(a)) * d, dir[2] + (t1[2] * Math.cos(a) + t2[2] * Math.sin(a)) * d]);
    const rad = 0.86 + hash(e.id + "r") * 0.16;
    const words = entryText(e).split(/\s+/).length;
    return { id: e.id, e, p: [dir[0] * rad, dir[1] * rad, dir[2] * rad], r: (ts.length > 1 ? 11 : 7.5) + Math.min(1.5, words / 60), order, theme: ts[0] ?? "ambition" };
  });
  const edges: GEdge[] = [];
  THEMES.forEach((t) => {
    const chain = nodes.filter((n) => n.e.themes.includes(t.id));
    for (let i = 1; i < chain.length; i++) edges.push({ a: chain[i - 1], b: chain[i], theme: t.id });
  });
  return { nodes, edges };
}

// Each theme's goo is a window onto its own painting.
const ART_OF = (theme: string): Art => THEMES.find((t) => t.id === theme)?.art ?? "water";
let BLOB: HTMLCanvasElement | null = null;
function blob() {
  if (BLOB) return BLOB;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  // Alpha falls off smoothly; overlapping blobs add up and fuse once they cross the threshold.
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    gr.addColorStop(t, `rgba(0,0,0,${Math.pow(1 - t * t, 2).toFixed(3)})`);
  }
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  BLOB = c;
  return c;
}
// A blob drawn with radius R reads as a drop of radius ≈ R / SPREAD after the threshold.
const SPREAD = 1.7;
const THRESH = 0.42;

let grownOnce = false;

export interface GraphProps {
  entries: Entry[];
  marked: string[]; // ticked in Select mode
  paused?: boolean; // covered by a sheet: stop drawing
  focus: string | null; // the one entry you're looking at
  match: ((e: Entry) => boolean) | null;
  fresh: string | null;
  onTap: (id: string | null) => void;
  onHold: (id: string) => void;
  resetKey?: number;
  inPage?: boolean; // sitting in a scrolling page: vertical swipes scroll, sideways ones turn
}

export default function Graph3D({ entries, marked, focus, match, fresh, onTap, onHold, resetKey = 0, paused = false, inPage = false }: GraphProps) {
  const cv = useRef<HTMLCanvasElement>(null);
  const props = useRef({ marked, focus, match, fresh, onTap, onHold, paused });
  useEffect(() => {
    props.current = { marked, focus, match, fresh, onTap, onHold, paused };
  });
  const cam = useRef({ yaw: -0.25, pitch: 0.18, zoom: 1, vy: 0, vp: 0, goal: null as null | { yaw: number; pitch: number; zoom: number }, idleAt: 0 });

  useEffect(() => {
    if (resetKey) cam.current.goal = { yaw: -0.25, pitch: 0.18, zoom: 1 };
  }, [resetKey]);

  // Turn the world so the entry you tapped faces you.
  useEffect(() => {
    if (!focus) return;
    const n = layout3D(entries).nodes.find((x) => x.id === focus);
    if (!n) return;
    const C = cam.current;
    const [x, y, z] = n.p;
    let yaw = Math.atan2(-x, z);
    const z1 = Math.hypot(x, z);
    const pitch = Math.max(-1.1, Math.min(1.1, Math.atan2(y, z1)));
    // Shortest way round
    while (yaw - C.yaw > Math.PI) yaw -= Math.PI * 2;
    while (yaw - C.yaw < -Math.PI) yaw += Math.PI * 2;
    C.vy = 0;
    C.vp = 0;
    C.goal = { yaw, pitch, zoom: Math.max(C.zoom, 1.1) };
  }, [focus, entries]);

  useEffect(() => {
    const canvas = cv.current!;
    const ctx = canvas.getContext("2d")!;
    (Object.keys(ART_SRC) as Art[]).forEach(painting);
    const { nodes, edges } = layout3D(entries);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-syne-mono").trim() || "monospace";
    // The world grows from a drop once per visit to the app; after that it's simply there.
    const born = grownOnce ? performance.now() - 10_000 : performance.now();
    grownOnce = true;
    let W = 0;
    let H = 0;
    let dpr = 1;
    let raf = 0;
    let alive = true;
    const C = cam.current;
    C.idleAt = performance.now();
    const proj: { n: GNode; x: number; y: number; r: number }[] = [];

    const size = () => {
      // Layout size, not the on-screen box: the panel may still be growing out of the pill.
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);

    const layer = document.createElement("canvas");
    const lctx = layer.getContext("2d")!;
    const mask = document.createElement("canvas");
    const mctx = mask.getContext("2d", { willReadFrequently: true })!;

    const D = 3.2;
    const project = (p: V3, k: number) => {
      const cy = Math.cos(C.yaw);
      const sy = Math.sin(C.yaw);
      const cp = Math.cos(C.pitch);
      const sp = Math.sin(C.pitch);
      const x1 = p[0] * cy + p[2] * sy;
      const z1 = -p[0] * sy + p[2] * cy;
      const y2 = p[1] * cp - z1 * sp;
      const z2 = p[1] * sp + z1 * cp;
      const s = (Math.min(W * 0.95, H * 1.05) * 0.46 * C.zoom * D) / (D - z2 * k);
      return { x: W / 2 + x1 * k * s, y: H / 2 - y2 * k * s, z: z2 * k, s: s / (Math.min(W * 0.95, H * 1.05) * 0.46 * C.zoom) };
    };

    const draw = (now: number) => {
      if (!alive) return;
      if (props.current.paused) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const t = (now - born) / 1000;
      // Camera: a glide back home, then inertia, then a slow idle turn.
      if (C.goal) {
        C.yaw += (C.goal.yaw - C.yaw) * 0.12;
        C.pitch += (C.goal.pitch - C.pitch) * 0.12;
        C.zoom += (C.goal.zoom - C.zoom) * 0.12;
        if (Math.abs(C.goal.yaw - C.yaw) + Math.abs(C.goal.zoom - C.zoom) < 0.002) C.goal = null;
      } else {
        C.yaw += C.vy;
        C.pitch = Math.max(-1.2, Math.min(1.2, C.pitch + C.vp));
        C.vy *= 0.94;
        C.vp *= 0.94;
        if (!reduce && !drag && now - C.idleAt > 2500 && !props.current.marked.length && !props.current.focus) C.vy += (0.0014 - C.vy) * 0.03;
      }

      const { marked, focus: foc, match } = props.current;
      const N = nodes.length;
      // Growth: the oldest drop first, each flying out from the centre as the world forms.
      const grow = (n: GNode) => {
        if (reduce) return 1;
        const start = 0.15 + (n.order / Math.max(1, N)) * 1.3;
        const x = Math.max(0, Math.min(1, (t - start) / 0.7));
        return 1 - Math.pow(1 - x, 3);
      };
      const zk = C.zoom ** 0.6;

      // 1. Everything that's liquid, as blobs: [x, y, r, on]
      // What you've picked stays in full colour; everything else fades back, so the noise drops away.
      const hl = new Set<string>([...marked, ...(foc ? [foc] : [])]);
      const lit = (id: string) => !hl.size || hl.has(id);
      const blobs: [number, number, number, boolean, Art[], boolean][] = [];
      const P = new Map<string, ReturnType<typeof project> & { g: number }>();
      nodes.forEach((n) => {
        const g = grow(n);
        P.set(n.id, { ...project(n.p, 0.2 + 0.8 * g), g });
      });
      edges.forEach((ed, ei) => {
        const a = P.get(ed.a.id)!;
        const b = P.get(ed.b.id)!;
        const g = Math.min(a.g, b.g);
        if (g <= 0.02) return;
        const on = !match || (match(ed.a.e) && match(ed.b.e));
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.max(6, Math.round(len / 2.2));
        for (let i = 1; i < steps; i++) {
          const u = i / steps;
          if (u > g) break;
          const q = project([ed.a.p[0] + (ed.b.p[0] - ed.a.p[0]) * u, ed.a.p[1] + (ed.b.p[1] - ed.a.p[1]) * u, ed.a.p[2] + (ed.b.p[2] - ed.a.p[2]) * u], 0.2 + 0.8 * g);
          // A twisted string: the thickness swells and pinches along its length.
          const wave = 0.5 + 0.65 * Math.abs(Math.sin(u * len * 0.3 + ei * 1.7));
          blobs.push([q.x, q.y, 1.35 * q.s * zk * wave, on, [ART_OF(ed.theme)], (lit(ed.a.id) && lit(ed.b.id)) || (!!foc && (ed.a.id === foc || ed.b.id === foc))]);
        }
      });
      proj.length = 0;
      const labels: { z: number; x: number; y: number; fs: number; a: number; text: string; picked: boolean; dim: boolean }[] = [];
      nodes.forEach((n) => {
        const q = P.get(n.id)!;
        if (q.g <= 0.01) return;
        const on = !match || match(n.e);
        const picked = hl.has(n.id);
        const depth = (q.z + 1) / 2;
        const r = n.r * q.s * zk * (0.3 + 0.7 * q.g);
        // A drop that belongs to two themes sits in both hues, so strands from either fuse into it.
        blobs.push([q.x, q.y, r, on, Array.from(new Set(n.e.themes.map(ART_OF))), lit(n.id)]);
        proj.push({ n, x: q.x, y: q.y, r: Math.max(r, 14) });
                const fs = (5 + 5.5 * depth * depth) * Math.min(1.4, C.zoom ** 0.4);
        // Only the near half of the world carries dates (and anything you've picked), so
        // depth reads at a glance and the far side stays quiet.
        labels.push({ z: q.z, x: q.x + r + 4, y: q.y - r * 0.4, fs, a: (picked ? 1 : on ? 0.45 + 0.5 * depth : 0.12) * Math.min(1, q.g * 1.5), text: fmtLong(n.e.date), picked, dim: !lit(n.id) });
      });

      // 2. Goo, one hue at a time: that theme's blobs summed into a mask, thresholded so
      // they fuse like liquid, and its hue shown only through them. The mask runs at half
      // resolution (a quarter of the pixels); the soft edge that gives is part of the look.
      const MS = 0.75;
      const mw = Math.max(1, Math.round(W * MS));
      const mh = Math.max(1, Math.round(H * MS));
      if (mask.width !== mw || mask.height !== mh) {
        mask.width = mw;
        mask.height = mh;
      }
      if (layer.width !== canvas.width || layer.height !== canvas.height) {
        layer.width = canvas.width;
        layer.height = canvas.height;
      }
      // Not laid out yet (or hidden): nothing to draw into.
      if (!canvas.width || !canvas.height) {
        raf = requestAnimationFrame(draw);
        return;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      const B = blob();
      const lo = THRESH * 255 - 14;
      const hi = THRESH * 255 + 14;
      const arts = new Set<Art>();
      blobs.forEach((b) => b[3] && b[4].forEach((a) => arts.add(a)));
      const passes: { art: Art; bright: boolean }[] = [];
      for (const art of arts) {
        if (hl.size) passes.push({ art, bright: false });
        passes.push({ art, bright: true });
      }
      for (const { art, bright } of passes) {
        mctx.globalCompositeOperation = "source-over";
        mctx.clearRect(0, 0, mw, mh);
        mctx.globalCompositeOperation = "lighter";
        for (const [x, y, r, on, as, l] of blobs) {
          if (!on || !as.includes(art) || (hl.size > 0 && l !== bright)) continue;
          const R = r * SPREAD * MS;
          mctx.drawImage(B, x * MS - R, y * MS - R, R * 2, R * 2);
        }
        const img = mctx.getImageData(0, 0, mw, mh);
        const d = img.data;
        for (let i = 3; i < d.length; i += 4) {
          const a = d[i];
          d[i] = a <= lo ? 0 : a >= hi ? 255 : ((a - lo) / (hi - lo)) * 255;
        }
        mctx.putImageData(img, 0, 0);

        lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        lctx.globalCompositeOperation = "source-over";
        lctx.clearRect(0, 0, W, H);
        const pi = painting(art);
        if (pi.complete && pi.naturalWidth) {
          const sc = Math.max(W / pi.naturalWidth, H / pi.naturalHeight) * 1.1;
          const pw = pi.naturalWidth * sc;
          const ph = pi.naturalHeight * sc;
          lctx.drawImage(pi, (W - pw) / 2, (H - ph) / 2, pw, ph);
          lctx.fillStyle = "rgba(255,255,255,.08)";
          lctx.fillRect(0, 0, W, H);
        } else {
          lctx.fillStyle = ART_TONE[art].main;
          lctx.fillRect(0, 0, W, H);
        }
        lctx.globalCompositeOperation = "destination-in";
        lctx.drawImage(mask, 0, 0, W, H);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = bright ? 1 : 0.16;
        ctx.drawImage(layer, 0, 0);
        ctx.globalAlpha = 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      // Filtered-out entries stay as faint, still drops so you keep your bearings.
      if (match) {
        ctx.fillStyle = "rgba(26,26,26,.06)";
        for (const [x, y, r, on] of blobs) {
          if (on) continue;
          ctx.beginPath();
          ctx.arc(x, y, r * 0.8, 0, 7);
          ctx.fill();
        }
      }

      // 5. Dates: grey mono, sized by depth, nearest placed first so none overlap.
      const placed: [number, number, number, number][] = [];
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      labels
        .sort((a, b) => Number(b.picked) - Number(a.picked) || b.z - a.z)
        .forEach((l) => {
          ctx.font = `${l.fs.toFixed(1)}px ${mono}`;
          const w = ctx.measureText(l.text).width;
          // Beside the drop, like a caption; flipped to the left near the right edge.
          if (l.x + w > W - 4) l.x = Math.max(4, l.x - w - 30);
          const box: [number, number, number, number] = [l.x - 2, l.y - l.fs, l.x + w + 2, l.y + 2];
          if (placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) return;
          placed.push(box);
          ctx.globalAlpha = l.dim ? 0.12 : l.a;
          ctx.fillStyle = l.picked ? "#1a1a1a" : "#8c8c8c";
          ctx.fillText(l.text, l.x, l.y);
        });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };

    // ── Gestures ──
    const pts = new Map<number, { x: number; y: number }>();
    let drag = false;
    let start: { x: number; y: number; t: number; moved: boolean } | null = null;
    let pinch: { d: number; z: number } | null = null;
    let hold: ReturnType<typeof setTimeout> | undefined;
    let lastTap = 0;
    let last = { x: 0, y: 0, t: 0 };

    const hit = (x: number, y: number) => {
      let best: GNode | null = null;
      let bd = Infinity;
      for (const p of proj) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < p.r + 6 && d < bd) {
          bd = d;
          best = p.n;
        }
      }
      return best;
    };
    const local = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      return { x: e.clientX - b.left, y: e.clientY - b.top };
    };

    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const p = local(e);
      pts.set(e.pointerId, p);
      C.goal = null;
      C.idleAt = Infinity;
      if (pts.size === 1) {
        drag = true;
        C.vy = 0;
        C.vp = 0;
        start = { ...p, t: e.timeStamp, moved: false };
        last = { ...p, t: e.timeStamp };
        const n = hit(p.x, p.y);
        clearTimeout(hold);
        if (n)
          hold = setTimeout(() => {
            if (start && !start.moved) {
              haptic("soft");
              props.current.onHold(n.id);
              start = null;
            }
          }, 450);
      } else if (pts.size === 2) {
        clearTimeout(hold);
        start = null;
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: C.zoom };
      }
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const p = local(e);
      pts.set(e.pointerId, p);
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const z = (pinch.z * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d;
        // Soft limits: it resists past them instead of stopping dead.
        C.zoom = z < 0.6 ? 0.6 - (0.6 - z) * 0.3 : z > 2.8 ? 2.8 + (z - 2.8) * 0.3 : z;
        return;
      }
      if (!drag) return;
      if (start && Math.hypot(p.x - start.x, p.y - start.y) > 10) {
        start.moved = true;
        clearTimeout(hold);
      }
      const dt = Math.max(1, e.timeStamp - last.t);
      const dx = p.x - last.x;
      const dy = p.y - last.y;
      const k = 0.0085 / C.zoom ** 0.5;
      C.yaw += dx * k;
      C.pitch = Math.max(-1.25, Math.min(1.25, C.pitch + dy * k));
      // Keep a per-frame velocity for the release.
      C.vy = ((dx * k) / dt) * 16;
      C.vp = ((dy * k) / dt) * 16;
      last = { ...p, t: e.timeStamp };
    };
    const up = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      clearTimeout(hold);
      if (pinch && pts.size < 2) {
        pinch = null;
        if (C.zoom < 0.6 || C.zoom > 2.8) C.goal = { yaw: C.yaw, pitch: C.pitch, zoom: Math.max(0.6, Math.min(2.8, C.zoom)) };
        drag = false;
        C.idleAt = performance.now();
        return;
      }
      if (e.timeStamp - last.t > 80) {
        C.vy = 0;
        C.vp = 0;
      }
      if (start && !start.moved) {
        const p = local(e);
        const n = hit(p.x, p.y);
        if (n) {
          haptic();
          props.current.onTap(n.id);
        } else if (e.timeStamp - lastTap < 320) {
          C.goal = { yaw: -0.25, pitch: 0.18, zoom: 1 };
        } else props.current.onTap(null);
        lastTap = e.timeStamp;
      }
      start = null;
      drag = false;
      C.idleAt = performance.now();
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      C.zoom = Math.max(0.6, Math.min(2.8, C.zoom * Math.exp(-e.deltaY * 0.0015)));
      C.idleAt = performance.now();
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    const cancel = (e: PointerEvent) => {
      start = null;
      up(e);
    };
    canvas.addEventListener("pointercancel", cancel);
    canvas.addEventListener("wheel", wheel, { passive: false });
    raf = requestAnimationFrame(draw);
    const vis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", vis);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(hold);
      ro.disconnect();
      document.removeEventListener("visibilitychange", vis);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [entries]);

  return <canvas ref={cv} className="block h-full w-full" style={{ touchAction: inPage ? "pan-y" : "none" }} role="img" aria-label={`Your memory as a sphere of ${entries.length} entries. Use the list view to browse them one by one.`} />;
}

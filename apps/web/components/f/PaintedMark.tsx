"use client";

// The mark, painted in front of you in oil pastel. Each shape of the mark is drawn as a hand
// would draw it: the pastel goes along the stroke, pressed hard then lifted, with the grain
// of the paper showing through and a soft bloom of colour around it. The left wing first,
// then the right, the dot, the body. The colours are the dusk painting's.

import { useEffect, useRef } from "react";
import { painting } from "./Goo";
import { haptic } from "./ui";

// The mark's outlines, from the invite (viewBox 4 2 198 150)
const WING_L = "M85.3772 32.024L16.1691 18.3645C10.9033 17.3252 6 21.3553 6 26.7227C6 30.8625 8.97598 34.4031 13.0541 35.1152L72.9119 45.5665C76.784 46.2426 79.6096 49.6043 79.6096 53.535C79.6096 57.649 76.5216 61.1077 72.4339 61.5723L51.7716 63.9202C42.8656 64.9323 39.49 76.1065 46.3462 81.8801C48.8875 84.0202 52.311 84.7903 55.5239 83.9448L86.0883 75.9016C91.2213 74.5508 94.7989 69.9099 94.7989 64.6022V43.4869C94.7989 37.9062 90.8529 33.1043 85.3772 32.024Z";
const WING_R = "M120.579 32.024L189.787 18.3645C195.053 17.3252 199.956 21.3553 199.956 26.7227C199.956 30.8625 196.98 34.4031 192.902 35.1152L133.044 45.5665C129.172 46.2426 126.346 49.6043 126.346 53.535C126.346 57.649 129.434 61.1077 133.522 61.5723L153.915 63.8896C162.691 64.8869 165.865 76.0069 158.939 81.4872C156.537 83.3876 153.391 84.069 150.418 83.3327L120.032 75.8074C114.819 74.5162 111.157 69.837 111.157 64.466V43.4869C111.157 37.9062 115.104 33.1043 120.579 32.024Z";
const DOT = "M102.979 5.8418H105.315C107.897 5.84184 109.989 7.9345 109.989 10.5156C109.989 13.0968 107.897 15.1894 105.315 15.1895H102.979C100.397 15.1894 98.3047 13.0968 98.3047 10.5156C98.3047 7.93448 100.397 5.84181 102.979 5.8418Z";
const BODY = "M111.157 143.714V66.5989C111.157 63.3724 113.773 60.7568 116.999 60.7568C120.226 60.7568 122.841 63.3724 122.841 66.5989V143.714C122.841 146.94 120.226 149.556 116.999 149.556C113.773 149.556 111.157 146.94 111.157 143.714Z";
const VB = { x: 4, y: 2, w: 198, h: 150 };

// How a hand draws each shape: a centreline the pastel follows, its width, and when it
// starts. A wing is one stroke: along the top bar from the tip, round the bend, back along
// the lower bar, then the hook.
type Stroke = { pts: [number, number][]; w: number; t0: number; dur: number };
const LEFT: [number, number][] = [
  [12, 26],
  [40, 32],
  [68, 38],
  [86, 44],
  [89, 52],
  [84, 59],
  [66, 62],
  [50, 65],
  [43, 72],
  [47, 80],
  [60, 81],
  [80, 76],
  [90, 70],
];
const RIGHT: [number, number][] = LEFT.map(([x, y]) => [VB.x * 2 + VB.w - x, y] as [number, number]);
const BODYLINE: [number, number][] = [
  [117, 64],
  [117, 85],
  [117, 108],
  [117, 130],
  [117, 146],
];
const DOTLINE: [number, number][] = [
  [100, 10.5],
  [108, 10.5],
];
const STROKES: Stroke[] = [
  { pts: LEFT, w: 15, t0: 0.04, dur: 0.6 },
  { pts: RIGHT, w: 15, t0: 0.52, dur: 0.6 },
  { pts: DOTLINE, w: 11, t0: 1.08, dur: 0.1 },
  { pts: BODYLINE, w: 12, t0: 1.19, dur: 0.42 },
];
const END = 1.65;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

// Catmull-Rom through the points, so the pastel moves in curves, not corners.
function along(pts: [number, number][], u: number): [number, number] {
  const n = pts.length - 1;
  const f = Math.max(0, Math.min(n - 1e-6, u * n));
  const i = Math.floor(f);
  const t = f - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[Math.min(n, i + 1)];
  const p3 = pts[Math.min(n, i + 2)];
  const c = (a: number, b: number, cc: number, d: number) => 0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t * t + (-a + 3 * b - 3 * cc + d) * t * t * t);
  return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])];
}

export default function PaintedMark({ size = 240, onDone }: { size?: number; onDone?: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = size;
    const H = Math.round((size * VB.h) / VB.w);
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    const ctx = c.getContext("2d")!;
    const k = (W / VB.w) * dpr;
    const T = (g: CanvasRenderingContext2D) => g.setTransform(k, 0, 0, k, -VB.x * k, -VB.y * k);

    const all = new Path2D();
    [WING_L, WING_R, DOT, BODY].forEach((d) => all.addPath(new Path2D(d)));

    // The pastel is laid on a layer of its own, then shown through the shapes, so the stroke
    // can be rough and generous and the mark still comes out exact.
    const layer = document.createElement("canvas");
    layer.width = c.width;
    layer.height = c.height;
    const L = layer.getContext("2d")!;
    T(L);
    // Paper grain: fine noise the pastel skips over, like tooth on paper
    const grain = document.createElement("canvas");
    grain.width = grain.height = 64;
    const G = grain.getContext("2d")!;
    const gr = rng(11);
    const gi = G.createImageData(64, 64);
    for (let i = 0; i < gi.data.length; i += 4) {
      const v = gr();
      gi.data[i] = gi.data[i + 1] = gi.data[i + 2] = 255;
      gi.data[i + 3] = v < 0.42 ? 0 : v < 0.7 ? 120 : 255;
    }
    G.putImageData(gi, 0, 0);
    const grainPat = L.createPattern(grain, "repeat")!;
    grainPat.setTransform(new DOMMatrix().scale(1 / k));

    const img = painting("dusk");
    const r = rng(5);
    const laid = STROKES.map(() => 0); // how far along each stroke has been laid
    let raf = 0;
    const born = performance.now();
    let told = false;

    const frame = (now: number) => {
      const t = (now - born) / 1000;
      const ready = img.complete && img.naturalWidth > 0;
      // Lay down what's new since the last frame, as short pastel dabs along the stroke
      STROKES.forEach((s, si) => {
        const p = Math.max(0, Math.min(1, (t - s.t0) / s.dur));
        const eased = 1 - Math.pow(1 - p, 2);
        if (eased <= laid[si]) return;
        const steps = Math.max(1, Math.round((eased - laid[si]) * 90));
        for (let i = 1; i <= steps; i++) {
          const u = laid[si] + ((eased - laid[si]) * i) / steps;
          const [x, y] = along(s.pts, u);
          const [x2, y2] = along(s.pts, Math.min(1, u + 0.02));
          const ang = Math.atan2(y2 - y, x2 - x);
          // Pressure: heavy in the middle of the stroke, lighter at the ends
          const press = 0.6 + 0.4 * Math.sin(Math.PI * u);
          const w = s.w * (0.8 + 0.4 * r()) * press;
          L.save();
          L.translate(x + (r() - 0.5) * 2, y + (r() - 0.5) * 2);
          L.rotate(ang);
          L.globalAlpha = 0.55 + 0.35 * press;
          if (ready) {
            const pat = L.createPattern(img, "repeat")!;
            pat.setTransform(new DOMMatrix().translate(-x * 0.9, -y * 0.9).scale((VB.w * 1.4) / img.naturalWidth));
            L.fillStyle = pat;
          } else L.fillStyle = "#9a89de";
          L.beginPath();
          L.ellipse(0, 0, 3.2, w / 2, 0, 0, Math.PI * 2);
          L.fill();
          // The tooth of the paper, taking some of the colour back off
          L.globalCompositeOperation = "destination-out";
          L.globalAlpha = 0.18 * (1 - press);
          L.fillStyle = grainPat;
          L.fillRect(-4, -w / 2, 8, w);
          L.restore();
        }
        laid[si] = eased;
      });

      // Compose: a faint bloom of the layer outside the shapes, then the layer through the
      // shapes, sharp.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      // The bloom needs canvas blur; older Safari doesn't have it, and a sharp copy would
      // only double the strokes, so there it's simply left out.
      if ("filter" in ctx) {
        ctx.save();
        ctx.filter = `blur(${3 * dpr}px)`;
        ctx.globalAlpha = 0.35;
        ctx.drawImage(layer, 0, 0);
        ctx.restore();
      }
      T(ctx);
      ctx.save();
      ctx.clip(all);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(layer, 0, 0);
      ctx.restore();

      if (t > END && !told) {
        told = true;
        haptic("done");
        done.current?.();
      }
      if (t < END + 0.2) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  const H = Math.round((size * VB.h) / VB.w);
  return <canvas ref={cv} className="block" style={{ width: size, height: H }} role="img" aria-label="Force" />;
}

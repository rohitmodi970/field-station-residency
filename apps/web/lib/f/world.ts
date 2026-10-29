// The pattern map's geometry, with no DOM in it: where each node sits on the sphere, how the
// camera projects it, how near it is. Plain TypeScript, so the React Native app can use it
// as is and only redraw it (Skia instead of a canvas).

import type { NodeKind, WNode } from "@/data/residency";

export type V3 = [number, number, number];

export const norm = (v: V3): V3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
export const sph = (lon: number, lat: number): V3 => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];

// Size in points, distance from the middle, and the order things grow in.
export const RADIUS: Record<NodeKind, number> = { you: 15, intent: 11, theme: 8, person: 9 };
export const DIST: Record<NodeKind, number> = { you: 0, intent: 0.66, theme: 1.02, person: 1.3 };
export const ORDER: Record<NodeKind, number> = { you: 0, intent: 1, theme: 2, person: 3 };
const FAR = 1.3; // the outermost ring, for working out how near something is

export type PNode = WNode & { p: V3 };

// Intents spread round you; each theme near the intent it came from; each person beyond the
// theme they share with you.
export function layout(nodes: WNode[], edges: [string, string][]): PNode[] {
  const parent = (id: string) => edges.find(([, b]) => b === id)?.[0];
  const dir: Record<string, V3> = {};
  const intents = nodes.filter((n) => n.kind === "intent");
  intents.forEach((n, i) => (dir[n.id] = sph(-0.7 + (i / Math.max(1, intents.length - 1)) * 1.8, i % 2 ? 0.35 : -0.25)));
  const kids: Record<string, number> = {};
  for (const kind of ["theme", "person"] as NodeKind[])
    nodes
      .filter((n) => n.kind === kind)
      .forEach((n) => {
        const pa = parent(n.id) ?? "you";
        const base = dir[pa] ?? sph(0, 0);
        const k = (kids[pa] = (kids[pa] ?? 0) + 1);
        const a = k * 2.2 + (kind === "person" ? 0.6 : 0);
        const up: V3 = Math.abs(base[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
        const t1 = norm([up[1] * base[2] - up[2] * base[1], up[2] * base[0] - up[0] * base[2], up[0] * base[1] - up[1] * base[0]]);
        const t2: V3 = [base[1] * t1[2] - base[2] * t1[1], base[2] * t1[0] - base[0] * t1[2], base[0] * t1[1] - base[1] * t1[0]];
        const d = kind === "theme" ? 0.55 : 0.3;
        dir[n.id] = norm([base[0] + (t1[0] * Math.cos(a) + t2[0] * Math.sin(a)) * d, base[1] + (t1[1] * Math.cos(a) + t2[1] * Math.sin(a)) * d, base[2] + (t1[2] * Math.cos(a) + t2[2] * Math.sin(a)) * d]);
      });
  return nodes.map((n) => {
    const d = dir[n.id] ?? [0, 0, 1];
    const r = DIST[n.kind];
    return { ...n, p: n.kind === "you" ? [0, 0, 0.05] : [d[0] * r, d[1] * r, d[2] * r] };
  });
}

// The cohort, Obsidian-style: a small force simulation, worked out once. Every node pushes
// the others away; each link pulls its two ends together, a person to their intent hardest,
// an intent to its themes a little less, two connected people least. So a theme two people
// share ends up between them, connected people drift close, and nobody's lines cross the
// whole map. It lies flat, facing you, so a small cohort never hides anyone round the back.
export const ORDER_COHORT: Record<NodeKind, number> = { you: 0, person: 0, intent: 1, theme: 2 };
export const TIER: Record<NodeKind, number> = { you: 1.1, person: 1.1, intent: 0.72, theme: 0.36 };
export function layoutCohort(nodes: WNode[], edges: [string, string][], tiers = false): PNode[] {
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const k = nodes.length;
  // Start on a ring by kind, in a fixed order, so the same cohort always lands the same way.
  const pos = nodes.map((n, i) => {
    const a = (i / Math.max(1, k)) * Math.PI * 2 + (n.kind === "you" ? Math.PI / 2 : 0);
    const r = n.kind === "theme" ? 0.3 : n.kind === "intent" ? 0.7 : 1;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  const rest = (a: WNode, b: WNode) => (a.kind === "theme" || b.kind === "theme" ? 0.42 : a.kind === "intent" || b.kind === "intent" ? 0.24 : 0.55);
  const pull = (a: WNode, b: WNode) => (a.kind === "theme" || b.kind === "theme" ? 0.05 : a.kind === "intent" || b.kind === "intent" ? 0.12 : 0.02);
  const links = edges.map(([a, b]) => [idx.get(a), idx.get(b)]).filter((e): e is [number, number] => e[0] !== undefined && e[1] !== undefined);
  for (let it = 0; it < 360; it++) {
    const heat = 1 - it / 360;
    const f = pos.map(() => [0, 0]);
    for (let i = 0; i < k; i++)
      for (let j = i + 1; j < k; j++) {
        const dx = pos[i][0] - pos[j][0];
        const dy = pos[i][1] - pos[j][1];
        const d2 = Math.max(0.004, dx * dx + dy * dy);
        const push = 0.012 / d2;
        f[i][0] += dx * push;
        f[i][1] += dy * push;
        f[j][0] -= dx * push;
        f[j][1] -= dy * push;
      }
    for (const [i, j] of links) {
      const dx = pos[j][0] - pos[i][0];
      const dy = pos[j][1] - pos[i][1];
      const d = Math.hypot(dx, dy) || 0.001;
      const s = (d - rest(nodes[i], nodes[j])) * pull(nodes[i], nodes[j]) * 4;
      f[i][0] += (dx / d) * s;
      f[i][1] += (dy / d) * s;
      f[j][0] -= (dx / d) * s;
      f[j][1] -= (dy / d) * s;
    }
    for (let i = 0; i < k; i++) {
      // a gentle pull to the middle keeps loners on the map
      f[i][0] -= pos[i][0] * 0.01;
      f[i][1] -= pos[i][1] * 0.01;
      const m = Math.hypot(f[i][0], f[i][1]);
      const cap = 0.06 * heat + 0.004;
      const sc = m > cap ? cap / m : 1;
      pos[i][0] += f[i][0] * sc;
      pos[i][1] += f[i][1] * sc;
    }
  }
  // Three rings, the founder's three kinds: people outside, what each wants to change inside
  // them, the approaches in the middle where people meet. Each keeps the direction the
  // simulation gave it, so neighbours stay neighbours.
  if (tiers) {
    const cx0 = pos.reduce((a, p) => a + p[0], 0) / Math.max(1, k);
    const cy0 = pos.reduce((a, p) => a + p[1], 0) / Math.max(1, k);
    const simA = pos.map((p) => Math.atan2(p[1] - cy0, p[0] - cx0));
    const ang = new Array<number>(k).fill(0);
    // Even spacing round a ring, in the order the simulation put things.
    const spread = (ids: number[], start: number) =>
      [...ids].sort((x, y) => ang[x] - ang[y]).forEach((i, r) => (ang[i] = start + (r / Math.max(1, ids.length)) * Math.PI * 2));
    const people = nodes.map((n, i) => i).filter((i) => nodes[i].kind === "person" || nodes[i].kind === "you");
    people.forEach((i) => (ang[i] = simA[i]));
    spread(people, -Math.PI / 2);
    nodes.forEach((n, i) => {
      if (n.kind !== "intent") return;
      const pa = edges.find(([, b]) => b === n.id)?.[0];
      ang[i] = ang[idx.get(pa ?? "") ?? i] ?? simA[i];
    });
    const themes = nodes.map((n, i) => i).filter((i) => nodes[i].kind === "theme");
    themes.forEach((i) => {
      const from = edges.filter(([, b]) => b === nodes[i].id).map(([a]) => idx.get(a)).filter((j): j is number => j !== undefined);
      const sx = from.reduce((t, j) => t + Math.cos(ang[j]), 0);
      const sy = from.reduce((t, j) => t + Math.sin(ang[j]), 0);
      ang[i] = from.length ? Math.atan2(sy, sx) : simA[i];
    });
    // Keep each approach facing the people who use it; push neighbours apart only as far as
    // they need. Shared ones sit nearer the middle, one person's own nearer that person.
    const gap = (Math.PI * 2) / Math.max(6, themes.length * 1.6);
    const order = [...themes].sort((x, y) => ang[x] - ang[y]);
    for (let it = 0; it < 80; it++)
      order.forEach((i, r) => {
        const j = order[(r + 1) % order.length];
        if (i === j) return;
        let d = ang[j] - ang[i];
        while (d < 0) d += Math.PI * 2;
        if (d < gap) {
          ang[i] -= (gap - d) / 2;
          ang[j] += (gap - d) / 2;
        }
      });
    const owners = (i: number) => new Set(edges.filter(([, b]) => b === nodes[i].id).map(([a]) => nodes[idx.get(a) ?? 0]?.person)).size;
    return nodes.map((n, i) => {
      const r = n.kind === "theme" ? (owners(i) > 2 ? 0.18 : owners(i) > 1 ? 0.3 : 0.46) : TIER[n.kind];
      return { ...n, p: [Math.cos(ang[i]) * r, Math.sin(ang[i]) * r * 0.92, 0.4] };
    });
  }
  // Fit it to the frame, centred, a touch wider than tall like the phone's map.
  const xs = pos.map((p) => p[0]);
  const ys = pos.map((p) => p[1]);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * 1.1, 0.001);
  return nodes.map((n, i) => ({ ...n, p: [((pos[i][0] - cx) / span) * 2.3, ((pos[i][1] - cy) / span) * 2.3, 0.4] }));
}

export interface Camera {
  yaw: number;
  pitch: number;
  zoom: number;
}

// Where a point lands on a W×H screen. k pulls it toward the middle while it grows in.
// z: how near (positive is toward you); s: how much nearer things are scaled up.
export function project(p: V3, cam: Camera, W: number, H: number, k = 1) {
  const D = 3.2;
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const x1 = p[0] * cy + p[2] * sy;
  const z1 = -p[0] * sy + p[2] * cy;
  const y2 = p[1] * cp - z1 * sp;
  const z2 = p[1] * sp + z1 * cp;
  const base = Math.min(W * 0.9, H * 1.1) * 0.36 * cam.zoom;
  const s = (base * D) / (D - z2 * k);
  return { x: W / 2 + x1 * k * s, y: H / 2 - y2 * k * s, z: z2 * k, s: s / base };
}

// How near, 0 (the far side) to 1 (facing you), and which of three depth bands that is. The
// far side of the world is barely there; turning it brings things forward. This is what
// keeps a world of a hundred nodes readable.
export const nearness = (z: number) => Math.max(0, Math.min(1, (z / FAR + 1) / 2));
export const BAND_ALPHA = [0.16, 0.5, 1] as const;
export const bandOf = (near: number) => (near < 0.4 ? 0 : near < 0.6 ? 1 : 2);

// Grows you first, then what you want, then the themes, then the people. t in seconds.
export const growth = (kind: NodeKind, t: number, order: Record<NodeKind, number> = ORDER) => {
  const x = Math.max(0, Math.min(1, (t - 0.05 - order[kind] * 0.3) / 0.5));
  return 1 - Math.pow(1 - x, 3);
};
export const GROWN_AT = 0.05 + 3 * 0.3 + 0.55;

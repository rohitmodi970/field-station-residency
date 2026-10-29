import type { NodeKind, WNode } from "../data/residency";

export type V3 = [number, number, number];

export const norm = (v: V3): V3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

export const sph = (lon: number, lat: number): V3 => [
  Math.cos(lat) * Math.sin(lon),
  Math.sin(lat),
  Math.cos(lat) * Math.cos(lon),
];

export const RADIUS: Record<NodeKind, number> = { you: 15, intent: 11, theme: 8, person: 9 };
export const DIST: Record<NodeKind, number> = { you: 0, intent: 0.66, theme: 1.02, person: 1.3 };
export const ORDER: Record<NodeKind, number> = { you: 0, intent: 1, theme: 2, person: 3 };
const FAR = 1.3;

export type PNode = WNode & { p: V3 };

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

export interface Camera {
  yaw: number;
  pitch: number;
  zoom: number;
}

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

export const nearness = (z: number) => Math.max(0, Math.min(1, (z / FAR + 1) / 2));
export const BAND_ALPHA = [0.16, 0.5, 1] as const;
export const bandOf = (near: number) => (near < 0.4 ? 0 : near < 0.6 ? 1 : 2);

export const growth = (kind: NodeKind, t: number) => {
  const x = Math.max(0, Math.min(1, (t - 0.1 - ORDER[kind] * 0.55) / 0.8));
  return 1 - Math.pow(1 - x, 3);
};
export const GROWN_AT = 0.1 + 3 * 0.55 + 0.9;

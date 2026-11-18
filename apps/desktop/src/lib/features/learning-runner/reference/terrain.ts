import { BRIDGE, END_S, GAPS, TRAIL_HALF_WIDTH, centreAt, groundHeight, type TrailPoint } from "./course.ts";

/**
 * The shape of the land around the trail, as plain maths. The mesh builder and
 * everything that stands on the ground (trees, rocks, flowers) ask the same
 * function, so nothing floats or sinks.
 */
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Small seeded generator, so the scenery is identical on every load. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (x: number, y: number) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
/** Smooth value noise, 0..1. */
export function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
}

/** How far the trail extends as terrain past the finish, toward the lake. */
export const TERRAIN_FROM = -50;
export const TERRAIN_TO = 990;
export const LAKE_LEVEL = groundHeight(END_S) - 3.4;
export const CHASM_DEPTH = 30;

/** 0 outside the bridge chasm, 1 fully inside it. */
export const chasm = (s: number) => smooth(BRIDGE.from + 1, BRIDGE.from + 6, s) * (1 - smooth(BRIDGE.to - 6, BRIDGE.to - 1, s));

export const weights = (s: number) => {
  const ridge = smooth(285, 325, s) * (1 - smooth(585, 625, s));
  const summit = smooth(585, 625, s);
  return { valley: 1 - smooth(285, 325, s), ridge, summit };
};

/** Ground height at `lat` units to the right (+) or left (−) of the trail centre. */
export function terrainHeight(s: number, lat: number): number {
  const base = groundHeight(s);
  const d = Math.max(0, Math.abs(lat) - TRAIL_HALF_WIDTH);
  const left = lat < 0;
  const n = noise(s * 0.045, lat * 0.06);
  const fine = noise(s * 0.16 + 40, lat * 0.18) - 0.5;
  const w = weights(s);

  const valley = smooth(14, 64, d) * (8 + 10 * n) + smooth(1, 10, d) * fine * 1.3;
  const ridge = left
    ? smooth(1.5, 17, d) * (12 + 9 * n) + fine * 1.6 * smooth(1, 6, d)
    : -smooth(0.5, 30, d) * (20 + 7 * n) + fine * smooth(1, 5, d);
  const summit = left
    ? smooth(5, 58, d) * (19 + 13 * n) + fine * 1.2 * smooth(1, 10, d)
    : -smooth(4, 52, d) * (11 + 4 * n) + fine * 1.4 * smooth(1, 10, d);

  // The trail slab sits on a shallow bed, so the land never pokes through it.
  let y = base + w.valley * valley + w.ridge * ridge + w.summit * summit - 0.32 * (1 - smooth(0, 1.4, d));

  // The chasm under the bridge: open to the right, closed by a cliff (and the waterfall) on the left.
  const c = chasm(s);
  if (c > 0) {
    const floor = base - CHASM_DEPTH + n * 3;
    const open = left ? 1 - smooth(22, 32, d) : 1;
    y = lerp(y, floor, c * open);
  }

  // Beyond the finish the meadow slopes down to the lake.
  if (s > END_S - 6) y = lerp(y, LAKE_LEVEL - 1.2, smooth(END_S - 6, END_S + 16, s) * (1 - smooth(34, 60, d) * (left ? 1 : 0.4)));

  // Streams and crevices that cut across the trail.
  for (const g of GAPS) {
    if (s <= g.s || s >= g.s + g.len || (g.s >= BRIDGE.from && g.s <= BRIDGE.to)) continue;
    y -= w.valley > 0.5 ? 1.5 : 3.6 * (1 - smooth(5, 12, Math.abs(lat)));
  }
  return y;
}

const tp: TrailPoint = { x: 0, z: 0, heading: 0 };
/** World position of a point `lat` units to the right of the trail at `s`. Writes x, y, z into `out`. */
export function place<T extends { x: number; y: number; z: number }>(s: number, lat: number, y: number, out: T): T {
  centreAt(s, tp);
  out.x = tp.x - Math.sin(tp.heading) * lat;
  out.y = y;
  out.z = tp.z + Math.cos(tp.heading) * lat;
  return out;
}
/** Y rotation that points an object's local +Z along the trail at `s`. */
export const facing = (s: number) => Math.PI / 2 - centreAt(s, tp).heading;

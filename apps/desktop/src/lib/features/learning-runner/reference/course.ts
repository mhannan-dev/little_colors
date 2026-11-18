/**
 * The one authored course: "Summit Trail".
 *
 * Everything the simulation and the renderer need to agree on is defined here
 * and nowhere else — the ground height, where the trail is missing, every
 * obstacle. The renderer builds its meshes from these same
 * functions, so what you see is what you collide with.
 *
 * Positions are measured in `s`: distance along the trail centreline.
 */
export const COURSE_VERSION = "summit-trail-4";

export const START_S = 0;
export const FINISH_S = 900;
/** The trail continues a little past the finish so the runner can slow down in the clearing. */
export const END_S = 930;
export const TRAIL_HALF_WIDTH = 2.3;

export type CourseId = 'meadow' | 'night' | 'snow' | 'beach';
export type HazardKind = 'log' | 'rock' | 'thorn' | 'gap' | 'branch';
export interface Hazard { id: number; kind: HazardKind; s: number; len: number; height: number }
export const BRANCH = { bottom: 1, top: 1.5 };
export const HAZARDS: Hazard[] = [
  { id: 0, kind: 'log', s: 24, len: 0.9, height: 0.55 },
  { id: 1, kind: 'branch', s: 48, len: 0.6, height: 1.5 },
  { id: 2, kind: 'gap', s: 140, len: 5, height: 0 },
  { id: 3, kind: 'log', s: 180, len: 0.9, height: 0.55 },
  { id: 4, kind: 'branch', s: 260, len: 0.6, height: 1.5 },
  { id: 5, kind: 'gap', s: 335, len: 4.8, height: 0 },
  { id: 6, kind: 'log', s: 390, len: 0.9, height: 0.55 },
  { id: 7, kind: 'branch', s: 520, len: 0.6, height: 1.5 },
  { id: 8, kind: 'gap', s: 585, len: 5, height: 0 },
  { id: 9, kind: 'log', s: 730, len: 0.9, height: 0.55 },
  { id: 10, kind: 'branch', s: 790, len: 0.6, height: 1.5 },
  { id: 11, kind: 'gap', s: 845, len: 4.8, height: 0 }
];
export const GAPS = HAZARDS.filter(hazard => hazard.kind === 'gap');
export const DISCOVERY_STOPS = [70, 230, 470, 680, 900] as const;

export type SectionId = "valley" | "ridge" | "summit";
export const SECTIONS: { id: SectionId; name: string; from: number; to: number }[] = [
  { id: "valley", name: "Sunny Valley", from: 0, to: 300 },
  { id: "ridge", name: "Rocky Ridge", from: 300, to: 600 },
  { id: "summit", name: "Summit Falls", from: 600, to: FINISH_S },
];
/** 0 at the start of a course, 1 at the finish, rising fastest early on: most of the speed arrives in the first half. */
export const climb = (s: number) => { const p = Math.min(1, Math.max(0, (s - 30) / (FINISH_S - 30))); return 1 - (1 - p) * (1 - p); };
export const sectionAt = (s: number) => SECTIONS.find((x) => s < x.to) ?? SECTIONS[SECTIONS.length - 1];

/** The wooden bridge beside the waterfall. Purely a look — it is flat, like the ground around it. */
export const BRIDGE = { from: 440, to: 502 };

// ---------------------------------------------------------------------------
// Ground height
// ---------------------------------------------------------------------------

/** [s, height]. Eased between points, so slopes stay modest (steepest is about 13%). */
const HEIGHT_POINTS: [number, number][] = [
  [-60, 0], [80, 0], [150, 2.5], [232, 2.5], [300, 6], [344, 6], [420, 13], [438, 14],
  [504, 14], [540, 14], [600, 17], [644, 18], [716, 23], [764, 23], [828, 27], [866, 28], [1000, 28],
];

export function groundHeight(s: number): number {
  const p = HEIGHT_POINTS;
  if (s <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (s <= p[i][0]) {
      const t = (s - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
      return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * (t * t * (3 - 2 * t));
    }
  }
  return p[p.length - 1][1];
}

// ---------------------------------------------------------------------------

const C_FROM = -60;
const C_TO = 1000;
const centre = (() => {
  const n = C_TO - C_FROM + 1;
  const xs = new Float32Array(n), zs = new Float32Array(n), hs = new Float32Array(n);
  let x = C_FROM, z = 0;
  for (let i = 0; i < n; i++) {
    const s = C_FROM + i;
    const ease = Math.min(1, Math.max(0, (s - 20) / 80));
    const heading = (0.36 * Math.sin(s / 85) + 0.19 * Math.sin(s / 37 + 1.3)) * ease * ease * (3 - 2 * ease);
    xs[i] = x; zs[i] = z; hs[i] = heading;
    x += Math.cos(heading); z += Math.sin(heading);
  }
  return { xs, zs, hs };
})();

export interface TrailPoint { x: number; z: number; heading: number }
/** World position and heading of the trail centre at distance `s`. */
export function centreAt(s: number, out: TrailPoint = { x: 0, z: 0, heading: 0 }): TrailPoint {
  const last = C_TO - C_FROM;
  const f = Math.min(last - 0.001, Math.max(0, s - C_FROM));
  const i = Math.floor(f), t = f - i;
  out.x = centre.xs[i] + (centre.xs[i + 1] - centre.xs[i]) * t;
  out.z = centre.zs[i] + (centre.zs[i + 1] - centre.zs[i]) * t;
  out.heading = centre.hs[i] + (centre.hs[i + 1] - centre.hs[i]) * t;
  // Beyond either end the trail simply carries straight on (used only for far scenery).
  const over = s - C_FROM - f;
  if (over !== 0) { out.x += Math.cos(out.heading) * over; out.z += Math.sin(out.heading) * over; }
  return out;
}

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BRANCH, BRIDGE, END_S, FINISH_S, GAPS, HAZARDS, TRAIL_HALF_WIDTH, groundHeight, type CourseId, type Hazard } from "./course.ts";
import { CHASM_DEPTH, LAKE_LEVEL, TERRAIN_FROM, TERRAIN_TO, chasm, facing, noise, place, seeded, smooth, terrainHeight, weights } from "./terrain.ts";

/**
 * Adapted from the user-provided Dosevana partner/runner world.
 * Builds the whole trail once: land, path, bridge, obstacles, scenery.
 * Everything is original low-poly geometry generated here — no downloaded
 * models or textures — and every obstacle is built from the same numbers the
 * simulation collides with.
 */
const MEADOW = {
  skyTop: 0x3fa9e6, skyHorizon: 0xd6f1ef, fog: 0xc4e8ea, fogNear: 70, fogFar: 360,
  hemiSky: 0xf2fbff, hemiGround: 0xb9d6a0, hemi: 1.9, sun: 0xfff1d0, sunPower: 2.0,
  grassA: 0x7cc65a, grassB: 0x62b24d, hill: 0x4c9a6c,
  alpineA: 0x8fcb72, alpineB: 0x74b866,
  rockA: 0x9b968d, rockB: 0x7f8691, rockDark: 0x666d78,
  snow: 0xf3f9fc, sand: 0xdcc991, bed: 0xb3925f,
  pathA: 0xe9cd95, pathB: 0xe1c287, pathEdge: 0xc49f66,
  wood: 0x9a6b43, woodDark: 0x76502f, woodLight: 0xe2c592,
  pine: 0x2f8f5b, pineLight: 0x45a86c, leaf: 0x6fbf55, leafB: 0x86cf63, leafC: 0x5fb04e, trunk: 0x7a5236,
  tuftA: 0x5fae4a, tuftB: 0x8ad061, peak: 0x5d9fb0, peakCap: 0xeef8fb, cloud: 0xffffff, cloudAlpha: 0.93,
  water: 0x49c0d8, star: 0xffcf3a, thorn: 0x2f6f3f, thornTip: 0xe5484d,
  /** 0 pines only, 1 the valley's mix of round trees and pines, 2 palms. */
  trees: 1, flowers: 1, night: 0,
  /** Drifting specks around the runner: 0 none, 1 snowflakes, 2 fireflies. */
  air: 0,
};
export type Theme = typeof MEADOW;

/** The same trail in four seasons. Only the look changes here; the ground and the obstacles do not. */
export const THEMES: Record<CourseId, Theme> = {
  meadow: MEADOW,
  night: {
    ...MEADOW, skyTop: 0x070d2e, skyHorizon: 0x2b3f86, fog: 0x1b2857, fogNear: 55, fogFar: 300,
    hemiSky: 0x93a8ff, hemiGround: 0x1d2b4a, hemi: 1.05, sun: 0xc7d6ff, sunPower: 1.15,
    peak: 0x2b3f78, peakCap: 0x9fb4e8, cloud: 0x4a5c9a, cloudAlpha: 0.55, water: 0x3a6fd0,
    flowers: 0.6, night: 1, air: 2,
  },
  snow: {
    ...MEADOW, skyTop: 0x7fb6e6, skyHorizon: 0xeaf4fa, fog: 0xdcebf3, fogNear: 50, fogFar: 300,
    hemiSky: 0xffffff, hemiGround: 0xcfe0ee, hemi: 2.0, sun: 0xfff6e8, sunPower: 1.7,
    grassA: 0xf6fbfe, grassB: 0xe4eff6, hill: 0xcadbe8, alpineA: 0xf6fbfe, alpineB: 0xe4eff6,
    rockA: 0xa7adb6, rockB: 0x8a94a3, sand: 0xbfe2ee, bed: 0xa9b6c2,
    pathA: 0xd7c3a2, pathB: 0xcbb692, pathEdge: 0xa48c68,
    pine: 0x2f7a5c, pineLight: 0xf7fcff, tuftA: 0xd4e3ec, tuftB: 0xeef6fa, peak: 0x9cc3d6, peakCap: 0xffffff,
    water: 0xbfe6f2, trees: 0, flowers: 0.08, air: 1,
  },
  beach: {
    ...MEADOW, skyTop: 0x1f9ff0, skyHorizon: 0xcff3f5, fog: 0xbfeef0, fogNear: 80, fogFar: 380,
    hemiSky: 0xffffff, hemiGround: 0xf0dca8, hemi: 2.05, sun: 0xfff0c2, sunPower: 2.2,
    grassA: 0xf4e2b0, grassB: 0xead39a, hill: 0x8fcf73, sand: 0xf4e2b0, bed: 0xd8bf88,
    pathA: 0xc9a06a, pathB: 0xbb9059, pathEdge: 0x8f6a40,
    leaf: 0x49b86b, leafB: 0x6fcf7d, leafC: 0x3aa35c, trunk: 0xa67c52, tuftA: 0x7cc65a, tuftB: 0xa6dc7a,
    peak: 0x4fb0c4, water: 0x25c7d9, trees: 2, flowers: 0.45,
  },
};
let C: Theme = MEADOW;

const v = new THREE.Vector3();
const q = new THREE.Quaternion();
const m4 = new THREE.Matrix4();
const col = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

const lambert = (color: number, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function paint(g: THREE.BufferGeometry, color: number) {
  const ng = g.index ? g.toNonIndexed() : g;
  const n = ng.attributes.position.count;
  const a = new Float32Array(n * 3);
  col.set(color);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  ng.setAttribute("color", new THREE.BufferAttribute(a, 3));
  ng.deleteAttribute("uv");
  return ng;
}

// ---------------------------------------------------------------------------
// Land
// ---------------------------------------------------------------------------

const LATS = [-96, -68, -48, -34, -25, -18, -12, -7.6, -4.6, -TRAIL_HALF_WIDTH, 0, TRAIL_HALF_WIDTH, 4.6, 7.6, 12, 18, 25, 34, 48, 68, 96];

function landRows(): number[] {
  const rows: number[] = [];
  const cuts = GAPS.filter((g) => g.s < BRIDGE.from || g.s > BRIDGE.to);
  for (let s = TERRAIN_FROM; s <= TERRAIN_TO; s += 2.5) if (!cuts.some((g) => s > g.s - 0.3 && s < g.s + g.len + 0.3)) rows.push(s);
  for (const g of cuts) rows.push(g.s, g.s + 0.03, g.s + g.len - 0.03, g.s + g.len);
  return rows.sort((a, b) => a - b);
}

function landColor(s: number, lat: number, y: number, ny: number, out: THREE.Color) {
  const base = groundHeight(s);
  const d = Math.abs(lat) - TRAIL_HALF_WIDTH;
  const w = weights(s);
  const n = noise(s * 0.11 + 9, lat * 0.13);
  const steep = 1 - ny;
  const tmp = new THREE.Color();

  out.set(C.grassA).lerp(tmp.set(C.grassB), n).lerp(tmp.set(C.hill), smooth(18, 70, d) * 0.75);
  if (w.ridge > 0) {
    tmp.set(C.rockA).lerp(col.set(C.rockB), n);
    const grassy = lat < 0 ? smooth(0.2, 0.08, steep) * 0.55 : smooth(4, 1, d) * 0.6;
    out.lerp(tmp.lerp(col.set(C.alpineB), grassy), w.ridge);
  }
  if (w.summit > 0) {
    tmp.set(C.alpineA).lerp(col.set(C.alpineB), n);
    tmp.lerp(col.set(C.rockA), smooth(0.14, 0.3, steep));
    tmp.lerp(col.set(C.snow), smooth(7, 12, y - base + n * 3));
    out.lerp(tmp, w.summit);
  }
  if (steep > 0.35) out.lerp(tmp.set(C.rockB), smooth(0.35, 0.6, steep) * 0.8);
  if (chasm(s) > 0.1 && y < base - 3) out.set(C.rockDark).lerp(tmp.set(C.rockB), n);
  if (y < base - 0.9 && w.valley > 0.5) out.set(C.sand);
  if (s > END_S - 2 && y < LAKE_LEVEL + 0.5) out.set(C.sand);
  if (d < 0 && y > base - 0.6) out.set(C.bed);
}

function buildLand(): THREE.Mesh {
  const rows = landRows();
  const nl = LATS.length;
  const pts = new Float32Array(rows.length * nl * 3);
  rows.forEach((s, r) => LATS.forEach((lat, c) => {
    place(s, lat, terrainHeight(s, lat), v);
    pts.set([v.x, v.y, v.z], (r * nl + c) * 3);
  }));
  const quads = (rows.length - 1) * (nl - 1);
  const pos = new Float32Array(quads * 18), colors = new Float32Array(quads * 18);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c3 = new THREE.Vector3(), nrm = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const out = new THREE.Color();
  let o = 0;
  const tri = (i: number, j: number, k: number, s: number, lat: number) => {
    a.fromArray(pts, i * 3); b.fromArray(pts, j * 3); c3.fromArray(pts, k * 3);
    nrm.crossVectors(e1.subVectors(b, a), e2.subVectors(c3, a)).normalize();
    landColor(s, lat, (a.y + b.y + c3.y) / 3, Math.abs(nrm.y), out);
    for (const p of [a, b, c3]) { pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z; colors[o] = out.r; colors[o + 1] = out.g; colors[o + 2] = out.b; o += 3; }
  };
  for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < nl - 1; c++) {
    const i = r * nl + c, s = (rows[r] + rows[r + 1]) / 2, lat = (LATS[c] + LATS[c + 1]) / 2;
    tri(i, i + 1, i + nl, s, lat);
    tri(i + 1, i + nl + 1, i + nl, s, lat);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// The path
// ---------------------------------------------------------------------------

/** Stretches of solid trail between `from` and `to`, with every gap removed. */
function solidRanges(from: number, to: number): [number, number][] {
  const out: [number, number][] = [];
  let a = from;
  for (const g of GAPS) {
    if (g.s + g.len <= from || g.s >= to) continue;
    if (g.s > a) out.push([a, g.s]);
    a = g.s + g.len;
  }
  if (a < to) out.push([a, to]);
  return out;
}

function buildPath(): THREE.Mesh {
  const pos: number[] = [], colors: number[] = [];
  const quad = (p: THREE.Vector3[], color: THREE.Color) => {
    for (const i of [0, 1, 2, 2, 1, 3]) { pos.push(p[i].x, p[i].y, p[i].z); colors.push(color.r, color.g, color.b); }
  };
  const P = (s: number, lat: number, dy: number) => place(s, lat, groundHeight(s) + dy, new THREE.Vector3());
  const hw = TRAIL_HALF_WIDTH, inner = hw - 0.42, drop = -0.5;
  const cA = new THREE.Color(C.pathA), cB = new THREE.Color(C.pathB), cE = new THREE.Color(C.pathEdge), cS = new THREE.Color(C.woodDark).lerp(new THREE.Color(C.pathEdge), 0.5);
  const ranges = [...solidRanges(TERRAIN_FROM + 4, BRIDGE.from), ...solidRanges(BRIDGE.to, END_S - 8)];
  for (const [from, to] of ranges) {
    const n = Math.max(1, Math.round(to - from));
    for (let i = 0; i < n; i++) {
      const s0 = from + ((to - from) * i) / n, s1 = from + ((to - from) * (i + 1)) / n;
      // Alternating bands every few units make speed readable.
      const band = Math.floor(s0 / 3) % 2 ? cA : cB;
      quad([P(s0, -inner, 0), P(s0, inner, 0), P(s1, -inner, 0), P(s1, inner, 0)], band);
      quad([P(s0, -hw, -0.03), P(s0, -inner, 0), P(s1, -hw, -0.03), P(s1, -inner, 0)], cE);
      quad([P(s0, inner, 0), P(s0, hw, -0.03), P(s1, inner, 0), P(s1, hw, -0.03)], cE);
      quad([P(s0, -hw, drop), P(s0, -hw, -0.03), P(s1, -hw, drop), P(s1, -hw, -0.03)], cS);
      quad([P(s0, hw, -0.03), P(s0, hw, drop), P(s1, hw, -0.03), P(s1, hw, drop)], cS);
    }
    // Cut faces, so a gap reads as a real edge. They run deep enough to meet the channel floor.
    quad([P(from, hw, -4), P(from, -hw, -4), P(from, hw, 0), P(from, -hw, 0)], cS);
    quad([P(to, -hw, -4), P(to, hw, -4), P(to, -hw, 0), P(to, hw, 0)], cS);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// Instancing helper
// ---------------------------------------------------------------------------

interface Inst { s: number; lat: number; y?: number; dy?: number; rot?: number; scale?: number | [number, number, number]; color?: number }

function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, items: Inst[], shadow = false): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, items.length));
  mesh.count = items.length;
  const sc = new THREE.Vector3();
  items.forEach((it, i) => {
    place(it.s, it.lat, (it.y ?? terrainHeight(it.s, it.lat)) + (it.dy ?? 0), v);
    q.setFromAxisAngle(UP, facing(it.s) + (it.rot ?? 0));
    if (Array.isArray(it.scale)) sc.set(...it.scale); else sc.setScalar(it.scale ?? 1);
    mesh.setMatrixAt(i, m4.compose(v, q, sc));
    if (it.color !== undefined) mesh.setColorAt(i, col.set(it.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = shadow;
  mesh.frustumCulled = false;
  return mesh;
}

// ---------------------------------------------------------------------------
// Bridge
// ---------------------------------------------------------------------------

function buildBridge(group: THREE.Group) {
  const planks: Inst[] = [], posts: Inst[] = [], beams: Inst[] = [], ropes: Inst[] = [];
  const y = groundHeight(BRIDGE.from);
  for (const [from, to] of solidRanges(BRIDGE.from, BRIDGE.to)) {
    const n = Math.max(1, Math.round(to - from)), pitch = (to - from) / n;
    for (let i = 0; i < n; i++) {
      const edge = (i === 0 && from > BRIDGE.from) || (i === n - 1 && to < BRIDGE.to);
      planks.push({ s: from + pitch * (i + 0.5), lat: 0, y: y - 0.07, scale: [1, 1, pitch - 0.1], color: edge ? 0xf3dfae : i % 2 ? C.wood : 0xa87850, rot: (noise(i, from) - 0.5) * 0.03 });
    }
    for (let s = from + 0.5; s < to; s += 1) for (const lat of [-1.75, 1.75]) beams.push({ s, lat, y: y - 0.3 });
  }
  for (let s = BRIDGE.from; s <= BRIDGE.to; s += 3.1) {
    const solid = !GAPS.some((g) => s > g.s - 0.2 && s < g.s + g.len + 0.2);
    for (const lat of [-2.5, 2.5]) if (solid) posts.push({ s, lat, y: y - 0.2 });
  }
  for (let s = BRIDGE.from; s < BRIDGE.to; s += 1) for (const lat of [-2.5, 2.5]) for (const h of [0.55, 1.05]) ropes.push({ s: s + 0.5, lat, y: y + h });
  const wood = lambert(0xffffff);
  group.add(
    instanced(new THREE.BoxGeometry(4.9, 0.14, 1), wood, planks, true),
    instanced(new THREE.BoxGeometry(0.22, 0.3, 1.02), lambert(C.woodDark), beams),
    instanced(new THREE.BoxGeometry(0.16, 1.45, 0.16).translate(0, 0.72, 0), lambert(C.woodDark), posts, true),
    instanced(new THREE.BoxGeometry(0.05, 0.05, 1.04), lambert(0xe9dcc0), ropes),
  );
  // Stone abutments where the bridge meets the land.
  const stone = new THREE.BoxGeometry(6.2, 3, 2.4);
  group.add(instanced(stone, lambert(C.rockB), [
    { s: BRIDGE.from - 0.6, lat: 0, y: y - 1.9 }, { s: BRIDGE.to + 0.6, lat: 0, y: y - 1.9 },
  ]));
}

// ---------------------------------------------------------------------------
// Obstacles
// ---------------------------------------------------------------------------

function buildHazards(group: THREE.Group, hazards: Hazard[]) {
  const width = TRAIL_HALF_WIDTH * 2;
  const bars: Inst[] = [], posts: Inst[] = [], leaves: Inst[] = [];
  const logs: Inst[] = [], logEnds: Inst[] = [], rocks: Inst[] = [], bushes: Inst[] = [], spikes: Inst[] = [], tips: Inst[] = [], rims: Inst[] = [];
  const rnd = seeded(77);
  for (const h of hazards) {
    const c = h.s + h.len / 2, y = groundHeight(c);
    if (h.kind === "log") {
      logs.push({ s: c, lat: 0, y: y + 0.3, rot: (rnd() - 0.5) * 0.12 });
      for (const side of [-1, 1]) logEnds.push({ s: c, lat: side * (width / 2 + 0.06), y: y + 0.3, rot: 0 });
    } else if (h.kind === "rock") {
      for (let i = 0; i < 4; i++) {
        const lat = -1.65 + i * 1.1 + (rnd() - 0.5) * 0.2;
        rocks.push({ s: c + (rnd() - 0.5) * 0.12, lat, y: y + 0.24, rot: rnd() * 6, scale: [0.62 + rnd() * 0.1, 0.56 + (i % 2) * 0.1, 0.5], color: i % 2 ? 0x8b9099 : 0x9a9da3 });
      }
    } else if (h.kind === "thorn") {
      for (let i = 0; i < 6; i++) bushes.push({ s: h.s + 0.35 + (i % 3) * 0.6, lat: -1.5 + Math.floor(i / 3) * 3 + (i % 3 - 1) * 0.8, y: y + 0.05, scale: [1.1, 0.34, 0.62], rot: rnd() * 3 });
      for (let i = 0; i < 22; i++) {
        const it = { s: h.s + 0.15 + rnd() * (h.len - 0.3), lat: -2 + (i / 21) * 4 + (rnd() - 0.5) * 0.25, y: y + 0.1, rot: rnd() * 6, scale: 0.8 + rnd() * 0.35 };
        spikes.push(it); tips.push({ ...it, y: it.y + 0.3 * it.scale });
      }
    } else if (h.kind === "branch") {
      // A bough across the trail on two posts: its underside is exactly where the collision says it is.
      bars.push({ s: c, lat: 0, y: y + BRANCH.bottom + 0.24, rot: (rnd() - 0.5) * 0.06 });
      for (const side of [-1, 1]) posts.push({ s: c, lat: side * (width / 2 + 0.28), y });
      for (let i = 0; i < 7; i++) leaves.push({ s: c + (rnd() - 0.5) * 0.5, lat: -2.4 + i * 0.8 + (rnd() - 0.5) * 0.3, y: y + BRANCH.bottom + 0.5 + rnd() * 0.25, rot: rnd() * 6, scale: [0.5 + rnd() * 0.25, 0.3 + rnd() * 0.12, 0.42], color: i % 2 ? C.leafB : C.leafC });
    } else if (h.s < BRIDGE.from || h.s > BRIDGE.to) {
      // Pale rim stones mark both edges of a gap.
      for (const edge of [h.s - 0.16, h.s + h.len + 0.16]) for (let i = 0; i < 7; i++) rims.push({ s: edge, lat: -2.05 + i * 0.68, y: groundHeight(edge) + 0.02, rot: rnd() * 6, scale: [0.26, 0.13, 0.2] });
    }
  }
  const log = new THREE.CylinderGeometry(0.34, 0.36, width + 0.1, 9).rotateZ(Math.PI / 2);
  group.add(
    instanced(log, lambert(0x8a5a36), logs, true),
    instanced(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 9).rotateZ(Math.PI / 2), lambert(C.woodLight), logEnds),
    instanced(new THREE.DodecahedronGeometry(1, 0), lambert(0xffffff), rocks, true),
    instanced(new THREE.IcosahedronGeometry(1, 0), lambert(C.thorn), bushes),
    instanced(new THREE.ConeGeometry(0.11, 0.5, 5).translate(0, 0.25, 0), lambert(0x3d8a4c), spikes, true),
    instanced(new THREE.ConeGeometry(0.05, 0.2, 5).translate(0, 0.1, 0), lambert(C.thornTip, { emissive: 0x5a0d10 }), tips),
    instanced(new THREE.DodecahedronGeometry(1, 0), lambert(0xf1ead8), rims),
    instanced(new THREE.CylinderGeometry(0.24, 0.26, width + 0.9, 9).rotateZ(Math.PI / 2), lambert(0x7a4f2c), bars, true),
    instanced(new THREE.CylinderGeometry(0.13, 0.17, BRANCH.bottom + 0.75, 7).translate(0, (BRANCH.bottom + 0.75) / 2, 0), lambert(C.woodDark), posts, true),
    instanced(new THREE.IcosahedronGeometry(1, 0), lambert(0xffffff), leaves),
  );
}

// ---------------------------------------------------------------------------
// Scenery
// ---------------------------------------------------------------------------

function pineGeometry() {
  const parts = [paint(new THREE.CylinderGeometry(0.16, 0.26, 1.4, 6).translate(0, 0.7, 0), C.trunk)];
  [[1.5, 2.1, 1.9], [1.15, 1.8, 3.0], [0.78, 1.6, 4.0]].forEach(([r, h, y], i) => parts.push(paint(new THREE.ConeGeometry(r, h, 7).translate(0, y, 0), i === 1 ? C.pineLight : C.pine)));
  return mergeGeometries(parts)!;
}
function roundTreeGeometry() {
  return mergeGeometries([
    paint(new THREE.CylinderGeometry(0.18, 0.28, 1.8, 6).translate(0, 0.9, 0), C.trunk),
    paint(new THREE.IcosahedronGeometry(1.35, 0).translate(0, 2.6, 0), C.leaf),
    paint(new THREE.IcosahedronGeometry(0.95, 0).translate(0.7, 3.3, 0.2), C.leafB),
    paint(new THREE.IcosahedronGeometry(0.85, 0).translate(-0.75, 2.9, -0.2), C.leafC),
  ])!;
}
function palmGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  // A leaning trunk in three pieces, then a crown of drooping fronds.
  for (let i = 0; i < 3; i++) parts.push(paint(new THREE.CylinderGeometry(0.16 - i * 0.02, 0.2 - i * 0.02, 1.3, 6).rotateZ(-0.12 - i * 0.1).translate(i * 0.22 + 0.02, 0.6 + i * 1.15, 0), C.trunk));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    parts.push(paint(new THREE.ConeGeometry(0.34, 2.2, 4).scale(1, 1, 0.3).rotateZ(-Math.PI / 2 - 0.45).translate(0.95, -0.25, 0).rotateY(a).translate(0.55, 3.55, 0), i % 2 ? C.leaf : C.leafB));
  }
  parts.push(paint(new THREE.IcosahedronGeometry(0.22, 0).translate(0.55, 3.45, 0), 0x8a5a36));
  return mergeGeometries(parts)!;
}
function flowerGeometry() {
  const parts = [paint(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 4).translate(0, 0.17, 0), 0x4f9a45)];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(paint(new THREE.SphereGeometry(0.075, 5, 4).scale(1, 0.5, 1).translate(Math.cos(a) * 0.1, 0.36, Math.sin(a) * 0.1), 0xffffff));
  }
  parts.push(paint(new THREE.SphereGeometry(0.06, 5, 4).translate(0, 0.38, 0), 0xffd84a));
  return mergeGeometries(parts)!;
}

function buildScenery(group: THREE.Group) {
  const rnd = seeded(2026);
  const pines: Inst[] = [], rounds: Inst[] = [], rocks: Inst[] = [], flowers: Inst[] = [], tufts: Inst[] = [];
  const blocked = (s: number, lat: number) =>
    chasm(s) > 0.02 || GAPS.some((g) => s > g.s - 1.5 && s < g.s + g.len + 1.5) || (s > END_S - 8 && terrainHeight(s, lat) < LAKE_LEVEL + 0.6);
  const petals = [0xff8fb0, 0xffffff, 0xffd166, 0xc79bff, 0xff9966];

  for (let s = TERRAIN_FROM + 6; s < TERRAIN_TO - 6; s += 1.6) {
    const w = weights(s);
    const side = rnd() < 0.5 ? -1 : 1;
    // Trees: thick in the valley, pines up high, almost none on the open side of the ridge.
    if (rnd() < 0.62 * w.valley + 0.3 * w.ridge + 0.5 * w.summit) {
      const lat = side * (5.5 + Math.pow(rnd(), 1.6) * 62);
      const ridgeDrop = w.ridge > 0.5 && lat > 0;
      if (!blocked(s, lat) && !ridgeDrop) {
        const it: Inst = { s, lat, rot: rnd() * 6, scale: 0.75 + rnd() * 0.7 };
        if (C.trees === 2 || (C.trees === 1 && rnd() < w.valley * 0.7)) rounds.push({ ...it, color: [0xffffff, 0xeaf7d8, 0xf6ffd9][Math.floor(rnd() * 3)] });
        else pines.push({ ...it, color: [0xffffff, 0xdff2e6, 0xf2ffe9][Math.floor(rnd() * 3)] });
      }
    }
    if (rnd() < 0.2 + 0.45 * w.ridge + 0.2 * w.summit) {
      const lat = side * (3.4 + rnd() * 30);
      if (!blocked(s, lat)) rocks.push({ s, lat, dy: 0.1, rot: rnd() * 6, scale: [0.4 + rnd() * 1.1, 0.3 + rnd() * 0.7, 0.4 + rnd() * 0.9], color: rnd() < 0.5 ? C.rockA : C.rockB });
    }
    // Flowers hug the trail edges but never sit on it.
    const bloom = (0.9 * w.valley + 0.25 * w.ridge + 0.8 * w.summit) * C.flowers;
    for (let k = 0; k < 3; k++) if (rnd() < bloom) {
      const lat = (rnd() < 0.5 ? -1 : 1) * (2.9 + rnd() * rnd() * 9);
      if (!blocked(s, lat) && !(w.ridge > 0.5 && lat > 4)) flowers.push({ s: s + rnd(), lat, rot: rnd() * 6, scale: 0.75 + rnd() * 0.6, color: petals[Math.floor(rnd() * petals.length)] });
    }
    for (let k = 0; k < 2; k++) if (rnd() < 0.7) {
      const lat = (rnd() < 0.5 ? -1 : 1) * (2.7 + rnd() * 14);
      if (!blocked(s, lat) && !(w.ridge > 0.5 && lat > 3)) tufts.push({ s: s + rnd(), lat, rot: rnd() * 6, scale: 0.7 + rnd() * 0.8, color: rnd() < 0.5 ? C.tuftA : C.tuftB });
    }
  }
  const tinted = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  group.add(
    instanced(pineGeometry(), tinted, pines),
    instanced(C.trees === 2 ? palmGeometry() : roundTreeGeometry(), tinted, rounds),
    instanced(new THREE.DodecahedronGeometry(1, 0), lambert(0xffffff), rocks),
    instanced(flowerGeometry(), tinted, flowers),
    instanced(new THREE.ConeGeometry(0.16, 0.42, 4).translate(0, 0.2, 0), lambert(0xffffff), tufts),
  );
}

function buildBackdrop(group: THREE.Group) {
  const rnd = seeded(5);
  const peaks: Inst[] = [], caps: Inst[] = [];
  for (let s = -260; s < 1200; s += 46) for (const side of [-1, 1]) {
    const lat = side * (150 + rnd() * 130), scale = 0.8 + rnd() * 0.9, y = groundHeight(s) - 24 - (side > 0 ? 14 : 0);
    peaks.push({ s: s + rnd() * 30, lat, y, scale, rot: rnd() * 6 });
    caps.push({ ...peaks[peaks.length - 1], y: y + 62 * scale, scale: scale * 0.39 });
  }
  // A few behind the start, so the menu view looks back at mountains too.
  for (let i = -3; i <= 3; i++) {
    const scale = 1 + rnd() * 0.8, p = { s: -330 - rnd() * 60, lat: i * 95 + rnd() * 30, y: -24, scale, rot: rnd() * 6 };
    peaks.push(p); caps.push({ ...p, y: p.y + 62 * scale, scale: scale * 0.39 });
  }
  const peak = new THREE.ConeGeometry(62, 100, 7).translate(0, 50, 0);
  group.add(instanced(peak, lambert(C.peak), peaks), instanced(peak, lambert(C.peakCap), caps));
}

function waterfallTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#8fdcea"; ctx.fillRect(0, 0, 64, 256);
  const rnd = seeded(11);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.6})`;
    const x = rnd() * 64, y = rnd() * 256, h = 20 + rnd() * 70;
    ctx.fillRect(x, y, 1 + rnd() * 3, h);
    ctx.fillRect(x, y - 256, 1 + rnd() * 3, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function bannerTexture(text: string, bg: string, fg: string) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 96;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = fg; ctx.font = "800 54px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------

export interface World {
  group: THREE.Group;
  sky: THREE.Object3D;
  mist: THREE.Vector3[];
  theme: Theme;
  update(time: number, calm: boolean): void;
  dispose(): void;
}
export function buildWorld(course: CourseId = "meadow", hazards: Hazard[] = HAZARDS): World {
  C = THEMES[course] ?? MEADOW;
  const theme = C;
  const group = new THREE.Group();
  group.add(buildLand(), buildPath());
  buildBridge(group);
  buildHazards(group, hazards);
  buildScenery(group);
  buildBackdrop(group);

  // --- Sky ---
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(C.skyTop) }, horizon: { value: new THREE.Color(C.skyHorizon) } },
      vertexShader: "varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform vec3 top; uniform vec3 horizon; varying float h; void main(){ float t = pow(clamp(h*1.25+0.02,0.0,1.0),0.6); gl_FragColor = vec4(mix(horizon, top, t),1.0); }",
    }),
  );
  sky.renderOrder = -10;
  if (C.night) {
    // A moon and a scatter of stars, fixed to the sky so they stay at the horizon's distance.
    const moon = new THREE.Mesh(new THREE.SphereGeometry(26, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfdf6d8, fog: false }));
    moon.position.set(330, 300, -260);
    sky.add(moon);
    const rndStar = seeded(909), pts: number[] = [];
    for (let i = 0; i < 420; i++) { const a = rndStar() * Math.PI * 2, h = 0.08 + rndStar() * 0.9, r = Math.sqrt(1 - h * h) * 560; pts.push(Math.cos(a) * r, h * 560, Math.sin(a) * r); }
    const starField = new THREE.BufferGeometry();
    starField.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    sky.add(new THREE.Points(starField, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
  }
  group.add(sky);

  // --- Clouds ---
  const rnd = seeded(31);
  const puffs: Inst[] = [];
  const cloudHomes: { s: number; lat: number; y: number }[] = [];
  for (let i = 0; i < 16; i++) cloudHomes.push({ s: -30 + i * 64 + rnd() * 30, lat: (rnd() - 0.5) * 300, y: 46 + rnd() * 34 });
  for (const h of cloudHomes) for (let k = 0; k < 5; k++) puffs.push({ s: h.s + (k - 2) * 5.5, lat: h.lat + (rnd() - 0.5) * 6, y: groundHeight(h.s) + h.y + (k % 2) * 1.6, scale: [7 + rnd() * 4, 3.2 + rnd() * 1.6, 5 + rnd() * 3] });
  const clouds = instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: C.cloud, fog: false, transparent: true, opacity: C.cloudAlpha }), puffs);
  group.add(clouds);

  // --- Water ---
  const waterMat = new THREE.MeshLambertMaterial({ color: C.water, transparent: true, opacity: 0.86 });
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const waters: Inst[] = [];
  // The valley stream and the river at the bottom of the chasm.
  const stream = GAPS[0];
  waters.push({ s: stream.s + stream.len / 2, lat: 0, y: groundHeight(stream.s) - 1.05, scale: [190, 1, stream.len - 0.1] });
  waters.push({ s: (BRIDGE.from + BRIDGE.to) / 2, lat: 20, y: groundHeight(BRIDGE.from) - CHASM_DEPTH + 2.3, scale: [150, 1, 54] });
  waters.push({ s: END_S + 40, lat: 0, y: LAKE_LEVEL, scale: [260, 1, 150] });
  group.add(instanced(flat, waterMat, waters));

  const fallTex = waterfallTexture();
  const fallMat = new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
  const mist: THREE.Vector3[] = [];

  // Waterfall beside the bridge: over the left cliff, into the river.
  {
    const s = 466, base = groundHeight(BRIDGE.from), top = base + 9, bottom = base - CHASM_DEPTH + 2.3;
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(11, top - bottom), fallMat);
    fall.position.copy(place(s, -23.5, (top + bottom) / 2, v));
    fall.rotation.y = facing(s) + Math.PI / 2;
    group.add(fall);
    group.add(instanced(new THREE.BoxGeometry(15, 3, 13), lambert(C.rockB), [{ s, lat: -30, y: top - 0.8 }]));
    mist.push(place(s, -22, bottom + 1, new THREE.Vector3()));
  }
  // The summit vista: a tall fall into the lake, straight ahead of the finish.
  {
    const s = END_S + 58, rocks: Inst[] = [];
    for (let i = -4; i <= 4; i++) rocks.push({ s: s + 10 - Math.abs(i) * 3.2, lat: i * 17, y: LAKE_LEVEL - 6, rot: i * 1.3, scale: [1, 0.8 + noise(i, 3) * 0.5, 1] });
    const cliff = new THREE.CylinderGeometry(15, 21, 58, 7).translate(0, 29, 0);
    group.add(instanced(cliff, lambert(C.rockB), rocks));
    group.add(instanced(new THREE.ConeGeometry(15.5, 12, 7).translate(0, 6, 0), lambert(C.snow), rocks.map((r) => ({ ...r, y: LAKE_LEVEL - 6 + 58 * (r.scale as number[])[1] }))));
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(13, 42), fallMat);
    fall.position.copy(place(s - 6.5, 0, LAKE_LEVEL + 21, v));
    fall.rotation.y = facing(s);
    group.add(fall);
    mist.push(place(s - 8, 0, LAKE_LEVEL + 1, new THREE.Vector3()));
  }

  const finish = new THREE.Group();
  finish.position.copy(place(FINISH_S, 0, groundHeight(FINISH_S), new THREE.Vector3()));
  finish.rotation.y = facing(FINISH_S);
  const postMaterial = lambert(C.woodDark);
  for (const x of [-2.6, 2.6]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.6, 8), postMaterial);
    post.position.set(x, 1.8, 0);
    post.castShadow = true;
    finish.add(post);
  }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.7, 0.15), lambert(0xff8fb0));
  banner.position.y = 3.25;
  finish.add(banner);
  group.add(finish);
  return {
    group, sky, mist, theme,
    update(time, calm) {
      if (!calm) {
        fallTex.offset.y = (time * 0.55) % 1;
        waterMat.opacity = 0.84 + Math.sin(time * 1.3) * 0.03;
        clouds.position.x = Math.sin(time * 0.04) * 8;
      }
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      group.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        geometries.add(mesh.geometry);
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
        if ((mesh as THREE.InstancedMesh).isInstancedMesh) (mesh as THREE.InstancedMesh).dispose();
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) {
        (material as THREE.MeshBasicMaterial).map?.dispose();
        material.dispose();
      }
      group.clear();
    }
  };
}

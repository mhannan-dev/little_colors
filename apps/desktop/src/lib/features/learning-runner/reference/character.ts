// Adapted from the user-provided Dosevana partner/runner character rig.
import * as THREE from "three";

/**
 * "Bloom" — the runner. An original articulated character built from simple
 * shapes: hips, torso, head, two-part arms and two-part legs, each on its own
 * joint. There is no downloaded model and no baked animation; every pose below
 * is a set of joint angles, and the character eases from one to the next, so
 * run, jump, flip, landing, stumble and celebration blend into each other.
 *
 * The collision body lives in the simulation and never rotates. This is only
 * the picture of it.
 */
export const OUTFITS = [
  { name: "Coral", jacket: 0xff6f61, cap: 0xffd84a, pack: 0x3c6e8f },
  { name: "Sky", jacket: 0x4a9be8, cap: 0xff8fb0, pack: 0xf2a541 },
  { name: "Meadow", jacket: 0x4fb37a, cap: 0xfff3d6, pack: 0x8a5a36 },
  { name: "Plum", jacket: 0xa56bd6, cap: 0x7fe0c9, pack: 0x3f4a6b },
  // Unlocked by score (see OUTFIT_UNLOCK in engine/storage.ts). Looks only.
  { name: "Sunset", jacket: 0xff9d2e, cap: 0xd23a6f, pack: 0x6b2d5c },
  { name: "Mint", jacket: 0x7fe0c9, cap: 0x173a3d, pack: 0xffffff },
  { name: "Midnight", jacket: 0x2b3566, cap: 0xffd84a, pack: 0x8fa6ff },
  { name: "Gold", jacket: 0xffcf3a, cap: 0xffffff, pack: 0xd97f14 },
] as const;

/** Who you run as. All four share one skeleton and every animation; only the look differs. */
export const CHARACTERS = [
  { name: "Bloom", kind: "kid", fur: 0xffd7b5, limb: 0xffd7b5, glow: 0x4a2a18, accent: 0x5a3b2a, muzzle: 0xffffff },
  { name: "Foxy", kind: "fox", fur: 0xf28a2e, limb: 0x5a3320, glow: 0x4a1f00, accent: 0x3b2418, muzzle: 0xfff4e3 },
  { name: "Clover", kind: "bunny", fur: 0xf7f2ee, limb: 0xf7f2ee, glow: 0x3a3030, accent: 0xffb3c7, muzzle: 0xffffff },
  { name: "Bao", kind: "panda", fur: 0xfbfbfb, limb: 0x30303c, glow: 0x2a2a2a, accent: 0x30303c, muzzle: 0xffffff },
] as const;

export type Mood = "idle" | "ready" | "run" | "dash" | "slide" | "rise" | "fall" | "flip" | "land" | "stumble" | "drop" | "shake" | "skid" | "victory";

export interface Frame {
  mood: Mood;
  dt: number;
  time: number;
  /** Trail distance travelled, which drives the stride so the feet match the ground speed. */
  distance: number;
  /** 0..1 through an air trick, or -1. */
  flip: number;
  /** Which of TRICKS is being performed. */
  trick: number;
  /** 0..1: a fist pump laid over the run, for a checkpoint or a new multiplier. */
  cheer: number;
  /** 1 fading to 0: the jolt of an injection, a quick swell of the whole body. */
  surge?: number;
  calm: boolean;
}

interface Pose {
  hipL: number; hipR: number; kneeL: number; kneeR: number;
  armL: number; armR: number; armOutL: number; armOutR: number; elbowL: number; elbowR: number;
  lean: number; head: number; headTurn: number; lift: number; squash: number; tilt: number;
  /** Legs apart, body turn and side-step: used by the cartwheel and the dance. */
  legOut: number; turn: number; sway: number;
}
const REST: Pose = { hipL: 0, hipR: 0, kneeL: 0, kneeR: 0, armL: 0, armR: 0, armOutL: 0.12, armOutR: 0.12, elbowL: -0.2, elbowR: -0.2, lean: 0, head: 0, headTurn: 0, lift: 0, squash: 1, tilt: 0, legOut: 0, turn: 0, sway: 0 };

const HIP_Y = 0.86;

export interface Character {
  root: THREE.Group;
  /** Rotates for the flip, around the middle of the body. */
  pivot: THREE.Group;
  setOutfit(index: number): void;
  update(frame: Frame): void;
  dispose(): void;
}

export function buildCharacter(index = 0): Character {
  const who = CHARACTERS[index] ?? CHARACTERS[0];
  const kid = who.kind === "kid";
  const mats = {
    skin: new THREE.MeshLambertMaterial({ color: who.fur, emissive: who.glow, emissiveIntensity: 0.35 }),
    limb: new THREE.MeshLambertMaterial({ color: who.limb, emissive: who.glow, emissiveIntensity: 0.3 }),
    accent: new THREE.MeshLambertMaterial({ color: who.accent }),
    muzzle: new THREE.MeshLambertMaterial({ color: who.muzzle, emissive: 0x303030, emissiveIntensity: 0.3 }),
    jacket: new THREE.MeshLambertMaterial({ color: OUTFITS[0].jacket }),
    cap: new THREE.MeshLambertMaterial({ color: OUTFITS[0].cap }),
    pack: new THREE.MeshLambertMaterial({ color: OUTFITS[0].pack }),
    shorts: new THREE.MeshLambertMaterial({ color: 0x3d4b66 }),
    shoe: new THREE.MeshLambertMaterial({ color: 0xffffff }),
    sole: new THREE.MeshLambertMaterial({ color: 0x33415c }),
    hair: new THREE.MeshLambertMaterial({ color: 0x5a3b2a }),
    dark: new THREE.MeshBasicMaterial({ color: 0x2b2b3a }),
    white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    blush: new THREE.MeshBasicMaterial({ color: 0xff9aa2, transparent: true, opacity: 0.65 }),
    scarf: new THREE.MeshLambertMaterial({ color: 0xfff3d6 }),
    petal: new THREE.MeshLambertMaterial({ color: 0xff8fb0 }),
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    return o;
  };
  const joint = (parent: THREE.Object3D, x: number, y: number, z: number) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const capsule = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 3, 10);
  const ball = (r: number) => new THREE.SphereGeometry(r, 14, 10);

  const root = new THREE.Group();
  const pivot = joint(root, 0, HIP_Y, 0);
  const body = joint(pivot, 0, 0, 0);

  // Torso and backpack.
  const torso = joint(body, 0, 0, 0);
  torso.add(mesh(capsule(0.27, 0.34), mats.jacket, 0, 0.3, 0));
  torso.add(mesh(new THREE.SphereGeometry(0.285, 12, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), mats.shorts, 0, 0.1, 0));
  const pack = mesh(new THREE.BoxGeometry(0.4, 0.44, 0.2), mats.pack, 0, 0.36, -0.3);
  torso.add(pack);
  torso.add(mesh(new THREE.BoxGeometry(0.3, 0.12, 0.22), mats.cap, 0, 0.61, -0.3));
  // The bloom on the backpack — what you see most of the time.
  const badge = joint(torso, 0, 0.36, -0.405);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const p = mesh(ball(0.05), mats.petal, Math.cos(a) * 0.07, Math.sin(a) * 0.07, 0); p.scale.z = 0.4; badge.add(p); }
  const badgeCentre = mesh(ball(0.045), mats.cap); badgeCentre.scale.z = 0.5; badge.add(badgeCentre);

  // Scarf with a tail that streams behind.
  torso.add(mesh(new THREE.TorusGeometry(0.2, 0.065, 6, 14).rotateX(Math.PI / 2), mats.scarf, 0, 0.62, 0));
  const scarfA = joint(torso, -0.14, 0.62, -0.16);
  scarfA.add(mesh(new THREE.BoxGeometry(0.13, 0.05, 0.34).translate(0, 0, -0.17), mats.scarf));
  const scarfB = joint(scarfA, 0, 0, -0.34);
  scarfB.add(mesh(new THREE.BoxGeometry(0.11, 0.045, 0.3).translate(0, 0, -0.15), mats.scarf));

  // Head.
  const head = joint(torso, 0, 0.72, 0.01);
  const skull = mesh(ball(0.36), mats.skin, 0, 0.28, 0);
  skull.scale.set(1, 0.95, 0.95);
  head.add(skull);
  if (kid) {
    head.add(mesh(new THREE.SphereGeometry(0.375, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.hair, 0, 0.29, -0.02));
    head.add(mesh(new THREE.SphereGeometry(0.385, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.36), mats.cap, 0, 0.33, 0));
    head.add(mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.035, 12, 1, false, -Math.PI / 2, Math.PI).rotateX(0.12), mats.cap, 0, 0.44, 0.3));
    // A flower on the cap.
    const capFlower = joint(head, 0.2, 0.62, 0.02);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const p = mesh(ball(0.055), mats.petal, Math.cos(a) * 0.075, 0, Math.sin(a) * 0.075); p.scale.y = 0.45; capFlower.add(p); }
    capFlower.add(mesh(ball(0.05), mats.white));
    capFlower.rotation.z = -0.4;
  } else {
    // Muzzle and nose.
    const muzzle = mesh(ball(0.15), mats.muzzle, 0, 0.19, 0.27); muzzle.scale.set(1.15, 0.8, 0.75); head.add(muzzle);
    const nose = mesh(ball(0.04), mats.dark, 0, 0.245, 0.385); nose.scale.set(1.2, 0.8, 0.8); nose.castShadow = false; head.add(nose);
  }
  // Ears. The animals' ears sit on their own joints so they can bounce.
  const ears: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    if (kid) { const ear = mesh(ball(0.075), mats.skin, side * 0.34, 0.25, 0); ear.scale.x = 0.5; head.add(ear); }
    else if (who.kind === "fox") {
      const j = joint(head, side * 0.2, 0.52, -0.02); ears.push(j);
      j.add(mesh(new THREE.ConeGeometry(0.13, 0.3, 4).rotateY(Math.PI / 4), mats.skin, 0, 0.13, 0));
      j.add(mesh(new THREE.ConeGeometry(0.065, 0.13, 4).rotateY(Math.PI / 4), mats.accent, 0, 0.225, 0));
      j.rotation.z = -side * 0.28;
    } else if (who.kind === "bunny") {
      const j = joint(head, side * 0.14, 0.56, -0.03); ears.push(j);
      const outer = mesh(capsule(0.075, 0.38), mats.skin, 0, 0.24, 0); outer.scale.z = 0.6; j.add(outer);
      const inner = mesh(capsule(0.04, 0.3), mats.accent, 0, 0.24, 0.035); inner.scale.z = 0.4; inner.castShadow = false; j.add(inner);
      j.rotation.z = -side * 0.16;
    } else {
      const j = joint(head, side * 0.26, 0.55, -0.02); ears.push(j);
      const e = mesh(ball(0.12), mats.accent); e.scale.z = 0.6; j.add(e);
    }
    const blush = mesh(ball(0.065), mats.blush, side * 0.23, 0.2, 0.275); blush.scale.set(1, 0.6, 0.3); blush.castShadow = false; head.add(blush);
    if (who.kind === "panda") { const patch = mesh(ball(0.1), mats.accent, side * 0.14, 0.31, 0.275); patch.scale.set(0.95, 1.2, 0.5); patch.rotation.z = side * 0.35; patch.castShadow = false; head.add(patch); }
  }
  // Tail.
  let tail: THREE.Group | null = null;
  if (who.kind === "fox") {
    tail = joint(body, 0, 0.1, -0.2);
    const t1 = mesh(capsule(0.11, 0.3).rotateX(Math.PI / 2), mats.skin, 0, 0.05, -0.24); t1.scale.set(1, 1.1, 1); tail.add(t1);
    tail.add(mesh(ball(0.105), mats.muzzle, 0, 0.05, -0.47));
    tail.rotation.x = 0.5;
  } else if (who.kind === "bunny" || who.kind === "panda") {
    tail = joint(body, 0, 0.08, -0.27);
    tail.add(mesh(ball(who.kind === "bunny" ? 0.11 : 0.08), who.kind === "bunny" ? mats.muzzle : mats.accent));
  }
  const eyes: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = mesh(ball(0.058), who.kind === "panda" ? mats.white : mats.dark, side * 0.13, 0.31, 0.315); eye.scale.set(0.85, 1.15, 0.45); eye.castShadow = false; head.add(eye); eyes.push(eye);
    const glint = mesh(ball(who.kind === "panda" ? 0.024 : 0.02), mats.white, side * 0.13 + 0.018, 0.335, 0.343); glint.castShadow = false; head.add(glint);
  }
  const mouth = mesh(new THREE.TorusGeometry(kid ? 0.06 : 0.04, 0.016, 5, 10, Math.PI).rotateZ(Math.PI), mats.dark, 0, kid ? 0.2 : 0.165, kid ? 0.33 : 0.375);
  mouth.castShadow = false;
  head.add(mouth);

  // Arms: shoulder → upper arm → elbow → forearm and hand.
  const limb = (side: number) => {
    const shoulder = joint(torso, side * 0.31, 0.52, 0);
    shoulder.add(mesh(capsule(0.085, 0.2), mats.jacket, 0, -0.14, 0));
    const elbow = joint(shoulder, 0, -0.3, 0);
    elbow.add(mesh(capsule(0.072, 0.17), mats.limb, 0, -0.12, 0));
    elbow.add(mesh(ball(0.092), mats.limb, 0, -0.27, 0));
    const hip = joint(body, side * 0.14, 0.02, 0);
    hip.add(mesh(capsule(0.115, 0.2), mats.shorts, 0, -0.16, 0));
    const knee = joint(hip, 0, -0.36, 0);
    knee.add(mesh(capsule(0.085, 0.24), mats.limb, 0, -0.16, 0));
    knee.add(mesh(new THREE.BoxGeometry(0.18, 0.13, 0.34), mats.shoe, 0, -0.4, 0.06));
    knee.add(mesh(new THREE.BoxGeometry(0.19, 0.05, 0.36), mats.sole, 0, -0.475, 0.06));
    return { shoulder, elbow, hip, knee };
  };
  const L = limb(-1), R = limb(1);

  // Dizzy stars for a stumble.
  const dizzy = joint(root, 0, 2.05, 0);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const st = mesh(new THREE.OctahedronGeometry(0.09, 0), new THREE.MeshBasicMaterial({ color: 0xffd84a }), Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36); st.castShadow = false; dizzy.add(st); }
  dizzy.visible = false;

  const cur: Pose = { ...REST };
  const target: Pose = { ...REST };
  const set = (p: Partial<Pose>) => Object.assign(target, REST, p);
  let lastMood: Mood = "idle", moodTime = 0;

  return {
    root,
    pivot,
    setOutfit(index) {
      const o = OUTFITS[index] ?? OUTFITS[0];
      mats.jacket.color.set(o.jacket); mats.cap.color.set(o.cap); mats.pack.color.set(o.pack);
    },
    update({ mood, dt, time, distance, flip, trick, cheer, surge = 0, calm }) {
      if (mood !== lastMood) { lastMood = mood; moodTime = 0; } else moodTime += dt;
      const stride = distance * 2.35; // radians per unit of trail: about 2.8 steps a second at the starting speed
      const sw = Math.sin(stride), cw = Math.cos(stride);
      let ease = 16;
      // Whole-body turns for this frame: somersault (x), spin (y), cartwheel (z).
      let rollX = 0, spinY = 0, wheelZ = 0, turning = false;

      switch (mood) {
        case "run":
          set({
            hipL: -sw * 0.95 - 0.12, hipR: sw * 0.95 - 0.12,
            kneeL: 0.3 + Math.max(0, cw) * 1.25, kneeR: 0.3 + Math.max(0, -cw) * 1.25,
            armL: sw * 0.95, armR: -sw * 0.95, elbowL: -1.35, elbowR: -1.35, armOutL: 0.16, armOutR: 0.16,
            lean: 0.24, head: -0.14, lift: Math.abs(cw) * 0.07 - 0.03, tilt: sw * 0.045,
          });
          ease = 26;
          break;
        case "dash":
          // Full of energy: head down, chest forward, arms swept straight back, a long fast stride.
          set({
            hipL: -sw * 1.15 - 0.2, hipR: sw * 1.15 - 0.2,
            kneeL: 0.35 + Math.max(0, cw) * 1.45, kneeR: 0.35 + Math.max(0, -cw) * 1.45,
            armL: 1.25 + sw * 0.12, armR: 1.25 - sw * 0.12, elbowL: -0.12, elbowR: -0.12, armOutL: 0.42, armOutR: 0.42,
            lean: 0.62, head: -0.5, lift: Math.abs(cw) * 0.09 - 0.05, tilt: sw * 0.03,
          });
          ease = 28;
          break;
        case "slide":
          // Down on one hip, feet first, one arm trailing for balance.
          set({ hipL: -1.5, kneeL: 0.12, hipR: -1.25, kneeR: 0.75, armL: 0.9, armOutL: 0.55, elbowL: -0.3, armR: -0.5, armOutR: 0.9, elbowR: -0.5, lean: -0.95, head: 0.75, lift: -0.52, tilt: 0.1 });
          ease = 26;
          break;
        case "ready": {
          // On your marks: a low, coiled stance with a little bounce.
          const b = Math.sin(time * 9) * 0.03;
          set({ hipL: -1.05, kneeL: 1.25, hipR: 0.25, kneeR: 0.75, armL: 0.9, armR: -0.9, elbowL: -1.4, elbowR: -1.4, lean: 0.55, head: -0.4, lift: -0.2 + b });
          ease = 12;
          break;
        }
        case "rise":
          set({ hipL: -1.25, kneeL: 1.5, hipR: 0.4, kneeR: 0.55, armL: -2.5, armR: -2.1, armOutL: 0.35, armOutR: 0.35, elbowL: -0.35, elbowR: -0.5, lean: 0.12, head: -0.22, squash: 1.06 });
          ease = 20;
          break;
        case "fall":
          set({ hipL: -0.55, kneeL: 0.5, hipR: -0.2, kneeR: 0.75, armL: -1.2, armR: -1.2, armOutL: 1.0, armOutR: 1.0, elbowL: -0.3, elbowR: -0.3, lean: 0.05, head: 0.08 });
          ease = 12;
          break;
        case "flip": {
          const p = Math.max(0, flip), e = p * p * (3 - 2 * p);
          turning = true;
          ease = 24;
          if (trick === 1) {
            // Twister: a flat spin, arms wide, one knee tucked.
            spinY = e * Math.PI * 2;
            set({ hipL: -1.3, kneeL: 1.7, hipR: 0.1, kneeR: 0.2, armL: 0, armR: 0, armOutL: 1.5, armOutR: 1.5, elbowL: -0.1, elbowR: -0.1, lean: 0, head: -0.1 });
          } else if (trick === 2) {
            // Back layout: a long straight backward turn, arms overhead.
            rollX = -e * Math.PI * 2;
            set({ hipL: 0.15, hipR: 0.15, kneeL: 0.1, kneeR: 0.1, armL: -3.0, armR: -3.0, armOutL: 0.15, armOutR: 0.15, elbowL: -0.05, elbowR: -0.05, lean: -0.15, head: -0.3, squash: 1.08 });
          } else if (trick === 3) {
            // Cartwheel: a star shape turning sideways.
            wheelZ = e * Math.PI * 2;
            set({ hipL: 0, hipR: 0, kneeL: 0.05, kneeR: 0.05, legOut: 0.75, armL: -3.0, armR: -3.0, armOutL: 0.75, armOutR: 0.75, elbowL: -0.05, elbowR: -0.05, lean: 0, head: 0 });
          } else {
            // Front flip: a tight tucked somersault.
            rollX = e * Math.PI * 2;
            set({ hipL: -2.0, hipR: -2.0, kneeL: 2.25, kneeR: 2.25, armL: -1.3, armR: -1.3, armOutL: 0.1, armOutR: 0.1, elbowL: -1.9, elbowR: -1.9, lean: 0.55, head: 0.35 });
          }
          break;
        }
        case "land":
          set({ hipL: -0.9, hipR: -0.7, kneeL: 1.3, kneeR: 1.15, armL: 0.5, armR: 0.5, armOutL: 0.6, armOutR: 0.6, elbowL: -0.6, elbowR: -0.6, lean: 0.4, head: -0.2, lift: -0.2, squash: 0.9 });
          ease = 30;
          break;
        case "stumble": {
          if (moodTime < 0.28) {
            // The bonk: thrown back off the obstacle, arms windmilling.
            const t = moodTime / 0.28;
            set({ hipL: -1.2, kneeL: 0.3, hipR: 0.5, kneeR: 0.9, armL: -2.2 + Math.sin(time * 34) * 0.9, armR: -2.2 - Math.sin(time * 34) * 0.9, armOutL: 0.9, armOutR: 0.9, elbowL: -0.2, elbowR: -0.2, lean: -0.75, head: -0.4, lift: Math.sin(t * Math.PI) * 0.3, squash: 1.05 });
            ease = 30;
          } else {
            // Down on the seat, legs out, rubbing the head while the stars go round.
            const bump = Math.max(0, 1 - (moodTime - 0.28) / 0.18);
            set({ hipL: -1.5, hipR: -1.35, kneeL: 0.3, kneeR: 0.15, legOut: 0.25, armL: 0.9, armOutL: 0.5, elbowL: -0.3, armR: -2.3, armOutR: 0.25, elbowR: -2.1 + Math.sin(time * 16) * 0.2, lean: -0.3, head: 0.3 + Math.sin(time * 9) * 0.1, headTurn: Math.sin(time * 6) * 0.35, lift: -0.48 + bump * 0.1, squash: 1 - bump * 0.12 });
            ease = 18;
          }
          break;
        }
        case "drop":
          // Into a gap: a slow spin with everything flailing.
          spinY = calm ? 0 : moodTime * 7;
          turning = true;
          set({ hipL: Math.sin(time * 17) * 0.8, hipR: -Math.sin(time * 17) * 0.8, kneeL: 0.7, kneeR: 0.7, legOut: 0.3, armL: -2.7 + Math.sin(time * 21) * 0.4, armR: -2.7 - Math.sin(time * 21) * 0.4, armOutL: 0.6, armOutR: 0.6, elbowL: -0.2, elbowR: -0.2, lean: -0.2, head: -0.4, squash: 1.06 });
          ease = 18;
          break;
        case "shake": {
          // Back on the trail: shake it off, then a thumbs-up.
          const shaking = moodTime < 0.42;
          const s = shaking && !calm ? Math.sin(time * 42) : 0;
          set(shaking
            ? { kneeL: 0.25, kneeR: 0.25, armOutL: 0.5, armOutR: 0.5, elbowL: -0.4, elbowR: -0.4, turn: s * 0.22, headTurn: -s * 0.4, lift: -0.05, squash: 0.97 }
            : { hipL: -0.05, hipR: 0.05, kneeL: 0.08, kneeR: 0.08, armR: -1.7, armOutR: 0.25, elbowR: -1.1, armL: 0.1, lean: 0.03, head: -0.12, lift: Math.sin(time * 9) * 0.02 });
          ease = shaking ? 34 : 14;
          break;
        }
        case "skid":
          // Over the line: heels dug in, leaning back, arms out for balance.
          set({ hipL: -1.0, kneeL: 0.15, hipR: -0.55, kneeR: 0.35, armL: -0.4, armR: -0.4, armOutL: 1.25 + Math.sin(time * 15) * 0.12, armOutR: 1.25 - Math.sin(time * 15) * 0.12, elbowL: -0.2, elbowR: -0.2, lean: -0.38, head: 0.15, lift: -0.16 });
          ease = 12;
          break;
        case "victory": {
          const leap = 0.75;
          if (moodTime < leap) {
            // A big spinning leap, arms to the sky.
            const t = moodTime / leap, e = t * t * (3 - 2 * t);
            spinY = calm ? 0 : e * Math.PI * 2;
            turning = true;
            set({ hipL: -0.9, kneeL: 1.4, hipR: 0.2, kneeR: 0.9, armL: -3.0, armR: -3.0, armOutL: 0.45, armOutR: 0.45, elbowL: -0.05, elbowR: -0.05, head: -0.35, lift: Math.sin(t * Math.PI) * 0.95, squash: 1.07 });
            ease = 22;
          } else {
            // Then the dance: step side to side, pump one arm then the other, with a twirl every few bars.
            const beat = (moodTime - leap) * 5.4, s = Math.sin(beat), up = Math.abs(Math.sin(beat));
            const bar = ((moodTime - leap) % 4.4) / 4.4;
            if (!calm && bar > 0.82) { const t = (bar - 0.82) / 0.18; spinY = t * t * (3 - 2 * t) * Math.PI * 2; turning = true; }
            set({
              hipL: s > 0 ? -0.75 : -0.05, kneeL: s > 0 ? 1.0 : 0.15, hipR: s > 0 ? -0.05 : -0.75, kneeR: s > 0 ? 0.15 : 1.0,
              armL: s > 0 ? -2.85 : -0.9, armR: s > 0 ? -0.9 : -2.85, armOutL: 0.4, armOutR: 0.4, elbowL: s > 0 ? -0.2 : -1.5, elbowR: s > 0 ? -1.5 : -0.2,
              lean: -0.04, tilt: s * 0.12, head: -0.2, headTurn: s * 0.3, lift: up * 0.14, sway: calm ? 0 : s * 0.2, turn: calm ? 0 : s * 0.3,
            });
            ease = 15;
          }
          break;
        }
        default: {
          // Idle: breathe, glance about, wave, tap a foot.
          const wave = calm ? 0 : Math.max(0, Math.sin(time * 0.9 - 1.2)) ** 6;
          const tap = calm ? 0 : Math.max(0, Math.sin(time * 0.9 + 1.6)) ** 4 * Math.abs(Math.sin(time * 9));
          set({ hipL: -0.03 - tap * 0.35, hipR: 0.03, kneeL: 0.06 + tap * 0.5, kneeR: 0.06, armL: 0.06, armR: -2.6 * wave, armOutL: 0.14, armOutR: 0.14 + wave * (0.45 + Math.sin(time * 11) * 0.28), elbowL: -0.25, elbowR: -0.25 - wave * 0.5, lean: 0.02, head: Math.sin(time * 1.3) * 0.04, headTurn: Math.sin(time * 0.7) * 0.28, lift: Math.sin(time * 2.1) * 0.012, squash: 1 + Math.sin(time * 2.1) * 0.012 });
          ease = 9;
        }
      }

      // A fist pump over the run.
      if (cheer > 0 && (mood === "run" || mood === "land" || mood === "rise" || mood === "fall")) {
        target.armR = -2.9 + Math.sin(time * 22) * 0.22; target.armOutR = 0.3; target.elbowR = -0.25; target.head = -0.3;
      }

      const k = 1 - Math.exp(-ease * dt);
      for (const key of Object.keys(cur) as (keyof Pose)[]) cur[key] += (target[key] - cur[key]) * k;

      L.hip.rotation.set(cur.hipL, 0, -cur.legOut); R.hip.rotation.set(cur.hipR, 0, cur.legOut);
      L.knee.rotation.x = cur.kneeL; R.knee.rotation.x = cur.kneeR;
      L.shoulder.rotation.set(cur.armL, 0, -cur.armOutL); R.shoulder.rotation.set(cur.armR, 0, cur.armOutR);
      L.elbow.rotation.x = cur.elbowL; R.elbow.rotation.x = cur.elbowR;
      torso.rotation.x = cur.lean; torso.rotation.z = cur.tilt;
      head.rotation.set(cur.head, cur.headTurn, -cur.tilt * 0.6);
      body.position.set(cur.sway, cur.lift, 0);
      body.rotation.y = cur.turn;
      const swell = 1 + surge * 0.22;
      body.scale.set(swell / Math.sqrt(cur.squash), swell * cur.squash, swell / Math.sqrt(cur.squash));

      // Whole-body turns. A finished turn is a full circle, which is the same as none; an interrupted one unwinds quickly.
      if (turning) pivot.rotation.set(rollX, spinY, wheelZ);
      else {
        const unwind = (r: number) => { r = ((r + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return Math.abs(r) < 0.001 ? 0 : r * Math.exp(-22 * dt); };
        pivot.rotation.set(unwind(pivot.rotation.x), unwind(pivot.rotation.y), unwind(pivot.rotation.z));
      }

      // Scarf tail streams with speed and flutters.
      const moving = mood === "run" || mood === "dash" || mood === "slide" || mood === "rise" || mood === "fall" || mood === "flip" || mood === "skid";
      const flutter = calm ? 0 : Math.sin(time * 13) * 0.16;
      scarfA.rotation.x += ((moving ? 0.1 : -1.25) + flutter - scarfA.rotation.x) * Math.min(1, dt * 8);
      scarfB.rotation.x += ((moving ? 0.15 : -0.2) - flutter * 1.4 - scarfB.rotation.x) * Math.min(1, dt * 8);

      // Blink.
      const blink = (time % 3.4) < 0.11 || mood === "stumble" || (mood === "victory" && Math.sin(time * 5.4) > 0.6) ? 0.15 : 1.15;
      for (const eye of eyes) eye.scale.y += (blink - eye.scale.y) * Math.min(1, dt * 30);
      mouth.scale.setScalar(mood === "victory" || mood === "rise" || mood === "flip" || mood === "dash" ? 1.5 : mood === "stumble" || mood === "drop" ? 0.6 : 1);

      // Ears and tail carry a little secondary motion.
      const bounce = calm ? 0 : Math.sin(stride * 2) * (mood === "run" ? 0.09 : 0.02) + (mood === "rise" ? 0.25 : mood === "fall" ? -0.2 : 0);
      ears.forEach((e) => { e.rotation.x += (-bounce - e.rotation.x) * Math.min(1, dt * 14); });
      if (tail) { tail.rotation.y = calm ? 0 : Math.sin(time * (mood === "idle" ? 3 : 11)) * (mood === "idle" ? 0.25 : 0.4); }

      dizzy.visible = mood === "stumble";
      if (dizzy.visible) dizzy.rotation.y = time * 5;
    },
    dispose() {
      root.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh) me.geometry.dispose(); });
      for (const m of Object.values(mats)) m.dispose();
    },
  };
}

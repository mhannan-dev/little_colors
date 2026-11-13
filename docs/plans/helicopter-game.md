# Rumi's Helicopter (রুমির হেলিকপ্টার) — plan, adapted to this app

Status: proposal (2026-11-13). Source: a generic "Rust + Svelte + TS helicopter sim" outline, rewritten for
Rumi Learning Adventures (ages 3–6, offline Windows desktop, Tauri 2 + SvelteKit / Svelte 5, Bengali first).

## What changes from the generic plan, and why

| Generic plan | This app | Why |
|---|---|---|
| Realistic flight model: collective, cyclic, anti-torque pedals, throttle | **One-thumb flying**: hold ⬆ to rise, let go to float gently down; ◀ ▶ (or drag) to fly sideways; the helicopter levels itself | A 3–6-year-old can't manage four axes. Toy-like control matches the toy car, bike and highway games |
| Crashes, collisions, failure | **Nothing can crash** (child-never-loses rule, PR-07): the ground is a soft auto-landing, trees and hills gently nudge the helicopter up and around (same idea as `assistSpeed` in `core/highway`) | No fail state, no score, no timer, no tally |
| Cockpit HUD: altimeter, artificial horizon, airspeed and compass tapes | **Picture cues only**: a glowing landing pad, a hand that points, Rumi's voice. No numbers to read | Non-readers (PR-26). Big targets, spoken names |
| Missions: cargo, target tracking | **Kind helping jobs**: carry mangoes to the village, bring a kitten down from a tree, water a thirsty garden with a rain bucket, fly friends to the river island. Landing pads are **coloured and numbered** ("land on the blue 3 pad"), so the game also teaches | Learning plus kindness, the same as the train and farm games. Any order, always succeeds |
| Rust → WASM physics engine (`wasm-pack`, `cdylib`) | **TypeScript rules in `packages/core`** (pure, seeded, unit-tested), rendered with three.js via `toyKit`. Rust stays only in the Tauri shell | A toy flight model is about 100 lines of maths. WASM adds a build step and toolchain (`wasm-bindgen-cli` version pinning) and size; Formula Circuit's WASM is 87 MB. Every other game uses this TS core pattern |
| Bevy / Macroquad / Threlte | **three.js 0.187 via `toyKit`** (lazy-loaded), as all the other 3D games do | One renderer, shared HDRI sky, PBR grass, confetti, `createStage`, flat fallback when WebGL fails |
| Dynamic rotor audio from blade load | **Synthesized rotor "whup-whup"** in `game/toySounds.ts`: pitch rises gently while climbing, soft and never loud | Offline, no audio files, respects mute and volume settings |
| USB joystick / gamepad | Keyboard (arrows / space) + mouse / touch big buttons; **gamepad optional** (HTML5 Gamepad API) | Most children use the touchpad or touch screen |

## Game loop (one ride, about 3–5 minutes)

1. Rumi waves from the cockpit on the helipad; the rotor starts spinning ("ঘুর ঘুর!").
2. Rumi says a job: "আমগুলো গ্রামে নিয়ে যাই! নীল ৩ নম্বর প্যাডে নামি।" A glowing pad and a hand show where.
3. The child flies there. Flying past clouds, birds and balloons gives a sparkle (not points).
4. The helicopter comes near the pad → auto-hover → it lands softly by itself. Friends cheer; Rumi counts the
   cargo ("এক, দুই, তিন আম!").
5. Three or four jobs, then the home pad: a balloon party, then "আবার খেলি" or "অন্য খেলা".
6. Free-fly mode: no jobs, just fly over the village, river and tea hills.

## Architecture in this repo

- `packages/core/src/heli/heli.ts`: `HeliInput { up: boolean; x: -1|0|1 }`, `stepHeli(state, input, dt)` (gentle
  acceleration, auto-level, max height, soft ground), `assistAltitude` (rise over obstacles, never hit), `nearPad`,
  `createHeliDay(difficulty, seed)` (jobs, pad colours and numbers), `HELI_NARRATION` (keys `heli.*`, `mode.heli`),
  registered in `audio/catalog.ts` and exported from `index.ts`. Tests in `packages/core/tests/heli/`.
- `apps/desktop/src/lib/features/heli/HeliScene.svelte`: three.js scene, a code-built helicopter (rotor and tail
  rotor spin, Rumi in the cockpit), pads with `glyphTexture` numbers, the cargo hook, DOM overlay buttons (⬆ ◀ ▶,
  big, held with the pointer), `{#key canvasKey}` restart, flat fallback.
- Shared: reuse `three3d/animals.ts` for passengers and friends, the `toyKit` HDRI sky and PBR grass, and confetti.
  Add `rotor()` to `game/toySounds.ts`.
- Route `/helicopter`, picker card in the **🚗 গাড়ি চালাই** category (`group: 'drive'`).
- E2E: `tests/e2e/helicopter.spec.ts`: take off, fly to the pad (keyboard), auto-land, the job counts, all jobs
  lead to the party, and the helicopter can never get below the ground or into a tree (`data-min-clearance > 0`).

## Rules checklist (from GEMINI.md)

- No lose state, no score, no timer, no tally; every job succeeds (PR-07). Gentle "not yet" only (PR-08).
- Spoken instructions and idle prompts; a hint hand after quiet time (PR-22, PR-25).
- Pause stops everything; reduced motion: no camera shake, shorter tweens.
- Calm colours, no flashing (PR-06). Works offline. Narration status stays `placeholder` until voice recording.

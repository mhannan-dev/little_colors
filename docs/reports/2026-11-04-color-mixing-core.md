# Report: spec 05 — color-mixing core — 2026-11-04

## Scope and outcome

The shared core now follows the color-mixing transition table, including its
minimum result display time. This builds on the recipes, machine, curriculum,
and narration manifest already present from concurrent work. No app UI,
configuration, lockfile, or dependency was edited in this slice.

This is a core completion and integration handoff, not full Phase 2 acceptance.
App interaction, animation, audio, persistence, and E2E checks remain necessary.

## Changes

- Guard `RESULT_SHOWN` until 1,500 ms after entering `RESULT` (including clock
  value zero). Early events are ignored without notifications or effects.
- Expose `RESULT_DISPLAY_MS` and accept an optional injected clock.
- Make `reset()` and the `RESET` event both emit `cancelAll`, clear the current
  result/timestamp, and return to a white football.
- Snapshot setup so caller mutations do not change later resets.
- Emit a `mix` descriptor for unsupported pairs, allowing the animation driver to
  send `MIX_DONE` and reach the retry path instead of stalling in `MIXING`.
- Add transition-matrix, Advanced pair, lifecycle, and seeded curriculum tests.
  Existing tests now use the manual clock for the minimum result display time.

## Integration API

```ts
import { createMixingMachine, RESULT_DISPLAY_MS } from '@little-colors/core';

const machine = createMixingMachine(activity, gameplayClock);
const unsubscribe = machine.subscribe((state, context) => {
  // Render state/context. On entry to RESULT, schedule RESULT_SHOWN after
  // RESULT_DISPLAY_MS of active gameplay time.
});
const stopEffects = machine.onEffect((effect) => {
  // Execute pour/mix/celebrate effects and send their completion events.
  // Handle cancelAll by stopping animations, timers, and narration.
});
```

- `gameplayClock` needs only `now(): number`. It should freeze while the app is
  paused. The machine schedules no timers itself; the app still owns timers.
- The existing one-argument factory is preserved with a `Date.now()` default.
  This allows the concurrently written scene's pause-aware scheduler to remain
  compatible. Tests inject the manual clock; the compatibility test also mocks
  `Date.now()` with that clock, without real waits.
- `MixingContext.resultEnteredAt` is an additional timestamp field, `null` until
  a successful `MIX_DONE`. Reset, retry, and Next clear it.
- Unsupported mixes keep the current first color during the swirl (`from` and
  `to` are identical), then `MIX_DONE` resets to white and emits `mix.retry`.
  This avoids inventing an unsupported result while preserving the completion
  handshake and the existing `MixingEffect` shape.
- The `complete` effect is emitted once after celebration; this is the app's
  hook for recording progress. No persistence service was added here.
- `NEXT` emits `next`; the app loads the following round activity or completion
  screen. The machine never advances on its own.
- Stop subscriptions and cancel platform effects when leaving the scene. A
  completion event already in flight is ignored in an incompatible state, but
  cancellation is still required to prevent stale events after a new selection.
- The existing celebration descriptor is preserved; app handlers can narrate
  the celebration once, honoring the parent setting and neutral variants.

## Requirements

Statuses below describe this core slice; UI behavior is not marked complete
merely because the corresponding event or descriptor exists.

| ID | Status | Evidence / remaining work |
| --- | --- | --- |
| CM-01 | done | All three recipes, both orders, and every Advanced target/pair combination tested. |
| CM-02 | done | Order-independent pure mixing and gameplay tested. |
| CM-03 | done | Machine uses `mixColors`; no RGB averaging. |
| CM-04 | done | Unsupported/same-color pairs return null; unsupported gameplay retries. |
| CM-10 | done | Every state checked against all event types and offered/unoffered selection cases. |
| CM-11 | done in core | Selection ignored in pour/mix/result/celebration states; visual input locking needs UI verification. |
| CM-12 | done in core | Duplicate selections/completions/Next cannot cause duplicate progress or advancement. |
| CM-13 | partial | Reset emits cancellation and preserves defined colors; actual platform cancellation needs integration checks. |
| CM-14 | partial | Core progresses without audio acknowledgements; mute/audio failure in the scene still needs testing. |
| CM-15 | pending UI verification | Reduced-motion fade scheduling belongs to the app. |
| CM-16 | partial | Injected clock supports active gameplay time; pause/resume scheduler and animations need integration checks. |
| CM-20 | pending UI verification | Tap input is outside this slice. |
| CM-21 | pending UI verification | Drag/drop cancellation is outside this slice. |
| CM-22 | pending UI verification | Keyboard controls are outside this slice. |
| CM-23 | pending UI verification | Labels, patterns, and focus narration are outside this slice. |
| CM-30 | done in core | Repeated selections while pouring ignored in matrix tests. |
| CM-31 | pending UI verification | Pointer cancellation belongs to the app. |
| CM-32 | done in core | Unsupported pairs emit a completion path and retry; all distinct unsupported pairs retain defined colors. |
| CM-33 | partial | No dependency on successful audio; visible caption/failure fallback needs scene testing. |
| CM-34 | pending UI verification | Background pause/resume belongs to the app. |
| CM-35 | pending UI verification | Orientation/layout changes belong to the app. |
| CM-36 | done in core | Both reset APIs tested from all eight states, including cancellation. |
| CM-37 | pending UI verification | Navigation teardown and console checks remain. |

The color-mixing part of CP-01/CP-02 is also validated: all three difficulty
levels retain playable recipes and valid instruction keys across 1,000 seeds
each. Other modes and persisted progress are not covered by this slice.

## Files created / modified

- `packages/core/src/color-mixing/mixingMachine.ts`
- `packages/core/tests/color-mixing.test.ts`
- `packages/core/tests/color-mixing/regressions.test.ts`
- `packages/core/tests/color-mixing/transition-matrix.test.ts`
- This report.

## Verification

- Initial targeted regressions reproduced the timing, reset, setup isolation,
  and unsupported-animation completion gaps before fixes.
- `pnpm typecheck`: passed; desktop Svelte check reports 0 errors/warnings.
- `pnpm test`: passed; core 168 tests / 8 files, design tokens 4 tests / 1 file.
  Desktop has no tests and uses `--passWithNoTests`.
- `pnpm build`: passed; desktop frontend built with `adapter-static`. A native
  Tauri executable/installer build was not run.
- `pnpm lint`: unavailable (no root lint command).
- No browser/integration/E2E tests were run in this core-only slice; there is no
  app test directory or E2E command configured yet.

## Assumptions and limitations

No additional states or game rules were invented. The injected clock is
optional to preserve the concurrent UI caller. The app owns pause-aware timers,
animation completion, captions, narration, progress recording, and round
navigation. Recorded voices, content review, final art, and native installer
verification are not part of this change.

Next: integrate and exercise one complete Beginner round, including mute,
reduced motion, keyboard input, reset, pause/resume, and navigation teardown.

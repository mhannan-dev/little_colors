# Addition/Subtraction Car Adventure — 2026-11-05

## Outcome and scope

Implemented the requested addition/subtraction games inside Number Patterns,
with the user-selected car adventure theme. Open **Think & Play → সংখ্যার ধারা →
যোগের গাড়ি / বিয়োগের গাড়ি**. The hub card now mentions both games.

Each mode has six puzzles. A correct answer moves the illustrated car exactly
one stop; the puzzle holds until the child chooses Continue. After six stops,
the car reaches a garage with Rumi, a Beep Beep button and a new-route replay.
Wrong answers leave the car in place. No timers, penalties or racing pressure.

- Ages 5–7: complete equations within 0–10, with three choices.
- Ages 8–10: equations within 0–20, four choices, including two missing-right-
  operand puzzles per trip, such as `7 + ? = 12` or `14 − ? = 8`.
- Addition groups have touchable stars for counting marks. Subtraction shows a
  starting group; children cross out stars and see their crossed/remaining
  counts. Marks are optional working aids and never award progress themselves.
- Zero is supported explicitly. Each addition trip ends with adding zero;
  each subtraction trip ends with a zero-result puzzle. Empty star groups
  receive a text label. No generated equation requires a negative number.
- Clear Marks and help preserve the current stop. Switching operation starts
  a fresh trip. Returning preserves the previous number-pattern round/state.
- Launchers appear only in standalone Number Patterns, leaving picnic bridge
  progression and its existing counting rules untouched.

## Implementation

- `packages/core/src/numbers/lessons/arithmeticRally.ts`: deterministic, unique
  equations; answer choices; pure guarded progression and counting-mark reducer.
- `rallyNarration.ts`: bilingual placeholder instructions, labels, feedback and
  horn line, exported/merged through the existing owned numbers module.
- `apps/desktop/src/lib/features/thinking/ArithmeticRally.svelte`: mode choice,
  equation, star workbench, six-stop route, garage, focus and pause/narration.
- `RallyCar.svelte`: original SVG car, nested in the route illustration.
- `ThinkingScene.svelte`: Number Patterns launchers and an isolated rally branch;
  `lessons/narration.ts`: discoverable hub-card description.
- Core/browser tests and isolated thinking Playwright config include the games.

## Verification

- Initial `pnpm typecheck`: passed with 0 Svelte errors and 0 warnings.
- `pnpm exec vitest run --maxWorkers=1` in `packages/core`: **533 tests /
  24 files passed**. Eight new tests include 1,000 complete seeded trips for
  each age/operation pair (4,000 total), arithmetic bounds, zero cases, unique
  equations/choices, guarded stops, wrong/unknown answers, counting marks,
  hidden operand handling, reset/hints, immutable inputs and bilingual catalog.
- Full isolated browser command from `apps/desktop`:
  `pnpm exec playwright test --config playwright.thinking.config.ts --reporter=line --timeout=180000`.
  **47 passed, 1 failed**. All six new rally scenarios passed, covering four
  complete age/operation trips, zero answers, missing operands, per-answer car
  movement, horn/replay, counter toggling, wrong answers, hints/reset, mode
  switching and return to the same number pattern (including solved progress).
- Rally controls fit without horizontal overflow at 1280×800, 800×600 and
  360×640 with reduced motion. Inspected desktop addition and narrow subtraction
  screenshots for Bengali numerals, equation spacing, car/garage and controls.
- Existing failure: `thinking.spec.ts` mode-selection test expects the
  `.thinking-link` button to start inside the viewport at 800×600 on `/play`.
  The concurrent `/play` work now contains seven mode cards, pushing that link
  below the initial viewport. That page and `audio/voiceManifest.ts` have new
  changes outside this task, alongside football/car/flag/bird routes. No changes
  to that page or test assertion were made to conceal the failure.
- Browser checks used approved localhost/Edge access on isolated port 5175.
- Final `pnpm typecheck`: passed with 0 Svelte errors and 0 warnings.
- `pnpm build`: passed; static desktop frontend generated successfully.
- `git diff --check`: passed.

## Limits and requests

Trips are session-local. The car advances through arithmetic answers; this is
not a steering/racing simulation. Narration remains placeholder and uses the
existing device/audio behavior. No dependencies, shared settings/progress/
storage contracts, native installer, task-board edits or commits were added.

## Request for the homepage owner

Review the `/play` layout or intended scroll behavior after adding the new mode
cards. The existing minimum-desktop-size entry-point visibility check currently
fails there. Rally entry/exit and all requested arithmetic behavior passed.

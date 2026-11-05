# Treasure Hunt Adventure — 2026-11-05

## Outcome and scope

Implemented the requested Treasure Hunt Adventure in the previously authorized
Think & Play UI/core area. Open **Think & Play → গুপ্তধন খুঁজি / Find the treasure**.
The hub's age selection applies to the entire adventure.

Four child-controlled puzzles earn four chest keys:

1. Match picture clues by both color and shape, in order. Ages 5–7 have two
   clues among six gems; ages 8–10 have three among nine gems.
2. Observe six numbered hiding places, then choose when to hide the objects.
   Find two or three requested objects at their remembered locations. Hidden
   cells expose neither object labels nor token attributes. Look Again offers
   another observation without erasing earlier discoveries.
3. Collect all three gems of a target shape across different colors.
4. Complete an AB (younger) or AAB (older) repeating shape/color pattern.

Every solved puzzle holds until Next. All four keys unlock an explicit Open
button. The chest reveals Rumi wearing a banana hat, with an optional silly
reaction and a new-map replay. There are no timers or penalties. Wrong answers
preserve earlier discoveries; reset affects only the current unsolved puzzle.

## Implementation

- `packages/core/src/numbers/lessons/treasureAdventure.ts`: deterministic seeded
  plans and a pure reducer; guarded progression, clues, memory positions,
  sorting, pattern and chest rules.
- `treasureNarration.ts`: bilingual placeholder story, captions, instructions,
  help and finale text, merged/exported through the owned numbers module.
- `apps/desktop/src/lib/features/thinking/TreasureAdventure.svelte`: complete
  adventure, native button interactions, original SVG chest/banana, existing
  token art/mascot, narration, pause integration and responsive scroll layout.
- `ThinkingScene.svelte`: hub entry and isolated adventure branch. Existing
  picnic and creative playground flows remain available.
- Core tests and `treasure.spec.ts` cover generated plans, progression, retries,
  hidden memory data, full journeys, keyboard play and viewport reachability.
- The isolated thinking Playwright config includes the treasure suite.

## Verification

- All core tests: **506 tests / 20 files passed**, using
  `pnpm exec vitest run --maxWorkers=1` from `packages/core`.
- Seven new core tests include 1,000 generated maps for each age band,
  deterministic/solvable plans, complete journeys, guarded transitions,
  duplicate/invalid choices, peek/reset/hints and immutable inputs.
- Final `pnpm typecheck`: passed, with 0 Svelte errors and 0 warnings.
- Full isolated browser suite: **27 checks passed in one run** (1.6 minutes),
  including four new treasure scenarios and 23 picnic/playground/standalone
  regression scenarios. Command from `apps/desktop`:
  `pnpm exec playwright test --config playwright.thinking.config.ts --reporter=line --timeout=180000`.
  Browser verification used approved localhost/Edge access on port 5175.
- Both age bands completed the hunt muted, earned four keys, explicitly opened
  the chest, saw the banana hat, triggered the joke, replayed and returned to
  the hub. Checks also covered hidden token attributes, wrong choices, hints,
  keyboard selection, memory peek/reset and controls reachable without
  horizontal overflow at 1280×800, 800×600 and 360×640 with reduced motion.
- Visually inspected finale and narrow-screen screenshots for Bengali text,
  spacing, chest/hat art, control reachability and clipping.
- `pnpm build`: passed; static frontend generated successfully.
- `git diff --check`: passed.

## Limits and requests

The hunt is session-local. Leaving starts a fresh hunt on the next entry;
new-map replay uses another seed. No persistence/settings/progress contract,
dependency, central API or audio contract changed. Text remains placeholder
content under the existing review process. No native installer was rebuilt.

No requests for Claude; no task-board edit or commit was made.

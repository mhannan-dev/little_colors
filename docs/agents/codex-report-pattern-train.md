# Rumi’s Pattern Train — 2026-11-05

## Outcome and scope

Implemented Pattern Train as the next age-based learning adventure in the
previously authorized Think & Play UI/core area. Open **Think & Play → ট্রেনে চড়ি /
All aboard**. The hub's age choice applies to the journey.

1. Fill two missing carriage patterns. Ages 5–7 use a six-carriage AB pattern;
   ages 8–10 use a nine-carriage ABC pattern. The first repeating group is always
   fully visible. Gaps fill one at a time and completed gaps stay after retries.
2. Remember three or four shape passengers among six numbered seats. Children
   choose when to hide/reveal the arrangement. Hidden seats disclose neither
   passenger labels nor token attributes. Recovered passengers remain seated.
3. Guide the train around rocks to a station, using arrow buttons or keyboard.
   The route is a solvable 3×3 or 4×4 grid. Optional help outlines the next safe
   step from the current position.

The station finale shows Rumi wearing a ticket moustache, an optional funny
reaction, and new-train replay. Completed jobs hold until Continue. No timers,
penalties, scoring, forced moves or automatic story advance are introduced.

## Implementation

- `packages/core/src/numbers/lessons/patternTrain.ts`: seeded patterns/seats and
  existing solvable path generation wrapped in a guarded pure adventure reducer.
- `trainNarration.ts`: bilingual placeholder story, feedback, labels and hints;
  exported/merged through the owned numbers module.
- `apps/desktop/src/lib/features/thinking/PatternTrain.svelte`: responsive
  carriage, memory and route UI, accessible labels, keyboard/tap controls,
  captions, existing mascot, pause and focus integration.
- `TrainEngine.svelte`: original reusable SVG engine; no external image assets.
- `ThinkingScene.svelte`: hub entry and isolated adventure branch.
- `patternTrain.test.ts`, `train.spec.ts`, isolated thinking Playwright config.

## Verification

- `pnpm exec vitest run --maxWorkers=1` from `packages/core`: **519 tests /
  22 files passed**. Six new tests include 1,000 reproducible, complete generated
  train journeys per age band, inferable patterns, unique memory locations,
  reachable routes, progression guards, retries, peek/reset, hints, boundary
  movement, immutable inputs and bilingual narration.
- Final `pnpm typecheck`: passed, with 0 Svelte errors and 0 warnings.
- Full isolated browser suite: **35 checks passed in one run** (2 minutes),
  including four new train scenarios and 31 previous adventure/lesson checks.
  Command from `apps/desktop`:
  `pnpm exec playwright test --config playwright.thinking.config.ts --reporter=line --timeout=180000`.
  Used approved localhost/Edge access on isolated port 5175.
- Both age bands completed all puzzles muted, hid and recovered seats, used
  route hints and keyboard movement, triggered the joke, replayed and returned
  to the hub. Additional checks covered wrong choices, keyboard pattern entry,
  seat peek/reset and layouts/route controls without horizontal overflow at
  1280×800, 800×600 and 360×640 with reduced motion.
- Visually inspected the finale and narrow pattern screen for Bengali text,
  carriage order/numbering, train art, ticket overlay and clipping.
- `git diff --check`: passed.
- `pnpm build`: passed; static desktop frontend generated successfully.

## Limits and requests

Journeys are session-local. Exiting and reentering starts a new journey. No
shared settings, progress, storage, game mode or narration contract changed.
No dependencies or native installer build added. Copy remains placeholder under
the existing content-review process. No requests for Claude, shared task-board
changes, or commits.

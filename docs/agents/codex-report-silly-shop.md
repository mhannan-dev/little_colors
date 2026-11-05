# Rumi’s Silly Shop — 2026-11-05

## Outcome and scope

Implemented the approved Silly Shop extension in the previously authorized
Think & Play UI/core area. Open **Think & Play → দোকানে খেলি / Play shop**.
The hub's age choice applies to the trip.

Five jobs run at the child's pace:

1. Observe a picture shopping list, then hide it and add the requested items.
   Ages 5–7 remember two items, one each; ages 8–10 remember three item types
   with quantities of one or two. Look Again retains the current basket.
2. Sort four or five items onto Food or Other supplies shelves. Bottle, napkin
   and sock are supplies; apple and sandwich are food. Sorted items remain on
   their shelf while the next item appears.
3. Count apples. Younger children count one group; older children add two
   groups. Each apple can be marked/unmarked to support counting once.
4. Compare two unequal baskets and choose the one with more or fewer apples.
5. Spot the sock in Rumi's lunch. Choosing it removes it from the lunch tray.

After the last job, Rumi turns the sock into a puppet with an optional funny
reaction. New-customer replay generates another seeded trip. Each completed
job holds until Next; wrong choices preserve earlier work. No timers, penalties,
scores or automatic story advances are used.

## Implementation

- `packages/core/src/numbers/lessons/sillyShop.ts`: deterministic plans, item
  categories and pure guarded reducer for basket quantities, shelving,
  counting, comparison, progression and current-job resets.
- `shopNarration.ts`: bilingual placeholder narration, instructions and hints,
  merged/exported through the existing owned numbers module.
- `apps/desktop/src/lib/features/thinking/SillyShop.svelte`: responsive shop,
  original SVG sock puppet, existing food SVGs/mascot, captions/audio, pause
  integration, focus changes and keyboard/touch-friendly native buttons.
- `ThinkingScene.svelte`: hub entry and isolated shop branch.
- `sillyShop.test.ts`, `shop.spec.ts` and isolated thinking Playwright config
  cover the shop and retain existing adventure regression checks.

## Verification

- `pnpm typecheck`: passed, with 0 Svelte errors and 0 warnings.
- `pnpm exec vitest run --maxWorkers=1` in `packages/core`: **513 tests /
  21 files passed**. Seven new tests cover 1,000 generated complete shop trips
  for each age band, unique/reproducible plans, progression guards, wrong/extra
  choices, peek/reset/hints, immutable inputs and bilingual narration keys.
- Full isolated browser suite: **31 checks passed in one run** (2 minutes),
  including four new shop scenarios and 27 previous adventure/lesson checks.
  Command from `apps/desktop`:
  `pnpm exec playwright test --config playwright.thinking.config.ts --reporter=line --timeout=180000`.
  Used approved localhost/Edge access on isolated port 5175.
- Both age bands completed all jobs muted, marked an apple, removed the sock
  from lunch, triggered the puppet, replayed and returned to the hub. Additional
  checks covered wrong items, basket retention on peek, hidden list data,
  keyboard ordering, reset, and reachable controls without horizontal overflow
  at 1280×800, 800×600 and 360×640 with reduced motion.
- Visually inspected finale and narrow-screen screenshots for readable Bengali,
  spacing, controls and puppet artwork. Added explicit quantity labels to the
  comparison buttons for screen-reader access after the browser run.
- `git diff --check`: passed.
- Final `pnpm typecheck` after the accessibility-label change: passed with
  0 Svelte errors and 0 warnings.
- `pnpm build`: passed; static desktop frontend generated successfully.

## Limits and requests

Trips are session-local; returning to the hub and reentering starts a new trip.
Text remains placeholder under the existing content-review process. No shared
settings/progress/storage/API contract, dependencies or native installer changed.
No changes requested from Claude. No shared task-board edit or commit was made.

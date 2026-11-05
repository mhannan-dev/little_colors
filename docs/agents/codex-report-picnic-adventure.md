# Rumi’s Picnic Adventure — 2026-11-05

## Outcome and scope

Implemented the user-requested Picnic Adventure in the previously authorized
Think & Play UI/core area. The adventure connects four existing learning rules
into one story; standalone practice games remain available.

Launch with `pnpm dev`, then **Play → Think & Play → Rumi’s Picnic Adventure**.
The age-band choice on the hub applies to the entire adventure.

## What children do

1. **Pack the basket:** ages 5–7 find the sock among snacks; ages 8–10 compare
   apple groups. Solving packs food into the illustrated basket.
2. **Remember the list:** recall three or five picnic pictures (apple, sandwich,
   water bottle, napkin). Children choose when to hide the preview. Solving adds
   water and sandwiches to the picnic supplies.
3. **Repair the bridge:** find the next number in a concrete number/dot sequence.
   The selected correct number fills the missing plank, and the illustrated
   bridge becomes complete.
4. **Find the picnic spot:** move Rumi around rocks to the flag using buttons or
   keyboard arrows. Rumi reaches the picnic mat and the scene fills with food.

Each chapter has a short bilingual introduction and a separate Begin button.
Completing an activity holds on its result until the child chooses to continue.
The final picnic has explicit replay and return-to-lessons buttons and suggests
a break. There are no countdowns, points, penalties, streaks, or forced progress.

Rumi initially wears the basket as a silly hat. An optional, accessible button
puts it back on the ground, with a warm narration line. This visual interaction
does not advance the lesson or affect learning progress.

## Implementation

- Core `createPicnicAdventure` generates a seeded, age-banded plan with four
  fixed chapter kinds. `picnicReducer` owns story phase, current lesson progress,
  completed chapters, and the repaired bridge number.
- A chapter cannot be skipped or completed by a hint/reset. Duplicate progress
  events after success are ignored. Resetting the current unsolved lesson keeps
  already completed chapters and packed supplies.
- `ThinkingToken.picture` is optional, preserving existing geometric tokens.
  Food icons are original SVGs; no generated raster assets or dependencies added.
- `PicnicScene.svelte` uses the existing Rumi mascot, native SVG scenery, and
  design tokens. Its basket/supplies/bridge/mat reflect completed core chapters.
  CSS movement respects reduced motion and disappears on scene teardown.
- Story text and picture names are in the owned `PICNIC_NARRATION` array, merged
  through the existing numbers narration module. No central narration contract,
  shared game mode, settings schema, progress schema, or machine helper changed.
- ThinkingScene reuses the existing exercise renderer for both practice and
  adventures. New scenes reset scroll position and focus the heading. A scoped
  narrow-screen header layout keeps long captions from collapsing the game area.

## Files created / modified

- `packages/core/src/numbers/lessons/picnicAdventure.ts` (new)
- `packages/core/src/numbers/lessons/picnicNarration.ts` (new)
- `packages/core/src/numbers/lessons/thinkingLessons.ts` (optional picture type)
- `packages/core/src/numbers/{index,narration}.ts` (additive exports/catalog)
- `packages/core/tests/numbers/picnicAdventure.test.ts` (new)
- `apps/desktop/src/lib/features/thinking/PicnicScene.svelte` (new)
- `apps/desktop/src/lib/features/thinking/{ThinkingScene,ThinkingToken}.svelte`
- `apps/desktop/tests/e2e/picnic.spec.ts` (new)
- `apps/desktop/tests/e2e/thinking.spec.ts` (precise container selector)
- `apps/desktop/playwright.thinking.config.ts` (includes the adventure suite)
- This report.

## Verification

- New core suite: **8 tests passed**, including 1,000 generated adventures for
  each age band, valid chapter narration, unique picture choices, progression
  guards, current-lesson reset, replay, and immutable prior state.
- `pnpm test`: **484 core tests / 18 files plus 4 design-token tests passed**.
  Desktop's source unit command still has no component unit test files.
- Final `pnpm typecheck`: **passed**, with 0 Svelte errors and 0 warnings.
- Browser command from `apps/desktop`:
  `pnpm exec playwright test --config playwright.thinking.config.ts --reporter=line`.
  Both complete age-band adventures, the basket-preserving reset/hint case, and
  all standalone interaction flows passed (**13 checks**). Two layout checks
  found a broad CSS selector in the test and a real narrow-screen header issue.
  The selector and scoped header were corrected. Targeted rerun with
  `--grep "viewports|picnic stories"`: **2 checks passed**. All **15 distinct
  browser scenarios** are verified across those runs; no clean single-run
  15-test result is claimed.
- Browser coverage includes muted progression, ordered chapter introductions,
  the optional hat interaction, visible basket/supply/bridge changes, the filled
  bridge number, Rumi's path, finale, replay, reset/hints, keyboard answers and
  movement, reduced motion, and reachable controls at 1280×800, 800×600, 360×640.
- Intro/hub screenshots were visually inspected for readable Bengali text,
  artwork placement, button sizes, and clipping. Browser runs used approved
  localhost/Edge access outside the restricted socket sandbox, on isolated 5175.
- `pnpm build`: **passed**; the static desktop frontend was produced successfully.

## Limits and integration notes

The short adventure is session-local, like standalone Think & Play. Leaving or
reloading starts fresh; no new persisted schema or automatic difficulty change
was introduced. Story text/voice remains placeholder copy pending the existing
content-review process. The existing audio manager provides caption/fallback
behavior, and gameplay never waits for speech to finish.

No native installer or release-content approval is claimed. Existing installed
executables need a new `pnpm build:desktop` build to include source updates.
The shared task board and other agents' app features were not modified.

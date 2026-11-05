# Creative Picnic Playground — 2026-11-05

## Outcome and scope

Implemented the user-approved creative extension in the Think & Play UI and
numbers core. Open **Think & Play → সাজিয়ে খেলি / Creative Picnic Playground**, or
choose it from the completed picnic. Returning preserves the picnic finale.
The user's earlier authorization covers this feature's UI and core work.

Children can place picnic items or colored shapes on a 4×4 mat, switch to a
shape garden, and change flower/cat examples into their own pictures. Mouse
dragging, touch taps, keyboard placement and arrow-key movement are supported.
Items can move, swap, turn, and be removed. Clear and templates are undoable;
the board retains up to 50 undo steps. Placement never overwrites an item.

Children can also build a 4-item (ages 5–7) or 6-item (ages 8–10) sequence and
invite Rumi or a grown-up to copy it. Rumi places one item per explicit button
press. Copying together offers gentle retries without losing earlier matches.
Tapping Rumi cycles a wave and silly sandwich/napkin hats.

## Implementation

- Pure immutable reducer, stamps, templates, spatial movement and pattern rules
  in `packages/core/src/numbers/lessons/creativePlayground.ts`.
- Bilingual placeholder text in `playgroundNarration.ts`, merged through the
  existing numbers narration catalog and exported from the owned module.
- `CreativePlayground.svelte` uses existing token SVGs, mascot, settings,
  narration and pause behavior. No dependencies or shared schemas changed.
- `ThinkingScene.svelte` owns the session draft and exposes both entry points.
  A stable caption area prevents drop targets from moving during narration.
- Browser coverage in `playground.spec.ts`; picnic journey tests also verify
  entering the playground and returning to the same finale. The isolated
  thinking Playwright config includes the new suite.

## Verification

- `pnpm typecheck`: passed, including 0 Svelte errors and 0 warnings.
- New playground core suite: 15 tests passed, including bounds, occupied cells,
  swapping, undo, immutable history, templates, age limits, copying, narration,
  and 1,000 seeded edit histories.
- Initial `pnpm test`: 496 core tests passed; three existing seeded catalog/color
  tests exceeded their 5-second limits during concurrent checks. Design-token
  tests passed (4). Reran all core tests with
  `pnpm exec vitest run --maxWorkers=1`: **499 tests / 19 files passed**.
- `pnpm build`: passed; static desktop frontend produced successfully.
- Final browser command from `apps/desktop`:
  `pnpm exec playwright test --config playwright.thinking.config.ts --reporter=line --timeout=180000`.
  **All 23 checks passed in one run**, including 8 new playground scenarios,
  both complete picnic journeys and existing standalone lesson regressions.
  The longer limit followed an earlier concurrent run that timed out during
  a picnic journey. No test assertions were removed or changed to hide it.
- Browser coverage includes tap, touch, drag/drop, outside-drop cancellation,
  keyboard placement/movement, rotation/removal/undo, session draft retention,
  both pattern-copy modes, template edits, funny Rumi reactions and reachable
  controls without horizontal overflow at 1280×800, 800×600 and 360×640.
- Visually inspected the final flower and completed six-item pattern screenshots
  for readable Bengali text, icon placement, spacing and control sizes.
  Browser runs used approved localhost/Edge access on isolated port 5175.

## Limits and requests

Creations survive leaving/reopening the playground during the same scene, but
are not persisted across reloads. No timer, scoring, automatic animation loop,
new progress/settings schema, asset dependency, or installer rebuild was added.
Narration remains placeholder content under the existing review process.

No changes requested from Claude. The shared task board and other app features
remain outside this task; no commit was made.

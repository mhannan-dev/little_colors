# Think & Play — additional lessons for ages 5–10

## User-authorized scope

The user requested more lessons for ages 5–10 for attention and analytical
practice, then explicitly authorized Codex to implement both the new UI and core
despite the normal UI ownership split. Existing games and shared contracts were
preserved. This feature supplements the original younger-child curriculum.

## Implemented lessons

| Lesson | Ages 5–7 | Ages 8–10 | Practice |
| --- | --- | --- | --- |
| Spot the difference | Four choices; compare shape or small quantities | Six choices; larger groups | Careful observation and comparison |
| Remember the order | Three symbols to recall | Five symbols; four distinct choices | Sequence recall |
| Number detectives | Increasing sequences within 10, with dots | Larger steps and choices within 20, with dots | Finding and applying a rule |
| Find a path | 3×3 grid, two obstacles | 4×4 grid, up to five obstacles | Planning and spatial reasoning |

Every generator is seeded. Grids are checked for a route before an obstacle is
kept. Memory sequences include at least two different symbols; shape and color
both distinguish the choices. Number choices show concrete dots. Each short round
contains three activities, with explicit Next and completion screens.

Children choose when to hide the memory preview; no countdowns, pressure timers,
points, penalties, or leaderboards were added. Wrong choices produce gentle
feedback without discarding earlier recall. Clues unlock after two attempts and
never submit an answer automatically. The route has touch-friendly arrow buttons
and keyboard arrows, with grid roles, cell descriptions, and active-cell tracking.

## Navigation

Run `pnpm dev`, choose Play, then **চিন্তা আর খেলা / Think & Play**. Pick the
5–7 or 8–10 lesson band, then one of the four cards. Direct development route:
`/thinking`.

The play screen entry and compact-height layout were updated so the new entry
also fits the minimum 800×600 desktop window. The new route scrolls internally
when needed instead of clipping controls on narrow/short displays.

## Files

- `packages/core/src/numbers/lessons/{thinkingLessons,narration}.ts`
- `packages/core/src/numbers/{index,narration}.ts` — additive exports/catalog entries
- `packages/core/tests/numbers/thinkingLessons.test.ts`
- `apps/desktop/src/lib/features/thinking/{ThinkingScene,ThinkingToken}.svelte`
- `apps/desktop/src/routes/thinking/+page.svelte`
- `apps/desktop/src/routes/play/+page.svelte` — entry and small-window fit
- `apps/desktop/tests/e2e/thinking.spec.ts`
- `apps/desktop/playwright.thinking.config.ts` — isolated test server on port 5175 and separate artifacts folder
- This report.

No shared `GameMode`, settings/progress schema, machine helper, package, lockfile,
or existing lesson rule was changed. Narration is added through the owned numbers
array, which the app catalog already imports. Bengali/English text remains
placeholder copy pending the usual content review.

## Verification

- New unit suite: **19 tests passed**, including 1,000 seeds for every kind in
  each age band (8,000 generated-lesson invariant cases).
- `pnpm test`: **476 core tests + 4 design-token tests passed**. The desktop's
  source unit command has no component test files; the UI is tested via Playwright.
- `pnpm typecheck`: passed, **0 errors and 0 Svelte warnings** after grid
  accessibility adjustments.
- `pnpm build`: passed; static desktop frontend produced successfully. Native
  Windows installer was not rebuilt in this task.
- `pnpm exec playwright test --config playwright.thinking.config.ts --reporter=line`
  from `apps/desktop`: **11 browser tests passed** in Edge. Covers three-lesson
  rounds for all four kinds in both age bands; mute, keyboard path movement,
  Enter-to-answer, hint gating/reset, reduced motion, and layouts at 1280×800,
  800×600, and 360×640. No browser page errors in the round-completion tests.
- Hub and planning screenshots were visually inspected: readable Bengali text,
  consistent tokens, large controls, and no clipped content at the desktop size.
- Local socket access was blocked inside the sandbox; browser verification ran
  with approved localhost/Edge access outside it. Test servers/processes from
  the unsuccessful attempts were stopped.

## Integration notes / remaining scope

- This is a standalone lesson module under the existing core package; the UI
  delegates answer validation, recall state, path movement, hints, and reset to
  pure core functions. Rendering does not calculate correct answers.
- New rounds and age-band selection are session-local. They are not inserted
  into the frozen three-mode progress schema or automatic difficulty system.
  Extending persisted reporting for this new lesson collection can be a separate
  migration after agreement with the owner of central integration.
- Audio uses the existing caption/fallback manager and stops on background or
  navigation. Gameplay has no dependency on audio completion.
- The existing installed Windows setup executable is not rebuilt automatically
  by source edits. Development uses `pnpm dev`; a refreshed installer requires
  `pnpm build:desktop`.

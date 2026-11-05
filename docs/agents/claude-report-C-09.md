# Report: C-09 — Complete the game (Football, Garage, Birds + finish flag game) — 2026-11-05

## Context

GitHub Copilot had added mode cards for **ফুটবল / গাড়ি / পাখি** that only opened a "coming soon" placeholder, and was midway through rewriting the flag game when its requests started failing (DNS error). The user asked Claude to complete the game.

## New mini-games

Rules live in `packages/core/src/minigames/` (one shared "choose one" machine plus three seeded generators); the UI is a single `MiniGameScene.svelte` that draws each game's playfield.

| Game | Activity | Beginner | Explorer | Advanced |
|---|---|---|---|---|
| Football | Kick the ball into the named goal | color goal, 2 choices | color goal, 3 choices | numbered goal 1–5 |
| Garage | Park the car in the right garage | same color, 2 garages | same color, 3 garages | garage number = passenger count |
| Birds | How many birds on the branch? | count 1–5, 2 choices | count 1–10, 3 choices | two branches added, sum ≤ 10 |

All follow the product rules: 5-activity rounds, no timers or scores, gentle retry on a wrong choice (PR-08), hint after two misses (PR-22), child-initiated Next (PR-23), captions for every line, and color always paired with a shape or label (PR-24). No subtraction (NC-02).

## Finishing Copilot's flag rewrite

The new `FlagWorld.svelte` was complete in code. Its tests failed because of test setup, not the game:

1. The first page load in dev mode (249 SVGs + country JSON) exceeds Playwright's 5 s default → `expect.timeout` raised to 15 s in `playwright.config.ts`.
2. A test hard-coded `http://127.0.0.1:5176`, a port from a config that was never created → now compares against the page's own origin.
3. `flagGame.test.ts` uses `node:fs` → added `@types/node` as a desktop dev dependency.

The holy-puzzle viewport failure was the same cold-load timeout.

## Other fixes

- Core: `vitest.config.ts` with `testTimeout: 60 s`. Copilot's arithmetic-rally property tests (1,000 seeds) passed alone but timed out in the full parallel run.
- Desktop settings store: added `reducedMotion` (defaults to the OS preference), which the flag game expected.
- Birds screen: the scene's `birds` class collided with the bird-grid class and broke the layout; renamed the grid to `.flock`.

## Commands run

- `pnpm test`: core **549 passed** (25 files), design-tokens 4, desktop unit 7
- `pnpm typecheck`: **0 errors, 0 warnings** (435 files)
- `npx playwright test e2e`: **72 passed** (all suites, including every Copilot game)
- `pnpm --filter desktop build`: OK (2.9 MB)
- Gallery: `docs/ui/22..27-*.png`

## Known limitations / open items for the user

- Difficulty is still fixed at Beginner in the UI until parent settings (C-06); Explorer/Advanced are covered by core tests only.
- **Copilot's games have no specs** in `docs/specs/` and several target ages 5–10, outside the spec's 3–6 audience. Worth a decision.
- **"মসজিদ ও কাবার পাজল" (holy-puzzle)** uses religious imagery; spec 08 requires human content review before release (AU-42, SM-02). Not reviewed.
- The flag game uses third-party data (flag-icons, Unicode CLDR); licenses are bundled in `features/flag/licenses/` but not yet listed in `docs/asset-licenses.md`.
- Mascot, art, and audio remain placeholders.

# All-country flags and animated hints — 2026-11-05

## Outcome and scope

Implemented the user-requested flag expansion and animated correct-answer hints
in the existing Country Flag game. The user's explicit flag feature request
authorizes these UI changes. Open **Play → দেশের পতাকা / Country Flag**.

- Replaced the six simplified inline flags with **249 ISO country/territory
  entries**. The collection includes sovereign countries and territories; it
  does not describe all 249 as sovereign states.
- Every flag is bundled for offline display, with Bengali and English names.
- Explore All Flags includes bilingual/code search, continent filters, a larger
  preview and a way to start playing with any selected flag.
- The quiz uses a seeded shuffle with no repeated entry within a deck. Choices
  stay stable during retries/hints; identical or very similar flag families are
  not distractors for one another. Every entry remains playable.
- Manual Help or two wrong choices show the correct answer with a matching flag
  thumbnail, dashed border, arrow and three gentle pulse cycles. Reduced motion
  uses a static hint; background pause stops animation. A hint never submits an
  answer or awards recognition.
- Wrong choices preserve the current flag. Correct choices hold until Next;
  skipping does not award recognition. Recognized entries are counted uniquely,
  even when replaying one. Removed the prior 1.2-second forced transition so
  children have time to read the hint and answer.

## Data, artwork and attribution

- `flag-icons` **7.6.0**, MIT: https://github.com/lipis/flag-icons
- Unicode `cldr-localenames-full` **49.0.0**, Unicode License V3 data:
  https://github.com/unicode-org/cldr-json
- Downloaded only the pinned public npm archives; verified their SHA-512
  integrity and read files without installing/executing package code.
- `vendor_flags.py` reproduces 249 SVGs, `countries.json`, notices and
  `sources.json`. It validates SVGs, rejects active/external references and
  refuses to replace differing generated files. Artwork totals 1,637,404 bytes.
- Full original license notices are included in source and expandable in-app
  credits, so they are present in the production bundle.
- SVGs use external image elements / bundled data URLs and `object-fit: contain`;
  nonrectangular flags such as Nepal are not stretched. No raw SVG HTML injection.
- See `apps/desktop/src/lib/features/flag/DATA-SOURCES.md` for provenance.

## Files and integration

- Existing `FlagScene.svelte` is now a small wrapper around `FlagWorld.svelte`.
- `flagGame.ts`: pure data/search/deck/choice/progression logic.
- `flagAssets.ts`: Vite URLs for all local SVGs.
- `countries.json`, `flags/`, `licenses/`, `sources.json`, `vendor_flags.py`.
- `flagGame.test.ts`, `tests/e2e/flagWorld.spec.ts` and a dedicated
  `playwright.flags.config.ts` using port 5176. Test output is isolated at root
  `test-results/flag-codex` to avoid another suite clearing its screenshots.
- The existing `flag.spec.ts` assertions were retained. No shared contracts,
  dependency manifests, lockfile or other agents' unrelated screens changed.

## Verification

- Desktop unit suite: **7 tests passed**, validating all 249 assets/names/notices,
  all-country playable choices, full nonrepeating decks, stable distractors,
  hint/skip/progression guards, unique recognition and searches/regions.
- Monorepo unit command: `pnpm -r test --maxWorkers=1 --testTimeout=60000`:
  **549 core + 4 design-token + 7 desktop tests passed**. Concurrent project work
  added core tests since the preceding arithmetic report.
- Flag browser command from `apps/desktop`:
  `pnpm exec playwright test --config playwright.flags.config.ts --reporter=line --timeout=120000`.
  Six checks passed in a clean run, including all 249 image loads without a
  remote image source, search/practice, stable retry choices, manual/automatic
  hints, bounded animation, static reduced-motion hints, keyboard answers,
  continent filters and long-name/narrow layout reachability.
- Initial browser checks exposed test assumptions about bundled data URLs and
  Svelte-prefixed keyframe names. The checks were corrected to validate those
  actual bundling behaviors; no gameplay assertions were removed.
- Final isolated rerun: **all six browser checks passed** (47.1 seconds). The
  first screenshot-retention rerun hit a server startup timeout under concurrent
  workspace load; the final run used a 120-second server readiness limit.
- Visually inspected the hint, search/preview and long-name screenshots. The
  existing desktop shell scales the entire app at narrow widths; the 360px
  check verifies reachability/overflow, not a separate mobile typography design.
- Final `pnpm typecheck`: passed with 0 Svelte errors and 0 warnings. A test-only
  Node filesystem type dependency was replaced with Vite raw asset imports,
  keeping dependency/config manifests unchanged. Desktop unit rerun: 7 passed.
- `git diff --check`: passed.
- `pnpm build`: passed; all flag images and license notices are bundled in the
  generated static desktop frontend. No native installer rebuild was requested.

## Limits and requests

Learning/recognition is session-local. Data/artwork is a pinned upstream
snapshot, not a live geopolitical feed. No native installer was rebuilt.
No task-board edit or commit; no changes requested from Claude.

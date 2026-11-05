# Bangladesh familiar and popular fruits — 2026-11-05

## Outcome and scope

Implemented the requested fruit game. The user clarified that Bangladesh means
Bangladesh's familiar fruits in this game, rather than a separate geography game.
Open **Play → ফল চিনি / Fruit Garden**; the new route is `/fruit`.

The learning collection contains 12 original illustrated fruit entries:
Mango, Jackfruit, Banana, Guava, Lychee, Papaya, Pineapple, Watermelon, Apple,
Orange, Grapes and Strawberry. All have Bengali/English names and optional name
narration through the existing audio manager. An eight-fruit Bangladesh-familiar
collection is a curated set of examples, not an assertion about botanical origin
or an exhaustive classification of fruit familiar in Bangladesh.

Children can explore every fruit, then play six rounds combining picture-to-name,
name-to-picture and picture-counting tasks. Younger children get three choices
and 1–5 pictures; older children get four choices and 3–10 pictures. Targets do
not repeat within a six-round trip. The familiar collection also constrains all
picture distractors to its eight entries.

Correct answers add one fruit picture to Rumi's basket and hold until Next.
Wrong answers preserve the basket. Counting marks and hints never award fruit;
reset affects only the current round's marks/hint. The finale shows Rumi treating
a banana as a phone, with an optional joke, replay and return to learning.
There are no timers, penalties or scoring races.

Counting instructions explicitly count **pictures**, so a grape bunch or a
whole/cut illustration is one marked picture, not an ambiguous number of
physical fruits.

## Implementation

- `packages/core/src/numbers/lessons/fruitLearning.ts`: bilingual dataset,
  curated pools, age-based seeded questions and pure guarded progress reducer.
- `fruitNarration.ts`: placeholder UI, mode label, fruit names and feedback,
  exported/merged through the owned numbers narration module.
- `apps/desktop/src/lib/features/fruits/FruitPicture.svelte`: 12 original SVGs;
  no emoji fallback, external images, network services or new dependencies.
- `FruitGarden.svelte`: learning preview, collections, age choices, games,
  counting marks, basket, hints, narration, pause/focus and reduced motion.
- `routes/fruit/+page.svelte` and an additive main-menu mode/card branch.
- Core tests, `tests/e2e/fruits.spec.ts`, and isolated `playwright.fruits.config.ts`
  on port 5177; screenshots at root `test-results/fruit-codex`.

## Verification

- Targeted core suite: **8 tests passed**, including 1,000 complete generated
  games for each age/pool combination (4,000 total), full fruit coverage,
  unique options/targets, counting bounds, progression guards, retries,
  marks/reset, basket retention, immutable inputs and catalog entries.
- Browser suite: **all 6 checks passed in one run** (36.4 seconds). Every fruit
  preview rendered nonempty SVG art and both names; the familiar filter showed
  eight entries. Both full six-round games ran muted, filled the basket, showed
  the banana-phone joke and replayed cleanly. Other checks covered keyboard
  marks, wrong answers, hints/reset, existing Play-menu entry and reachable
  controls without overflow at 1280×800, 800×600 and 360×640 with reduced motion.
- Visually inspected the full fruit collection and basket/joke finale for SVG
  recognizability, names, spacing, colors and clipping.
- `pnpm -r test --maxWorkers=1 --testTimeout=60000`: **558 core, 4 design-token
  and 7 desktop tests passed**. Another agent added an audio test concurrently;
  no edits to that agent's audio implementation/tests were made here.
- Final `pnpm typecheck`: passed with 0 Svelte errors and 0 warnings. Corrected
  an explicit count-branch type guard and a union-typed test Set during checking;
  no runtime test assertions were removed.
- Final copy clarifies picture counting, and switching away from a selected
  noncollection fruit refreshes the fallback fruit's name narration.
- `git diff --check`: passed.
- `pnpm build`: passed; the static desktop frontend includes the new `/fruit`
  route, all original SVG artwork and narration text. No installer rebuild.

## Limits and requests

Progress is session-local. Name audio follows the existing placeholder speech /
caption fallback. No nutrition, health or botanical-origin claims are added.
No shared settings/storage/audio contracts, dependency manifests, native installer,
task-board changes or commits. No changes requested from Claude.

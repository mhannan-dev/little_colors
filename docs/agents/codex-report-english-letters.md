# Rumi’s English Letter Play — 2026-11-05

## Outcome and scope

Implemented the requested English letter play-and-learn feature in the
previously authorized Think & Play UI/core area. Open **Think & Play → ইংরেজি
অক্ষর শিখি / Learn English letters**. A–Z is available to both age groups.

- Explore all 26 capital/lowercase pairs with English picture words, previous /
  next buttons, direct letter selection and optional English listening.
- Six-round play sessions include capital/lowercase matching, a missing letter
  in an alphabet sequence, and picture-word activities (two rounds of each).
- Ages 5–7 get three choices, shorter alphabet sequences and first-letter
  word clues. Ages 8–10 get five choices, longer sequences, reverse case
  matching and three-letter spelling with Cat, Dog, Hat and Sun.
- Spelling builds one letter at a time. Wrong choices preserve correct letters.
  Hints outline the next answer; resets affect the current question only.
- Each correct answer holds until Next. A playful B-glasses finale, replay
  and a return to A–Z are available. No timer, scores or penalties added.

## Implementation

- `packages/core/src/numbers/lessons/englishLetters.ts`: alphabet vocabulary,
  seeded six-question plans, instructions and pure guarded progress reducer.
- `letterNarration.ts`: bilingual placeholder UI/feedback, merged/exported
  through the existing numbers module; English letters and words stay English
  regardless of the UI language.
- `apps/desktop/src/lib/features/thinking/EnglishLetters.svelte`: learning and
  game screens, native keyboard/tap buttons, responsive layouts, focus changes,
  captions, mute/pause integration and existing Rumi mascot.
- `AlphabetPicture.svelte`: device emoji illustrations with accessible English
  names, plus original SVG xylophone and yo-yo illustrations.
- English listening reuses the existing desktop speech adapter with `en-US`
  explicitly. Missing English voices show a notice and never block gameplay.
  Request generations prevent a pending speech availability check from starting
  after mute, pause, another action, or teardown. No new service or API needed.
- `ThinkingScene.svelte`: prominent hub entry and isolated feature branch.
- Core/browser tests and isolated thinking Playwright config include the feature.

## Verification

- Initial `pnpm typecheck`: passed with 0 Svelte errors and 0 warnings.
- `pnpm exec vitest run --maxWorkers=1` in `packages/core`: **525 tests /
  23 files passed**. Six new tests cover the A–Z vocabulary, 1,000 complete
  generated games per age band, all-letter target coverage, correct/unique
  choices, case sensitivity, sequence bounds, retries, reset, guarded Next,
  immutable inputs and bilingual narration keys.
- Full isolated browser command from `apps/desktop`:
  `pnpm exec playwright test --config playwright.thinking.config.ts --reporter=line --timeout=180000`.
  Initial run: **41 passed, 1 failed**. The speech fixture supplied a plain fake
  voice to a native utterance, whose voice setter rejected it before playback.
  Stubbed the utterance along with the voice, then reran `--grep "English listening"`:
  **1 passed**. All **42 distinct scenarios** are verified across those runs;
  no clean single-run 42-test result is claimed.
- Seven new scenarios cover all A–Z cards, both muted six-round journeys,
  spelling retries/reset/keyboard selection, English voice parameters with a
  Bengali UI, mute behavior, absent voices and reachable controls without
  horizontal overflow at 1280×800, 800×600 and 360×640 with reduced motion.
  Voice tests use simulated browser speech APIs; no claim of audible voice
  quality verification is made.
- Repeated `--grep "learn every|letter board" --output=test-results/letters-visual`
  to capture the alphabet and narrow spelling screens for visual review:
  **2 passed**. Inspected letters, custom yo-yo art, font sizes, choice spacing,
  Bengali instructions and control reachability. Browser runs used approved
  localhost/Edge access on isolated port 5175.
- `git diff --check`: passed.
- Final `pnpm typecheck`: passed, with 0 Svelte errors and 0 warnings.
- `pnpm build`: passed; static desktop frontend generated successfully.

## Limits and requests

This teaches letter names, case pairs, alphabet order and introductory picture
words; it does not claim a phonics or handwriting curriculum. Device English
voices are optional placeholder speech; voice quality/availability depends on
installed voices. Illustrations use device emoji except the two SVG pictures.

Game progress is session-local. No shared settings/progress/storage/audio
contracts, dependencies, external credentials or installer builds changed.
No requests for Claude, task-board edits, or commits.

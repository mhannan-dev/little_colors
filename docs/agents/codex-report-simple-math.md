# Simple Math

Added a same-window game at `/simple-math`, available from Play under Letters and numbers.

Children count apples to answer addition, subtraction, or mixed questions up to 10 or 20. Subtraction crosses out removed apples and always leaves a nonnegative answer. Four distinct choices include exactly one correct answer. Wrong answers reveal counting guidance and allow another try. Five correct answers earn a celebration, with an explicit next button between questions.

The screen uses the existing language switcher, numeral setting, narration system, and Back navigation. New narration entries are placeholders using the existing audio fallback. Progress lasts for the current visit. Changing the activity or range starts a fresh set of five questions.

## Verification

- All 632 core tests passed, including generated arithmetic and answer-choice checks.
- Core TypeScript and desktop Svelte checks passed with zero errors or warnings.
- The Edge browser test passed for Play navigation, wrong-answer retry, five-star completion, subtraction, range switching, Bengali labels, and Back navigation.

## Requests

None.

## Finished by Claude (2026-11-13)

Codex stopped before the screen was committed; the Play card had already landed (in `977ddf1`) and pointed to a
route that was not in git. Claude finished it to the app rules:

- **No score (PR-07):** the five-star tally and "you earned a star" lines became five neutral progress dots and
  "Well done! That's right!"; the set always ends in a celebration.
- **Hints (PR-22):** after two tries the right number glows (colour pulse only, the button stays still).
- **Voice:** Rumi reads each sum ("three plus two, how many is that?") for numbers up to 10, and says the answer.
- **Child-friendly controls:** the range `<select>` became two big buttons; GameButton next/replay/choose-game;
  mascot, chime and particles; pause and reduced motion; `<section>` instead of a nested `<main>`.
- **Imports:** `createMathQuestion` is exported from `@little-colors/core` (numbers/index.ts) instead of a relative
  path into `packages/core/src`.
- E2E rewritten (`tests/e2e/simple-math.spec.ts`): retry, hint glow, five sums, replay, subtraction up to 20.

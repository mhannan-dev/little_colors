# 15 — Testing & QA

**Depends on:** 04, 16; every feature file lists its own tests
**Phase:** continuous; final pass in Phase 7

## Test stack

| Layer | Desktop | Mobile | Shared core |
|---|---|---|---|
| Unit | Vitest | — (covered by core) | Vitest |
| Component / integration | Vitest + `@testing-library/svelte` | Jest + React Native Testing Library | — |
| End-to-end | Playwright | Maestro | — |
| Static checks | ESLint, Prettier, `svelte-check`, `tsc --noEmit` | ESLint, Prettier, `tsc --noEmit` | ESLint, `tsc --noEmit` |

## Commands

```text
pnpm lint          # all packages
pnpm typecheck     # all packages
pnpm test          # unit + integration
pnpm test:e2e      # Playwright against the desktop UI
pnpm build         # all packages and apps
```

| ID | Requirement |
|---|---|
| QA-01 | All commands above MUST exist and pass before a phase is reported done. |
| QA-02 | Tests MUST use the fake `Clock`, in-memory storage, and fake `AudioPlayer`; no real timers or network. |
| QA-03 | Seeded generators MUST be tested across many seeds (≥ 1,000) for invariants. |
| QA-04 | Never report tests as passing unless they were actually run (WF-10). |

## Unit test coverage (core)

- Color mixing: all recipes, order independence, invalid pairs.
- Matching validation and activity generation.
- Math logic, numerals, question generation.
- Every transition-table row of all three game machines, including ignored events and reset.
- Curriculum rounds per mode and difficulty.
- Session timer calculations.
- Progress and settings serialization, migrations, corrupted data, defaults.
- Voice manifest completeness.
- Parent gate question generation.

**Target:** ≥ 90 % line coverage for `packages/core`.

## Integration scenarios (desktop UI)

1. Select first color → football changes color.
2. Select second color → result and Next.
3. Return to the initial state with Reset.
4. Correct and incorrect matching (drag and tap).
5. Counting without double-counting; correct and incorrect number answers.
6. Muting during narration.
7. Navigating away during an animation.
8. Pausing and resuming gameplay (tab hidden).

## End-to-end scenarios (Playwright)

1. Welcome → mode selection.
2. Complete a color-mixing round.
3. Complete a shape-matching round.
4. Complete a numbers round (counting + number-to-quantity).
5. Restart an activity.
6. Change language and numeral style.
7. Enable reduced motion.
8. Trigger a rest reminder using the Playwright clock.
9. Reload and restore local progress.
10. Run an activity with networking disabled.
11. Use the app at 800×600 and 1920×1080 window sizes (and 360×640 / 768×1024 for later mobile parity).

## Accessibility testing

- Keyboard-only navigation of every screen.
- Touch target sizes (automated check for ≥ 56 px).
- Screen-reader labels in both languages (axe-core in Playwright).
- Reduced-motion behavior.
- Full usability with audio off (captions present).
- Text contrast (WCAG 2.2 AA).
- Feedback not relying on color alone.

## Manual QA checklist (per release)

- [ ] Played on a low-cost Android phone and a tablet.
- [ ] No flashing or fast blinking anywhere.
- [ ] No negative sounds or visuals on wrong answers.
- [ ] No console errors in a full play-through.
- [ ] All placeholders listed (`assets:report`).

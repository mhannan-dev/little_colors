# Codex task 01 — Core logic for Shape Matching and Numbers

You are working in the Little Colors monorepo (`E:\DockerProjects\little_colors`) **at the same time as another agent (Claude Code)**. To avoid overwriting each other's work, follow the file-ownership rules below exactly.

## Read first

- `docs/agents/README.md`: ownership map and protocol (**mandatory**; it overrides anything below if they ever disagree)
- `docs/specs/00-README.md`, `01-product-principles.md`, `04-architecture-and-stack.md`, `16-agent-workflow.md`
- `docs/specs/06-shape-matching.md` and `docs/specs/07-numbers-counting.md` (your task)
- `docs/specs/11-curriculum-progress.md` (round tables for both modes)
- Existing code to follow as a pattern (read-only for you): `packages/core/src/fsm/createMachine.ts`, `packages/core/src/color-mixing/*`, `packages/core/src/learning/rng.ts`, `packages/core/src/learning/curriculum.ts`

## Your task

Implement the **pure TypeScript core logic and tests only** (no UI) for:

1. **Shape Matching (spec 06):**
   - `packages/core/src/shape-matching/shapes.ts`: the shape library table
   - `packages/core/src/shape-matching/matchValidator.ts`: `isCorrectMatch`
   - `packages/core/src/shape-matching/activityGenerator.ts`: seeded generator satisfying SM-10 to SM-13
   - `packages/core/src/shape-matching/matchingMachine.ts`: the `MatchingState` machine exactly as in the spec 06 transition table, built on `createMachine` with effect descriptors (same style as `color-mixing/mixingMachine.ts`)
   - `packages/core/src/shape-matching/rounds.ts`: `createMatchingRound(difficulty, seed)` per the spec 11 table
   - `packages/core/src/shape-matching/index.ts`: re-exports everything above
2. **Numbers & Counting (spec 07):**
   - `packages/core/src/numbers/mathLogic.ts`, `numerals.ts`, `numberVocabulary.ts`, `patterns.ts`
   - `packages/core/src/numbers/questionGenerator.ts`: seeded, satisfying NC-20 to NC-24
   - `packages/core/src/numbers/countingMachine.ts`: the `CountingState` machine exactly as in the spec 07 transition table
   - `packages/core/src/numbers/rounds.ts`: `createNumbersRound(difficulty, seed)` per the spec 11 table
   - `packages/core/src/numbers/index.ts`: re-exports everything above
3. **Narration keys:** do **not** edit `voiceManifest.ts`. Instead, list every narration key your machines emit, with Bengali and English text (plus neutral variants for any Islamic expression), in `packages/core/src/shape-matching/narration.ts` and `packages/core/src/numbers/narration.ts` as `NarrationEntry[]` arrays (import the type from `../audio/voiceManifest.ts`). Claude will merge them into the manifest.
4. **Tests** (Vitest) under `packages/core/tests/shape-matching/` and `packages/core/tests/numbers/`:
   - Every transition-table row, ignored events, and `RESET` from every state
   - Generator invariants across ≥ 1,000 seeds
   - Every test listed in the Tests sections of specs 06 and 07

## File ownership (strict)

| You MAY create/edit | You MUST NOT edit |
|---|---|
| `packages/core/src/shape-matching/**` | `packages/core/src/index.ts` (Claude wires your exports) |
| `packages/core/src/numbers/**` | `packages/core/src/fsm/**` |
| `packages/core/tests/shape-matching/**` | `packages/core/src/color-mixing/**` and its tests |
| `packages/core/tests/numbers/**` | `packages/core/src/learning/**`, `audio/**`, `session/**`, `storage/**`, `types/**` |
| `docs/agents/codex-report-01.md` | `apps/**`, `packages/design-tokens/**`, `docs/specs/**`, root config files, `package.json`, lockfile |

- If you need a change in a file you don't own (for example a new shared type or a `createMachine` feature), **do not make it**. Describe it under "Requests for Claude" in your report.
- Import shared code from its own file (e.g. `../fsm/createMachine.ts`, `../types/colors.ts`, `../learning/rng.ts`), not from `../index.ts`.
- Do not install dependencies.
- Do not run git commands that change history or the working tree (`commit`, `reset`, `checkout`, `stash`, `clean`).

## Conventions

- TypeScript strict; `.ts` extensions in relative imports; tabs; single quotes.
- Machines return effect descriptors and never run timers. Inject `Clock` (`../session/Clock.ts`) only if a guard needs elapsed time.
- Unlisted events are ignored. No negative feedback anywhere (PR-08); religious objects never used as matchable or countable items (PR-13).

## Verify before reporting

Run from `packages/core`:

```text
npx vitest run
npx tsc --noEmit
```

Both must pass, including the existing tests you didn't write.

## Report

Write `docs/agents/codex-report-01.md` using the template in `docs/specs/16-agent-workflow.md` (Step 5):

- Status of every requirement ID in specs 06 and 07: done, partial, or not started
- Files created
- The exact command output summary (test counts, tsc result)
- Assumptions made
- Requests for Claude (changes needed in files you don't own)

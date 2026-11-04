# Codex task 02 — Settings, progress, session timer, parent-gate logic (core only)

**Start only after task 01 is reported done.** Read [README.md](README.md) (ownership and protocol) first.

## Read

- `docs/specs/01-product-principles.md`, `04-architecture-and-stack.md`, `16-agent-workflow.md`
- `docs/specs/10-parent-settings.md` (settings schema, defaults, PS-20 to PS-23, parent gate PS-01 to PS-06)
- `docs/specs/11-curriculum-progress.md` (progress CP-30 to CP-35, recommendation CP-20 to CP-22)
- `docs/specs/12-session-rest.md` (SR-01 to SR-07)

## Implement (pure TypeScript + Vitest, no UI)

| Module | Files (you own these) | Requirements |
|---|---|---|
| Settings | `packages/core/src/settings/{schema,defaults,migrations,settingsService}.ts` | `ParentSettings` from spec 04; PS-10, PS-20 to PS-23 |
| Parent gate questions | `packages/core/src/settings/parentGate.ts` | PS-02, PS-03: Bengali and English number words, results 11–30, 4 unique options, seeded |
| Progress | `packages/core/src/progress/{schema,migrations,progressService}.ts` | `PlayerProgress` from spec 04; CP-20 to CP-22, CP-30 to CP-35 |
| Session timer | `packages/core/src/session/sessionTimer.ts` | SR-01 to SR-07, using the injected `Clock` |
| Module indexes | `packages/core/src/{settings,progress,session}/index.ts` | Re-export everything above |
| Tests | `packages/core/tests/{settings,progress,session}/**` | Every test listed in specs 10, 11, 12; corrupted and old-version data; storage unavailable |

Services take a `StorageAdapter` (from `../storage/StorageAdapter.ts`) and, where time matters, a `Clock` (from `../session/Clock.ts`). Storage keys: `lc.settings.v1`, `lc.progress.v1`.

## Do not edit

Everything outside the files in the table. In particular `src/index.ts`, `fsm/**`, `color-mixing/**`, `audio/**`, `learning/**`, `types/**`, and anything in `apps/`. If you need a new shared type (for example `PlayerProgress` in `types/`), define it in your own module and say so under "Requests" in your report.

## Verify

From `packages/core`: `npx vitest run` and `npx tsc --noEmit`. Both must pass, including tests you didn't write.

## Report

`docs/agents/codex-report-02.md`, with requirement status by ID, files, command results, assumptions, and requests for Claude.

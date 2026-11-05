# Multi-Agent Work Split: Claude Code + Codex

Two AI coding agents work in this repository at the same time. This file is the **single source of truth** for who owns what. Both agents MUST read it before starting any task.

## Why this exists

On 2026-11-04 both agents wrote to `packages/core` at the same time. One agent's `createMachine.ts` was overwritten and could not be recovered (there were no git commits yet). The rules below prevent that from happening again.

## Ownership map

| Area | Owner | Notes |
|---|---|---|
| `apps/desktop/**` (SvelteKit UI, Tauri shell, E2E, gallery) | **Claude** | All screens, components, styles, desktop behavior |
| `packages/design-tokens/**` | **Claude** | |
| `packages/core/src/index.ts` | **Claude** | Claude wires new modules into the public API |
| `packages/core/src/fsm/**` | **Claude** | Shared machine helper; changes by request only |
| `packages/core/src/color-mixing/**` + its tests | **Claude** | |
| `packages/core/src/audio/**` (incl. `voiceManifest.ts`) | **Claude** | Codex supplies narration entries in its own modules |
| `packages/core/src/learning/**` | **Claude** | |
| `packages/core/src/types/**` | **Claude** | |
| `packages/core/src/assets/**` + `tests/assets/**` | **Claude** | Asset manifest (spec 14) |
| `packages/core/tests/audio/**` | **Claude** | |
| `scripts/**`, `assets/**`, `docs/narration-script.md`, `docs/asset-licenses.md` | **Claude** | Repo tooling and shared asset sources |
| `packages/core/src/shape-matching/**` + `tests/shape-matching/**` | **Codex** | Task 01 |
| `packages/core/src/numbers/**` + `tests/numbers/**` | **Codex** | Task 01 |
| `packages/core/src/session/**` + `tests/session/**` | **Codex** | Task 02 |
| `packages/core/src/settings/**` + `tests/settings/**` | **Codex** | Task 02 |
| `packages/core/src/progress/**` + `tests/progress/**` | **Codex** | Task 02 |
| `packages/core/src/storage/**` | **Codex** | Created by Codex; Claude reads only |
| `packages/core/tests/helpers/**` | **Codex** | Shared test helpers (fake clock) |
| `docs/specs/**`, `LittleColorAppGame.md` | **Claude** | Spec changes happen only on the user's request |
| `docs/agents/README.md`, `codex-task-*.md` | **Claude** | |
| `docs/agents/codex-report-*.md` | **Codex** | |
| `docs/agents/claude-report-*.md` | **Claude** | |
| Root config: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, lockfile, `.gitignore` | **Claude** | Codex requests dependency or config changes |

Anything not listed: ask the user before editing.

## Task board

| ID | Owner | Task | Spec | Status |
|---|---|---|---|---|
| C-01 | Claude | Monorepo, Tauri shell, design tokens, navigation shell | 02, 04, 09, 13 | done |
| C-02 | Claude | Color Mixing core + desktop UI + E2E | 05, 11 | done |
| C-03 | Claude | UI gallery (screenshots in `docs/ui/`) | — | done |
| X-01 | Codex | Shape Matching + Numbers core logic and tests | 06, 07, 11 | done, see [codex-report-01.md](codex-report-01.md) |
| C-04 | Claude | Wire X-01 into `index.ts` + voice manifest; Shape Matching UI | 06, 08, 09 | done, see [claude-report-C-04.md](claude-report-C-04.md) |
| C-05 | Claude | Numbers UI | 07, 09 | ready, see [claude-task-C-05.md](claude-task-C-05.md) |
| X-02 | Codex | Settings service, progress service, session timer, parent-gate question generator (core only) | 10, 11, 12 | in progress, see [codex-task-02.md](codex-task-02.md) |
| C-06 | Claude | Parent gate + settings screen + rest screen UI; IndexedDB adapter; wiring X-02 | 10, 11, 12 | blocked by X-02, see [claude-task-C-06.md](claude-task-C-06.md) |
| C-07 | Claude | Audio manager + desktop audio adapters, asset manifest, placeholder report, narration script, large-screen scaling | 08, 14, 02 | done, see [claude-report-c07-c08.md](claude-report-c07-c08.md) |
| C-09 | Claude | Football, Garage, Birds mini-games (core + UI) and finishing Copilot's flag-game rewrite | — | done, see [claude-report-C-09.md](claude-report-C-09.md) |
| C-08 | Claude | QA pass and Windows installer | 13, 15 | in progress, see [claude-task-C-08.md](claude-task-C-08.md) |

Rule of thumb: **Codex builds pure logic in `packages/core` (rules, machines, services, tests). Claude builds everything the child sees (`apps/desktop`) and integrates Codex's modules.**

## Protocol

1. **Before starting:** read this file and check that your task's files are all in your ownership column.
2. **Never edit a file you don't own.** If you need a change there, write it under "Requests" in your report. The owner makes the change.
3. **Imports across ownership lines:** import from the module's own file (for example `../fsm/createMachine.ts`), never from `src/index.ts`, so that index wiring stays with Claude.
4. **Shared contracts are frozen while a task runs:** `createMachine` API, `Color` / `Difficulty` / `Locale` / `GameMode` types, `StorageAdapter`, `Clock`, `NarrationEntry`. Changing any of them requires a request and the user's OK.
5. **No destructive git:** neither agent runs `reset`, `checkout -- <path>`, `stash`, `clean`, rebase, or force operations. Commits only when the user asks.
6. **Separate commits per agent:** Claude commits only Claude-owned files (subject starts with `Claude:`, ends with the Claude co-author trailer). Codex work is committed separately (subject starts with `Codex:`). Never mix both agents' files in one commit; if both changed, make two commits. Don't commit the other agent's in-progress files.
7. **Overwriting:** never write a whole file with `cat >`, `Set-Content`, or a full Write without first reading its current content in the same session.
8. **Finishing:** run `npx vitest run` and `npx tsc --noEmit` in `packages/core` (Codex), or `pnpm test`, `pnpm typecheck`, and `pnpm --filter desktop test:e2e` from the root (Claude). Then write your report and update your row's status in the task board (owner of this file: Claude updates it from the report).
9. **Conflicts:** if you find that a file you own was changed by someone else, stop and tell the user. Don't revert it.

## Task files

- Codex: [codex-task-01.md](codex-task-01.md), [codex-task-02.md](codex-task-02.md)
- Claude: [claude-task-C-04.md](claude-task-C-04.md), [claude-task-C-05.md](claude-task-C-05.md), [claude-task-C-06.md](claude-task-C-06.md), [claude-task-C-08.md](claude-task-C-08.md)

## Reports

- Codex: `docs/agents/codex-report-<task>.md`
- Claude: `docs/agents/claude-report-<task>.md`
- Format: the template in [../specs/16-agent-workflow.md](../specs/16-agent-workflow.md), Step 5, plus a "Requests" section.

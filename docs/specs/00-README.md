# Little Colors — Feature Specs Index

This folder splits the master specification ([../../LittleColorAppGame.md](../../LittleColorAppGame.md), v1.2) into feature-sized files. Each file is meant to be handed to an AI coding agent as the main brief for one unit of work.

## Two agents: Claude Code + Codex

This repo is worked on by two AI agents at once. **Before any task, read [../agents/README.md](../agents/README.md)**: it assigns every folder to exactly one agent, lists the task board, and defines the no-conflict protocol. Codex tasks are in `docs/agents/codex-task-*.md`.

## How to use these files with an AI agent

1. **Always load the base context** with any task:
   - [01-product-principles.md](01-product-principles.md): non-negotiable rules
   - [04-architecture-and-stack.md](04-architecture-and-stack.md): where code goes and how it is shared
   - [16-agent-workflow.md](16-agent-workflow.md): how to plan, verify, and report
   - [../agents/README.md](../agents/README.md): which files this agent may edit
2. **Add only the feature file(s) for the task**, plus the files listed under *Depends on* at the top of each one.
3. **One feature per session.** Finish and verify one file's acceptance checklist before starting the next.
4. **Reference requirement IDs** (for example `CM-07`) in commits, tests, and reports so every requirement can be traced.

### Example prompt

```text
Read docs/specs/01-product-principles.md, 04-architecture-and-stack.md,
16-agent-workflow.md and 05-color-mixing.md.
Implement 05-color-mixing.md for apps/desktop only.
Follow the transition table exactly. Write the tests listed in the file.
Report using the template in 16-agent-workflow.md, listing which
requirement IDs are done, partial, or placeholder.
```

## Conflict rules

- If a feature file conflicts with **01-product-principles.md**, the principles win.
- If two feature files conflict, stop and report the conflict instead of guessing.
- If a detail is missing and is **not** blocking, use the most child-friendly, simplest option and record it under "Assumptions" in the report.

## Files

| # | File | Scope | Requirement prefix |
|---|---|---|---|
| 00 | [00-README.md](00-README.md) | This index | — |
| 01 | [01-product-principles.md](01-product-principles.md) | Audience, principles, difficulty levels | `PR` |
| 02 | [02-design-system.md](02-design-system.md) | Colors, tokens, accessibility, display modes, responsive layout | `DS` |
| 03 | [03-mascot-rumi.md](03-mascot-rumi.md) | Mascot design, animation states, constraints | `MA` |
| 04 | [04-architecture-and-stack.md](04-architecture-and-stack.md) | Stack, monorepo, shared core, data model | `AR` |
| 05 | [05-color-mixing.md](05-color-mixing.md) | Game Mode A: football color mixing | `CM` |
| 06 | [06-shape-matching.md](06-shape-matching.md) | Game Mode B: color and shape matching | `SM` |
| 07 | [07-numbers-counting.md](07-numbers-counting.md) | Game Mode C: numbers and counting | `NC` |
| 08 | [08-audio-narration.md](08-audio-narration.md) | Audio engine, voice manifest, Islamic expressions, content review | `AU` |
| 09 | [09-screens-navigation.md](09-screens-navigation.md) | Welcome, mode selection, completion, navigation shell | `SC` |
| 10 | [10-parent-settings.md](10-parent-settings.md) | Parent gate, settings screen, settings store | `PS` |
| 11 | [11-curriculum-progress.md](11-curriculum-progress.md) | Rounds, sequencing, progress, persistence | `CP` |
| 12 | [12-session-rest.md](12-session-rest.md) | Session timer and rest break screen | `SR` |
| 13 | [13-desktop-tauri.md](13-desktop-tauri.md) | Desktop app (Tauri), offline, performance | `OF` |
| 14 | [14-assets-placeholders.md](14-assets-placeholders.md) | Asset formats, placeholder policy, licensing | `AS` |
| 15 | [15-testing-qa.md](15-testing-qa.md) | Test stack, test scenarios, accessibility testing | `QA` |
| 16 | [16-agent-workflow.md](16-agent-workflow.md) | Agent workflow, reporting, definition of done | `WF` |
| 17 | [17-mobile-react-native.md](17-mobile-react-native.md) | React Native mobile app (Phase 8) | `MB` |

## Implementation order (phase → files)

| Phase | Goal | Files |
|---|---|---|
| 1 | Monorepo, Tauri desktop shell, tokens, navigation | 02, 04, 09, 13 |
| 2 | Color mixing | 05 (+ 11 for round structure) |
| 3 | Shape matching | 06 |
| 3B | Numbers & counting | 07 |
| 4 | Mascot & animation | 03 |
| 5 | Audio & narration | 08, 14 |
| 6 | Parent controls, progress, session | 10, 11, 12 |
| 7 | QA & desktop release readiness | 15, 13 |
| 8 | React Native mobile app | 17 (+ every feature file for parity) |

## Requirement keywords

- **MUST**: required for the feature to be accepted.
- **SHOULD**: expected unless there is a documented reason not to.
- **MAY**: optional.

Requirement IDs are stable. When a requirement is removed, mark it `(removed)` instead of renumbering.

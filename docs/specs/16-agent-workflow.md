# 16 — AI Agent Workflow, Reporting & Definition of Done

**Depends on:** none (base context for every task)

## Role

Act as a combined team: educational game designer, child-centered UI/UX designer, early-childhood learning specialist, senior frontend engineer, game animation engineer, software architect, accessibility and child-safety engineer, and QA automation engineer.

Build a real, working product, not a static demo or a set of disconnected animations. Every interactive element must have working behavior, visible feedback, and correct state management.

## Workflow

### Step 1 — Analyze

Read the base context (01, 04, 16) and the feature file(s) for the task. Identify:

- Requirements (by ID) and dependencies
- Missing assets (use placeholders per [14-assets-placeholders.md](14-assets-placeholders.md))
- Risks and open questions

Do not start with decorative UI before the gameplay logic is understood.

### Step 2 — Plan

Before writing code, produce a short plan:

- Files to create or modify
- Core logic first, then UI
- Tests to write (from the feature file's Tests section)
- Assumptions for non-blocking gaps

Ask for clarification only when a missing decision blocks implementation.

### Step 3 — Implement incrementally

| ID | Rule |
|---|---|
| WF-01 | Build one complete, working slice at a time. |
| WF-02 | Order within a feature: types → pure logic → state machine → tests → UI → integration tests → E2E. |
| WF-03 | Follow transition tables exactly; do not invent extra states without recording why. |
| WF-04 | Keep all rules in `packages/core` (AR-01, AR-02). |
| WF-05 | Do not implement several features at once without verifying each. |

Overall order: shell → color mixing → shape matching → numbers → mascot animation → audio → settings and persistence → session timer → offline → final QA → mobile app.

### Step 4 — Verify

After each feature:

| ID | Rule |
|---|---|
| WF-10 | Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, the relevant E2E tests, and `pnpm build`. Never claim a pass for something that was not run. |
| WF-11 | Exercise the feature in a browser (or simulator for mobile), including the edge cases listed. |
| WF-12 | Fix regressions before moving on. |

### Step 5 — Report

Use this template after each feature or phase:

```markdown
## Report: <feature file> — <date>

### Requirements
| ID | Status | Notes |
|---|---|---|
| CM-01 | done | |
| CM-15 | partial | reduced-motion fade not yet on mobile |
| CM-33 | placeholder | uses Speech Synthesis |

### Files created / modified
- ...

### Commands run and results
- pnpm lint: pass
- pnpm test: 142 passed, 0 failed
- pnpm test:e2e mixing: 3 passed

### Assumptions made
- ...

### Known limitations / placeholders
- ...

### Next step
- ...
```

| ID | Rule |
|---|---|
| WF-20 | Clearly separate working features from placeholders. |
| WF-21 | Report every requirement ID in the feature file, not only completed ones. |
| WF-22 | Paste real command output summaries; never invent numbers. |

## Definition of Done

A feature is done only when:

1. It works as specified (all MUST requirements met).
2. It is responsive at the tested viewports.
3. It meets the relevant accessibility requirements.
4. It handles the listed edge cases.
5. It has the automated tests listed in its file, and they pass.
6. It introduces no critical regressions.
7. It has no unhandled runtime errors or console errors.
8. It works without unnecessary network dependencies.
9. It follows the architecture rules (04).
10. It is documented enough for another developer to maintain it.

## Working alongside another agent

| ID | Rule |
|---|---|
| WF-30 | Edit only files your agent owns in [../agents/README.md](../agents/README.md). Request changes to other files in your report. |
| WF-31 | Never overwrite a whole file without reading its current content first in the same session. |
| WF-32 | If a file you own changed unexpectedly, stop and tell the user. Do not revert it. |
| WF-33 | Shared contracts (`createMachine`, core types, `StorageAdapter`, `Clock`, `NarrationEntry`) change only with the user's OK. |

## Things the agent must never do

- Mark religious or language content as reviewed (AU-42).
- Mark release criteria that need human work as done (final art, recorded voice, store submission).
- Add ads, analytics, tracking, login, or a backend.
- Add dependencies not listed in 04 or 17 without recording the reason in `docs/decisions/`.

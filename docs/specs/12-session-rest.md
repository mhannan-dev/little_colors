# 12 — Session Timer & Rest Break

**Depends on:** 01, 03, 04, 08, 10
**Phase:** 6

## Goal

Gently remind the child to take a break after a period of active play. The default of 20 minutes is a product setting, not a medical threshold (PR-14).

## Session timer

| ID | Requirement |
|---|---|
| SR-01 | Counts **active gameplay time** only: time on a game screen while the app is visible and not paused. |
| SR-02 | Pauses when the tab is hidden or the app is backgrounded, and on non-game screens (Welcome, Mode Selection, Parent Settings). |
| SR-03 | Exactly one timer instance exists at any time. |
| SR-04 | The threshold comes from Parent Settings (`restReminderMinutes`; "off" disables it). |
| SR-05 | Accumulated time survives a pause and resume within the same app session; it resets after a completed rest break. |
| SR-06 | Uses the injected `Clock` so tests can use a fake clock. |
| SR-07 | The reminder fires once per threshold; no notification loops. |

```typescript
// packages/core/src/session/sessionTimer.ts
interface SessionTimer {
  start(): void;      // entering a game screen
  pause(): void;      // leaving a game screen or app hidden
  resume(): void;
  reset(): void;      // after rest break completes
  readonly activeMs: number;
  onThreshold(listener: () => void): () => void;
}
```

## Behavior when the threshold is reached

1. Wait until the current interaction reaches a safe point (the machine is in a non-animating state such as `READY`, `IDLE`, `FIRST_COLOR_APPLIED`, or `COMPLETE`), or at most 10 s.
2. Pause gameplay.
3. Stop active animations and narration.
4. Show the Rest Break screen.
5. If sound is enabled, play the gentle reminder: "অনেক সুন্দর রং শিখেছি! এবার একটু বিশ্রাম নিই!"

| ID | Requirement |
|---|---|
| SR-10 | The reminder MUST NOT interrupt an animation midway (step 1). |
| SR-11 | Gameplay MUST NOT resume automatically. |

## Screen 6 — Rest Break

| ID | Requirement |
|---|---|
| SR-20 | Calm background, Rumi in the `rest` state, friendly rest message (caption + narration). |
| SR-21 | No loud sound, no flashing (PR-06). |
| SR-22 | Continuing requires the parent gate ([10-parent-settings.md](10-parent-settings.md)). |
| SR-23 | After continuing, the timer resets and the child returns to Mode Selection. |
| SR-24 | Closing and reopening the app while the rest screen is shown starts at Welcome (the timer has already reset). |

## Files

```text
packages/core/src/session/sessionTimer.ts
packages/core/tests/session/sessionTimer.test.ts
apps/desktop/src/lib/components/RestOverlay.svelte
apps/desktop/src/lib/stores/session.ts
```

## Tests

- Unit (fake clock): counts only while running; pause/resume; threshold fires once; reset; "off" setting.
- Integration: threshold during an animation waits for a safe point.
- E2E (Playwright clock): trigger the rest reminder in a game, verify that gameplay is paused and continuing requires the gate.

## Acceptance checklist

- [ ] Only active game time is counted.
- [ ] The rest screen appears at a safe point and never auto-resumes.
- [ ] Continuing requires the parent gate.
- [ ] Works with a configurable threshold, including off.

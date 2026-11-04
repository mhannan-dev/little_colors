# X-02 — Settings, progress, parent gate and session core — 2026-11-04

## Status

**Done (core-only).** Started after X-01 was reported done and package type
checking passed. All implementation is inside the assigned settings/progress/
session folders and corresponding test folders. No shared contracts, UI, central
exports, root configuration, dependency files, or task-board file were edited.

## Requirements

| ID | Status | Notes |
| --- | --- | --- |
| PS-01 | partial | Gate questions supplied; 3-second hold/progress ring belongs to UI. |
| PS-02 | done (core) | Bengali/English word-only questions; no narration key or audio effect. |
| PS-03 | done | Four unique numeric options, seeded, results 11–30; 1,000 seeds tested. |
| PS-04 | partial | Correct answer supplied; app opens/closes gate quietly. |
| PS-05 | not started | Keyboard/screen-reader gate interaction belongs to UI. |
| PS-06 | not started | External-link gate routing belongs to UI. |
| PS-10 | done (core) | Local persistence and subscription updates before slow saves finish. |
| PS-11 | done | No personal fields; unknown stored fields discarded. |
| PS-12 | partial | Recommendation service available; parent-only display belongs to UI. |
| PS-13 | partial | Progress reset service implemented; confirmation belongs to UI. |
| PS-14 | not started | Privacy statement/link belongs to UI. |
| PS-15 | not started | Back/Done navigation belongs to UI. |
| PS-20 | done | Single defaults definition; OS reduced motion is injected. |
| PS-21 | done | Schema v1; v0/unversioned migrations. |
| PS-22 | done | Corrupt/future settings fall back safely; invalid fields repaired individually. |
| PS-23 | done | Read/write failures retain working in-memory settings. |
| CP-20 | done (core) | Three-round minimum and ≤1 hint/activity boundary tested for every mode. |
| CP-21 | done | Returns a recommendation only; never mutates difficulty/settings. |
| CP-22 | partial | No child-facing effects emitted; app must display only in parent settings. |
| CP-30 | done | Only specified progress schema fields persisted. |
| CP-31 | done | No personal-data fields; unknown saved metadata discarded. |
| CP-32 | done | Versioned migration; invalid/future data resets to empty without crashing. |
| CP-33 | done (core) | Explicit completed-activity API; duplicate activity IDs are idempotent. |
| CP-34 | done (core) | Reset clears progress and preserves the settings key. |
| CP-35 | done | Storage failures retain session progress in memory. |
| SR-01 | done (core) | Counts only between explicit start/resume and pause calls. |
| SR-02 | partial | Pause/resume accumulation tested; visibility/screen lifecycle wiring belongs to app. |
| SR-03 | partial | One pending callback per timer instance, tested; app must own one shared instance. |
| SR-04 | done (core) | Configurable 10–60 minutes / step five, 0 = off. |
| SR-05 | done | Accumulation survives pauses; reset clears and stops. |
| SR-06 | done | Injected Clock only; tests use the manual clock. |
| SR-07 | done | Threshold fires once until reset, including duplicate start/resume and settings changes. |
| SR-10 | not started | Safe-point / maximum 10-second deferral belongs to scene integration. |
| SR-11 | done (core) | Reset stops the timer; no automatic gameplay resume. |
| SR-20 | not started | Rest screen/mascot/caption/narration belongs to app. |
| SR-21 | partial | No loud/flashing effects emitted; rendered rest screen remains UI work. |
| SR-22 | not started | Parent gate before continuing belongs to UI. |
| SR-23 | partial | Timer reset API ready; app routes to mode selection. |
| SR-24 | partial | Timer is session-only; app startup/navigation belongs to UI. |

## Files created

- `packages/core/src/settings/{schema,defaults,migrations,settingsService,parentGate,index}.ts`
- `packages/core/src/progress/{schema,migrations,progressService,index}.ts`
- `packages/core/src/session/{sessionTimer,index}.ts`
- `packages/core/tests/settings/settings.test.ts`
- `packages/core/tests/progress/progress.test.ts`
- `packages/core/tests/session/sessionTimer.test.ts`
- This report. X-01's report was updated after final verification.

Existing `Clock.ts` and `StorageAdapter` were consumed unchanged. No dependencies
were installed. UI/browser/native installer checks were not run by Codex.

## Verification

Commands run from `packages/core`:

- `npx vitest run tests/settings tests/progress tests/session --maxWorkers 1`:
  **3 files / 50 tests passed**.
- Final `npx vitest run`: **16 files / 457 tests passed**, including the existing
  audio, catalog, asset, machine, color-mixing, and X-01 suites.
- Final `npx tsc --noEmit`: **passed**, exit 0.

During simultaneous integration, an intermediate run caught temporarily missing
central narration exports; the affected 121 tests passed on rerun after Claude's
catalog wiring settled, and the final full suite passed. Long seeded X-01 tests
now have a scoped 60-second timeout for 1,000-seed sweeps under CPU contention;
all invariant checks remain in place. The final full command needed no global
timeout override.

## Integration API / assumptions

### Settings

```ts
import { createSettingsService } from './settings/index.ts';

const settings = createSettingsService(storage, { reducedMotion: osPreference });
let current = await settings.load();
const offSettings = settings.subscribe((value) => { current = value; });
await settings.update({ language: 'en-US', numeralStyle: 'both' });
```

- `ParentSettings` lives in `settings/schema.ts`; root shared types were not
  edited. `DEFAULT_SETTINGS` is frozen and `createDefaultSettings()` returns a
  fresh copy. OS motion preference is supplied by the app, defaulting false.
- `restReminderMinutes: 0` means off; valid nonzero values are 10–60 in steps of
  five. Volume is 0–1. Invalid stored fields revert individually to defaults.
- `lc.settings.v1` stores a validated object, not a JSON string. Migration also
  accepts JSON strings for old data. Version 0/unversioned data uses the same
  known field names; unknown future versions reset to defaults.
- Service operations are serialized. Subscribe publishes copies immediately;
  an update notifies before awaiting a slow save. Call `load` at startup, and
  unsubscribe when disposing the app store.
- Read/write failures are caught; changes remain usable in memory for that
  session. The service attempts subsequent writes so a transient failure can
  recover, but cannot promise persistence while storage remains unavailable.

### Progress

```ts
import { createProgressService } from './progress/index.ts';

const progress = createProgressService(storage, epochClock, () => current.difficulty);
await progress.load();
await progress.recordActivity(activity, {
  hintsUsed: completion.hintsUsed,
  discovered: { countedUpTo: completion.countedUpTo }
});
await progress.recordRoundComplete('numbers', current.difficulty);
const recommendation = progress.getRecommendation('numbers');
```

- `PlayerProgress` is defined in `progress/schema.ts`. Storage key:
  `lc.progress.v1`. No child identity is collected.
- The injected progress clock's `now()` must return **epoch milliseconds** for
  `lastPlayedAt` ISO dates. The gameplay timer's monotonic clock can be a
  separate adapter. No wall-clock reads are hidden in this service.
- `recordActivity` takes structural `{id, mode, difficulty}` plus outcome;
  mixing/matching/numbers activities are compatible. Record once on complete,
  never per animation. Activity IDs deduplicate accidental repeated callbacks.
  Distinct replay rounds should use fresh seeds/IDs.
- Discoveries are unioned, countedUpTo never decreases, and returned snapshots
  are independent. Invalid outcomes reject without damaging progress or the
  operation queue. Activity storage writes are serialized to avoid lost updates.
- `recordRoundComplete` is called once by the round controller. That API has no
  round ID, so deduplicating repeated round-completion calls is the app's job.
- Recommendations use the injected current difficulty. With the specified
  schema, average hints is `hintsUsed / (completedRounds × activitiesPerRound)`:
  three activities for mixing, five for matching/numbers. Hints from completed
  activities in an unfinished round conservatively count until that round is
  completed. Advanced has no higher recommendation. No difficulty is changed.
- Reset writes empty progress only; settings stay intact. Storage failures fall
  back to memory. No service can guarantee that a reset survives app restart if
  persistent storage rejects all writes.

### Parent gate

`createGateQuestion(seed)` returns `{textBn, textEn, options, answer}`. Questions
contain number words, sums are 11–30, options are unique, and **no audio key** is
provided. UI handles the 3-second hold, accessibility, correct/wrong answer
routing, and guarding external links. Text remains unreviewed development copy.

### Session timer

```ts
import { createSessionTimer } from './session/index.ts';

const timer = createSessionTimer(clock, current.restReminderMinutes);
const offThreshold = timer.onThreshold(() => requestRestAtSafePoint());
timer.start(); // enter gameplay
timer.pause(); // hide app / leave gameplay / show rest or parent screen
timer.resume(); // only when visible gameplay resumes
timer.setThresholdMinutes(current.restReminderMinutes);
timer.reset(); // completed rest: clears and stops, never auto-resumes
// On app teardown: offThreshold(); timer.dispose();
```

- App owns **one** timer instance shared across scenes; there is no global
  mutable singleton in core. A timer maintains at most one pending clock job.
- Threshold notifications are once per reset. Pausing preserves accumulated
  active time; reset clears it and stops. Off suppresses notification while
  still tracking active play. Enabling/lowering an overdue threshold schedules
  one immediate notification, rather than notifying synchronously inside a
  settings update. Changing threshold after it already fired does not re-arm it.
- `dispose` cancels scheduling and clears listeners. Cancelled/stale callbacks
  cannot fire a reminder after pause/reset because scheduling is generation-tagged.
- Notification requests a break; app waits for a safe machine state (or handles
  the specified maximum deferral), cancels animations/audio, shows the overlay,
  and requires the parent gate. Core does not decide whether a scene is safe.

## Requests for Claude

1. Mark X-02 done on the task board (Claude-owned README).
2. Wire `settings/index.ts`, `progress/index.ts`, `session/index.ts` into the
   public core API using existing contracts. Keep the existing Clock export
   as the same binding when adding the session barrel.
3. Implement C-06 UI and IndexedDB adapter. Replace app-local settings defaults
   with the core service to prevent drift. Inject the OS motion preference,
   subscribe to apply settings, and wire completion effects to progress.
4. Own the single session timer and screen/visibility lifecycle. Implement
   safe-point deferral, rest overlay, no automatic resume, and the parent gate.
5. Verify reload persistence, unavailable-storage UX, recommendations only in
   parent settings, reset confirmation, hold/keyboard behavior, and rest E2E.

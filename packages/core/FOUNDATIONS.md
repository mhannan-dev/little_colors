# Shared core foundations

This slice implements the state-machine and platform contracts from spec 04.
It does not complete Phase 1 or implement gameplay. App screens, workspace
configuration, and the existing color/game types were left to the concurrent
app work. The only integration edit is the additive exports in `src/index.ts`.

## Public API

Import from `@little-colors/core`:

- `createMachine`, `Machine`, `MachineConfig`, `Transition`, `TransitionTable`
- `StorageAdapter`, `createMemoryStorageAdapter`
- `AudioPlayer`, `SpeechFallback`, `PlaybackResult`
- `Clock`

`createMachine<State, Event, Context>` takes `initialState`, an
`initialContext()` factory, and a state/event transition table. Each transition
has a required `target`, an optional `guard(context, event)`, and an optional
`reduce(context, event)` returning the next context. Event payloads are narrowed
by the table's event key. Return new context values rather than mutating input.

Unlisted events and rejected guards leave state/context unchanged and do not
notify. Accepted transitions notify once, including same-state transitions.
`subscribe` immediately delivers the current state/context and returns an
idempotent unsubscribe function. `reset` calls the context factory again and
notifies existing subscribers. Each instance owns its state and subscriptions.

Reducers and guards are synchronous and side-effect free. If a game needs
animation or narration, put typed effect descriptors in its context; the app
subscriber executes them. No effect runner or platform calls live in this helper.
Subscribers should observe snapshots and schedule any further events after the
current notification, rather than dispatching synchronously inside a callback.

The in-memory storage adapter serializes writes and parses each read, preventing
caller mutations from changing saved data. Values must be JSON-serializable.
Missing/removed keys return `null`; reads are typed by the caller, with schema
validation and migrations left to feature services. Separate adapters do not
share data. This is a development/test adapter, not persistence across reloads.

`tests/helpers/fakeClock.ts` supplies a manual clock with `advanceBy(ms)` for
feature tests. It runs due callbacks in deadline/insertion order, supports nested
timers and cancellation, and rejects invalid delays. It uses no real timers.
One advance stops after 10,000 callbacks to catch accidental infinite loops.

## Scope against spec 04

| Requirement | Status in this slice |
| --- | --- |
| AR-01 | Foundation code is separate from rendering; game rules remain future work. |
| AR-02 | No UI/DOM imports; automated ESLint enforcement remains to be configured. |
| AR-03 | No UI changes; game integration remains future work. |
| AR-04 | Narration manifest remains future work. |
| AR-05 | Activity configuration remains future work. |
| AR-06 | Machine instances own independent state/context/subscriptions; tested. |
| AR-07 | Storage contract and in-memory adapter implemented; feature persistence remains. |
| AR-08 | Storage, audio, speech, and clock interfaces implemented; fake clock provided. |
| AR-09 | Clock cancellation is supported; app animations remain future work. |
| AR-10 | Helper tests added; gameplay consumers remain future work. |
| AR-11 | No backend or remote API added. |
| AR-12 | Small transition-table helper; no runtime dependencies added. |

Run `pnpm --filter @little-colors/core typecheck` and
`pnpm --filter @little-colors/core test` for this package. Lint, browser/E2E
coverage, and full Phase 1 acceptance are outside this foundation slice.

## Verification — 2026-11-04

- `pnpm --filter @little-colors/core typecheck`: passed.
- `pnpm --filter @little-colors/core test`: passed, 4 files / 21 tests
  (20 foundation tests plus the existing color test).
- `pnpm typecheck`: passed, including the desktop Svelte app (0 errors/warnings).
- `pnpm test`: passed, 21 core tests; the desktop package has no tests and
  explicitly allows that with `--passWithNoTests`.
- `pnpm build`: passed, producing the desktop frontend's static site. This does
  not verify a native Tauri executable or installer build.
- `pnpm lint`: unavailable; the root workspace has no lint command.
- No browser or E2E tests apply to these platform-independent helpers. Their
  integration into game screens is still pending.

Next: consume these exports in the first game machine and platform adapters.
Full Phase 1 still needs the app shell, design tokens, and lint enforcement.

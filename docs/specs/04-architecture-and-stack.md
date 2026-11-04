# 04 — Architecture & Tech Stack

**Depends on:** [01-product-principles.md](01-product-principles.md) (base context for every task)
**Phase:** 1 (set up the structure first and keep it throughout)

## Tech stack

### Desktop (`apps/desktop`): first target

| Concern | Choice |
|---|---|
| Shell | Tauri 2 (Rust), see [13-desktop-tauri.md](13-desktop-tauri.md) |
| UI framework | SvelteKit 3 (`adapter-static`, SPA, `ssr = false`) |
| Language | TypeScript, strict mode |
| Styling | Tailwind CSS + generated design-token CSS variables |
| Graphics & animation (default) | SVG + CSS animations |
| Rich mascot/football scene | PixiJS, lazy-loaded, **only if** SVG/CSS misses performance targets |
| Audio | Web Audio API; Speech Synthesis as a development fallback |
| App state | Svelte stores wrapping core state machines |
| Persistence | IndexedDB behind `StorageAdapter` |
| Offline | Everything bundled in the app; no network |
| Unit & integration tests | Vitest + `@testing-library/svelte` |
| E2E tests | Playwright |
| Lint / format / types | ESLint, Prettier, `svelte-check` |

### Mobile (`apps/mobile`)

See [17-mobile-react-native.md](17-mobile-react-native.md). Summary: Expo React Native, Expo Router, `react-native-svg`, Reanimated, Gesture Handler, `expo-audio`, `expo-speech`, AsyncStorage, Jest, Maestro, EAS Build.

### Shared (`packages/*`)

| Package | Content | Tests |
|---|---|---|
| `packages/core` | All game rules, state machines, curriculum, narration keys, storage schemas, timers | Vitest |
| `packages/design-tokens` | Colors, spacing, radii, font sizes | Vitest |

Workspace tool: **pnpm workspaces**.

## Repository layout

```text
packages/
  core/
    src/
      color-mixing/     colorMixer.ts, mixingMachine.ts, recipes.ts
      shape-matching/   matchValidator.ts, matchingMachine.ts, shapes.ts
      numbers/          mathLogic.ts, questionGenerator.ts, countingMachine.ts, numerals.ts, patterns.ts
      learning/         curriculum.ts, activitySelector.ts, rng.ts
      audio/            voiceManifest.ts, narrationQueue.ts, types.ts
      mascot/           types.ts
      session/          sessionTimer.ts
      progress/         schema.ts, migrations.ts, progressService.ts
      settings/         schema.ts, defaults.ts, migrations.ts, settingsService.ts
      storage/          StorageAdapter.ts, memoryStorageAdapter.ts
      fsm/              createMachine.ts
      types/            colors.ts, game.ts
    tests/
  design-tokens/
apps/
  web/
  mobile/
assets/                 shared source assets (SVG, audio, mascot)
docs/
  specs/                these files
  decisions/            architecture decision records
```

### Web app structure

```text
apps/desktop/src/
  lib/
    components/
      ui/            GameButton.svelte, AudioButton.svelte, ParentGate.svelte, TopBar.svelte
      mascot/        Mascot.svelte
      football/      Football.svelte
      paint/         PaintContainer.svelte
    features/
      color-mixing/components/
      shape-matching/components/
      numbers/components/
    platform/        indexedDbStorageAdapter.ts, webAudioPlayer.ts, speechSynthesisFallback.ts
    game/            AnimationController.ts, AssetLoader.ts
    stores/          Svelte store wrappers around core machines and services
    styles/          global.css
  routes/
    +page.svelte           Welcome
    play/+page.svelte      Mode selection
    mixing/+page.svelte
    matching/+page.svelte
    numbers/+page.svelte
    parent/+page.svelte
apps/desktop/tests/
  unit/  integration/  e2e/
```

## Architectural rules

| ID | Rule |
|---|---|
| AR-01 | Gameplay logic is separate from rendering. All rules live in `packages/core`. |
| AR-02 | `packages/core` MUST NOT import Svelte, React, React Native, DOM, or browser APIs. Enforce with an ESLint `no-restricted-imports` rule. |
| AR-03 | No game rules inside UI components (no mixing, matching, or math logic in `.svelte` or `.tsx`). |
| AR-04 | Narration strings MUST come from `voiceManifest.ts`, never be hardcoded in UI files. |
| AR-05 | Learning activities use typed configuration (see data model below). |
| AR-06 | No global mutable game state; each screen owns its machine instance. |
| AR-07 | Persistence is accessed only through `StorageAdapter`. |
| AR-08 | Platform services are injected via interfaces: `StorageAdapter`, `AudioPlayer`, `SpeechFallback`, `Clock`. |
| AR-09 | Animations MUST be cancellable. |
| AR-10 | Rule changes are made once in `core`, covered by core tests, then consumed by the apps. |
| AR-11 | No backend, auth, database server, or remote API without a documented product requirement. |
| AR-12 | Avoid unnecessary abstractions; prefer small pure functions. |

## State machine pattern

All game state machines use one small helper in `packages/core/src/fsm/createMachine.ts`:

```typescript
interface Machine<S extends string, E extends { type: string }, C> {
  readonly state: S;
  readonly context: C;
  send(event: E): void;                                  // unlisted events are ignored
  subscribe(listener: (state: S, context: C) => void): () => void;
  reset(): void;
}
```

- Transitions are declared as a table that mirrors the transition tables in the feature specs.
- Side effects (animations, narration) are emitted as **effect descriptors** that the app layer executes; the machine itself stays pure and testable.
- Pause is an orthogonal flag held by the app, not a machine state.
- The web app wraps a machine in a Svelte `readable` store; the mobile app uses `useSyncExternalStore`.

## Platform interfaces

```typescript
interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

interface AudioPlayer {
  play(src: string, opts?: { volume?: number }): Promise<"ended" | "stopped" | "failed">;
  stopAll(): void;
  setMuted(muted: boolean): void;
}

interface SpeechFallback {
  isAvailable(locale: "bn-BD" | "en-US"): Promise<boolean>;
  speak(text: string, locale: "bn-BD" | "en-US"): Promise<"ended" | "stopped" | "failed">;
  stop(): void;
}

interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): () => void; // returns cancel function
}
```

## Shared data model

```typescript
type Color = "red" | "yellow" | "blue" | "orange" | "green" | "purple";
type Difficulty = "beginner" | "explorer" | "advanced";
type Locale = "bn-BD" | "en-US";
type GameMode = "mixing" | "matching" | "numbers";

interface LearningActivity {
  id: string;
  mode: GameMode;
  difficulty: Difficulty;
  instructionKey: string;   // key in voiceManifest
  expectedOutcome: string;
  enabled: boolean;
}

interface PlayerProgress {
  schemaVersion: number;
  completedActivityIds: string[];
  discoveredColors: Color[];
  discoveredShapes: string[];
  countedUpTo: number;
  completedRounds: Record<GameMode, Record<Difficulty, number>>;
  hintsUsed: Record<GameMode, Record<Difficulty, number>>;
  lastPlayedAt: string | null;   // ISO date
}

interface ParentSettings {
  schemaVersion: number;
  language: Locale;
  numeralStyle: "bengali" | "english" | "both";
  difficulty: Difficulty;
  soundEnabled: boolean;
  sfxEnabled: boolean;
  musicEnabled: boolean;         // default false
  volume: number;                // 0..1
  islamicExpressionsEnabled: boolean;
  reducedMotion: boolean;
  darkMode: boolean;
  restReminderMinutes: number;   // default 20
}
```

## Acceptance checklist

- [ ] Monorepo builds with `pnpm -r build`.
- [ ] AR-02 lint rule fails the build when `core` imports a UI or browser API.
- [ ] `createMachine` helper exists with unit tests (unlisted events ignored, reset, subscribe/unsubscribe).
- [ ] Platform interfaces defined in `core`, with an in-memory `StorageAdapter` and a fake `Clock` for tests.

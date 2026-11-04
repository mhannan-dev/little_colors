# 17 — Mobile App (React Native)

**Depends on:** 01, 04, 16, and every feature file (parity rule)
**Phase:** 8. Start only after the web app passes Phase 7, so `packages/core` is stable.

## Goal

Native Android and iOS apps with the same activities, curriculum, narration, settings, and feedback rules as the web app, reusing `packages/core` unchanged where possible.

## Stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | React Native via **Expo** (managed workflow) | Expo SDK pinned; upgrade deliberately |
| Language | TypeScript (strict) | Shared base `tsconfig` |
| Navigation | Expo Router | Routes mirror web |
| Graphics | `react-native-svg` | Default for UI, shapes, objects, containers |
| Animation | `react-native-reanimated` | UI-thread animations; respects in-app and OS reduced motion |
| Rich scene | `@shopify/react-native-skia` **only if needed** | Same rule as PixiJS on web (OF-31); record in `docs/decisions/animation-renderer.md` |
| Gestures | `react-native-gesture-handler` | Drag and drop plus tap-to-match |
| Audio | `expo-audio` | Bundled narration and SFX |
| Dev narration fallback | `expo-speech` | Placeholder policy (AS-30) |
| Storage | `@react-native-async-storage/async-storage` | Behind `StorageAdapter`; same schema and keys as web |
| Builds | EAS Build | iOS builds without a local Mac |
| Updates | Store releases only | No over-the-air code updates in MVP |
| Tests | Jest + React Native Testing Library; Maestro for E2E | |

## Structure

```text
apps/mobile/
  app/                      # Expo Router
    index.tsx               # Welcome
    play.tsx                # Mode selection
    mixing.tsx
    matching.tsx
    numbers.tsx
    parent.tsx
  src/
    components/
      ui/                   # GameButton, AudioButton, SoundToggle, TopBar, ParentGate
      mascot/Mascot.tsx
      football/Football.tsx
      paint/PaintContainer.tsx
    features/
      color-mixing/components/
      shape-matching/components/
      numbers/components/
    platform/
      asyncStorageAdapter.ts
      expoAudioPlayer.ts
      expoSpeechFallback.ts
      appLifecycle.ts       # AppState → pause/resume
    hooks/
      useMachine.ts         # useSyncExternalStore wrapper for core machines
    theme/                  # generated from packages/design-tokens
  tests/
  e2e/                      # Maestro flows
```

## Requirements

### Parity

| ID | Requirement |
|---|---|
| MB-01 | All three game modes, rounds, narration keys, settings, parent gate, rest break, and feedback rules match the web app. |
| MB-02 | Game rules come only from `packages/core`; no rule logic is duplicated in `apps/mobile`. |
| MB-03 | Requirement IDs from the feature files apply on mobile unless marked desktop-only (OF-10 to OF-16 and OF-25 to OF-26 are desktop-only). |

### Platform behavior

| ID | Requirement |
|---|---|
| MB-10 | **Fully offline:** all assets bundled in the binary; no network needed for gameplay. |
| MB-11 | No service worker or PWA logic. |
| MB-12 | The Android hardware back button behaves like the on-screen Back button and never exits the app directly from a game screen. |
| MB-13 | Tablets support portrait and landscape; phones MAY be locked to one orientation if layouts require it. |
| MB-14 | Going to background pauses gameplay, audio, and the session timer (SR-02). |
| MB-15 | Status bar hidden during gameplay; visible on Parent Settings. |
| MB-16 | Touch targets ≥ 56 dp; gameplay targets 72–96 dp. |
| MB-17 | TalkBack and VoiceOver labels on all interactive elements, in both languages. |
| MB-18 | Bengali font bundled with the app (AS-51). |

### Privacy and permissions

| ID | Requirement |
|---|---|
| MB-20 | Request no permissions beyond Expo defaults: no camera, microphone, location, contacts, or advertising ID. |
| MB-21 | No analytics, ad SDKs, or crash reporters that collect personal data. Crash reporting needs a separate privacy review. |
| MB-22 | External links (privacy policy, store) only behind the parent gate (PS-06). |

### Store compliance (human-action release items)

| ID | Requirement |
|---|---|
| MB-30 | Google Play: Families Policy / "Designed for Families"; Data safety form declares no data collected. |
| MB-31 | Apple App Store: Kids Category guidelines (no third-party analytics/ads, parental gate before external links). |
| MB-32 | A published privacy policy stating that no personal data is collected. |
| MB-33 | Store screenshots and descriptions show no placeholder assets. |

The agent prepares the checklists and a privacy policy draft; a human submits.

## Implementation order

1. Expo app shell, theme from tokens, routes, `useMachine` hook.
2. Platform adapters: storage, audio, speech, app lifecycle.
3. Color Mixing → Shape Matching → Numbers.
4. Mascot animations (SVG + Reanimated).
5. Audio and captions.
6. Parent gate, settings, progress, session timer, rest break.
7. Device testing and EAS builds.

## Tests

- Jest + RNTL: component behavior, `useMachine` bindings, adapters (mocked `expo-audio` and AsyncStorage).
- Maestro E2E: same scenarios as web E2E 1–9 and 11, plus:
  - Android back button on every game screen.
  - Background during an animation, then resume.
  - Session timer paused while backgrounded.
  - Tablet landscape and small-phone portrait.
- Devices: a low-cost Android phone (2–3 GB RAM), an Android tablet, and an iPhone or iOS simulator.

## Acceptance checklist

- [ ] Android and iOS builds produced via EAS Build.
- [ ] MB-01, MB-02 parity verified.
- [ ] Offline, back button, lifecycle, and timer behave as specified.
- [ ] No extra permissions or SDKs (MB-20, MB-21).
- [ ] Jest and Maestro tests pass.
- [ ] Store compliance checklist and privacy policy draft ready for human review.

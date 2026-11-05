# 09 — Screens & Navigation Shell

**Depends on:** 01, 02, 03, 04
**Related:** game screens in 05, 06, 07; parent screen in 10; rest screen in 12
**Phase:** 1 (shell), refined in later phases

## Screen map

```text
Welcome ──Play──▶ Mode Selection ──▶ Color Mixing ─┐
   │                    │          ├─▶ Shape Matching ├─▶ (round complete) ─▶ Completion
   │                    │          └─▶ Numbers ───────┘                        │
   │                    ◀───────────────────── Choose Another Game ◀───────────┘
   └──hold 3 s──▶ Parent Gate ──▶ Parent Settings
Any game screen ──(session timer)──▶ Rest Break
```

| Route (web) | Screen | Spec |
|---|---|---|
| `/` | Welcome | this file |
| `/play` | Mode Selection | this file |
| `/mixing` | Color Mixing | [05](05-color-mixing.md) |
| `/matching` | Shape Matching | [06](06-shape-matching.md) |
| `/numbers` | Numbers & Counting | [07](07-numbers-counting.md) |
| `/holy-puzzle` | Mosque & Kaaba Picture Puzzle | this file |
| `/parent` | Parent Settings (behind gate) | [10](10-parent-settings.md) |
| overlay | Completion | this file |
| overlay | Rest Break | [12](12-session-rest.md) |

## Screen 1 — Welcome

| ID | Requirement |
|---|---|
| SC-01 | Shows Rumi (`wave`), app logo, a large Play button, and a small parent-access button in a corner. |
| SC-02 | Tapping Play unlocks audio (AU-05) and opens Mode Selection. |
| SC-03 | No sign-up, login, or name entry (PR-10). |

## Screen 2 — Mode Selection

| ID | Requirement |
|---|---|
| SC-10 | Three large activity cards: **Color Mixing** (football + two paint containers), **Shape Matching** (circle, star, outlines), **Numbers & Counting** (three footballs + ৩). |
| SC-11 | A single tap (or Enter) opens the mode and speaks its label. Keyboard focus alone also speaks the label without opening. |
| SC-12 | Cards are at least 160 × 160 px on phones. |
| SC-13 | A back button returns to Welcome. |

## Shared game-screen shell

| ID | Requirement |
|---|---|
| SC-20 | Every game screen uses the same `TopBar`: Back (left), instruction replay, and sound toggle (right). |
| SC-21 | Back from a game screen stops all animations and narration and returns to Mode Selection with no confirmation dialog. |
| SC-22 | The instruction caption sits directly below the top bar. |
| SC-23 | Navigation MUST work during animations without errors (CM-37). |

## Screen 5 — Completion

Shown after the last activity of a round ([11-curriculum-progress.md](11-curriculum-progress.md)).

| ID | Requirement |
|---|---|
| SC-30 | Shows Rumi `celebrate` and one short congratulatory sentence (`feedback.completed` key). |
| SC-31 | Two buttons: **Replay** (same mode and difficulty, new seed) and **Choose Another Game**. |
| SC-32 | No rankings, scores, or comparisons (PR-07). |

## Global behaviors

| ID | Requirement |
|---|---|
| SC-40 | Transitions between screens use gentle fades or slides ≤ 300 ms; none in reduced-motion mode. |
| SC-41 | Browser back/forward and the Android back button follow the same rules as the on-screen Back button. |
| SC-42 | Language changes apply to all visible text and captions immediately. |
| SC-43 | No external links anywhere outside Parent Settings (PR-04). |

## Shared UI components

| Component | Notes |
|---|---|
| `GameButton` | Large rounded button, ≥ 72 px, icon + label, speaks label on focus |
| `AudioButton` | Replay instruction |
| `SoundToggle` | Mute/unmute with clear icon state (not color only) |
| `TopBar` | Shared game header |
| `ParentGate` | See [10-parent-settings.md](10-parent-settings.md) |

## Files

```text
apps/desktop/src/routes/+page.svelte
apps/desktop/src/routes/play/+page.svelte
apps/desktop/src/routes/+layout.svelte
apps/desktop/src/lib/components/ui/{GameButton,AudioButton,SoundToggle,TopBar}.svelte
apps/desktop/src/lib/components/CompletionOverlay.svelte
```

## Tests

- E2E: Welcome → Play → each mode → Back.
- E2E: choose a mosque or Kaaba picture, solve its tile puzzle, and verify it at small viewport sizes.
- E2E: complete a round → Completion → Replay and Choose Another Game.
- Accessibility: keyboard-only navigation through every screen; labels in both languages.

## Acceptance checklist

- [ ] All routes reachable; Back works everywhere.
- [ ] Mode cards speak their labels.
- [ ] Completion appears after a round with both buttons working.
- [ ] No external links outside Parent Settings.

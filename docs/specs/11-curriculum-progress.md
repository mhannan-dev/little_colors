# 11 — Curriculum, Rounds & Progress

**Depends on:** 01, 04
**Used by:** 05, 06, 07, 09, 10
**Phase:** 2 (round structure), 6 (persistence)

## Rounds

Activities are grouped into **rounds**: short, fixed sets of activities. Finishing the last activity of a round shows the Completion screen.

| Mode | Difficulty | Activities | Content of one round |
|---|---|---|---|
| Color Mixing | Beginner | 3 | Each recipe once, fixed order: red+yellow, blue+yellow, red+blue; 2 containers |
| Color Mixing | Explorer | 3 | Same three recipes, shuffled; 2 containers |
| Color Mixing | Advanced | 3 | Target color named first; 3 containers; child chooses the right two |
| Shape Matching | Beginner | 5 | 2 options; alternate color-only and shape-only |
| Shape Matching | Explorer | 5 | 3 options; color or shape |
| Shape Matching | Advanced | 5 | 3 options; shape + color together |
| Numbers | Beginner | 5 | C1 count, C2 numeral→quantity, C3 compare, C1 count, C5 pattern (range 1–5) |
| Numbers | Explorer | 5 | C1, C2, C3, C4 add (sum ≤ 5), C5 (range 1–10) |
| Numbers | Advanced | 5 | C2, C3 (incl. "same"), C4 (sum ≤ 10), C4, C5 ABC pattern |

| ID | Requirement |
|---|---|
| CP-01 | Round definitions live in typed data (`learning/curriculum.ts`). |
| CP-02 | Generated activities use a seeded RNG (`learning/rng.ts`) so any round can be reproduced from its seed. |
| CP-03 | Next advances within the round; on the last activity it opens Completion. |
| CP-04 | Replay starts a new round with the same mode and difficulty and a new seed. |
| CP-05 | Leaving mid-round discards the round position; completed activities stay recorded. |
| CP-06 | The current difficulty comes from Parent Settings and applies to all modes. |

```typescript
interface RoundPlan {
  mode: GameMode;
  difficulty: Difficulty;
  seed: number;
  activities: LearningActivity[];
}

function createRound(mode: GameMode, difficulty: Difficulty, seed: number): RoundPlan;
```

## Difficulty recommendation

| ID | Requirement |
|---|---|
| CP-20 | After 3 completed rounds at the current level for a mode, with an average of ≤ 1 hint per activity, Parent Settings shows: "Your child may be ready to try Explorer/Advanced." |
| CP-21 | Difficulty is never changed automatically (PR-30). |
| CP-22 | No recommendation is shown to the child. |

## Progress

`PlayerProgress` is defined in [04-architecture-and-stack.md](04-architecture-and-stack.md).

| ID | Requirement |
|---|---|
| CP-30 | Save only what is needed: completed activity IDs, discovered colors and shapes, highest number counted, completed rounds and hints per mode and level, last played date. |
| CP-31 | Never store the child's name, photo, voice, or location (PR-05). |
| CP-32 | Progress has `schemaVersion` with migrations; corrupted data resets to empty progress without crashing. |
| CP-33 | Progress is saved after each completed activity (not mid-animation). |
| CP-34 | "Reset local progress" (Parent Settings) clears progress only. |
| CP-35 | If storage is unavailable, progress works in memory for the session. |

```typescript
interface ProgressService {
  load(): Promise<PlayerProgress>;
  recordActivity(activity: LearningActivity, outcome: { hintsUsed: number; discovered?: { colors?: Color[]; shapes?: string[]; countedUpTo?: number } }): Promise<void>;
  recordRoundComplete(mode: GameMode, difficulty: Difficulty): Promise<void>;
  getRecommendation(mode: GameMode): Difficulty | null;
  reset(): Promise<void>;
}
```

## Storage

| Platform | Adapter |
|---|---|
| Web | IndexedDB (`indexedDbStorageAdapter.ts`) |
| Mobile | AsyncStorage (`asyncStorageAdapter.ts`) |
| Tests | `memoryStorageAdapter.ts` |

Keys: `lc.settings.v1`, `lc.progress.v1`.

## Files

```text
packages/core/src/learning/{curriculum,activitySelector,rng}.ts
packages/core/src/progress/{schema,migrations,progressService}.ts
packages/core/src/storage/{StorageAdapter,memoryStorageAdapter}.ts
apps/desktop/src/lib/platform/indexedDbStorageAdapter.ts
```

## Tests

- Unit: `createRound` matches the table for every mode and level; the same seed gives the same round.
- Unit: recommendation rule CP-20 (boundary at exactly 3 rounds and exactly 1 hint average).
- Unit: progress serialization, migration, corrupted data, storage unavailable.
- E2E: complete activities → reload → progress restored.

## Acceptance checklist

- [ ] All 9 round definitions implemented and tested.
- [ ] Completion appears after the last activity of a round.
- [ ] Progress persists and survives a reload.
- [ ] Recommendation appears only in Parent Settings.

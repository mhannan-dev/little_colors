# 06 — Game Mode B: Color & Shape Matching

**Depends on:** 01, 02, 03, 04, [08-audio-narration.md](08-audio-narration.md), [11-curriculum-progress.md](11-curriculum-progress.md)
**Phase:** 3

## Learning objective

Help children identify shapes and colors by matching objects to target outlines.

## Scope

**In:** shape library, drag-and-drop, tap-to-match, color/shape/both matching modes, hints, three difficulty levels.
**Out:** free drawing, rotation puzzles, timed matching.

## Shape library

| Key | Bengali | Notes |
|---|---|---|
| `football` | ফুটবল | |
| `circle` | গোল | |
| `star` | তারা | |
| `crescent` | চাঁদ | Crescent moon |
| `square` | চারকোনা | |
| `triangle` | তিনকোনা | |
| `leaf` | পাতা | |
| `apple` | আপেল | |

Optional Islamic-themed visuals (mosque silhouette, prayer mat, simple geometric Islamic patterns):

| ID | Requirement |
|---|---|
| SM-01 | Religious imagery MAY appear only as decoration or as a gently placed object, never as something kicked, thrown, splashed, or counted (PR-13). |
| SM-02 | Religious imagery MUST pass content review ([08-audio-narration.md](08-audio-narration.md), section Content review) before release. |
| SM-03 | All shapes are SVG and readable at 72 px. |

## Screen layout (Screen 4)

| Region | Contents |
|---|---|
| Top | Back button, instruction replay, sound toggle |
| Center | Source objects (left or top) and target outlines (right or bottom), depending on orientation |
| Bottom | Hint button, optional Reset |

## Gameplay

Example: a green circle on the left and two target outlines on the right. The child moves the circle to the matching outline.

**Correct:**
- Target gently highlights, object snaps into place.
- Rumi `celebrate`.
- Voice: "এটা সবুজ গোল!" (color + shape name).

**Incorrect:**
- Object glides back to its starting position.
- Voice: "আবার চেষ্টা করি!"
- No buzzer, no negative sound (PR-08).

## Difficulty

| Level | Options per activity | Attribute matched | Items per activity |
|---|---|---|---|
| Beginner | 2 targets | Color **or** shape (alternating across the round) | 1 |
| Explorer | 3 targets | Color **or** shape | 1–2 |
| Advanced | 3 targets | Shape **and** color together | 2–3 |

## Matching logic

```typescript
// packages/core/src/shape-matching/matchValidator.ts
export interface MatchItem {
  id: string;
  shape: string;
  color: Color;
}

export type MatchMode = "shape" | "color" | "both";

export function isCorrectMatch(source: MatchItem, target: MatchItem, mode: MatchMode): boolean {
  if (mode === "shape") return source.shape === target.shape;
  if (mode === "color") return source.color === target.color;
  return source.shape === target.shape && source.color === target.color;
}
```

| ID | Requirement |
|---|---|
| SM-10 | Activity generation MUST guarantee exactly one correct target per source item. |
| SM-11 | In `color` mode, distractor targets MUST differ in color; in `shape` mode they MUST differ in shape. |
| SM-12 | Generation is seeded and deterministic for tests. |
| SM-13 | The learning-color budget (DS-10) applies when choosing colors. |

## Input methods

| ID | Requirement |
|---|---|
| SM-20 | Drag and drop MUST work with mouse and touch. |
| SM-21 | Tap-to-match MUST work: tap object, then tap target. This is required because dragging is hard for young children. |
| SM-22 | Keyboard: Tab to the object, Enter to select, Tab to a target, Enter to place. |
| SM-23 | A drop near a target (within 24 px of its outline) counts as a drop on it. |

## State machine

```typescript
type MatchingState =
  | "IDLE"
  | "SOURCE_SELECTED"
  | "DRAGGING"
  | "VALIDATING"
  | "SNAPPED"
  | "RETURNING"
  | "CELEBRATING"
  | "COMPLETE";
```

| From | Event | Guard | To | Effects |
|---|---|---|---|---|
| `IDLE` | `TAP_SOURCE(item)` | Item not matched | `SOURCE_SELECTED` | Highlight item, narrate its name |
| `IDLE` | `DRAG_START(item)` | Item not matched | `DRAGGING` | Item follows pointer |
| `SOURCE_SELECTED` | `TAP_SOURCE(other)` | — | `SOURCE_SELECTED` | Move selection to `other` |
| `SOURCE_SELECTED` | `TAP_TARGET(t)` | — | `VALIDATING` | — |
| `SOURCE_SELECTED` | `TAP_EMPTY` | — | `IDLE` | Clear selection |
| `DRAGGING` | `DROP(t)` | Dropped on a target | `VALIDATING` | — |
| `DRAGGING` | `DROP(none)` / `DRAG_CANCEL` | — | `RETURNING` | Glide back, no narration |
| `VALIDATING` | — | `isCorrectMatch` true | `SNAPPED` | Snap, highlight, narrate name |
| `VALIDATING` | — | `isCorrectMatch` false | `RETURNING` | Narrate retry, `attempts++` |
| `SNAPPED` | `SNAP_DONE` | Unmatched items remain | `IDLE` | — |
| `SNAPPED` | `SNAP_DONE` | All items matched | `CELEBRATING` | Rumi `celebrate` |
| `RETURNING` | `RETURN_DONE` | — | `IDLE` | Hint enabled when `attempts ≥ 2` |
| `IDLE` | `HINT` | Hint enabled | `IDLE` | Correct target pulses softly, name narrated |
| `CELEBRATING` | `CELEBRATION_DONE` | — | `COMPLETE` | Show Next, record progress |
| `COMPLETE` | `NEXT` | — | `IDLE` | Load next activity |
| *any* | `RESET` | — | `IDLE` | All items return to start |

| ID | Requirement |
|---|---|
| SM-30 | Unlisted events are ignored. |
| SM-31 | A matched item cannot be picked up again. |
| SM-32 | Only one item can be dragged at a time (multi-touch ignored). |

## Edge cases

| ID | Case | Expected behavior |
|---|---|---|
| SM-40 | Pointer leaves the window mid-drag | Treated as `DRAG_CANCEL` |
| SM-41 | Second finger touches during a drag | Ignored |
| SM-42 | Orientation change mid-drag | Cancel drag, item returns, layout reflows |
| SM-43 | Reset or back during snap animation | Clean cancel, no errors |
| SM-44 | Audio muted | Name shown as caption above the item |

## Files

```text
packages/core/src/shape-matching/matchValidator.ts
packages/core/src/shape-matching/matchingMachine.ts
packages/core/src/shape-matching/shapes.ts
packages/core/src/shape-matching/activityGenerator.ts
packages/core/tests/shape-matching/*.test.ts
apps/desktop/src/routes/matching/+page.svelte
apps/desktop/src/lib/features/shape-matching/components/*.svelte
assets/shapes/*.svg
```

## Tests

**Unit:** `isCorrectMatch` for all three modes; generator rules SM-10 to SM-12; every transition-table row.
**Integration:** correct drag snaps; incorrect drag returns; tap-to-match works; hint after 2 misses.
**E2E:** complete one round using drag only, and one round using tap only.

## Acceptance checklist

- [ ] All 8 shapes available as SVG.
- [ ] Drag, tap, and keyboard input all complete an activity.
- [ ] Gentle incorrect feedback with no negative sound.
- [ ] Three difficulty levels behave as in the table.
- [ ] Edge cases SM-40 to SM-44 handled.

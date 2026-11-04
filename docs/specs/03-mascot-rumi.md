# 03 — Mascot: Rumi

**Depends on:** [02-design-system.md](02-design-system.md), [14-assets-placeholders.md](14-assets-placeholders.md)
**Used by:** 05, 06, 07, 09, 12
**Phase:** 4 (a static placeholder may be used from Phase 1)

## Character

| Item | Value |
|---|---|
| Name | Rumi (রুমি) |
| Species | Young Royal Bengal tiger cub, a nod to Bangladesh's national animal |
| Personality | Cheerful, playful, curious, encouraging |
| Signature action | Kicks a football into a goal |

### Visual guidelines

| ID | Requirement |
|---|---|
| MA-01 | Body built from simple geometric shapes: circle head, oval body, short limbs. |
| MA-02 | Big friendly eyes, small smile, no visible teeth or claws. |
| MA-03 | 3–5 soft simplified stripes; never realistic or aggressive. |
| MA-04 | Fur uses a muted, desaturated orange clearly different from learning Orange `#F28C28`; mascot colors are excluded from the learning-color budget. |
| MA-05 | A small green scarf MAY be used as a recognizable accessory. |
| MA-06 | MUST be original; MUST NOT resemble Talking Tom or any existing character (PR-12). |

## Animation states

```typescript
type MascotAnimation =
  | "idle"
  | "wave"
  | "thinking"
  | "celebrate"
  | "kick"
  | "encourage"
  | "rest";
```

| State | Behavior | Max duration | Reduced-motion alternative |
|---|---|---|---|
| `idle` | Gentle breathing, occasional blink, minimal movement | Loop | Static pose, occasional blink |
| `wave` | Friendly wave (welcome, rest) | 1.5 s | Static waving pose |
| `thinking` | Head tilt while the child decides | Loop | Static tilted pose |
| `celebrate` | One short happy jump, small arm movement, optional gentle sparkle | 2 s | Smile + fade-in sparkle, no jump |
| `kick` | Approach football, kick, ball travels to goal, short success sound | 2 s | Ball fades into goal |
| `encourage` | Friendly gesture + positive voice line; never disappointed | 1.5 s | Static gesture |
| `rest` | Wave, then sleepy calm pose | Loop | Static sleepy pose |

## Requirements

| ID | Requirement |
|---|---|
| MA-10 | A single `AnimationController` owns the mascot; only one animation plays at a time. |
| MA-11 | Requesting a new animation cancels the current one cleanly and returns a promise that resolves when done or cancelled. |
| MA-12 | Animations MUST be driven by game state-machine events, never by timers inside components. |
| MA-13 | Target 60 FPS; MUST remain usable at 30 FPS. |
| MA-14 | No sudden camera movement and no flashing transitions (PR-06). |
| MA-15 | Every state MUST have a reduced-motion alternative (table above). |
| MA-16 | When the game is paused (rest screen, app backgrounded), animations freeze and resume without jumping. |
| MA-17 | The mascot MUST never show sadness, anger, or disappointment. |
| MA-18 | Asset keys and state names MUST stay stable so final art can replace placeholder art with no code changes. |

## Interface

```typescript
interface MascotController {
  play(animation: MascotAnimation): Promise<"done" | "cancelled">;
  stop(): void;
  pause(): void;
  resume(): void;
  readonly current: MascotAnimation;
}
```

The interface lives in `packages/core`; implementations live in each app.

## Files

```text
packages/core/src/mascot/types.ts             # MascotAnimation, MascotController
apps/desktop/src/lib/components/mascot/Mascot.svelte
apps/desktop/src/lib/game/AnimationController.ts
apps/mobile/src/components/mascot/Mascot.tsx
assets/mascot/                                # placeholder SVG parts, later final art
```

## Tests

- Unit: controller cancels the previous animation; the promise resolves `"cancelled"`.
- Unit: reduced-motion flag selects the alternative variant.
- Integration: a correct answer triggers `celebrate`; completing color mixing triggers `kick`.
- Manual: 60 FPS on a mid-range device; no overlap under rapid taps.

## Acceptance checklist

- [ ] All 7 states implemented (placeholder art allowed).
- [ ] MA-10, MA-11: no overlapping animations.
- [ ] MA-15: reduced-motion variants work.
- [ ] MA-16: pause and resume work.

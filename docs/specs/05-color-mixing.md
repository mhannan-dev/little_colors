# 05 — Game Mode A: Football Color Mixing

**Depends on:** 01, 02, 03, 04, [08-audio-narration.md](08-audio-narration.md), [11-curriculum-progress.md](11-curriculum-progress.md)
**Phase:** 2 (first vertical slice; build and test this before anything else)

## Learning objective

Teach how pigment colors combine into familiar secondary colors, using simplified educational paint-mixing rules (not physical or spectral simulation).

## Scope

**In:** football, two or three paint containers, pour/mix/kick sequence, three recipes, reset, Next.
**Out:** custom colors, color picker, tints and shades, mixing more than two colors at once.

## Screen layout (Screen 3)

| Region | Contents |
|---|---|
| Top | Back button, instruction replay button, sound toggle |
| Center | Rumi, large football (white at start), goal |
| Bottom | Two (or three in Advanced) large paint containers; Reset button once a color is applied |
| Caption | Instruction text under the top bar (visual equivalent of narration) |

## Gameplay sequence (Beginner / Explorer)

1. **Ready:** football is white; two containers appear; Rumi introduces: "লাল আর হলুদ রং মেশাই!"
2. **First color:** child taps (or drags) red. Red pours onto the football, which turns red. Voice: "এটা লাল রং!"
3. **Second color:** child taps yellow. Yellow pours, a short mixing swirl plays, and the football turns orange.
4. **Learning feedback:** "লাল আর হলুদ মিলে কমলা রং হলো!"
5. **Celebration:** Rumi kicks the orange ball into the goal. Optional (if Islamic expressions are enabled): "মাশাআল্লাহ! খুব সুন্দর!"
6. **Next:** a large Next button appears. There is no automatic progression.

**Advanced variation:** the target is named first ("সবুজ বানাই!") and three containers are offered. The child picks two. A wrong pair still produces its real result (for example red + blue makes purple, with that narration), then Rumi invites another try: "এবার সবুজ বানাই!"

## Mixing rules

| ID | Requirement |
|---|---|
| CM-01 | Supported recipes: red + yellow = orange, yellow + blue = green, red + blue = purple. |
| CM-02 | Mixing MUST be order-independent. |
| CM-03 | The result MUST come from the pure function `mixColors`; no RGB averaging. |
| CM-04 | Unsupported pairs return `null` and are handled gracefully (see transition table). |

```typescript
// packages/core/src/color-mixing/colorMixer.ts
const MIXING_RECIPES: Record<string, Color> = {
  "red+yellow": "orange",
  "blue+yellow": "green",
  "blue+red": "purple",
};

export function mixColors(first: Color, second: Color): Color | null {
  const key = [first, second].sort().join("+");
  return MIXING_RECIPES[key] ?? null;
}
```

## State machine

```typescript
type MixingState =
  | "READY"
  | "FIRST_COLOR_SELECTED"
  | "FIRST_COLOR_APPLIED"
  | "SECOND_COLOR_SELECTED"
  | "MIXING"
  | "RESULT"
  | "CELEBRATING"
  | "COMPLETE";

type MixingEvent =
  | { type: "SELECT_COLOR"; color: Color }
  | { type: "POUR_DONE" }
  | { type: "MIX_DONE" }
  | { type: "RESULT_SHOWN" }
  | { type: "CELEBRATION_DONE" }
  | { type: "NEXT" }
  | { type: "RESET" };

interface MixingContext {
  offered: Color[];          // 2 or 3 containers
  target: Color | null;      // Advanced only
  first: Color | null;
  second: Color | null;
  footballColor: Color | "white";
  result: Color | null;
}
```

### Transition table

| From | Event | Guard | To | Effects |
|---|---|---|---|---|
| `READY` | `SELECT_COLOR(c)` | `c` in `offered` | `FIRST_COLOR_SELECTED` | Lock input, play pour animation |
| `FIRST_COLOR_SELECTED` | `POUR_DONE` | — | `FIRST_COLOR_APPLIED` | `footballColor = c`, unlock input, narrate color name |
| `FIRST_COLOR_APPLIED` | `SELECT_COLOR(c2)` | `c2 !== first`, `c2` in `offered` | `SECOND_COLOR_SELECTED` | Lock input, play pour animation |
| `FIRST_COLOR_APPLIED` | `SELECT_COLOR(c2)` | `c2 === first` | `FIRST_COLOR_APPLIED` | No change; gentle wiggle on the other container |
| `SECOND_COLOR_SELECTED` | `POUR_DONE` | — | `MIXING` | Play mixing swirl |
| `MIXING` | `MIX_DONE` | result ≠ null and (no target or result = target) | `RESULT` | `footballColor = result`, narrate recipe sentence |
| `MIXING` | `MIX_DONE` | result ≠ null and result ≠ target (Advanced) | `READY` | Show result briefly, narrate it, then invite retry; football back to white |
| `MIXING` | `MIX_DONE` | result = null | `READY` | Football back to white, narrate "চলো আবার চেষ্টা করি!" |
| `RESULT` | `RESULT_SHOWN` | ≥ 1.5 s elapsed (does **not** wait for narration) | `CELEBRATING` | Rumi `kick`, ball to goal |
| `CELEBRATING` | `CELEBRATION_DONE` | — | `COMPLETE` | Show Next, record progress |
| `COMPLETE` | `NEXT` | — | `READY` | Load next activity in the round |
| *any* | `RESET` | — | `READY` | Cancel animations and narration, football white |

| ID | Requirement |
|---|---|
| CM-10 | Events not listed for the current state MUST be ignored (no error, no change). |
| CM-11 | Input is locked during pour, mix, and celebration animations. |
| CM-12 | Rapid repeated taps MUST NOT trigger duplicate transitions. |
| CM-13 | Cancelling an animation MUST NOT corrupt state; the football is never in an undefined color. |
| CM-14 | Audio failure or mute MUST NOT block progression. |
| CM-15 | In reduced-motion mode, `POUR_DONE`, `MIX_DONE`, and `CELEBRATION_DONE` fire after a ≤ 300 ms fade. |
| CM-16 | Pause (tab hidden, rest screen) freezes animations and timers without changing state. |

## Input

| ID | Requirement |
|---|---|
| CM-20 | Tapping a container selects it (primary input). |
| CM-21 | Dragging a container onto the football also selects it; a drag released elsewhere cancels with no state change. |
| CM-22 | Keyboard: containers are focusable buttons; Enter/Space selects. |
| CM-23 | Each container shows its color, a distinct pattern or label, and speaks its name on focus (PR-24). |

## Narration keys used

`mix.intro.<recipe>`, `color.<color>`, `mix.result.<recipe>`, `mix.retry`, `mix.target.<color>`, `feedback.celebrate`.
All keys are defined in [08-audio-narration.md](08-audio-narration.md).

## Edge cases

| ID | Case | Expected behavior |
|---|---|---|
| CM-30 | Repeated taps during pour | Ignored |
| CM-31 | Drag interrupted (pointer cancel) | Container returns, no state change |
| CM-32 | Invalid or unsupported combination | Graceful retry (transition table) |
| CM-33 | Audio fails to load or play | Caption shown, flow continues |
| CM-34 | Tab or app goes to background mid-animation | Pause; resume where it stopped |
| CM-35 | Orientation change mid-animation | Layout reflows; state preserved |
| CM-36 | Reset during animation | Animation cancelled, `READY` state |
| CM-37 | Back navigation during animation | Animations and narration stop; no errors after leaving |

## Files

```text
packages/core/src/color-mixing/colorMixer.ts
packages/core/src/color-mixing/recipes.ts
packages/core/src/color-mixing/mixingMachine.ts
packages/core/tests/color-mixing/*.test.ts
apps/desktop/src/routes/mixing/+page.svelte
apps/desktop/src/lib/features/color-mixing/components/MixingScene.svelte
apps/desktop/src/lib/components/football/Football.svelte
apps/desktop/src/lib/components/paint/PaintContainer.svelte
```

## Tests

**Unit (core):**
- All 3 recipes, in both orders (CM-01, CM-02).
- Unsupported pairs and same color twice return `null` (CM-04).
- Every row of the transition table, including ignored events (CM-10).
- `RESET` from every state (CM-36).

**Integration (web):**
- Select first color → football turns that color.
- Select second color → result color, Next appears.
- Rapid double tap triggers only one transition (CM-12).
- Mute during narration → flow still completes (CM-14).
- Navigate back during animation → no console errors (CM-37).

**E2E (Playwright):** complete one full round of color mixing at Beginner.

## Acceptance checklist

- [ ] CM-01 to CM-04 pass unit tests.
- [ ] Transition table fully implemented and tested.
- [ ] Works with tap, drag, and keyboard.
- [ ] Reduced-motion and mute paths work.
- [ ] All edge cases CM-30 to CM-37 handled.
- [ ] Advanced target variation works.

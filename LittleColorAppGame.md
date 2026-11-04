# Little Colors — AI Agent Implementation Specification

**Version:** 1.2  
**Document Type:** Product Requirements Document + Technical Design + AI Coding Agent Instructions  
**Product Category:** Educational Game for Young Children  
**Primary Language:** Bengali (Bangladesh)  
**Secondary Language:** English  
**Target Platforms:** Desktop first (Tauri + SvelteKit UI), then native Android & iOS (React Native); no public web/PWA version planned  
**Development Approach:** Offline-first, modular, test-driven

> **Feature-wise specs:** this document is split into agent-ready feature files in [docs/specs/](docs/specs/00-README.md). Give AI agents those files, one feature at a time. When you change a requirement, update the feature file and this master document together.

---

# 1. AI AGENT ROLE & OBJECTIVE

You are acting as a team of senior specialists:

1. Senior Educational Game Designer
2. Child-Centered UI/UX Designer
3. Early Childhood Learning Specialist
4. Senior Frontend Engineer
5. Game Animation Engineer
6. Software Architect
7. Accessibility and Child Safety Engineer
8. QA Automation Engineer

Your responsibility is to design, implement, test, and document a complete educational game based on this specification.

Do not create a static demonstration disguised as a functional game.

Every interactive element must have working behavior, visible feedback, and appropriate state management.

## Primary objective

Build a playful, visually calm, responsive, offline-capable educational game that helps children learn:

- Primary colors
- Secondary colors
- Basic color mixing
- Shape recognition
- Color matching
- Early numeracy: counting, numerals, comparison, simple addition, patterns
- Simple Bengali vocabulary
- Positive Islamic expressions in an age-appropriate context

The application must prioritize children's comfort, accessibility, learning, privacy, and enjoyment over engagement metrics.

## Non-negotiable principles

- No advertisements.
- No in-app purchases.
- No public chat or social features.
- No external links accessible directly from the child interface.
- No unnecessary data collection.
- No flashing or rapidly blinking animations.
- No artificial pressure, streaks, or competitive leaderboards.
- No punishment for incorrect answers.
- No dependency on internet connectivity during gameplay.

---

# 2. TARGET AUDIENCE & DEVELOPMENTAL DESIGN

## Primary audience

Children approximately 3–6 years old.

The app must support different developmental abilities rather than assuming all children of the same age have identical skills.

## Age-adaptive gameplay

### Beginner mode

Recommended for children beginning to recognize colors and shapes.

- One learning objective per screen.
- Two selectable options.
- Large touch targets.
- Simple animations.
- Spoken instructions.
- No countdown timers.
- No negative feedback.

### Explorer mode

For children comfortable with basic color recognition.

- Two to three choices.
- Basic color mixing.
- Simple shape matching.
- Gradual introduction of secondary colors.

### Advanced mode

For children ready for more complex activities.

- Three-choice matching.
- Multiple-step color mixing.
- Color identification in familiar objects.
- Optional guided challenges without time pressure.

Difficulty should be configurable by a parent.

The system may recommend a difficulty level based on completed activities, but must not automatically increase difficulty in a way that frustrates the child.

---

# 3. VISUAL DESIGN SYSTEM

## 3.1 Visual identity

The visual identity must be:

- Soft
- Minimal
- Cheerful
- Friendly
- Predictable
- Non-distracting

Use rounded geometric shapes and a consistent illustration style.

Avoid visually crowded screens.

## 3.2 Color system

The original design goal is to show no more than two or three prominent learning colors simultaneously.

Implement this as a **learning-color budget**, not an absolute limit on every pixel or UI color.

Neutral backgrounds, text, outlines, and accessibility indicators may use additional colors where necessary.

### Background palette

| Token | Value | Usage |
|---|---|---|
| `bg-primary` | `#FFF9F0` | Main background |
| `bg-secondary` | `#F4F8F5` | Alternate calm background |
| `surface` | `#FFFFFF` | Interactive surfaces |
| `text-primary` | `#263238` | Primary text |
| `text-secondary` | `#52616B` | Secondary text |
| `border-soft` | `#DCE5E1` | Borders |

### Learning colors

| Color | Hex |
|---|---|
| Red | `#E5484D` |
| Yellow | `#F2C94C` |
| Blue | `#3478D4` |
| Orange | `#F28C28` |
| Green | `#35A66A` |
| Purple | `#8A5AC2` |

Colors must remain visually distinguishable on their intended backgrounds.

Do not rely on color alone to communicate correctness or meaning. Use shape, outline, voice, or animation as additional cues.

## 3.3 Accessibility rules

- Interactive targets should generally be at least 56 × 56 CSS pixels.
- Primary gameplay targets should preferably be 72–96 CSS pixels or larger.
- Rounded corners: 24–32 pixels for major UI elements.
- Large readable fonts.
- Clear visual focus indicators.
- Support pointer, touch, and keyboard input where applicable.
- Respect `prefers-reduced-motion`.
- Provide a mute option.
- Do not use color alone for instructions.
- Ensure readable text contrast according to WCAG 2.2 AA where applicable.

## 3.4 Display modes

Implement:

1. Default warm mode.
2. Optional dark mode.
3. Reduced-motion mode.

Do not claim that a particular palette or dark mode medically prevents eye strain.

Allow parents to adjust brightness through device settings.

## 3.5 Responsive behavior

Primary design target: mobile and tablet landscape/portrait.

Support:

- Small mobile screens
- Large mobile screens
- Tablets
- Desktop browsers

The game must adapt to available space without cutting off primary interaction areas.

Avoid requiring horizontal scrolling.

---

# 4. CHARACTER DESIGN

## 4.1 Main mascot

Create an original, friendly, animated animal mascot named **Rumi**.

**Species:** Rumi is a young Royal Bengal tiger cub (রুমি, the little tiger), a nod to Bangladesh's national animal.

**Visual guidelines:**

- Round, chunky body built from simple geometric shapes (circle head, oval body, short limbs).
- Big friendly eyes, small smile, no visible teeth or claws.
- Simplified stripes (3–5 soft curved strokes), never aggressive or realistic.
- Fur uses a muted, desaturated orange that is clearly different from the learning color Orange (`#F28C28`), so Rumi never confuses a color lesson. Rumi's colors do not count toward the learning-color budget.
- A small green scarf may be used as a recognizable accessory.

Rumi should be:

- Cheerful and playful.
- Visually simple.
- Easy to recognize.
- Capable of kicking a football.
- Able to express excitement, curiosity, and encouragement.

The mascot may use the playful responsiveness associated with virtual-pet games, but must not copy Talking Tom's character design, voice, branding, or protected assets.

## 4.2 Character animation states

Define these states:

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

### Idle

- Gentle breathing.
- Occasional blinking.
- Minimal movement.

### Celebrate

- One short happy jump.
- Small arm movement.
- Optional gentle sparkle effect.

### Kick

- Character approaches football.
- Performs kick animation.
- Football moves toward goal.
- Short success sound plays.

### Encourage

- Friendly gesture.
- Positive Bengali voice line.
- No expression of disappointment.

### Rest

- Character waves.
- Gameplay pauses.
- Rest screen appears.

## 4.3 Animation constraints

- Prefer 60 FPS when hardware supports it.
- Maintain acceptable gameplay at 30 FPS on lower-end devices.
- Keep most celebratory animations below 2 seconds.
- Avoid sudden camera movement.
- Avoid flashing transitions.
- Provide reduced-motion alternatives.
- Prevent overlapping character animations.

---

# 5. GAME MODE A — FOOTBALL COLOR MIXING

## 5.1 Learning objective

Teach children how selected pigment colors combine to produce familiar secondary colors.

The app uses simplified educational pigment-mixing rules, not physically accurate spectral simulation.

## 5.2 Core gameplay

The child sees:

1. Rumi the mascot.
2. A football with colorable panels.
3. Two paint containers.
4. A simple instruction area.
5. An optional audio replay button.

Example:

**Instruction:** "লাল আর হলুদ রং মেশাই!"

### Gameplay sequence

**Step 1 — Initial state**

- Football is white.
- Two paint containers appear.
- Rumi introduces the activity.

**Step 2 — First color**

- Child taps or drags the red paint container.
- Red paint pours onto the football.
- Football becomes red.
- Voice says: "এটা লাল রং!"

**Step 3 — Second color**

- Child taps or drags the yellow paint container.
- Yellow paint pours onto the football.
- A short mixing animation plays.
- Football becomes orange.

**Step 4 — Learning feedback**

Voice:

"লাল আর হলুদ মিলে কমলা রং হলো!"

**Step 5 — Celebration**

- Rumi kicks the orange football.
- Football enters a goal.
- Short celebration animation plays.
- Optional voice: "মাশাআল্লাহ! খুব সুন্দর!"

**Step 6 — Next activity**

- A large Next button appears.
- No automatic forced progression.

## 5.3 Supported mixing recipes

| First color | Second color | Result |
|---|---|---|
| Red | Yellow | Orange |
| Yellow | Blue | Green |
| Red | Blue | Purple |

Mixing must be order-independent.

For example:

`Red + Yellow = Yellow + Red = Orange`

## 5.4 State machine

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
```

### Transition table

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| `READY` | `SELECT_COLOR(c)` | `c` is one of the offered containers | `FIRST_COLOR_SELECTED` | Lock input, start pour animation |
| `FIRST_COLOR_SELECTED` | `POUR_DONE` | — | `FIRST_COLOR_APPLIED` | Football = `c`, unlock input, narrate color name |
| `FIRST_COLOR_APPLIED` | `SELECT_COLOR(c2)` | `c2 !== first` | `SECOND_COLOR_SELECTED` | Lock input, start pour animation |
| `FIRST_COLOR_APPLIED` | `SELECT_COLOR(c2)` | `c2 === first` | `FIRST_COLOR_APPLIED` | No state change; gentle container wiggle on the other color |
| `SECOND_COLOR_SELECTED` | `POUR_DONE` | — | `MIXING` | Start mixing animation |
| `MIXING` | `MIX_DONE` | `mixColors(first, c2) !== null` | `RESULT` | Football = result, narrate recipe sentence |
| `MIXING` | `MIX_DONE` | `mixColors(first, c2) === null` | `READY` | Football returns to white, narrate "চলো আবার চেষ্টা করি!" |
| `RESULT` | `RESULT_SHOWN` | Minimum display time (1.5 s) elapsed; does **not** wait for narration | `CELEBRATING` | Rumi kick animation, football to goal |
| `CELEBRATING` | `CELEBRATION_DONE` | — | `COMPLETE` | Show Next button, record progress |
| `COMPLETE` | `NEXT` | — | `READY` | Load next activity from curriculum |
| *any* | `RESET` | — | `READY` | Cancel animations and narration, football = white |

Rules:

- Any event not listed for the current state is ignored (no error, no state change).
- In reduced-motion mode, `POUR_DONE`, `MIX_DONE`, and `CELEBRATION_DONE` fire after a short fade (≤ 300 ms) instead of full animations.
- Pause (tab hidden, rest screen) is an orthogonal flag: it freezes timers and animations but never changes the state.

### Transition requirements

- Only valid transitions are allowed.
- Input must be temporarily disabled during critical animations.
- Rapid repeated taps must not trigger duplicate actions.
- Reset must restore the initial state.
- Animation cancellation must not corrupt the game state.
- Sound playback must not block state progression.
- The result must be determined by a pure color-mixing function.

## 5.5 Color-mixing logic

```typescript
type Color =
  | "red"
  | "yellow"
  | "blue"
  | "orange"
  | "green"
  | "purple";

const MIXING_RECIPES: Record<string, Color> = {
  "red+yellow": "orange",
  "blue+yellow": "green",
  "blue+red": "purple",
};

function mixColors(
  first: Color,
  second: Color
): Color | null {
  const key = [first, second].sort().join("+");

  return MIXING_RECIPES[key] ?? null;
}
```

Do not calculate the result using simple RGB averaging.

RGB additive light mixing differs from the simplified paint-mixing model used in this game.

## 5.6 Edge cases

Handle:

- Repeated taps.
- Drag interruption.
- Invalid color combinations.
- Audio playback failure.
- Browser tab becoming inactive.
- Screen orientation changes.
- Reset during animation.
- Rapid switching between activities.

No edge case should leave the football in an undefined state.

---

# 6. GAME MODE B — COLOR & SHAPE MATCHING

## 6.1 Learning objective

Help children identify shapes and colors through matching activities.

## 6.2 Shape library

Initial shapes:

- Football
- Circle
- Star
- Crescent moon
- Square
- Triangle
- Leaf
- Apple

Optional Islamic-themed visual objects:

- Mosque silhouette
- Prayer mat illustration
- Simple geometric Islamic patterns

Respectful religious imagery must be age-appropriate and reviewed before release.

Do not treat sacred objects as targets for kicking, throwing, splashing paint, or other potentially disrespectful interactions.

## 6.3 Gameplay

Example:

- Left side: a green circle.
- Right side: two large target outlines.
- Child drags the green circle to the matching outline.

When correct:

- Target gently highlights.
- Object snaps into place.
- Rumi celebrates.
- Voice says: "এটা সবুজ গোল!"

When incorrect:

- Object gently returns to its original position.
- Voice says: "আবার চেষ্টা করি!"
- No buzzer or negative sound.

## 6.4 Input methods

Support both:

1. Drag and drop.
2. Tap object, then tap destination.

Tap-to-match is required because drag-and-drop can be difficult for younger children.

## 6.5 Matching validation

```typescript
interface MatchItem {
  id: string;
  shape: string;
  color: Color;
}

function isCorrectMatch(
  source: MatchItem,
  target: MatchItem,
  mode: "shape" | "color" | "both"
): boolean {
  if (mode === "shape") {
    return source.shape === target.shape;
  }

  if (mode === "color") {
    return source.color === target.color;
  }

  return (
    source.shape === target.shape &&
    source.color === target.color
  );
}
```

## 6.6 Difficulty progression

Beginner:

- Two options.
- One attribute to match.

Explorer:

- Three options.
- Shape or color matching.

Advanced:

- Shape and color matching together.

Avoid arbitrary time limits.

## 6.7 State machine

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

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| `IDLE` | `TAP_SOURCE(item)` | Item not yet matched | `SOURCE_SELECTED` | Highlight item, narrate its name |
| `IDLE` | `DRAG_START(item)` | Item not yet matched | `DRAGGING` | Item follows pointer |
| `SOURCE_SELECTED` | `TAP_SOURCE(other)` | — | `SOURCE_SELECTED` | Selection moves to `other` |
| `SOURCE_SELECTED` | `TAP_TARGET(t)` | — | `VALIDATING` | — |
| `SOURCE_SELECTED` | `TAP_EMPTY` | — | `IDLE` | Clear selection |
| `DRAGGING` | `DROP(t)` | Dropped on a target | `VALIDATING` | — |
| `DRAGGING` | `DROP(none)` / `DRAG_CANCEL` | — | `RETURNING` | Item glides back, no narration |
| `VALIDATING` | — | `isCorrectMatch()` true | `SNAPPED` | Snap item, highlight target, narrate name |
| `VALIDATING` | — | `isCorrectMatch()` false | `RETURNING` | Narrate "আবার চেষ্টা করি!", attempts++ |
| `SNAPPED` | `SNAP_DONE` | Unmatched items remain | `IDLE` | — |
| `SNAPPED` | `SNAP_DONE` | All items matched | `CELEBRATING` | Rumi celebrates |
| `RETURNING` | `RETURN_DONE` | — | `IDLE` | Hint becomes available when attempts ≥ 2 |
| `CELEBRATING` | `CELEBRATION_DONE` | — | `COMPLETE` | Show Next button |
| `COMPLETE` | `NEXT` | — | `IDLE` | Load next activity |
| *any* | `RESET` | — | `IDLE` | All items return to start |

---

# 7. GAME MODE C — NUMBERS & COUNTING (MATH)

## 7.1 Learning objective

Introduce early numeracy through play:

- Counting objects (1–10)
- Recognizing numerals in both Bengali (০–৯) and English (0–9) digits
- Matching a numeral to a quantity
- Comparing quantities (more / fewer / same)
- Very simple addition with visible objects
- Recognizing and continuing simple patterns

Math activities must stay concrete and visual. Every number is always shown together with countable objects; abstract arithmetic without objects is out of scope for the MVP.

## 7.2 Number range by difficulty

| Mode | Counting range | Addition | Comparison |
|---|---|---|---|
| Beginner | 1–5 | Not shown | Two groups, large visible difference |
| Explorer | 1–10 | Sums up to 5 | Two groups, smaller difference, "same" introduced |
| Advanced | 1–10 | Sums up to 10 | Two groups, any difference |

## 7.3 Countable objects

Use objects already familiar from the game:

- Footballs
- Apples
- Stars
- Leaves
- Paint drops
- Circles and squares

Objects in one counting group must share one shape and one learning color so the child counts quantity rather than sorting attributes.

Do not use sacred or religious objects (mosque, prayer mat, Qur'an) as counting items, kicking targets, or quantities to be "taken away".

## 7.4 Activities

### Activity C1 — Count with Rumi

1. A small number of footballs appear in a row.
2. Instruction: "চলো গুনি! কয়টা বল?"
3. The child taps each ball; each tapped ball gently bounces and Rumi says its number ("এক", "দুই", "তিন"…).
4. A tapped ball is marked as counted (outline + small tick) and cannot be counted twice.
5. After the last ball, Rumi says the total: "মোট তিনটা বল!"
6. Large numeral appears (৩ / 3 depending on settings) and Rumi kicks one ball into the goal.

### Activity C2 — Number to quantity

1. A large numeral is shown, e.g. ৪.
2. Two (Beginner) or three (Explorer/Advanced) baskets are shown with different numbers of apples.
3. The child drags or taps the numeral onto the basket with the matching quantity.
4. Correct: basket highlights, apples are counted aloud one by one, Rumi celebrates.
5. Incorrect: numeral returns gently, Rumi says "চলো আবার গুনে দেখি!" and the hint button can count the apples aloud.

### Activity C3 — More or fewer

1. Two groups of stars appear, left and right.
2. Instruction: "কোন দিকে বেশি তারা?" (or "কম" in Explorer/Advanced).
3. The child taps one side.
4. Feedback pairs objects one-to-one with a soft connecting line so the extra objects are visible.
5. Explorer/Advanced may include equal groups with a "সমান" button.

### Activity C4 — Simple addition

1. Rumi has 2 red balls; a friend rolls in 1 blue ball.
2. Instruction: "দুইটা আর একটা মিলে কয়টা?"
3. The child chooses the answer from two or three large numeral buttons, each shown with its matching dots.
4. Correct: the balls slide together and are counted aloud, "দুই আর এক মিলে তিন!"
5. The plus sign is introduced visually only in Advanced mode.

Subtraction is out of scope for the MVP.

### Activity C5 — Pattern completion

1. A row such as লাল – নীল – লাল – নীল – ? is shown with circles.
2. The child picks the next item from two or three options.
3. Beginner: AB patterns only. Explorer: AB and AAB. Advanced: ABC.
4. Patterns use both color and shape so the activity never depends on color alone.

## 7.5 Feedback rules

- No timers, no scores, no star ratings.
- Wrong answers never subtract anything or show red crosses.
- After two incorrect attempts, the hint automatically becomes available (counting aloud with highlight), but the answer is never forced.
- Counting narration must be synchronized with the highlighted object.

## 7.6 State machine

```typescript
type CountingState =
  | "READY"
  | "COUNTING"
  | "ANSWER_SELECTED"
  | "VALIDATING"
  | "CORRECT"
  | "TRY_AGAIN"
  | "CELEBRATING"
  | "COMPLETE";
```

| From | Event | Guard | To | Side effects |
|---|---|---|---|---|
| `READY` | `TAP_OBJECT(o)` | Activity is `count` | `COUNTING` | Mark `o` counted, narrate "এক" |
| `COUNTING` | `TAP_OBJECT(o)` | `o` not yet counted, more remain | `COUNTING` | count++, narrate number |
| `COUNTING` | `TAP_OBJECT(o)` | `o` already counted | `COUNTING` | Ignored; object gives a tiny wiggle |
| `COUNTING` | `TAP_OBJECT(o)` | `o` is the last uncounted object | `CORRECT` | Narrate total ("মোট তিনটা বল!"), show numeral |
| `READY` | `SELECT_ANSWER(a)` | Activity is not `count` | `ANSWER_SELECTED` | Highlight chosen answer, lock input |
| `ANSWER_SELECTED` | — | — | `VALIDATING` | Pure validation function runs |
| `VALIDATING` | — | Answer correct | `CORRECT` | Visual explanation (pairing lines, sliding balls, counting aloud) |
| `VALIDATING` | — | Answer incorrect | `TRY_AGAIN` | Narrate encouragement, attempts++ |
| `TRY_AGAIN` | `FEEDBACK_DONE` | — | `READY` | Unlock input; hint auto-available when attempts ≥ 2 |
| `READY` | `HINT` | — | `READY` | Count objects aloud with highlight; input locked until done |
| `CORRECT` | `RESULT_SHOWN` | Minimum display time elapsed | `CELEBRATING` | Rumi celebrates / kicks a ball |
| `CELEBRATING` | `CELEBRATION_DONE` | — | `COMPLETE` | Show Next button, record progress |
| `COMPLETE` | `NEXT` | — | `READY` | Load next activity |
| *any* | `RESET` | — | `READY` | Clear counted marks and selection |

Same transition requirements as Section 5.4 apply: guarded transitions, input locked during critical animations, duplicate taps ignored, safe reset at any time.

## 7.7 Math logic

```typescript
type MathActivityKind =
  | "count"
  | "numeral-to-quantity"
  | "compare"
  | "add"
  | "pattern";

type CompareAnswer = "left" | "right" | "same";

function compareQuantities(left: number, right: number): CompareAnswer {
  if (left === right) return "same";
  return left > right ? "left" : "right";
}

function addQuantities(a: number, b: number, max: number): number | null {
  const sum = a + b;
  return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && sum <= max
    ? sum
    : null;
}

function nextInPattern<T>(sequence: T[], unit: T[]): T {
  return unit[sequence.length % unit.length];
}

const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

function toBengaliNumeral(n: number): string {
  return String(n).replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)]);
}
```

Question generation must be deterministic when given a seed so tests can reproduce activities.

Generated distractor options must never equal the correct answer and must stay within the difficulty's number range.

## 7.8 Number vocabulary

| Number | Bengali word | Numeral (bn) | Numeral (en) |
|---|---|---|---|
| 1 | এক | ১ | 1 |
| 2 | দুই | ২ | 2 |
| 3 | তিন | ৩ | 3 |
| 4 | চার | ৪ | 4 |
| 5 | পাঁচ | ৫ | 5 |
| 6 | ছয় | ৬ | 6 |
| 7 | সাত | ৭ | 7 |
| 8 | আট | ৮ | 8 |
| 9 | নয় | ৯ | 9 |
| 10 | দশ | ১০ | 10 |

Parents can choose whether numerals are displayed in Bengali digits, English digits, or both.

## 7.9 Edge cases

- Tapping the same object twice while counting.
- Tapping objects out of order (allowed; the count follows tap order).
- Answering before counting finishes.
- Reset or back navigation during counting narration.
- Narration muted: numbers must still appear visually above each counted object.
- Small screens: up to 10 objects must fit without overlap (wrap into two rows of 5).

---

# 8. ISLAMIC EDUCATIONAL CONTENT

## 8.1 Content philosophy

Islamic expressions should appear naturally as optional positive encouragement.

The game should remain focused on its core educational objectives.

## 8.2 Voice expression library

| Event | Bengali voice | English voice | Neutral line (Islamic expressions off) |
|---|---|---|---|
| Correct match | "মাশাআল্লাহ! খুব ভালো!" | "MashaAllah! Very good!" | "খুব ভালো!" / "Very good!" |
| Completed activity | "আলহামদুলিল্লাহ! আমরা শিখেছি!" | "Alhamdulillah! We learned it!" | "আমরা শিখেছি!" / "We learned it!" |
| New discovery | "সুবহানাল্লাহ! কী সুন্দর রং!" | "SubhanAllah! What a beautiful color!" | "কী সুন্দর রং!" / "What a beautiful color!" |
| Encouragement | "আবার চেষ্টা করি!" | "Let's try again!" | (same) |
| Rest time | "চলো একটু বিশ্রাম নিই!" | "Let's take a little rest!" | (same) |

Every narration key in `voiceManifest.ts` must have a Bengali line, an English line, and, where the line contains an Islamic expression, a neutral variant. A missing translation is a build-time error, not a silent fallback.

## 8.3 Content controls

Parents must be able to:

- Enable or disable optional Islamic expressions.
- Select Bengali or English instructional language.
- Mute audio.
- Replay spoken instructions.

Religious phrases must not be used as rewards for winning or as negative feedback for mistakes.

## 8.4 Content review process

Religious and Bengali-language content requires human review before release:

| Content | Reviewer | Checks |
|---|---|---|
| Islamic expressions and imagery | A knowledgeable adult chosen by the product owner (e.g. a local teacher or imam) | Correct wording and pronunciation, respectful context, no sacred object used in play actions |
| Bengali narration script | A native Bengali (Bangladesh) speaker | Natural, child-friendly wording; consistent dialect; correct number words |
| English narration script | A fluent English speaker | Simple vocabulary suitable for ages 3–6 |

Process:

1. The AI agent generates `docs/narration-script.md` listing every narration key with Bengali, English, and neutral text.
2. Reviewers record approval or requested changes in `docs/content-review.md` (reviewer role, date, keys reviewed, outcome).
3. The AI agent must never mark content as reviewed itself. Unreviewed content may be used during development but blocks release.

---

# 9. AUDIO & BENGALI VOICE SYSTEM

## 9.1 Audio categories

Define:

- Instruction narration
- Color names
- Shape names
- Positive feedback
- Mascot expressions
- Sound effects
- Optional background music

Background music should be disabled by default.

## 9.2 Audio engine

Use an audio manager that:

- Prevents overlapping narration.
- Supports audio queues.
- Supports cancellation.
- Supports mute/unmute.
- Respects browser autoplay restrictions.
- Stops or pauses audio when gameplay is paused.
- Provides a replay-instruction function.

## 9.3 Voice implementation

Preferred production approach:

Use pre-recorded Bengali audio files with a consistent child-friendly voice.

Browser Speech Synthesis may be used as a development fallback, but it must not be the only production audio mechanism because Bengali voice availability and quality vary by device.

Example asset naming:

```text
audio/
  bn-BD/
    colors/
      red.mp3
      yellow.mp3
      orange.mp3
    numbers/
      1.mp3 … 10.mp3
      total-3.mp3
    feedback/
      correct.mp3
      try-again.mp3
      mashallah.mp3
    instructions/
      mix-red-yellow.mp3
  en-US/
    colors/
    feedback/
    instructions/
```

All audio assets must be appropriately licensed or originally produced.

Provide captions or visual equivalents for essential spoken instructions.

---

# 10. SCREEN-BY-SCREEN SPECIFICATION

## Screen 1 — Welcome

### Components

- Rumi mascot
- App logo
- Large Play button
- Small parent-access button

### Behavior

- Mascot waves.
- Tap Play to open mode selection.
- No sign-up required.

## Screen 2 — Mode Selection

Three large activity cards:

**Color Mixing**

Visual: football and two paint containers.

**Shape Matching**

Visual: circle, star, and matching outlines.

**Numbers & Counting**

Visual: three footballs with the numeral ৩.

The cards must have spoken labels when selected or focused.

## Screen 3 — Color Mixing

### Layout

Top:

- Back button
- Instruction replay button
- Sound toggle

Center:

- Rumi mascot
- Large football

Bottom:

- Two large paint containers
- Reset button when applicable

### Interaction

Paint selection, mixing, result animation, celebration, and Next.

## Screen 4 — Shape Matching

### Layout

Top:

- Back button
- Instruction replay

Center:

- Matchable objects
- Matching target zones

Bottom:

- Gentle hint button
- Optional reset

## Screen 4B — Numbers & Counting

### Layout

Top:

- Back button
- Instruction replay
- Sound toggle

Center:

- Rumi mascot
- Countable objects (max two rows of 5)
- Numeral display

Bottom:

- Two or three large answer buttons (numeral + dots), when applicable
- Hint button ("count with me")

## Screen 5 — Completion

Display:

- Rumi celebrating
- One short congratulatory sentence
- Replay button
- Choose Another Game button

Do not display comparative rankings.

## Screen 6 — Rest Break

Display:

- Calm background
- Rumi resting
- Friendly rest message
- Parent-accessible continuation option

No loud sound or flashing notification.

## Screen 7 — Parent Settings

Accessible through a parent gate.

### Parent gate

The gate is a speed bump for young children, not a security mechanism.

1. The child-facing parent button is small, placed in a corner, and must be **held for 3 seconds** (a progress ring fills while holding). A tap does nothing.
2. A text-only question then appears, with **no audio**, written in words a 3–6-year-old cannot yet solve, e.g. "বারো যোগ সাত কত?" / "What is twelve plus seven?"
3. Four numeric answer buttons are shown. Questions are randomly generated with results between 11 and 30.
4. A correct answer opens settings. An incorrect answer closes the gate quietly and returns to the previous screen (no error sound, no lockout).
5. The gate must be keyboard and screen-reader accessible for adults.

Settings:

- Language
- Numeral style (Bengali / English / both)
- Audio volume
- Sound effects
- Optional Islamic expressions
- Difficulty level
- Reduced motion
- Session reminder interval
- Local progress reset

No personal information should be required.

---

# 11. SESSION MANAGEMENT & REST BREAKS

## 11.1 Session reminder

Default: 20 minutes of active gameplay.

The duration must be configurable by a parent.

This is a product setting, not a universal medical threshold.

## 11.2 Behavior

When the active gameplay timer reaches its threshold:

1. Complete the current safe interaction.
2. Pause gameplay.
3. Stop active animations.
4. Display the rest screen.
5. Play a gentle Bengali reminder if sound is enabled.

Suggested message:

"অনেক সুন্দর রং শিখেছি! এবার একটু বিশ্রাম নিই!"

## 11.3 Timer requirements

- Count active gameplay time, not total browser-open time.
- Pause when the application is in the background.
- Do not create multiple timers.
- Avoid notification loops.
- Restore the correct timer state after an application pause.
- Do not automatically resume gameplay without user interaction.

---

# 12. RECOMMENDED TECHNOLOGY STACK

## Frontend

- SvelteKit
- TypeScript
- Tailwind CSS
- PixiJS
- Web Audio API

## State management

- Svelte stores for shared application state.
- Explicit finite state machines for gameplay.
- Pure TypeScript functions for educational rules.

## Animation

- **SVG + CSS animations are the default** for UI, shapes, counting objects, paint containers, and simple transitions.
- **PixiJS is used only where SVG/CSS is insufficient:** the mascot (Rumi) and the football pour/mix/kick scene. It is lazy-loaded on the routes that need it, never in the initial bundle.
- If an SVG/CSS implementation of the mascot and football scene meets the performance targets in Section 15 on a mid-range Android device, PixiJS may be dropped entirely. Record the decision and the measurement in `docs/decisions/animation-renderer.md` during Phase 4.
- Optional lightweight animation library only if justified in the same decision record.

## Local persistence

- IndexedDB for local progress and preferences.
- Versioned storage schema.
- Safe fallback when storage is unavailable.

## Offline support

- Service worker.
- PWA manifest.
- Local asset caching.
- No gameplay dependency on a remote API.

## Desktop packaging

Tauri is optional.

The first milestone must work as a standalone browser application.

Do not introduce Tauri until the web gameplay is stable.

## Mobile app (React Native)

Native Android and iOS apps are built with **React Native**, sharing all game rules with the web app through a common TypeScript package (see Section 13).

| Concern | Choice | Notes |
|---|---|---|
| Framework | React Native via **Expo** (managed workflow) | Expo SDK pinned in `package.json`; upgrade deliberately |
| Language | TypeScript (strict) | Same `tsconfig` base as web |
| Navigation | Expo Router | Routes mirror web: home, play, mixing, matching, numbers, parent |
| Graphics | `react-native-svg` | Default for UI, shapes, counting objects, paint containers |
| Animation | `react-native-reanimated` | Runs on the UI thread; respects reduced-motion setting and OS "Reduce Motion" |
| Rich mascot/football scene | `@shopify/react-native-skia` **only if needed** | Same rule as PixiJS on web: use only when SVG + Reanimated miss performance targets; record in `docs/decisions/animation-renderer.md` |
| Gestures / drag & drop | `react-native-gesture-handler` | Tap-to-match must also work |
| Audio | `expo-audio` | Pre-recorded narration and SFX bundled with the app |
| Dev narration fallback | `expo-speech` | Same placeholder policy as Speech Synthesis on web |
| Local persistence | `@react-native-async-storage/async-storage` | Behind the shared storage interface; same versioned schema as web |
| Builds & signing | EAS Build | Allows iOS builds without a local Mac |
| Updates | Store releases only | No over-the-air code updates in the MVP |

Mobile-specific requirements:

- **Fully offline:** all gameplay assets are bundled in the app binary; no network permission is needed for gameplay.
- **No service worker / PWA logic** in the mobile app.
- **Android hardware back button** behaves exactly like the on-screen Back button and never exits the app directly from a game screen.
- **Orientation:** support portrait and landscape on tablets; phones may be locked to one orientation if layouts require it.
- **App lifecycle:** going to background pauses gameplay, audio, and the session timer (Section 11), identical to a hidden browser tab.
- **Immersive UI:** hide the status bar during gameplay; keep it visible on the parent settings screen.
- **Permissions:** request none beyond what Expo requires by default. No camera, microphone, location, contacts, or advertising ID.
- **No third-party analytics, crash-reporting SDKs that collect personal data, or ad SDKs.** Crash reporting, if ever added, requires a separate privacy review.
- **Parent gate** (Screen 7) also guards any link to the privacy policy or store pages.

### App store compliance (children's apps)

- **Google Play:** comply with the Families Policy and "Designed for Families" requirements; complete the Data safety form declaring no data collected.
- **Apple App Store:** comply with the Kids Category guidelines (no third-party analytics/ads, parental gate before external links or purchases).
- Publish a simple privacy policy page stating that no personal data is collected.
- Store screenshots and descriptions must not show placeholder assets.

### Parity rule

The web and mobile apps must offer the same activities, curriculum, narration keys, settings, and feedback rules. A feature is not complete until it works on both, unless explicitly marked platform-specific in this document.

## Backend

No backend is required for MVP.

Avoid adding authentication, databases, or remote services without a demonstrated product requirement.

---

# 13. SOFTWARE ARCHITECTURE

## Repository layout (monorepo)

The web and mobile apps share one repository and one core package, managed with **pnpm workspaces**.

```text
packages/
  core/                     # Pure TypeScript, NO Svelte / React / DOM / React Native imports
    src/
      color-mixing/         # colorMixer.ts, mixingMachine.ts, recipes.ts
      shape-matching/       # matchValidator.ts, matchingMachine.ts, shapes.ts
      numbers/              # mathLogic.ts, questionGenerator.ts, countingMachine.ts, numerals.ts, patterns.ts
      learning/             # curriculum.ts, activitySelector.ts
      audio/                # voiceManifest.ts, AudioPlayer interface, narration queue logic
      session/              # sessionTimer.ts (takes an injected clock)
      progress/             # schema, migrations, serialization
      settings/             # schema, defaults, migrations
      storage/              # StorageAdapter interface
      types/                # Color, shapes, game types
    tests/                  # Vitest unit tests for all core logic
  design-tokens/            # Colors, spacing, radii, font sizes as TS + generated CSS variables

apps/
  web/                      # SvelteKit app (structure below)
  mobile/                   # Expo React Native app

assets/                     # Shared source assets: SVG, audio, mascot files
docs/
```

### Sharing rules

- `packages/core` is the **single source of truth** for game rules, state machines, curriculum, narration keys, and storage schemas.
- State machines in `core` are plain TypeScript objects with `send(event)` and `subscribe(listener)`. The web app wraps them in Svelte stores; the mobile app consumes them with `useSyncExternalStore`.
- Platform-specific behavior is injected through interfaces defined in `core`:
  - `StorageAdapter` → IndexedDB (web) / AsyncStorage (mobile)
  - `AudioPlayer` → Web Audio API (web) / `expo-audio` (mobile)
  - `SpeechFallback` → Speech Synthesis (web) / `expo-speech` (mobile)
  - `Clock` → real timers in apps, fake clock in tests
- Design tokens are generated from `packages/design-tokens` into CSS variables (web) and a TypeScript theme object (mobile). Hex values in Section 3.2 are defined only there.
- Shared assets live in `/assets` and are copied or bundled into each app at build time. For the final mascot, prefer a format with both web and React Native runtimes (for example layered SVG parts or a Rive file) so one asset serves both apps.

### Mobile app structure

```text
apps/mobile/
  app/                      # Expo Router routes
    index.tsx               # Welcome
    play.tsx                # Mode selection
    mixing.tsx
    matching.tsx
    numbers.tsx
    parent.tsx
  src/
    components/
      ui/                   # GameButton, AudioButton, ParentGate
      mascot/               # Mascot.tsx
      football/             # Football.tsx
      paint/                # PaintContainer.tsx
    features/
      color-mixing/components/
      shape-matching/components/
      numbers/components/
    platform/
      asyncStorageAdapter.ts
      expoAudioPlayer.ts
      expoSpeechFallback.ts
    theme/                  # Generated from design-tokens
  tests/                    # Jest + React Native Testing Library
  e2e/                      # Maestro flows
```

## Web app structure

The tree below describes `apps/web`. Folders named `engine/`, `data/`, and the pure logic in `learning/`, `audio/`, `session/`, `progress/`, and `settings/` are thin re-exports of `packages/core`; they must not contain their own game rules.

Use a modular, feature-oriented structure.

```text
src/
  lib/
    assets/
      images/
      audio/
      animations/

    components/
      ui/
        GameButton.svelte
        AudioButton.svelte
        ParentGate.svelte
      mascot/
        Mascot.svelte
      football/
        Football.svelte
      paint/
        PaintContainer.svelte

    features/
      color-mixing/
        components/
        engine/
          colorMixer.ts
          mixingMachine.ts
        data/
          recipes.ts
        tests/

      shape-matching/
        components/
        engine/
          matchValidator.ts
          matchingMachine.ts
        data/
          shapes.ts
        tests/

      numbers/
        components/
        engine/
          mathLogic.ts
          questionGenerator.ts
          countingMachine.ts
          numerals.ts
        data/
          numberVocabulary.ts
          patterns.ts
        tests/

      learning/
        curriculum.ts
        activitySelector.ts

      audio/
        audioManager.ts
        voiceManifest.ts

      session/
        sessionTimer.ts

      progress/
        progressStore.ts

      settings/
        settingsStore.ts

    game/
      GameEngine.ts
      AnimationController.ts
      AssetLoader.ts

    styles/
      tokens.css
      global.css

    types/
      game.ts
      colors.ts

  routes/
    +page.svelte
    play/
      +page.svelte
    mixing/
      +page.svelte
    matching/
      +page.svelte
    numbers/
      +page.svelte
    parent/
      +page.svelte

tests/
  unit/
  integration/
  e2e/
```

## Architectural rules

- Separate gameplay logic from rendering.
- Do not embed mixing logic inside Svelte or React Native components.
- `packages/core` must not import any UI framework, DOM API, or React Native API; enforce with an ESLint import rule.
- Any rule change is made once in `core` and covered by core tests before either app is updated.
- Do not hardcode narration strings throughout UI files.
- Use typed configuration for learning activities.
- Keep animations cancellable.
- Avoid global mutable game state.
- Keep persistence behind an abstraction.
- Use dependency injection where it improves testing.
- Avoid unnecessary abstractions and premature microservices.

---

# 14. GAME DATA MODEL

## Learning activity

```typescript
interface LearningActivity {
  id: string;
  mode: "mixing" | "matching" | "numbers";
  difficulty: "beginner" | "explorer" | "advanced";
  instructionKey: string;
  expectedOutcome: string;
  enabled: boolean;
}
```

## Player progress

```typescript
interface PlayerProgress {
  completedActivityIds: string[];
  discoveredColors: Color[];
  discoveredShapes: string[];
  countedUpTo: number;
  lastPlayedAt: string | null;
}
```

## Parent settings

```typescript
interface ParentSettings {
  language: "bn-BD" | "en-US";
  numeralStyle: "bengali" | "english" | "both";
  difficulty: "beginner" | "explorer" | "advanced";
  soundEnabled: boolean;
  musicEnabled: boolean;
  islamicExpressionsEnabled: boolean;
  reducedMotion: boolean;
  restReminderMinutes: number;
}
```

## Persistence rules

- Save only necessary local progress.
- Never collect the child's name, photo, voice, or precise location.
- Do not include third-party behavioral advertising SDKs.
- Provide an option to erase local progress.
- Handle corrupted or outdated saved data gracefully.

## Curriculum & sequencing

Activities are grouped into **rounds**. A round is a short, fixed set of activities; finishing the last activity of a round shows the Completion screen (Screen 5).

| Mode | Difficulty | Activities per round | Content of one round |
|---|---|---|---|
| Color Mixing | Beginner | 3 | Each recipe once, fixed order: red+yellow, blue+yellow, red+blue. Two containers offered. |
| Color Mixing | Explorer | 3 | Same three recipes in shuffled order. Two containers offered. |
| Color Mixing | Advanced | 3 | Target color named first ("সবুজ বানাই!"); three containers offered, child picks the right two. A wrong pair still produces its real result, then Rumi invites another try. |
| Shape Matching | Beginner | 5 | 2 options each; alternate color-only and shape-only matching. |
| Shape Matching | Explorer | 5 | 3 options each; color or shape matching. |
| Shape Matching | Advanced | 5 | 3 options each; shape and color together. |
| Numbers | Beginner | 5 | C1 count, C2 number→quantity, C3 more/fewer, C1 count, C5 pattern (range 1–5). |
| Numbers | Explorer | 5 | C1, C2, C3, C4 addition (sum ≤ 5), C5 (range 1–10). |
| Numbers | Advanced | 5 | C2, C3 (incl. "same"), C4 (sum ≤ 10), C4, C5 ABC pattern. |

Rules:

- Activity definitions live in typed data files (`curriculum.ts`, `recipes.ts`, `shapes.ts`, `patterns.ts`); generated activities (matching, numbers) use a seeded generator so a round can be reproduced in tests.
- The Next button advances to the next activity in the round; on the last activity it opens the Completion screen.
- Completion offers **Replay** (same mode and difficulty, new seed) and **Choose Another Game**.
- Leaving a round midway discards that round's partial position; completed activities are still recorded in progress.
- **Difficulty recommendation:** after 3 completed rounds at the current level with an average of ≤ 1 hint per activity, the Parent Settings screen shows a suggestion to try the next level. Difficulty never changes automatically.

---

# 15. PERFORMANCE REQUIREMENTS

## Target devices

Optimize for affordable Android phones and standard tablets.

## Performance goals

- Smooth interactions on mid-range devices.
- Target 60 FPS during ordinary animations.
- Remain usable at 30 FPS on lower-end devices.
- Avoid unnecessary continuous rendering.
- Lazy-load assets by activity.
- Cache required gameplay assets for offline use.
- Keep memory usage controlled.
- Release unused animation resources.

## Asset strategy

Prefer:

- SVG for simple interface graphics.
- WebP or AVIF for raster illustrations.
- Compressed audio files.
- Texture atlases where beneficial.

Do not use large video files for basic character animations.

## Placeholder asset policy

The AI agent cannot produce final illustrations or recorded human voice. Development must therefore proceed with placeholders that are easy to replace.

**Mascot and illustrations**

- Until final art exists, Rumi is drawn in code as a simple SVG built from geometric shapes following Section 4.1, with every animation state in Section 4.2 implemented.
- Final art (by a human illustrator) must plug in through `AssetLoader` using the same asset keys and animation state names; no gameplay code may change when art is swapped.

**Audio**

- During development, narration uses the browser Speech Synthesis API with a `bn-BD` voice when available; if no voice is available, narration is skipped and the on-screen caption is shown.
- The agent also generates `docs/narration-script.md` (see Section 8.4) as the recording script for a human voice artist.
- Recorded files are added under `audio/<locale>/…` with filenames matching the narration keys.

**Tracking**

- Every entry in the asset manifest has `status: "placeholder" | "final"`.
- A script `npm run assets:report` lists every placeholder still in use.
- A production build prints a warning listing remaining placeholders; the release checklist requires zero placeholders.
- No third-party asset may be added without its license recorded in `docs/asset-licenses.md`.

---

# 16. TESTING REQUIREMENTS

## Unit tests

Cover:

- Color mixing combinations.
- Order-independent mixing.
- Invalid combinations.
- Matching validation.
- Counting, comparison, addition, and pattern logic.
- Bengali numeral conversion.
- Seeded question generation and distractor validity.
- Difficulty configuration.
- Timer calculations.
- Progress serialization.
- Settings defaults.

## Integration tests

Cover:

- Selecting the first color.
- Selecting the second color.
- Completing the mixing animation.
- Returning to the initial state.
- Correct matching.
- Incorrect matching.
- Counting objects without double-counting.
- Answering a number question correctly and incorrectly.
- Muting during narration.
- Navigating during animation.
- Pausing and resuming gameplay.

## End-to-end tests

Use Playwright.

Test:

1. Welcome to game selection.
2. Complete a color-mixing activity.
3. Complete a shape-matching activity.
4. Complete a counting activity and a number-to-quantity activity.
5. Restart an activity.
6. Change language and numeral style.
7. Enable reduced motion.
8. Trigger a rest reminder using a test clock.
9. Reload and restore local progress.
10. Run an activity while offline.
11. Use the application on a mobile viewport.

## Accessibility testing

Verify:

- Keyboard navigation.
- Touch target sizes.
- Screen-reader labels.
- Reduced-motion behavior.
- Audio-disabled usability.
- Text contrast.
- Clear feedback without relying on color alone.

## Mobile app testing (React Native)

- **Core logic:** covered once by the Vitest suite in `packages/core`; mobile does not duplicate these tests.
- **Component and integration tests:** Jest + React Native Testing Library for mobile components, state-machine bindings, and platform adapters (with mocked `expo-audio` and AsyncStorage).
- **End-to-end tests:** Maestro flows covering the same scenarios as the web Playwright list above (except offline, which is implicit), plus:
  - Android hardware back button on each game screen.
  - App sent to background during an animation and resumed.
  - Session timer pauses while the app is in the background.
  - Tablet landscape and small-phone portrait layouts.
- **Accessibility:** verify TalkBack (Android) and VoiceOver (iOS) labels, OS "Reduce Motion" setting, and minimum touch target sizes.
- **Devices:** test on at least one low-cost Android phone (2–3 GB RAM), one Android tablet, and one iPhone or iOS simulator.

---

# 17. ACCEPTANCE CRITERIA

The MVP is complete only when:

- [ ] The welcome screen is functional.
- [ ] All three game modes are playable.
- [ ] Counting, number-to-quantity, comparison, addition, and pattern activities work.
- [ ] Numbers display correctly in Bengali digits, English digits, or both.
- [ ] All three primary mixing recipes work.
- [ ] Mixing is order-independent.
- [ ] The football changes color correctly.
- [ ] The mascot reacts to completed activities.
- [ ] Shape matching works using drag and drop.
- [ ] Shape matching also works using taps.
- [ ] Incorrect answers receive gentle feedback.
- [ ] The narration system plays packaged audio files when present (verified with test audio files) and falls back to Speech Synthesis or captions when absent.
- [ ] `docs/narration-script.md` covers every narration key in Bengali, English, and neutral variants.
- [ ] Each mode follows the round structure in the Curriculum & sequencing table, and Completion appears after the last activity of a round.
- [ ] The parent gate requires a 3-second hold and a correct text-only answer.
- [ ] Game state machines follow the transition tables; unlisted events are ignored.

### Release criteria (require human input)

These are outside the AI agent's MVP scope and must not be marked done by the agent:

- [ ] Final Rumi artwork and animations replace all mascot placeholders.
- [ ] Recorded Bengali (and English) narration replaces all Speech Synthesis placeholders.
- [ ] `npm run assets:report` shows zero placeholders.
- [ ] `docs/content-review.md` records approval for Islamic, Bengali, and English content.
- [ ] Audio can be muted and replayed.
- [ ] Parent settings persist locally.
- [ ] Session reminders function correctly.
- [ ] Reduced-motion mode works.
- [ ] The application works offline after installation.
- [ ] Gameplay does not require authentication.
- [ ] No advertisements or tracking SDKs are included.
- [ ] Unit, integration, and E2E tests pass.
- [ ] The application builds successfully.
- [ ] No critical console errors remain.
- [ ] The UI works on mobile and tablet screen sizes.

### Mobile app criteria (React Native, Phase 8)

- [ ] Android and iOS builds are produced through EAS Build.
- [ ] All three game modes, the curriculum, settings, and parent gate match the web app (parity rule).
- [ ] Game rules are imported from `packages/core`; no rule logic is duplicated in `apps/mobile`.
- [ ] The app works fully offline with all assets bundled.
- [ ] Android back button, app backgrounding, and session timer behave as specified.
- [ ] No permissions or SDKs beyond those listed in Section 12.
- [ ] Jest and Maestro tests pass.

Store submission (Google Play Families Policy, Apple Kids Category, privacy policy, store listing) is a release criterion requiring human action.

---

# 18. IMPLEMENTATION ROADMAP

## Phase 1 — Project foundation

Deliver:

- pnpm monorepo with `packages/core`, `packages/design-tokens`, and `apps/web`
- SvelteKit project in `apps/web`
- TypeScript configuration (shared strict base)
- Tailwind configuration
- Design tokens generated from `packages/design-tokens`
- ESLint rule forbidding UI-framework imports in `packages/core`
- Responsive application shell
- Navigation
- Basic component library

**Exit criterion:** The app launches, navigates correctly, and displays the intended visual system.

## Phase 2 — Functional color mixing

Deliver:

- Football rendering
- Paint container interactions
- Color-mixing engine
- Gameplay state machine
- Reset functionality
- Result display

**Exit criterion:** All mixing recipes work without animation or state errors.

## Phase 3 — Functional shape matching

Deliver:

- Shape assets
- Matching zones
- Drag-and-drop interaction
- Tap-to-match interaction
- Matching validation
- Difficulty configuration

**Exit criterion:** Children can complete matching activities using either input method.

## Phase 3B — Numbers & Counting

Deliver:

- Math logic and numeral conversion
- Seeded question generator
- Counting state machine
- Count, number-to-quantity, compare, add, and pattern activities
- Hint ("count with me") behavior

**Exit criterion:** All five math activities are playable at every difficulty with no duplicate counting or invalid answer options.

## Phase 4 — Mascot and animation

Deliver:

- Original mascot assets
- Animation controller
- Idle animation
- Celebration animation
- Football kick animation
- Reduced-motion alternatives

**Exit criterion:** Mascot animations respond correctly to gameplay state.

## Phase 5 — Bengali audio

Deliver:

- Audio manager
- Narration manifest
- Bengali voice assets
- Sound effects
- Mute and replay controls
- Audio fallback behavior

**Exit criterion:** All essential learning instructions have usable audio or visual equivalents.

## Phase 6 — Parent controls and offline mode

Deliver:

- Parent settings
- Local progress
- Session reminder
- PWA installation support
- Offline caching
- Privacy safeguards

**Exit criterion:** Core gameplay works offline and parent settings remain consistent.

## Phase 7 — Quality assurance

Deliver:

- Unit tests
- Integration tests
- Playwright tests
- Accessibility review
- Mobile performance review
- Production build
- Documentation

**Exit criterion:** All MVP acceptance criteria pass.

## Phase 8 — React Native mobile app

Start only after Phase 7 passes on web, so the shared core is stable.

Deliver:

- Expo app in `apps/mobile` consuming `packages/core` and generated design tokens
- Platform adapters: AsyncStorage, `expo-audio`, `expo-speech`
- Welcome, mode selection, parent gate, and parent settings screens
- Color Mixing, Shape Matching, and Numbers screens with SVG + Reanimated animations
- Drag-and-drop and tap-to-match with Gesture Handler
- Android back button, app lifecycle pause, orientation handling
- Jest + React Native Testing Library tests and Maestro E2E flows
- EAS Build configuration for Android and iOS
- Store compliance checklist and privacy policy draft (for human review)

Recommended order inside the phase: app shell and adapters → Color Mixing → Shape Matching → Numbers → mascot animation → audio → settings and persistence → device testing → builds.

**Exit criterion:** All mobile app criteria in Section 17 pass on a low-cost Android phone and an iOS device or simulator.

---

# 19. AI CODING AGENT EXECUTION INSTRUCTIONS

Follow this workflow strictly.

## Step 1 — Analyze

Read the complete specification.

Identify:

- Required features
- Dependencies
- Architectural decisions
- Missing assets
- Implementation risks
- Acceptance criteria

Do not begin with decorative UI work before understanding the gameplay.

## Step 2 — Plan

Create:

- Implementation plan
- Component dependency map
- File structure
- Game state diagrams
- Test strategy
- Asset manifest

Use sensible defaults for noncritical ambiguities.

Ask for clarification only when a missing decision materially blocks implementation.

## Step 3 — Implement incrementally

Build one complete functional slice at a time.

Recommended order:

1. Functional app shell.
2. Color-mixing logic.
3. Color-mixing interactions.
4. Shape-matching logic.
5. Shape-matching interactions.
6. Numbers & counting logic and interactions.
7. Animation integration.
8. Audio integration.
9. Settings and persistence.
10. Offline support.
11. Final web testing.
12. React Native mobile app (Phase 8), reusing `packages/core` unchanged where possible.

Do not implement all features simultaneously without verification.

## Step 4 — Verify

After each phase:

- Run type checking.
- Run relevant tests.
- Run linting.
- Verify build output.
- Test user interactions.
- Fix regressions.

Never claim that tests passed unless they were actually executed.

## Step 5 — Report

For every completed phase, provide:

- Features implemented.
- Files created or modified.
- Tests executed.
- Test results.
- Known limitations.
- Next implementation phase.

Clearly distinguish working functionality from placeholders.

---

# 20. DEFINITION OF DONE

A feature is considered complete only when:

1. It works as specified.
2. It is responsive.
3. It supports relevant accessibility requirements.
4. It handles expected edge cases.
5. It has appropriate automated test coverage.
6. It does not introduce critical regressions.
7. It has no unhandled runtime errors.
8. It works without unnecessary network dependencies.
9. It follows the project's architectural conventions.
10. It is documented sufficiently for another developer to maintain.

**Final instruction to the AI agent:**

Build this as a real educational product, not a landing page, static prototype, or collection of disconnected animations.

Prioritize correct gameplay behavior, child-centered usability, reliable Bengali narration, maintainable architecture, and verifiable implementation quality.

Begin with architecture and a working vertical slice of Color Mixing Mode. Complete and test that slice before expanding the application.

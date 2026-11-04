# 07 — Game Mode C: Numbers & Counting

**Depends on:** 01, 02, 03, 04, [08-audio-narration.md](08-audio-narration.md), [11-curriculum-progress.md](11-curriculum-progress.md)
**Phase:** 3B

## Learning objective

Introduce early numeracy through concrete, visual play:

- Counting objects 1–10
- Recognizing numerals in Bengali (০–৯) and English (0–9) digits
- Matching a numeral to a quantity
- Comparing quantities (more / fewer / same)
- Simple addition with visible objects
- Recognizing and continuing simple patterns

| ID | Requirement |
|---|---|
| NC-01 | Every number shown MUST be accompanied by countable objects or dots. No abstract arithmetic in the MVP. |
| NC-02 | Subtraction is out of scope. |

## Number range by difficulty

| Level | Counting range | Addition | Comparison |
|---|---|---|---|
| Beginner | 1–5 | Not shown | Two groups, large visible difference (≥ 2) |
| Explorer | 1–10 | Sums ≤ 5 | Two groups, difference ≥ 1; "same" introduced |
| Advanced | 1–10 | Sums ≤ 10 | Two groups, any difference including "same" |

## Countable objects

Footballs, apples, stars, leaves, paint drops, circles, squares.

| ID | Requirement |
|---|---|
| NC-03 | Objects within one group share one shape and one learning color, so the child counts quantity rather than sorting attributes. |
| NC-04 | Religious or sacred objects MUST NOT be used as counting items (PR-13). |
| NC-05 | Up to 10 objects MUST fit without overlap; wrap into two rows of 5 on small screens. |

## Screen layout (Screen 4B)

| Region | Contents |
|---|---|
| Top | Back button, instruction replay, sound toggle |
| Center | Rumi, countable objects (max two rows of 5), numeral display |
| Bottom | Two or three large answer buttons (numeral + dots) when applicable; hint button ("count with me") |

## Activities

### C1 — Count with Rumi (`count`)

1. A few footballs appear in a row. Instruction: "চলো গুনি! কয়টা বল?"
2. The child taps each ball. It bounces gently and Rumi says its number ("এক", "দুই", "তিন"…).
3. A counted ball shows an outline and a small tick, and cannot be counted twice.
4. After the last ball: "মোট তিনটা বল!" The numeral appears (৩ / 3 / both per settings).
5. Rumi kicks one ball into the goal.

### C2 — Number to quantity (`numeral-to-quantity`)

1. A large numeral is shown, e.g. ৪.
2. 2 baskets (Beginner) or 3 baskets (Explorer/Advanced) with different apple counts.
3. The child drags or taps the numeral onto the matching basket.
4. Correct: the basket highlights, apples are counted aloud one by one, Rumi celebrates.
5. Incorrect: the numeral returns; "চলো আবার গুনে দেখি!"; the hint counts the apples aloud.

### C3 — More or fewer (`compare`)

1. Two groups of stars, left and right. Instruction: "কোন দিকে বেশি তারা?" (Explorer/Advanced may ask "কম").
2. The child taps a side (or a "সমান" button when groups may be equal).
3. Feedback pairs objects one-to-one with soft connecting lines, so the extra objects are visible.

### C4 — Simple addition (`add`), Explorer and Advanced only

1. Rumi has 2 red balls; a friend rolls in 1 blue ball. "দুইটা আর একটা মিলে কয়টা?"
2. The child picks from 2–3 numeral buttons, each showing its dots.
3. Correct: the balls slide together and are counted aloud: "দুই আর এক মিলে তিন!"
4. The `+` symbol is shown only in Advanced.

### C5 — Pattern completion (`pattern`)

1. A row like লাল – নীল – লাল – নীল – ? using circles.
2. The child picks the next item from 2–3 options.
3. Beginner: AB. Explorer: AB, AAB. Advanced: ABC.
4. Pattern items differ in both color **and** shape (PR-24).

## Feedback rules

| ID | Requirement |
|---|---|
| NC-10 | No timers, scores, or star ratings. |
| NC-11 | Wrong answers never subtract anything or show red crosses. |
| NC-12 | After 2 incorrect attempts, the hint becomes available; the answer is never forced. |
| NC-13 | Counting narration MUST be synchronized with the highlighted object. |
| NC-14 | When muted, the number MUST appear visually above each counted object. |

## Logic

```typescript
// packages/core/src/numbers/mathLogic.ts
export type MathActivityKind = "count" | "numeral-to-quantity" | "compare" | "add" | "pattern";
export type CompareAnswer = "left" | "right" | "same";

export function compareQuantities(left: number, right: number): CompareAnswer {
  if (left === right) return "same";
  return left > right ? "left" : "right";
}

export function addQuantities(a: number, b: number, max: number): number | null {
  const sum = a + b;
  return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && sum <= max ? sum : null;
}

export function nextInPattern<T>(sequence: T[], unit: T[]): T {
  return unit[sequence.length % unit.length];
}

// packages/core/src/numbers/numerals.ts
const BENGALI_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBengaliNumeral(n: number): string {
  return String(n).replace(/\d/g, (d) => BENGALI_DIGITS[Number(d)]);
}

export function formatNumeral(n: number, style: "bengali" | "english" | "both"): string {
  if (style === "english") return String(n);
  if (style === "bengali") return toBengaliNumeral(n);
  return `${toBengaliNumeral(n)} / ${n}`;
}
```

### Question generator

| ID | Requirement |
|---|---|
| NC-20 | Generation is seeded and deterministic (`questionGenerator(seed, kind, difficulty)`). |
| NC-21 | Distractor options MUST NOT equal the correct answer and MUST be unique. |
| NC-22 | All values MUST stay within the difficulty's range. |
| NC-23 | Compare questions at Beginner MUST have a difference ≥ 2. |
| NC-24 | Addition operands are ≥ 1 (no "zero plus" questions in the MVP). |

## Number vocabulary

| n | Bengali word | bn numeral | en numeral |
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

Parents choose the numeral style in settings: Bengali, English, or both ([10-parent-settings.md](10-parent-settings.md)).

## State machine

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

| From | Event | Guard | To | Effects |
|---|---|---|---|---|
| `READY` | `TAP_OBJECT(o)` | kind = `count` | `COUNTING` | Mark counted, narrate "এক" |
| `COUNTING` | `TAP_OBJECT(o)` | Not counted, more remain | `COUNTING` | `count++`, narrate number |
| `COUNTING` | `TAP_OBJECT(o)` | Already counted | `COUNTING` | Ignored; tiny wiggle |
| `COUNTING` | `TAP_OBJECT(o)` | Last uncounted object | `CORRECT` | Narrate total, show numeral |
| `READY` | `SELECT_ANSWER(a)` | kind ≠ `count` | `ANSWER_SELECTED` | Highlight answer, lock input |
| `ANSWER_SELECTED` | — | — | `VALIDATING` | Run pure validation |
| `VALIDATING` | — | Correct | `CORRECT` | Visual explanation (pairing, sliding, counting aloud) |
| `VALIDATING` | — | Incorrect | `TRY_AGAIN` | Encouragement, `attempts++` |
| `TRY_AGAIN` | `FEEDBACK_DONE` | — | `READY` | Unlock; hint enabled when `attempts ≥ 2` |
| `READY` | `HINT` | — | `READY` | Count objects aloud with highlight; input locked until done |
| `CORRECT` | `RESULT_SHOWN` | Minimum display time elapsed | `CELEBRATING` | Rumi celebrates or kicks |
| `CELEBRATING` | `CELEBRATION_DONE` | — | `COMPLETE` | Show Next, record progress, update `countedUpTo` |
| `COMPLETE` | `NEXT` | — | `READY` | Load next activity |
| *any* | `RESET` | — | `READY` | Clear counted marks and selection |

Unlisted events are ignored. Input locking and duplicate-tap rules match CM-10 to CM-16.

## Edge cases

| ID | Case | Expected behavior |
|---|---|---|
| NC-30 | Same object tapped twice | Ignored (wiggle) |
| NC-31 | Objects tapped out of order | Allowed; count follows tap order |
| NC-32 | Answer tapped while hint narration plays | Ignored until the hint finishes |
| NC-33 | Reset or back during counting narration | Narration stops, clean state |
| NC-34 | Audio muted | Numbers shown visually (NC-14) |
| NC-35 | Small screen with 10 objects | Two rows of 5 (NC-05) |

## Files

```text
packages/core/src/numbers/mathLogic.ts
packages/core/src/numbers/numerals.ts
packages/core/src/numbers/questionGenerator.ts
packages/core/src/numbers/countingMachine.ts
packages/core/src/numbers/patterns.ts
packages/core/src/numbers/numberVocabulary.ts
packages/core/tests/numbers/*.test.ts
apps/desktop/src/routes/numbers/+page.svelte
apps/desktop/src/lib/features/numbers/components/*.svelte
```

## Tests

**Unit:** `compareQuantities`, `addQuantities` (bounds, invalid input), `nextInPattern`, `toBengaliNumeral` (0–10, multi-digit), `formatNumeral`; generator rules NC-20 to NC-24 over 1,000 seeds; every transition-table row.
**Integration:** counting without double-counting; correct and incorrect answers; hint after 2 misses.
**E2E:** complete one Numbers round at Beginner and at Explorer; switch numeral style and verify the display.

## Acceptance checklist

- [ ] All 5 activity kinds playable at every applicable difficulty.
- [ ] No double counting; no invalid or duplicate answer options.
- [ ] Bengali, English, and both numeral styles render correctly.
- [ ] Edge cases NC-30 to NC-35 handled.

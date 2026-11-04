# X-01 — Shape Matching and Numbers core — 2026-11-04

## Status

**Done (core-only).** Implementation and package validation are complete in the
assigned folders. Claude corrected the audio-test type error reported during
validation, and `npx tsc --noEmit` now passes. No files owned by Claude were edited.
X-02 can now proceed. Desktop integration remains Claude's C-04/C-05 work.

## Requirements

“Done (core)” means the data/rule/machine side is tested; it does not assert that
the desktop input, rendering, animation, or narration integration is finished.

| ID | Status | Notes |
| --- | --- | --- |
| SM-01 | done | Only the eight secular shapes; no religious imagery added. |
| SM-02 | done | No religious imagery requiring review introduced. |
| SM-03 | partial | Shape library has all eight definitions; SVG rendering belongs to Claude. |
| SM-10 | done | Exactly one correct target per source across 1,000 seeds/difficulty. |
| SM-11 | done | Distractor attribute uniqueness tested. |
| SM-12 | done | Seeded generators and rounds deterministic. |
| SM-13 | done | At most three learning colors per activity, tested. |
| SM-20 | partial | Drag events/effects implemented; mouse/touch UI pending. |
| SM-21 | partial | Tap source/target implemented; UI pending. |
| SM-22 | partial | Same events support keyboard; focus controls pending. |
| SM-23 | not started | Pixel hit-testing belongs to the app. |
| SM-30 | done | Ignored-event matrix across all eight states. |
| SM-31 | done | Matched sources cannot be selected or dragged again. |
| SM-32 | done (core) | Extra drag events ignored while dragging. |
| SM-40 | partial | DRAG_CANCEL returns silently; pointer-leave wiring pending. |
| SM-41 | done (core) | Additional drag starts ignored. |
| SM-42 | partial | Cancellation supported; orientation wiring pending. |
| SM-43 | partial | Reset cancels effects from every state; navigation teardown pending. |
| SM-44 | partial | Name keys and bilingual captions supplied; app displays captions. |
| NC-01 | done (core) | Concrete object groups, numeral reference objects, and answer dots supplied. |
| NC-02 | done | No subtraction. |
| NC-03 | done | Homogeneous shape/color in every group, tested over 1,000 seeds. |
| NC-04 | done | Explicit seven-item countable whitelist, no sacred objects. |
| NC-05 | partial | countingPositions provides two rows of five; rendered layout pending. |
| NC-10 | done (core) | No pressure timers, scores, or ratings; display-time guard only. |
| NC-11 | done | Gentle retries; no subtraction or penalty effects. |
| NC-12 | done (core) | Hints after two misses; no automatic answer/advancement. |
| NC-13 | partial | Count effects and hint/explanation steps pair object ID, number, and narration key; app synchronizes playback. |
| NC-14 | partial | Effects carry visual numbers alongside keys; display when muted belongs to UI. |
| NC-20 | done | Seeded deterministic generators, all applicable kinds/levels over 1,000 seeds. |
| NC-21 | done | Unique answer values/IDs with exactly one correct answer. |
| NC-22 | done | Difficulty bounds, concrete groups, and addition limits tested. |
| NC-23 | done | Beginner comparison difference at least two. |
| NC-24 | done | Addition operands positive. |
| NC-30 | done | Duplicate object taps wiggle without recounting. |
| NC-31 | done | Arbitrary object tap order; narration follows that order. |
| NC-32 | done | Hint lock blocks answer/object taps until HINT_DONE. |
| NC-33 | partial | Reset emits cancelAll from all states; app navigation cleanup pending. |
| NC-34 | partial | Numbers included in descriptors; muted rendering pending. |
| NC-35 | partial | Two-row positioning helper implemented; actual viewport test pending. |

Spec 11: matching and numbers each have five seeded activities per difficulty,
following the specified curriculum order. Beginner matching alternates color /
shape; Advanced uses both. Advanced numbers explicitly includes equality and an
ABC pattern. Activity IDs include round position to remain unique even if two
generated child seeds coincide. Central `createRound` dispatch remains Claude's
integration work in `learning/curriculum.ts`.

## Files created

- `packages/core/src/shape-matching/{shapes,matchValidator,activityGenerator,matchingMachine,rounds,narration,index}.ts`
- `packages/core/src/numbers/{mathLogic,numerals,numberVocabulary,patterns,questionGenerator,countingMachine,rounds,narration,index}.ts`
- `packages/core/tests/shape-matching/matching.test.ts`
- `packages/core/tests/numbers/numbers.test.ts`
- `docs/agents/codex-report-01.md`

No dependencies installed; no app, root config, spec, central export, shared
contract, color-mixing, or audio file was changed.

## Command results

From `packages/core`:

- `npx vitest run tests/numbers tests/shape-matching`: **2 files, 219 tests passed**.
- `npx vitest run`: **12 files, 401 tests passed**, including existing suites.
- `npx tsc --noEmit`: **passed**, exit 0. An earlier run failed on a global
  `setTimeout` in Claude-owned `tests/audio/audioManager.test.ts`; Claude replaced
  that helper, and the rerun passed without changing the shared contracts.

## Integration and assumptions

1. Import the module barrels from `shape-matching/index.ts` and `numbers/index.ts`.
   `MATCHING_NARRATION` / `NUMBERS_NARRATION` are `NarrationEntry[]` with bilingual
   text and `status: 'placeholder'`; merge these into the central manifest. No
   religious phrases or review claims added.
2. Matching setup is a `MatchingActivity`; events use source `itemId` and target
   `targetId`. A `validate` effect means immediately send `VALIDATE`. This maps
   the spec's eventless validation row onto the frozen machine helper without
   changing that helper or introducing another state. Snap/return/celebration
   animation callbacks send `SNAP_DONE`, `RETURN_DONE`, `CELEBRATION_DONE`.
3. Numbers setup is a discriminated `NumberQuestion`. `SELECT_ANSWER` takes an
   option **ID**, not its value. `prepareValidation` means send `ANSWER_READY`;
   `validate` means send `VALIDATE`. Both are immediate internal handshakes for
   the spec's eventless rows, without waiting for audio or animations.
4. A singleton count follows READY → COUNTING on its first tap. The emitted
   `countComplete` means send `COUNT_DONE`, which enters CORRECT. This handles
   the table's otherwise unreachable singleton terminal case without requiring
   a second tap or another state. Larger counts reach CORRECT on the last tap.
5. `counted` supplies object ID + number + `number.N` key. `total` supplies the
   final numeral/key. `hint` and `explain` carry the question plus ordered steps;
   compare groups restart numbering for each side. Quantity hints count all
   baskets, while a correct answer explains the matching basket. Send HINT_DONE
   even on mute/audio failure so input unlocks. Pattern hints carry pattern data
   and no irrelevant count sequence.
6. Counting hints are available from READY in count activities (there is no
   incorrect-answer path for tapping objects). Other kinds unlock after two
   misses. Hints never mark objects counted or choose an answer.
7. `createCountingMachine(question, clock?)` accepts a gameplay clock for the
   1,500 ms CORRECT display guard; default is Date.now for parity with mixing.
   No timers run in the machine. Supply pause-aware app scheduling and send
   RESULT_SHOWN at the safe display deadline; reduced motion affects animation
   timing, not this readable result interval.
8. `complete` effects carry activity ID and hints; numbers also supplies
   countedUpTo (max group for compare; sum for addition; zero for patterns).
   App records progress once. NEXT emits `next`; app loads the next planned
   activity/completion screen. Reset clears state and emits cancelAll.
9. All strings remain unreviewed placeholders. Final SVGs, pointer hit testing,
   UI integration, browser/E2E tests, recorded audio, and content review remain
   outside X-01's core-only scope.

## Requests for Claude

1. Audio-test issue resolved by Claude; no outstanding type-check blocker.
2. Mark X-01 done on the task board (README is Claude-owned).
3. Re-export both module barrels from core `src/index.ts`; merge the narration
   arrays into `VOICE_MANIFEST` and validate them. If an exported symbol would
   collide, use explicit/aliased exports without changing shared contracts.
4. Add matching/numbers dispatch to central curriculum, and wire C-04/C-05 UI
   using the internal effect handshakes above. Verify pointer/keyboard input,
   mute, reduced motion, reset/navigation, hints, and complete rounds.

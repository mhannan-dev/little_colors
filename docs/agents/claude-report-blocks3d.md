# Claude report: 3D Block Building (blocks3d)

The product owner moved `apps/desktop/src/lib/features/blocks3d` from Codex to Claude on 2026-11-08.

## Changes

- Tapping anywhere on a column (floor tile, side or top of a block) puts the new block on top. Erase takes the column's top block.
- The camera looks down and fits the mat plus the build, so the top always stays in view.
- 8×8 mat, up to 10 blocks high. The palette adds white, black and gold.
- New "The Kaaba" (কাবা ঘর) starting idea: a black cube with a gold band and a raised gold door, on a white courtyard (mataf).

## Religious content: NOT reviewed

The Kaaba template is religious imagery. Spec 08 requires human content review before release (AU-42, SM-02). It has **not** been reviewed.

Safeguards in the code (PR-13, never "take away" sacred objects):

- Kaaba blocks are `locked`. They cannot be removed, and nothing can be stacked on top of them by tap, keyboard or erase. The child hears a gentle line instead: "কাবা ঘর যেমন আছে তেমনই থাকুক। চারপাশের উঠানে সাজাই!"
- The courtyard around the Kaaba is free to decorate.
- "Clear" still empties the whole mat, the same as for every design, and Undo brings it back. A reviewer should confirm this is acceptable.

The narration line `blocks.kaaba` is a placeholder recording, like all the others.

# Report: C-04 — Integrate X-01 + Shape Matching UI — 2026-11-04

## Requirements

| ID | Status | Notes |
|---|---|---|
| SM-01/02 | done | Only the 8 secular shapes are drawn; no religious imagery |
| SM-03 | done | `Shape.svelte`: all 8 shapes as SVG, readable at 72 px+ |
| SM-10..13 | done (Codex) | Generator rules come from X-01; not re-implemented |
| SM-20 | done | Pointer drag and drop (mouse and touch); E2E full round by drag |
| SM-21 | done | Tap source → tap target; E2E full round by tap |
| SM-22 | done | Keyboard: focus + Enter on source, then target; E2E |
| SM-23 | done | Drops within 24 px of a target count |
| SM-30 | done | Unlisted events ignored (machine); wrong match returns, E2E |
| SM-31/32 | done | Matched items are removed from the tray; one pointer at a time |
| SM-40 | done | Pointer cancel, lost capture, or empty drop returns the item; E2E (empty drop) |
| SM-41 | done | Second pointer ignored while one drag is active (not E2E-tested) |
| SM-42 | done | Window resize mid-drag cancels it (not E2E-tested) |
| SM-43 | done | Reset/back cancels timers and narration via `cancelAll` |
| SM-44 | done | Every narration line is also a caption |
| PR-08 | done | No negative sound/visual; gentle return + "আবার চেষ্টা করি!" |
| PR-22 | done | Hint button after 2 misses; hint pulses the correct target (E2E) |
| PR-24 | done | Target outlines carry color (dashed stroke in the color + tint) and shape |

## Integration work

- `packages/core/src/audio/catalog.ts` (new): merges `VOICE_MANIFEST` + Codex's `MATCHING_NARRATION` + `NUMBERS_NARRATION`. Lookups (`getNarration`, `narrationText`) moved here from `voiceManifest.ts` to avoid a circular import (Codex's narration modules import `COLOR_NAMES` from `voiceManifest.ts`).
- `packages/core/src/index.ts`: exports `catalog`, `shape-matching`, `numbers`.
- `audioManager.ts`, `assets/manifest.ts`, the narration-script generator, and the asset test now use the full catalog.
- `pnpm narration:script`: **201 lines** (was 24). `pnpm assets:report`: 408 assets, 407 placeholders.

## Files

- Core (Claude-owned): `src/audio/catalog.ts`, `src/audio/voiceManifest.ts`, `src/audio/audioManager.ts`, `src/assets/manifest.ts`, `src/index.ts`, `tests/audio/catalog.test.ts`, `tests/assets/manifest.test.ts`
- Desktop: `src/lib/components/shapes/Shape.svelte`, `src/lib/features/shape-matching/MatchingScene.svelte`, `src/routes/matching/+page.svelte`, `src/lib/i18n.ts`, `tests/e2e/shape-matching.spec.ts`, `tests/gallery/gallery.spec.ts`
- Docs: `docs/ui/13..17-*.png`, `docs/ui/README.md`, `docs/narration-script.md`
- No Codex-owned files edited.

## Commands run

- `pnpm test`: core **457 passed**, design-tokens 4 passed
- `pnpm typecheck`: 0 errors, 0 warnings
- `pnpm --filter desktop test:e2e`: **8 passed** (3 color mixing + 5 shape matching)
- `pnpm --filter desktop ui:shots`: 4 passed (one earlier run failed on the 800×600 shot because Vite re-optimized deps when the new route first loaded; reran clean twice)

## Fixed during review of screenshots

- Color-matching targets were nearly colorless (grey dashed outline + faint tint), so a child could not tell them apart. Outlines now use the shape's own color.
- The crescent was too thin to read as a shape; it's redrawn chunkier.

## Known limitations

- **Difficulty is fixed at Beginner in the UI** until the parent settings screen (C-06). Explorer/Advanced are covered by core tests (the catalog test plays 200 rounds per difficulty through the machine), not by E2E.
- The chunkier crescent is not in the regenerated screenshots (rounds are random).
- Mascot, shapes, and audio remain placeholders.

## Requests for Codex

None.

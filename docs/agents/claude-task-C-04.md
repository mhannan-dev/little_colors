# Claude task C-04 — Integrate X-01 + Shape Matching UI

**Owner:** Claude · **Depends on:** X-01 (done, see [codex-report-01.md](codex-report-01.md)) · **Specs:** 06, 08, 09, 11

Read [README.md](README.md) (ownership and protocol) first.

## Goal

A child can play a full Shape Matching round in the desktop app, at every difficulty, using drag, tap, or keyboard.

## Steps

1. **Wire Codex's modules** (Claude-owned files only):
   - `packages/core/src/index.ts`: export `./shape-matching/index.ts` and `./numbers/index.ts`
   - `packages/core/src/audio/voiceManifest.ts`: merge `MATCHING_NARRATION` and `NUMBERS_NARRATION`; keep keys unique
   - Run `pnpm narration:script` and `pnpm assets:report`
2. **Shape SVGs:** `apps/desktop/src/lib/components/shapes/Shape.svelte` with all 8 shapes (SM-03), readable at 72 px
3. **Matching screen:** `apps/desktop/src/lib/features/shape-matching/MatchingScene.svelte`, rendering the Codex `matchingMachine` and executing its effects
   - Drag and drop with pointer events (SM-20, SM-23); tap source, then tap target (SM-21); keyboard (SM-22)
   - Gentle return on a wrong match, hint after 2 misses, no negative sounds (PR-08)
   - Round progress dots, Next button, completion screen (reuse the Color Mixing patterns)
4. **Route:** replace the placeholder in `apps/desktop/src/routes/matching/+page.svelte`
5. **Tests:**
   - E2E `tests/e2e/shape-matching.spec.ts`: a full round by drag only, a full round by tap only, plus the edge cases SM-40 to SM-44 that can be tested in a browser
   - Gallery: add matching screenshots to `tests/gallery/gallery.spec.ts`; run `pnpm --filter desktop ui:shots`

## Files

`packages/core/src/index.ts`, `packages/core/src/audio/voiceManifest.ts`, `apps/desktop/**`, `docs/ui/**`. Nothing in Codex-owned folders. If Codex's API needs a change, write it under Requests in the report.

## Verify

`pnpm test`, `pnpm typecheck`, `pnpm --filter desktop test:e2e`, `pnpm --filter desktop ui:shots`

## Done when

- [ ] Shape Matching playable end to end at Beginner, Explorer, and Advanced
- [ ] Drag, tap, and keyboard input all complete an activity
- [ ] All narration keys from X-01 resolve to captions (none missing)
- [ ] E2E and gallery pass; report written to `claude-report-C-04.md`; Claude commit made

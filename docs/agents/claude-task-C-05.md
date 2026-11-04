# Claude task C-05 — Numbers & Counting UI

**Owner:** Claude · **Depends on:** X-01 (done), C-04 step 1 (exports + manifest merge) · **Specs:** 07, 09, 11

Read [README.md](README.md) first.

## Goal

A child can play a full Numbers round (count, numeral to quantity, compare, add, pattern) at every difficulty, with numerals shown in the parent's chosen style.

## Steps

1. **Components** in `apps/desktop/src/lib/features/numbers/`:
   - `CountObjects.svelte`: up to 10 objects in at most two rows of 5 (NC-05), with tick marks on counted objects and the number shown above each one (NC-14)
   - `AnswerButton.svelte`: numeral plus dots, at least 88 px
   - `NumbersScene.svelte`: renders the Codex `countingMachine` for all 5 activity kinds and executes its effects
2. **Behavior:** counting narration synchronized with the highlight (NC-13); hint ("count with me") after 2 misses (NC-12); pairing lines for the compare activity; balls sliding together for addition; `+` symbol only in Advanced
3. **Numeral style:** use `formatNumeral` with a `numeralStyle` value added to the desktop settings store (default `bengali`)
4. **Route:** replace the placeholder in `apps/desktop/src/routes/numbers/+page.svelte`
5. **Tests:** E2E `tests/e2e/numbers.spec.ts` (a Beginner round, an Explorer round, no double counting, all three numeral styles); gallery screenshots

## Files

`apps/desktop/**`, `docs/ui/**`. No Codex-owned files.

## Verify

`pnpm test`, `pnpm typecheck`, `pnpm --filter desktop test:e2e`, `pnpm --filter desktop ui:shots`

## Done when

- [ ] All 5 activity kinds playable at every applicable difficulty
- [ ] No double counting; numbers visible when muted
- [ ] E2E and gallery pass; report written to `claude-report-C-05.md`; Claude commit made

# Claude task C-06 — Parent gate, settings screen, rest break, persistence wiring

**Owner:** Claude · **Depends on:** X-02 (Codex: settings, progress, session timer, parent-gate questions) · **Specs:** 10, 11, 12

Read [README.md](README.md) first. **Do not start until `codex-report-02.md` says done.**

## Goal

Parents can open settings through the gate, settings and progress survive restarts, and the rest reminder pauses play at a safe point.

## Steps

1. **Storage adapter:** `apps/desktop/src/lib/platform/indexedDbStorageAdapter.ts`, implementing Codex's `StorageAdapter`; fall back to memory storage when IndexedDB is unavailable (PS-23, CP-35)
2. **Stores:** replace the placeholder `apps/desktop/src/lib/stores/settings.ts` with a wrapper around Codex's `settingsService`; add `progress.ts` and `session.ts` stores
3. **Parent gate UI:** `ParentGate.svelte`, with a 3-second hold and a progress ring (PS-01), a text-only question with 4 answers (PS-02 to PS-04), and keyboard support (PS-05). Put the parent button in the corner of the Welcome screen.
4. **Settings screen:** `apps/desktop/src/routes/parent/+page.svelte`, with every setting in the spec 10 table, the difficulty recommendation (PS-12), a progress reset with confirmation (PS-13), and the privacy statement (PS-14)
5. **Rest break:** `RestOverlay.svelte`, shown at a safe state (SR-10), with Rumi in the `rest` state; continuing requires the gate (SR-22)
6. **Record progress:** call Codex's `progressService` after each completed activity in all three modes (CP-33)
7. **Tests:** E2E for the gate (a tap does nothing, a hold opens it, a wrong answer closes it), settings persisting across reload, and the rest reminder via the Playwright clock; gallery screenshots

## Files

`apps/desktop/**`, `docs/ui/**`, `packages/core/src/index.ts` (exports for X-02 modules only). No Codex-owned files.

## Verify

`pnpm test`, `pnpm typecheck`, `pnpm --filter desktop test:e2e`, `pnpm --filter desktop ui:shots`

## Done when

- [ ] Gate, settings, rest break, and persistence work as specified
- [ ] The parent button is the only route into settings; no external links outside it (PR-04)
- [ ] Report written to `claude-report-C-06.md`; Claude commit made

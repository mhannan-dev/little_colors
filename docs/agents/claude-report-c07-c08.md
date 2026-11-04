# Report: C-07 (audio, assets, scaling) and C-08 (installer, in progress) — 2026-11-04

## C-07 — done

| ID | Status | Notes |
|---|---|---|
| AU-01 | done | Narration never overlaps; queue mode plays in order |
| AU-02 | done | Queue supported |
| AU-03 | done | Interrupt cancels current line and queue |
| AU-04 | done | Mute forwarded to player, stops speech |
| AU-05 | done | No narration before the Play tap (first gesture) |
| AU-06 | done | `stopAll` on pause and leaving a screen |
| AU-07 | done | `instruct` + `replayInstruction`; replay button uses it |
| AU-08 | done | File → speech → caption-only; failures never block |
| AU-10 | done | Caption always published, even when muted |
| AU-40 | done | `pnpm narration:script` → `docs/narration-script.md` (24 lines) |
| AS-10/11 | done | `packages/core/src/assets/manifest.ts`; recordings resolved by key |
| AS-40 | done | `pnpm assets:report`: 54 assets, 53 placeholders |
| AS-50/51 | done | `docs/asset-licenses.md`; Hind Siliguri bundled locally |
| DS-40 | done | UI scales up to 1.6× above 1280×800 (gallery 12 verified) |

### Files

- Core: `src/audio/audioManager.ts`, `src/assets/manifest.ts`, `tests/audio/audioManager.test.ts`, `tests/assets/manifest.test.ts`, `src/index.ts` (exports)
- Desktop: `src/lib/platform/audio.ts`, `src/lib/audio/narrator.ts`, `src/lib/assets/audio/README.md`, `src/routes/+layout.svelte` (scaling), `src/lib/stores/settings.ts` (volume)
- Tooling: `scripts/assets-report.ts`, `scripts/generate-narration-script.ts`, root `package.json` scripts
- Docs: `docs/narration-script.md`, `docs/asset-licenses.md`

### Commands run

- Core `npx vitest run`: 12 files, 401 tests passed (includes Codex suites); `npx tsc --noEmit`: pass
- Desktop `pnpm typecheck`: 0 errors; Playwright e2e + gallery: 6 passed

### Placeholders

Mascot art, all narration recordings (Speech Synthesis / captions for now), and the app icon (Tauri default).

## C-08 — in progress

The release installer build (`pnpm tauri build`) was started; its result will be added here.

## Requests

None for Codex.

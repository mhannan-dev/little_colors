# Asset Licenses

Spec 14, AS-50: every third-party asset and its license. All assets, including original ones, are listed in `packages/core/src/assets/manifest.ts`.

| Asset | Source | License | Used in |
|---|---|---|---|
| Hind Siliguri font (400, 600, 700) | [Fontsource](https://fontsource.org/fonts/hind-siliguri), Indian Type Foundry | SIL Open Font License 1.1 | Desktop UI (bundled locally) |
| Default app icons | Tauri CLI template | MIT / Apache-2.0 | `apps/desktop/src-tauri/icons/` (**placeholder**, replace before release) |

All other visuals (Rumi, football, paint containers, goal, mode-card art) are original SVG drawn in code for this project.

No audio recordings exist yet. Narration uses Speech Synthesis placeholders; see `docs/narration-script.md` for the recording list.

## Placeholder narration (TTS)

Narration MP3s in `apps/desktop/src/lib/assets/audio/` are generated with **Azure AI Speech neural voices** (`pnpm tts:generate`). They are placeholders (status `placeholder`) until a human voice artist records final audio. Before release, confirm the Microsoft product terms for distributing synthesized audio in the app, or replace all files with human recordings.

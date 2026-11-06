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

## Animal Detective photos

`apps/desktop/static/images/*.webp`, used by the Animal Detective game (`packages/core/src/numbers/lessons/animalNarration.ts`).

| File | Animal | Source (from file name) | License | Status |
|---|---|---|---|---|
| `pexels-724211268-33585487.webp`, `pexels-724211268-34345889.webp` | cat | Pexels, photographer id 724211268 | Pexels License | **verify source URL** |
| `pexels-altaf-shah-3143825-6438048.webp` | pigeon | Pexels, Altaf Shah | Pexels License | **verify source URL** |
| `pexels-christina99999-27009654.webp` | cow | Pexels, christina99999 | Pexels License | **verify source URL** |
| `pexels-christina99999-28607441.webp` | goat | Pexels, christina99999 | Pexels License | **verify source URL** |
| `pexels-gabriele-brancati-32566116-14138716.webp` | deer | Pexels, Gabriele Brancati | Pexels License | **verify source URL** |
| `pexels-miguel-cuenca-67882473-18291217.webp` | deer | Pexels, Miguel Cuenca | Pexels License | **verify source URL** |
| `pexels-jay-brand-1763356224-32196368.webp` | lion | Pexels, Jay Brand | Pexels License | **verify source URL** |
| `pexels-raghavendra-narayan-2160151307-36530920.webp` | tiger | Pexels, Raghavendra Narayan | Pexels License | **verify source URL** |
| `pexels-sunny67-38146597.webp` | tiger | Pexels, sunny67 | Pexels License | **verify source URL** |
| `mohish-20211115090834.webp` | buffalo | **unknown** | **unknown** | **BLOCKS RELEASE until the source and license are confirmed or the photo is replaced** |

The Pexels License allows free use and modification in an app without attribution. It does not allow selling unaltered copies or implying endorsement. Record each photo's page URL here before release.

# 14 — Assets, Placeholders & Licensing

**Depends on:** 03, 08
**Phase:** starts in 1, completed before release

## Why this file exists

The AI agent cannot produce final illustrations or recorded human voice. Development uses clearly tracked placeholders that can be swapped for final assets without code changes.

## Asset formats

| Asset | Format |
|---|---|
| UI icons, shapes, simple illustrations | SVG |
| Raster illustrations | WebP or AVIF (PNG fallback only if required) |
| Narration and SFX | Compressed AAC/MP3 or Opus, mono, normalized loudness |
| Mascot (final) | Layered SVG parts or a Rive file (both have web and React Native runtimes) |
| Texture atlases | Only if PixiJS or Skia is adopted |

| ID | Requirement |
|---|---|
| AS-01 | No large video files for character animation. |
| AS-02 | Shared source assets live in `/assets` and are bundled into each app at build time. |

## Asset manifest

```typescript
// packages/core/src/assets/manifest.ts
interface AssetEntry {
  key: string;                 // stable, e.g. "mascot.idle", "shape.star", "audio.bn.color.red"
  path: string;
  kind: "image" | "audio" | "animation";
  status: "placeholder" | "final";
  license: string;             // "original" or a license ID with source
}
```

| ID | Requirement |
|---|---|
| AS-10 | Every asset used by the apps MUST be in the manifest. |
| AS-11 | Code references assets by key only, never by path. |
| AS-12 | Asset keys and mascot state names are stable; swapping files must not change code. |

## Placeholder policy

### Mascot and illustrations

| ID | Requirement |
|---|---|
| AS-20 | Until final art exists, Rumi is a code-drawn SVG built from geometric shapes per [03-mascot-rumi.md](03-mascot-rumi.md), with all 7 animation states. |
| AS-21 | Final art by a human illustrator plugs in through `AssetLoader` using the same keys. |

### Audio

| ID | Requirement |
|---|---|
| AS-30 | During development, narration uses Speech Synthesis (web) or `expo-speech` (mobile) with a `bn-BD` voice when available. |
| AS-31 | With no voice available, narration is skipped and the caption shows (AU-08). |
| AS-32 | The agent generates `docs/narration-script.md` as the recording script for a human voice artist (AU-40). |
| AS-33 | Recorded files go under `assets/audio/<locale>/…` with filenames matching narration keys. |
| AS-34 | Placeholder SFX MAY be generated with the Web Audio API (simple soft tones) and marked `placeholder`. |

### Tracking

| ID | Requirement |
|---|---|
| AS-40 | `pnpm assets:report` lists every placeholder still in use, grouped by kind. |
| AS-41 | A production build prints a warning listing remaining placeholders. |
| AS-42 | The release checklist requires zero placeholders. |

## Licensing

| ID | Requirement |
|---|---|
| AS-50 | No third-party asset (font, image, sound) may be added without its license recorded in `docs/asset-licenses.md`. |
| AS-51 | Fonts MUST support Bengali script fully (e.g. Hind Siliguri, Noto Sans Bengali; open licenses) and are bundled locally, not loaded from a CDN. |
| AS-52 | All audio is originally produced or properly licensed. |

## Files

```text
assets/
packages/core/src/assets/manifest.ts
apps/desktop/src/lib/game/AssetLoader.ts
scripts/assets-report.ts
docs/asset-licenses.md
```

## Acceptance checklist

- [ ] Every asset is in the manifest with a status and license.
- [ ] `assets:report` works and the build prints warnings.
- [ ] A Bengali font is bundled locally with its license recorded.

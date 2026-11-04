# UI Gallery

Screenshots of the current desktop app UI, captured automatically by Playwright in Edge (the same Chromium engine WebView2 uses inside Tauri).

**Regenerate after any UI change:**

```text
pnpm --filter desktop ui:shots
```

Source: [apps/desktop/tests/gallery/gallery.spec.ts](../../apps/desktop/tests/gallery/gallery.spec.ts)

> Mascot art, audio, and the Numbers screen are **placeholders** (spec 14). These images show the app as built, not final art.

## Main flow (1280 × 800)

| | |
|---|---|
| **01 Welcome** ![](01-welcome.png) | **02 Mode selection** ![](02-mode-selection.png) |
| **03 Color Mixing: ready** ![](03-mixing-ready.png) | **04 Pouring red** ![](04-mixing-pouring-red.png) |
| **05 Red applied** ![](05-mixing-red-applied.png) | **06 Mixing swirl** ![](06-mixing-swirl.png) |
| **07 Result: orange** ![](07-mixing-result-orange.png) | **08 Goal + Next** ![](08-mixing-goal-next.png) |
| **09 Round complete** ![](09-round-complete.png) | **10 Coming soon (placeholder)** ![](10-coming-soon-placeholder.png) |

## Shape Matching (1280 × 800)

| | |
|---|---|
| **13 Ready (color match)** ![](13-matching-ready.png) | **14 Item selected (tap mode)** ![](14-matching-selected.png) |
| **15 Dragging** ![](15-matching-dragging.png) | **16 Snapped into place** ![](16-matching-snapped.png) |
| **17 Activity done + Next** ![](17-matching-next.png) | |

Rounds are random, so the shapes and colors differ on each regeneration.

## Window sizes

| | |
|---|---|
| **11 Minimum window 800 × 600** ![](11-mixing-800x600.png) | **12 Full HD 1920 × 1080** ![](12-mode-selection-1920x1080.png) |

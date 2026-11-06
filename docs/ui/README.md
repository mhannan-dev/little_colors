# UI Gallery

WebP screenshots of the desktop app UI, captured automatically by Playwright in Edge (the same Chromium engine WebView2 uses inside Tauri).

**Regenerate after any UI change:**

```text
pnpm --filter desktop ui:shots
```

Source: [apps/desktop/tests/gallery/gallery.spec.ts](../../apps/desktop/tests/gallery/gallery.spec.ts)

> Mascot art and audio are **placeholders** (spec 14). These images show the app as built, not final art.

## Main flow (1280 × 800)

| | |
|---|---|
| **01 Welcome** ![](01-welcome.webp) | **02 Mode selection** ![](02-mode-selection.webp) |
| **03 Color Mixing: ready** ![](03-mixing-ready.webp) | **04 Pouring red** ![](04-mixing-pouring-red.webp) |
| **05 Red applied** ![](05-mixing-red-applied.webp) | **06 Mixing swirl** ![](06-mixing-swirl.webp) |
| **07 Result: orange** ![](07-mixing-result-orange.webp) | **08 Goal + Next** ![](08-mixing-goal-next.webp) |
| **09 Round complete** ![](09-round-complete.webp) | |

## Shape Matching (1280 × 800)

| | |
|---|---|
| **13 Ready (color match)** ![](13-matching-ready.webp) | **14 Item selected (tap mode)** ![](14-matching-selected.webp) |
| **15 Dragging** ![](15-matching-dragging.webp) | **16 Snapped into place** ![](16-matching-snapped.webp) |
| **17 Activity done + Next** ![](17-matching-next.webp) | |

Rounds are random, so the shapes and colors differ on each regeneration.

## Football, Garage, Birds (1280 × 800)

| | |
|---|---|
| **22 Football: ready** ![](22-football-ready.webp) | **23 Football: goal** ![](23-football-done.webp) |
| **24 Garage: ready** ![](24-garage-ready.webp) | **25 Garage: parked** ![](25-garage-done.webp) |
| **26 Birds: ready** ![](26-birds-ready.webp) | **27 Birds: counted** ![](27-birds-done.webp) |
| **28 Ghost-hand demo (first visit, PR-25)** ![](28-ghost-hand-demo.webp) | **29 Voice recording studio (/record, dev only)** ![](29-record-studio.webp) |

## Window sizes

| | |
|---|---|
| **11 Minimum window 800 × 600** ![](11-mixing-800x600.webp) | **12 Full HD 1920 × 1080** ![](12-mode-selection-1920x1080.webp) |

# 02 — Design System

**Depends on:** [01-product-principles.md](01-product-principles.md), [04-architecture-and-stack.md](04-architecture-and-stack.md)
**Applies to:** web and mobile (tokens shared through `packages/design-tokens`)
**Phase:** 1

## Goal

A soft, minimal, cheerful, predictable visual system that never distracts from the learning content.

## Visual identity

- Soft, minimal, cheerful, friendly, predictable, non-distracting.
- Rounded geometric shapes and one consistent illustration style.
- Uncrowded screens: one primary task per screen.

## Design tokens

All values below MUST be defined only in `packages/design-tokens` and generated into CSS variables (web) and a TypeScript theme object (mobile) (DS-01). No hex values elsewhere in app code (DS-02).

### Neutral palette

| Token | Value | Usage |
|---|---|---|
| `bg-primary` | `#FFF9F0` | Main background |
| `bg-secondary` | `#F4F8F5` | Alternate calm background |
| `surface` | `#FFFFFF` | Interactive surfaces |
| `text-primary` | `#263238` | Primary text |
| `text-secondary` | `#52616B` | Secondary text |
| `border-soft` | `#DCE5E1` | Borders |

### Learning colors

| Token | Color | Bengali | Hex |
|---|---|---|---|
| `learn-red` | Red | লাল | `#E5484D` |
| `learn-yellow` | Yellow | হলুদ | `#F2C94C` |
| `learn-blue` | Blue | নীল | `#3478D4` |
| `learn-orange` | Orange | কমলা | `#F28C28` |
| `learn-green` | Green | সবুজ | `#35A66A` |
| `learn-purple` | Purple | বেগুনি | `#8A5AC2` |

### Shape and size tokens

| Token | Value |
|---|---|
| `radius-lg` | 24 px |
| `radius-xl` | 32 px |
| `target-min` | 56 px |
| `target-game` | 72–96 px (preferred 88 px) |

## Requirements

### Color budget

| ID | Requirement |
|---|---|
| DS-10 | A screen SHOULD show no more than 2–3 prominent **learning** colors at once. |
| DS-11 | The budget applies to learning colors only; neutrals, text, outlines, focus rings, and the mascot's fur colors are excluded. |
| DS-12 | Learning colors MUST remain distinguishable on their intended backgrounds. |

### Accessibility

| ID | Requirement |
|---|---|
| DS-20 | Interactive targets MUST be at least 56 × 56 px (CSS px / dp). |
| DS-21 | Primary gameplay targets SHOULD be 72–96 px or larger. |
| DS-22 | Major UI elements MUST use 24–32 px corner radius. |
| DS-23 | Fonts MUST be large and readable; body text ≥ 18 px, instruction captions ≥ 24 px. |
| DS-24 | Visible focus indicators MUST exist for keyboard users. |
| DS-25 | Pointer, touch, and keyboard input MUST be supported where applicable. |
| DS-26 | `prefers-reduced-motion` (web) and OS Reduce Motion (mobile) MUST be respected, in addition to the in-app setting. |
| DS-27 | Text contrast MUST meet WCAG 2.2 AA. |
| DS-28 | Color MUST NOT be the only carrier of meaning (see PR-24). |
| DS-29 | Every interactive element MUST have an accessible label in the current language. |

### Display modes

| ID | Requirement |
|---|---|
| DS-30 | Default warm mode (tokens above). |
| DS-31 | Optional dark mode with its own neutral tokens; learning colors may be adjusted for contrast but must stay recognizably the same color. |
| DS-32 | Reduced-motion mode replaces movement with short fades (≤ 300 ms). |
| DS-33 | No in-app brightness control; parents use device settings. |

### Responsive layout

| ID | Requirement |
|---|---|
| DS-40 | Support small phones, large phones, tablets (portrait and landscape), and desktop browsers. |
| DS-41 | Primary interaction areas MUST never be cut off. |
| DS-42 | No horizontal scrolling. |
| DS-43 | Layout regions per game screen: top bar (navigation and audio controls), center (mascot and play area), bottom (answer or paint targets). |

## Files

```text
packages/design-tokens/src/tokens.ts      # source of truth
packages/design-tokens/build/tokens.css   # generated for web
packages/design-tokens/build/theme.ts     # generated for mobile
apps/desktop/src/lib/styles/global.css
```

## Tests

- Contrast check script for every text/background token pair (WCAG AA).
- Unit test: generated CSS and TS theme contain identical values.
- Visual check at 360×640, 768×1024, 1024×768, and 1440×900.

## Acceptance checklist

- [ ] DS-01, DS-02: tokens exist only in `packages/design-tokens`.
- [ ] DS-20 to DS-29 verified.
- [ ] Dark and reduced-motion modes work (DS-31, DS-32).
- [ ] No horizontal scroll at any tested viewport (DS-42).

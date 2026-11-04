# 13 — Desktop App (Tauri), Offline & Performance

**Depends on:** 04, 14
**Phase:** 1 (shell), checked again in 6 and 7
**Current priority:** Desktop is the **first and only** target for now. A public web/PWA version is not planned. The mobile app (17) follows after desktop is complete.

## Structure

The desktop app is a SvelteKit UI running inside a Tauri 2 window.

```text
apps/desktop/
  src/                 SvelteKit UI (routes, components, stores, platform adapters)
  static/
  src-tauri/           Rust shell: tauri.conf.json, capabilities, icons
  vite.config.ts       adapter-static, SPA fallback index.html, fixed dev port 5173
```

| Item | Value |
|---|---|
| Product name | Little Colors |
| Identifier | `com.littlecolors.app` |
| Window | 1280 × 800 default, minimum 800 × 600, centered, resizable |
| Windows installer | NSIS (`.exe`) |
| Rust toolchain | stable (GNU or MSVC on Windows) |

## Commands

```text
pnpm dev              # tauri dev (starts Vite on 5173, opens the desktop window)
pnpm build:desktop    # tauri build → installer in apps/desktop/src-tauri/target/release/bundle/
pnpm test / typecheck # all packages
```

## Requirements

### Offline & security

| ID | Requirement |
|---|---|
| OF-01 | All UI, fonts, images, and audio are bundled in the app; no network is used at any time. |
| OF-02 | Content Security Policy allows only `'self'`, `data:`, `blob:`, and Tauri IPC; no remote origins. |
| OF-03 | No gameplay feature depends on a remote API (AR-11). |
| OF-04 | Tauri capabilities stay minimal (`core:default`); any added plugin needs a reason recorded in `docs/decisions/`. |
| OF-05 | No auto-updater in the MVP; new versions ship as new installers. |
| OF-06 | No "you are offline" messages anywhere. |

### Desktop behavior

| ID | Requirement |
|---|---|
| OF-10 | Settings and progress persist between launches (IndexedDB inside the WebView, behind `StorageAdapter`). |
| OF-11 | Minimizing the window or switching away pauses gameplay, audio, and the session timer (`visibilitychange` / window blur). |
| OF-12 | F11 toggles fullscreen; Escape leaves fullscreen. Fullscreen is recommended for children. |
| OF-13 | Keyboard and mouse fully supported; touch screens (Windows tablets) also work. |
| OF-14 | Right-click context menu, text selection, and browser shortcuts (reload, dev tools, zoom) are disabled in release builds. |
| OF-15 | Layout works from 800 × 600 up to 4K without cutting off play areas (DS-40 to DS-42). |
| OF-16 | Closing the window during gameplay closes immediately; progress up to the last completed activity is already saved (CP-33). |

### Performance

| ID | Requirement |
|---|---|
| OF-20 | Target modest Windows laptops (integrated graphics, 4 GB RAM). |
| OF-21 | 60 FPS for ordinary animations; MUST remain usable at 30 FPS. |
| OF-22 | No continuous rendering when nothing moves. |
| OF-23 | Lazy-load heavy libraries (e.g. PixiJS) per route. |
| OF-24 | Release animation resources and audio buffers when leaving a screen. |
| OF-25 | Cold start to an interactive Welcome screen ≤ 3 s on the target laptop. |
| OF-26 | Installer size SHOULD stay under 50 MB, excluding final audio. |

### Animation renderer

| ID | Requirement |
|---|---|
| OF-30 | SVG + CSS is the default renderer. |
| OF-31 | PixiJS only for the mascot and football scene, and only if SVG/CSS misses OF-21 on the target laptop. |
| OF-32 | The decision and measurements go in `docs/decisions/animation-renderer.md` during Phase 4. |

## Testing

- E2E: Playwright against the Vite dev/preview build of the UI (the UI uses no Tauri-only APIs in the MVP).
- Smoke test of the real desktop build on Windows: install, launch, play one activity per mode, close, relaunch, confirm progress persisted.
- Manual: fullscreen, minimize-pause, keyboard-only play, 800 × 600 and 1920 × 1080 windows.

## Acceptance checklist

- [ ] `pnpm dev` opens the desktop window with hot reload.
- [ ] `pnpm build:desktop` produces a Windows installer.
- [ ] Works with networking disabled.
- [ ] OF-10 to OF-16 verified.
- [ ] Performance targets measured and reported.

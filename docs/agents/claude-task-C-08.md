# Claude task C-08 — QA pass and Windows installer

**Owner:** Claude · **Depends on:** C-04, C-05, C-06 for the full pass (the installer build can be tried earlier) · **Specs:** 13, 15

Read [README.md](README.md) first.

## Steps

1. **Installer:** `pnpm build:desktop` produces an NSIS `.exe` under `apps/desktop/src-tauri/target/release/bundle/nsis/`. Record its size against OF-26 (< 50 MB).
2. **Release behavior check** (OF-10 to OF-16): fullscreen with F11/Esc, minimize pauses play, no context menu or reload shortcuts, close and relaunch keeps progress
3. **Offline check:** run the installed app with networking disabled and play one activity per mode (OF-01, OF-02)
4. **Accessibility:** add an axe-core scan to Playwright for every screen; keyboard-only play-through; touch targets ≥ 56 px (spec 15)
5. **Performance:** cold start ≤ 3 s; record FPS during animations (OF-21, OF-25)
6. **Placeholders:** run `pnpm assets:report` and list what blocks release (final art, recordings, app icon)

## Files

`apps/desktop/**`, `docs/agents/claude-report-C-08.md`. No Codex-owned files.

## Done when

- [ ] Installer builds, installs, and runs on Windows
- [ ] Every check above passes or is listed as a known limitation with numbers
- [ ] Report written to `claude-report-C-08.md`; Claude commit made

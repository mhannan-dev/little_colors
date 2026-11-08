# 0001 — In-app updates (Tauri updater)

- **Date:** 2026-11-08
- **Status:** Accepted by the product owner
- **Changes:** OF-01 and OF-05 in [13-desktop-tauri.md](../specs/13-desktop-tauri.md). OF-04 requires this record for the new plugins.

## Context

New games ship often. Without an update path, every installed PC keeps the first version unless a parent downloads and runs a new installer by hand. Few parents will do that regularly.

## Decision

Add `tauri-plugin-updater` and `tauri-plugin-process` (restart after install). This is the **only** network use in the app.

| Rule | How it is kept |
|---|---|
| Games never need the internet (OF-03) | All content stays bundled. Updates are optional. |
| No internet means nothing changes | The check is skipped when the device is offline. Any network error is ignored silently, with no message, no retry loop, and no "you are offline" text (OF-06). |
| Rare and light | At most one check every 20 hours, 3 seconds after start-up. It only downloads a small `latest.json`. |
| Nothing about the child is sent | The request is a plain GET for `latest.json`, with no account and no analytics. |
| A child cannot start it | The notice appears only on the home screen, never during a game. Installing needs a 2-second press and hold by a grown-up, and "পরে" (Later) hides it. |
| Only genuine updates install | Every update is signed. The app checks the signature against the public key in `tauri.conf.json`. The private key never enters the repository. |
| The WebView stays locked down | The update check runs in Rust. The CSP (OF-02) is unchanged, with no remote origins. |

Updates are published by `.github/workflows/release-desktop.yml` to a **public** releases repo (`mhannan-dev/rumi-learning-releases`), because the source repo is private. See [docs/releasing.md](../releasing.md).

## Consequences

- Local builds (`run.ps1 build`) stay unsigned and don't produce update files. Only the CI release does (`tauri.release.conf.json`).
- Until the real public key replaces `REPLACE_WITH_UPDATER_PUBLIC_KEY`, no update can install. The check fails quietly.
- Losing the private key means installed apps can never accept another update. It must be backed up.

# Releasing a new version (with in-app updates)

Installed apps check for updates by themselves. A parent confirms on the home screen, and the app updates and restarts. This guide explains how to publish a version so that happens. Background: [decisions/0001-in-app-updates.md](decisions/0001-in-app-updates.md).

## One-time setup

1. **Create a public repo for installers:** create `mhannan-dev/rumi-learning-releases` on GitHub. It must be **public**, and it can stay empty.
   - To use a different name, change it in two places: `endpoints` in `apps/desktop/src-tauri/tauri.conf.json` and `owner`/`repo` in `.github/workflows/release-desktop.yml`.
2. **Create the signing key.** Do this on your own PC and never share the private key:
   ```powershell
   cd apps\desktop
   pnpm tauri signer generate -w "$env:USERPROFILE\.tauri\rumi-updater.key"
   ```
   - Choose a password when asked.
   - Back up `rumi-updater.key` and the password somewhere safe, such as a password manager. **If you lose them, installed apps can never update again.**
3. **Put the public key in the app:** open `rumi-updater.key.pub`. In `apps/desktop/src-tauri/tauri.conf.json`, replace `REPLACE_WITH_UPDATER_PUBLIC_KEY` with its full contents, then commit. The public key is safe to commit.
4. **Add secrets to the private source repo** (Settings → Secrets and variables → Actions):

   | Secret | Value |
   |---|---|
   | `TAURI_SIGNING_PRIVATE_KEY` | contents of `rumi-updater.key` |
   | `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | the password |
   | `RELEASES_TOKEN` | a fine-grained token with **Contents: Read and write** on `rumi-learning-releases` only |

## Every release

1. Bump the version in **both** `apps/desktop/src-tauri/tauri.conf.json` and `apps/desktop/package.json`, for example `0.1.0` → `0.2.0`. Commit.
2. Tag and push:
   ```powershell
   git tag v0.2.0
   git push origin main v0.2.0
   ```
3. GitHub Actions then:
   - runs the tests,
   - builds the signed installer,
   - publishes it with `latest.json` to `rumi-learning-releases`.
4. Within about a day, installed apps that are online show "নতুন খেলা এসেছে!" (new games are here) on the home screen.

Tip: ship **about once a week**, not every day. Children like things to stay familiar, and each version gets time to be tested.

## First install on a new PC

Download the `.exe` from the latest release at `https://github.com/mhannan-dev/rumi-learning-releases/releases/latest`. Windows SmartScreen may warn, because the installer isn't code-signed with a paid certificate. That's a separate concern from update signing.

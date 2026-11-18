# Repository readiness audit

Reviewed on 2026-11-18. This review covers the current working-tree source, configuration, scripts, package manifests, GitHub workflow, and documentation. Generated binaries, dependency contents, ignored local secret files, and full Git history were outside the credential scan. Runtime behaviour and package vulnerability advisories require separate validation.

## Changes applied

| Area | Result |
| --- | --- |
| README | Added feature and architecture summaries, badges, setup, environment documentation, usage examples, existing screenshots, and a future-demo placeholder |
| Environment | Documented optional Azure, build, Android, screenshot, and release settings with empty or commented placeholder values |
| Git hygiene | Ignored nested developer caches, deployment output, signing files, local environment files, and per-user IDE files while preserving shared IDE settings and example files |
| Licensing | Added the standard MIT License and aligned project package metadata |
| Community | Added contribution instructions, private security-reporting guidance, and bug/PR templates |
| CI | Added read-only pull-request tests, typechecking, and frontend builds, with no release credentials |
| Release workflow | Limited default token permissions and added a guard against publishing with a placeholder updater public key |

## Credentials and hardcoded values

The source scan checked common private-key headers, AWS access-key formats, GitHub and API token formats, credential-bearing HTTP URLs, and literal key/password assignments. A final pass checked 747 text files, including Python scripts and vendored text assets. No high-confidence live credential was detected in the reviewed source. A pattern scan cannot prove that a repository or its history is secret-free.

| Location | Finding | Action |
| --- | --- | --- |
| `apps/desktop/src-tauri/tauri.conf.json`, updater configuration | The public key is a replacement placeholder. A public key is intended to be public | Configure the real public key and GitHub Actions signing secrets before publishing. The release workflow now rejects the placeholder |
| `apps/desktop/soccer-android/build-apk.mjs`, lines 45–50 | Uses the conventional Android debug-keystore credentials for a local prototype APK | Keep this debug output local. Add a separate release-signing process before distributing an Android release |
| `.github/workflows/release-desktop.yml`, action environment | Release credentials are referenced through GitHub Actions secrets | Configure those secrets in GitHub and scope the release token to the target installer repository |
| `.env.example` | Empty credentials and commented build-path examples | Fill real values only in ignored local files or secret settings |

The source scan found no `dd()`, `dump()`, `debugger`, Rust `dbg!`, or stray application `console.log` calls. If an actual credential was previously committed, rotate it and scan repository history before making the repository public.

## Logging inventory

These calls were reviewed for cleanup. Their current uses are purposeful command-line output or startup error reporting, so deleting them would reduce diagnostics.

| Location | Calls | Decision |
| --- | --- | --- |
| `apps/desktop/static/formula-circuit-web/boot.js:18` | `console.error` | Keep the WASM startup error diagnostic. Reassess error redaction if future loaders include sensitive inputs |
| `apps/desktop/soccer-android/build-apk.mjs:52` | `console.log` | Keep the generated APK path output |
| `scripts/assets-report.ts:11,13,15,17,19,21` | `console.log` | Keep the asset report output |
| `scripts/generate-narration-script.ts:47` | `console.log` | Keep the narration generation summary |
| `scripts/generate-tts.ts:41,73` | `console.error` | Keep invalid-option and missing-configuration diagnostics |
| `scripts/generate-tts.ts:66,67,133,140,153,172,176` | `console.log` | Keep job counts, progress, and output summaries |
| `scripts/make-favicon.mjs:71` | `console.log` | Keep the generated-icon summary |
| `apps/desktop/src/lib/features/flag/vendor_flags.py:82` | `print()` | Keep the asset-vendoring summary |

The native debug log plugin is installed only when `debug_assertions` is true in `apps/desktop/src-tauri/src/lib.rs`.

## Remaining release work

1. Configure and validate real updater signing, then build and smoke-test a Windows installer. The checked-in key is still a placeholder.
2. Verify third-party redistribution rights independently of the MIT source licence. The asset guide records incomplete photo provenance and pending TTS distribution review. Flag artwork and locale data include separate upstream notices.
3. Review the legacy Counter Rush route. Its frontend invokes kitchen commands, while the current Rumi Rust handler registers City Bus Driver commands only. The Counter Rush standalone example registers its own engine. Publishing the main desktop app requires deciding whether to wire the route or retire it.
4. Run the relevant browser tests, native Rust checks, embedded Formula WASM tests, and a clean-machine installer check before a release. PR CI verifies TypeScript and frontend builds, without certifying native packaging or gameplay.
5. In GitHub settings, enable private vulnerability reporting and secret scanning/push protection where available. Require the CI check and review before merging to the default branch. These hosted settings require repository-owner configuration.
6. Review dependency advisories and licence notices before public distribution. This audit did not run an online advisory database scan or rewrite repository history.

## Suggested GitHub About settings

Description

> Offline Bengali and English learning games for kids, built with Tauri, Svelte, Rust and Three.js. Letters, maths, puzzles and playful 3D adventures.

Topics

`educational-games`, `kids-learning`, `bengali`, `offline-first`, `tauri`, `svelte`, `typescript`, `rust`, `threejs`, `desktop-app`

These are suggestions for the repository owner. Updating local files does not change GitHub's About settings.

## Validation scope

| Check | Local result |
| --- | --- |
| `pnpm test` | Passed, 687 tests across core, desktop, and design tokens |
| `pnpm typecheck` | Passed, including zero Svelte errors or warnings |
| `pnpm --filter desktop build --logLevel warn` | Passed, with an existing warning about chunks larger than 500 kB |
| `pnpm tts:generate --dry-run` | Passed without Azure credentials or network generation |
| Documentation and configuration checks | Passed, including 28 local links, 15 environment names, 22 ignore rules, and five package licences |
| Cargo metadata | All three manifests passed offline, locked metadata validation with MIT licences |
| `git diff --check` | Passed |

The new GitHub workflow has not executed on GitHub during this local patch. Full browser tests, native installer builds, WASM runtime checks, dependency advisory databases, and repository history were not revalidated here. CI execution and a signed installer release must be checked after pushing and configuring GitHub.

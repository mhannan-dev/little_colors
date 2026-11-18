# Contributing to Rumi Learning Adventures

Thank you for helping make learning welcoming and accessible. Contributions may include bug fixes, tests, Bengali or English wording, original artwork, accessibility improvements, and documentation.

## Before starting

Read the [setup instructions](README.md#development-setup), [product principles](docs/specs/01-product-principles.md), and [project brief](GEMINI.md). Automated coding agents must also follow [the ownership guide](docs/agents/README.md). For a new game or a significant redesign, open an issue describing the child-facing behaviour and affected modules before implementation.

Keep discussion respectful and constructive. Use English for broadly accessible technical discussion. Bengali reports and translation contributions are welcome.

## Reporting bugs

Search existing issues, then use the bug report template. Include the app version or commit, Windows version, launch method, activity, reproduction steps, expected behaviour, and actual behaviour. State whether the problem occurs in Tauri or in a browser. Redacted screenshots and small log excerpts can help.

Remove names, faces, voice recordings, credentials, local usernames, and other personal information before uploading files. Use [the private security process](SECURITY.md) for suspected vulnerabilities.

## Local workflow

1. Fork the repository and clone your fork.
2. Install Node.js 24, pnpm 11, and the desktop prerequisites in the README.
3. Run `pnpm install --frozen-lockfile` from the repository root.
4. Create a focused branch, such as `fix/table-tennis-input` or `docs/setup-guide`.
5. Run `pnpm dev` for native features or `pnpm --filter desktop dev` for the browser UI.
6. Make the smallest complete change. Use existing components, rules, design tokens, and narration helpers.

The Bevy and restaurant examples have independent setup instructions under `examples/`. Formula Circuit requires the additional [WASM preparation](README.md#formula-circuit-assets) when testing its embedded canvas.

## Code and content expectations

- Use readable TypeScript and Rust with clear names and focused modules.
- Keep pure game rules separate from rendering and platform operations where practical.
- Give new controls Bengali and English labels, keyboard access, visible focus, and large touch targets.
- Follow the product principles for gentle feedback, reduced motion, background pause, and child privacy.
- Include new narration entries through the existing audio system.
- Retain third-party licence notices and record asset sources in [the asset licence guide](docs/asset-licenses.md).
- Keep credentials in local environment files or GitHub Actions secrets. Commit only placeholder examples.
- Avoid generated output, downloaded dependencies, unrelated formatting, or dependency updates in feature PRs.
- Add regression tests when changing rules, persistence, input, or other behaviour that can fail unnoticed.

## Verification

Run the workspace checks before submitting a code change.

```powershell
pnpm test
pnpm typecheck
pnpm --filter desktop build
```

Run the relevant Playwright tests for UI or interaction changes. They use Microsoft Edge and a dedicated Vite server on port 5179.

```powershell
cd apps/desktop
pnpm exec playwright test tests/e2e/table-tennis.spec.ts --workers=1
```

For Rust changes, use the relevant Cargo manifest with `cargo check --locked` and `cargo test --locked`. For gameplay, also test the Tauri entry point, Back navigation, language switching, pause/resume, and reopening the activity. Documentation-only changes can use link and example validation. Mention any skipped or unavailable checks in the PR.

## Submitting a pull request

Use the PR template. Explain the problem, the resulting behaviour, and verification results. Include screenshots or a short redacted recording for visual changes. Link a related issue when applicable and keep each PR focused enough to review independently. Maintainers may request changes before merging.

Contributions are provided under [the project's MIT License](LICENSE). Ensure you have permission to contribute code and media. Third-party assets retain their respective terms.

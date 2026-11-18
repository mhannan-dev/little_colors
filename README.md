# Rumi Learning Adventures

রুমির শেখার অভিযান is an offline learning and play app for children, built with Svelte 5, TypeScript, Three.js, Rust, and Tauri 2. Rumi guides children through activities in Bengali and English. English is the first-launch default, and the language switcher changes instructions and labels throughout the app.

The Play menu includes colour mixing, shape matching, letters, counting and simple maths, flags, fruits, flowers, animals, building, everyday habits, driving adventures, and 3D Table Tennis. Categories and search help families find a game. Formula Circuit uses Bevy and Rapier compiled to WebAssembly inside the app window.

## Development setup

Run commands from the repository root unless a section says otherwise.

Use Node.js 24 and pnpm 11, matching the Windows release workflow. Desktop development also requires a stable Rust MSVC toolchain with Rust 1.90 or newer, Microsoft C++ Build Tools with the Windows SDK, and Microsoft Edge WebView2 Runtime.

```powershell
npm install --global pnpm@11
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` starts the Vite server and the Tauri desktop window. The first Rust build can take several minutes. Tauri expects the development server on port 5173. Stop the command with Ctrl+C when finished.

For a browser preview of the Svelte UI, run the following command and open the address printed by Vite.

```powershell
pnpm --filter desktop dev
```

Games that invoke Rust commands, such as City Bus Driver, require the Tauri desktop window for their backend. The PowerShell launcher also provides shortcuts through `./run.ps1 help`, `./run.ps1 dev`, and `./run.ps1 web`.

## Formula Circuit assets

Build Formula Circuit's WebAssembly assets once before playing it from a source checkout. The binding tool version must match the `wasm-bindgen` entry in `examples/formula-circuit/Cargo.lock`. The following PowerShell commands read that version directly.

```powershell
rustup target add wasm32-unknown-unknown
$formulaLock = Get-Content examples/formula-circuit/Cargo.lock -Raw
$bindingVersion = [regex]::Match($formulaLock, '(?m)^name = "wasm-bindgen"\r?\nversion = "([^"]+)"').Groups[1].Value
if (!$bindingVersion) { throw 'wasm-bindgen version missing from Formula Circuit Cargo.lock' }
cargo install wasm-bindgen-cli --locked --version $bindingVersion
pnpm --filter desktop build:formula
pnpm dev
```

If the CLI is installed outside PATH, set `WASM_BINDGEN` to its executable path before running `build:formula`. The generated JavaScript and WASM files live in `apps/desktop/static/formula-circuit-web/generated/`. Rebuild them after changing the racing example.

## Build the Windows installer

After installing the Formula Circuit build tools above, run the following command.

```powershell
pnpm build:desktop
```

Tauri builds Formula Circuit, builds the Svelte frontend, and produces an NSIS installer under `apps/desktop/src-tauri/target/release/bundle/nsis/`. `pnpm --filter desktop build` builds only the frontend. The update signing and publishing procedure is documented in [the release guide](docs/releasing.md).

## Checks

```powershell
pnpm test
pnpm typecheck
pnpm --filter desktop test:e2e
```

Browser tests use Microsoft Edge and start their own Vite server on port 5179. For an individual game, run a targeted test from `apps/desktop`.

```powershell
pnpm exec playwright test tests/e2e/table-tennis.spec.ts --workers=1
```

The UI gallery is generated with `pnpm --filter desktop ui:shots`. Screenshots intended as documentation are stored in `docs/ui/`.

## Project layout

| Directory | Contents |
| --- | --- |
| `apps/desktop/src/routes/` | Svelte screens and game routes |
| `apps/desktop/src/lib/` | Game features, shared UI, narration, stores, and Three.js rendering |
| `apps/desktop/src-tauri/` | Native desktop shell, City Bus Driver backend, and installer configuration |
| `apps/desktop/static/` | Bundled images and Formula Circuit web assets |
| `packages/core/` | Shared TypeScript game rules, learning activities, settings, progress, and storage |
| `packages/design-tokens/` | Shared colours, typography, spacing, and themes |
| `examples/` | Standalone Formula Circuit and Counter Rush starters |
| `scripts/` | Asset reports and narration tooling |
| `docs/` | Product specifications, recording and release guides, asset licences, and agent reports |

The standalone examples have their own setup instructions in [Formula Circuit](examples/formula-circuit/README.md) and [Counter Rush](examples/restaurant-sim/README.md).

## Content and narration

Most 3D objects are generated from simple shapes. Photo assets and their attribution are documented in [the asset licences](docs/asset-licenses.md). Images under `apps/desktop/static/images/` use WebP. Native app icons use the formats required by Tauri.

The app bundles its content for offline play. Narration supports recorded clips and placeholder speech. See [the recording guide](docs/recording-guide.md) for the development recording studio. `.env.example` documents optional Azure TTS generation settings. Local `.env` files are ignored by Git.

Before contributing, read [the project brief](GEMINI.md), [the product principles](docs/specs/01-product-principles.md), and [the agent ownership guide](docs/agents/README.md).

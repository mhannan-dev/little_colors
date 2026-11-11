# City Bus Driver and same-window games

Open **Play → City Bus Driver** in the Rumi desktop application. Pick an unlocked route and choose **Start route**. Follow the cyan line and the next-target marker. Use **WASD** or the arrow keys to drive, **E** for the doors, **Q/R** for the indicators, **C** to switch between chase and cockpit views, and **Esc** to pause. The on-screen controls also accept pointer and touch input.

The 60 procedural routes use the same 5×5 road grid. Stop near a marked boarding point, open the doors until service finishes, and close them before continuing. Drop the passengers off at the terminal and close the doors to complete the mission. The simulation models a single bus with arcade steering, grid-based curb boundaries, and scripted traffic.

## Code

- `apps/desktop/src-tauri/src/city_bus_driver/mod.rs` defines the IPC contract, with serializable types in `model.rs`. `save.rs` persists progress as `city-bus-driver.json` under Tauri's app-local data directory. A completed run can be saved again safely. Only the Rust-computed score and next unlock are recorded.
- `simulation.rs` owns the monotonic mission clock, movement, traffic, stops, passengers, and scoring. The three score categories total up to 1,000 points.
- `src-tauri/src/main.rs` delegates to `little_colors_lib::run()`. The existing Tauri builder in `src-tauri/src/lib.rs` manages the game and registers the six commands.
- `gameStore.ts` serializes physics IPC and exposes reactive speed, passengers, timetable, and next-stop values.
- `BusDriverGame.svelte` owns the dispatch, HUD, pause, and result screens. `Viewport.svelte` samples controls every 50 ms while `Canvas.svelte` renders snapshots at frame rate. The Three.js scene has a map fallback for unavailable WebGL.

## Formula Circuit and Counter Rush

Both Play cards open routes inside Rumi. Counter Rush shares its Svelte screen and Rust engine with the standalone example. Returning to Play freezes the shift clock until the kitchen opens again.

Formula Circuit keeps its Bevy renderer and Rapier physics. Its WebAssembly build loads in a local canvas frame. Leaving the route disposes the frame and game loop.

For a source checkout, install Rust's WASM target and the matching binding tool once, then build the canvas assets before opening Rumi.

```powershell
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --locked --version 0.2.130
pnpm --filter desktop build:formula
pnpm dev
```

The Windows installer builds the Formula Circuit assets before bundling the frontend. The standalone projects remain under `examples/`.

## Windows development profile

Windows debug windows use a separate WebView2 profile. This avoids sharing the installed app's profile when starting a development build. The first debug launch has fresh WebView storage, including language preferences. Rust save files still use the app-local data directory.

## Verification

- The desktop Svelte typecheck and production build passed. The production frontend passed the Edge Play-menu and bus-flow test with mocked Tauri IPC, including the map fallback.
- Five isolated Rust tests passed for route generation, boarding, driving and penalties, pause and timeout, and save replacement. The Tauri test harness linked but this Windows environment returned an entry-point error when starting that harness.
- The rebuilt Rumi executable opened a native window with its automatic debug profile.
- Both new Play routes passed the single-window navigation tests in Edge. Counter Rush also passed four Rust tests and a native WebView2 smoke test that started a shift, paused it on Back, and resumed it on reopening.

## Requests

None.

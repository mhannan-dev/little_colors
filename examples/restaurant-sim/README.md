# Counter Rush

Counter Rush is a standalone 2D time-management restaurant starter built with Tauri 2, Rust, Svelte 5, and TypeScript. The first shift seats up to four customers at a time. Cook burgers, pour lemonade, and serve single-item or combo orders before the customers leave. A completed order pays coins once.

## Run locally

Install Node.js 22.12 or newer and the [Tauri desktop prerequisites](https://v2.tauri.app/start/prerequisites/). On Windows, use the MSVC Rust toolchain, Microsoft C++ Build Tools, and WebView2. If the active Rust toolchain targets Windows GNU, select MSVC in this directory before launching.

```sh
cd examples/restaurant-sim
npm install
npm run tauri dev
```

Click **Start shift**, prepare an item at its station, select a customer, and click **Serve** when the item is ready. The station can hold one item at a time. Discard an item to free its slot.

```sh
npm run check
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

The Vite browser preview shows the shell and the desktop launch instruction. A Tauri window supplies the game engine. Desktop installer bundling is disabled in the starter.

## Project layout

```text
restaurant-sim/
  package.json             Svelte 5, Vite, TypeScript, and Tauri JavaScript API and CLI
  src/
    App.svelte             Snapshot subscription, shift screen, and kitchen layout
    CustomerCard.svelte    Order tickets and customer patience
    StationCard.svelte     Station actions and preparation progress
    kitchen.ts             Typed Tauri calls and game-state listener
    model.ts               TypeScript representation of the Rust snapshot
  src-tauri/
    Cargo.toml             Tauri, Serde, and Tokio
    tauri.conf.json         Window, development server, and production entry
    capabilities/main.json
    src/
      main.rs              Tauri startup and command registration
      engine.rs            Command mailbox, monotonic clock, and snapshot events
      game.rs              Domain types, rules, recipes, queue, and unit tests
```

## State and event flow

1. Svelte subscribes to `game-state` and then requests `get_game_state`. Subscribing first closes the gap between fetching the initial snapshot and receiving events.
2. The commands `start_shift`, `start_cooking`, `serve_order`, and `discard_item` put actions on the engine's bounded mailbox and await replies. One Rust task owns mutable game state and processes actions sequentially.
3. The engine uses a monotonic clock to update arrivals, expiry, and station deadlines. It advances the clock before validating each action and publishes a snapshot every 100 ms during a shift and after each action. Each snapshot carries a revision so command replies and events can safely arrive out of order.
4. Svelte derives bar values from the snapshot timestamp and the stored deadlines. Rust validates order items and awards coins after the last item is served.

Coins and station contents are scoped to the current shift. The starter keeps state in memory. To add recipes, extend the Rust catalog and update the TypeScript IDs and icons. Multi-slot stations, ingredients, upgrades, and persistence can be added behind the existing command and snapshot boundary.

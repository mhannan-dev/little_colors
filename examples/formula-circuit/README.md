# Formula Circuit

Formula Circuit is a standalone 3D racing starter in Rust. It has one procedural oval, a formula-style car, an instrument display, and a chase camera. It runs in Bevy's own desktop window.

## Run

1. Install a current stable Rust toolchain and follow the [Bevy OS prerequisites](https://bevy.org/learn/quick-start/getting-started/setup/). On Windows, use the MSVC toolchain and the Visual Studio C++ build tools. The starter enables X11 window support for Linux.
2. Build and launch from this directory.

```sh
cd examples/formula-circuit
cargo run --locked
```

If your Windows default is the GNU toolchain, run `cargo +stable-x86_64-pc-windows-msvc run --locked` after installing the MSVC Rust toolchain.

Use **W / ↑** to accelerate, **S / ↓** to brake and then reverse, and **A / ←** and **D / →** to steer. **R** returns the car to the grid. **F3** toggles the Rapier collider overlay. Use `cargo run --release --locked` for representative performance.

```sh
cargo check --locked --all-targets
cargo test --locked
```

## Dependencies

[Cargo.toml](Cargo.toml) pins **Bevy 0.18.1** and **bevy_rapier3d 0.33.0**. The Rapier plugin declares Bevy 0.18 support. The manifest enables the rendering, window, UI, and collider debug features needed for this example. The [Bevy feature list](https://docs.rs/crate/bevy/0.18.1/features) and the [Rapier plugin manifest](https://docs.rs/crate/bevy_rapier3d/0.33.0/source/Cargo.toml) document those dependencies.

## Code layout

| File | Responsibility |
| --- | --- |
| `src/main.rs` | Desktop window, 60 Hz simulation clock, default Bevy plugins, Rapier, and debug toggle |
| `src/track.rs` | Oval road mesh, ground, fixed barrier colliders, start line, and lighting |
| `src/vehicle.rs` | Vehicle chassis, visual children, input capture, and force application |
| `src/handling.rs` | Engine-independent handling model and controller tests |
| `src/camera.rs` | Smooth chase camera and speed display |

## How the loop works

1. Bevy updates its keyboard resource. The vehicle plugin samples held inputs in `PreUpdate` and retains a reset request until a fixed tick consumes it.
2. The vehicle controller runs in `FixedUpdate` before Rapier's `SyncBackend` set. It reads `Transform` and `Velocity`, then writes an `ExternalForce` with drive, brake, drag, lateral grip, and steering torque. Both Bevy and Rapier use the same 60 Hz step. Rapier uses two substeps per tick.
3. Rapier integrates the dynamic chassis and resolves contact with the fixed track and walls. Continuous collision detection helps prevent high-speed tunnelling. Pitch and roll are locked for this handling model.
4. The camera reads the car pose each rendered frame. It smooths the chase offset and look direction before Bevy propagates transforms. The HUD displays horizontal speed in km/h.

The car uses a single rigid chassis with an arcade grip model. Its wheels are render meshes. The prototype has a flat driving surface and one procedural track. It has no suspension, tire load transfer, lap timing, or AI opponents.

The controller does no heap allocation during fixed updates. The track reuses mesh and material handles, the speed display updates only when the rounded speed changes, and collider drawing starts disabled.

## Extend the prototype

- **Lap timing**. Add a race plugin with ordered checkpoint sensors and a per-car race component. Enable collision events on the sensors. Advance the expected checkpoint on a valid forward crossing and award a lap only after the full sequence and start line. Use fixed simulation time for lap timestamps and reset the sequence when the car resets.
- **Vehicle dynamics**. Add four raycast wheel contacts, then compute suspension force, normal load, and per-wheel tire forces at the contact patches. Put the handling parameters in a tuning resource or asset and test against repeatable braking and cornering scenarios.
- **Camera and tracks**. Add a Rapier query between the chase target and camera to keep the view clear of walls. Replace the oval with a glTF track and author simplified static collision meshes separately from the visible geometry.
- **Tauri 2 launcher**. Keep Bevy as a separate native process. A Tauri launcher can start it, send setup or race commands, and display versioned snapshots over local IPC. Keep telemetry rate-limited and reserve the Bevy fixed schedule for simulation work. This starter has no Tauri dependency.

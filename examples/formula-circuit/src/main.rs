mod camera;
mod handling;
mod track;
mod vehicle;

use bevy::{prelude::*, window::PresentMode};
use bevy_rapier3d::prelude::*;

const PHYSICS_HZ: f64 = 60.0;

fn main() {
    App::new()
        .insert_resource(ClearColor(Color::srgb(0.57, 0.71, 0.81)))
        .insert_resource(Time::<Fixed>::from_hz(PHYSICS_HZ))
        .insert_resource(TimestepMode::Fixed {
            dt: (1.0 / PHYSICS_HZ) as f32,
            substeps: 2,
        })
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Formula Circuit".into(),
                resolution: (1280, 800).into(),
                present_mode: PresentMode::AutoVsync,
                canvas: cfg!(target_arch = "wasm32").then(|| "#formula-canvas".into()),
                fit_canvas_to_parent: cfg!(target_arch = "wasm32"),
                prevent_default_event_handling: cfg!(target_arch = "wasm32"),
                ..default()
            }),
            ..default()
        }))
        .add_plugins((
            RapierPhysicsPlugin::<NoUserData>::default().in_fixed_schedule(),
            RapierDebugRenderPlugin::default().disabled(),
            track::CircuitPlugin,
            vehicle::VehiclePlugin,
            camera::ChaseCameraPlugin,
        ))
        .add_systems(Update, toggle_physics_debug)
        .run();
}

fn toggle_physics_debug(keys: Res<ButtonInput<KeyCode>>, mut debug: ResMut<DebugRenderContext>) {
    if keys.just_pressed(KeyCode::F3) {
        debug.enabled = !debug.enabled;
    }
}

use crate::{track::GRID_POSITION, vehicle::PlayerCar};
use bevy::{core_pipeline::tonemapping::Tonemapping, prelude::*, transform::TransformSystems};
use bevy_rapier3d::prelude::Velocity;

const OFFSET: Vec3 = Vec3::new(0.0, 4.8, 9.5);
const LOOK_AHEAD: Vec3 = Vec3::new(0.0, 0.75, -5.0);

#[derive(Component)]
struct ChaseCamera;

#[derive(Component)]
struct SpeedReadout;

pub struct ChaseCameraPlugin;

impl Plugin for ChaseCameraPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Startup, spawn_camera_and_hud)
            .add_systems(Update, show_speed)
            .add_systems(
                PostUpdate,
                follow_vehicle.before(TransformSystems::Propagate),
            );
    }
}

fn spawn_camera_and_hud(mut commands: Commands) {
    commands.spawn((
        ChaseCamera,
        Camera3d::default(),
        Tonemapping::Reinhard,
        Transform::from_translation(GRID_POSITION + OFFSET)
            .looking_at(GRID_POSITION + LOOK_AHEAD, Vec3::Y),
    ));
    commands
        .spawn((
            Node {
                position_type: PositionType::Absolute,
                left: Val::Px(20.0),
                top: Val::Px(20.0),
                flex_direction: FlexDirection::Column,
                row_gap: Val::Px(6.0),
                padding: UiRect::all(Val::Px(14.0)),
                ..default()
            },
            BackgroundColor(Color::srgba(0.05, 0.08, 0.12, 0.9)),
        ))
        .with_children(|hud| {
            hud.spawn((
                SpeedReadout,
                Text::new("0 km/h"),
                TextFont {
                    font_size: 32.0,
                    ..default()
                },
                TextColor(Color::WHITE),
            ));
            hud.spawn((
                Text::new("WASD / arrows   ·   R reset   ·   F3 colliders"),
                TextFont {
                    font_size: 15.0,
                    ..default()
                },
                TextColor(Color::srgb(0.80, 0.88, 0.95)),
            ));
        });
}

fn follow_vehicle(
    time: Res<Time>,
    car: Single<&Transform, (With<PlayerCar>, Without<ChaseCamera>)>,
    mut camera: Single<&mut Transform, (With<ChaseCamera>, Without<PlayerCar>)>,
) {
    let goal = car.translation + car.rotation * OFFSET;
    let look_at = car.translation + car.rotation * LOOK_AHEAD;
    // Exponential smoothing keeps the camera response consistent across frame rates.
    let blend = if camera.translation.distance_squared(goal) > 30.0_f32.powi(2) {
        1.0
    } else {
        1.0 - (-7.5 * time.delta_secs()).exp()
    };
    camera.translation = camera.translation.lerp(goal, blend);
    let goal_rotation = Transform::from_translation(camera.translation)
        .looking_at(look_at, Vec3::Y)
        .rotation;
    camera.rotation = camera.rotation.slerp(goal_rotation, blend);
}

fn show_speed(
    velocity: Single<&Velocity, With<PlayerCar>>,
    mut text: Single<&mut Text, With<SpeedReadout>>,
    mut displayed: Local<Option<u16>>,
) {
    let speed = (Vec2::new(velocity.linvel.x, velocity.linvel.z).length() * 3.6).round() as u16;
    if *displayed != Some(speed) {
        **text = Text::new(format!("{speed} km/h"));
        *displayed = Some(speed);
    }
}

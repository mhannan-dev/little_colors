use crate::{
    handling::{DriverControls, desired_yaw_rate, lateral_accel, longitudinal_accel},
    track::GRID_POSITION,
};
use bevy::{input::InputSystems, prelude::*};
use bevy_rapier3d::prelude::*;
use std::f32::consts::FRAC_PI_2;

const MASS_KG: f32 = 740.0;

#[derive(Component)]
pub struct PlayerCar;

#[derive(Resource, Default)]
struct DriverInput {
    controls: DriverControls,
    reset: bool,
}

pub struct VehiclePlugin;

impl Plugin for VehiclePlugin {
    fn build(&self, app: &mut App) {
        app.init_resource::<DriverInput>()
            .add_systems(Startup, spawn_vehicle)
            .add_systems(PreUpdate, read_driver_input.after(InputSystems))
            .add_systems(FixedUpdate, drive_vehicle.before(PhysicsSet::SyncBackend));
    }
}

fn spawn_vehicle(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    let red = materials.add(Color::srgb(0.9, 0.12, 0.17));
    let graphite = materials.add(Color::srgb(0.08, 0.1, 0.14));
    let rubber = materials.add(Color::srgb(0.04, 0.05, 0.06));
    let unit_box = meshes.add(Cuboid::new(1.0, 1.0, 1.0));
    let wheel = meshes.add(Cylinder::new(0.33, 0.32));

    commands
        .spawn((
            Name::new("Player formula car"),
            PlayerCar,
            Transform::from_translation(GRID_POSITION),
            Visibility::default(),
            RigidBody::Dynamic,
            Collider::cuboid(1.1, 0.32, 2.2),
            ColliderMassProperties::Mass(MASS_KG),
            LockedAxes::ROTATION_LOCKED_X | LockedAxes::ROTATION_LOCKED_Z,
            Friction {
                coefficient: 0.08,
                combine_rule: CoefficientCombineRule::Min,
            },
            Restitution::new(0.04),
            Ccd::enabled(),
            Velocity::zero(),
            ExternalForce::default(),
            Sleeping::disabled(),
        ))
        .with_children(|car| {
            // Render the body and the wheels as children of the physics chassis.
            for (position, size, material) in [
                (
                    Vec3::new(0.0, 0.05, 0.28),
                    Vec3::new(1.24, 0.39, 2.25),
                    &red,
                ),
                (
                    Vec3::new(0.0, 0.02, -1.22),
                    Vec3::new(0.54, 0.27, 1.8),
                    &red,
                ),
                (
                    Vec3::new(0.0, 0.04, -1.93),
                    Vec3::new(2.04, 0.13, 0.44),
                    &graphite,
                ),
                (
                    Vec3::new(0.0, 0.52, 1.62),
                    Vec3::new(1.90, 0.13, 0.50),
                    &red,
                ),
                (
                    Vec3::new(0.0, 0.30, 1.62),
                    Vec3::new(0.20, 0.42, 0.22),
                    &graphite,
                ),
                (
                    Vec3::new(0.0, 0.26, -0.12),
                    Vec3::new(0.51, 0.20, 0.67),
                    &graphite,
                ),
            ] {
                car.spawn((
                    Mesh3d(unit_box.clone()),
                    MeshMaterial3d(material.clone()),
                    Transform::from_translation(position).with_scale(size),
                ));
            }
            for x in [-0.91, 0.91] {
                for z in [-1.39, 1.31] {
                    car.spawn((
                        Mesh3d(wheel.clone()),
                        MeshMaterial3d(rubber.clone()),
                        Transform::from_xyz(x, 0.01, z)
                            .with_rotation(Quat::from_rotation_z(FRAC_PI_2)),
                    ));
                }
            }
        });
}

fn read_driver_input(keys: Res<ButtonInput<KeyCode>>, mut input: ResMut<DriverInput>) {
    input.controls.throttle = keys.any_pressed([KeyCode::KeyW, KeyCode::ArrowUp]);
    input.controls.brake = keys.any_pressed([KeyCode::KeyS, KeyCode::ArrowDown]);
    let left = keys.any_pressed([KeyCode::KeyA, KeyCode::ArrowLeft]);
    let right = keys.any_pressed([KeyCode::KeyD, KeyCode::ArrowRight]);
    input.controls.steer = i32::from(right) as f32 - i32::from(left) as f32;
    // Keep the edge until a fixed tick consumes it.
    input.reset |= keys.just_pressed(KeyCode::KeyR);
}

fn drive_vehicle(
    time: Res<Time<Fixed>>,
    mut input: ResMut<DriverInput>,
    car: Single<(&mut Transform, &mut Velocity, &mut ExternalForce), With<PlayerCar>>,
) {
    let (mut transform, mut velocity, mut force) = car.into_inner();
    if std::mem::take(&mut input.reset) || transform.translation.y < -4.0 {
        *transform = Transform::from_translation(GRID_POSITION);
        *velocity = Velocity::zero();
        *force = ExternalForce::default();
        return;
    }

    let forward = *transform.forward();
    let right = *transform.right();
    let longitudinal = velocity.linvel.dot(forward);
    let lateral = velocity.linvel.dot(right);
    let acceleration = longitudinal_accel(&input.controls, longitudinal, time.delta_secs());
    let grip = lateral_accel(lateral);
    let yaw = desired_yaw_rate(input.controls.steer, longitudinal);

    // Rapier integrates these forces and resolves contacts. We never overwrite
    // linear velocity during normal driving, so barriers can stop the chassis.
    force.force = (forward * acceleration + right * grip) * MASS_KG;
    force.torque = Vec3::Y * (yaw - velocity.angvel.y) * 7_000.0;
}

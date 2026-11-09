use bevy::{
    asset::RenderAssetUsages,
    mesh::{Indices, PrimitiveTopology},
    prelude::*,
};
use bevy_rapier3d::prelude::*;
use std::f32::consts::TAU;

pub const GRID_POSITION: Vec3 = Vec3::new(52.0, 0.33, 1.5);
const INNER: Vec2 = Vec2::new(45.0, 24.0);
const OUTER: Vec2 = Vec2::new(59.0, 38.0);
const SEGMENTS: u32 = 64;

pub struct CircuitPlugin;

impl Plugin for CircuitPlugin {
    fn build(&self, app: &mut App) {
        app.insert_resource(GlobalAmbientLight {
            brightness: 350.0,
            ..default()
        })
        .add_systems(Startup, spawn_circuit);
    }
}

fn spawn_circuit(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    let grass = materials.add(Color::srgb(0.24, 0.42, 0.24));
    let asphalt = materials.add(Color::srgb(0.19, 0.23, 0.27));
    let white = materials.add(Color::srgb(0.94, 0.95, 0.88));
    let red = materials.add(Color::srgb(0.84, 0.11, 0.14));
    let black = materials.add(Color::srgb(0.07, 0.08, 0.10));

    // The visible road sits on top of a single, thick fixed ground collider.
    commands.spawn((
        Name::new("Circuit ground"),
        RigidBody::Fixed,
        Collider::cuboid(75.0, 0.5, 55.0),
        Friction::new(0.6),
        Mesh3d(meshes.add(Cuboid::new(150.0, 1.0, 110.0))),
        MeshMaterial3d(grass),
        Transform::from_xyz(0.0, -0.5, 0.0),
    ));
    commands.spawn((
        Name::new("Asphalt"),
        Mesh3d(meshes.add(ellipse_strip(INNER, OUTER, 0.01))),
        MeshMaterial3d(asphalt),
    ));

    for (inside, outside) in [
        (INNER + Vec2::splat(0.46), INNER + Vec2::splat(0.65)),
        (OUTER - Vec2::splat(0.65), OUTER - Vec2::splat(0.46)),
    ] {
        commands.spawn((
            Mesh3d(meshes.add(ellipse_strip(inside, outside, 0.018))),
            MeshMaterial3d(white.clone()),
        ));
    }

    let unit_box = meshes.add(Cuboid::new(1.0, 1.0, 1.0));
    for radius in [INNER, OUTER] {
        for segment in 0..SEGMENTS {
            let a = ellipse_point(radius, segment, 0.55);
            let b = ellipse_point(radius, segment + 1, 0.55);
            let chord = b - a;
            let length = chord.length() + 0.16;
            let yaw = chord.x.atan2(chord.z);
            let paint = if segment % 2 == 0 { &red } else { &white };

            // Scale the visual child only. Rapier receives the world-space half-extents.
            commands
                .spawn((
                    Name::new("Safety barrier"),
                    RigidBody::Fixed,
                    Collider::cuboid(0.28, 0.55, length * 0.5),
                    Restitution::new(0.05),
                    Transform::from_translation((a + b) * 0.5)
                        .with_rotation(Quat::from_rotation_y(yaw)),
                    Visibility::default(),
                ))
                .with_children(|barrier| {
                    barrier.spawn((
                        Mesh3d(unit_box.clone()),
                        MeshMaterial3d(paint.clone()),
                        Transform::from_scale(Vec3::new(0.56, 1.10, length)),
                    ));
                });
        }
    }

    let check = meshes.add(Cuboid::new(1.0, 0.014, 0.55));
    for x in 0..13 {
        for row in 0..2 {
            let paint = if (x + row) % 2 == 0 { &white } else { &black };
            commands.spawn((
                Mesh3d(check.clone()),
                MeshMaterial3d(paint.clone()),
                Transform::from_xyz(46.0 + x as f32, 0.026, -5.0 - row as f32 * 0.55),
            ));
        }
    }

    commands.spawn((
        DirectionalLight {
            illuminance: 14_000.0,
            shadows_enabled: true,
            ..default()
        },
        Transform::from_xyz(24.0, 42.0, 18.0).looking_at(Vec3::ZERO, Vec3::Y),
    ));
}

fn ellipse_point(radius: Vec2, segment: u32, height: f32) -> Vec3 {
    let (sin, cos) = (TAU * segment as f32 / SEGMENTS as f32).sin_cos();
    Vec3::new(radius.x * cos, height, -radius.y * sin)
}

fn ellipse_strip(inner: Vec2, outer: Vec2, height: f32) -> Mesh {
    let mut positions = Vec::with_capacity((SEGMENTS as usize + 1) * 2);
    let mut indices = Vec::with_capacity(SEGMENTS as usize * 6);
    for segment in 0..=SEGMENTS {
        positions.push(ellipse_point(inner, segment, height).to_array());
        positions.push(ellipse_point(outer, segment, height).to_array());
        if segment < SEGMENTS {
            let a = segment * 2;
            indices.extend([a, a + 1, a + 2, a + 1, a + 3, a + 2]);
        }
    }
    let normals = vec![Vec3::Y.to_array(); positions.len()];
    Mesh::new(
        PrimitiveTopology::TriangleList,
        RenderAssetUsages::default(),
    )
    .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, positions)
    .with_inserted_attribute(Mesh::ATTRIBUTE_NORMAL, normals)
    .with_inserted_indices(Indices::U32(indices))
}

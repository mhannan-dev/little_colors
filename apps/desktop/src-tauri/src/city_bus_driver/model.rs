use serde::{Deserialize, Serialize};

pub const LEVEL_COUNT: u32 = 60;

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Point {
    pub(super) x: f32,
    pub(super) z: f32,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum Indicator {
    #[default]
    Off,
    Left,
    Right,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bus {
    pub(super) position: Point,
    pub(super) heading: f32,
    pub(super) speed_mps: f32,
    pub(super) doors_open: bool,
    pub(super) indicator: Indicator,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Passenger {
    pub(super) id: u32,
    pub(super) boarded_at_stop: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum NodeKind {
    Waypoint,
    Stop,
    Terminal,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteNode {
    pub(super) position: Point,
    pub(super) name: String,
    pub(super) kind: NodeKind,
    pub(super) waiting: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelConfig {
    pub(super) id: u32,
    pub(super) depot: Point,
    pub(super) heading: f32,
    pub(super) time_limit_ms: u32,
    pub(super) road_spacing: f32,
    pub(super) road_half_width: f32,
    pub(super) grid_radius: i32,
    pub(super) nodes: Vec<RouteNode>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RunPhase {
    Driving,
    Paused,
    Completed,
    TimedOut,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrafficVehicle {
    pub(super) position: Point,
    pub(super) heading: f32,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Score {
    pub(super) punctuality: u32,
    pub(super) safety: u32,
    pub(super) comfort: u32,
    pub(super) total: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VehicleState {
    pub(super) run_id: u32,
    pub(super) bus: Bus,
    pub(super) phase: RunPhase,
    pub(super) remaining_ms: u32,
    pub(super) node_index: usize,
    pub(super) passengers: Vec<Passenger>,
    pub(super) delivered: u32,
    pub(super) collisions: u32,
    pub(super) harsh_brakes: u32,
    pub(super) door_progress: f32,
    pub(super) stop_serviced: bool,
    pub(super) traffic: Vec<TrafficVehicle>,
    pub(super) score: Option<Score>,
}

#[derive(Clone, Copy, Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PhysicsInput {
    pub(super) run_id: u32,
    pub(super) throttle: bool,
    pub(super) brake: bool,
    pub(super) steering: f32,
    pub(super) toggle_doors: bool,
    pub(super) indicator: Indicator,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreSubmission {
    pub(super) run_id: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveState {
    pub(super) unlocked_level: u32,
    pub(super) best_scores: Vec<Option<u32>>,
}

pub type PlayerProgress = SaveState;

impl Default for SaveState {
    fn default() -> Self {
        Self {
            unlocked_level: 1,
            best_scores: vec![None; LEVEL_COUNT as usize],
        }
    }
}

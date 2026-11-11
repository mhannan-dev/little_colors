use super::{
    Bus, Indicator, LEVEL_COUNT, LevelConfig, NodeKind, Passenger, PhysicsInput, Point, RouteNode,
    RunPhase, Score, TrafficVehicle, VehicleState,
};
use std::time::{Duration, Instant};

const SPACING: f32 = 32.0;
const ROAD_HALF: f32 = 7.0;
const GRID: i32 = 2;
const STOP_RADIUS: f32 = 5.5;
const DOOR_SECONDS: f32 = 1.35;
const MAX_SPEED: f32 = 15.0;
const CITY_END: f32 = SPACING * GRID as f32 + ROAD_HALF;
const GRID_WIDTH: i32 = GRID * 2 + 1;

pub(super) struct ActiveRun {
    pub config: LevelConfig,
    pub state: VehicleState,
    last_tick: Instant,
    elapsed: Duration,
    simulated: f32,
    previous_input: PhysicsInput,
    door_seconds: f32,
    reverse_hold: f32,
    last_collision: f32,
}

impl ActiveRun {
    pub(super) fn new(config: LevelConfig, run_id: u32) -> Self {
        let state = VehicleState {
            run_id,
            bus: Bus {
                position: config.depot,
                heading: config.heading,
                speed_mps: 0.0,
                doors_open: false,
                indicator: Indicator::Off,
            },
            phase: RunPhase::Driving,
            remaining_ms: config.time_limit_ms,
            node_index: 0,
            passengers: Vec::new(),
            delivered: 0,
            collisions: 0,
            harsh_brakes: 0,
            door_progress: 0.0,
            stop_serviced: false,
            traffic: (0..2 + (config.id - 1) / 10)
                .map(|i| traffic_at(i, config.id, 0.0))
                .collect(),
            score: None,
        };
        Self {
            config,
            state,
            last_tick: Instant::now(),
            elapsed: Duration::ZERO,
            simulated: 0.0,
            previous_input: PhysicsInput::default(),
            door_seconds: 0.0,
            reverse_hold: 0.0,
            last_collision: -1.0,
        }
    }

    pub(super) fn update(&mut self, mut input: PhysicsInput, now: Instant) {
        self.advance_to(now);
        if self.state.phase != RunPhase::Driving {
            return;
        }
        input.steering = if input.steering.is_finite() {
            input.steering.clamp(-1.0, 1.0)
        } else {
            0.0
        };
        if input.brake && !self.previous_input.brake && self.state.bus.speed_mps > 8.5 {
            self.state.harsh_brakes += 1;
        }
        self.state.bus.indicator = input.indicator;
        if input.toggle_doors {
            self.toggle_doors();
        }
        self.previous_input = input;
    }

    pub(super) fn pause(&mut self, paused: bool, now: Instant) {
        self.advance_to(now);
        match (self.state.phase, paused) {
            (RunPhase::Driving, true) => self.state.phase = RunPhase::Paused,
            (RunPhase::Paused, false) => self.state.phase = RunPhase::Driving,
            _ => return,
        }
        self.previous_input = PhysicsInput::default();
        self.reverse_hold = 0.0;
    }

    fn advance_to(&mut self, now: Instant) {
        let elapsed = now.saturating_duration_since(self.last_tick);
        self.last_tick = now;
        if self.state.phase != RunPhase::Driving {
            return;
        }

        self.elapsed += elapsed;
        self.state.remaining_ms = self
            .config
            .time_limit_ms
            .saturating_sub(self.elapsed.as_millis().min(u32::MAX as u128) as u32);
        if self.state.remaining_ms == 0 {
            self.state.phase = RunPhase::TimedOut;
            self.state.bus.speed_mps = 0.0;
            return;
        }

        // Limit catch-up movement after IPC stalls, while the mission clock stays authoritative.
        let mut physics = elapsed.as_secs_f32().min(0.15);
        while physics > 0.0 {
            let step = physics.min(1.0 / 60.0);
            self.step(step);
            physics -= step;
        }
    }

    fn step(&mut self, dt: f32) {
        self.simulated += dt;
        for (i, car) in self.state.traffic.iter_mut().enumerate() {
            *car = traffic_at(i as u32, self.config.id, self.simulated);
        }
        if self.state.bus.doors_open {
            self.board_passengers(dt);
            return;
        }

        let bus = &mut self.state.bus;
        if self.previous_input.brake {
            if bus.speed_mps > 0.0 {
                bus.speed_mps = (bus.speed_mps - 6.0 * dt).max(0.0);
            } else {
                self.reverse_hold += dt;
                if self.reverse_hold > 0.35 {
                    bus.speed_mps = (bus.speed_mps - 2.5 * dt).max(-4.0);
                }
            }
        } else {
            self.reverse_hold = 0.0;
            if self.previous_input.throttle {
                bus.speed_mps = (bus.speed_mps + 3.7 * dt).min(MAX_SPEED);
            } else {
                let drag = (bus.speed_mps.abs() - 1.7 * dt).max(0.0);
                bus.speed_mps = drag * bus.speed_mps.signum();
            }
        }

        let turn = self.previous_input.steering * (bus.speed_mps / 4.0).clamp(-1.0, 1.0) * 1.38
            / (1.0 + bus.speed_mps.abs() * 0.035);
        bus.heading = (bus.heading + turn * dt).rem_euclid(std::f32::consts::TAU);
        let next = offset(bus.position, bus.heading, bus.speed_mps * dt);
        let hit_traffic = self.state.traffic.iter().any(|car| {
            let before = traffic_clearance(bus.position, bus.heading, *car);
            let after = traffic_clearance(next, bus.heading, *car);
            after < 2.35 && after < before
        });
        let on_road = [
            next,
            offset(next, bus.heading, -2.2),
            offset(next, bus.heading, 2.2),
        ]
        .into_iter()
        .all(is_road);
        if !on_road || hit_traffic {
            if bus.speed_mps.abs() > 0.9 && self.simulated - self.last_collision >= 0.9 {
                self.state.collisions += 1;
                self.last_collision = self.simulated;
            }
            bus.speed_mps *= 0.2;
        } else {
            bus.position = next;
        }

        let node = &self.config.nodes[self.state.node_index];
        if node.kind == NodeKind::Waypoint && distance(bus.position, node.position) <= 7.2 {
            self.state.node_index += 1;
        }
    }

    fn toggle_doors(&mut self) {
        if self.state.bus.doors_open {
            self.state.bus.doors_open = false;
            self.state.door_progress = 0.0;
            self.door_seconds = 0.0;
            if !self.state.stop_serviced {
                return;
            }
            if self.config.nodes[self.state.node_index].kind == NodeKind::Terminal {
                self.state.phase = RunPhase::Completed;
                self.state.score = Some(self.score());
            } else {
                self.state.node_index += 1;
                self.state.stop_serviced = false;
            }
            return;
        }
        let node = &self.config.nodes[self.state.node_index];
        if node.kind != NodeKind::Waypoint
            && distance(self.state.bus.position, node.position) <= STOP_RADIUS
            && self.state.bus.speed_mps.abs() < 0.8
        {
            self.state.bus.doors_open = true;
            self.state.bus.speed_mps = 0.0;
        }
    }

    fn board_passengers(&mut self, dt: f32) {
        if self.state.stop_serviced {
            return;
        }
        self.door_seconds += dt;
        self.state.door_progress = (self.door_seconds / DOOR_SECONDS).min(1.0);
        if self.door_seconds < DOOR_SECONDS {
            return;
        }

        let node = &self.config.nodes[self.state.node_index];
        if node.kind == NodeKind::Terminal {
            self.state.delivered = self.state.passengers.len() as u32;
            self.state.passengers.clear();
        } else {
            let first = self.state.passengers.len() as u32 + 1;
            self.state
                .passengers
                .extend((0..node.waiting).map(|i| Passenger {
                    id: first + i,
                    boarded_at_stop: self.state.node_index as u32,
                }));
        }
        self.state.stop_serviced = true;
    }

    fn score(&self) -> Score {
        let punctuality = self.state.remaining_ms * 350 / self.config.time_limit_ms;
        let safety = 350_u32.saturating_sub(self.state.collisions.saturating_mul(45));
        let comfort = 300_u32.saturating_sub(self.state.harsh_brakes.saturating_mul(30));
        Score {
            punctuality,
            safety,
            comfort,
            total: punctuality + safety + comfort,
        }
    }
}

pub(super) fn build_level(id: u32) -> Option<LevelConfig> {
    if !(1..=LEVEL_COUNT).contains(&id) {
        return None;
    }
    let segments = 3 + ((id - 1) / 12) as usize;
    let mut rng = id.wrapping_mul(0x9e37_79b9);
    let path = (0..32)
        .find_map(|_| sample_path(&mut rng, segments))
        .unwrap_or_else(|| {
            (0..=segments as i32)
                .map(|i| {
                    let row = i / GRID_WIDTH;
                    let col = i % GRID_WIDTH;
                    (
                        if row % 2 == 0 { col - GRID } else { GRID - col },
                        row - GRID,
                    )
                })
                .collect()
        });
    let world = |(x, z): (i32, i32)| Point {
        x: x as f32 * SPACING,
        z: z as f32 * SPACING,
    };
    let depot = world(path[0]);
    let first = world(path[1]);
    let heading = heading_between(depot, first);
    let mut nodes = Vec::with_capacity(segments * 2);
    let mut stop_number = 0;
    for (i, edge) in path.windows(2).enumerate() {
        let from = world(edge[0]);
        let end = world(edge[1]);
        let terminal = i + 1 == segments;
        if terminal || i % 2 == 0 {
            stop_number += 1;
            nodes.push(RouteNode {
                position: offset(end, heading_between(from, end), -9.0),
                name: if terminal {
                    "Central Terminal".into()
                } else {
                    format!("Stop {stop_number}")
                },
                kind: if terminal {
                    NodeKind::Terminal
                } else {
                    NodeKind::Stop
                },
                waiting: if terminal { 0 } else { 2 + (id + i as u32) % 4 },
            });
        }
        if !terminal {
            nodes.push(RouteNode {
                position: end,
                name: format!("Junction {}", i + 1),
                kind: NodeKind::Waypoint,
                waiting: 0,
            });
        }
    }
    Some(LevelConfig {
        id,
        depot,
        heading,
        time_limit_ms: (40 + segments as u32 * 23 - (id - 1) / 4) * 1000,
        road_spacing: SPACING,
        road_half_width: ROAD_HALF,
        grid_radius: GRID,
        nodes,
    })
}

fn sample_path(rng: &mut u32, segments: usize) -> Option<Vec<(i32, i32)>> {
    let next = |rng: &mut u32, count: usize| {
        *rng = rng.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        (*rng >> 16) as usize % count
    };
    let mut path = vec![(
        next(rng, GRID_WIDTH as usize) as i32 - GRID,
        next(rng, GRID_WIDTH as usize) as i32 - GRID,
    )];
    for _ in 0..segments {
        let &(x, z) = path.last()?;
        let choices: Vec<_> = [(x - 1, z), (x + 1, z), (x, z - 1), (x, z + 1)]
            .into_iter()
            .filter(|p| p.0.abs() <= GRID && p.1.abs() <= GRID && !path.contains(p))
            .collect();
        if choices.is_empty() {
            return None;
        }
        path.push(choices[next(rng, choices.len())]);
    }
    Some(path)
}

fn is_road(point: Point) -> bool {
    let distance_to_line = |v: f32| (v - (v / SPACING).round() * SPACING).abs();
    point.x.abs() < CITY_END - 1.1
        && point.z.abs() < CITY_END - 1.1
        && distance_to_line(point.x).min(distance_to_line(point.z)) <= ROAD_HALF - 1.2
}

fn offset(point: Point, heading: f32, distance: f32) -> Point {
    Point {
        x: point.x + heading.sin() * distance,
        z: point.z - heading.cos() * distance,
    }
}

fn heading_between(from: Point, to: Point) -> f32 {
    (to.x - from.x).atan2(from.z - to.z)
}

fn distance(a: Point, b: Point) -> f32 {
    (a.x - b.x).hypot(a.z - b.z)
}

fn traffic_clearance(point: Point, heading: f32, car: TrafficVehicle) -> f32 {
    // A few samples along the bus axis approximate the long body for this arcade simulation.
    [-2.0, 0.0, 2.0]
        .into_iter()
        .map(|d| distance(offset(point, heading, d), car.position))
        .fold(f32::INFINITY, f32::min)
}

fn traffic_at(index: u32, level: u32, time: f32) -> TrafficVehicle {
    let line = ((index / 2 + level) % GRID_WIDTH as u32) as f32 * SPACING - GRID as f32 * SPACING;
    let reverse = index % 4 >= 2;
    let direction = if reverse { -1.0 } else { 1.0 };
    let along = ((index * 19 + level * 7) as f32 + time * (4.1 + level as f32 * 0.035))
        .rem_euclid(CITY_END * 2.0)
        - CITY_END;
    let (position, heading) = if index % 2 == 0 {
        (
            Point {
                x: along * direction,
                z: line + 3.75 * direction,
            },
            direction * std::f32::consts::FRAC_PI_2,
        )
    } else {
        (
            Point {
                x: line - 3.75 * direction,
                z: along * direction,
            },
            if reverse { 0.0 } else { std::f32::consts::PI },
        )
    };
    TrafficVehicle { position, heading }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_sixty_levels_have_distinct_routes_with_valid_stops() {
        let mut routes = std::collections::HashSet::new();
        for id in 1..=LEVEL_COUNT {
            let config = build_level(id).unwrap();
            assert!(is_road(config.depot));
            assert_eq!(config.nodes.last().unwrap().kind, NodeKind::Terminal);
            assert!(config.nodes.iter().all(|node| is_road(node.position)));
            let key: Vec<_> = config
                .nodes
                .iter()
                .map(|node| {
                    (
                        node.position.x.round() as i32,
                        node.position.z.round() as i32,
                    )
                })
                .collect();
            assert!(routes.insert(key));
        }
        assert!(build_level(0).is_none());
        assert!(build_level(61).is_none());
    }

    #[test]
    fn boarding_requires_a_stop_and_dwell_then_closing_completes_the_terminal() {
        let mut run = ActiveRun::new(build_level(1).unwrap(), 1);
        run.toggle_doors();
        assert!(!run.state.bus.doors_open);
        run.state.bus.position = run.config.nodes[0].position;
        run.state.bus.speed_mps = 2.0;
        run.toggle_doors();
        assert!(!run.state.bus.doors_open);
        run.state.bus.speed_mps = 0.0;
        run.toggle_doors();
        run.board_passengers(DOOR_SECONDS * 0.5);
        assert!(run.state.passengers.is_empty());
        run.board_passengers(DOOR_SECONDS);
        assert_eq!(
            run.state.passengers.len(),
            run.config.nodes[0].waiting as usize
        );
        run.toggle_doors();
        assert_eq!(run.state.node_index, 1);

        run.state.node_index = run.config.nodes.len() - 1;
        run.state.bus.position = run.config.nodes.last().unwrap().position;
        run.toggle_doors();
        run.board_passengers(DOOR_SECONDS);
        assert!(run.state.delivered > 0);
        assert!(run.state.passengers.is_empty());
        run.toggle_doors();
        assert_eq!(run.state.phase, RunPhase::Completed);
        assert!(run.state.score.is_some());
    }

    #[test]
    fn pause_excludes_wall_time_and_timeout_ends_the_run() {
        let mut run = ActiveRun::new(build_level(1).unwrap(), 1);
        let start = run.last_tick;
        run.pause(true, start + Duration::from_secs(1));
        let remaining = run.state.remaining_ms;
        run.pause(false, start + Duration::from_secs(300));
        assert_eq!(run.state.remaining_ms, remaining);
        run.advance_to(start + Duration::from_secs(301) + Duration::from_millis(remaining.into()));
        assert_eq!(run.state.phase, RunPhase::TimedOut);
        assert!(run.state.score.is_none());
    }

    #[test]
    fn steering_acceleration_braking_and_curbs_affect_the_authoritative_run() {
        let mut run = ActiveRun::new(build_level(1).unwrap(), 1);
        run.state.traffic.clear();
        let mut now = run.last_tick;
        let input = PhysicsInput {
            run_id: 1,
            throttle: true,
            ..Default::default()
        };
        run.update(input, now);
        for _ in 0..10 {
            now += Duration::from_millis(50);
            run.update(input, now);
        }
        assert!(run.state.bus.speed_mps > 1.0);
        assert!(distance(run.config.depot, run.state.bus.position) > 0.1);

        run.state.bus.speed_mps = 10.0;
        run.update(
            PhysicsInput {
                brake: true,
                ..input
            },
            now,
        );
        assert_eq!(run.state.harsh_brakes, 1);
        run.update(
            PhysicsInput {
                brake: true,
                ..input
            },
            now,
        );
        assert_eq!(run.state.harsh_brakes, 1);

        run.state.bus.position = Point { x: 3.3, z: 16.0 };
        run.state.bus.heading = std::f32::consts::FRAC_PI_2;
        run.state.bus.speed_mps = 12.0;
        let mut turn = input;
        turn.steering = 1.0;
        run.update(turn, now);
        run.update(turn, now + Duration::from_millis(50));
        assert!(run.state.bus.heading > std::f32::consts::FRAC_PI_2);
        assert!(run.state.bus.speed_mps < 12.0);
        assert_eq!(run.state.collisions, 1);
    }
}

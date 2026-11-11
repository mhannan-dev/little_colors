mod model;
mod save;
mod simulation;

use std::{
    path::PathBuf,
    sync::{Mutex, MutexGuard},
    time::Instant,
};
use tauri::{AppHandle, Manager, State};

pub use model::*;
use save::{read_save, write_save};
use simulation::{ActiveRun, build_level};

#[derive(Default)]
pub struct GameState {
    active: Option<ActiveRun>,
    last_run_id: u32,
}

impl GameState {
    fn run(&mut self, run_id: u32) -> Result<&mut ActiveRun, String> {
        self.active
            .as_mut()
            .filter(|run| run.state.run_id == run_id)
            .ok_or_else(|| "Start a new City Bus Driver mission.".into())
    }
}

#[tauri::command]
pub fn get_level_config(level_id: u32) -> Result<LevelConfig, String> {
    build_level(level_id).ok_or_else(|| format!("Choose a level from 1 to {LEVEL_COUNT}."))
}

#[tauri::command]
pub fn get_player_progress(
    app: AppHandle,
    game: State<'_, Mutex<GameState>>,
) -> Result<PlayerProgress, String> {
    let _guard = lock(&game)?;
    read_save(&save_path(&app)?)
}

#[tauri::command]
pub fn start_city_bus_level(
    app: AppHandle,
    game: State<'_, Mutex<GameState>>,
    level_id: u32,
) -> Result<VehicleState, String> {
    let config = get_level_config(level_id)?;
    let mut game = lock(&game)?;
    if level_id > read_save(&save_path(&app)?)?.unlocked_level {
        return Err("Complete the previous mission to unlock this route.".into());
    }
    game.last_run_id = game.last_run_id.wrapping_add(1);
    let run = ActiveRun::new(config, game.last_run_id);
    let state = run.state.clone();
    game.active = Some(run);
    Ok(state)
}

#[tauri::command]
pub fn update_vehicle_physics(
    game: State<'_, Mutex<GameState>>,
    input: PhysicsInput,
) -> Result<VehicleState, String> {
    let mut game = lock(&game)?;
    let run = game.run(input.run_id)?;
    run.update(input, Instant::now());
    Ok(run.state.clone())
}

#[tauri::command]
pub fn set_city_bus_paused(
    game: State<'_, Mutex<GameState>>,
    run_id: u32,
    paused: bool,
) -> Result<VehicleState, String> {
    let mut game = lock(&game)?;
    let run = game.run(run_id)?;
    run.pause(paused, Instant::now());
    Ok(run.state.clone())
}

#[tauri::command]
pub fn submit_level_score(
    app: AppHandle,
    game: State<'_, Mutex<GameState>>,
    score_data: ScoreSubmission,
) -> Result<SaveState, String> {
    let mut game = lock(&game)?;
    let run = game.run(score_data.run_id)?;
    let score = run
        .state
        .score
        .ok_or("Complete the route before saving a score.")?;
    let path = save_path(&app)?;
    let mut save = read_save(&path)?;
    let best = &mut save.best_scores[(run.config.id - 1) as usize];
    *best = Some(best.unwrap_or(0).max(score.total));
    save.unlocked_level = save
        .unlocked_level
        .max((run.config.id + 1).min(LEVEL_COUNT));
    write_save(&path, &save)?;
    Ok(save)
}

fn lock(game: &Mutex<GameState>) -> Result<MutexGuard<'_, GameState>, String> {
    game.lock()
        .map_err(|_| "The bus simulation could not resume.".into())
}

fn save_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|directory| directory.join("city-bus-driver.json"))
        .map_err(|error| error.to_string())
}

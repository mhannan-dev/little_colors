#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine;
mod game;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(engine::Engine::launch(app.handle().clone(), true));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            engine::get_game_state,
            engine::set_counter_rush_visible,
            engine::start_shift,
            engine::start_cooking,
            engine::serve_order,
            engine::discard_item
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Counter Rush");
}

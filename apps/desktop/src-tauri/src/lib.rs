mod city_bus_driver;

use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut context = tauri::generate_context!();
  if cfg!(all(target_os = "windows", debug_assertions)) {
    // A development window uses its own WebView2 profile so it can run beside
    // the installed app, which uses a different WebView2 configuration.
    for window in &mut context.config_mut().app.windows {
      if window.data_directory.is_none() {
        window.data_directory = Some("com.littlecolors.app.dev".into());
      }
    }
  }

  tauri::Builder::default()
    .manage(Mutex::new(city_bus_driver::GameState::default()))
    .invoke_handler(tauri::generate_handler![
      city_bus_driver::get_level_config,
      city_bus_driver::get_player_progress,
      city_bus_driver::start_city_bus_level,
      city_bus_driver::update_vehicle_physics,
      city_bus_driver::set_city_bus_paused,
      city_bus_driver::submit_level_score,
    ])
    // In-app updates (docs/decisions/0001-in-app-updates.md): the only network use. The UI checks
    // quietly, a parent confirms, and with no internet nothing happens and nothing is shown.
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(context)
    .expect("error while building tauri application");
}

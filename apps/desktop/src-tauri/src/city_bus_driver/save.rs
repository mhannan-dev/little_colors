use super::{LEVEL_COUNT, SaveState};
use std::{
    fs::{self, File},
    io::Write,
    path::Path,
};

pub(super) fn read_save(path: &Path) -> Result<SaveState, String> {
    let data = match fs::read(path) {
        Ok(data) => data,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(SaveState::default());
        }
        Err(error) => return Err(format!("Could not read bus progress: {error}")),
    };
    let save: SaveState = serde_json::from_slice(&data)
        .map_err(|error| format!("Could not read bus progress: {error}"))?;
    if !(1..=LEVEL_COUNT).contains(&save.unlocked_level)
        || save.best_scores.len() != LEVEL_COUNT as usize
    {
        return Err("The bus progress file has an invalid level list.".into());
    }
    Ok(save)
}

pub(super) fn write_save(path: &Path, save: &SaveState) -> Result<(), String> {
    let result = (|| -> std::io::Result<()> {
        if let Some(directory) = path.parent() {
            fs::create_dir_all(directory)?;
        }
        let temporary = path.with_extension("tmp");
        let mut file = File::create(&temporary)?;
        serde_json::to_writer(&mut file, save)?;
        file.flush()?;
        file.sync_all()?;
        drop(file);
        fs::rename(temporary, path)
    })();
    result.map_err(|error| format!("Could not save bus progress: {error}"))
}

#[cfg(test)]
mod persistence_tests {
    use super::*;

    #[test]
    fn progress_can_be_written_and_replaced() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "rumi-city-bus-{}-{unique}.json",
            std::process::id()
        ));
        let mut save = read_save(&path).unwrap();
        assert_eq!(save.unlocked_level, 1);
        write_save(&path, &save).unwrap();
        save.unlocked_level = 2;
        save.best_scores[0] = Some(840);
        write_save(&path, &save).unwrap();
        let restored = read_save(&path).unwrap();
        fs::remove_file(path).unwrap();
        assert_eq!(restored.unlocked_level, 2);
        assert_eq!(restored.best_scores[0], Some(840));
    }
}

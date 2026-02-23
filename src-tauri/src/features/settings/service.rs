use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SettingsStore {
    pub settings: HashMap<String, Value>,
}

pub fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let dir = dir.join("otterly");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

pub fn load_settings(app: &AppHandle) -> Result<SettingsStore, String> {
    let path = settings_path(app)?;
    let bytes = match std::fs::read(&path) {
        Ok(b) => b,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(SettingsStore::default()),
        Err(e) => return Err(e.to_string()),
    };
    serde_json::from_slice(&bytes).map_err(|e| e.to_string())
}

pub fn save_settings(app: &AppHandle, store: &SettingsStore) -> Result<(), String> {
    let path = settings_path(app)?;
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(store).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_setting(key: String, app: AppHandle) -> Result<Option<Value>, String> {
    log::debug!("Getting setting key={}", key);
    let store = load_settings(&app)?;
    Ok(store.settings.get(&key).cloned())
}

#[tauri::command]
pub async fn set_setting(key: String, value: Value, app: AppHandle) -> Result<(), String> {
    log::debug!("Setting key={}", key);
    let mut store = load_settings(&app)?;
    store.settings.insert(key, value);
    save_settings(&app, &store)?;
    Ok(())
}

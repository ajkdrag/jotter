use crate::constants;
use crate::storage::{load_store, vault_path_by_id};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::AppHandle;

const SETTINGS_FILE: &str = "settings.json";

fn vault_settings_path(app: &AppHandle, vault_id: &str) -> Result<PathBuf, String> {
    let store = load_store(app)?;
    let vault_path = vault_path_by_id(&store, vault_id).ok_or("Vault not found")?;
    let settings_dir = PathBuf::from(&vault_path).join(constants::APP_DIR);
    std::fs::create_dir_all(&settings_dir).map_err(|e| e.to_string())?;
    Ok(settings_dir.join(SETTINGS_FILE))
}

fn load_vault_settings(app: &AppHandle, vault_id: &str) -> Result<HashMap<String, Value>, String> {
    let path = vault_settings_path(app, vault_id)?;
    let bytes = match std::fs::read(&path) {
        Ok(b) => b,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(HashMap::new()),
        Err(e) => return Err(e.to_string()),
    };
    serde_json::from_slice(&bytes).map_err(|e| e.to_string())
}

fn save_vault_settings(
    app: &AppHandle,
    vault_id: &str,
    settings: &HashMap<String, Value>,
) -> Result<(), String> {
    let path = vault_settings_path(app, vault_id)?;
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_vault_setting(
    vault_id: String,
    key: String,
    app: AppHandle,
) -> Result<Option<Value>, String> {
    log::debug!("Getting vault setting vault_id={} key={}", vault_id, key);
    let settings = load_vault_settings(&app, &vault_id)?;
    Ok(settings.get(&key).cloned())
}

#[tauri::command]
pub async fn set_vault_setting(
    vault_id: String,
    key: String,
    value: Value,
    app: AppHandle,
) -> Result<(), String> {
    log::debug!("Setting vault setting vault_id={} key={}", vault_id, key);
    let mut settings = load_vault_settings(&app, &vault_id)?;
    settings.insert(key, value);
    save_vault_settings(&app, &vault_id, &settings)?;
    Ok(())
}

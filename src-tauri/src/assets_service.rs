use crate::storage;
use serde::Deserialize;
use std::path::{Component, PathBuf};
use tauri::AppHandle;

#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AssetSource {
    Path { path: String },
    Bytes { bytes: Vec<u8>, file_name: String },
}

#[derive(Debug, Deserialize)]
pub struct ImportAssetArgs {
    pub vault_id: String,
    pub target_path: String,
    pub source: AssetSource,
}

fn vault_path(app: &AppHandle, vault_id: &str) -> Result<PathBuf, String> {
    let store = storage::load_store(app)?;
    let vault_path = storage::vault_path_by_id(&store, vault_id).ok_or("vault not found")?;
    Ok(PathBuf::from(vault_path))
}

fn validate_target_rel_path(rel: &PathBuf) -> Result<(), String> {
    if rel.is_absolute() {
        return Err("target_path must be relative".to_string());
    }
    if rel.components().any(|c| {
        matches!(
            c,
            Component::ParentDir | Component::CurDir | Component::Prefix(_) | Component::RootDir
        )
    }) {
        return Err("target_path contains invalid segments".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn import_asset(app: AppHandle, args: ImportAssetArgs) -> Result<String, String> {
    let vault_root = vault_path(&app, &args.vault_id)?;
    let rel = PathBuf::from(&args.target_path);
    validate_target_rel_path(&rel)?;

    let abs = vault_root.join(&rel);
    let base = vault_root.canonicalize().map_err(|e| e.to_string())?;
    let abs_parent = abs.parent().ok_or("invalid target path")?;
    std::fs::create_dir_all(abs_parent).map_err(|e| e.to_string())?;
    let abs = abs.canonicalize().unwrap_or(abs);
    if !abs.starts_with(&base) {
        return Err("target_path escapes vault".to_string());
    }

    let bytes = match args.source {
        AssetSource::Path { path } => {
            let p = PathBuf::from(path);
            std::fs::read(&p).map_err(|e| e.to_string())?
        }
        AssetSource::Bytes { bytes, .. } => bytes,
    };
    std::fs::write(&abs, bytes).map_err(|e| e.to_string())?;
    Ok(storage::normalize_relative_path(&rel))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_target_rel_path_rejects_traversal() {
        assert!(validate_target_rel_path(&PathBuf::from("../x.png")).is_err());
        assert!(validate_target_rel_path(&PathBuf::from("a/../x.png")).is_err());
        assert!(validate_target_rel_path(&PathBuf::from("/abs/x.png")).is_err());
        assert!(validate_target_rel_path(&PathBuf::from(".assets/x.png")).is_ok());
        assert!(validate_target_rel_path(&PathBuf::from("assets/x.png")).is_ok());
    }
}

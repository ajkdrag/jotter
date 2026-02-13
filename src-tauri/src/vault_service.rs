use crate::storage;
use crate::storage::{Vault, VaultEntry, VaultStore};
use serde::Deserialize;
use std::path::PathBuf;
use tauri::AppHandle;

fn canonicalize_path(path: &str) -> Result<String, String> {
    let p = PathBuf::from(path);
    let p = p.canonicalize().map_err(|e| e.to_string())?;
    Ok(p.to_string_lossy().to_string())
}

fn vault_name(path: &str) -> String {
    PathBuf::from(path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string()
}

fn is_vault_path_available(path: &str) -> bool {
    std::fs::metadata(path)
        .map(|metadata| metadata.is_dir())
        .unwrap_or(false)
}

fn load_note_count(app: &AppHandle, vault_id: &str) -> Option<u64> {
    match crate::notes_service::list_notes(app.clone(), vault_id.to_string()) {
        Ok(notes) => Some(notes.len() as u64),
        Err(error) => {
            log::warn!(
                "Failed to load note count for vault {}: {}",
                vault_id,
                error
            );
            None
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct OpenVaultArgs {
    pub vault_path: String,
}

fn upsert_vault(store: &mut VaultStore, mut vault: Vault) {
    let now = storage::now_ms();
    store.last_vault_id = Some(vault.id.clone());
    vault.last_opened_at = Some(now);

    if let Some(existing) = store.vaults.iter_mut().find(|v| v.vault.id == vault.id) {
        if vault.note_count.is_none() {
            vault.note_count = existing.vault.note_count;
        }
        existing.vault = vault;
        existing.last_opened_at = now;
        return;
    }

    store.vaults.push(VaultEntry {
        vault,
        last_opened_at: now,
    });
}

#[tauri::command]
pub fn open_vault(app: AppHandle, args: OpenVaultArgs) -> Result<Vault, String> {
    let vault_path = canonicalize_path(&args.vault_path).map_err(|e| {
        log::error!(
            "Failed to canonicalize vault path {}: {}",
            args.vault_path,
            e
        );
        e
    })?;
    let meta = std::fs::metadata(&vault_path).map_err(|e| {
        log::error!("Failed to read metadata for vault {}: {}", vault_path, e);
        e.to_string()
    })?;
    if !meta.is_dir() {
        return Err("vault path is not a directory".to_string());
    }

    let mut store = storage::load_store(&app)?;
    let id = storage::vault_id_for_path(&vault_path);
    let existing = store.vaults.iter().find(|v| v.vault.id == id);
    let created_at = existing
        .map(|v| v.vault.created_at)
        .unwrap_or_else(storage::now_ms);
    let existing_note_count = existing.and_then(|v| v.vault.note_count);
    let note_count = load_note_count(&app, &id).or(existing_note_count);

    let vault = Vault {
        id: id.clone(),
        path: vault_path,
        name: vault_name(&args.vault_path),
        created_at,
        last_opened_at: Some(storage::now_ms()),
        note_count,
        is_available: true,
    };

    upsert_vault(&mut store, vault.clone());
    storage::save_store(&app, &store)?;
    Ok(vault)
}

#[tauri::command]
pub fn open_vault_by_id(app: AppHandle, vault_id: String) -> Result<Vault, String> {
    let mut store = storage::load_store(&app)?;
    let now = storage::now_ms();
    let note_count = load_note_count(&app, &vault_id);

    let entry = store
        .vaults
        .iter_mut()
        .find(|v| v.vault.id == vault_id)
        .ok_or_else(|| {
            log::error!("Vault not found: {}", vault_id);
            "vault not found".to_string()
        })?;

    entry.vault.is_available = is_vault_path_available(&entry.vault.path);
    if !entry.vault.is_available {
        let message = format!("vault unavailable at path: {}", entry.vault.path);
        log::warn!("Open vault by id skipped: {}", message);
        storage::save_store(&app, &store)?;
        return Err(message);
    }

    entry.last_opened_at = now;
    entry.vault.last_opened_at = Some(now);
    if note_count.is_some() {
        entry.vault.note_count = note_count;
    }
    let vault = entry.vault.clone();
    storage::save_store(&app, &store)?;
    Ok(vault)
}

#[tauri::command]
pub fn list_vaults(app: AppHandle) -> Result<Vec<Vault>, String> {
    let mut store = storage::load_store(&app)?;
    store
        .vaults
        .sort_by(|a, b| b.last_opened_at.cmp(&a.last_opened_at));
    let vaults = store
        .vaults
        .iter_mut()
        .map(|entry| {
            entry.vault.is_available = is_vault_path_available(&entry.vault.path);
            let mut vault = entry.vault.clone();
            if vault.last_opened_at.is_none() {
                vault.last_opened_at = Some(entry.last_opened_at);
            }
            vault
        })
        .collect();
    Ok(vaults)
}

#[derive(Debug, Deserialize)]
pub struct RememberLastArgs {
    pub vault_id: String,
}

#[tauri::command]
pub fn remember_last_vault(app: AppHandle, args: RememberLastArgs) -> Result<(), String> {
    let mut store = storage::load_store(&app)?;
    store.last_vault_id = Some(args.vault_id);
    storage::save_store(&app, &store)?;
    Ok(())
}

#[tauri::command]
pub fn get_last_vault_id(app: AppHandle) -> Result<Option<String>, String> {
    let store = storage::load_store(&app)?;
    Ok(store.last_vault_id)
}

use crate::storage;
use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::Path;
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
pub struct WatcherState {
    inner: Arc<Mutex<Option<WatcherRuntime>>>,
}

struct WatcherRuntime {
    stop_tx: mpsc::Sender<()>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
enum VaultFsEvent {
    NoteChangedExternally { vault_id: String, note_path: String },
    NoteAdded { vault_id: String, note_path: String },
    NoteRemoved { vault_id: String, note_path: String },
    AssetChanged { vault_id: String, asset_path: String },
}

fn rel_path(root: &Path, abs: &Path) -> Option<String> {
    let rel = abs.strip_prefix(root).ok()?;
    let rel = storage::normalize_relative_path(rel);
    if rel.starts_with(".jotter/") || rel == ".jotter" {
        return None;
    }
    if rel.starts_with(".git/") || rel == ".git" {
        return None;
    }
    Some(rel)
}

fn emit(app: &AppHandle, event: VaultFsEvent) {
    let _ = app.emit("vault_fs_event", event);
}

#[tauri::command]
pub fn watch_vault(app: AppHandle, state: State<WatcherState>, vault_id: String) -> Result<(), String> {
    {
        let mut guard = state.inner.lock().map_err(|_| "watcher lock poisoned")?;
        if let Some(rt) = guard.take() {
            let _ = rt.stop_tx.send(());
        }
    }

    let root = storage::vault_path(&app, &vault_id)?;
    let root_canon = root.canonicalize().map_err(|e| e.to_string())?;
    let (stop_tx, stop_rx) = mpsc::channel::<()>();

    let app_handle = app.clone();
    let vault_id_clone = vault_id.clone();

    std::thread::spawn(move || {
        let (tx, rx) = mpsc::channel::<Result<notify::Event, notify::Error>>();

        let mut watcher = match RecommendedWatcher::new(
            move |res| {
                let _ = tx.send(res);
            },
            Config::default(),
        ) {
            Ok(w) => w,
            Err(e) => {
                log::error!("Failed to create file watcher: {}", e);
                return;
            }
        };

        if let Err(e) = watcher.watch(&root_canon, RecursiveMode::Recursive) {
            log::error!("Failed to start watching {}: {}", root_canon.display(), e);
            return;
        }

        loop {
            if stop_rx.try_recv().is_ok() {
                break;
            }

            let res = match rx.recv_timeout(Duration::from_millis(200)) {
                Ok(r) => r,
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(_) => break,
            };

            let event = match res {
                Ok(e) => e,
                Err(_) => continue,
            };

            let kind = event.kind;
            for p in event.paths.iter() {
                let abs = match p.canonicalize() {
                    Ok(p) => p,
                    Err(_) => p.to_path_buf(),
                };

                if !abs.starts_with(&root_canon) {
                    continue;
                }

                let Some(rel) = rel_path(&root_canon, &abs) else {
                    continue;
                };

                let ext = abs.extension().and_then(|e| e.to_str()).unwrap_or_default();
                let is_md = ext == "md";

                match kind {
                    EventKind::Create(_) if is_md => emit(
                        &app_handle,
                        VaultFsEvent::NoteAdded {
                            vault_id: vault_id_clone.clone(),
                            note_path: rel,
                        },
                    ),
                    EventKind::Remove(_) if is_md => emit(
                        &app_handle,
                        VaultFsEvent::NoteRemoved {
                            vault_id: vault_id_clone.clone(),
                            note_path: rel,
                        },
                    ),
                    EventKind::Modify(_) if is_md => emit(
                        &app_handle,
                        VaultFsEvent::NoteChangedExternally {
                            vault_id: vault_id_clone.clone(),
                            note_path: rel,
                        },
                    ),
                    EventKind::Modify(_) => emit(
                        &app_handle,
                        VaultFsEvent::AssetChanged {
                            vault_id: vault_id_clone.clone(),
                            asset_path: rel,
                        },
                    ),
                    _ => {}
                }
            }
        }
    });

    *state.inner.lock().map_err(|_| "watcher lock poisoned")? = Some(WatcherRuntime { stop_tx });
    Ok(())
}

#[tauri::command]
pub fn unwatch_vault(state: State<WatcherState>) -> Result<(), String> {
    let mut guard = state.inner.lock().map_err(|_| "watcher lock poisoned")?;
    if let Some(rt) = guard.take() {
        let _ = rt.stop_tx.send(());
    }
    Ok(())
}

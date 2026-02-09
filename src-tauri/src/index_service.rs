use crate::notes_service;
use crate::search_db;
use crate::storage;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IndexNoteMeta {
    pub id: String,
    pub path: String,
    pub title: String,
    pub mtime_ms: i64,
    pub size_bytes: i64,
}

#[derive(Debug, Serialize)]
pub struct SearchHit {
    pub note: IndexNoteMeta,
    pub score: f32,
    pub snippet: Option<String>,
}

#[derive(Debug, Deserialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum SearchScope {
    All,
    Path,
    Title,
    Content,
}

#[derive(Debug, Deserialize)]
pub struct SearchQueryInput {
    #[allow(dead_code)]
    pub raw: String,
    pub text: String,
    pub scope: SearchScope,
}

#[derive(Default)]
pub struct SearchDbState {
    connections: Mutex<HashMap<String, Connection>>,
}

#[derive(Default)]
pub struct IndexingState {
    active: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum IndexProgressEvent {
    Started { vault_id: String, total: usize },
    Progress { vault_id: String, indexed: usize, total: usize },
    Completed { vault_id: String, indexed: usize, elapsed_ms: u64 },
    Failed { vault_id: String, error: String },
}

fn with_conn<F, T>(app: &AppHandle, vault_id: &str, f: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> Result<T, String>,
{
    let vault_root = storage::vault_path(app, vault_id)?;
    let state = app.state::<SearchDbState>();
    let mut map = state.connections.lock().map_err(|e| e.to_string())?;
    if !map.contains_key(vault_id) {
        let conn = search_db::open_search_db(&vault_root)?;
        map.insert(vault_id.to_string(), conn);
    }
    let conn = map.get(vault_id).unwrap();
    f(conn)
}

#[tauri::command]
pub fn index_build(
    app: AppHandle,
    vault_id: String,
    indexing_state: tauri::State<'_, IndexingState>,
) -> Result<(), String> {
    let vault_root = storage::vault_path(&app, &vault_id)?;

    {
        let map = indexing_state.active.lock().map_err(|e| e.to_string())?;
        if let Some(flag) = map.get(&vault_id) {
            flag.store(true, Ordering::Relaxed);
        }
    }

    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut map = indexing_state.active.lock().map_err(|e| e.to_string())?;
        map.insert(vault_id.clone(), Arc::clone(&cancel));
    }

    let app_handle = app.clone();
    let vid = vault_id.clone();

    std::thread::spawn(move || {
        let conn = match search_db::open_search_db(&vault_root) {
            Ok(c) => c,
            Err(e) => {
                log::error!("index_build: open db failed: {}", e);
                let _ = app_handle.emit(
                    "index_progress",
                    IndexProgressEvent::Failed { vault_id: vid.clone(), error: e },
                );
                return;
            }
        };

        let start = Instant::now();
        let vid2 = vid.clone();
        let app2 = app_handle.clone();

        let result = search_db::rebuild_index(&conn, &vault_root, &cancel, &|indexed, total| {
            if indexed == 0 {
                let _ = app2.emit(
                    "index_progress",
                    IndexProgressEvent::Started { vault_id: vid2.clone(), total },
                );
            } else {
                let _ = app2.emit(
                    "index_progress",
                    IndexProgressEvent::Progress {
                        vault_id: vid2.clone(),
                        indexed,
                        total,
                    },
                );
            }
        });

        match result {
            Ok(res) => {
                let elapsed_ms = start.elapsed().as_millis() as u64;
                let _ = app_handle.emit(
                    "index_progress",
                    IndexProgressEvent::Completed {
                        vault_id: vid.clone(),
                        indexed: res.indexed,
                        elapsed_ms,
                    },
                );
            }
            Err(e) => {
                log::error!("index_build failed: {}", e);
                let _ = app_handle.emit(
                    "index_progress",
                    IndexProgressEvent::Failed { vault_id: vid.clone(), error: e },
                );
            }
        }

        if let Ok(mut map) = app.state::<IndexingState>().active.lock() {
            map.remove(&vid);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn index_search(
    app: AppHandle,
    vault_id: String,
    query: SearchQueryInput,
) -> Result<Vec<SearchHit>, String> {
    with_conn(&app, &vault_id, |conn| {
        search_db::search(conn, &query.text, query.scope, 50)
    })
}

#[tauri::command]
pub fn index_suggest(
    app: AppHandle,
    vault_id: String,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<search_db::SuggestionHit>, String> {
    with_conn(&app, &vault_id, |conn| {
        search_db::suggest(conn, &query, limit.unwrap_or(15))
    })
}

#[tauri::command]
pub fn index_upsert_note(app: AppHandle, vault_id: String, note_id: String) -> Result<(), String> {
    let vault_root = storage::vault_path(&app, &vault_id)?;
    let abs = notes_service::safe_vault_abs(&vault_root, &note_id)?;
    let markdown = std::fs::read_to_string(&abs).map_err(|e| e.to_string())?;
    let meta = search_db::extract_meta(&abs, &vault_root)?;

    with_conn(&app, &vault_id, |conn| {
        search_db::upsert_note(conn, &meta, &markdown)?;

        let all_notes = search_db::get_all_notes_from_db(conn)?;
        let key_map = search_db::build_key_map(&all_notes);
        let mut resolved: BTreeSet<String> = BTreeSet::new();
        for token in search_db::wiki_link_targets(&markdown) {
            if let Some(target) = search_db::resolve_wiki_target(&token, &key_map) {
                if target != meta.path {
                    resolved.insert(target);
                }
            }
        }
        search_db::set_outlinks(conn, &meta.path, &resolved.into_iter().collect::<Vec<_>>())
    })
}

#[tauri::command]
pub fn index_remove_note(
    app: AppHandle,
    vault_id: String,
    note_id: String,
) -> Result<(), String> {
    with_conn(&app, &vault_id, |conn| {
        search_db::remove_note(conn, &note_id)
    })
}

#[tauri::command]
pub fn index_outlinks(
    app: AppHandle,
    vault_id: String,
    note_id: String,
) -> Result<Vec<IndexNoteMeta>, String> {
    with_conn(&app, &vault_id, |conn| {
        search_db::get_outlinks(conn, &note_id)
    })
}

#[tauri::command]
pub fn index_backlinks(
    app: AppHandle,
    vault_id: String,
    note_id: String,
) -> Result<Vec<IndexNoteMeta>, String> {
    with_conn(&app, &vault_id, |conn| {
        search_db::get_backlinks(conn, &note_id)
    })
}

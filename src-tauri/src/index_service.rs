use crate::notes_service;
use crate::search_db;
use crate::storage;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

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
pub fn index_build(app: AppHandle, vault_id: String) -> Result<(), String> {
    let vault_root = storage::vault_path(&app, &vault_id).map_err(|e| {
        log::error!("index_build: failed to resolve vault {}: {}", vault_id, e);
        e
    })?;
    with_conn(&app, &vault_id, |conn| {
        search_db::rebuild_index(conn, &vault_root)
    })
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

        let all_notes = get_all_notes_from_db(conn)?;
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

fn get_all_notes_from_db(conn: &Connection) -> Result<BTreeMap<String, IndexNoteMeta>, String> {
    let mut stmt = conn
        .prepare("SELECT path, title, mtime_ms, size_bytes FROM notes")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            let path: String = row.get(0)?;
            Ok(IndexNoteMeta {
                id: path.clone(),
                path,
                title: row.get(1)?,
                mtime_ms: row.get(2)?,
                size_bytes: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut map = BTreeMap::new();
    for row in rows {
        let meta = row.map_err(|e| e.to_string())?;
        map.insert(meta.path.clone(), meta);
    }
    Ok(map)
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

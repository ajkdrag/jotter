use crate::constants;
use crate::index_service::{IndexNoteMeta, SearchScope};
use crate::notes_service;
use crate::storage;
use regex::Regex;
use rusqlite::{params, Connection};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::LazyLock;
use walkdir::WalkDir;

#[derive(Debug, Serialize)]
pub struct SuggestionHit {
    pub note: IndexNoteMeta,
    pub score: f64,
}

pub(crate) static GFM_LINK_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?m)(!?)\[([^\]]*)\]\(([^)]+\.md)\)").unwrap());

pub(crate) fn resolve_relative_path(source_dir: &str, target: &str) -> Option<String> {
    let source_parts: Vec<&str> = if source_dir.is_empty() {
        Vec::new()
    } else {
        source_dir.split('/').collect()
    };

    let mut segments = source_parts;

    for part in target.split('/') {
        match part {
            "." | "" => {}
            ".." => {
                if segments.pop().is_none() {
                    return None;
                }
            }
            _ => segments.push(part),
        }
    }

    Some(segments.join("/"))
}

pub(crate) fn gfm_link_targets(markdown: &str, source_path: &str) -> Vec<String> {
    let source_dir = match source_path.rfind('/') {
        Some(i) => &source_path[..i],
        None => "",
    };

    let mut out = Vec::new();
    for cap in GFM_LINK_RE.captures_iter(markdown) {
        let bang = cap.get(1).map(|m| m.as_str()).unwrap_or_default();
        if bang == "!" {
            continue;
        }
        let href = cap.get(3).map(|m| m.as_str().trim()).unwrap_or_default();
        if href.starts_with("http://") || href.starts_with("https://") {
            continue;
        }
        if let Some(resolved) = resolve_relative_path(source_dir, href) {
            out.push(resolved);
        }
    }
    out
}

pub(crate) fn list_markdown_files(root: &Path) -> Vec<PathBuf> {
    let mut files: Vec<PathBuf> = WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !constants::is_excluded_folder(&name)
        })
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("md"))
        .map(|e| e.path().to_path_buf())
        .collect();
    files.sort();
    files
}

fn file_stem_string(abs: &Path) -> String {
    abs.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_string()
}

pub(crate) fn extract_meta(abs: &Path, vault_root: &Path) -> Result<IndexNoteMeta, String> {
    let rel = abs.strip_prefix(vault_root).map_err(|e| e.to_string())?;
    let rel = storage::normalize_relative_path(rel);
    let title = notes_service::extract_title(abs);
    let name = file_stem_string(abs);
    let (mtime_ms, size_bytes) = notes_service::file_meta(abs)?;
    Ok(IndexNoteMeta {
        id: rel.clone(),
        path: rel,
        title,
        name,
        mtime_ms,
        size_bytes,
    })
}

fn db_path(vault_root: &Path) -> PathBuf {
    vault_root.join(constants::APP_DIR).join("search.db")
}

const EXPECTED_FTS_COLUMNS: &str = "title, name, path, body";

fn fts_schema_needs_migration(conn: &Connection) -> bool {
    let sql = "SELECT sql FROM sqlite_master WHERE type='table' AND name='notes_fts'";
    match conn.query_row(sql, [], |row| row.get::<_, String>(0)) {
        Ok(ddl) => !ddl.contains("name,"),
        Err(_) => false,
    }
}

fn init_schema(conn: &Connection) -> Result<(), String> {
    if fts_schema_needs_migration(conn) {
        conn.execute_batch(
            "DROP TABLE IF EXISTS notes_fts;
             DELETE FROM notes;
             DELETE FROM outlinks;",
        )
        .map_err(|e| e.to_string())?;
    }

    conn.execute_batch(&format!(
        "CREATE TABLE IF NOT EXISTS notes (
            path TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            mtime_ms INTEGER NOT NULL,
            size_bytes INTEGER NOT NULL
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
            {EXPECTED_FTS_COLUMNS},
            tokenize='unicode61 remove_diacritics 2'
        );

        CREATE TABLE IF NOT EXISTS outlinks (
            source_path TEXT NOT NULL,
            target_path TEXT NOT NULL,
            PRIMARY KEY (source_path, target_path)
        );

        CREATE INDEX IF NOT EXISTS idx_outlinks_target ON outlinks(target_path);"
    ))
    .map_err(|e| e.to_string())
}

pub fn open_search_db(vault_root: &Path) -> Result<Connection, String> {
    let path = db_path(vault_root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    conn.busy_timeout(std::time::Duration::from_millis(5000))
        .map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
        .map_err(|e| e.to_string())?;
    init_schema(&conn)?;
    Ok(conn)
}

pub fn upsert_note(conn: &Connection, meta: &IndexNoteMeta, body: &str) -> Result<(), String> {
    conn.execute(
        "REPLACE INTO notes (path, title, mtime_ms, size_bytes) VALUES (?1, ?2, ?3, ?4)",
        params![meta.path, meta.title, meta.mtime_ms, meta.size_bytes],
    )
    .map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM notes_fts WHERE path = ?1", params![meta.path])
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO notes_fts (title, name, path, body) VALUES (?1, ?2, ?3, ?4)",
        params![meta.title, meta.name, meta.path, body],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn remove_note(conn: &Connection, path: &str) -> Result<(), String> {
    conn.execute("DELETE FROM notes WHERE path = ?1", params![path])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes_fts WHERE path = ?1", params![path])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM outlinks WHERE source_path = ?1", params![path])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn remove_notes(conn: &Connection, paths: &[String]) -> Result<(), String> {
    for path in paths {
        remove_note(conn, path)?;
    }
    Ok(())
}

fn like_prefix_pattern(prefix: &str) -> String {
    let escaped = prefix
        .replace('\\', r"\\")
        .replace('%', r"\%")
        .replace('_', r"\_");
    format!("{escaped}%")
}

pub fn remove_notes_by_prefix(conn: &Connection, prefix: &str) -> Result<(), String> {
    let like_pattern = like_prefix_pattern(prefix);
    conn.execute_batch("BEGIN IMMEDIATE")
        .map_err(|e| e.to_string())?;
    let result = conn
        .execute(
            "DELETE FROM notes_fts WHERE path LIKE ?1 ESCAPE '\\'",
            params![like_pattern],
        )
        .and_then(|_| {
            conn.execute(
                "DELETE FROM outlinks WHERE source_path LIKE ?1 ESCAPE '\\'",
                params![like_pattern],
            )
        })
        .and_then(|_| {
            conn.execute(
                "DELETE FROM notes WHERE path LIKE ?1 ESCAPE '\\'",
                params![like_pattern],
            )
        })
        .map_err(|e| e.to_string());
    match result {
        Ok(_) => conn.execute_batch("COMMIT").map_err(|e| e.to_string()),
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

#[derive(Debug, Serialize)]
pub struct IndexResult {
    pub total: usize,
    pub indexed: usize,
}

pub struct SyncPlan {
    pub added: Vec<PathBuf>,
    pub modified: Vec<PathBuf>,
    pub removed: Vec<String>,
    pub unchanged: usize,
}

pub fn get_manifest(conn: &Connection) -> Result<BTreeMap<String, (i64, i64)>, String> {
    let mut stmt = conn
        .prepare("SELECT path, mtime_ms, size_bytes FROM notes")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut map = BTreeMap::new();
    for row in rows {
        let (path, mtime, size) = row.map_err(|e| e.to_string())?;
        map.insert(path, (mtime, size));
    }
    Ok(map)
}

pub fn compute_sync_plan(
    vault_root: &Path,
    manifest: &BTreeMap<String, (i64, i64)>,
    disk_files: &[PathBuf],
) -> SyncPlan {
    let mut added = Vec::new();
    let mut modified = Vec::new();
    let mut unchanged: usize = 0;

    let mut seen_paths: BTreeSet<String> = BTreeSet::new();

    for abs in disk_files {
        let rel = match abs.strip_prefix(vault_root) {
            Ok(r) => storage::normalize_relative_path(r),
            Err(_) => continue,
        };

        seen_paths.insert(rel.clone());

        match manifest.get(&rel) {
            None => added.push(abs.clone()),
            Some(&(db_mtime, db_size)) => match notes_service::file_meta(abs) {
                Ok((disk_mtime, disk_size)) => {
                    if disk_mtime != db_mtime || disk_size != db_size {
                        modified.push(abs.clone());
                    } else {
                        unchanged += 1;
                    }
                }
                Err(_) => modified.push(abs.clone()),
            },
        }
    }

    let removed: Vec<String> = manifest
        .keys()
        .filter(|p| !seen_paths.contains(p.as_str()))
        .cloned()
        .collect();

    SyncPlan {
        added,
        modified,
        removed,
        unchanged,
    }
}

const BATCH_SIZE: usize = 100;

fn resolve_batch_outlinks(
    conn: &Connection,
    pending_links: &[(String, Vec<String>)],
) -> Result<(), String> {
    if pending_links.is_empty() {
        return Ok(());
    }

    for (source, targets) in pending_links {
        let mut resolved: BTreeSet<String> = BTreeSet::new();
        for target in targets {
            if *target != *source {
                resolved.insert(target.clone());
            }
        }
        set_outlinks(conn, source, &resolved.into_iter().collect::<Vec<_>>())?;
    }

    Ok(())
}

pub fn rebuild_index(
    conn: &Connection,
    vault_root: &Path,
    cancel: &AtomicBool,
    on_progress: &dyn Fn(usize, usize),
    yield_fn: &mut dyn FnMut(),
) -> Result<IndexResult, String> {
    conn.execute("DELETE FROM notes", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes_fts", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM outlinks", [])
        .map_err(|e| e.to_string())?;

    let paths = list_markdown_files(vault_root);
    let total = paths.len();
    on_progress(0, total);

    let mut indexed: usize = 0;
    for batch in paths.chunks(BATCH_SIZE) {
        if cancel.load(Ordering::Relaxed) {
            break;
        }
        let mut pending_links: Vec<(String, Vec<String>)> = Vec::new();

        conn.execute_batch("BEGIN IMMEDIATE")
            .map_err(|e| e.to_string())?;

        for abs in batch {
            indexed += 1;
            let markdown = match std::fs::read_to_string(abs) {
                Ok(s) => s,
                Err(e) => {
                    log::warn!("skip {}: {}", abs.display(), e);
                    continue;
                }
            };
            let meta = match extract_meta(abs, vault_root) {
                Ok(m) => m,
                Err(e) => {
                    log::warn!("skip {}: {}", abs.display(), e);
                    continue;
                }
            };
            upsert_note(conn, &meta, &markdown)?;
            let targets = gfm_link_targets(&markdown, &meta.path);
            if !targets.is_empty() {
                pending_links.push((meta.path.clone(), targets));
            }
        }

        conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
        resolve_batch_outlinks(conn, &pending_links)?;
        on_progress(indexed, total);
        yield_fn();
    }

    Ok(IndexResult { total, indexed })
}

pub fn sync_index(
    conn: &Connection,
    vault_root: &Path,
    cancel: &AtomicBool,
    on_progress: &dyn Fn(usize, usize),
    yield_fn: &mut dyn FnMut(),
) -> Result<IndexResult, String> {
    let manifest = get_manifest(conn).unwrap_or_default();
    let disk_files = list_markdown_files(vault_root);
    let plan = compute_sync_plan(vault_root, &manifest, &disk_files);

    let change_count = plan.added.len() + plan.modified.len() + plan.removed.len();

    if change_count == 0 {
        log::info!(
            "sync_index: no changes ({} files unchanged)",
            plan.unchanged
        );
        on_progress(0, 0);
        return Ok(IndexResult {
            total: plan.unchanged,
            indexed: 0,
        });
    }

    log::info!(
        "sync_index: {} added, {} modified, {} removed, {} unchanged",
        plan.added.len(),
        plan.modified.len(),
        plan.removed.len(),
        plan.unchanged
    );

    let total = plan.added.len() + plan.modified.len() + plan.removed.len();
    on_progress(0, total);
    let mut indexed: usize = 0;

    if !plan.removed.is_empty() {
        for batch in plan.removed.chunks(BATCH_SIZE) {
            if cancel.load(Ordering::Relaxed) {
                return Ok(IndexResult {
                    total: total + plan.unchanged,
                    indexed,
                });
            }
            conn.execute_batch("BEGIN IMMEDIATE")
                .map_err(|e| e.to_string())?;
            for path in batch {
                remove_note(conn, path)?;
                conn.execute("DELETE FROM outlinks WHERE source_path = ?1", params![path])
                    .map_err(|e| e.to_string())?;
                indexed += 1;
            }
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
            on_progress(indexed, total);
            yield_fn();
        }
    }

    let upsert_files: Vec<&PathBuf> = plan.added.iter().chain(plan.modified.iter()).collect();

    for batch in upsert_files.chunks(BATCH_SIZE) {
        if cancel.load(Ordering::Relaxed) {
            break;
        }
        let mut pending_links: Vec<(String, Vec<String>)> = Vec::new();

        conn.execute_batch("BEGIN IMMEDIATE")
            .map_err(|e| e.to_string())?;

        for abs in batch {
            indexed += 1;
            let markdown = match std::fs::read_to_string(abs) {
                Ok(s) => s,
                Err(e) => {
                    log::warn!("skip {}: {}", abs.display(), e);
                    continue;
                }
            };
            let meta = match extract_meta(abs, vault_root) {
                Ok(m) => m,
                Err(e) => {
                    log::warn!("skip {}: {}", abs.display(), e);
                    continue;
                }
            };
            upsert_note(conn, &meta, &markdown)?;
            let targets = gfm_link_targets(&markdown, &meta.path);
            if !targets.is_empty() {
                pending_links.push((meta.path.clone(), targets));
            }
        }

        conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
        resolve_batch_outlinks(conn, &pending_links)?;
        on_progress(indexed, total);
        yield_fn();
    }

    Ok(IndexResult {
        total: total + plan.unchanged,
        indexed,
    })
}

pub fn get_all_notes_from_db(conn: &Connection) -> Result<BTreeMap<String, IndexNoteMeta>, String> {
    let mut stmt = conn
        .prepare("SELECT path, title, mtime_ms, size_bytes FROM notes")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| note_meta_from_row(row))
        .map_err(|e| e.to_string())?;
    let mut map = BTreeMap::new();
    for row in rows {
        let meta = row.map_err(|e| e.to_string())?;
        map.insert(meta.path.clone(), meta);
    }
    Ok(map)
}

fn escape_fts_query(query: &str) -> String {
    query
        .split_whitespace()
        .map(|term| format!("\"{}\"", term.replace('"', "")))
        .collect::<Vec<_>>()
        .join(" ")
}

fn escape_fts_prefix_query(query: &str) -> String {
    query
        .split_whitespace()
        .filter_map(|term| {
            let clean: String = term
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-')
                .collect();
            if clean.is_empty() {
                return None;
            }
            Some(format!("\"{clean}\"*"))
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn note_meta_from_row(row: &rusqlite::Row) -> rusqlite::Result<IndexNoteMeta> {
    let path: String = row.get(0)?;
    let title: String = row.get(1)?;
    let name = file_stem_string(Path::new(&path));
    Ok(IndexNoteMeta {
        id: path.clone(),
        path,
        title,
        name,
        mtime_ms: row.get(2)?,
        size_bytes: row.get(3)?,
    })
}

pub fn search(
    conn: &Connection,
    query: &str,
    scope: SearchScope,
    limit: usize,
) -> Result<Vec<crate::index_service::SearchHit>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let escaped = escape_fts_query(trimmed);
    let match_expr = match scope {
        SearchScope::All => escaped,
        SearchScope::Title => format!("title : {escaped}"),
        SearchScope::Path => format!("path : {escaped}"),
        SearchScope::Content => format!("body : {escaped}"),
    };

    let sql = "SELECT n.path, n.title, n.mtime_ms, n.size_bytes,
                      snippet(notes_fts, 3, '<b>', '</b>', '...', 30) as snippet,
                      bm25(notes_fts, 10.0, 12.0, 5.0, 1.0) as rank
               FROM notes_fts
               JOIN notes n ON n.path = notes_fts.path
               WHERE notes_fts MATCH ?1
               ORDER BY rank
               LIMIT ?2";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![match_expr, limit], |row| {
            Ok(crate::index_service::SearchHit {
                note: note_meta_from_row(row)?,
                score: row.get(5)?,
                snippet: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn suggest(conn: &Connection, query: &str, limit: usize) -> Result<Vec<SuggestionHit>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let escaped = escape_fts_prefix_query(trimmed);
    if escaped.is_empty() {
        return Ok(Vec::new());
    }
    let match_expr = format!("{{title name path}} : {escaped}");

    let sql = "SELECT n.path, n.title, n.mtime_ms, n.size_bytes,
                      bm25(notes_fts, 15.0, 20.0, 5.0, 0.0) as rank
               FROM notes_fts
               JOIN notes n ON n.path = notes_fts.path
               WHERE notes_fts MATCH ?1
               ORDER BY rank
               LIMIT ?2";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![match_expr, limit], |row| {
            Ok(SuggestionHit {
                note: note_meta_from_row(row)?,
                score: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn set_outlinks(conn: &Connection, source: &str, targets: &[String]) -> Result<(), String> {
    conn.execute(
        "DELETE FROM outlinks WHERE source_path = ?1",
        params![source],
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("INSERT INTO outlinks (source_path, target_path) VALUES (?1, ?2)")
        .map_err(|e| e.to_string())?;

    for target in targets {
        stmt.execute(params![source, target])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn get_outlinks(conn: &Connection, path: &str) -> Result<Vec<IndexNoteMeta>, String> {
    let sql = "SELECT n.path, n.title, n.mtime_ms, n.size_bytes
               FROM outlinks o
               JOIN notes n ON n.path = o.target_path
               WHERE o.source_path = ?1
               ORDER BY n.path";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![path], |row| note_meta_from_row(row))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn get_orphan_outlinks(conn: &Connection, path: &str) -> Result<Vec<String>, String> {
    let sql = "SELECT o.target_path
               FROM outlinks o
               LEFT JOIN notes n ON n.path = o.target_path
               WHERE o.source_path = ?1 AND n.path IS NULL
               ORDER BY o.target_path";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![path], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn rename_folder_paths(
    conn: &Connection,
    old_prefix: &str,
    new_prefix: &str,
) -> Result<usize, String> {
    let like_pattern = like_prefix_pattern(old_prefix);
    let old_len = old_prefix.len() as i64;

    let count: usize = conn
        .query_row(
            "SELECT COUNT(*) FROM notes WHERE path LIKE ?1 ESCAPE '\\'",
            params![like_pattern],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if count == 0 {
        return Ok(0);
    }

    conn.execute_batch("BEGIN IMMEDIATE")
        .map_err(|e| e.to_string())?;

    let result = conn.execute_batch(
        "CREATE TEMP TABLE IF NOT EXISTS _fts_rename(title TEXT, name TEXT, path TEXT, body TEXT)",
    )
    .and_then(|_| conn.execute("DELETE FROM _fts_rename", []))
    .and_then(|_| conn.execute(
        "INSERT INTO _fts_rename SELECT title, name, ?1 || substr(path, ?2 + 1), body
         FROM notes_fts WHERE path LIKE ?3 ESCAPE '\\'",
        params![new_prefix, old_len, like_pattern],
    ))
    .and_then(|_| conn.execute(
        "DELETE FROM notes_fts WHERE path LIKE ?1 ESCAPE '\\'",
        params![like_pattern],
    ))
    .and_then(|_| conn.execute(
        "INSERT INTO notes_fts(title, name, path, body) SELECT * FROM _fts_rename",
        [],
    ))
    .and_then(|_| conn.execute("DROP TABLE IF EXISTS _fts_rename", []))
    .and_then(|_| conn.execute(
        "UPDATE notes SET path = ?1 || substr(path, ?2 + 1) WHERE path LIKE ?3 ESCAPE '\\'",
        params![new_prefix, old_len, like_pattern],
    ))
    .and_then(|_| conn.execute(
        "UPDATE outlinks SET source_path = ?1 || substr(source_path, ?2 + 1)
         WHERE source_path LIKE ?3 ESCAPE '\\'",
        params![new_prefix, old_len, like_pattern],
    ))
    .and_then(|_| conn.execute(
        "UPDATE outlinks SET target_path = ?1 || substr(target_path, ?2 + 1)
         WHERE target_path LIKE ?3 ESCAPE '\\'",
        params![new_prefix, old_len, like_pattern],
    ))
    .map_err(|e| e.to_string());

    match result {
        Ok(_) => {
            conn.execute_batch("COMMIT").map_err(|e| e.to_string())?;
            Ok(count)
        }
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

pub fn rename_note_path(conn: &Connection, old_path: &str, new_path: &str) -> Result<(), String> {
    conn.execute_batch("BEGIN IMMEDIATE")
        .map_err(|e| e.to_string())?;

    let result = conn
        .execute(
            "UPDATE notes_fts SET path = ?1 WHERE path = ?2",
            params![new_path, old_path],
        )
        .and_then(|_| {
            conn.execute(
                "UPDATE notes SET path = ?1 WHERE path = ?2",
                params![new_path, old_path],
            )
        })
        .and_then(|_| {
            conn.execute(
                "UPDATE outlinks SET source_path = ?1 WHERE source_path = ?2",
                params![new_path, old_path],
            )
        })
        .map(|_| ())
        .map_err(|e| e.to_string());

    match result {
        Ok(_) => conn.execute_batch("COMMIT").map_err(|e| e.to_string()),
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            Err(e)
        }
    }
}

pub fn get_backlinks(conn: &Connection, path: &str) -> Result<Vec<IndexNoteMeta>, String> {
    let sql = "SELECT n.path, n.title, n.mtime_ms, n.size_bytes
               FROM outlinks o
               JOIN notes n ON n.path = o.source_path
               WHERE o.target_path = ?1
               ORDER BY n.path";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![path], |row| note_meta_from_row(row))
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::fs;
    use std::sync::atomic::AtomicBool;
    use tempfile::TempDir;

    fn write_md(dir: &Path, rel: &str, content: &str) -> PathBuf {
        let p = dir.join(rel);
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(&p, content).unwrap();
        p
    }

    fn set_mtime(path: &Path, secs_offset: i64) {
        let t = filetime::FileTime::from_unix_time(1_700_000_000 + secs_offset, 0);
        filetime::set_file_mtime(path, t).unwrap();
    }

    #[test]
    fn empty_manifest_all_added() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();
        let a = write_md(root, "a.md", "hello");
        let b = write_md(root, "b.md", "world");

        let manifest = BTreeMap::new();
        let disk = vec![a, b];
        let plan = compute_sync_plan(root, &manifest, &disk);

        assert_eq!(plan.added.len(), 2);
        assert!(plan.modified.is_empty());
        assert!(plan.removed.is_empty());
        assert_eq!(plan.unchanged, 0);
    }

    #[test]
    fn all_in_manifest_nothing_on_disk() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();

        let mut manifest = BTreeMap::new();
        manifest.insert("a.md".to_string(), (1000i64, 5i64));
        manifest.insert("b.md".to_string(), (2000i64, 5i64));

        let plan = compute_sync_plan(root, &manifest, &[]);

        assert!(plan.added.is_empty());
        assert!(plan.modified.is_empty());
        assert_eq!(plan.removed.len(), 2);
        assert_eq!(plan.unchanged, 0);
    }

    #[test]
    fn unchanged_files_detected() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();
        let p = write_md(root, "note.md", "content");
        set_mtime(&p, 0);

        let (mtime, size) = notes_service::file_meta(&p).unwrap();
        let mut manifest = BTreeMap::new();
        manifest.insert("note.md".to_string(), (mtime, size));

        let plan = compute_sync_plan(root, &manifest, &[p]);

        assert!(plan.added.is_empty());
        assert!(plan.modified.is_empty());
        assert!(plan.removed.is_empty());
        assert_eq!(plan.unchanged, 1);
    }

    #[test]
    fn modified_file_detected_by_mtime() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();
        let p = write_md(root, "note.md", "content");

        let mut manifest = BTreeMap::new();
        manifest.insert("note.md".to_string(), (0i64, 7i64));

        let plan = compute_sync_plan(root, &manifest, &[p]);

        assert!(plan.added.is_empty());
        assert_eq!(plan.modified.len(), 1);
        assert!(plan.removed.is_empty());
    }

    #[test]
    fn mixed_add_modify_remove_unchanged() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();

        let new_file = write_md(root, "new.md", "new");
        let changed = write_md(root, "changed.md", "updated");
        let same = write_md(root, "same.md", "same");
        set_mtime(&same, 100);

        let (same_mtime, same_size) = notes_service::file_meta(&same).unwrap();

        let mut manifest = BTreeMap::new();
        manifest.insert("changed.md".to_string(), (0i64, 0i64));
        manifest.insert("same.md".to_string(), (same_mtime, same_size));
        manifest.insert("deleted.md".to_string(), (999i64, 10i64));

        let disk = vec![new_file, changed, same];
        let plan = compute_sync_plan(root, &manifest, &disk);

        assert_eq!(plan.added.len(), 1);
        assert_eq!(plan.modified.len(), 1);
        assert_eq!(plan.removed, vec!["deleted.md"]);
        assert_eq!(plan.unchanged, 1);
    }

    #[test]
    fn both_empty() {
        let tmp = TempDir::new().unwrap();
        let plan = compute_sync_plan(tmp.path(), &BTreeMap::new(), &[]);

        assert!(plan.added.is_empty());
        assert!(plan.modified.is_empty());
        assert!(plan.removed.is_empty());
        assert_eq!(plan.unchanged, 0);
    }

    #[test]
    fn remove_notes_by_prefix_deletes_matching_and_keeps_others() {
        let tmp = TempDir::new().unwrap();
        let conn = open_search_db(tmp.path()).unwrap();

        let notes = vec![
            ("docs/a.md", "A", "a", "body a"),
            ("docs/sub/b.md", "B", "b", "body b"),
            ("misc/c.md", "C", "c", "body c"),
        ];
        for (path, title, name, body) in &notes {
            let meta = IndexNoteMeta {
                id: path.to_string(),
                path: path.to_string(),
                title: title.to_string(),
                name: name.to_string(),
                mtime_ms: 100,
                size_bytes: 10,
            };
            upsert_note(&conn, &meta, body).unwrap();
        }

        set_outlinks(&conn, "docs/a.md", &["misc/c.md".to_string()]).unwrap();
        set_outlinks(&conn, "docs/sub/b.md", &["docs/a.md".to_string()]).unwrap();

        remove_notes_by_prefix(&conn, "docs/").unwrap();

        let manifest = get_manifest(&conn).unwrap();
        assert_eq!(manifest.len(), 1);
        assert!(manifest.contains_key("misc/c.md"));

        let results = search(&conn, "body", SearchScope::All, 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].note.path, "misc/c.md");

        let outlinks: Vec<String> = conn
            .prepare("SELECT source_path FROM outlinks")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert!(outlinks.is_empty());
    }

    #[test]
    fn remove_notes_by_prefix_escapes_like_wildcards() {
        let tmp = TempDir::new().unwrap();
        let conn = open_search_db(tmp.path()).unwrap();

        let notes = vec![
            ("docs_50%/a.md", "A", "a", "body a"),
            ("docs_500/x.md", "X", "x", "body x"),
            ("docs_50x/y.md", "Y", "y", "body y"),
        ];
        for (path, title, name, body) in &notes {
            let meta = IndexNoteMeta {
                id: path.to_string(),
                path: path.to_string(),
                title: title.to_string(),
                name: name.to_string(),
                mtime_ms: 100,
                size_bytes: 10,
            };
            upsert_note(&conn, &meta, body).unwrap();
        }

        remove_notes_by_prefix(&conn, "docs_50%/").unwrap();

        let manifest = get_manifest(&conn).unwrap();
        assert_eq!(manifest.len(), 2);
        assert!(manifest.contains_key("docs_500/x.md"));
        assert!(manifest.contains_key("docs_50x/y.md"));
        assert!(!manifest.contains_key("docs_50%/a.md"));
    }

    #[test]
    fn rename_folder_paths_escapes_like_wildcards() {
        let tmp = TempDir::new().unwrap();
        let conn = open_search_db(tmp.path()).unwrap();

        let a = IndexNoteMeta {
            id: "old_50%/a.md".to_string(),
            path: "old_50%/a.md".to_string(),
            title: "A".to_string(),
            name: "a".to_string(),
            mtime_ms: 100,
            size_bytes: 10,
        };
        let b = IndexNoteMeta {
            id: "old_500/b.md".to_string(),
            path: "old_500/b.md".to_string(),
            title: "B".to_string(),
            name: "b".to_string(),
            mtime_ms: 100,
            size_bytes: 10,
        };
        upsert_note(&conn, &a, "body a").unwrap();
        upsert_note(&conn, &b, "body b").unwrap();

        let renamed = rename_folder_paths(&conn, "old_50%/", "new/").unwrap();
        assert_eq!(renamed, 1);

        let manifest = get_manifest(&conn).unwrap();
        assert!(manifest.contains_key("new/a.md"));
        assert!(manifest.contains_key("old_500/b.md"));
        assert!(!manifest.contains_key("old_50%/a.md"));
    }

    #[test]
    fn rename_note_path_moves_note_and_outgoing_source_links() {
        let tmp = TempDir::new().unwrap();
        let conn = open_search_db(tmp.path()).unwrap();

        let a = IndexNoteMeta {
            id: "docs/old.md".to_string(),
            path: "docs/old.md".to_string(),
            title: "Old".to_string(),
            name: "old".to_string(),
            mtime_ms: 100,
            size_bytes: 10,
        };
        let b = IndexNoteMeta {
            id: "docs/source.md".to_string(),
            path: "docs/source.md".to_string(),
            title: "Source".to_string(),
            name: "source".to_string(),
            mtime_ms: 100,
            size_bytes: 10,
        };
        upsert_note(&conn, &a, "body a").unwrap();
        upsert_note(&conn, &b, "body b").unwrap();
        set_outlinks(
            &conn,
            "docs/source.md",
            &["docs/old.md".to_string()],
        )
        .unwrap();
        set_outlinks(
            &conn,
            "docs/old.md",
            &["docs/source.md".to_string()],
        )
        .unwrap();

        rename_note_path(&conn, "docs/old.md", "docs/new.md").unwrap();

        let backlinks = get_backlinks(&conn, "docs/new.md").unwrap();
        assert!(backlinks.is_empty());

        let outlinks = get_outlinks(&conn, "docs/new.md").unwrap();
        assert_eq!(outlinks.len(), 1);
        assert_eq!(outlinks[0].path, "docs/source.md");

        let orphans = get_orphan_outlinks(&conn, "docs/source.md").unwrap();
        assert_eq!(orphans, vec!["docs/old.md".to_string()]);
    }

    #[test]
    fn get_orphan_outlinks_returns_missing_targets() {
        let tmp = TempDir::new().unwrap();
        let conn = open_search_db(tmp.path()).unwrap();

        let source = IndexNoteMeta {
            id: "docs/source.md".to_string(),
            path: "docs/source.md".to_string(),
            title: "Source".to_string(),
            name: "source".to_string(),
            mtime_ms: 100,
            size_bytes: 10,
        };
        upsert_note(&conn, &source, "body").unwrap();
        set_outlinks(
            &conn,
            "docs/source.md",
            &["docs/missing.md".to_string(), "docs/other.md".to_string()],
        )
        .unwrap();

        let other = IndexNoteMeta {
            id: "docs/other.md".to_string(),
            path: "docs/other.md".to_string(),
            title: "Other".to_string(),
            name: "other".to_string(),
            mtime_ms: 100,
            size_bytes: 10,
        };
        upsert_note(&conn, &other, "body").unwrap();

        let orphans = get_orphan_outlinks(&conn, "docs/source.md").unwrap();
        assert_eq!(orphans, vec!["docs/missing.md".to_string()]);
    }

    #[test]
    fn rename_then_delete_prefix_preserves_orphan_targets() {
        let tmp = TempDir::new().unwrap();
        let conn = open_search_db(tmp.path()).unwrap();

        let notes = vec![
            ("old/a.md", "A", "a", "links to c"),
            ("old/sub/b.md", "B", "b", "links to a"),
            ("keep/c.md", "C", "c", "links to old/a"),
        ];
        for (path, title, name, body) in &notes {
            let meta = IndexNoteMeta {
                id: path.to_string(),
                path: path.to_string(),
                title: title.to_string(),
                name: name.to_string(),
                mtime_ms: 100,
                size_bytes: 10,
            };
            upsert_note(&conn, &meta, body).unwrap();
        }
        set_outlinks(&conn, "old/a.md", &["keep/c.md".to_string()]).unwrap();
        set_outlinks(&conn, "old/sub/b.md", &["old/a.md".to_string()]).unwrap();
        set_outlinks(&conn, "keep/c.md", &["old/a.md".to_string()]).unwrap();

        let renamed = rename_folder_paths(&conn, "old/", "new/").unwrap();
        assert_eq!(renamed, 2);
        remove_notes_by_prefix(&conn, "new/").unwrap();

        let manifest = get_manifest(&conn).unwrap();
        assert_eq!(manifest.len(), 1);
        assert!(manifest.contains_key("keep/c.md"));

        let stale_notes_fts: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM notes_fts WHERE path LIKE 'old/%' OR path LIKE 'new/%'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stale_notes_fts, 0);

        let orphan_target_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM outlinks WHERE source_path = 'keep/c.md' AND target_path = 'new/a.md'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(orphan_target_count, 1);
    }

    #[test]
    fn sync_progress_advances_when_some_files_are_unreadable() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();
        let conn = open_search_db(root).unwrap();

        write_md(root, "ok.md", "# ok");
        fs::write(root.join("bad.md"), [0xff, 0xfe, 0xfd]).unwrap();

        let cancel = AtomicBool::new(false);
        let progress_points: RefCell<Vec<(usize, usize)>> = RefCell::new(Vec::new());
        let result = sync_index(
            &conn,
            root,
            &cancel,
            &|indexed, total| progress_points.borrow_mut().push((indexed, total)),
            &mut || {},
        )
        .unwrap();

        assert!(
            progress_points
                .borrow()
                .iter()
                .any(|(indexed, _)| *indexed > 0)
        );
        assert_eq!(result.indexed, 2);
        assert_eq!(result.total, 2);
        let manifest = get_manifest(&conn).unwrap();
        assert!(manifest.contains_key("ok.md"));
    }

    #[test]
    fn rebuild_resolves_batch_outlinks_before_yield() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();
        let conn = open_search_db(root).unwrap();

        write_md(root, "notes/000-target.md", "# target");
        write_md(root, "notes/001-source.md", "[target](000-target.md)");
        for i in 0..100 {
            write_md(root, &format!("notes/{:03}-filler.md", i + 2), "# filler");
        }

        let cancel = AtomicBool::new(false);
        let mut first_yield_checked = false;
        rebuild_index(&conn, root, &cancel, &|_, _| {}, &mut || {
            if first_yield_checked {
                return;
            }
            let outlinks = get_outlinks(&conn, "notes/001-source.md").unwrap();
            assert_eq!(outlinks.len(), 1);
            assert_eq!(outlinks[0].path, "notes/000-target.md");
            first_yield_checked = true;
        })
        .unwrap();

        assert!(first_yield_checked);
    }

    #[test]
    fn sync_resolves_batch_outlinks_before_yield() {
        let tmp = TempDir::new().unwrap();
        let root = tmp.path();
        let conn = open_search_db(root).unwrap();

        write_md(root, "notes/target.md", "# target");
        write_md(root, "notes/source.md", "# source");

        let cancel = AtomicBool::new(false);
        rebuild_index(&conn, root, &cancel, &|_, _| {}, &mut || {}).unwrap();

        write_md(root, "notes/source.md", "# source\n[target](target.md)");

        let mut checked = false;
        sync_index(&conn, root, &cancel, &|_, _| {}, &mut || {
            if checked {
                return;
            }
            let outlinks = get_outlinks(&conn, "notes/source.md").unwrap();
            assert_eq!(outlinks.len(), 1);
            assert_eq!(outlinks[0].path, "notes/target.md");
            checked = true;
        })
        .unwrap();

        assert!(checked);
    }

    #[test]
    fn gfm_link_targets_allows_spaces_in_folder_names() {
        let targets = gfm_link_targets("[Doc](Folder Name/child note.md)", "root.md");
        assert_eq!(targets, vec!["Folder Name/child note.md".to_string()]);
    }
}

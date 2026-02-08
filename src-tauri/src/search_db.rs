use crate::constants;
use crate::index_service::{IndexNoteMeta, SearchScope};
use crate::notes_service;
use crate::storage;
use regex::Regex;
use rusqlite::{params, Connection};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::LazyLock;
use walkdir::WalkDir;

#[derive(Debug, Serialize)]
pub struct SuggestionHit {
    pub note: IndexNoteMeta,
    pub score: f64,
}

pub(crate) static WIKI_LINK_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\[\[([^\]]+)\]\]").unwrap());

pub(crate) fn normalize_key(s: &str) -> String {
    s.trim().to_ascii_lowercase()
}

pub(crate) fn wiki_link_targets(markdown: &str) -> Vec<String> {
    let mut out = Vec::new();
    for cap in WIKI_LINK_RE.captures_iter(markdown) {
        let raw = cap.get(1).map(|m| m.as_str()).unwrap_or_default();
        let left = raw.split('|').next().unwrap_or(raw);
        let left = left.split('#').next().unwrap_or(left).trim();
        if left.is_empty() {
            continue;
        }
        out.push(left.to_string());
    }
    out
}

pub(crate) fn resolve_wiki_target(
    token: &str,
    key_to_path: &BTreeMap<String, String>,
) -> Option<String> {
    let t = token.trim();
    if t.is_empty() {
        return None;
    }
    let token_no_ext = t.strip_suffix(".md").unwrap_or(t);

    if token_no_ext.contains('/') {
        let direct = normalize_key(token_no_ext);
        if let Some(p) = key_to_path.get(&direct) {
            return Some(p.clone());
        }
        let direct_md = normalize_key(&format!("{token_no_ext}.md"));
        if let Some(p) = key_to_path.get(&direct_md) {
            return Some(p.clone());
        }
    }

    let k = normalize_key(token_no_ext);
    key_to_path.get(&k).cloned()
}

pub(crate) fn build_key_map(notes: &BTreeMap<String, IndexNoteMeta>) -> BTreeMap<String, String> {
    let mut map: BTreeMap<String, String> = BTreeMap::new();
    for (path, meta) in notes.iter() {
        let stem = Path::new(path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(path);
        map.entry(normalize_key(stem))
            .or_insert_with(|| path.clone());
        map.entry(normalize_key(&meta.title))
            .or_insert_with(|| path.clone());
        map.entry(normalize_key(path))
            .or_insert_with(|| path.clone());
        map.entry(normalize_key(path.strip_suffix(".md").unwrap_or(path)))
            .or_insert_with(|| path.clone());
    }
    map
}

pub(crate) fn list_markdown_files(root: &Path) -> Vec<PathBuf> {
    WalkDir::new(root)
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
        .collect()
}

pub(crate) fn extract_meta(abs: &Path, vault_root: &Path) -> Result<IndexNoteMeta, String> {
    let rel = abs.strip_prefix(vault_root).map_err(|e| e.to_string())?;
    let rel = storage::normalize_relative_path(rel);
    let title = notes_service::extract_title(abs);
    let (mtime_ms, size_bytes) = notes_service::file_meta(abs)?;
    Ok(IndexNoteMeta {
        id: rel.clone(),
        path: rel,
        title,
        mtime_ms,
        size_bytes,
    })
}

fn db_path(vault_root: &Path) -> PathBuf {
    vault_root.join(constants::APP_DIR).join("search.db")
}

fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS notes (
            path TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            mtime_ms INTEGER NOT NULL,
            size_bytes INTEGER NOT NULL
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
            title,
            path,
            body,
            tokenize='unicode61 remove_diacritics 2'
        );

        CREATE TABLE IF NOT EXISTS outlinks (
            source_path TEXT NOT NULL,
            target_path TEXT NOT NULL,
            PRIMARY KEY (source_path, target_path)
        );

        CREATE INDEX IF NOT EXISTS idx_outlinks_target ON outlinks(target_path);",
    )
    .map_err(|e| e.to_string())
}

pub fn open_search_db(vault_root: &Path) -> Result<Connection, String> {
    let path = db_path(vault_root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
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

    conn.execute(
        "DELETE FROM notes_fts WHERE path = ?1",
        params![meta.path],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO notes_fts (title, path, body) VALUES (?1, ?2, ?3)",
        params![meta.title, meta.path, body],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn remove_note(conn: &Connection, path: &str) -> Result<(), String> {
    conn.execute("DELETE FROM notes WHERE path = ?1", params![path])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes_fts WHERE path = ?1", params![path])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn rebuild_index(conn: &Connection, vault_root: &Path) -> Result<(), String> {
    conn.execute("DELETE FROM notes", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes_fts", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM outlinks", [])
        .map_err(|e| e.to_string())?;

    let mut notes: BTreeMap<String, IndexNoteMeta> = BTreeMap::new();
    let mut bodies: BTreeMap<String, String> = BTreeMap::new();

    for abs in list_markdown_files(vault_root) {
        let markdown = std::fs::read_to_string(&abs).map_err(|e| e.to_string())?;
        let meta = extract_meta(&abs, vault_root)?;
        bodies.insert(meta.path.clone(), markdown);
        notes.insert(meta.path.clone(), meta);
    }

    let key_map = build_key_map(&notes);

    for (path, meta) in notes.iter() {
        let markdown = bodies.get(path).map(|s| s.as_str()).unwrap_or_default();
        upsert_note(conn, meta, markdown)?;

        let mut resolved: BTreeSet<String> = BTreeSet::new();
        for token in wiki_link_targets(markdown) {
            if let Some(target) = resolve_wiki_target(&token, &key_map) {
                if target != *path {
                    resolved.insert(target);
                }
            }
        }
        set_outlinks(conn, path, &resolved.into_iter().collect::<Vec<_>>())?;
    }

    Ok(())
}

fn escape_fts_query(query: &str) -> String {
    query
        .split_whitespace()
        .map(|term| format!("\"{}\"", term.replace('"', "")))
        .collect::<Vec<_>>()
        .join(" ")
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
                      snippet(notes_fts, 2, '<b>', '</b>', '...', 30) as snippet,
                      bm25(notes_fts, 10.0, 5.0, 1.0) as rank
               FROM notes_fts
               JOIN notes n ON n.path = notes_fts.path
               WHERE notes_fts MATCH ?1
               ORDER BY rank
               LIMIT ?2";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![match_expr, limit], |row| {
            Ok(crate::index_service::SearchHit {
                note: IndexNoteMeta {
                    id: row.get::<_, String>(0)?,
                    path: row.get(0)?,
                    title: row.get(1)?,
                    mtime_ms: row.get(2)?,
                    size_bytes: row.get(3)?,
                },
                score: row.get(5)?,
                snippet: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut hits = Vec::new();
    for row in rows {
        hits.push(row.map_err(|e| e.to_string())?);
    }
    Ok(hits)
}

pub fn suggest(
    conn: &Connection,
    query: &str,
    limit: usize,
) -> Result<Vec<SuggestionHit>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let escaped = escape_fts_query(trimmed);
    let match_expr = format!("title : {escaped}");

    let sql = "SELECT n.path, n.title, n.mtime_ms, n.size_bytes,
                      bm25(notes_fts, 15.0, 5.0, 0.0) as rank
               FROM notes_fts
               JOIN notes n ON n.path = notes_fts.path
               WHERE notes_fts MATCH ?1
               ORDER BY rank
               LIMIT ?2";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![match_expr, limit], |row| {
            Ok(SuggestionHit {
                note: IndexNoteMeta {
                    id: row.get::<_, String>(0)?,
                    path: row.get(0)?,
                    title: row.get(1)?,
                    mtime_ms: row.get(2)?,
                    size_bytes: row.get(3)?,
                },
                score: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut hits = Vec::new();
    for row in rows {
        hits.push(row.map_err(|e| e.to_string())?);
    }
    Ok(hits)
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
        .query_map(params![path], |row| {
            Ok(IndexNoteMeta {
                id: row.get::<_, String>(0)?,
                path: row.get(0)?,
                title: row.get(1)?,
                mtime_ms: row.get(2)?,
                size_bytes: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

pub fn get_backlinks(conn: &Connection, path: &str) -> Result<Vec<IndexNoteMeta>, String> {
    let sql = "SELECT n.path, n.title, n.mtime_ms, n.size_bytes
               FROM outlinks o
               JOIN notes n ON n.path = o.source_path
               WHERE o.target_path = ?1
               ORDER BY n.path";

    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![path], |row| {
            Ok(IndexNoteMeta {
                id: row.get::<_, String>(0)?,
                path: row.get(0)?,
                title: row.get(1)?,
                mtime_ms: row.get(2)?,
                size_bytes: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

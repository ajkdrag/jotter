use crate::notes_service;
use crate::storage;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use tantivy::collector::TopDocs;
use tantivy::directory::MmapDirectory;
use tantivy::query::QueryParser;
use tantivy::schema::{Schema, Value, STORED, STRING, TEXT};
use tantivy::{doc, Index, IndexReader};
use tauri::AppHandle;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IndexNoteMeta {
    pub id: String,
    pub path: String,
    pub title: String,
    pub mtime_ms: i64,
    pub size_bytes: i64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct IndexData {
    notes: BTreeMap<String, IndexNoteMeta>,
    outlinks: BTreeMap<String, Vec<String>>,
}

#[derive(Debug, Serialize)]
pub struct SearchHit {
    pub note: IndexNoteMeta,
    pub score: f32,
    pub snippet: Option<String>,
}

fn vault_path(app: &AppHandle, vault_id: &str) -> Result<PathBuf, String> {
    let store = storage::load_store(app)?;
    let vault_path = storage::vault_path_by_id(&store, vault_id).ok_or("vault not found")?;
    Ok(PathBuf::from(vault_path))
}

fn index_dir(vault_root: &Path) -> PathBuf {
    vault_root.join(".imdown").join("index")
}

fn index_data_path(vault_root: &Path) -> PathBuf {
    index_dir(vault_root).join("index_data.json")
}

fn normalize_key(s: &str) -> String {
    s.trim().to_ascii_lowercase()
}

fn wiki_link_targets(markdown: &str) -> Vec<String> {
    let re = Regex::new(r"\\[\\[([^\\]]+)\\]\\]").unwrap();
    let mut out = Vec::new();
    for cap in re.captures_iter(markdown) {
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

fn resolve_wiki_target(token: &str, key_to_path: &BTreeMap<String, String>) -> Option<String> {
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

fn build_key_map(notes: &BTreeMap<String, IndexNoteMeta>) -> BTreeMap<String, String> {
    let mut map: BTreeMap<String, String> = BTreeMap::new();
    for (path, meta) in notes.iter() {
        let stem = Path::new(path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(path);
        map.entry(normalize_key(stem)).or_insert_with(|| path.clone());
        map.entry(normalize_key(&meta.title)).or_insert_with(|| path.clone());
        map.entry(normalize_key(path)).or_insert_with(|| path.clone());
        map.entry(normalize_key(path.strip_suffix(".md").unwrap_or(path)))
            .or_insert_with(|| path.clone());
    }
    map
}

fn list_markdown_files(root: &Path) -> Vec<PathBuf> {
    WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            name != ".imdown" && name != ".git"
        })
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("md"))
        .map(|e| e.path().to_path_buf())
        .collect()
}

fn extract_meta(abs: &Path, vault_root: &Path) -> Result<IndexNoteMeta, String> {
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

fn build_index_schema() -> (Schema, tantivy::schema::Field, tantivy::schema::Field, tantivy::schema::Field) {
    let mut schema_builder = Schema::builder();
    let path_f = schema_builder.add_text_field("path", STRING | STORED);
    let title_f = schema_builder.add_text_field("title", TEXT | STORED);
    let body_f = schema_builder.add_text_field("body", TEXT | STORED);
    let schema = schema_builder.build();
    (schema, path_f, title_f, body_f)
}

fn open_index(vault_root: &Path) -> Result<(Index, tantivy::schema::Field, tantivy::schema::Field, tantivy::schema::Field), String> {
    let dir = index_dir(vault_root);
    let mmap = MmapDirectory::open(&dir).map_err(|e| e.to_string())?;
    let (schema, path_f, title_f, body_f) = build_index_schema();
    let index = Index::open_or_create(mmap, schema).map_err(|e| e.to_string())?;
    Ok((index, path_f, title_f, body_f))
}

fn open_reader(index: &Index) -> Result<IndexReader, String> {
    index
        .reader_builder()
        .reload_policy(tantivy::ReloadPolicy::OnCommitWithDelay)
        .try_into()
        .map_err(|e| e.to_string())
}

fn load_index_data(vault_root: &Path) -> Result<IndexData, String> {
    let bytes = std::fs::read(index_data_path(vault_root)).map_err(|e| e.to_string())?;
    serde_json::from_slice(&bytes).map_err(|e| e.to_string())
}

fn save_index_data(vault_root: &Path, data: &IndexData) -> Result<(), String> {
    let dir = index_dir(vault_root);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = index_data_path(vault_root);
    let tmp = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec_pretty(data).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn index_build(app: AppHandle, vault_id: String) -> Result<(), String> {
    let vault_root = vault_path(&app, &vault_id)?;
    let dir = index_dir(&vault_root);
    let _ = std::fs::create_dir_all(dir.parent().unwrap());
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let (index, path_f, title_f, body_f) = open_index(&vault_root)?;
    let mut writer = index.writer(50_000_000).map_err(|e| e.to_string())?;

    let mut notes: BTreeMap<String, IndexNoteMeta> = BTreeMap::new();
    let mut bodies: BTreeMap<String, String> = BTreeMap::new();

    for abs in list_markdown_files(&vault_root) {
        let markdown = std::fs::read_to_string(&abs).map_err(|e| e.to_string())?;
        let meta = extract_meta(&abs, &vault_root)?;
        bodies.insert(meta.path.clone(), markdown);
        notes.insert(meta.path.clone(), meta);
    }

    let key_map = build_key_map(&notes);
    let mut outlinks: BTreeMap<String, Vec<String>> = BTreeMap::new();

    for (path, meta) in notes.iter() {
        let markdown = bodies.get(path).map(|s| s.as_str()).unwrap_or_default();
        let mut resolved: BTreeSet<String> = BTreeSet::new();
        for token in wiki_link_targets(markdown) {
            if let Some(target) = resolve_wiki_target(&token, &key_map) {
                if target != *path {
                    resolved.insert(target);
                }
            }
        }
        outlinks.insert(path.clone(), resolved.into_iter().collect());

        let body = markdown;
        writer
            .add_document(doc!(
                path_f => path.as_str(),
                title_f => meta.title.as_str(),
                body_f => body
            ))
            .map_err(|e| e.to_string())?;
    }

    writer.commit().map_err(|e| e.to_string())?;

    let data = IndexData {
        notes,
        outlinks,
    };
    save_index_data(&vault_root, &data)?;
    Ok(())
}

#[tauri::command]
pub fn index_search(app: AppHandle, vault_id: String, query: String) -> Result<Vec<SearchHit>, String> {
    let vault_root = vault_path(&app, &vault_id)?;
    let data = load_index_data(&vault_root)?;
    let (index, _path_f, title_f, body_f) = open_index(&vault_root)?;
    let reader = open_reader(&index)?;
    let searcher = reader.searcher();

    let qp = QueryParser::for_index(&index, vec![title_f, body_f]);
    let q = qp.parse_query(&query).map_err(|e| e.to_string())?;
    let top = searcher.search(&q, &TopDocs::with_limit(50)).map_err(|e| e.to_string())?;

    let mut hits = Vec::new();
    for (score, addr) in top {
        let doc: tantivy::TantivyDocument = searcher.doc(addr).map_err(|e| e.to_string())?;
        let path = doc
            .get_first(index.schema().get_field("path").unwrap())
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let note = match data.notes.get(&path) {
            Some(n) => n.clone(),
            None => continue,
        };

        let snippet = doc
            .get_first(index.schema().get_field("body").unwrap())
            .and_then(|v| v.as_str())
            .map(|s| {
                let s = s.replace('\n', " ");
                let s = s.split_whitespace().take(32).collect::<Vec<_>>().join(" ");
                s
            });

        hits.push(SearchHit {
            note,
            score,
            snippet,
        });
    }

    Ok(hits)
}

fn note_list_from_paths(data: &IndexData, paths: &[String]) -> Vec<IndexNoteMeta> {
    paths
        .iter()
        .filter_map(|p| data.notes.get(p).cloned())
        .collect()
}

#[tauri::command]
pub fn index_outlinks(app: AppHandle, vault_id: String, note_id: String) -> Result<Vec<IndexNoteMeta>, String> {
    let vault_root = vault_path(&app, &vault_id)?;
    let data = load_index_data(&vault_root)?;
    let paths = data.outlinks.get(&note_id).cloned().unwrap_or_default();
    Ok(note_list_from_paths(&data, &paths))
}

#[tauri::command]
pub fn index_backlinks(app: AppHandle, vault_id: String, note_id: String) -> Result<Vec<IndexNoteMeta>, String> {
    let vault_root = vault_path(&app, &vault_id)?;
    let data = load_index_data(&vault_root)?;
    let mut backlinks = Vec::new();
    for (src, outs) in data.outlinks.iter() {
        if outs.iter().any(|p| p == &note_id) {
            backlinks.push(src.clone());
        }
    }
    backlinks.sort();
    Ok(note_list_from_paths(&data, &backlinks))
}

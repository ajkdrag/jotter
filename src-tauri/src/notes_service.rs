use crate::storage;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::path::Component;
use tauri::AppHandle;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize)]
pub struct NoteMeta {
    pub id: String,
    pub path: String,
    pub title: String,
    pub mtime_ms: i64,
    pub size_bytes: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct NoteDoc {
    pub meta: NoteMeta,
    pub markdown: String,
}

#[derive(Debug, Deserialize)]
pub struct NoteWriteArgs {
    pub vault_id: String,
    pub note_id: String,
    pub markdown: String,
}

fn vault_path(app: &AppHandle, vault_id: &str) -> Result<PathBuf, String> {
    let store = storage::load_store(app)?;
    let vault_path = storage::vault_path_by_id(&store, vault_id).ok_or("vault not found")?;
    Ok(PathBuf::from(vault_path))
}

fn safe_note_abs(vault_root: &Path, note_rel: &str) -> Result<PathBuf, String> {
    let rel = PathBuf::from(note_rel);
    if rel.is_absolute() {
        return Err("note path must be relative".to_string());
    }
    if rel.components().any(|c| matches!(c, Component::ParentDir | Component::CurDir | Component::Prefix(_) | Component::RootDir)) {
        return Err("note path contains invalid segments".to_string());
    }
    let abs = vault_root.join(&rel);
    let abs = abs.canonicalize().unwrap_or(abs);
    let base = vault_root
        .canonicalize()
        .unwrap_or_else(|_| vault_root.to_path_buf());
    if !abs.starts_with(&base) {
        return Err("note path escapes vault".to_string());
    }
    Ok(abs)
}

pub(crate) fn extract_title(path: &Path) -> String {
    let mut file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return path.file_stem().unwrap_or_default().to_string_lossy().to_string(),
    };

    let mut buf = vec![0u8; 8192];
    let n = match file.read(&mut buf) {
        Ok(n) => n,
        Err(_) => 0,
    };
    buf.truncate(n);

    let prefix = String::from_utf8_lossy(&buf);
    for line in prefix.lines() {
        let l = line.trim();
        if l.is_empty() {
            continue;
        }
        if let Some(rest) = l.strip_prefix("# ") {
            let t = rest.trim();
            if !t.is_empty() {
                return t.to_string();
            }
        }
        break;
    }

    path.file_stem().unwrap_or_default().to_string_lossy().to_string()
}

pub(crate) fn file_meta(path: &Path) -> Result<(i64, i64), String> {
    let meta = std::fs::metadata(path).map_err(|e| e.to_string())?;
    let size = meta.len() as i64;
    let mtime = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    Ok((mtime, size))
}

#[tauri::command]
pub fn list_notes(app: AppHandle, vault_id: String) -> Result<Vec<NoteMeta>, String> {
    let root = vault_path(&app, &vault_id).map_err(|e| {
        log::error!("Failed to resolve vault path for {}: {}", vault_id, e);
        e
    })?;
    let mut out = Vec::new();

    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !name.starts_with('.') || name == ".." || name == "."
        })
        .filter_map(|e| e.ok())
    {
        let p = entry.path();
        if !entry.file_type().is_file() {
            continue;
        }
        if p.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }

        let rel = p.strip_prefix(&root).map_err(|e| e.to_string())?;
        let rel = storage::normalize_relative_path(rel);
        let abs = safe_note_abs(&root, &rel)?;
        let title = extract_title(&abs);
        let (mtime_ms, size_bytes) = file_meta(&abs)?;
        out.push(NoteMeta {
            id: rel.clone(),
            path: rel,
            title,
            mtime_ms,
            size_bytes,
        });
    }

    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

#[tauri::command]
pub fn read_note(app: AppHandle, vault_id: String, note_id: String) -> Result<NoteDoc, String> {
    let root = vault_path(&app, &vault_id)?;
    let abs = safe_note_abs(&root, &note_id)?;
    let markdown = std::fs::read_to_string(&abs).map_err(|e| {
        log::error!("Failed to read note {}: {}", note_id, e);
        e.to_string()
    })?;
    let title = extract_title(&abs);
    let (mtime_ms, size_bytes) = file_meta(&abs)?;
    Ok(NoteDoc {
        meta: NoteMeta {
            id: note_id.clone(),
            path: note_id,
            title,
            mtime_ms,
            size_bytes,
        },
        markdown,
    })
}

fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    let dir = path.parent().ok_or("invalid note path")?;
    std::fs::create_dir_all(dir).map_err(|e| {
        log::error!("Failed to create directory {}: {}", dir.display(), e);
        e.to_string()
    })?;
    let name = format!("{}.tmp", storage::now_ms());
    let tmp = dir.join(name);
    std::fs::write(&tmp, content.as_bytes()).map_err(|e| {
        log::error!("Failed to write temp file {}: {}", tmp.display(), e);
        e.to_string()
    })?;
    std::fs::rename(&tmp, path).map_err(|e| {
        log::error!("Failed to rename {} -> {}: {}", tmp.display(), path.display(), e);
        e.to_string()
    })?;
    Ok(())
}

#[tauri::command]
pub fn write_note(args: NoteWriteArgs, app: AppHandle) -> Result<(), String> {
    let root = vault_path(&app, &args.vault_id)?;
    let abs = safe_note_abs(&root, &args.note_id)?;
    atomic_write(&abs, &args.markdown)?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct NoteCreateArgs {
    pub vault_id: String,
    pub note_path: String,
    pub initial_markdown: String,
}

#[tauri::command]
pub fn create_note(args: NoteCreateArgs, app: AppHandle) -> Result<NoteMeta, String> {
    let root = vault_path(&app, &args.vault_id)?;
    let abs = safe_note_abs(&root, &args.note_path)?;
    if abs.exists() {
        return Err("note already exists".to_string());
    }
    atomic_write(&abs, &args.initial_markdown)?;
    let title = extract_title(&abs);
    let (mtime_ms, size_bytes) = file_meta(&abs)?;
    Ok(NoteMeta {
        id: args.note_path.clone(),
        path: args.note_path,
        title,
        mtime_ms,
        size_bytes,
    })
}

#[derive(Debug, Deserialize)]
pub struct WriteImageAssetArgs {
    pub vault_id: String,
    pub note_path: String,
    pub mime_type: String,
    pub file_name: Option<String>,
    pub bytes: Vec<u8>,
    #[serde(default)]
    pub custom_filename: Option<String>,
    #[serde(default)]
    pub attachment_folder: Option<String>,
}

fn image_extension(mime_type: &str, file_name: Option<&str>) -> String {
    let from_name = file_name
        .and_then(|name| Path::new(name).extension())
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .filter(|ext| !ext.is_empty());
    if let Some(ext) = from_name {
        return ext;
    }

    match mime_type.to_ascii_lowercase().as_str() {
        "image/jpeg" => "jpg".to_string(),
        "image/png" => "png".to_string(),
        "image/gif" => "gif".to_string(),
        "image/webp" => "webp".to_string(),
        "image/bmp" => "bmp".to_string(),
        "image/svg+xml" => "svg".to_string(),
        _ => "png".to_string(),
    }
}

fn sanitize_stem(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
            out.push(c.to_ascii_lowercase());
            continue;
        }

        if !out.ends_with('-') {
            out.push('-');
        }
    }

    let trimmed = out.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "image".to_string()
    } else {
        trimmed
    }
}

#[tauri::command]
pub fn write_image_asset(args: WriteImageAssetArgs, app: AppHandle) -> Result<String, String> {
    let root = vault_path(&app, &args.vault_id)?;
    let _ = safe_note_abs(&root, &args.note_path)?;

    let note_rel = PathBuf::from(&args.note_path);
    let note_parent = note_rel.parent().unwrap_or_else(|| Path::new(""));
    let note_stem = note_rel
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("image");

    let attachment_folder = args.attachment_folder.as_deref().unwrap_or(".assets");

    let filename = if let Some(custom_filename) = args.custom_filename {
        custom_filename
    } else {
        let source_stem = args
            .file_name
            .as_deref()
            .and_then(|name| Path::new(name).file_stem())
            .and_then(|stem| stem.to_str())
            .unwrap_or(note_stem);
        let ext = image_extension(&args.mime_type, args.file_name.as_deref());
        format!("{}-{}.{}", sanitize_stem(source_stem), storage::now_ms(), ext)
    };

    let rel_path = if note_parent.as_os_str().is_empty() {
        PathBuf::from(attachment_folder).join(filename)
    } else {
        note_parent.join(attachment_folder).join(filename)
    };
    let rel = storage::normalize_relative_path(&rel_path);
    let abs = safe_note_abs(&root, &rel)?;

    let dir = abs.parent().ok_or("invalid asset path")?;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let tmp = dir.join(format!("{}.tmp", storage::now_ms()));
    std::fs::write(&tmp, args.bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &abs).map_err(|e| e.to_string())?;

    Ok(rel)
}

#[derive(Debug, Deserialize)]
pub struct NoteRenameArgs {
    pub vault_id: String,
    pub from: String,
    pub to: String,
}

#[tauri::command]
pub fn rename_note(args: NoteRenameArgs, app: AppHandle) -> Result<(), String> {
    let root = vault_path(&app, &args.vault_id)?;
    let from_abs = safe_note_abs(&root, &args.from)?;
    let to_abs = safe_note_abs(&root, &args.to)?;
    let dir = to_abs.parent().ok_or("invalid destination path")?;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    std::fs::rename(&from_abs, &to_abs).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct NoteDeleteArgs {
    pub vault_id: String,
    pub note_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FolderContents {
    pub notes: Vec<NoteMeta>,
    pub subfolders: Vec<String>,
}

#[tauri::command]
pub fn delete_note(args: NoteDeleteArgs, app: AppHandle) -> Result<(), String> {
    let root = vault_path(&app, &args.vault_id)?;
    let abs = safe_note_abs(&root, &args.note_id)?;
    std::fs::remove_file(&abs).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn list_folders(app: AppHandle, vault_id: String) -> Result<Vec<String>, String> {
    let root = vault_path(&app, &vault_id)?;
    let mut out = Vec::new();

    for entry in WalkDir::new(&root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !name.starts_with('.')
        })
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_dir() || entry.path() == root.as_path() {
            continue;
        }
        let rel = entry.path().strip_prefix(&root).map_err(|e| e.to_string())?;
        out.push(storage::normalize_relative_path(rel));
    }

    out.sort();
    Ok(out)
}

#[derive(Debug, Deserialize)]
pub struct FolderCreateArgs {
    pub vault_id: String,
    pub parent_path: String,
    pub folder_name: String,
}

#[tauri::command]
pub fn create_folder(args: FolderCreateArgs, app: AppHandle) -> Result<(), String> {
    let root = vault_path(&app, &args.vault_id)?;
    let parent = if args.parent_path.is_empty() {
        root.clone()
    } else {
        safe_note_abs(&root, &args.parent_path)?
    };
    if !parent.is_dir() {
        return Err("parent path is not a directory".to_string());
    }
    if args.folder_name.contains('/') || args.folder_name.contains('\\') || args.folder_name.starts_with('.') {
        return Err("invalid folder name".to_string());
    }
    let target = parent.join(&args.folder_name);
    std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct FolderRenameArgs {
    pub vault_id: String,
    pub from_path: String,
    pub to_path: String,
}

#[tauri::command]
pub fn rename_folder(args: FolderRenameArgs, app: AppHandle) -> Result<(), String> {
    let root = vault_path(&app, &args.vault_id)?;
    if args.from_path.is_empty() || args.to_path.is_empty() {
        return Err("cannot rename vault root".to_string());
    }
    let from_abs = safe_note_abs(&root, &args.from_path)?;
    let to_abs = safe_note_abs(&root, &args.to_path)?;
    if !from_abs.is_dir() {
        return Err("source is not a directory".to_string());
    }
    if let Some(dir) = to_abs.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::rename(&from_abs, &to_abs).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct FolderDeleteArgs {
    pub vault_id: String,
    pub folder_path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FolderDeleteResult {
    pub deleted_notes: Vec<String>,
    pub deleted_folders: Vec<String>,
}

#[tauri::command]
pub fn delete_folder(args: FolderDeleteArgs, app: AppHandle) -> Result<FolderDeleteResult, String> {
    let root = vault_path(&app, &args.vault_id)?;
    if args.folder_path.is_empty() {
        return Err("cannot delete vault root".to_string());
    }
    let abs = safe_note_abs(&root, &args.folder_path)?;
    if !abs.is_dir() {
        return Err("path is not a directory".to_string());
    }

    let mut deleted_notes = Vec::new();
    let mut deleted_folders = Vec::new();

    for entry in WalkDir::new(&abs)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let p = entry.path();
        if p == abs {
            continue;
        }
        let rel = p.strip_prefix(&root).map_err(|e| e.to_string())?;
        let rel_str = storage::normalize_relative_path(rel);
        if entry.file_type().is_file() && p.extension().and_then(|e| e.to_str()) == Some("md") {
            deleted_notes.push(rel_str);
        } else if entry.file_type().is_dir() {
            deleted_folders.push(rel_str);
        }
    }

    std::fs::remove_dir_all(&abs).map_err(|e| e.to_string())?;
    Ok(FolderDeleteResult { deleted_notes, deleted_folders })
}

#[tauri::command]
pub fn list_folder_contents(
    app: AppHandle,
    vault_id: String,
    folder_path: String,
) -> Result<FolderContents, String> {
    let root = vault_path(&app, &vault_id)?;
    let target = if folder_path.is_empty() {
        root.clone()
    } else {
        let rel = PathBuf::from(&folder_path);
        if rel.is_absolute() {
            return Err("folder path must be relative".to_string());
        }
        if rel.components().any(|c| {
            matches!(
                c,
                Component::ParentDir | Component::CurDir | Component::Prefix(_) | Component::RootDir
            )
        }) {
            return Err("folder path contains invalid segments".to_string());
        }
        let abs = root.join(&rel);
        let abs = abs.canonicalize().unwrap_or(abs);
        let base = root.canonicalize().unwrap_or_else(|_| root.clone());
        if !abs.starts_with(&base) {
            return Err("folder path escapes vault".to_string());
        }
        abs
    };

    if !target.is_dir() {
        return Err("not a directory".to_string());
    }

    let mut notes = Vec::new();
    let mut subfolders = Vec::new();

    let entries = std::fs::read_dir(&target).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();

        if file_name.starts_with('.') {
            continue;
        }

        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let entry_path = entry.path();

        if file_type.is_file() && file_name.ends_with(".md") {
            let rel = if folder_path.is_empty() {
                file_name.clone()
            } else {
                format!("{}/{}", folder_path, file_name)
            };

            let title = extract_title(&entry_path);
            let (mtime_ms, size_bytes) = file_meta(&entry_path)?;

            notes.push(NoteMeta {
                id: rel.clone(),
                path: rel,
                title,
                mtime_ms,
                size_bytes,
            });
        } else if file_type.is_dir() {
            let rel = if folder_path.is_empty() {
                file_name
            } else {
                format!("{}/{}", folder_path, file_name)
            };
            subfolders.push(rel);
        }
    }

    notes.sort_by(|a, b| a.path.cmp(&b.path));
    subfolders.sort();

    Ok(FolderContents { notes, subfolders })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk_temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("jotter-test-{}", storage::now_ms()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn safe_note_abs_rejects_traversal() {
        let root = mk_temp_dir();
        assert!(safe_note_abs(&root, "../x.md").is_err());
        assert!(safe_note_abs(&root, "a/../x.md").is_err());
        assert!(safe_note_abs(&root, "/abs/x.md").is_err());
        assert!(safe_note_abs(&root, "a/b.md").is_ok());
        let _ = std::fs::remove_dir_all(&root);
    }
}

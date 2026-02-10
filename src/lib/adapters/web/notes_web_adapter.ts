import type { NotesPort, FolderStats } from "$lib/ports/notes_port";
import {
  as_markdown_text,
  as_note_path,
  type MarkdownText,
  type NoteId,
  type NotePath,
  type VaultId,
} from "$lib/types/ids";
import type { NoteDoc, NoteMeta } from "$lib/types/note";
import type { FolderContents } from "$lib/types/filetree";
import { is_excluded_folder } from "$lib/constants/special_folders";
import { extract_note_title } from "$lib/domain/extract_note_title";
import { get_vault } from "./storage";

function is_not_found_error(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "NotFoundError") return true;
  return error.message.toLowerCase().includes("not found");
}

function compare_names_case_insensitive(a: string, b: string): number {
  const lower_a = a.toLowerCase();
  const lower_b = b.toLowerCase();
  if (lower_a < lower_b) return -1;
  if (lower_a > lower_b) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

async function get_vault_handle(
  vault_id: VaultId,
): Promise<FileSystemDirectoryHandle> {
  const record = await get_vault(vault_id);
  if (!record) {
    throw new Error(`Vault not found: ${vault_id}`);
  }

  if (
    "requestPermission" in record.handle &&
    typeof record.handle.requestPermission === "function"
  ) {
    try {
      await (
        record.handle as {
          requestPermission: (opts: {
            mode: string;
          }) => Promise<PermissionState>;
        }
      ).requestPermission({ mode: "readwrite" });
    } catch (e) {
      throw new Error(
        `Permission denied for vault: ${vault_id}. ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return record.handle;
}

async function resolve_note_path(
  root: FileSystemDirectoryHandle,
  note_path: NotePath,
): Promise<{
  handle: FileSystemHandle;
  parent: FileSystemDirectoryHandle;
  name: string;
}> {
  const parts = note_path.split("/").filter(Boolean);
  let current = root;
  let name = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    const is_last = i === parts.length - 1;

    if (is_last) {
      name = part.endsWith(".md") ? part : `${part}.md`;
      const handle = await current.getFileHandle(name, { create: false });
      return { handle, parent: current, name };
    } else {
      current = await current.getDirectoryHandle(part, { create: false });
    }
  }

  throw new Error(`Invalid note path: ${note_path}`);
}

function normalize_note_path(path: NotePath): {
  parts: string[];
  leaf: string;
  full_path: NotePath;
} {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`Invalid note path: ${path}`);
  }

  const last_index = parts.length - 1;
  const last_part = parts[last_index];
  if (!last_part) {
    throw new Error(`Invalid note path: ${path}`);
  }

  const leaf = last_part.endsWith(".md") ? last_part : `${last_part}.md`;
  parts[last_index] = leaf;
  return { parts, leaf, full_path: as_note_path(parts.join("/")) };
}

function create_temp_note_path(path: NotePath): NotePath {
  const normalized = normalize_note_path(path);
  const parts = [...normalized.parts];
  const stem = normalized.leaf.replace(/\.md$/, "");
  const suffix = `${String(Date.now())}-${Math.random().toString(36).slice(2, 10)}`;
  parts[parts.length - 1] = `${stem}.rename.${suffix}.tmp.md`;
  return as_note_path(parts.join("/"));
}

async function move_note_between_paths(
  root: FileSystemDirectoryHandle,
  from: NotePath,
  to: NotePath,
): Promise<void> {
  const from_resolved = await resolve_note_path(root, from);
  const from_file_handle = from_resolved.handle as FileSystemFileHandle;
  const from_file = await from_file_handle.getFile();
  const from_content = new Uint8Array(await from_file.arrayBuffer());

  const to_normalized = normalize_note_path(to);
  let to_parent = root;
  for (let i = 0; i < to_normalized.parts.length - 1; i++) {
    const part = to_normalized.parts[i];
    if (!part) continue;
    to_parent = await to_parent.getDirectoryHandle(part, { create: true });
  }

  const to_file_handle = await to_parent.getFileHandle(to_normalized.leaf, {
    create: true,
  });
  const writable = await to_file_handle.createWritable();
  await writable.write(from_content);
  await writable.close();
  await from_resolved.parent.removeEntry(from_resolved.name);
}

async function list_markdown_files(
  dir: FileSystemDirectoryHandle,
  prefix: string = "",
): Promise<NoteMeta[]> {
  const notes: NoteMeta[] = [];

  for await (const handle of dir.values()) {
    if (is_excluded_folder(handle.name)) {
      continue;
    }

    if (handle.kind === "file" && handle.name.endsWith(".md")) {
      const file_handle = handle as FileSystemFileHandle;
      const file = await file_handle.getFile();
      const full_path = prefix ? `${prefix}/${handle.name}` : handle.name;
      const note_path = as_note_path(full_path);
      const title_probe = await file.slice(0, 8192).text();

      notes.push({
        id: note_path,
        path: note_path,
        name: handle.name.replace(/\.md$/, ""),
        title: extract_note_title(title_probe, note_path),
        mtime_ms: file.lastModified,
        size_bytes: file.size,
      });
    } else if (handle.kind === "directory") {
      const sub_prefix = prefix ? `${prefix}/${handle.name}` : handle.name;
      const sub_notes = await list_markdown_files(
        handle as FileSystemDirectoryHandle,
        sub_prefix,
      );
      notes.push(...sub_notes);
    }
  }

  notes.sort((a, b) => compare_names_case_insensitive(a.path, b.path));
  return notes;
}

async function list_directory_paths(
  dir: FileSystemDirectoryHandle,
  prefix: string = "",
): Promise<string[]> {
  const paths: string[] = [];

  for await (const handle of dir.values()) {
    if (is_excluded_folder(handle.name)) {
      continue;
    }

    if (handle.kind === "directory") {
      const rel_path = prefix ? `${prefix}/${handle.name}` : handle.name;
      paths.push(rel_path);
      const sub = await list_directory_paths(
        handle as FileSystemDirectoryHandle,
        rel_path,
      );
      paths.push(...sub);
    }
  }

  return paths.sort((a, b) => a.localeCompare(b));
}

export function create_notes_web_adapter(): NotesPort {
  return {
    async list_notes(vault_id: VaultId): Promise<NoteMeta[]> {
      const handle = await get_vault_handle(vault_id);
      return list_markdown_files(handle);
    },

    async list_folders(vault_id: VaultId): Promise<string[]> {
      const handle = await get_vault_handle(vault_id);
      return list_directory_paths(handle);
    },

    async read_note(vault_id: VaultId, note_id: NoteId): Promise<NoteDoc> {
      const root = await get_vault_handle(vault_id);
      const { handle, name } = await resolve_note_path(root, note_id);
      const file_handle = handle as FileSystemFileHandle;
      const file = await file_handle.getFile();
      const markdown = as_markdown_text(await file.text());

      const parts = note_id.split("/").filter(Boolean);
      const last_part = parts[parts.length - 1] || "";
      const full_name = last_part.endsWith(".md")
        ? last_part
        : `${last_part}.md`;
      parts[parts.length - 1] = full_name;
      const note_path = as_note_path(parts.join("/"));

      const meta: NoteMeta = {
        id: note_path,
        path: note_path,
        name: name.replace(/\.md$/, ""),
        title: extract_note_title(markdown, note_path),
        mtime_ms: file.lastModified,
        size_bytes: file.size,
      };

      return { meta, markdown };
    },

    async write_note(
      vault_id: VaultId,
      note_id: NoteId,
      markdown: MarkdownText,
    ): Promise<void> {
      const root = await get_vault_handle(vault_id);
      const { handle } = await resolve_note_path(root, note_id);
      const file_handle = handle as FileSystemFileHandle;

      const writable = await file_handle.createWritable();
      await writable.write(markdown);
      await writable.close();
    },

    async create_note(
      vault_id: VaultId,
      note_path: NotePath,
      initial_markdown: MarkdownText,
    ): Promise<NoteMeta> {
      const root = await get_vault_handle(vault_id);
      const parts = note_path.split("/").filter(Boolean);
      let current = root;
      let file_name = "";

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        const is_last = i === parts.length - 1;

        if (is_last) {
          file_name = part.endsWith(".md") ? part : `${part}.md`;
          try {
            await current.getFileHandle(file_name, { create: false });
            throw new Error("note already exists");
          } catch (error) {
            if (!is_not_found_error(error)) {
              throw error;
            }
          }
          const file_handle = await current.getFileHandle(file_name, {
            create: true,
          });
          const writable = await file_handle.createWritable();
          await writable.write(initial_markdown);
          await writable.close();

          const file = await file_handle.getFile();
          const parts_with_md = [...parts];
          parts_with_md[parts_with_md.length - 1] = file_name;
          const full_path = as_note_path(parts_with_md.join("/"));
          return {
            id: full_path,
            path: full_path,
            name: file_name.replace(/\.md$/, ""),
            title: extract_note_title(String(initial_markdown), full_path),
            mtime_ms: file.lastModified,
            size_bytes: file.size,
          };
        } else {
          current = await current.getDirectoryHandle(part, { create: true });
        }
      }

      throw new Error(`Invalid note path: ${note_path}`);
    },

    async create_folder(
      vault_id: VaultId,
      parent_path: string,
      folder_name: string,
    ): Promise<void> {
      if (
        folder_name.includes("/") ||
        folder_name.includes("\\") ||
        folder_name.startsWith(".")
      ) {
        throw new Error("invalid folder name");
      }
      const root = await get_vault_handle(vault_id);
      let current = root;
      const parts = parent_path ? parent_path.split("/").filter(Boolean) : [];
      for (const part of parts) {
        current = await current.getDirectoryHandle(part, { create: false });
      }
      await current.getDirectoryHandle(folder_name, { create: true });
    },

    async rename_note(
      vault_id: VaultId,
      from: NotePath,
      to: NotePath,
    ): Promise<void> {
      const root = await get_vault_handle(vault_id);
      const from_normalized = normalize_note_path(from);
      const to_normalized = normalize_note_path(to);
      if (from_normalized.full_path === to_normalized.full_path) return;

      const temp_path = create_temp_note_path(from_normalized.full_path);
      await move_note_between_paths(root, from_normalized.full_path, temp_path);

      try {
        await move_note_between_paths(root, temp_path, to_normalized.full_path);
      } catch (error) {
        await move_note_between_paths(
          root,
          temp_path,
          from_normalized.full_path,
        ).catch(() => undefined);
        throw error;
      }
    },

    async delete_note(vault_id: VaultId, note_id: NoteId): Promise<void> {
      const root = await get_vault_handle(vault_id);
      const { parent, name } = await resolve_note_path(root, note_id);
      await parent.removeEntry(name);
    },

    async list_folder_contents(
      vault_id: VaultId,
      folder_path: string,
      offset: number,
      limit: number,
    ): Promise<FolderContents> {
      const root = await get_vault_handle(vault_id);
      let target = root;

      if (folder_path) {
        const parts = folder_path.split("/").filter(Boolean);
        for (const part of parts) {
          target = await target.getDirectoryHandle(part, { create: false });
        }
      }

      const entries: Array<{ name: string; is_dir: boolean }> = [];
      for await (const handle of target.values()) {
        if (is_excluded_folder(handle.name)) {
          continue;
        }

        if (handle.kind === "directory") {
          entries.push({ name: handle.name, is_dir: true });
          continue;
        }

        if (handle.name.endsWith(".md")) {
          entries.push({ name: handle.name, is_dir: false });
        }
      }

      entries.sort((a, b) => {
        if (a.is_dir !== b.is_dir) {
          return a.is_dir ? -1 : 1;
        }
        return compare_names_case_insensitive(a.name, b.name);
      });

      const total_count = entries.length;
      const start = Math.min(offset, total_count);
      const end = Math.min(start + Math.max(limit, 0), total_count);
      const page = entries.slice(start, end);

      const notes: NoteMeta[] = [];
      const subfolders: string[] = [];

      for (const entry of page) {
        if (entry.is_dir) {
          const subfolder_path = folder_path
            ? `${folder_path}/${entry.name}`
            : entry.name;
          subfolders.push(subfolder_path);
          continue;
        }

        const full_path = folder_path
          ? `${folder_path}/${entry.name}`
          : entry.name;
        const note_path = as_note_path(full_path);
        notes.push({
          id: note_path,
          path: note_path,
          name: entry.name.replace(/\.md$/, ""),
          title: entry.name.replace(/\.md$/, ""),
          mtime_ms: 0,
          size_bytes: 0,
        });
      }

      return {
        notes,
        subfolders,
        total_count,
        has_more: end < total_count,
      };
    },

    async rename_folder(
      vault_id: VaultId,
      from_path: string,
      to_path: string,
    ): Promise<void> {
      if (from_path === to_path) return;
      if (!from_path || !to_path) {
        throw new Error("cannot rename vault root");
      }

      const root = await get_vault_handle(vault_id);

      const from_parts = from_path.split("/").filter(Boolean);
      const to_parts = to_path.split("/").filter(Boolean);

      let from_parent = root;
      for (let i = 0; i < from_parts.length - 1; i++) {
        const part = from_parts[i];
        if (!part)
          throw new Error(`Invalid from path part at index ${String(i)}`);
        from_parent = await from_parent.getDirectoryHandle(part, {
          create: false,
        });
      }
      const from_name = from_parts[from_parts.length - 1];
      if (!from_name) throw new Error("Invalid from path: missing name");
      const from_handle = await from_parent.getDirectoryHandle(from_name, {
        create: false,
      });

      let to_parent = root;
      for (let i = 0; i < to_parts.length - 1; i++) {
        const part = to_parts[i];
        if (!part)
          throw new Error(`Invalid to path part at index ${String(i)}`);
        to_parent = await to_parent.getDirectoryHandle(part, { create: true });
      }
      const to_name = to_parts[to_parts.length - 1];
      if (!to_name) throw new Error("Invalid to path: missing name");
      try {
        const existing_dir = await to_parent.getDirectoryHandle(to_name, {
          create: false,
        });
        if (
          "isSameEntry" in from_handle &&
          typeof from_handle.isSameEntry === "function"
        ) {
          const same_entry = await from_handle.isSameEntry(existing_dir);
          if (same_entry) return;
        }
        throw new Error("destination already exists");
      } catch (error) {
        if (!is_not_found_error(error)) {
          throw error;
        }
      }
      try {
        await to_parent.getFileHandle(to_name, { create: false });
        throw new Error("destination already exists");
      } catch (error) {
        if (!is_not_found_error(error)) {
          throw error;
        }
      }
      const to_handle = await to_parent.getDirectoryHandle(to_name, {
        create: true,
      });

      async function copy_dir_contents(
        source: FileSystemDirectoryHandle,
        target: FileSystemDirectoryHandle,
      ) {
        for await (const entry of source.values()) {
          if (entry.kind === "file") {
            const file_handle = entry as FileSystemFileHandle;
            const file = await file_handle.getFile();
            const target_file = await target.getFileHandle(entry.name, {
              create: true,
            });
            const writable = await target_file.createWritable();
            await writable.write(new Uint8Array(await file.arrayBuffer()));
            await writable.close();
          } else {
            const sub_target = await target.getDirectoryHandle(entry.name, {
              create: true,
            });
            await copy_dir_contents(
              entry as FileSystemDirectoryHandle,
              sub_target,
            );
          }
        }
      }

      await copy_dir_contents(from_handle, to_handle);
      await from_parent.removeEntry(from_name, { recursive: true });
    },

    async delete_folder(
      vault_id: VaultId,
      folder_path: string,
    ): Promise<{ deleted_notes: NotePath[]; deleted_folders: string[] }> {
      const root = await get_vault_handle(vault_id);

      const parts = folder_path.split("/").filter(Boolean);
      let parent = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!part)
          throw new Error(`Invalid folder path part at index ${String(i)}`);
        parent = await parent.getDirectoryHandle(part, { create: false });
      }
      const folder_name = parts[parts.length - 1];
      if (!folder_name) throw new Error("Invalid folder path: missing name");

      const deleted_notes: NotePath[] = [];
      const deleted_folders: string[] = [];

      async function collect_items(
        dir: FileSystemDirectoryHandle,
        prefix: string,
      ) {
        for await (const entry of dir.values()) {
          const entry_path = prefix ? `${prefix}/${entry.name}` : entry.name;

          if (entry.kind === "file" && entry.name.endsWith(".md")) {
            deleted_notes.push(as_note_path(entry_path));
          } else if (entry.kind === "directory") {
            deleted_folders.push(entry_path);
            await collect_items(entry as FileSystemDirectoryHandle, entry_path);
          }
        }
      }

      const folder_handle = await parent.getDirectoryHandle(folder_name, {
        create: false,
      });
      await collect_items(folder_handle, folder_path);

      await parent.removeEntry(folder_name, { recursive: true });

      return { deleted_notes, deleted_folders };
    },

    async get_folder_stats(
      vault_id: VaultId,
      folder_path: string,
    ): Promise<FolderStats> {
      const root = await get_vault_handle(vault_id);

      const parts = folder_path.split("/").filter(Boolean);
      let target = root;
      for (const part of parts) {
        target = await target.getDirectoryHandle(part, { create: false });
      }

      let note_count = 0;
      let folder_count = 0;

      async function count_items(dir: FileSystemDirectoryHandle) {
        for await (const entry of dir.values()) {
          if (is_excluded_folder(entry.name)) {
            continue;
          }

          if (entry.kind === "file" && entry.name.endsWith(".md")) {
            note_count++;
          } else if (entry.kind === "directory") {
            folder_count++;
            await count_items(entry as FileSystemDirectoryHandle);
          }
        }
      }

      await count_items(target);
      return { note_count, folder_count };
    },
  };
}

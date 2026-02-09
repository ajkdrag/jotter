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

const TEST_FILES_BASE = "/test/files";
const TEST_FILES_INDEX = "/test/files/index.json";

const FALLBACK_TEST_NOTES = new Map<
  NotePath,
  { markdown: MarkdownText; mtime_ms: number }
>([
  [
    as_note_path("welcome.md"),
    {
      markdown: as_markdown_text("# Welcome\n\nWelcome to your notes."),
      mtime_ms: Date.now(),
    },
  ],
  [
    as_note_path("getting-started.md"),
    {
      markdown: as_markdown_text("# Getting Started\n\nStart taking notes!"),
      mtime_ms: Date.now(),
    },
  ],
]);

function resolve_test_url(path: string): string | null {
  if (typeof window !== "undefined" && window.location.origin) {
    return new URL(path, window.location.origin).toString();
  }

  return null;
}

async function discover_test_files(): Promise<string[]> {
  const url = resolve_test_url(TEST_FILES_INDEX);
  if (!url || typeof fetch === "undefined") {
    return ["welcome.md", "getting-started.md"];
  }

  try {
    const response = await fetch(url);
    if (response.ok) {
      const files = (await response.json()) as string[];
      return files;
    }
  } catch (error) {
    console.warn("Failed to discover test files, using fallback list:", error);
  }
  return ["welcome.md", "getting-started.md"];
}

async function load_base_files(): Promise<
  Map<NotePath, { markdown: MarkdownText; mtime_ms: number }>
> {
  const base_url = resolve_test_url(TEST_FILES_BASE);
  if (!base_url || typeof fetch === "undefined") {
    return new Map(FALLBACK_TEST_NOTES);
  }

  const notes = new Map<
    NotePath,
    { markdown: MarkdownText; mtime_ms: number }
  >();
  const test_files = await discover_test_files();

  for (const file_name of test_files) {
    try {
      const response = await fetch(`${base_url}/${file_name}`, {
        cache: "no-store",
      });
      if (response.ok) {
        const content = await response.text();
        const note_path = as_note_path(file_name);
        notes.set(note_path, {
          markdown: as_markdown_text(content),
          mtime_ms: Date.now(),
        });
      }
    } catch (error) {
      console.warn(`Failed to load test file ${file_name}:`, error);
    }
  }

  if (notes.size === 0) {
    return new Map(FALLBACK_TEST_NOTES);
  }

  return notes;
}

export function create_test_notes_adapter(): NotesPort {
  const created_folders = new Set<string>();
  const user_notes = new Map<
    NotePath,
    { markdown: MarkdownText; mtime_ms: number }
  >();

  return {
    async list_notes(_vault_id: VaultId): Promise<NoteMeta[]> {
      const notes = await load_base_files();
      for (const [note_path, data] of user_notes.entries()) {
        notes.set(note_path, data);
      }
      const result: NoteMeta[] = [];

      for (const [note_path, data] of notes.entries()) {
        const parts = note_path.split("/").filter(Boolean);
        const last_part = parts[parts.length - 1] || "";
        const title = last_part.replace(/\.md$/, "");

        result.push({
          id: note_path,
          path: note_path,
          title,
          mtime_ms: data.mtime_ms,
          size_bytes: new Blob([data.markdown]).size,
        });
      }

      return result.sort((a, b) => a.path.localeCompare(b.path));
    },

    async list_folders(_vault_id: VaultId): Promise<string[]> {
      const notes = await load_base_files();
      for (const [note_path, data] of user_notes.entries()) {
        notes.set(note_path, data);
      }
      const dirs = new Set<string>();
      for (const note_path of notes.keys()) {
        const parts = note_path.split("/").filter(Boolean);
        for (let i = 1; i < parts.length; i++) {
          dirs.add(parts.slice(0, i).join("/"));
        }
      }
      for (const folder of created_folders) {
        dirs.add(folder);
      }
      return Array.from(dirs).sort((a, b) => a.localeCompare(b));
    },

    async read_note(_vault_id: VaultId, note_id: NoteId): Promise<NoteDoc> {
      const notes = await load_base_files();
      const note_path = as_note_path(note_id);
      const note_data = user_notes.get(note_path) ?? notes.get(note_path);

      if (!note_data) {
        throw new Error(`Note not found: ${note_id}`);
      }

      const parts = note_path.split("/").filter(Boolean);
      const last_part = parts[parts.length - 1] || "";
      const title = last_part.replace(/\.md$/, "");

      const meta: NoteMeta = {
        id: note_path,
        path: note_path,
        title,
        mtime_ms: note_data.mtime_ms,
        size_bytes: new Blob([note_data.markdown]).size,
      };

      return { meta, markdown: as_markdown_text(note_data.markdown) };
    },

    write_note(
      _vault_id: VaultId,
      note_id: NoteId,
      markdown: MarkdownText,
    ): Promise<void> {
      const note_path = as_note_path(note_id);
      user_notes.set(note_path, { markdown, mtime_ms: Date.now() });
      return Promise.resolve();
    },

    create_note(
      _vault_id: VaultId,
      note_path: NotePath,
      initial_markdown: MarkdownText,
    ): Promise<NoteMeta> {
      const full_path = note_path.endsWith(".md")
        ? as_note_path(note_path)
        : as_note_path(`${note_path}.md`);
      user_notes.set(full_path, {
        markdown: initial_markdown,
        mtime_ms: Date.now(),
      });
      const parts = full_path.split("/").filter(Boolean);
      const last_part = parts[parts.length - 1] || "";
      const title = last_part.replace(/\.md$/, "");

      return Promise.resolve({
        id: full_path,
        path: full_path,
        title,
        mtime_ms: Date.now(),
        size_bytes: new Blob([initial_markdown]).size,
      });
    },

    create_folder(
      _vault_id: VaultId,
      parent_path: string,
      folder_name: string,
    ): Promise<void> {
      const full_path = parent_path
        ? `${parent_path}/${folder_name}`
        : folder_name;
      created_folders.add(full_path);
      return Promise.resolve();
    },

    async rename_note(
      _vault_id: VaultId,
      _from: NotePath,
      _to: NotePath,
    ): Promise<void> {},

    async delete_note(_vault_id: VaultId, _note_id: NoteId): Promise<void> {},

    async list_folder_contents(
      _vault_id: VaultId,
      folder_path: string,
      offset: number,
      limit: number,
    ): Promise<FolderContents> {
      const notes = await load_base_files();
      for (const [note_path, data] of user_notes.entries()) {
        notes.set(note_path, data);
      }
      const result_notes: NoteMeta[] = [];
      const subfolders = new Set<string>();

      const prefix = folder_path ? folder_path + "/" : "";

      for (const [note_path, data] of notes.entries()) {
        if (!note_path.startsWith(prefix) && prefix !== "") continue;

        const remaining = prefix ? note_path.slice(prefix.length) : note_path;
        const slash_index = remaining.indexOf("/");

        if (slash_index === -1) {
          const parts = note_path.split("/").filter(Boolean);
          const last_part = parts[parts.length - 1] || "";
          const title = last_part.replace(/\.md$/, "");

          result_notes.push({
            id: note_path,
            path: note_path,
            title,
            mtime_ms: data.mtime_ms,
            size_bytes: new Blob([data.markdown]).size,
          });
        } else {
          const subfolder_name = remaining.slice(0, slash_index);
          const subfolder_path = folder_path
            ? `${folder_path}/${subfolder_name}`
            : subfolder_name;
          subfolders.add(subfolder_path);
        }
      }

      for (const folder of created_folders) {
        const is_direct_child = folder_path
          ? folder.startsWith(folder_path + "/") &&
            !folder.slice(folder_path.length + 1).includes("/")
          : !folder.includes("/");

        if (is_direct_child) {
          subfolders.add(folder);
        }
      }

      const sorted_notes = result_notes.sort((a, b) =>
        a.path.localeCompare(b.path),
      );
      const sorted_subfolders = Array.from(subfolders).sort((a, b) =>
        a.localeCompare(b),
      );
      const combined = [
        ...sorted_subfolders.map((path) => ({ kind: "folder" as const, path })),
        ...sorted_notes.map((note) => ({ kind: "note" as const, note })),
      ];

      const total_count = combined.length;
      const start = Math.min(offset, total_count);
      const end = Math.min(start + Math.max(limit, 0), total_count);
      const page = combined.slice(start, end);

      const paged_notes: NoteMeta[] = [];
      const paged_subfolders: string[] = [];
      for (const entry of page) {
        if (entry.kind === "folder") {
          paged_subfolders.push(entry.path);
        } else {
          paged_notes.push(entry.note);
        }
      }

      return {
        notes: paged_notes,
        subfolders: paged_subfolders,
        total_count,
        has_more: end < total_count,
      };
    },

    rename_folder(
      _vault_id: VaultId,
      from_path: string,
      to_path: string,
    ): Promise<void> {
      if (created_folders.has(from_path)) {
        created_folders.delete(from_path);
        created_folders.add(to_path);
      }
      return Promise.resolve();
    },

    async delete_folder(
      _vault_id: VaultId,
      folder_path: string,
    ): Promise<{ deleted_notes: NotePath[]; deleted_folders: string[] }> {
      const deleted_notes: NotePath[] = [];
      const deleted_folders: string[] = [];

      const notes = await load_base_files();
      const prefix = folder_path + "/";

      for (const note_path of notes.keys()) {
        if (note_path.startsWith(prefix)) {
          deleted_notes.push(note_path);
        }
      }

      for (const folder of created_folders) {
        if (folder === folder_path || folder.startsWith(prefix)) {
          deleted_folders.push(folder);
        }
      }

      for (const folder of deleted_folders) {
        created_folders.delete(folder);
      }

      return { deleted_notes, deleted_folders };
    },

    async get_folder_stats(
      _vault_id: VaultId,
      folder_path: string,
    ): Promise<FolderStats> {
      const notes = await load_base_files();
      const prefix = folder_path + "/";

      let note_count = 0;
      let folder_count = 0;

      for (const note_path of notes.keys()) {
        if (note_path.startsWith(prefix)) {
          note_count++;
        }
      }

      for (const folder of created_folders) {
        if (folder.startsWith(prefix)) {
          folder_count++;
        }
      }

      return { note_count, folder_count };
    },
  };
}

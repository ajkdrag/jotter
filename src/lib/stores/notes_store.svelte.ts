import type { NoteId, NotePath } from "$lib/types/ids";
import type { NoteMeta } from "$lib/types/note";
import type { FolderContents } from "$lib/types/filetree";

function normalized_note_path(path: NotePath): NotePath {
  if (path.endsWith(".md")) return path;
  return `${path}.md` as NotePath;
}

const RECENT_NOTES_LIMIT = 10;

function normalize_recent_notes(notes: NoteMeta[]): NoteMeta[] {
  const seen = new Set<NoteId>();
  const normalized: NoteMeta[] = [];
  for (const note of notes) {
    if (seen.has(note.id)) continue;
    seen.add(note.id);
    normalized.push(note);
    if (normalized.length >= RECENT_NOTES_LIMIT) break;
  }
  return normalized;
}

export class NotesStore {
  notes = $state<NoteMeta[]>([]);
  folder_paths = $state<string[]>([]);
  recent_notes = $state<NoteMeta[]>([]);

  set_notes(notes: NoteMeta[]) {
    this.notes = [...notes].sort((a, b) => a.path.localeCompare(b.path));
  }

  add_note(note: NoteMeta) {
    const existing = this.notes.find((entry) => entry.id === note.id);
    if (existing) return;
    this.notes = [...this.notes, note].sort((a, b) =>
      a.path.localeCompare(b.path),
    );
  }

  remove_note(note_id: NoteId) {
    this.notes = this.notes.filter((note) => note.id !== note_id);
  }

  rename_note(old_path: NotePath, new_path: NotePath) {
    const normalized_new = normalized_note_path(new_path);
    const parts = normalized_new.split("/");
    const leaf = parts[parts.length - 1] ?? "";
    const name = leaf.slice(0, -3);

    this.notes = this.notes
      .map((note) => {
        if (note.path !== old_path) return note;
        return {
          ...note,
          id: normalized_new,
          path: normalized_new,
          name,
          title: name,
        };
      })
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  set_recent_notes(notes: NoteMeta[]) {
    this.recent_notes = normalize_recent_notes(notes);
  }

  add_recent_note(note: NoteMeta) {
    const filtered = this.recent_notes.filter((item) => item.id !== note.id);
    this.recent_notes = normalize_recent_notes([note, ...filtered]);
  }

  remove_recent_note(note_id: NoteId) {
    this.recent_notes = this.recent_notes.filter((note) => note.id !== note_id);
  }

  rename_recent_note(old_id: NoteId, next_note: NoteMeta) {
    const index = this.recent_notes.findIndex((note) => note.id === old_id);
    if (index < 0) return;
    const filtered = this.recent_notes.filter(
      (note) => note.id !== old_id && note.id !== next_note.id,
    );
    filtered.splice(index, 0, next_note);
    this.recent_notes = normalize_recent_notes(filtered);
  }

  update_recent_note_path_prefix(old_prefix: string, new_prefix: string) {
    const updated = this.recent_notes.map((note) => {
      if (!note.path.startsWith(old_prefix)) {
        return note;
      }
      const next_path =
        `${new_prefix}${note.path.slice(old_prefix.length)}` as NotePath;
      return {
        ...note,
        id: next_path,
        path: next_path,
      };
    });
    this.recent_notes = normalize_recent_notes(updated);
  }

  set_folder_paths(folder_paths: string[]) {
    this.folder_paths = [...folder_paths].sort((a, b) => a.localeCompare(b));
  }

  add_folder_path(path: string) {
    if (this.folder_paths.includes(path)) return;
    this.folder_paths = [...this.folder_paths, path].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  remove_folder(path: string) {
    const prefix = `${path}/`;
    this.notes = this.notes.filter((note) => !note.path.startsWith(prefix));
    this.folder_paths = this.folder_paths.filter(
      (folder_path) => folder_path !== path && !folder_path.startsWith(prefix),
    );
  }

  rename_folder(old_path: string, new_path: string) {
    const old_prefix = `${old_path}/`;
    const new_prefix = `${new_path}/`;

    this.notes = this.notes.map((note) => {
      if (!note.path.startsWith(old_prefix)) return note;
      const updated_path =
        `${new_prefix}${note.path.slice(old_prefix.length)}` as NotePath;
      return {
        ...note,
        id: updated_path,
        path: updated_path,
      };
    });

    this.folder_paths = this.folder_paths.map((folder_path) => {
      if (folder_path === old_path) return new_path;
      if (folder_path.startsWith(old_prefix)) {
        return `${new_prefix}${folder_path.slice(old_prefix.length)}`;
      }
      return folder_path;
    });
  }

  merge_folder_contents(folder_path: string, contents: FolderContents) {
    const prefix = folder_path ? `${folder_path}/` : "";

    const fresh_child_names = new Set<string>();
    for (const subfolder of contents.subfolders) {
      const name = subfolder.slice(prefix.length).split("/")[0] ?? "";
      fresh_child_names.add(name);
    }
    for (const note of contents.notes) {
      const name = note.path.slice(prefix.length).split("/")[0] ?? "";
      fresh_child_names.add(name);
    }

    const is_stale = (path: string): boolean => {
      if (folder_path !== "" && !path.startsWith(prefix)) return false;
      const top = path.slice(prefix.length).split("/")[0] ?? "";
      return !fresh_child_names.has(top);
    };

    const retained_notes = this.notes.filter((note) => !is_stale(note.path));
    for (const note of contents.notes) {
      const index = retained_notes.findIndex((item) => item.id === note.id);
      if (index >= 0) {
        retained_notes[index] = note;
      } else {
        retained_notes.push(note);
      }
    }
    this.notes = retained_notes.sort((a, b) => a.path.localeCompare(b.path));

    const retained_folders = this.folder_paths.filter(
      (path) => !is_stale(path),
    );
    for (const subfolder of contents.subfolders) {
      if (!retained_folders.includes(subfolder)) {
        retained_folders.push(subfolder);
      }
    }
    if (folder_path && !retained_folders.includes(folder_path)) {
      retained_folders.push(folder_path);
    }
    this.folder_paths = retained_folders.sort((a, b) => a.localeCompare(b));
  }

  append_folder_page(_folder_path: string, contents: FolderContents) {
    const retained_notes = [...this.notes];
    const note_ids = new Set(retained_notes.map((note) => note.id));
    for (const note of contents.notes) {
      if (note_ids.has(note.id)) {
        continue;
      }
      retained_notes.push(note);
      note_ids.add(note.id);
    }
    this.notes = retained_notes;

    const retained_folders = [...this.folder_paths];
    const folder_set = new Set(retained_folders);
    for (const folder_path of contents.subfolders) {
      if (folder_set.has(folder_path)) {
        continue;
      }
      retained_folders.push(folder_path);
      folder_set.add(folder_path);
    }
    this.folder_paths = retained_folders;
  }

  reset() {
    this.notes = [];
    this.folder_paths = [];
    this.recent_notes = [];
  }
}

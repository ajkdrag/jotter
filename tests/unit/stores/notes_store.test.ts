import { describe, expect, it } from "vitest";
import { NotesStore } from "$lib/stores/notes_store.svelte";
import type { NoteMeta } from "$lib/types/note";
import type { NoteId, NotePath } from "$lib/types/ids";
import type { FolderContents } from "$lib/types/filetree";

function note(path: string): NoteMeta {
  return {
    id: path as NoteId,
    path: path as NotePath,
    name: path.split("/").pop()?.replace(".md", "") ?? "",
    title: path.split("/").pop()?.replace(".md", "") ?? "",
    mtime_ms: 0,
    size_bytes: 0,
  };
}

function folder_contents(
  notes: NoteMeta[],
  subfolders: string[],
): FolderContents {
  return {
    notes,
    subfolders,
    total_count: notes.length + subfolders.length,
    has_more: false,
  };
}

describe("NotesStore.merge_folder_contents", () => {
  it("adds notes and folders on first load", () => {
    const store = new NotesStore();

    store.merge_folder_contents(
      "",
      folder_contents([note("readme.md")], ["docs", "tests"]),
    );

    expect(store.notes.map((n) => n.path)).toEqual(["readme.md"]);
    expect(store.folder_paths).toEqual(["docs", "tests"]);
  });

  it("removes stale root-level folders on refresh", () => {
    const store = new NotesStore();

    store.merge_folder_contents("", folder_contents([], ["old_folder"]));
    expect(store.folder_paths).toEqual(["old_folder"]);

    store.merge_folder_contents("", folder_contents([], ["new_folder"]));
    expect(store.folder_paths).toEqual(["new_folder"]);
  });

  it("removes stale descendants when parent folder disappears", () => {
    const store = new NotesStore();

    store.merge_folder_contents("", folder_contents([], ["sss"]));
    store.merge_folder_contents(
      "sss",
      folder_contents([note("sss/note.md")], ["sss/deep"]),
    );

    expect(store.folder_paths).toEqual(["sss", "sss/deep"]);
    expect(store.notes.map((n) => n.path)).toEqual(["sss/note.md"]);

    store.merge_folder_contents("", folder_contents([], ["ddd"]));

    expect(store.folder_paths).toEqual(["ddd"]);
    expect(store.notes).toEqual([]);
  });

  it("preserves entries from unrelated folders", () => {
    const store = new NotesStore();

    store.merge_folder_contents(
      "",
      folder_contents([note("root.md")], ["alpha", "beta"]),
    );
    store.merge_folder_contents(
      "alpha",
      folder_contents([note("alpha/note.md")], []),
    );

    store.merge_folder_contents(
      "",
      folder_contents([note("root.md")], ["alpha", "gamma"]),
    );

    expect(store.folder_paths).toEqual(["alpha", "gamma"]);
    expect(store.notes.map((n) => n.path)).toEqual([
      "alpha/note.md",
      "root.md",
    ]);
  });

  it("updates existing notes with fresh metadata", () => {
    const store = new NotesStore();

    store.merge_folder_contents(
      "",
      folder_contents([{ ...note("readme.md"), mtime_ms: 100 }], []),
    );

    store.merge_folder_contents(
      "",
      folder_contents([{ ...note("readme.md"), mtime_ms: 200 }], []),
    );

    expect(store.notes).toHaveLength(1);
    expect(store.notes[0]?.mtime_ms).toBe(200);
  });

  it("removes stale notes that are direct children of loaded folder", () => {
    const store = new NotesStore();

    store.merge_folder_contents(
      "docs",
      folder_contents([note("docs/old.md"), note("docs/keep.md")], []),
    );

    store.merge_folder_contents(
      "docs",
      folder_contents([note("docs/keep.md")], []),
    );

    expect(store.notes.map((n) => n.path)).toEqual(["docs/keep.md"]);
  });

  it("handles nested folder refresh correctly", () => {
    const store = new NotesStore();

    store.merge_folder_contents("", folder_contents([], ["a"]));
    store.merge_folder_contents("a", folder_contents([], ["a/b", "a/c"]));
    store.merge_folder_contents(
      "a/b",
      folder_contents([note("a/b/note.md")], []),
    );

    store.merge_folder_contents("a", folder_contents([], ["a/c", "a/d"]));

    expect(store.folder_paths).toEqual(["a", "a/c", "a/d"]);
    expect(store.notes).toEqual([]);
  });

  it("includes folder_path itself in folder_paths", () => {
    const store = new NotesStore();

    store.merge_folder_contents("sub", folder_contents([], ["sub/child"]));

    expect(store.folder_paths).toContain("sub");
    expect(store.folder_paths).toContain("sub/child");
  });
});

describe("NotesStore.append_folder_page", () => {
  it("appends additional items without removing prior page data", () => {
    const store = new NotesStore();

    store.append_folder_page("", {
      notes: [note("b.md")],
      subfolders: ["alpha"],
      total_count: 4,
      has_more: true,
    });

    store.append_folder_page("", {
      notes: [note("c.md")],
      subfolders: ["beta"],
      total_count: 4,
      has_more: false,
    });

    expect(store.notes.map((entry) => entry.path)).toEqual(["b.md", "c.md"]);
    expect(store.folder_paths).toEqual(["alpha", "beta"]);
  });

  it("deduplicates repeated items across pages", () => {
    const store = new NotesStore();

    store.append_folder_page("", {
      notes: [note("b.md")],
      subfolders: ["alpha"],
      total_count: 3,
      has_more: true,
    });

    store.append_folder_page("", {
      notes: [note("b.md")],
      subfolders: ["alpha"],
      total_count: 3,
      has_more: false,
    });

    expect(store.notes.map((entry) => entry.path)).toEqual(["b.md"]);
    expect(store.folder_paths).toEqual(["alpha"]);
  });
});

describe("NotesStore recent notes", () => {
  it("adds recent notes with deduplication and cap", () => {
    const store = new NotesStore();

    store.add_recent_note(note("a.md"));
    store.add_recent_note(note("b.md"));
    store.add_recent_note(note("a.md"));

    expect(store.recent_notes.map((entry) => entry.id)).toEqual([
      "a.md",
      "b.md",
    ]);

    for (let i = 0; i < 12; i++) {
      store.add_recent_note(note(`note-${String(i)}.md`));
    }

    expect(store.recent_notes).toHaveLength(10);
    expect(store.recent_notes[0]?.id).toBe("note-11.md");
  });

  it("removes recent notes by id", () => {
    const store = new NotesStore();

    store.add_recent_note(note("a.md"));
    store.add_recent_note(note("b.md"));
    store.remove_recent_note("a.md" as NoteId);

    expect(store.recent_notes.map((entry) => entry.id)).toEqual(["b.md"]);
  });

  it("renames recent notes without reordering", () => {
    const store = new NotesStore();

    store.add_recent_note(note("a.md"));
    store.add_recent_note(note("b.md"));
    store.add_recent_note(note("c.md"));

    store.rename_recent_note("b.md" as NoteId, note("renamed.md"));

    expect(store.recent_notes.map((entry) => entry.id)).toEqual([
      "c.md",
      "renamed.md",
      "a.md",
    ]);
  });

  it("updates recent notes when a folder path prefix changes", () => {
    const store = new NotesStore();

    store.add_recent_note(note("docs/a.md"));
    store.add_recent_note(note("docs/b.md"));
    store.add_recent_note(note("misc/c.md"));

    store.update_recent_note_path_prefix("docs/", "archive/");

    expect(store.recent_notes.map((entry) => entry.path)).toEqual([
      "misc/c.md",
      "archive/b.md",
      "archive/a.md",
    ]);
  });

  it("remove_recent_notes_by_prefix filters matching notes in one pass", () => {
    const store = new NotesStore();
    store.add_recent_note(note("docs/a.md"));
    store.add_recent_note(note("docs/sub/b.md"));
    store.add_recent_note(note("misc/c.md"));

    store.remove_recent_notes_by_prefix("docs/");

    expect(store.recent_notes.map((entry) => entry.path)).toEqual([
      "misc/c.md",
    ]);
  });

  it("remove_recent_notes_by_prefix is a no-op when prefix matches nothing", () => {
    const store = new NotesStore();
    store.add_recent_note(note("misc/a.md"));
    store.add_recent_note(note("misc/b.md"));

    store.remove_recent_notes_by_prefix("docs/");

    expect(store.recent_notes).toHaveLength(2);
  });
});

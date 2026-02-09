import { describe, it, expect } from "vitest";
import { flatten_filetree } from "$lib/utils/flatten_filetree";
import { as_note_path } from "$lib/types/ids";
import type { NoteMeta } from "$lib/types/note";
import type { FolderLoadState } from "$lib/types/filetree";

function make_note(path: string, title?: string): NoteMeta {
  return {
    id: as_note_path(path),
    path: as_note_path(path),
    name: path.split("/").at(-1)?.replace(/\.md$/, "") ?? "",
    title: title ?? path.replace(/\.md$/, "").split("/").pop() ?? "",
    mtime_ms: Date.now(),
    size_bytes: 100,
  };
}

describe("flatten_filetree", () => {
  it("returns empty array for empty input", () => {
    const result = flatten_filetree({
      notes: [],
      folder_paths: [],
      expanded_paths: new Set(),
      load_states: new Map(),
      error_messages: new Map(),
      show_hidden_files: false,
      pagination: new Map(),
    });
    expect(result).toEqual([]);
  });

  it("returns flat list of root-level files", () => {
    const notes = [make_note("a.md"), make_note("b.md")];
    const result = flatten_filetree({
      notes,
      folder_paths: [],
      expanded_paths: new Set(),
      load_states: new Map(),
      error_messages: new Map(),
      show_hidden_files: false,
      pagination: new Map(),
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("a.md");
    expect(result[0]?.depth).toBe(0);
    expect(result[0]?.is_folder).toBe(false);
    expect(result[1]?.name).toBe("b.md");
  });

  it("shows folders at root level when collapsed", () => {
    const notes = [make_note("folder/note.md")];
    const result = flatten_filetree({
      notes,
      folder_paths: ["folder"],
      expanded_paths: new Set(),
      load_states: new Map(),
      error_messages: new Map(),
      show_hidden_files: false,
      pagination: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("folder");
    expect(result[0]?.is_folder).toBe(true);
    expect(result[0]?.is_expanded).toBe(false);
    expect(result[0]?.depth).toBe(0);
  });

  it("shows nested items when folder is expanded", () => {
    const notes = [make_note("folder/note.md")];
    const result = flatten_filetree({
      notes,
      folder_paths: ["folder"],
      expanded_paths: new Set(["folder"]),
      load_states: new Map(),
      error_messages: new Map(),
      show_hidden_files: false,
      pagination: new Map(),
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("folder");
    expect(result[0]?.is_expanded).toBe(true);
    expect(result[1]?.name).toBe("note.md");
    expect(result[1]?.depth).toBe(1);
    expect(result[1]?.parent_path).toBe("folder");
  });

  it("shows loading state for folders", () => {
    const result = flatten_filetree({
      notes: [],
      folder_paths: ["folder"],
      expanded_paths: new Set(["folder"]),
      load_states: new Map<string, FolderLoadState>([["folder", "loading"]]),
      error_messages: new Map(),
      show_hidden_files: false,
      pagination: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.is_loading).toBe(true);
    expect(result[0]?.has_error).toBe(false);
  });

  it("shows error state for folders", () => {
    const result = flatten_filetree({
      notes: [],
      folder_paths: ["folder"],
      expanded_paths: new Set(["folder"]),
      load_states: new Map<string, FolderLoadState>([["folder", "error"]]),
      error_messages: new Map([["folder", "not a directory"]]),
      show_hidden_files: false,
      pagination: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.is_loading).toBe(false);
    expect(result[0]?.has_error).toBe(true);
    expect(result[0]?.error_message).toBe("not a directory");
  });

  it("handles deeply nested structure", () => {
    const notes = [make_note("a/b/c/d.md")];
    const result = flatten_filetree({
      notes,
      folder_paths: ["a", "a/b", "a/b/c"],
      expanded_paths: new Set(["a", "a/b", "a/b/c"]),
      load_states: new Map(),
      error_messages: new Map(),
      show_hidden_files: false,
      pagination: new Map(),
    });

    expect(result).toHaveLength(4);
    expect(result[0]?.path).toBe("a");
    expect(result[0]?.depth).toBe(0);
    expect(result[1]?.path).toBe("a/b");
    expect(result[1]?.depth).toBe(1);
    expect(result[2]?.path).toBe("a/b/c");
    expect(result[2]?.depth).toBe(2);
    expect(result[3]?.path).toBe("a/b/c/d.md");
    expect(result[3]?.depth).toBe(3);
  });

  it("sorts folders before files", () => {
    const notes = [make_note("z.md"), make_note("folder/a.md")];
    const result = flatten_filetree({
      notes,
      folder_paths: ["folder"],
      expanded_paths: new Set(),
      load_states: new Map(),
      error_messages: new Map(),
      show_hidden_files: false,
      pagination: new Map(),
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe("folder");
    expect(result[0]?.is_folder).toBe(true);
    expect(result[1]?.name).toBe("z.md");
    expect(result[1]?.is_folder).toBe(false);
  });

  it("excludes hidden folder when show_hidden_files is false", () => {
    const notes = [make_note(".hidden/note.md")];
    const result = flatten_filetree({
      notes,
      folder_paths: [".hidden"],
      expanded_paths: new Set(),
      load_states: new Map(),
      error_messages: new Map(),
      show_hidden_files: false,
      pagination: new Map(),
    });

    expect(result).toHaveLength(0);
  });

  it("includes hidden folder when show_hidden_files is true", () => {
    const notes = [make_note(".hidden/note.md")];
    const result = flatten_filetree({
      notes,
      folder_paths: [".hidden"],
      expanded_paths: new Set([".hidden"]),
      load_states: new Map(),
      error_messages: new Map(),
      show_hidden_files: true,
      pagination: new Map(),
    });

    expect(result).toHaveLength(2);
    expect(result[0]?.name).toBe(".hidden");
    expect(result[0]?.is_folder).toBe(true);
    expect(result[1]?.name).toBe("note.md");
    expect(result[1]?.depth).toBe(1);
  });

  it("excludes hidden file when show_hidden_files is false", () => {
    const notes = [make_note(".hidden.md")];
    const result = flatten_filetree({
      notes,
      folder_paths: [],
      expanded_paths: new Set(),
      load_states: new Map(),
      error_messages: new Map(),
      show_hidden_files: false,
      pagination: new Map(),
    });

    expect(result).toHaveLength(0);
  });

  it("includes hidden file when show_hidden_files is true", () => {
    const notes = [make_note(".hidden.md")];
    const result = flatten_filetree({
      notes,
      folder_paths: [],
      expanded_paths: new Set(),
      load_states: new Map(),
      error_messages: new Map(),
      show_hidden_files: true,
      pagination: new Map(),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe(".hidden.md");
    expect(result[0]?.is_folder).toBe(false);
  });

  it("adds root load-more sentinel when pagination has more items", () => {
    const result = flatten_filetree({
      notes: [make_note("a.md")],
      folder_paths: [],
      expanded_paths: new Set(),
      load_states: new Map(),
      error_messages: new Map(),
      show_hidden_files: false,
      pagination: new Map([
        [
          "",
          {
            loaded_count: 1,
            total_count: 2,
            load_state: "idle",
            error_message: null,
          },
        ],
      ]),
    });

    expect(result).toHaveLength(2);
    expect(result[1]?.is_load_more).toBe(true);
    expect(result[1]?.depth).toBe(0);
    expect(result[1]?.parent_path).toBe("");
  });

  it("adds nested load-more sentinel with child depth", () => {
    const result = flatten_filetree({
      notes: [make_note("docs/a.md")],
      folder_paths: ["docs"],
      expanded_paths: new Set(["docs"]),
      load_states: new Map([["docs", "loaded"]]),
      error_messages: new Map(),
      show_hidden_files: false,
      pagination: new Map([
        [
          "docs",
          {
            loaded_count: 1,
            total_count: 3,
            load_state: "idle",
            error_message: null,
          },
        ],
      ]),
    });

    expect(result).toHaveLength(3);
    expect(result[2]?.is_load_more).toBe(true);
    expect(result[2]?.depth).toBe(1);
    expect(result[2]?.parent_path).toBe("docs");
  });

  it("does not add sentinel when folder is fully loaded", () => {
    const result = flatten_filetree({
      notes: [make_note("a.md")],
      folder_paths: [],
      expanded_paths: new Set(),
      load_states: new Map(),
      error_messages: new Map(),
      show_hidden_files: false,
      pagination: new Map([
        [
          "",
          {
            loaded_count: 2,
            total_count: 2,
            load_state: "idle",
            error_message: null,
          },
        ],
      ]),
    });

    expect(result).toHaveLength(1);
    expect(result.some((node) => node.is_load_more)).toBe(false);
  });

  it("marks sentinel as error when load-more fails", () => {
    const result = flatten_filetree({
      notes: [make_note("a.md")],
      folder_paths: [],
      expanded_paths: new Set(),
      load_states: new Map(),
      error_messages: new Map(),
      show_hidden_files: false,
      pagination: new Map([
        [
          "",
          {
            loaded_count: 1,
            total_count: 2,
            load_state: "error",
            error_message: "network failed",
          },
        ],
      ]),
    });

    expect(result).toHaveLength(2);
    expect(result[1]?.is_load_more).toBe(true);
    expect(result[1]?.has_error).toBe(true);
    expect(result[1]?.error_message).toBe("network failed");
  });
});

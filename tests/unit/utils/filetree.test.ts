import { describe, expect, test } from "vitest";
import {
  build_filetree,
  get_invalid_drop_reason,
  is_valid_drop_target,
  move_destination_path,
  sort_tree,
} from "$lib/domain/filetree";
import { parent_folder_path } from "$lib/utils/path";
import type { NoteMeta } from "$lib/types/note";
import { as_note_path } from "$lib/types/ids";

function create_note(path: string, title: string = ""): NoteMeta {
  return {
    id: as_note_path(path),
    path: as_note_path(path),
    name: path.split("/").at(-1)?.replace(/\.md$/, "") ?? "",
    title: title || path.replace(/\.md$/, ""),
    mtime_ms: 0,
    size_bytes: 0,
  };
}

describe("filetree", () => {
  test("leaf node is file when NoteMeta.path ends with .md", () => {
    const notes: NoteMeta[] = [
      create_note("note.md"),
      create_note("folder/note.md"),
      create_note("a/b/c/note.md"),
    ];

    const tree = build_filetree(notes);

    expect(tree.children.get("note.md")?.is_folder).toBe(false);
    expect(tree.children.get("note.md")?.note).toBeTruthy();

    const folder = tree.children.get("folder");
    expect(folder?.is_folder).toBe(true);
    expect(folder?.children.get("note.md")?.is_folder).toBe(false);
    expect(folder?.children.get("note.md")?.note).toBeTruthy();

    const a = tree.children.get("a");
    const b = a?.children.get("b");
    const c = b?.children.get("c");
    expect(c?.is_folder).toBe(true);
    expect(c?.children.get("note.md")?.is_folder).toBe(false);
    expect(c?.children.get("note.md")?.note).toBeTruthy();
  });

  test("leaf node is file when it does not end with .md (defensive)", () => {
    const notes: NoteMeta[] = [
      create_note("note.txt"),
      create_note("folder/file"),
    ];

    const tree = build_filetree(notes);

    expect(tree.children.get("note.txt")?.is_folder).toBe(false);
    expect(tree.children.get("note.txt")?.note).toBeTruthy();

    const folder = tree.children.get("folder");
    expect(folder?.is_folder).toBe(true);
    expect(folder?.children.get("file")?.is_folder).toBe(false);
    expect(folder?.children.get("file")?.note).toBeTruthy();
  });

  test("intermediate segments are always folders", () => {
    const notes: NoteMeta[] = [create_note("a/b/c/d/note.md")];

    const tree = build_filetree(notes);

    const a = tree.children.get("a");
    expect(a?.is_folder).toBe(true);
    expect(a?.note).toBeNull();

    const b = a?.children.get("b");
    expect(b?.is_folder).toBe(true);
    expect(b?.note).toBeNull();

    const c = b?.children.get("c");
    expect(c?.is_folder).toBe(true);
    expect(c?.note).toBeNull();

    const d = c?.children.get("d");
    expect(d?.is_folder).toBe(true);
    expect(d?.note).toBeNull();

    const note = d?.children.get("note.md");
    expect(note?.is_folder).toBe(false);
    expect(note?.note).toBeTruthy();
  });

  test("sorting keeps folders before files", () => {
    const notes: NoteMeta[] = [
      create_note("zebra.md"),
      create_note("apple.md"),
      create_note("folder/note.md"),
      create_note("alpha/beta.md"),
    ];

    const tree = sort_tree(build_filetree(notes));
    const entries = Array.from(tree.children.entries());

    expect(entries[0]?.[0]).toBe("alpha");
    expect(entries[0]?.[1].is_folder).toBe(true);

    expect(entries[1]?.[0]).toBe("folder");
    expect(entries[1]?.[1].is_folder).toBe(true);

    expect(entries[2]?.[0]).toBe("apple.md");
    expect(entries[2]?.[1].is_folder).toBe(false);

    expect(entries[3]?.[0]).toBe("zebra.md");
    expect(entries[3]?.[1].is_folder).toBe(false);
  });

  test("sorting within folders also keeps folders before files", () => {
    const notes: NoteMeta[] = [
      create_note("root/z-file.md"),
      create_note("root/a-file.md"),
      create_note("root/subfolder/note.md"),
    ];

    const tree = sort_tree(build_filetree(notes));
    const root = tree.children.get("root");
    if (!root) throw new Error("root should exist");
    const entries = Array.from(root.children.entries());

    expect(entries[0]?.[0]).toBe("subfolder");
    expect(entries[0]?.[1].is_folder).toBe(true);

    expect(entries[1]?.[0]).toBe("a-file.md");
    expect(entries[1]?.[1].is_folder).toBe(false);

    expect(entries[2]?.[0]).toBe("z-file.md");
    expect(entries[2]?.[1].is_folder).toBe(false);
  });

  test("handles empty notes array", () => {
    const tree = build_filetree([]);
    expect(tree.children.size).toBe(0);
    expect(tree.is_folder).toBe(true);
  });

  test("handles root-level note", () => {
    const notes: NoteMeta[] = [create_note("root.md")];
    const tree = build_filetree(notes);

    expect(tree.children.get("root.md")?.is_folder).toBe(false);
    expect(tree.children.get("root.md")?.note).toBeTruthy();
  });

  test("folder_paths adds empty folder nodes", () => {
    const notes: NoteMeta[] = [];
    const folder_paths = ["empty", "nested/child"];

    const tree = build_filetree(notes, folder_paths);

    const empty = tree.children.get("empty");
    expect(empty?.is_folder).toBe(true);
    expect(empty?.note).toBeNull();
    expect(empty?.path).toBe("empty");

    const nested = tree.children.get("nested");
    expect(nested?.is_folder).toBe(true);
    expect(nested?.note).toBeNull();
    const child = nested?.children.get("child");
    expect(child?.is_folder).toBe(true);
    expect(child?.note).toBeNull();
    expect(child?.path).toBe("nested/child");
  });

  test("folder_paths does not overwrite existing file nodes", () => {
    const notes: NoteMeta[] = [create_note("foo/bar.md")];
    const folder_paths = ["foo"];

    const tree = build_filetree(notes, folder_paths);

    const foo = tree.children.get("foo");
    expect(foo?.is_folder).toBe(true);
    const bar = foo?.children.get("bar.md");
    expect(bar?.is_folder).toBe(false);
    expect(bar?.note).toBeTruthy();
  });

  test("notes and folder_paths merge: empty sibling folder appears", () => {
    const notes: NoteMeta[] = [create_note("a/file.md")];
    const folder_paths = ["b"];

    const tree = build_filetree(notes, folder_paths);

    expect(tree.children.get("a")?.is_folder).toBe(true);
    expect(tree.children.get("a")?.children.get("file.md")?.note).toBeTruthy();
    expect(tree.children.get("b")?.is_folder).toBe(true);
    expect(tree.children.get("b")?.note).toBeNull();
    expect(tree.children.get("b")?.children.size).toBe(0);
  });
});

describe("parent_folder_path", () => {
  test("returns empty string for empty path", () => {
    expect(parent_folder_path("")).toBe("");
  });

  test("returns empty string for single segment (vault root)", () => {
    expect(parent_folder_path("note.md")).toBe("");
    expect(parent_folder_path("file")).toBe("");
  });

  test("returns parent for nested path", () => {
    expect(parent_folder_path("a/b/c.md")).toBe("a/b");
  });
});

describe("filetree move helpers", () => {
  test("builds destination path at root and nested targets", () => {
    expect(move_destination_path("docs/note.md", "")).toBe("note.md");
    expect(move_destination_path("docs/note.md", "archive")).toBe(
      "archive/note.md",
    );
  });

  test("rejects no-op drops", () => {
    expect(is_valid_drop_target(["docs/note.md"], "docs")).toBe(false);
    expect(is_valid_drop_target(["note.md"], "")).toBe(false);
  });

  test("detects descendant folder drops", () => {
    const reason = get_invalid_drop_reason(
      [{ path: "a", is_folder: true }],
      "a/b",
    );
    expect(reason).toBe("cannot move folder into itself");
  });

  test("detects nested selections", () => {
    const reason = get_invalid_drop_reason(
      [
        { path: "a", is_folder: true },
        { path: "a/b/note.md", is_folder: false },
      ],
      "archive",
    );
    expect(reason).toBe("selection contains nested folder items");
  });
});

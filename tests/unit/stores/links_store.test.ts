import { describe, expect, it } from "vitest";
import { LinksStore } from "$lib/stores/links_store.svelte";
import type { NoteId, NotePath } from "$lib/types/ids";
import type { NoteMeta } from "$lib/types/note";

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

describe("LinksStore", () => {
  it("starts empty", () => {
    const store = new LinksStore();
    expect(store.backlinks).toEqual([]);
    expect(store.outlinks).toEqual([]);
    expect(store.orphan_links).toEqual([]);
    expect(store.active_note_path).toBeNull();
  });

  it("sets links snapshot with note path", () => {
    const store = new LinksStore();
    store.set_snapshot("target.md", {
      backlinks: [note("a.md")],
      outlinks: [note("b.md")],
      orphan_links: ["missing/c.md"],
    });
    expect(store.backlinks).toEqual([note("a.md")]);
    expect(store.outlinks).toEqual([note("b.md")]);
    expect(store.orphan_links).toEqual(["missing/c.md"]);
    expect(store.active_note_path).toBe("target.md");
  });

  it("clears state", () => {
    const store = new LinksStore();
    store.set_snapshot("target.md", {
      backlinks: [note("a.md")],
      outlinks: [note("b.md")],
      orphan_links: ["missing/c.md"],
    });
    store.clear();
    expect(store.backlinks).toEqual([]);
    expect(store.outlinks).toEqual([]);
    expect(store.orphan_links).toEqual([]);
    expect(store.active_note_path).toBeNull();
  });

  it("resets state", () => {
    const store = new LinksStore();
    store.set_snapshot("target.md", {
      backlinks: [note("a.md")],
      outlinks: [note("b.md")],
      orphan_links: ["missing/c.md"],
    });
    store.reset();
    expect(store.backlinks).toEqual([]);
    expect(store.outlinks).toEqual([]);
    expect(store.orphan_links).toEqual([]);
    expect(store.active_note_path).toBeNull();
  });
});

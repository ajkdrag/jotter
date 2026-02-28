import { describe, expect, it } from "vitest";
import { LinksStore } from "$lib/features/links/state/links_store.svelte";
import type { NoteId, NotePath } from "$lib/shared/types/ids";
import type { NoteMeta } from "$lib/shared/types/note";
import type { OrphanLink } from "$lib/shared/types/search";

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

function orphan(target_path: string, ref_count = 1): OrphanLink {
  return { target_path, ref_count };
}

describe("LinksStore", () => {
  it("starts empty", () => {
    const store = new LinksStore();
    expect(store.local_outlink_paths).toEqual([]);
    expect(store.external_links).toEqual([]);
    expect(store.backlinks).toEqual([]);
    expect(store.outlinks).toEqual([]);
    expect(store.orphan_links).toEqual([]);
    expect(store.active_note_path).toBeNull();
    expect(store.global_status).toBe("idle");
    expect(store.global_error).toBeNull();
  });

  it("sets local snapshot", () => {
    const store = new LinksStore();
    store.set_local_snapshot("target.md", {
      outlink_paths: ["a.md"],
      external_links: [{ url: "https://example.com", text: "example" }],
    });
    expect(store.local_outlink_paths).toEqual(["a.md"]);
    expect(store.external_links).toEqual([
      { url: "https://example.com", text: "example" },
    ]);
    expect(store.active_note_path).toBe("target.md");
  });

  it("sets links snapshot with note path", () => {
    const store = new LinksStore();
    store.set_snapshot("target.md", {
      backlinks: [note("a.md")],
      outlinks: [note("b.md")],
      orphan_links: [orphan("missing/c.md")],
    });
    expect(store.backlinks).toEqual([note("a.md")]);
    expect(store.outlinks).toEqual([note("b.md")]);
    expect(store.orphan_links).toEqual([orphan("missing/c.md")]);
    expect(store.active_note_path).toBe("target.md");
    expect(store.global_status).toBe("ready");
    expect(store.global_error).toBeNull();
  });

  it("sets loading and error states for global snapshot", () => {
    const store = new LinksStore();
    store.start_global_load("target.md");
    expect(store.global_status).toBe("loading");
    expect(store.backlinks).toEqual([]);
    expect(store.outlinks).toEqual([]);
    expect(store.orphan_links).toEqual([]);

    store.set_global_error("target.md", "boom");
    expect(store.global_status).toBe("error");
    expect(store.global_error).toBe("boom");
    expect(store.backlinks).toEqual([]);
    expect(store.outlinks).toEqual([]);
    expect(store.orphan_links).toEqual([]);
  });

  it("clears state", () => {
    const store = new LinksStore();
    store.set_local_snapshot("target.md", {
      outlink_paths: ["x.md"],
      external_links: [{ url: "https://example.com", text: "x" }],
    });
    store.set_snapshot("target.md", {
      backlinks: [note("a.md")],
      outlinks: [note("b.md")],
      orphan_links: [orphan("missing/c.md")],
    });
    store.clear();
    expect(store.local_outlink_paths).toEqual([]);
    expect(store.external_links).toEqual([]);
    expect(store.backlinks).toEqual([]);
    expect(store.outlinks).toEqual([]);
    expect(store.orphan_links).toEqual([]);
    expect(store.active_note_path).toBeNull();
    expect(store.global_status).toBe("idle");
    expect(store.global_error).toBeNull();
  });

  it("resets state", () => {
    const store = new LinksStore();
    store.set_local_snapshot("target.md", {
      outlink_paths: ["x.md"],
      external_links: [{ url: "https://example.com", text: "x" }],
    });
    store.set_snapshot("target.md", {
      backlinks: [note("a.md")],
      outlinks: [note("b.md")],
      orphan_links: [orphan("missing/c.md")],
    });
    store.reset();
    expect(store.local_outlink_paths).toEqual([]);
    expect(store.external_links).toEqual([]);
    expect(store.backlinks).toEqual([]);
    expect(store.outlinks).toEqual([]);
    expect(store.orphan_links).toEqual([]);
    expect(store.active_note_path).toBeNull();
    expect(store.global_status).toBe("idle");
    expect(store.global_error).toBeNull();
  });
});

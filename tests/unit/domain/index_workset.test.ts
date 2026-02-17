import { describe, expect, it } from "vitest";
import {
  count_index_workset_items,
  reduce_index_changes,
} from "$lib/domain/index_workset";
import { as_note_path } from "$lib/types/ids";

describe("index_workset", () => {
  it("keeps only remove for conflicting path updates", () => {
    const workset = reduce_index_changes([
      { kind: "upsert_path", path: as_note_path("notes/a.md") },
      { kind: "remove_path", path: as_note_path("notes/a.md") },
    ]);

    expect([...workset.upsert_paths]).toEqual([]);
    expect([...workset.remove_paths]).toEqual(["notes/a.md"]);
  });

  it("remaps queued path updates on prefix rename", () => {
    const workset = reduce_index_changes([
      { kind: "upsert_path", path: as_note_path("old/a.md") },
      { kind: "rename_prefix", old_prefix: "old/", new_prefix: "new/" },
    ]);

    expect([...workset.upsert_paths]).toEqual(["new/a.md"]);
    expect(workset.rename_prefixes).toEqual([
      { old_prefix: "old/", new_prefix: "new/" },
    ]);
  });

  it("drops net no-op rename chains", () => {
    const workset = reduce_index_changes([
      { kind: "rename_prefix", old_prefix: "old/", new_prefix: "mid/" },
      { kind: "rename_prefix", old_prefix: "mid/", new_prefix: "old/" },
    ]);

    expect(workset.rename_prefixes).toEqual([]);
  });

  it("compacts note rename chains and remaps queued path updates", () => {
    const workset = reduce_index_changes([
      { kind: "upsert_path", path: as_note_path("docs/old.md") },
      {
        kind: "rename_path",
        old_path: as_note_path("docs/old.md"),
        new_path: as_note_path("docs/mid.md"),
      },
      {
        kind: "rename_path",
        old_path: as_note_path("docs/mid.md"),
        new_path: as_note_path("docs/new.md"),
      },
    ]);

    expect([...workset.upsert_paths]).toEqual(["docs/new.md"]);
    expect(workset.rename_paths).toEqual([
      { old_path: "docs/old.md", new_path: "docs/new.md" },
    ]);
  });

  it("force_rebuild clears all pending targeted work", () => {
    const workset = reduce_index_changes([
      { kind: "upsert_path", path: as_note_path("notes/a.md") },
      { kind: "remove_prefix", prefix: "docs/" },
      { kind: "force_scan" },
      { kind: "force_rebuild" },
    ]);

    expect(workset.force_rebuild).toBe(true);
    expect(count_index_workset_items(workset)).toBe(1);
    expect(workset.upsert_paths.size).toBe(0);
    expect(workset.remove_prefixes.size).toBe(0);
  });
});

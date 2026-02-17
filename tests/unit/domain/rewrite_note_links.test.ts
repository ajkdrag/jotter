import { describe, expect, it } from "vitest";
import { rewrite_note_links } from "$lib/domain/rewrite_note_links";

describe("rewrite_note_links", () => {
  it("rewrites matching relative markdown links", () => {
    const result = rewrite_note_links({
      source_note_path: "docs/source.md",
      markdown: "[Old](old.md)",
      old_target_path: "docs/old.md",
      new_target_path: "docs/new.md",
    });

    expect(result).toEqual({
      markdown: "[Old](new.md)",
      changed: true,
    });
  });

  it("rewrites parent-relative markdown links", () => {
    const result = rewrite_note_links({
      source_note_path: "docs/sub/source.md",
      markdown: "[Old](../old.md)",
      old_target_path: "docs/old.md",
      new_target_path: "notes/new.md",
    });

    expect(result).toEqual({
      markdown: "[Old](../../notes/new.md)",
      changed: true,
    });
  });

  it("does not rewrite external or non-matching links", () => {
    const result = rewrite_note_links({
      source_note_path: "docs/source.md",
      markdown:
        "[External](https://example.com/old.md) [Other](other.md) ![Img](old.md)",
      old_target_path: "docs/old.md",
      new_target_path: "docs/new.md",
    });

    expect(result).toEqual({
      markdown:
        "[External](https://example.com/old.md) [Other](other.md) ![Img](old.md)",
      changed: false,
    });
  });

  it("rewrites links where target folder contains spaces", () => {
    const result = rewrite_note_links({
      source_note_path: "root.md",
      markdown: "[Old](Folder Name/old.md)",
      old_target_path: "Folder Name/old.md",
      new_target_path: "Folder Name/new.md",
    });

    expect(result).toEqual({
      markdown: "[Old](Folder Name/new.md)",
      changed: true,
    });
  });
});

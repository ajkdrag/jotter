import { describe, expect, it } from "vitest";
import { as_asset_path, as_note_path } from "$lib/shared/types/ids";
import {
  resolve_relative_asset_path,
  to_markdown_asset_target,
} from "$lib/features/note";

describe("to_markdown_asset_target", () => {
  it("builds relative path for same folder assets", () => {
    const target = to_markdown_asset_target(
      as_note_path("docs/alpha.md"),
      as_asset_path("docs/.assets/alpha-1.png"),
    );

    expect(target).toBe(".assets/alpha-1.png");
  });

  it("builds relative path across sibling folders", () => {
    const target = to_markdown_asset_target(
      as_note_path("docs/alpha.md"),
      as_asset_path("images/pasted.png"),
    );

    expect(target).toBe("../images/pasted.png");
  });

  it("encodes path segments for markdown links", () => {
    const target = to_markdown_asset_target(
      as_note_path("notes/day 1.md"),
      as_asset_path("notes/.assets/hello world.png"),
    );

    expect(target).toBe(".assets/hello%20world.png");
  });

  it("traverses up from deeply nested note to vault-root asset folder", () => {
    const target = to_markdown_asset_target(
      as_note_path("projects/deep/nested/note.md"),
      as_asset_path(".assets/img.png"),
    );

    expect(target).toBe("../../../.assets/img.png");
  });

  it("handles root-level note with vault-root asset folder", () => {
    const target = to_markdown_asset_target(
      as_note_path("note.md"),
      as_asset_path(".assets/img.png"),
    );

    expect(target).toBe(".assets/img.png");
  });
});

describe("resolve_relative_asset_path", () => {
  it("resolves relative path for root-level note", () => {
    const result = resolve_relative_asset_path("note.md", ".assets/img.png");

    expect(result).toBe(".assets/img.png");
  });

  it("resolves relative path with parent traversals", () => {
    const result = resolve_relative_asset_path(
      "projects/deep/note.md",
      "../../.assets/img.png",
    );

    expect(result).toBe(".assets/img.png");
  });

  it("resolves relative path from one level deep", () => {
    const result = resolve_relative_asset_path(
      "docs/note.md",
      "../.assets/img.png",
    );

    expect(result).toBe(".assets/img.png");
  });

  it("resolves sibling-relative path without traversal", () => {
    const result = resolve_relative_asset_path(
      "docs/note.md",
      ".assets/img.png",
    );

    expect(result).toBe("docs/.assets/img.png");
  });

  it("handles current-directory segments", () => {
    const result = resolve_relative_asset_path(
      "docs/note.md",
      "./.assets/img.png",
    );

    expect(result).toBe("docs/.assets/img.png");
  });

  it("clamps traversal at vault root", () => {
    const result = resolve_relative_asset_path(
      "note.md",
      "../../.assets/img.png",
    );

    expect(result).toBe(".assets/img.png");
  });

  it("handles encoded spaces in src", () => {
    const result = resolve_relative_asset_path(
      "folder/note.md",
      "../.assets/hello world.png",
    );

    expect(result).toBe(".assets/hello world.png");
  });
});

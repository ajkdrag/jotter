import { describe, expect, it } from "vitest";
import {
  gfm_link_targets,
  resolve_relative_path,
} from "$lib/adapters/web/wiki_links_web";

describe("resolve_relative_path", () => {
  it("resolves a sibling file", () => {
    expect(resolve_relative_path("notes", "beta.md")).toBe("notes/beta.md");
  });

  it("resolves with explicit ./", () => {
    expect(resolve_relative_path("notes", "./beta.md")).toBe("notes/beta.md");
  });

  it("resolves parent with ../", () => {
    expect(resolve_relative_path("docs/sub", "../other.md")).toBe(
      "docs/other.md",
    );
  });

  it("returns null when .. escapes root", () => {
    expect(resolve_relative_path("", "../escape.md")).toBeNull();
  });

  it("resolves from empty source dir", () => {
    expect(resolve_relative_path("", "top.md")).toBe("top.md");
  });
});

describe("gfm_link_targets", () => {
  it("extracts GFM link targets from markdown", () => {
    const md = "[Alpha](alpha.md) and [Beta](../beta.md)";
    expect(gfm_link_targets(md, "notes/source.md")).toEqual([
      "notes/alpha.md",
      "beta.md",
    ]);
  });

  it("skips image links", () => {
    const md = "![img](photo.md) [real](real.md)";
    expect(gfm_link_targets(md, "notes/source.md")).toEqual(["notes/real.md"]);
  });

  it("skips external URLs", () => {
    const md = "[ext](https://example.com/page.md) [local](local.md)";
    expect(gfm_link_targets(md, "docs/source.md")).toEqual(["docs/local.md"]);
  });

  it("returns empty for markdown with no links", () => {
    expect(gfm_link_targets("plain text", "notes/a.md")).toEqual([]);
  });

  it("handles source at vault root", () => {
    expect(gfm_link_targets("[a](sub/note.md)", "root.md")).toEqual([
      "sub/note.md",
    ]);
  });

  it("captures targets when folder names contain spaces", () => {
    const md = "[Doc](Folder Name/child note.md)";
    expect(gfm_link_targets(md, "root.md")).toEqual([
      "Folder Name/child note.md",
    ]);
  });

  it("captures angle-bracket markdown targets with spaces", () => {
    const md = "[Doc](<Folder Name/child note.md>)";
    expect(gfm_link_targets(md, "root.md")).toEqual([
      "Folder Name/child note.md",
    ]);
  });

  it("decodes URL-encoded markdown link targets", () => {
    const md = "[Doc](Folder%20Name/child%20note.md)";
    expect(gfm_link_targets(md, "root.md")).toEqual([
      "Folder Name/child note.md",
    ]);
  });
});

import { describe, it, expect } from "vitest";
import {
  format_wiki_target_for_markdown,
  format_wiki_target_for_markdown_link,
  resolve_wiki_target_to_note_path,
} from "$lib/domain/wiki_link";

describe("wiki_link utils", () => {
  it("resolves relative targets to note paths", () => {
    const resolved = resolve_wiki_target_to_note_path({
      base_note_path: "abc/pqr/current.md",
      raw_target: "note",
    });
    expect(resolved).toBe("abc/pqr/note.md");
  });

  it("normalizes parent directory segments", () => {
    const resolved = resolve_wiki_target_to_note_path({
      base_note_path: "abc/pqr/current.md",
      raw_target: "../a",
    });
    expect(resolved).toBe("abc/a.md");
  });

  it("resolves absolute targets from vault root", () => {
    const resolved = resolve_wiki_target_to_note_path({
      base_note_path: "x/y/current.md",
      raw_target: "/abc/pqr/mynote.md",
    });
    expect(resolved).toBe("abc/pqr/mynote.md");
  });

  it("formats targets relative to current folder when possible", () => {
    const formatted = format_wiki_target_for_markdown({
      base_note_path: "abc/pqr/current.md",
      resolved_note_path: "abc/pqr/note.md",
    });
    expect(formatted).toBe("note");
  });

  it("keeps .md for targets containing slashes", () => {
    const formatted = format_wiki_target_for_markdown({
      base_note_path: "abc/pqr/current.md",
      resolved_note_path: "abc/pqr/sub/note.md",
    });
    expect(formatted).toBe("sub/note.md");
  });

  it("formats parent targets with .. segments", () => {
    const formatted = format_wiki_target_for_markdown({
      base_note_path: "abc/pqr/current.md",
      resolved_note_path: "abc/note.md",
    });
    expect(formatted).toBe("../note.md");
  });

  it("formats markdown-link targets with relative .. segments", () => {
    const formatted = format_wiki_target_for_markdown_link({
      base_note_path: "abc/pqr/current.md",
      resolved_note_path: "abc/note.md",
    });
    expect(formatted).toBe("../note.md");
  });
});

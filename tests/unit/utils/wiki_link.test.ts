import { describe, it, expect } from "vitest";
import {
  format_wiki_target_for_markdown,
  format_wiki_target_for_markdown_link,
  resolve_wiki_target_to_note_path,
} from "$lib/domain/wiki_link";

describe("resolve_wiki_target_to_note_path", () => {
  it("resolves bare name relative to current folder", () => {
    expect(
      resolve_wiki_target_to_note_path({
        base_note_path: "abc/pqr/current.md",
        raw_target: "note",
      }),
    ).toBe("abc/pqr/note.md");
  });

  it("treats slash targets as vault-relative", () => {
    expect(
      resolve_wiki_target_to_note_path({
        base_note_path: "abc/pqr/current.md",
        raw_target: "docs/ref.md",
      }),
    ).toBe("docs/ref.md");
  });

  it("keeps explicit ./ relative to current folder", () => {
    expect(
      resolve_wiki_target_to_note_path({
        base_note_path: "abc/pqr/current.md",
        raw_target: "./docs/ref.md",
      }),
    ).toBe("abc/pqr/docs/ref.md");
  });

  it("normalizes parent directory segments", () => {
    expect(
      resolve_wiki_target_to_note_path({
        base_note_path: "abc/pqr/current.md",
        raw_target: "../a",
      }),
    ).toBe("abc/a.md");
  });

  it("resolves absolute targets from vault root", () => {
    expect(
      resolve_wiki_target_to_note_path({
        base_note_path: "x/y/current.md",
        raw_target: "/abc/pqr/mynote.md",
      }),
    ).toBe("abc/pqr/mynote.md");
  });
});

describe("format_wiki_target_for_markdown", () => {
  const format = (base: string, resolved: string) =>
    format_wiki_target_for_markdown({
      base_note_path: base,
      resolved_note_path: resolved,
    });

  it("same directory → bare name without .md", () => {
    expect(format("abc/pqr/current.md", "abc/pqr/note.md")).toBe("note");
  });

  it("child directory → ./ prefix without .md", () => {
    expect(format("abc/pqr/current.md", "abc/pqr/sub/note.md")).toBe(
      "./sub/note",
    );
  });

  it("parent directory → ../ prefix without .md", () => {
    expect(format("abc/pqr/current.md", "abc/note.md")).toBe("../note");
  });

  it("sibling directory → ../sibling/ path without .md", () => {
    expect(format("abc/pqr/current.md", "abc/xyz/note.md")).toBe("../xyz/note");
  });

  it("deep traversal across branches", () => {
    expect(format("abc/pqr/current.md", "x/y/note.md")).toBe("../../x/y/note");
  });

  it("root-level base note → vault-relative without .md", () => {
    expect(format("current.md", "docs/ref.md")).toBe("docs/ref");
  });

  it("root-level base note same dir → bare name", () => {
    expect(format("current.md", "note.md")).toBe("note");
  });
});

describe("format_wiki_target_for_markdown_link", () => {
  const format = (base: string, resolved: string) =>
    format_wiki_target_for_markdown_link({
      base_note_path: base,
      resolved_note_path: resolved,
    });

  it("same directory → bare filename with .md", () => {
    expect(format("abc/pqr/current.md", "abc/pqr/note.md")).toBe("note.md");
  });

  it("child directory → ./ prefix with .md", () => {
    expect(format("abc/pqr/current.md", "abc/pqr/sub/note.md")).toBe(
      "./sub/note.md",
    );
  });

  it("parent directory → ../ prefix with .md", () => {
    expect(format("abc/pqr/current.md", "abc/note.md")).toBe("../note.md");
  });

  it("root-level base note → vault-relative with .md", () => {
    expect(format("current.md", "docs/ref.md")).toBe("docs/ref.md");
  });
});

describe("roundtrip: format → resolve", () => {
  const roundtrip = (base: string, vault_path: string) => {
    const formatted = format_wiki_target_for_markdown({
      base_note_path: base,
      resolved_note_path: vault_path,
    });
    return resolve_wiki_target_to_note_path({
      base_note_path: base,
      raw_target: formatted,
    });
  };

  it("same directory roundtrips", () => {
    expect(roundtrip("abc/pqr/current.md", "abc/pqr/note.md")).toBe(
      "abc/pqr/note.md",
    );
  });

  it("child directory roundtrips", () => {
    expect(roundtrip("abc/pqr/current.md", "abc/pqr/sub/note.md")).toBe(
      "abc/pqr/sub/note.md",
    );
  });

  it("parent directory roundtrips", () => {
    expect(roundtrip("abc/pqr/current.md", "abc/note.md")).toBe("abc/note.md");
  });

  it("sibling directory roundtrips", () => {
    expect(roundtrip("abc/pqr/current.md", "abc/xyz/note.md")).toBe(
      "abc/xyz/note.md",
    );
  });

  it("deep traversal roundtrips", () => {
    expect(roundtrip("abc/pqr/current.md", "x/y/note.md")).toBe("x/y/note.md");
  });

  it("root-level base note roundtrips", () => {
    expect(roundtrip("current.md", "docs/ref.md")).toBe("docs/ref.md");
  });
});

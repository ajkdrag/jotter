import { describe, it, expect } from "vitest";
import { note_path_exists } from "$lib/features/note/domain/note_path_exists";
import { as_note_path } from "$lib/shared/types/ids";
import type { NoteMeta } from "$lib/shared/types/note";

describe("note_path_exists", () => {
  const notes: NoteMeta[] = [
    {
      id: as_note_path("docs/alpha.md"),
      path: as_note_path("docs/alpha.md"),
      name: "alpha",
      title: "alpha",
      mtime_ms: 0,
      size_bytes: 0,
    },
  ];

  it("matches exact path", () => {
    expect(note_path_exists(notes, as_note_path("docs/alpha.md"))).toBe(true);
  });

  it("normalizes missing extension", () => {
    expect(note_path_exists(notes, as_note_path("docs/alpha"))).toBe(true);
  });

  it("returns false for missing note", () => {
    expect(note_path_exists(notes, as_note_path("docs/missing.md"))).toBe(
      false,
    );
  });

  it("matches case-insensitively", () => {
    expect(note_path_exists(notes, as_note_path("docs/ALPHA.md"))).toBe(true);
    expect(note_path_exists(notes, as_note_path("DOCS/alpha.md"))).toBe(true);
    expect(note_path_exists(notes, as_note_path("Docs/Alpha.md"))).toBe(true);
  });

  it("excludes exact path when exclude_path provided", () => {
    expect(
      note_path_exists(
        notes,
        as_note_path("docs/alpha.md"),
        as_note_path("docs/alpha.md"),
      ),
    ).toBe(false);
  });

  it("excludes path case-insensitively when exclude_path provided", () => {
    expect(
      note_path_exists(
        notes,
        as_note_path("docs/ALPHA.md"),
        as_note_path("docs/alpha.md"),
      ),
    ).toBe(false);
    expect(
      note_path_exists(
        notes,
        as_note_path("docs/alpha.md"),
        as_note_path("DOCS/ALPHA.md"),
      ),
    ).toBe(false);
  });

  it("does not exclude unrelated paths", () => {
    expect(
      note_path_exists(
        notes,
        as_note_path("docs/alpha.md"),
        as_note_path("docs/beta.md"),
      ),
    ).toBe(true);
  });
});

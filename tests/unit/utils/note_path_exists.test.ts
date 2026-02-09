import { describe, it, expect } from "vitest";
import { note_path_exists } from "$lib/utils/note_path_exists";
import { as_note_path } from "$lib/types/ids";
import type { NoteMeta } from "$lib/types/note";

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
});

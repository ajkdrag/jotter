import { describe, it, expect } from "vitest";
import { resolve_existing_note_path } from "$lib/utils/note_lookup";
import { as_note_path } from "$lib/types/ids";
import type { NoteMeta } from "$lib/types/note";

function note(path: string): NoteMeta {
  const p = as_note_path(path);
  return {
    id: p,
    path: p,
    title: p,
    mtime_ms: 0,
    size_bytes: 0,
  };
}

describe("note_lookup utils", () => {
  it("returns exact match when present", () => {
    const notes = [note("my-NOTE.md"), note("my-note.md")];
    expect(resolve_existing_note_path(notes, "my-note.md")).toBe(
      as_note_path("my-note.md"),
    );
  });

  it("falls back to case-insensitive match", () => {
    const notes = [note("my-NOTE.md")];
    expect(resolve_existing_note_path(notes, "my-note.md")).toBe(
      as_note_path("my-NOTE.md"),
    );
  });

  it("returns a deterministic result when multiple case-insensitive matches exist", () => {
    const notes = [note("my-NOTE.md"), note("my-note.md")];
    expect(resolve_existing_note_path(notes, "MY-note.md")).toBe(
      as_note_path("my-NOTE.md"),
    );
  });
});

import { describe, expect, it } from "vitest";
import { extract_note_title } from "$lib/domain/extract_note_title";

describe("extract_note_title", () => {
  it("extracts first markdown heading title", () => {
    expect(extract_note_title("# Hello World\nbody", "notes/a.md")).toBe(
      "Hello World",
    );
  });

  it("skips leading empty lines before heading", () => {
    expect(extract_note_title("\n\n# Heading\nrest", "notes/a.md")).toBe(
      "Heading",
    );
  });

  it("falls back to filename when first non-empty line is not a heading", () => {
    expect(extract_note_title("plain text\n# Later", "notes/fallback.md")).toBe(
      "fallback",
    );
  });

  it("falls back to filename when heading text is empty", () => {
    expect(extract_note_title("#   \nbody", "notes/empty-title.md")).toBe(
      "empty-title",
    );
  });
});

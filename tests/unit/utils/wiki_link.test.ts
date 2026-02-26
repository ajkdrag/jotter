import { describe, it, expect } from "vitest";
import {
  format_wiki_display,
  format_markdown_link,
} from "$lib/domain/wiki_link";

describe("format_wiki_display", () => {
  it("strips .md from simple path", () => {
    expect(format_wiki_display("note.md")).toBe("note");
  });

  it("strips .md from nested path", () => {
    expect(format_wiki_display("abc/pqr/note.md")).toBe("abc/pqr/note");
  });

  it("returns path as-is when no .md extension", () => {
    expect(format_wiki_display("abc/pqr/note")).toBe("abc/pqr/note");
  });

  it("does not strip .md from middle of path", () => {
    expect(format_wiki_display("file.md.backup")).toBe("file.md.backup");
  });

  it("handles path that is exactly .md", () => {
    expect(format_wiki_display(".md")).toBe("");
  });

  it("handles empty string", () => {
    expect(format_wiki_display("")).toBe("");
  });

  it("handles path with spaces", () => {
    expect(format_wiki_display("my notes/todo list.md")).toBe(
      "my notes/todo list",
    );
  });
});

describe("format_markdown_link", () => {
  it("formats a simple note path and title", () => {
    expect(format_markdown_link("design.md", "Design")).toBe(
      "[Design](<design.md>)",
    );
  });

  it("formats a nested path", () => {
    expect(
      format_markdown_link("projects/notes/design.md", "Design Document"),
    ).toBe("[Design Document](<projects/notes/design.md>)");
  });

  it("handles paths with spaces", () => {
    expect(format_markdown_link("my notes/todo list.md", "Todo List")).toBe(
      "[Todo List](<my notes/todo list.md>)",
    );
  });

  it("handles empty title", () => {
    expect(format_markdown_link("notes.md", "")).toBe("[](<notes.md>)");
  });

  it("handles deeply nested path", () => {
    expect(format_markdown_link("a/b/c/d/note.md", "Deep Note")).toBe(
      "[Deep Note](<a/b/c/d/note.md>)",
    );
  });

  it("handles title with special characters", () => {
    expect(format_markdown_link("note.md", "Title [with] brackets")).toBe(
      "[Title [with] brackets](<note.md>)",
    );
  });
});

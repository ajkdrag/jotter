import { describe, expect, it } from "vitest";
import { resolve_editor_sync_open } from "$lib/reactors/editor_sync.reactor.svelte";
import { as_markdown_text, as_note_path } from "$lib/types/ids";

function open_note(buffer_id: string) {
  return {
    meta: {
      id: as_note_path("notes/a.md"),
      path: as_note_path("notes/a.md"),
      name: "a.md",
      title: "a",
      mtime_ms: 0,
      size_bytes: 0,
    },
    markdown: as_markdown_text("# A"),
    buffer_id,
    is_dirty: false,
  };
}

describe("editor_sync.reactor", () => {
  it("opens buffer when note id changes", () => {
    expect(
      resolve_editor_sync_open({
        open_note: open_note("notes/a.md"),
        link_syntax: "wikilink",
        last_note_id: "notes/b.md",
        last_buffer_id: "notes/b.md",
        last_link_syntax: "wikilink",
      }),
    ).toBe(true);
  });

  it("opens buffer when link syntax changes", () => {
    expect(
      resolve_editor_sync_open({
        open_note: open_note("notes/a.md"),
        link_syntax: "markdown",
        last_note_id: "notes/a.md",
        last_buffer_id: "notes/a.md",
        last_link_syntax: "wikilink",
      }),
    ).toBe(true);
  });

  it("opens buffer when buffer id changes for same note", () => {
    expect(
      resolve_editor_sync_open({
        open_note: open_note("notes/a.md:reload:1"),
        link_syntax: "wikilink",
        last_note_id: "notes/a.md",
        last_buffer_id: "notes/a.md",
        last_link_syntax: "wikilink",
      }),
    ).toBe(true);
  });

  it("does not reopen when note id, buffer id, and syntax are unchanged", () => {
    expect(
      resolve_editor_sync_open({
        open_note: open_note("notes/a.md"),
        link_syntax: "wikilink",
        last_note_id: "notes/a.md",
        last_buffer_id: "notes/a.md",
        last_link_syntax: "wikilink",
      }),
    ).toBe(false);
  });
});

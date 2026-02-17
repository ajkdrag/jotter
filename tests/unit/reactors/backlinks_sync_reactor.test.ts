import { describe, expect, it } from "vitest";
import { resolve_backlinks_sync_decision } from "$lib/reactors/backlinks_sync.reactor.svelte";

describe("backlinks_sync.reactor", () => {
  it("clears links when no note is open", () => {
    const result = resolve_backlinks_sync_decision(
      {
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_index_status: "completed",
        last_is_dirty: false,
      },
      {
        open_note_path: null,
        panel_open: true,
        index_status: "completed",
        is_dirty: false,
      },
    );

    expect(result.action).toBe("clear");
    expect(result.next_state.last_note_path).toBeNull();
  });

  it("loads when panel is opened for an already open note", () => {
    const result = resolve_backlinks_sync_decision(
      {
        last_note_path: "docs/a.md",
        last_panel_open: false,
        last_index_status: "idle",
        last_is_dirty: false,
      },
      {
        open_note_path: "docs/a.md",
        panel_open: true,
        index_status: "idle",
        is_dirty: false,
      },
    );

    expect(result.action).toBe("load");
    expect(result.note_path).toBe("docs/a.md");
  });

  it("loads when active note path changes while panel is open", () => {
    const result = resolve_backlinks_sync_decision(
      {
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_index_status: "indexing",
        last_is_dirty: false,
      },
      {
        open_note_path: "docs/b.md",
        panel_open: true,
        index_status: "indexing",
        is_dirty: false,
      },
    );

    expect(result.action).toBe("load");
    expect(result.note_path).toBe("docs/b.md");
  });

  it("loads when index transitions to completed while panel is open", () => {
    const result = resolve_backlinks_sync_decision(
      {
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_index_status: "indexing",
        last_is_dirty: false,
      },
      {
        open_note_path: "docs/a.md",
        panel_open: true,
        index_status: "completed",
        is_dirty: false,
      },
    );

    expect(result.action).toBe("load");
    expect(result.note_path).toBe("docs/a.md");
  });

  it("does nothing when panel is closed and no clear/load condition is met", () => {
    const result = resolve_backlinks_sync_decision(
      {
        last_note_path: "docs/a.md",
        last_panel_open: false,
        last_index_status: "indexing",
        last_is_dirty: false,
      },
      {
        open_note_path: "docs/a.md",
        panel_open: false,
        index_status: "completed",
        is_dirty: false,
      },
    );

    expect(result.action).toBe("noop");
  });

  it("loads when save completes while panel is open", () => {
    const result = resolve_backlinks_sync_decision(
      {
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_index_status: "completed",
        last_is_dirty: true,
      },
      {
        open_note_path: "docs/a.md",
        panel_open: true,
        index_status: "completed",
        is_dirty: false,
      },
    );

    expect(result.action).toBe("load");
    expect(result.note_path).toBe("docs/a.md");
  });

  it("does not load on save when panel is closed", () => {
    const result = resolve_backlinks_sync_decision(
      {
        last_note_path: "docs/a.md",
        last_panel_open: false,
        last_index_status: "completed",
        last_is_dirty: true,
      },
      {
        open_note_path: "docs/a.md",
        panel_open: false,
        index_status: "completed",
        is_dirty: false,
      },
    );

    expect(result.action).toBe("noop");
  });

  it("does not load when dirty stays false (no save transition)", () => {
    const result = resolve_backlinks_sync_decision(
      {
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_index_status: "completed",
        last_is_dirty: false,
      },
      {
        open_note_path: "docs/a.md",
        panel_open: true,
        index_status: "completed",
        is_dirty: false,
      },
    );

    expect(result.action).toBe("noop");
  });

  it("does not load when editing starts (dirty false to true)", () => {
    const result = resolve_backlinks_sync_decision(
      {
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_index_status: "completed",
        last_is_dirty: false,
      },
      {
        open_note_path: "docs/a.md",
        panel_open: true,
        index_status: "completed",
        is_dirty: true,
      },
    );

    expect(result.action).toBe("noop");
  });
});

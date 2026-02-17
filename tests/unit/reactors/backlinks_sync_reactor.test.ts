import { describe, expect, it } from "vitest";
import { resolve_backlinks_sync_decision } from "$lib/reactors/backlinks_sync.reactor.svelte";

describe("backlinks_sync.reactor", () => {
  it("clears links when no note is open", () => {
    const result = resolve_backlinks_sync_decision(
      {
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_index_status: "completed",
      },
      {
        open_note_path: null,
        panel_open: true,
        index_status: "completed",
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
      },
      {
        open_note_path: "docs/a.md",
        panel_open: true,
        index_status: "idle",
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
      },
      {
        open_note_path: "docs/b.md",
        panel_open: true,
        index_status: "indexing",
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
      },
      {
        open_note_path: "docs/a.md",
        panel_open: true,
        index_status: "completed",
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
      },
      {
        open_note_path: "docs/a.md",
        panel_open: false,
        index_status: "completed",
      },
    );

    expect(result.action).toBe("noop");
  });
});

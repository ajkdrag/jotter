import { describe, expect, it } from "vitest";
import { resolve_backlinks_sync_decision } from "$lib/reactors/backlinks_sync.reactor.svelte";

function state(
  input?: Partial<{
    last_note_path: string | null;
    last_panel_open: boolean;
    last_index_status: "idle" | "indexing" | "completed" | "failed";
    last_is_dirty: boolean;
    index_epoch: number;
    save_epoch: number;
    loaded_note_path: string | null;
    loaded_index_epoch: number;
    loaded_save_epoch: number;
  }>,
) {
  return {
    last_note_path: null,
    last_panel_open: false,
    last_index_status: "idle" as const,
    last_is_dirty: false,
    index_epoch: 0,
    save_epoch: 0,
    loaded_note_path: null,
    loaded_index_epoch: 0,
    loaded_save_epoch: 0,
    ...input,
  };
}

function input(
  value: Partial<{
    open_note_path: string | null;
    panel_open: boolean;
    index_status: "idle" | "indexing" | "completed" | "failed";
    is_dirty: boolean;
    snapshot_note_path: string | null;
    global_status: "idle" | "loading" | "ready" | "error";
  }>,
) {
  return {
    open_note_path: null,
    panel_open: false,
    index_status: "idle" as const,
    is_dirty: false,
    snapshot_note_path: null,
    global_status: "idle" as const,
    ...value,
  };
}

describe("backlinks_sync.reactor", () => {
  it("clears links when no note is open", () => {
    const result = resolve_backlinks_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_index_status: "completed",
      }),
      input({
        open_note_path: null,
        panel_open: true,
        index_status: "completed",
        is_dirty: false,
      }),
    );

    expect(result.action).toBe("clear");
    expect(result.next_state.last_note_path).toBeNull();
  });

  it("loads when panel is opened for an already open note", () => {
    const result = resolve_backlinks_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: false,
        last_index_status: "idle",
      }),
      input({
        open_note_path: "docs/a.md",
        panel_open: true,
        index_status: "idle",
        is_dirty: false,
        snapshot_note_path: null,
      }),
    );

    expect(result.action).toBe("load");
    expect(result.note_path).toBe("docs/a.md");
  });

  it("loads when active note path changes while panel is open", () => {
    const result = resolve_backlinks_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_index_status: "indexing",
        loaded_note_path: "docs/a.md",
      }),
      input({
        open_note_path: "docs/b.md",
        panel_open: true,
        index_status: "indexing",
        is_dirty: false,
        snapshot_note_path: "docs/a.md",
        global_status: "ready",
      }),
    );

    expect(result.action).toBe("load");
    expect(result.note_path).toBe("docs/b.md");
  });

  it("loads when index transitions to completed while panel is open", () => {
    const result = resolve_backlinks_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_index_status: "indexing",
        loaded_note_path: "docs/a.md",
        loaded_index_epoch: 0,
      }),
      input({
        open_note_path: "docs/a.md",
        panel_open: true,
        index_status: "completed",
        is_dirty: false,
        snapshot_note_path: "docs/a.md",
        global_status: "ready",
      }),
    );

    expect(result.action).toBe("load");
    expect(result.note_path).toBe("docs/a.md");
  });

  it("does nothing when panel is closed and no clear/load condition is met", () => {
    const result = resolve_backlinks_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: false,
        last_index_status: "indexing",
        loaded_note_path: "docs/a.md",
      }),
      input({
        open_note_path: "docs/a.md",
        panel_open: false,
        index_status: "completed",
        is_dirty: false,
        snapshot_note_path: "docs/a.md",
        global_status: "ready",
      }),
    );

    expect(result.action).toBe("noop");
  });

  it("loads when save completes while panel is open", () => {
    const result = resolve_backlinks_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_index_status: "completed",
        last_is_dirty: true,
        loaded_note_path: "docs/a.md",
      }),
      input({
        open_note_path: "docs/a.md",
        panel_open: true,
        index_status: "completed",
        is_dirty: false,
        snapshot_note_path: "docs/a.md",
        global_status: "ready",
      }),
    );

    expect(result.action).toBe("load");
    expect(result.note_path).toBe("docs/a.md");
  });

  it("does not load on save when panel is closed", () => {
    const result = resolve_backlinks_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: false,
        last_index_status: "completed",
        last_is_dirty: true,
        loaded_note_path: "docs/a.md",
      }),
      input({
        open_note_path: "docs/a.md",
        panel_open: false,
        index_status: "completed",
        is_dirty: false,
        snapshot_note_path: "docs/a.md",
        global_status: "ready",
      }),
    );

    expect(result.action).toBe("noop");
  });

  it("does not load when dirty stays false (no save transition)", () => {
    const result = resolve_backlinks_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_index_status: "completed",
        last_is_dirty: false,
        loaded_note_path: "docs/a.md",
      }),
      input({
        open_note_path: "docs/a.md",
        panel_open: true,
        index_status: "completed",
        is_dirty: false,
        snapshot_note_path: "docs/a.md",
        global_status: "ready",
      }),
    );

    expect(result.action).toBe("noop");
  });

  it("does not load when editing starts (dirty false to true)", () => {
    const result = resolve_backlinks_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_index_status: "completed",
        last_is_dirty: false,
        loaded_note_path: "docs/a.md",
      }),
      input({
        open_note_path: "docs/a.md",
        panel_open: true,
        index_status: "completed",
        is_dirty: true,
        snapshot_note_path: "docs/a.md",
        global_status: "ready",
      }),
    );

    expect(result.action).toBe("noop");
  });

  it("does not reload on panel reopen when snapshot is fresh", () => {
    const result = resolve_backlinks_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: false,
        last_index_status: "completed",
        loaded_note_path: "docs/a.md",
        index_epoch: 2,
        loaded_index_epoch: 2,
        save_epoch: 3,
        loaded_save_epoch: 3,
      }),
      input({
        open_note_path: "docs/a.md",
        panel_open: true,
        index_status: "completed",
        is_dirty: false,
        snapshot_note_path: "docs/a.md",
        global_status: "ready",
      }),
    );

    expect(result.action).toBe("noop");
  });

  it("reloads on panel reopen when save completed while panel was closed", () => {
    const result = resolve_backlinks_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: false,
        last_index_status: "completed",
        last_is_dirty: true,
        loaded_note_path: "docs/a.md",
        save_epoch: 1,
        loaded_save_epoch: 1,
      }),
      input({
        open_note_path: "docs/a.md",
        panel_open: true,
        index_status: "completed",
        is_dirty: false,
        snapshot_note_path: "docs/a.md",
        global_status: "ready",
      }),
    );

    expect(result.action).toBe("load");
  });
});

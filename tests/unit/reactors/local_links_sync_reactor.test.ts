import { describe, expect, it } from "vitest";
import { resolve_local_links_sync_decision } from "$lib/reactors/local_links_sync.reactor.svelte";

function state(
  input?: Partial<{
    last_note_path: string | null;
    last_panel_open: boolean;
    last_markdown: string | null;
  }>,
) {
  return {
    last_note_path: null,
    last_panel_open: false,
    last_markdown: null,
    ...input,
  };
}

describe("local_links_sync.reactor", () => {
  it("clears when no note is open", () => {
    const result = resolve_local_links_sync_decision(state(), {
      open_note_path: null,
      panel_open: true,
      markdown: null,
    });

    expect(result.action).toBe("clear");
  });

  it("computes immediately when panel opens", () => {
    const result = resolve_local_links_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: false,
        last_markdown: "old",
      }),
      {
        open_note_path: "docs/a.md",
        panel_open: true,
        markdown: "old",
      },
    );

    expect(result.action).toBe("compute_now");
  });

  it("computes immediately when note path changes", () => {
    const result = resolve_local_links_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_markdown: "same",
      }),
      {
        open_note_path: "docs/b.md",
        panel_open: true,
        markdown: "same",
      },
    );

    expect(result.action).toBe("compute_now");
  });

  it("debounces recompute while typing with panel open", () => {
    const result = resolve_local_links_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_markdown: "old",
      }),
      {
        open_note_path: "docs/a.md",
        panel_open: true,
        markdown: "new",
      },
    );

    expect(result.action).toBe("compute_debounced");
  });

  it("cancels work while panel is closed", () => {
    const result = resolve_local_links_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_markdown: "old",
      }),
      {
        open_note_path: "docs/a.md",
        panel_open: false,
        markdown: "new",
      },
    );

    expect(result.action).toBe("cancel");
  });

  it("does nothing when state is unchanged", () => {
    const result = resolve_local_links_sync_decision(
      state({
        last_note_path: "docs/a.md",
        last_panel_open: true,
        last_markdown: "same",
      }),
      {
        open_note_path: "docs/a.md",
        panel_open: true,
        markdown: "same",
      },
    );

    expect(result.action).toBe("noop");
  });
});

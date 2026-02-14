import { describe, expect, it, vi } from "vitest";
import { create_git_autocommit_reactor } from "$lib/reactors/git_autocommit.reactor.svelte";

describe("git_autocommit.reactor", () => {
  it("returns a cleanup function", () => {
    const unmount = create_git_autocommit_reactor(
      {
        open_note: {
          is_dirty: false,
          meta: { path: "notes/test.md" },
        },
      } as never,
      { enabled: false } as never,
      { auto_commit: vi.fn() } as never,
    );

    expect(typeof unmount).toBe("function");
    unmount();
  });
});

import { describe, expect, it, vi } from "vitest";
import { ActionRegistry } from "$lib/app/action_registry/action_registry";

describe("ActionRegistry", () => {
  it("executes registered actions", async () => {
    const registry = new ActionRegistry();
    const execute = vi.fn();

    registry.register({
      id: "test.action",
      label: "Test Action",
      execute,
    });

    await registry.execute("test.action", "a", "b");

    expect(execute).toHaveBeenCalledWith("a", "b");
  });

  it("skips actions when predicate fails", async () => {
    const registry = new ActionRegistry();
    const execute = vi.fn();

    registry.register({
      id: "test.disabled",
      label: "Disabled",
      when: () => false,
      execute,
    });

    await registry.execute("test.disabled");

    expect(execute).not.toHaveBeenCalled();
  });
});

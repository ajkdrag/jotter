import { describe, it, expect } from "vitest";
import { create_test_settings_adapter } from "../../adapters/test_settings_adapter";

describe("test_settings_adapter", () => {
  it("stores and retrieves settings", async () => {
    const adapter = create_test_settings_adapter();

    await adapter.set_setting("editor", { font_size: 2 });
    const result = await adapter.get_setting<{ font_size: number }>("editor");

    expect(result).toEqual({ font_size: 2 });
  });
});

import { describe, it, expect } from "vitest";
import { cn } from "$lib/shared/utils/component_utils";

describe("cn", () => {
  it("merges class names and removes duplicates", () => {
    expect(cn("px-2", "px-2", "text-sm")).toBe("px-2 text-sm");
  });
});

import { describe, expect, it } from "vitest";
import { as_asset_path, as_note_path } from "$lib/types/ids";
import { to_markdown_asset_target } from "$lib/utils/asset_markdown_path";

describe("to_markdown_asset_target", () => {
  it("builds relative path for same folder assets", () => {
    const target = to_markdown_asset_target(
      as_note_path("docs/alpha.md"),
      as_asset_path("docs/.assets/alpha-1.png"),
    );

    expect(target).toBe(".assets/alpha-1.png");
  });

  it("builds relative path across sibling folders", () => {
    const target = to_markdown_asset_target(
      as_note_path("docs/alpha.md"),
      as_asset_path("images/pasted.png"),
    );

    expect(target).toBe("../images/pasted.png");
  });

  it("encodes path segments for markdown links", () => {
    const target = to_markdown_asset_target(
      as_note_path("notes/day 1.md"),
      as_asset_path("notes/.assets/hello world.png"),
    );

    expect(target).toBe(".assets/hello%20world.png");
  });
});

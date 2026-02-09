import { describe, expect, it } from "vitest";
import {
  build_key_map,
  normalize_key,
  resolve_wiki_target,
  wiki_link_targets,
} from "$lib/adapters/web/wiki_links_web";

describe("wiki_links_web", () => {
  it("extracts wiki link targets from markdown", () => {
    const markdown = "[[Alpha]] [[Beta|Label]] [[Gamma#Section]]";
    expect(wiki_link_targets(markdown)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("builds key map from title, stem, and path", () => {
    const map = build_key_map([
      { path: "docs/alpha.md", title: "Alpha" },
      { path: "notes/beta.md", title: "Beta" },
    ]);

    expect(map.get("alpha")).toBe("docs/alpha.md");
    expect(map.get("beta")).toBe("notes/beta.md");
    expect(map.get("docs/alpha.md")).toBe("docs/alpha.md");
    expect(map.get("docs/alpha")).toBe("docs/alpha.md");
  });

  it("resolves direct paths and stem/title keys", () => {
    const map = build_key_map([
      { path: "docs/alpha.md", title: "Alpha" },
      { path: "notes/beta.md", title: "Beta Note" },
    ]);

    expect(resolve_wiki_target("docs/alpha", map)).toBe("docs/alpha.md");
    expect(resolve_wiki_target("docs/alpha.md", map)).toBe("docs/alpha.md");
    expect(resolve_wiki_target("Beta Note", map)).toBe("notes/beta.md");
    expect(resolve_wiki_target("unknown", map)).toBeNull();
  });

  it("normalizes keys with trim + lowercase", () => {
    expect(normalize_key("  HeLLo  ")).toBe("hello");
  });
});

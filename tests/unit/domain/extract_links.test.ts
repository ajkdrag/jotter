import { describe, expect, it } from "vitest";
import { extract_external_links } from "$lib/domain/extract_links";

describe("extract_external_links", () => {
  it("extracts http and https links", () => {
    const markdown =
      "[Google](https://google.com) and [HTTP](http://example.com)";
    const result = extract_external_links(markdown);
    expect(result).toEqual([
      { url: "https://google.com", text: "Google" },
      { url: "http://example.com", text: "HTTP" },
    ]);
  });

  it("deduplicates by URL", () => {
    const markdown = "[A](https://foo.com) and [B](https://foo.com)";
    const result = extract_external_links(markdown);
    expect(result).toHaveLength(1);
    expect(result[0]?.text).toBe("A");
  });

  it("returns empty for no external links", () => {
    expect(extract_external_links("[note](note.md)")).toEqual([]);
  });
});

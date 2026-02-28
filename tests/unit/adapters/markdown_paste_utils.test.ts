import { describe, it, expect } from "vitest";
import {
  looks_like_markdown,
  pick_paste_mode,
} from "$lib/features/editor/adapters/markdown_paste_utils";

describe("looks_like_markdown", () => {
  it("detects headings", () => {
    expect(looks_like_markdown("# Title")).toBe(true);
  });

  it("detects lists", () => {
    expect(looks_like_markdown("- item")).toBe(true);
    expect(looks_like_markdown("1. item")).toBe(true);
  });

  it("detects code fences", () => {
    expect(looks_like_markdown("```js\nconst x = 1\n```")).toBe(true);
  });

  it("detects blockquotes", () => {
    expect(looks_like_markdown("> quoted")).toBe(true);
  });

  it("detects links and images", () => {
    expect(looks_like_markdown("[label](https://example.com)")).toBe(true);
    expect(looks_like_markdown("![alt](https://example.com/img.png)")).toBe(
      true,
    );
  });

  it("detects inline emphasis and code", () => {
    expect(looks_like_markdown("Use **bold** here")).toBe(true);
    expect(looks_like_markdown("Use `code` here")).toBe(true);
  });

  it("does not match plain text", () => {
    expect(looks_like_markdown("Just a sentence with no markdown.")).toBe(
      false,
    );
  });
});

describe("pick_paste_mode", () => {
  it("prefers text/markdown over html", () => {
    expect(
      pick_paste_mode({
        text_markdown: "# Title",
        text_plain: "",
        text_html: "<h1>Title</h1>",
      }),
    ).toBe("markdown");
  });

  it("uses markdown when plain text looks like markdown", () => {
    expect(
      pick_paste_mode({
        text_markdown: "",
        text_plain: "- item",
        text_html: "",
      }),
    ).toBe("markdown");
  });

  it("falls back to html when no markdown is detected", () => {
    expect(
      pick_paste_mode({
        text_markdown: "",
        text_plain: "Just text",
        text_html: "<p>Just text</p>",
      }),
    ).toBe("html");
  });

  it("returns none when clipboard is empty", () => {
    expect(
      pick_paste_mode({
        text_markdown: "",
        text_plain: "",
        text_html: "",
      }),
    ).toBe("none");
  });
});

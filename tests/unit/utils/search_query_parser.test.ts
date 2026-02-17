import { describe, it, expect } from "vitest";
import { parse_search_query } from "$lib/domain/search_query_parser";

describe("parse_search_query", () => {
  it("parses path scope", () => {
    const result = parse_search_query("path: foo bar");
    expect(result.scope).toBe("path");
    expect(result.text).toBe("foo bar");
    expect(result.domain).toBe("notes");
  });

  it("parses content scope without space", () => {
    const result = parse_search_query("content:foo");
    expect(result.scope).toBe("content");
    expect(result.text).toBe("foo");
    expect(result.domain).toBe("notes");
  });

  it("defaults to all scope and notes domain", () => {
    const result = parse_search_query("hello world");
    expect(result.scope).toBe("all");
    expect(result.text).toBe("hello world");
    expect(result.domain).toBe("notes");
  });

  it("returns empty text and notes domain for blank input", () => {
    const result = parse_search_query("   ");
    expect(result.text).toBe("");
    expect(result.scope).toBe("all");
    expect(result.domain).toBe("notes");
  });

  it("detects commands domain with > prefix", () => {
    const result = parse_search_query(">open settings");
    expect(result.domain).toBe("commands");
    expect(result.text).toBe("open settings");
    expect(result.scope).toBe("all");
  });

  it("detects commands domain with > prefix and extra spaces", () => {
    const result = parse_search_query(">  create note");
    expect(result.domain).toBe("commands");
    expect(result.text).toBe("create note");
  });

  it("detects commands domain with bare > prefix", () => {
    const result = parse_search_query(">");
    expect(result.domain).toBe("commands");
    expect(result.text).toBe("");
  });

  it("detects planned domain with #planned prefix", () => {
    const result = parse_search_query("#planned architecture");
    expect(result.domain).toBe("planned");
    expect(result.text).toBe("architecture");
    expect(result.scope).toBe("all");
  });

  it("detects planned domain case-insensitively", () => {
    const result = parse_search_query("#Planned");
    expect(result.domain).toBe("planned");
    expect(result.text).toBe("");
  });

  it("preserves raw value", () => {
    const result = parse_search_query("path: test");
    expect(result.raw).toBe("path: test");
  });

  it("parses title scope case-insensitively", () => {
    const result = parse_search_query("Title:meeting notes");
    expect(result.scope).toBe("title");
    expect(result.text).toBe("meeting notes");
    expect(result.domain).toBe("notes");
  });
});

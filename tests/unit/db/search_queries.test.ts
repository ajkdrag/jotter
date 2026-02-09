import { describe, expect, it } from "vitest";
import {
  SEARCH_BM25_WEIGHTS,
  SEARCH_SNIPPET_SQL,
  SEARCH_SQL,
  SUGGEST_BM25_WEIGHTS,
  SUGGEST_SQL,
  escape_fts_prefix_query,
  escape_fts_query,
  search_match_expression,
  suggest_match_expression,
} from "$lib/db/search_queries";

describe("search_queries", () => {
  it("escapes search terms as quoted tokens", () => {
    expect(escape_fts_query("alpha beta")).toBe('"alpha" "beta"');
    expect(escape_fts_query('alpha "beta"')).toBe('"alpha" "beta"');
  });

  it("builds prefix queries with sanitization", () => {
    expect(escape_fts_prefix_query("alpha beta")).toBe('"alpha"* "beta"*');
    expect(escape_fts_prefix_query("a! b@")).toBe('"a"* "b"*');
    expect(escape_fts_prefix_query("!!!")).toBe("");
  });

  it("builds scope-aware MATCH expressions", () => {
    expect(search_match_expression("alpha", "all")).toBe('"alpha"');
    expect(search_match_expression("alpha", "title")).toBe('title : "alpha"');
    expect(search_match_expression("alpha", "path")).toBe('path : "alpha"');
    expect(search_match_expression("alpha", "content")).toBe('body : "alpha"');
  });

  it("builds wiki suggest expression on title/path columns", () => {
    expect(suggest_match_expression("wiki link")).toBe(
      '{title path} : "wiki"* "link"*',
    );
  });

  it("keeps SQL constants aligned with FTS parity settings", () => {
    expect(SEARCH_BM25_WEIGHTS).toEqual({ title: 10, path: 5, body: 1 });
    expect(SUGGEST_BM25_WEIGHTS).toEqual({ title: 15, path: 5, body: 0 });
    expect(SEARCH_SNIPPET_SQL).toContain("snippet(notes_fts, 2");
    expect(SEARCH_SQL).toContain("bm25(notes_fts, 10.0, 5.0, 1.0)");
    expect(SUGGEST_SQL).toContain("bm25(notes_fts, 15.0, 5.0, 0.0)");
  });
});

import type { SearchQuery, SearchScope } from "$lib/types/search";

const scope_tokens: Array<{ token: string; scope: SearchScope }> = [
  { token: "path:", scope: "path" },
  { token: "content:", scope: "content" },
  { token: "title:", scope: "title" },
];

export function parse_search_query(raw: string): SearchQuery {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { raw, text: "", scope: "all", domain: "notes" };
  }

  if (trimmed.startsWith(">")) {
    return {
      raw,
      text: trimmed.slice(1).trim(),
      scope: "all",
      domain: "commands",
    };
  }

  const lower = trimmed.toLowerCase();
  for (const { token, scope } of scope_tokens) {
    if (lower.startsWith(token)) {
      return {
        raw,
        text: trimmed.slice(token.length).trim(),
        scope,
        domain: "notes",
      };
    }
  }

  return { raw, text: trimmed, scope: "all", domain: "notes" };
}

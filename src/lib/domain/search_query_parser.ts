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

  const lower = trimmed.toLowerCase();

  if (trimmed.startsWith(">")) {
    return {
      raw,
      text: trimmed.slice(1).trim(),
      scope: "all",
      domain: "commands",
    };
  }

  if (lower === "#planned" || lower.startsWith("#planned ")) {
    return {
      raw,
      text: trimmed.slice("#planned".length).trim(),
      scope: "all",
      domain: "planned",
    };
  }

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

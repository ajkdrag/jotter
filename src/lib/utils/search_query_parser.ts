import type { SearchQuery, SearchScope } from '$lib/types/search'

const scope_tokens: Array<{ token: string; scope: SearchScope }> = [
  { token: 'path:', scope: 'path' },
  { token: 'content:', scope: 'content' },
  { token: 'title:', scope: 'title' }
]

export function parse_search_query(raw: string): SearchQuery {
  const trimmed = raw.trim()
  if (!trimmed) {
    return { raw, text: '', scope: 'all' }
  }

  const lower = trimmed.toLowerCase()
  for (const { token, scope } of scope_tokens) {
    if (lower.startsWith(token)) {
      return {
        raw,
        text: trimmed.slice(token.length).trim(),
        scope
      }
    }
  }

  return { raw, text: trimmed, scope: 'all' }
}

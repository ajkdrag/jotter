import { ports } from '$lib/adapters/ports'
import { app_state } from '$lib/adapters/state/app_state.svelte'
import type { SearchHit } from '$lib/types/search'

function fallback_search(query: string): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits = app_state.notes
    .filter((n) => n.title.toLowerCase().includes(q) || n.path.toLowerCase().includes(q))
    .slice(0, 50)
    .map((note, idx) => ({ note, score: 1 - idx / 100 }))
  return hits
}

export function create_search_workflow() {
  return {
    async search(query: string): Promise<SearchHit[]> {
      const vault = app_state.vault
      if (!vault) return []
      try {
        const hits = await ports.index.search(vault.id, query)
        if (hits.length > 0) return hits
        return fallback_search(query)
      } catch {
        return fallback_search(query)
      }
    }
  }
}


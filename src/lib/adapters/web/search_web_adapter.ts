import type { SearchPort } from '$lib/ports/search_port'
import type { VaultId } from '$lib/types/ids'
import type { NoteSearchHit, WikiSuggestion } from '$lib/types/search'
import type { SearchIndexWeb } from '$lib/adapters/web/search_index_web'
import type { SearchQuery } from '$lib/types/search'

export function create_search_web_adapter(search_index: SearchIndexWeb): SearchPort {
  return {
    search_notes(vault_id: VaultId, query: SearchQuery, limit = 50): Promise<NoteSearchHit[]> {
      return Promise.resolve(search_index.search(vault_id, query, limit))
    },

    suggest_wiki_links(_vault_id: VaultId, _query: string, _limit?: number): Promise<WikiSuggestion[]> {
      return Promise.resolve([])
    }
  }
}

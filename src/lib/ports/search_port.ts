import type { VaultId } from '$lib/types/ids'
import type { NoteSearchHit, SearchQuery } from '$lib/types/search'

export interface SearchPort {
  search_notes(vault_id: VaultId, query: SearchQuery, limit?: number): Promise<NoteSearchHit[]>
}

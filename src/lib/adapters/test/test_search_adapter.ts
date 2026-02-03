import type { SearchPort } from '$lib/ports/search_port'
import type { VaultId } from '$lib/types/ids'
import type { NoteSearchHit } from '$lib/types/search'

export function create_test_search_adapter(): SearchPort {
  return {
    async search_notes(_vault_id: VaultId, _query: string, _limit?: number): Promise<NoteSearchHit[]> {
      return []
    }
  }
}

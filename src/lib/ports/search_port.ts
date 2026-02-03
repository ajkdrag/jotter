import type { VaultId } from '$lib/types/ids'
import type { NoteSearchHit } from '$lib/types/search'

export interface SearchPort {
  search_notes(vault_id: VaultId, query: string, limit?: number): Promise<NoteSearchHit[]>
}

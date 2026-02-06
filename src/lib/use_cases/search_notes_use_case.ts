import type { SearchPort } from '$lib/ports/search_port'
import type { VaultId } from '$lib/types/ids'
import type { NoteSearchHit, SearchQuery } from '$lib/types/search'

export async function search_notes_use_case(
  ports: { search: SearchPort },
  args: { vault_id: VaultId; query: SearchQuery; limit?: number }
): Promise<NoteSearchHit[]> {
  return ports.search.search_notes(args.vault_id, args.query, args.limit)
}

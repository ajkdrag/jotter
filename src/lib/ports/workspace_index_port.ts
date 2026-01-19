import type { NoteId, VaultId } from '$lib/types/ids'
import type { SearchHit } from '$lib/types/search'
import type { NoteMeta } from '$lib/types/note'

export interface WorkspaceIndexPort {
  build_index(vault_id: VaultId): Promise<void>
  search(vault_id: VaultId, query: string): Promise<SearchHit[]>
  backlinks(vault_id: VaultId, note_id: NoteId): Promise<NoteMeta[]>
  outlinks(vault_id: VaultId, note_id: NoteId): Promise<NoteMeta[]>
}


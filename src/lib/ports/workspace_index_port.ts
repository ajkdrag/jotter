import type { NoteId, VaultId } from '$lib/types/ids'

export interface WorkspaceIndexPort {
  build_index(vault_id: VaultId): Promise<void>
  upsert_note(vault_id: VaultId, note_id: NoteId): Promise<void>
  remove_note(vault_id: VaultId, note_id: NoteId): Promise<void>
}

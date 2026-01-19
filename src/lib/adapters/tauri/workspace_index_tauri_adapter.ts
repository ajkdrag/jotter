import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { NoteId, VaultId } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { SearchHit } from '$lib/types/search'
import { tauri_invoke } from '$lib/adapters/tauri/tauri_invoke'

export function create_workspace_index_tauri_adapter(): WorkspaceIndexPort {
  return {
    async build_index(vault_id: VaultId) {
      await tauri_invoke<void>('index_build', { vaultId: vault_id })
    },
    async search(vault_id: VaultId, query: string): Promise<SearchHit[]> {
      return await tauri_invoke<SearchHit[]>('index_search', { vaultId: vault_id, query })
    },
    async backlinks(vault_id: VaultId, note_id: NoteId): Promise<NoteMeta[]> {
      return await tauri_invoke<NoteMeta[]>('index_backlinks', { vaultId: vault_id, noteId: note_id })
    },
    async outlinks(vault_id: VaultId, note_id: NoteId): Promise<NoteMeta[]> {
      return await tauri_invoke<NoteMeta[]>('index_outlinks', { vaultId: vault_id, noteId: note_id })
    }
  }
}


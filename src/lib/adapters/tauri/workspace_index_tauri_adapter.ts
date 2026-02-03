import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId } from '$lib/types/ids'
import { tauri_invoke } from '$lib/adapters/tauri/tauri_invoke'

export function create_workspace_index_tauri_adapter(): WorkspaceIndexPort {
  return {
    async build_index(vault_id: VaultId) {
      await tauri_invoke<void>('index_build', { vaultId: vault_id })
    }
  }
}

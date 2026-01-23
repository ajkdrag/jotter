import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId } from '$lib/types/ids'

export function create_workspace_index_web_adapter(): WorkspaceIndexPort {
  return {
    async build_index(_vault_id: VaultId): Promise<void> {}
  }
}


import type { VaultId } from '$lib/types/ids'

export interface WorkspaceIndexPort {
  build_index(vault_id: VaultId): Promise<void>
}

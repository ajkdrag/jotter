import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultPath } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { NoteMeta } from '$lib/types/note'
import { change_vault } from '$lib/operations/change_vault'

export async function startup_app(
  ports: { vault: VaultPort; notes: NotesPort; index: WorkspaceIndexPort },
  args: {
    bootstrap_vault_path: VaultPath | null
    current_app_state: 'no_vault' | 'vault_open'
  }
): Promise<{
  recent_vaults: Vault[]
  bootstrapped_vault: { vault: Vault; notes: NoteMeta[]; folder_paths: string[] } | null
}> {
  const { bootstrap_vault_path, current_app_state } = args

  const recent_vaults = await ports.vault.list_vaults()

  if (current_app_state === 'no_vault' && bootstrap_vault_path) {
    const result = await change_vault(
      { vault: ports.vault, notes: ports.notes },
      { vault_path: bootstrap_vault_path }
    )
    void ports.index.build_index(result.vault.id)

    return { recent_vaults, bootstrapped_vault: result }
  }

  return { recent_vaults, bootstrapped_vault: null }
}

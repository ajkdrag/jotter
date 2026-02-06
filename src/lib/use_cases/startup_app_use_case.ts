import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultPath } from '$lib/types/ids'
import type { AppEvent } from '$lib/events/app_event'
import { change_vault_use_case } from '$lib/use_cases/change_vault_use_case'

export async function startup_app_use_case(
  ports: { vault: VaultPort; notes: NotesPort; index: WorkspaceIndexPort },
  args: { bootstrap_vault_path: VaultPath | null; current_app_state: 'no_vault' | 'vault_open' },
  now_ms: number
): Promise<AppEvent[]> {
  if (args.current_app_state === 'no_vault' && args.bootstrap_vault_path) {
    return await change_vault_use_case(
      { vault: ports.vault, notes: ports.notes, index: ports.index },
      { vault_path: args.bootstrap_vault_path },
      now_ms
    )
  }

  const recent_vaults = await ports.vault.list_vaults()
  return [{ type: 'recent_vaults_set', vaults: recent_vaults }]
}

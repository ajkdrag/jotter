import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId, VaultPath } from '$lib/types/ids'
import type { AppEvent } from '$lib/events/app_event'
import { ensure_open_note } from '$lib/operations/ensure_open_note'

export async function change_vault_use_case(
  ports: { vault: VaultPort; notes: NotesPort; index: WorkspaceIndexPort },
  args: { vault_path: VaultPath } | { vault_id: VaultId },
  now_ms: number
): Promise<AppEvent[]> {
  const vault = 'vault_path' in args
    ? await ports.vault.open_vault(args.vault_path)
    : await ports.vault.open_vault_by_id(args.vault_id)

  await ports.vault.remember_last_vault(vault.id)

  const notes = await ports.notes.list_notes(vault.id)
  const folder_paths = await ports.notes.list_folders(vault.id)
  const recent_vaults = await ports.vault.list_vaults()

  await ports.index.build_index(vault.id)

  const open_note = ensure_open_note({
    vault,
    notes,
    open_note: null,
    now_ms
  })

  const events: AppEvent[] = [
    { type: 'vault_cleared' },
    { type: 'notes_set', notes: [] },
    { type: 'folders_set', folder_paths: [] },
    { type: 'open_note_cleared' },
    { type: 'vault_set', vault },
    { type: 'notes_set', notes },
    { type: 'folders_set', folder_paths },
    { type: 'recent_vaults_set', vaults: recent_vaults }
  ]

  if (open_note) {
    events.push({ type: 'open_note_set', open_note })
  }

  return events
}

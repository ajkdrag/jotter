import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultPort } from '$lib/ports/vault_port'
import type { VaultPath, VaultId } from '$lib/types/ids'
import type { NoteMeta } from '$lib/types/note'
import type { Vault } from '$lib/types/vault'

export async function change_vault(
  ports: { vault: VaultPort; notes: NotesPort },
  args: { vault_path: VaultPath } | { vault_id: VaultId }
): Promise<{ vault: Vault; notes: NoteMeta[]; folder_paths: string[] }> {
  const vault = 'vault_path' in args
    ? await ports.vault.open_vault(args.vault_path)
    : await ports.vault.open_vault_by_id(args.vault_id)

  const [notes, folder_paths] = await Promise.all([
    ports.notes.list_notes(vault.id),
    ports.notes.list_folders(vault.id)
  ])
  await ports.vault.remember_last_vault(vault.id)
  return { vault, notes, folder_paths }
}

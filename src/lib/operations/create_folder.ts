import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultId } from '$lib/types/ids'

export async function create_folder_and_refresh(
  ports: { notes: NotesPort },
  args: {
    vault_id: VaultId
    parent_path: string
    folder_name: string
  }
): Promise<{ folder_paths: string[] }> {
  const { vault_id, parent_path, folder_name } = args

  await ports.notes.create_folder(vault_id, parent_path, folder_name.trim())
  const folder_paths = await ports.notes.list_folders(vault_id)

  return { folder_paths }
}

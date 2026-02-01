import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultId } from '$lib/types/ids'

export async function create_folder(
  ports: { notes: NotesPort },
  args: {
    vault_id: VaultId
    parent_path: string
    folder_name: string
  }
): Promise<{ new_folder_path: string }> {
  const { vault_id, parent_path, folder_name } = args
  const trimmed_name = folder_name.trim()

  await ports.notes.create_folder(vault_id, parent_path, trimmed_name)

  const new_folder_path = parent_path ? `${parent_path}/${trimmed_name}` : trimmed_name
  return { new_folder_path }
}

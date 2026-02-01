import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultId, NotePath } from '$lib/types/ids'

export async function delete_folder(
  ports: { notes: NotesPort },
  args: { vault_id: VaultId; folder_path: string }
): Promise<{ deleted_notes: NotePath[]; deleted_folders: string[] }> {
  return await ports.notes.delete_folder(args.vault_id, args.folder_path)
}

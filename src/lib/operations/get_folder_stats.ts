import type { NotesPort, FolderStats } from '$lib/ports/notes_port'
import type { VaultId } from '$lib/types/ids'

export async function get_folder_stats(
  ports: { notes: NotesPort },
  args: { vault_id: VaultId; folder_path: string }
): Promise<FolderStats> {
  return await ports.notes.get_folder_stats(args.vault_id, args.folder_path)
}

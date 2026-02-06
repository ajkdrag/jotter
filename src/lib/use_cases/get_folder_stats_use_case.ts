import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultId } from '$lib/types/ids'
import type { FolderStats } from '$lib/ports/notes_port'

export async function get_folder_stats_use_case(
  ports: { notes: NotesPort },
  args: { vault_id: VaultId; folder_path: string }
): Promise<FolderStats> {
  return await ports.notes.get_folder_stats(args.vault_id, args.folder_path)
}

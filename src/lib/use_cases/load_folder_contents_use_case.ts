import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultId } from '$lib/types/ids'
import type { AppEvent } from '$lib/events/app_event'

export async function load_folder_contents_use_case(
  ports: { notes: NotesPort },
  args: { vault_id: VaultId; folder_path: string }
): Promise<AppEvent[]> {
  const contents = await ports.notes.list_folder_contents(args.vault_id, args.folder_path)
  return [{ type: 'folder_contents_merged', folder_path: args.folder_path, contents }]
}

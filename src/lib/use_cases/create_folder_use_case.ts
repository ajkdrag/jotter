import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultId } from '$lib/types/ids'
import type { AppEvent } from '$lib/events/app_event'

export async function create_folder_use_case(
  ports: { notes: NotesPort },
  args: { vault_id: VaultId; parent_path: string; folder_name: string }
): Promise<AppEvent[]> {
  const trimmed_name = args.folder_name.trim()
  await ports.notes.create_folder(args.vault_id, args.parent_path, trimmed_name)
  const new_folder_path = args.parent_path ? `${args.parent_path}/${trimmed_name}` : trimmed_name

  return [{ type: 'folder_added', folder_path: new_folder_path }]
}

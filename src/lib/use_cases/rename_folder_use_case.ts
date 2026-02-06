import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId } from '$lib/types/ids'
import type { OpenNoteState } from '$lib/types/editor'
import type { NoteMeta } from '$lib/types/note'
import type { AppEvent } from '$lib/events/app_event'

export async function rename_folder_use_case(
  ports: { notes: NotesPort; index: WorkspaceIndexPort },
  args: {
    vault_id: VaultId
    folder_path: string
    new_path: string
    current_notes: NoteMeta[]
    current_open_note: OpenNoteState | null
  }
): Promise<AppEvent[]> {
  const old_prefix = args.folder_path + '/'
  const new_prefix = args.new_path + '/'

  const affected_notes = args.current_notes.filter((note) => note.path.startsWith(old_prefix))

  await ports.notes.rename_folder(args.vault_id, args.folder_path, args.new_path)
  if (affected_notes.length > 0) {
    await ports.index.build_index(args.vault_id)
  }

  const events: AppEvent[] = [
    { type: 'folder_renamed', old_path: args.folder_path, new_path: args.new_path }
  ]

  if (args.current_open_note?.meta.path.startsWith(old_prefix)) {
    events.push({
      type: 'open_note_path_prefix_updated',
      old_prefix,
      new_prefix
    })
  }

  return events
}

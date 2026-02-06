import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { NoteMeta } from '$lib/types/note'
import type { NotePath, VaultId } from '$lib/types/ids'
import type { AppEvent } from '$lib/events/app_event'

export async function rename_note_use_case(
  ports: { notes: NotesPort; index: WorkspaceIndexPort },
  args: {
    vault_id: VaultId
    note: NoteMeta
    new_path: NotePath
    is_note_currently_open: boolean
  }
): Promise<AppEvent[]> {
  await ports.notes.rename_note(args.vault_id, args.note.path, args.new_path)

  await ports.index.remove_note(args.vault_id, args.note.id)
  await ports.index.upsert_note(args.vault_id, args.new_path)

  const events: AppEvent[] = [
    { type: 'note_renamed', old_path: args.note.path, new_path: args.new_path }
  ]

  if (args.is_note_currently_open) {
    events.push({ type: 'open_note_path_updated', new_path: args.new_path })
  }

  return events
}

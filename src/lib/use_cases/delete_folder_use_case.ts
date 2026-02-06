import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { VaultId } from '$lib/types/ids'
import type { Vault } from '$lib/types/vault'
import type { OpenNoteState } from '$lib/types/editor'
import type { NoteMeta } from '$lib/types/note'
import type { AppEvent } from '$lib/events/app_event'
import { ensure_open_note } from '$lib/operations/ensure_open_note'

export async function delete_folder_use_case(
  ports: { notes: NotesPort; index: WorkspaceIndexPort },
  args: {
    vault_id: VaultId
    folder_path: string
    contains_open_note: boolean
    current_vault: Vault | null
    current_notes: NoteMeta[]
    current_open_note: OpenNoteState | null
    now_ms: number
  }
): Promise<AppEvent[]> {
  const prefix = args.folder_path + '/'

  const result = await ports.notes.delete_folder(args.vault_id, args.folder_path)

  for (const note_id of result.deleted_notes) {
    await ports.index.remove_note(args.vault_id, note_id)
  }

  const remaining_notes = args.current_notes.filter((note) => !note.path.startsWith(prefix))
  const base_open_note = args.contains_open_note ? null : args.current_open_note
  const ensured = ensure_open_note({
    vault: args.current_vault,
    notes: remaining_notes,
    open_note: base_open_note,
    now_ms: args.now_ms
  })

  const events: AppEvent[] = [
    { type: 'folder_removed', folder_path: args.folder_path }
  ]

  if (args.contains_open_note) {
    events.push({ type: 'open_note_cleared' })
  }

  if (ensured) {
    events.push({ type: 'open_note_set', open_note: ensured })
  }

  return events
}

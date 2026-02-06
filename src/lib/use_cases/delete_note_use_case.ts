import type { NotesPort } from '$lib/ports/notes_port'
import type { WorkspaceIndexPort } from '$lib/ports/workspace_index_port'
import type { NoteMeta } from '$lib/types/note'
import type { Vault } from '$lib/types/vault'
import type { OpenNoteState } from '$lib/types/editor'
import type { VaultId } from '$lib/types/ids'
import { ensure_open_note } from '$lib/operations/ensure_open_note'
import type { AppEvent } from '$lib/events/app_event'

export async function delete_note_use_case(
  ports: { notes: NotesPort; index: WorkspaceIndexPort },
  args: {
    vault_id: VaultId
    note: NoteMeta
    is_note_currently_open: boolean
    current_vault: Vault | null
    current_notes: NoteMeta[]
    current_open_note: OpenNoteState | null
    now_ms: number
  }
): Promise<AppEvent[]> {
  await ports.notes.delete_note(args.vault_id, args.note.id)

  const remaining_notes = args.current_notes.filter((n) => n.id !== args.note.id)

  const base_open_note = args.is_note_currently_open ? null : args.current_open_note
  const ensured = ensure_open_note({
    vault: args.current_vault,
    notes: remaining_notes,
    open_note: base_open_note,
    now_ms: args.now_ms
  })

  await ports.index.remove_note(args.vault_id, args.note.id)

  const events: AppEvent[] = [
    { type: 'note_removed', note_id: args.note.id }
  ]

  if (args.is_note_currently_open) {
    events.push({ type: 'open_note_cleared' })
  }

  if (ensured) {
    events.push({ type: 'open_note_set', open_note: ensured })
  }

  return events
}

import type { NotesPort } from '$lib/ports/notes_port'
import type { NotePath, VaultId } from '$lib/types/ids'
import type { NoteDoc, NoteMeta } from '$lib/types/note'
import { to_open_note_state } from '$lib/types/editor'
import { parent_folder_path } from '$lib/utils/filetree'
import { resolve_existing_note_path } from '$lib/utils/note_lookup'
import { as_markdown_text, as_note_path } from '$lib/types/ids'
import type { AppEvent } from '$lib/events/app_event'

export async function open_note_use_case(
  ports: { notes: NotesPort },
  args: { vault_id: VaultId; note_path: NotePath; create_if_missing: boolean; known_notes: NoteMeta[] }
): Promise<AppEvent[]> {
  const resolved = args.create_if_missing
    ? resolve_existing_note_path(args.known_notes, args.note_path)
    : null
  const resolved_path = resolved ? as_note_path(resolved) : args.note_path

  let created = false
  let doc: NoteDoc
  try {
    doc = await ports.notes.read_note(args.vault_id, resolved_path)
  } catch (error) {
    if (!args.create_if_missing) {
      throw error
    }

    const meta = await ports.notes.create_note(args.vault_id, resolved_path, as_markdown_text(''))
    doc = {
      meta,
      markdown: as_markdown_text('')
    }
    created = true
  }

  const events: AppEvent[] = [
    { type: 'ui_selected_folder_set', path: parent_folder_path(resolved_path) },
    { type: 'open_note_set', open_note: to_open_note_state(doc) }
  ]

  if (created) {
    events.push({ type: 'note_added', note: doc.meta })
  }

  return events
}

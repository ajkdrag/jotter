import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultId, NoteId } from '$lib/types/ids'
import { as_note_path } from '$lib/types/ids'
import type { OpenNoteState } from '$lib/types/editor'

export async function save_note_with_untitled_handling(
  ports: { notes: NotesPort },
  args: { vault_id: VaultId; note: OpenNoteState }
): Promise<{ final_note_id: NoteId; needs_path_update: boolean }> {
  const { vault_id, note } = args
  const note_id = note.meta.id
  const note_path = note.meta.path
  const markdown = note.markdown

  const is_untitled = !note_path.endsWith('.md')

  if (is_untitled) {
    const final_note_path = as_note_path(`${note.meta.path}.md`)
    const created_note = await ports.notes.create_note(vault_id, final_note_path, markdown)
    return { final_note_id: created_note.id, needs_path_update: true }
  } else {
    await ports.notes.write_note(vault_id, note_id, markdown)
    return { final_note_id: note_id, needs_path_update: false }
  }
}

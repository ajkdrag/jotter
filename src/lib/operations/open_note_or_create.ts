import type { NotesPort } from '$lib/ports/notes_port'
import type { NoteDoc } from '$lib/types/note'
import type { NotePath, VaultId } from '$lib/types/ids'
import { as_markdown_text } from '$lib/types/ids'
import { open_note } from '$lib/operations/open_note'

export type OpenNoteResult = {
  doc: NoteDoc
  created: boolean
}

export async function open_note_or_create(
  ports: { notes: NotesPort },
  args: { vault_id: VaultId; note_path: NotePath; create_if_missing: boolean }
): Promise<OpenNoteResult> {
  const { vault_id, note_path, create_if_missing } = args

  try {
    const doc = await open_note({ notes: ports.notes }, { vault_id, note_id: note_path })
    return { doc, created: false }
  } catch (error) {
    if (!create_if_missing) {
      throw error
    }

    const meta = await ports.notes.create_note(vault_id, note_path, as_markdown_text(''))
    return {
      doc: {
        meta,
        markdown: as_markdown_text('')
      },
      created: true
    }
  }
}

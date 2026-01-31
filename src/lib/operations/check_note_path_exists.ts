import type { NotesPort } from '$lib/ports/notes_port'
import type { VaultId, NotePath } from '$lib/types/ids'

export async function check_note_path_exists(
  ports: { notes: NotesPort },
  args: { vault_id: VaultId; note_path: NotePath }
): Promise<boolean> {
  const { vault_id, note_path } = args
  const notes = await ports.notes.list_notes(vault_id)
  return notes.some(note => note.path === note_path)
}

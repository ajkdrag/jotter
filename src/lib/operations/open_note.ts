import type { NotesPort } from '$lib/ports/notes_port'
import type { NoteDoc } from '$lib/types/note'
import type { NoteId, VaultId } from '$lib/types/ids'

export async function open_note(
  ports: { notes: NotesPort },
  args: { vault_id: VaultId; note_id: NoteId }
): Promise<NoteDoc> {
  return await ports.notes.read_note(args.vault_id, args.note_id)
}


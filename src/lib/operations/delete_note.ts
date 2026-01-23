import type { NotesPort } from '$lib/ports/notes_port'
import type { NoteId, VaultId } from '$lib/types/ids'

export async function delete_note(
  ports: { notes: NotesPort },
  args: { vault_id: VaultId; note_id: NoteId }
): Promise<void> {
  await ports.notes.delete_note(args.vault_id, args.note_id)
}

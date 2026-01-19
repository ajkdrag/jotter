import type { NotesPort } from '$lib/ports/notes_port'
import type { MarkdownText, NoteId, VaultId } from '$lib/types/ids'

export async function save_note(
  ports: { notes: NotesPort },
  args: { vault_id: VaultId; note_id: NoteId; markdown: MarkdownText }
): Promise<void> {
  await ports.notes.write_note(args.vault_id, args.note_id, args.markdown)
}


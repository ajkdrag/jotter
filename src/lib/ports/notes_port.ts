import type { MarkdownText, NoteId, NotePath, VaultId } from '$lib/types/ids'
import type { NoteDoc, NoteMeta } from '$lib/types/note'

export interface NotesPort {
  list_notes(vault_id: VaultId): Promise<NoteMeta[]>
  read_note(vault_id: VaultId, note_id: NoteId): Promise<NoteDoc>
  write_note(vault_id: VaultId, note_id: NoteId, markdown: MarkdownText): Promise<void>
  create_note(vault_id: VaultId, note_path: NotePath, initial_markdown: MarkdownText): Promise<NoteMeta>
  rename_note(vault_id: VaultId, from: NotePath, to: NotePath): Promise<void>
  delete_note(vault_id: VaultId, note_id: NoteId): Promise<void>
}


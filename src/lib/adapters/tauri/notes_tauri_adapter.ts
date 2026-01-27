import type { NotesPort } from '$lib/ports/notes_port'
import { tauri_invoke } from '$lib/adapters/tauri/tauri_invoke'
import type { MarkdownText, NoteId, NotePath, VaultId } from '$lib/types/ids'
import type { NoteDoc, NoteMeta } from '$lib/types/note'

export function create_notes_tauri_adapter(): NotesPort {
  return {
    async list_notes(vault_id: VaultId) {
      return await tauri_invoke<NoteMeta[]>('list_notes', { vault_id })
    },
    async read_note(vault_id: VaultId, note_id: NoteId) {
      return await tauri_invoke<NoteDoc>('read_note', { vault_id, note_id })
    },
    async write_note(vault_id: VaultId, note_id: NoteId, markdown: MarkdownText) {
      await tauri_invoke<void>('write_note', { args: { vault_id, note_id, markdown } })
    },
    async create_note(vault_id: VaultId, note_path: NotePath, initial_markdown: MarkdownText) {
      return await tauri_invoke<NoteMeta>('create_note', {
        args: { vault_id, note_path, initial_markdown }
      })
    },
    async rename_note(vault_id: VaultId, from: NotePath, to: NotePath) {
      await tauri_invoke<void>('rename_note', { args: { vault_id, from, to } })
    },
    async delete_note(vault_id: VaultId, note_id: NoteId) {
      await tauri_invoke<void>('delete_note', { args: { vault_id, note_id } })
    }
  }
}


import type { NotesPort, FolderStats } from '$lib/ports/notes_port'
import { tauri_invoke } from '$lib/adapters/tauri/tauri_invoke'
import type { MarkdownText, NoteId, NotePath, VaultId } from '$lib/types/ids'
import type { NoteDoc, NoteMeta } from '$lib/types/note'
import type { FolderContents } from '$lib/types/filetree'

export function create_notes_tauri_adapter(): NotesPort {
  return {
    async list_notes(vault_id: VaultId) {
      return await tauri_invoke<NoteMeta[]>('list_notes', { vaultId: vault_id })
    },
    async list_folders(vault_id: VaultId) {
      return await tauri_invoke<string[]>('list_folders', { vaultId: vault_id })
    },
    async read_note(vault_id: VaultId, note_id: NoteId) {
      return await tauri_invoke<NoteDoc>('read_note', { vaultId: vault_id, noteId: note_id })
    },
    async write_note(vault_id: VaultId, note_id: NoteId, markdown: MarkdownText) {
      await tauri_invoke<undefined>('write_note', { args: { vault_id, note_id, markdown } })
    },
    async create_note(vault_id: VaultId, note_path: NotePath, initial_markdown: MarkdownText) {
      return await tauri_invoke<NoteMeta>('create_note', {
        args: { vault_id, note_path, initial_markdown }
      })
    },
    async create_folder(vault_id: VaultId, parent_path: string, folder_name: string) {
      await tauri_invoke<undefined>('create_folder', {
        args: { vault_id, parent_path, folder_name }
      })
    },
    async rename_note(vault_id: VaultId, from: NotePath, to: NotePath) {
      await tauri_invoke<undefined>('rename_note', { args: { vault_id, from, to } })
    },
    async delete_note(vault_id: VaultId, note_id: NoteId) {
      await tauri_invoke<undefined>('delete_note', { args: { vault_id, note_id } })
    },
    async list_folder_contents(vault_id: VaultId, folder_path: string): Promise<FolderContents> {
      return await tauri_invoke<FolderContents>('list_folder_contents', {
        vaultId: vault_id,
        folderPath: folder_path
      })
    },
    async rename_folder(vault_id: VaultId, from_path: string, to_path: string) {
      await tauri_invoke<undefined>('rename_folder', { args: { vault_id, from_path, to_path } })
    },
    async delete_folder(vault_id: VaultId, folder_path: string) {
      return await tauri_invoke<{ deleted_notes: NotePath[]; deleted_folders: string[] }>('delete_folder', {
        args: { vault_id, folder_path }
      })
    },
    async get_folder_stats(vault_id: VaultId, folder_path: string): Promise<FolderStats> {
      let note_count = 0
      let folder_count = 0

      const count_recursive = async (path: string) => {
        const contents = await tauri_invoke<FolderContents>('list_folder_contents', {
          vaultId: vault_id,
          folderPath: path
        })
        note_count += contents.notes.length
        folder_count += contents.subfolders.length
        for (const subfolder of contents.subfolders) {
          await count_recursive(subfolder)
        }
      }

      await count_recursive(folder_path)
      return { note_count, folder_count }
    }
  }
}


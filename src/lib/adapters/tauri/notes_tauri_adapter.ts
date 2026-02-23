import type { NotesPort, FolderStats } from "$lib/ports/notes_port";
import { tauri_invoke } from "$lib/adapters/tauri/tauri_invoke";
import type { MarkdownText, NoteId, NotePath, VaultId } from "$lib/types/ids";
import type { NoteDoc, NoteMeta } from "$lib/types/note";
import type {
  FolderContents,
  MoveItem,
  MoveItemResult,
} from "$lib/types/filetree";

export function create_notes_tauri_adapter(): NotesPort {
  return {
    async list_notes(vault_id: VaultId) {
      return await tauri_invoke<NoteMeta[]>("list_notes", {
        vaultId: vault_id,
      });
    },
    async list_folders(vault_id: VaultId) {
      return await tauri_invoke<string[]>("list_folders", {
        vaultId: vault_id,
      });
    },
    async read_note(vault_id: VaultId, note_id: NoteId) {
      return await tauri_invoke<NoteDoc>("read_note", {
        vaultId: vault_id,
        noteId: note_id,
      });
    },
    async write_note(
      vault_id: VaultId,
      note_id: NoteId,
      markdown: MarkdownText,
    ) {
      await tauri_invoke<undefined>("write_note", {
        args: { vault_id, note_id, markdown },
      });
    },
    async create_note(
      vault_id: VaultId,
      note_path: NotePath,
      initial_markdown: MarkdownText,
    ) {
      return await tauri_invoke<NoteMeta>("create_note", {
        args: { vault_id, note_path, initial_markdown },
      });
    },
    async create_folder(
      vault_id: VaultId,
      parent_path: string,
      folder_name: string,
    ) {
      await tauri_invoke<undefined>("create_folder", {
        args: { vault_id, parent_path, folder_name },
      });
    },
    async rename_note(vault_id: VaultId, from: NotePath, to: NotePath) {
      await tauri_invoke<undefined>("rename_note", {
        args: { vault_id, from, to },
      });
    },
    async delete_note(vault_id: VaultId, note_id: NoteId) {
      await tauri_invoke<undefined>("delete_note", {
        args: { vault_id, note_id },
      });
    },
    async list_folder_contents(
      vault_id: VaultId,
      folder_path: string,
      offset: number,
      limit: number,
    ): Promise<FolderContents> {
      return await tauri_invoke<FolderContents>("list_folder_contents", {
        vaultId: vault_id,
        folderPath: folder_path,
        offset,
        limit,
      });
    },
    async rename_folder(vault_id: VaultId, from_path: string, to_path: string) {
      await tauri_invoke<undefined>("rename_folder", {
        args: { vault_id, from_path, to_path },
      });
    },
    async delete_folder(vault_id: VaultId, folder_path: string) {
      await tauri_invoke<undefined>("delete_folder", {
        args: { vault_id, folder_path },
      });
    },
    async get_folder_stats(
      vault_id: VaultId,
      folder_path: string,
    ): Promise<FolderStats> {
      return await tauri_invoke<FolderStats>("get_folder_stats", {
        vaultId: vault_id,
        folderPath: folder_path,
      });
    },
    async move_items(
      vault_id: VaultId,
      items: MoveItem[],
      target_folder: string,
      overwrite: boolean,
    ): Promise<MoveItemResult[]> {
      return await tauri_invoke<MoveItemResult[]>("move_items", {
        args: { vault_id, items, target_folder, overwrite },
      });
    },
  };
}

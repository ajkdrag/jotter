import type { MarkdownText, NoteId, NotePath, VaultId } from "$lib/types/ids";
import type { NoteDoc, NoteMeta } from "$lib/types/note";
import type { FolderContents } from "$lib/types/filetree";

export type FolderStats = {
  note_count: number;
  folder_count: number;
};

export interface NotesPort {
  list_notes(vault_id: VaultId): Promise<NoteMeta[]>;
  list_folders(vault_id: VaultId): Promise<string[]>;
  read_note(vault_id: VaultId, note_id: NoteId): Promise<NoteDoc>;
  write_note(
    vault_id: VaultId,
    note_id: NoteId,
    markdown: MarkdownText,
  ): Promise<void>;
  create_note(
    vault_id: VaultId,
    note_path: NotePath,
    initial_markdown: MarkdownText,
  ): Promise<NoteMeta>;
  create_folder(
    vault_id: VaultId,
    parent_path: string,
    folder_name: string,
  ): Promise<void>;
  rename_note(vault_id: VaultId, from: NotePath, to: NotePath): Promise<void>;
  delete_note(vault_id: VaultId, note_id: NoteId): Promise<void>;
  rename_folder(
    vault_id: VaultId,
    from_path: string,
    to_path: string,
  ): Promise<void>;
  delete_folder(
    vault_id: VaultId,
    folder_path: string,
  ): Promise<{ deleted_notes: NotePath[]; deleted_folders: string[] }>;
  list_folder_contents(
    vault_id: VaultId,
    folder_path: string,
    offset: number,
    limit: number,
  ): Promise<FolderContents>;
  get_folder_stats(
    vault_id: VaultId,
    folder_path: string,
  ): Promise<FolderStats>;
}

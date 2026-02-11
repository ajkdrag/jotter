import type { NoteId, VaultId } from "$lib/types/ids";
import type { IndexProgressEvent } from "$lib/types/search";

export type { IndexProgressEvent };

export type IndexChange =
  | { kind: "upsert_path"; path: NoteId }
  | { kind: "remove_path"; path: NoteId }
  | { kind: "remove_prefix"; prefix: string }
  | { kind: "rename_prefix"; old_prefix: string; new_prefix: string }
  | { kind: "force_scan" }
  | { kind: "force_rebuild" };

export interface WorkspaceIndexPort {
  touch_index(vault_id: VaultId, change: IndexChange): Promise<void>;
  cancel_index(vault_id: VaultId): Promise<void>;
  sync_index(vault_id: VaultId): Promise<void>;
  rebuild_index(vault_id: VaultId): Promise<void>;
  upsert_note(vault_id: VaultId, note_id: NoteId): Promise<void>;
  remove_note(vault_id: VaultId, note_id: NoteId): Promise<void>;
  remove_notes(vault_id: VaultId, note_ids: NoteId[]): Promise<void>;
  remove_notes_by_prefix(vault_id: VaultId, prefix: string): Promise<void>;
  rename_folder_paths(
    vault_id: VaultId,
    old_prefix: string,
    new_prefix: string,
  ): Promise<void>;
  subscribe_index_progress(
    callback: (event: IndexProgressEvent) => void,
  ): () => void;
}

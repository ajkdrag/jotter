import type { NoteId, VaultId } from "$lib/types/ids";
import type { IndexProgressEvent } from "$lib/types/search";

export type { IndexProgressEvent };

export interface WorkspaceIndexPort {
  build_index(vault_id: VaultId): Promise<void>;
  upsert_note(vault_id: VaultId, note_id: NoteId): Promise<void>;
  remove_note(vault_id: VaultId, note_id: NoteId): Promise<void>;
  remove_notes(vault_id: VaultId, note_ids: NoteId[]): Promise<void>;
  rename_folder_paths(
    vault_id: VaultId,
    old_prefix: string,
    new_prefix: string,
  ): Promise<void>;
  subscribe_index_progress(
    callback: (event: IndexProgressEvent) => void,
  ): () => void;
}

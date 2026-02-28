import type { IndexChange, WorkspaceIndexPort } from "$lib/features/search";
import type { NoteId, VaultId } from "$lib/shared/types/ids";

export function create_test_workspace_index_adapter(): WorkspaceIndexPort {
  return {
    async touch_index(
      _vault_id: VaultId,
      _change: IndexChange,
    ): Promise<void> {},
    async cancel_index(_vault_id: VaultId): Promise<void> {},
    async sync_index(_vault_id: VaultId): Promise<void> {},
    async rebuild_index(_vault_id: VaultId): Promise<void> {},
    async upsert_note(_vault_id: VaultId, _note_id: NoteId): Promise<void> {},
    async remove_note(_vault_id: VaultId, _note_id: NoteId): Promise<void> {},
    async remove_notes(
      _vault_id: VaultId,
      _note_ids: NoteId[],
    ): Promise<void> {},
    async rename_note_path(
      _vault_id: VaultId,
      _old_path: NoteId,
      _new_path: NoteId,
    ): Promise<void> {},
    async remove_notes_by_prefix(
      _vault_id: VaultId,
      _prefix: string,
    ): Promise<void> {},
    async rename_folder_paths(
      _vault_id: VaultId,
      _old_prefix: string,
      _new_prefix: string,
    ): Promise<void> {},
    subscribe_index_progress() {
      return () => {};
    },
  };
}

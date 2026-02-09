import type { WorkspaceIndexPort } from "$lib/ports/workspace_index_port";
import type { NoteId, VaultId } from "$lib/types/ids";

export function create_test_workspace_index_adapter(): WorkspaceIndexPort {
  return {
    async build_index(_vault_id: VaultId): Promise<void> {},
    async upsert_note(_vault_id: VaultId, _note_id: NoteId): Promise<void> {},
    async remove_note(_vault_id: VaultId, _note_id: NoteId): Promise<void> {},
    subscribe_index_progress() {
      return () => {};
    },
  };
}

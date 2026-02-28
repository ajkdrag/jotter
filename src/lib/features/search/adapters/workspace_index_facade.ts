import type {
  IndexChange,
  WorkspaceIndexPort,
} from "$lib/features/search/ports";
import type { NoteId, VaultId } from "$lib/shared/types/ids";
import type { create_index_actor } from "./index_actor";

type IndexActor = ReturnType<typeof create_index_actor>;

export function wrap_index_actor_as_port(
  actor: IndexActor,
  on_cancel?: (vault_id: VaultId) => Promise<void>,
): WorkspaceIndexPort {
  return {
    async touch_index(vault_id: VaultId, change: IndexChange): Promise<void> {
      await actor.touch_index(vault_id, change);
    },
    async cancel_index(vault_id: VaultId): Promise<void> {
      await actor.cancel_index(vault_id);
      await on_cancel?.(vault_id);
    },
    async sync_index(vault_id: VaultId): Promise<void> {
      await actor.touch_index(vault_id, { kind: "force_scan" });
    },
    async rebuild_index(vault_id: VaultId): Promise<void> {
      await actor.touch_index(vault_id, { kind: "force_rebuild" });
    },
    async upsert_note(vault_id: VaultId, note_id: NoteId): Promise<void> {
      await actor.touch_index(vault_id, {
        kind: "upsert_path",
        path: note_id,
      });
    },
    async remove_note(vault_id: VaultId, note_id: NoteId): Promise<void> {
      await actor.touch_index(vault_id, {
        kind: "remove_path",
        path: note_id,
      });
    },
    async remove_notes(vault_id: VaultId, note_ids: NoteId[]): Promise<void> {
      for (const note_id of note_ids) {
        void actor.touch_index(vault_id, {
          kind: "remove_path",
          path: note_id,
        });
      }
      await Promise.resolve();
    },
    async rename_note_path(
      vault_id: VaultId,
      old_path: NoteId,
      new_path: NoteId,
    ): Promise<void> {
      await actor.touch_index(vault_id, {
        kind: "rename_path",
        old_path,
        new_path,
      });
    },
    async remove_notes_by_prefix(
      vault_id: VaultId,
      prefix: string,
    ): Promise<void> {
      await actor.touch_index(vault_id, {
        kind: "remove_prefix",
        prefix,
      });
    },
    async rename_folder_paths(
      vault_id: VaultId,
      old_prefix: string,
      new_prefix: string,
    ): Promise<void> {
      await actor.touch_index(vault_id, {
        kind: "rename_prefix",
        old_prefix,
        new_prefix,
      });
    },
    subscribe_index_progress(callback) {
      return actor.subscribe_index_progress(callback);
    },
  };
}

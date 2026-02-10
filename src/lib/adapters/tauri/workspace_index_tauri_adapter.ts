import type {
  WorkspaceIndexPort,
  IndexProgressEvent,
} from "$lib/ports/workspace_index_port";
import type { NoteId, VaultId } from "$lib/types/ids";
import { tauri_invoke } from "$lib/adapters/tauri/tauri_invoke";
import { listen } from "@tauri-apps/api/event";

export function create_workspace_index_tauri_adapter(): WorkspaceIndexPort {
  return {
    async build_index(vault_id: VaultId) {
      await tauri_invoke<undefined>("index_build", { vaultId: vault_id });
    },
    async upsert_note(vault_id: VaultId, note_id: NoteId) {
      await tauri_invoke<undefined>("index_upsert_note", {
        vaultId: vault_id,
        noteId: note_id,
      });
    },
    async remove_note(vault_id: VaultId, note_id: NoteId) {
      await tauri_invoke<undefined>("index_remove_note", {
        vaultId: vault_id,
        noteId: note_id,
      });
    },
    async remove_notes(vault_id: VaultId, note_ids: NoteId[]) {
      await tauri_invoke<undefined>("index_remove_notes", {
        vaultId: vault_id,
        noteIds: note_ids,
      });
    },
    async rename_folder_paths(
      vault_id: VaultId,
      old_prefix: string,
      new_prefix: string,
    ) {
      await tauri_invoke<number>("index_rename_folder", {
        vaultId: vault_id,
        oldPrefix: old_prefix,
        newPrefix: new_prefix,
      });
    },
    subscribe_index_progress(
      callback: (event: IndexProgressEvent) => void,
    ): () => void {
      let unlisten_fn: (() => void) | null = null;
      let is_disposed = false;
      void listen<IndexProgressEvent>("index_progress", (event) => {
        if (is_disposed) return;
        callback(event.payload);
      }).then((fn_ref) => {
        if (is_disposed) {
          fn_ref();
          return;
        }
        unlisten_fn = fn_ref;
      });
      return () => {
        is_disposed = true;
        unlisten_fn?.();
        unlisten_fn = null;
      };
    },
  };
}

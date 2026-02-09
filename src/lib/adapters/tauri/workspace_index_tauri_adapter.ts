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
    subscribe_index_progress(
      callback: (event: IndexProgressEvent) => void,
    ): () => void {
      let unlisten_fn: (() => void) | null = null;
      void listen<IndexProgressEvent>("index_progress", (event) => {
        callback(event.payload);
      }).then((fn_ref) => {
        unlisten_fn = fn_ref;
      });
      return () => {
        unlisten_fn?.();
      };
    },
  };
}

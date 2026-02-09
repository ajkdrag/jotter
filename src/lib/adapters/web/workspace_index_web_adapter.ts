import type { WorkspaceIndexPort } from "$lib/ports/workspace_index_port";
import type { NoteId, VaultId } from "$lib/types/ids";
import type { NotesPort } from "$lib/ports/notes_port";
import type { SearchDbWeb } from "$lib/adapters/web/search_db_web";
import type { IndexProgressEvent } from "$lib/types/search";

export function create_workspace_index_web_adapter(
  notes: NotesPort,
  search_db: SearchDbWeb,
): WorkspaceIndexPort {
  const listeners = new Set<(event: IndexProgressEvent) => void>();
  let worker_progress_unsubscribe: (() => void) | null = null;

  function emit(event: IndexProgressEvent): void {
    for (const listener of listeners) {
      listener(event);
    }
  }

  function ensure_worker_progress_subscription(): void {
    if (worker_progress_unsubscribe) return;
    worker_progress_unsubscribe = search_db.subscribe_progress((event) => {
      emit(event);
    });
  }

  return {
    async build_index(vault_id: VaultId): Promise<void> {
      ensure_worker_progress_subscription();
      const metas = await notes.list_notes(vault_id);
      const docs = await Promise.all(
        metas.map((meta) => notes.read_note(vault_id, meta.id)),
      );
      const started_at = Date.now();
      emit({
        status: "started",
        vault_id,
        total: docs.length,
      });
      try {
        await search_db.rebuild_index(vault_id, docs);
        emit({
          status: "completed",
          vault_id,
          indexed: docs.length,
          elapsed_ms: Date.now() - started_at,
        });
      } catch (error) {
        emit({
          status: "failed",
          vault_id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    async upsert_note(vault_id: VaultId, note_id: NoteId): Promise<void> {
      const doc = await notes.read_note(vault_id, note_id);
      await search_db.upsert_note(vault_id, doc);
    },
    async remove_note(vault_id: VaultId, note_id: NoteId): Promise<void> {
      await search_db.remove_note(vault_id, note_id);
    },
    subscribe_index_progress(callback: (event: IndexProgressEvent) => void) {
      ensure_worker_progress_subscription();
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };
}

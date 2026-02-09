import type { WorkspaceIndexPort } from "$lib/ports/workspace_index_port";
import type { NoteId, VaultId } from "$lib/types/ids";
import type { NotesPort } from "$lib/ports/notes_port";
import type { SearchDbWeb } from "$lib/adapters/web/search_db_web";
import type { IndexProgressEvent } from "$lib/types/search";

const INDEX_BATCH_SIZE = 100;

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
      const started_at = Date.now();
      emit({
        status: "started",
        vault_id,
        total: metas.length,
      });
      let rebuild_started = false;
      try {
        await search_db.rebuild_begin(vault_id, metas);
        rebuild_started = true;
        let indexed = 0;

        for (
          let offset = 0;
          offset < metas.length;
          offset += INDEX_BATCH_SIZE
        ) {
          const batch = metas.slice(offset, offset + INDEX_BATCH_SIZE);
          const settled = await Promise.allSettled(
            batch.map((meta) => notes.read_note(vault_id, meta.id)),
          );
          const docs = settled.flatMap((result) =>
            result.status === "fulfilled" ? [result.value] : [],
          );
          if (docs.length > 0) {
            await search_db.rebuild_batch(vault_id, docs);
            indexed += docs.length;
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }

        await search_db.rebuild_finish(vault_id);
        emit({
          status: "completed",
          vault_id,
          indexed,
          elapsed_ms: Date.now() - started_at,
        });
      } catch (error) {
        if (rebuild_started) {
          await search_db.rebuild_finish(vault_id).catch(() => undefined);
        }
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
    async remove_notes(vault_id: VaultId, note_ids: NoteId[]): Promise<void> {
      for (const note_id of note_ids) {
        await search_db.remove_note(vault_id, note_id);
      }
    },
    async rename_folder_paths(
      vault_id: VaultId,
      old_prefix: string,
      new_prefix: string,
    ): Promise<void> {
      const old_len = old_prefix.length;
      await search_db.exec(vault_id, "BEGIN IMMEDIATE");
      try {
        await search_db.exec(
          vault_id,
          `CREATE TEMP TABLE IF NOT EXISTS _fts_rename(title TEXT, name TEXT, path TEXT, body TEXT)`,
        );
        await search_db.exec(vault_id, `DELETE FROM _fts_rename`);
        await search_db.exec(
          vault_id,
          `INSERT INTO _fts_rename SELECT title, name, ?1 || substr(path, ?2 + 1), body
           FROM notes_fts WHERE path LIKE ?3`,
          [new_prefix, old_len, `${old_prefix}%`],
        );
        await search_db.exec(
          vault_id,
          `DELETE FROM notes_fts WHERE path LIKE ?1`,
          [`${old_prefix}%`],
        );
        await search_db.exec(
          vault_id,
          `INSERT INTO notes_fts(title, name, path, body) SELECT * FROM _fts_rename`,
        );
        await search_db.exec(vault_id, `DROP TABLE IF EXISTS _fts_rename`);
        await search_db.exec(
          vault_id,
          `UPDATE notes SET path = ?1 || substr(path, ?2 + 1) WHERE path LIKE ?3`,
          [new_prefix, old_len, `${old_prefix}%`],
        );
        await search_db.exec(
          vault_id,
          `UPDATE outlinks SET source_path = ?1 || substr(source_path, ?2 + 1)
           WHERE source_path LIKE ?3`,
          [new_prefix, old_len, `${old_prefix}%`],
        );
        await search_db.exec(
          vault_id,
          `UPDATE outlinks SET target_path = ?1 || substr(target_path, ?2 + 1)
           WHERE target_path LIKE ?3`,
          [new_prefix, old_len, `${old_prefix}%`],
        );
        await search_db.exec(vault_id, "COMMIT");
      } catch (e) {
        await search_db.exec(vault_id, "ROLLBACK").catch(() => undefined);
        throw e;
      }
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

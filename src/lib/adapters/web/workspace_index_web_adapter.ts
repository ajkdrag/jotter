import {
  create_index_actor,
  type PrefixRename,
} from "$lib/adapters/shared/index_actor";
import { wrap_index_actor_as_port } from "$lib/adapters/shared/workspace_index_facade";
import { throw_if_aborted } from "$lib/adapters/shared/abort";
import { to_number, to_string } from "$lib/adapters/shared/coerce";
import type { WorkspaceIndexPort } from "$lib/ports/workspace_index_port";
import { as_note_path, type VaultId } from "$lib/types/ids";
import type { NotesPort } from "$lib/ports/notes_port";
import type { SearchDbWeb } from "$lib/adapters/web/search_db_web";
import type { NoteMeta } from "$lib/types/note";

const INDEX_BATCH_SIZE = 100;

type IndexedMeta = {
  mtime_ms: number;
  size_bytes: number;
};
type ProgressCallback = (indexed: number, total: number) => void;

function build_sql_like_prefix_pattern(prefix: string): string {
  const escaped = prefix
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
  return `${escaped}%`;
}

async function read_index_manifest(
  search_db: SearchDbWeb,
  vault_id: VaultId,
): Promise<Map<string, IndexedMeta>> {
  const rows = await search_db.exec(
    vault_id,
    "SELECT path, mtime_ms, size_bytes FROM notes",
  );
  const manifest = new Map<string, IndexedMeta>();
  for (const row of rows) {
    const path = to_string(row[0]);
    if (!path) continue;
    manifest.set(path, {
      mtime_ms: to_number(row[1]),
      size_bytes: to_number(row[2]),
    });
  }
  return manifest;
}

async function run_full_rebuild(
  notes: NotesPort,
  search_db: SearchDbWeb,
  vault_id: VaultId,
  metas?: NoteMeta[],
  on_progress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<void> {
  throw_if_aborted(signal);
  const targets = metas ?? (await notes.list_notes(vault_id));
  const total = targets.length;
  let indexed = 0;
  on_progress?.(0, total);
  await search_db.rebuild_begin(vault_id, targets);
  try {
    for (let offset = 0; offset < targets.length; offset += INDEX_BATCH_SIZE) {
      throw_if_aborted(signal);
      const batch = targets.slice(offset, offset + INDEX_BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map((meta) => notes.read_note(vault_id, meta.id)),
      );
      const docs = settled
        .filter(
          (
            result,
          ): result is PromiseFulfilledResult<
            Awaited<ReturnType<NotesPort["read_note"]>>
          > => result.status === "fulfilled",
        )
        .map((result) => result.value);
      if (docs.length > 0) {
        await search_db.rebuild_batch(vault_id, docs);
      }
      indexed += batch.length;
      on_progress?.(Math.min(indexed, total), total);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    await search_db.rebuild_finish(vault_id).catch(() => undefined);
  }
}

async function run_manifest_sync(
  notes: NotesPort,
  search_db: SearchDbWeb,
  vault_id: VaultId,
  on_progress?: ProgressCallback,
  signal?: AbortSignal,
): Promise<void> {
  throw_if_aborted(signal);
  const metas = await notes.list_notes(vault_id);
  let indexed_manifest: Map<string, IndexedMeta>;
  try {
    indexed_manifest = await read_index_manifest(search_db, vault_id);
  } catch {
    await run_full_rebuild(
      notes,
      search_db,
      vault_id,
      metas,
      on_progress,
      signal,
    );
    return;
  }

  if (indexed_manifest.size === 0) {
    await run_full_rebuild(
      notes,
      search_db,
      vault_id,
      metas,
      on_progress,
      signal,
    );
    return;
  }

  const disk_manifest = new Map<string, NoteMeta>();
  for (const meta of metas) {
    disk_manifest.set(String(meta.path), meta);
  }

  const changed = metas.filter((meta) => {
    const indexed = indexed_manifest.get(String(meta.path));
    if (!indexed) return true;
    return (
      indexed.mtime_ms !== meta.mtime_ms ||
      indexed.size_bytes !== meta.size_bytes
    );
  });

  const removed = [...indexed_manifest.keys()].filter(
    (path) => !disk_manifest.has(path),
  );
  const total = changed.length + removed.length;
  let indexed = 0;
  on_progress?.(0, total);

  for (const removed_path of removed) {
    throw_if_aborted(signal);
    await search_db.remove_note(vault_id, as_note_path(removed_path));
    indexed += 1;
    on_progress?.(indexed, total);
  }

  for (let offset = 0; offset < changed.length; offset += INDEX_BATCH_SIZE) {
    throw_if_aborted(signal);
    const batch = changed.slice(offset, offset + INDEX_BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map((meta) => notes.read_note(vault_id, meta.id)),
    );
    for (const result of settled) {
      throw_if_aborted(signal);
      if (result.status !== "fulfilled") {
        indexed += 1;
        on_progress?.(indexed, total);
        continue;
      }
      await search_db.upsert_note(vault_id, result.value);
      indexed += 1;
      on_progress?.(indexed, total);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

async function remove_by_prefix(
  search_db: SearchDbWeb,
  vault_id: VaultId,
  prefix: string,
): Promise<void> {
  const pattern = build_sql_like_prefix_pattern(prefix);
  await search_db.exec(vault_id, "BEGIN IMMEDIATE");
  try {
    await search_db.exec(
      vault_id,
      "DELETE FROM notes_fts WHERE path LIKE ?1 ESCAPE '\\'",
      [pattern],
    );
    await search_db.exec(
      vault_id,
      "DELETE FROM outlinks WHERE source_path LIKE ?1 ESCAPE '\\' OR target_path LIKE ?1 ESCAPE '\\'",
      [pattern],
    );
    await search_db.exec(
      vault_id,
      "DELETE FROM notes WHERE path LIKE ?1 ESCAPE '\\'",
      [pattern],
    );
    await search_db.exec(vault_id, "COMMIT");
  } catch (error) {
    await search_db.exec(vault_id, "ROLLBACK").catch(() => undefined);
    throw error;
  }
}

async function rename_prefix(
  search_db: SearchDbWeb,
  vault_id: VaultId,
  rename: PrefixRename,
): Promise<void> {
  const old_len = rename.old_prefix.length;
  const pattern = build_sql_like_prefix_pattern(rename.old_prefix);
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
       FROM notes_fts WHERE path LIKE ?3 ESCAPE '\\'`,
      [rename.new_prefix, old_len, pattern],
    );
    await search_db.exec(
      vault_id,
      `DELETE FROM notes_fts WHERE path LIKE ?1 ESCAPE '\\'`,
      [pattern],
    );
    await search_db.exec(
      vault_id,
      `INSERT INTO notes_fts(title, name, path, body) SELECT * FROM _fts_rename`,
    );
    await search_db.exec(vault_id, `DROP TABLE IF EXISTS _fts_rename`);
    await search_db.exec(
      vault_id,
      `UPDATE notes SET path = ?1 || substr(path, ?2 + 1) WHERE path LIKE ?3 ESCAPE '\\'`,
      [rename.new_prefix, old_len, pattern],
    );
    await search_db.exec(
      vault_id,
      `UPDATE outlinks SET source_path = ?1 || substr(source_path, ?2 + 1)
       WHERE source_path LIKE ?3 ESCAPE '\\'`,
      [rename.new_prefix, old_len, pattern],
    );
    await search_db.exec(
      vault_id,
      `UPDATE outlinks SET target_path = ?1 || substr(target_path, ?2 + 1)
       WHERE target_path LIKE ?3 ESCAPE '\\'`,
      [rename.new_prefix, old_len, pattern],
    );
    await search_db.exec(vault_id, "COMMIT");
  } catch (error) {
    await search_db.exec(vault_id, "ROLLBACK").catch(() => undefined);
    throw error;
  }
}

export function create_workspace_index_web_adapter(
  notes: NotesPort,
  search_db: SearchDbWeb,
): WorkspaceIndexPort {
  const actor = create_index_actor({
    async sync_index(
      vault_id: VaultId,
      on_progress?: ProgressCallback,
      signal?: AbortSignal,
    ): Promise<void> {
      await run_manifest_sync(notes, search_db, vault_id, on_progress, signal);
    },
    async rebuild_index(
      vault_id: VaultId,
      on_progress?: ProgressCallback,
      signal?: AbortSignal,
    ): Promise<void> {
      await run_full_rebuild(
        notes,
        search_db,
        vault_id,
        undefined,
        on_progress,
        signal,
      );
    },
    async upsert_paths(vault_id: VaultId, paths: string[]): Promise<void> {
      for (const path of paths) {
        const note_path = as_note_path(path);
        try {
          const doc = await notes.read_note(vault_id, note_path);
          await search_db.upsert_note(vault_id, doc);
        } catch {
          await search_db
            .remove_note(vault_id, note_path)
            .catch(() => undefined);
        }
      }
    },
    async remove_paths(vault_id: VaultId, paths: string[]): Promise<void> {
      for (const path of paths) {
        await search_db.remove_note(vault_id, as_note_path(path));
      }
    },
    async remove_prefixes(
      vault_id: VaultId,
      prefixes: string[],
    ): Promise<void> {
      for (const prefix of prefixes) {
        await remove_by_prefix(search_db, vault_id, prefix);
      }
    },
    async rename_prefixes(vault_id: VaultId, renames: PrefixRename[]) {
      for (const rename of renames) {
        await rename_prefix(search_db, vault_id, rename);
      }
    },
  });

  return wrap_index_actor_as_port(actor);
}

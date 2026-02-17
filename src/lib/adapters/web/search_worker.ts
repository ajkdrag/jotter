import SQLiteAsyncESMFactory from "@journeyapps/wa-sqlite/dist/wa-sqlite-async.mjs";
import wa_sqlite_async_wasm_url from "@journeyapps/wa-sqlite/dist/wa-sqlite-async.wasm?url";
import * as SQLite from "@journeyapps/wa-sqlite";
import type { NoteDoc } from "$lib/types/note";
import type {
  SearchWorkerMessage,
  SearchWorkerRequest,
  WorkerNoteMeta,
  WorkerPlannedSuggestion,
  WorkerSearchHit,
  WorkerStorageMode,
  WorkerSuggestion,
} from "$lib/adapters/web/search_worker_protocol";
import {
  DELETE_ALL_NOTES_FTS_SQL,
  DELETE_ALL_NOTES_SQL,
  DELETE_ALL_OUTLINKS_SQL,
  DELETE_NOTE_FTS_SQL,
  DELETE_NOTE_SQL,
  DELETE_OUTLINKS_FOR_SOURCE_SQL,
  INSERT_NOTE_FTS_SQL,
  INSERT_OUTLINK_SQL,
  SEARCH_SCHEMA_SQL,
  SEARCH_SQL,
  SUGGEST_SQL,
  PLANNED_SUGGEST_SQL,
  UPSERT_NOTE_SQL,
  planned_match_expression,
  search_match_expression,
  suggest_match_expression,
} from "$lib/db/search_queries";
import { gfm_link_targets } from "$lib/adapters/web/wiki_links_web";
import {
  to_number,
  to_string,
  to_nullable_string,
} from "$lib/adapters/shared/coerce";
import { create_logger } from "$lib/utils/logger";

const log = create_logger("search_worker");

const BATCH_SIZE = 100;
const SQLITE_OPEN_FLAGS =
  SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE;

type SQLiteApi = ReturnType<typeof SQLite.Factory>;

type RuntimeState = {
  sqlite3: SQLiteApi;
  vfs: VfsWithLifecycle;
  storage: WorkerStorageMode;
};

type RebuildState = {
  total: number;
  indexed: number;
};

type VfsWithLifecycle = {
  name: string;
  close?: () => Promise<void> | void;
};

type VfsFactory = {
  create: (name: string, module: unknown) => Promise<VfsWithLifecycle>;
};

const worker_scope = self as unknown as {
  postMessage: (message: SearchWorkerMessage) => void;
  onmessage: ((event: MessageEvent<SearchWorkerRequest>) => void) | null;
};

let runtime_state: RuntimeState | null = null;
const db_by_vault = new Map<string, number>();
const rebuild_state_by_vault = new Map<string, RebuildState>();

function as_error_message(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function file_stem(path: string): string {
  const leaf = path.split("/").at(-1) ?? path;
  return leaf.endsWith(".md") ? leaf.slice(0, -3) : leaf;
}

function to_note_meta(row: unknown[]): WorkerNoteMeta {
  const path = to_string(row[0]);
  return {
    id: path,
    path,
    name: file_stem(path),
    title: to_string(row[1]),
    mtime_ms: to_number(row[2]),
    size_bytes: to_number(row[3]),
  };
}

function is_opfs_supported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    typeof navigator.storage.getDirectory === "function"
  );
}

function post_message(message: SearchWorkerMessage): void {
  worker_scope.postMessage(message);
}

function db_file_name(vault_id: string): string {
  return `vaults/${encodeURIComponent(vault_id)}/search.db`;
}

function connection_pragmas(storage: WorkerStorageMode): string {
  if (storage === "opfs") {
    return "PRAGMA journal_mode=DELETE; PRAGMA synchronous=NORMAL;";
  }
  return "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;";
}

async function test_vfs_open(
  sqlite3: SQLiteApi,
  vfs_name: string,
  storage: WorkerStorageMode,
): Promise<void> {
  const probe = `__probe_${storage}.db`;
  const db = await sqlite3.open_v2(probe, SQLITE_OPEN_FLAGS, vfs_name);
  await sqlite3.exec(db, connection_pragmas(storage));
  await sqlite3.exec(db, "CREATE TABLE IF NOT EXISTS __probe (id INTEGER);");
  await sqlite3.close(db);
}

async function create_runtime(): Promise<RuntimeState> {
  const module: unknown = await SQLiteAsyncESMFactory({
    locateFile(path: string): string {
      if (path === "wa-sqlite-async.wasm") {
        return wa_sqlite_async_wasm_url;
      }
      return path;
    },
  });
  const sqlite3 = SQLite.Factory(module);

  const candidates: Array<{
    storage: WorkerStorageMode;
    create: () => Promise<VfsWithLifecycle | null>;
  }> = [
    {
      storage: "opfs",
      create: async () => {
        if (!is_opfs_supported()) return null;
        const imported =
          (await import("@journeyapps/wa-sqlite/src/examples/OPFSAdaptiveVFS.js")) as unknown as {
            OPFSAdaptiveVFS: VfsFactory;
          };
        return imported.OPFSAdaptiveVFS.create("jotter-search-opfs", module);
      },
    },
    {
      storage: "idb",
      create: async () => {
        if (typeof indexedDB === "undefined") return null;
        const imported =
          (await import("@journeyapps/wa-sqlite/src/examples/IDBBatchAtomicVFS.js")) as unknown as {
            IDBBatchAtomicVFS: VfsFactory;
          };
        return imported.IDBBatchAtomicVFS.create("jotter-search", module);
      },
    },
    {
      storage: "memory",
      create: async () => {
        const imported =
          (await import("@journeyapps/wa-sqlite/src/examples/MemoryAsyncVFS.js")) as unknown as {
            MemoryAsyncVFS: VfsFactory;
          };
        return imported.MemoryAsyncVFS.create("jotter-search-memory", module);
      },
    },
  ];

  for (const candidate of candidates) {
    let vfs: VfsWithLifecycle | null = null;
    try {
      vfs = await candidate.create();
    } catch (error) {
      if (candidate.storage === "memory") {
        throw error;
      }
      continue;
    }
    if (!vfs) continue;

    try {
      sqlite3.vfs_register(vfs as never, false);
      await test_vfs_open(sqlite3, vfs.name, candidate.storage);
      return {
        sqlite3,
        vfs,
        storage: candidate.storage,
      };
    } catch (error) {
      await vfs.close?.();
      if (candidate.storage === "memory") {
        throw error;
      }
    }
  }

  throw new Error("No SQLite storage backend is available");
}

async function fts_schema_needs_migration(db: number): Promise<boolean> {
  const rows = await sql_rows(
    db,
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='notes_fts'",
  );
  if (rows.length === 0) return false;
  const ddl = to_string(rows[0]?.[0]).toLowerCase();
  return !ddl.includes("name,");
}

async function migrate_schema_if_needed(db: number): Promise<void> {
  if (!(await fts_schema_needs_migration(db))) {
    return;
  }

  await sql_run(db, "DROP TABLE IF EXISTS notes_fts");
  await sql_run(db, DELETE_ALL_NOTES_SQL);
  await sql_run(db, DELETE_ALL_OUTLINKS_SQL);
}

async function ensure_runtime(): Promise<RuntimeState> {
  if (runtime_state) return runtime_state;
  runtime_state = await create_runtime();
  return runtime_state;
}

async function ensure_db(vault_id: string): Promise<number> {
  const existing = db_by_vault.get(vault_id);
  if (existing !== undefined) return existing;

  const runtime = await ensure_runtime();
  const db = await runtime.sqlite3.open_v2(
    db_file_name(vault_id),
    SQLITE_OPEN_FLAGS,
    runtime.vfs.name,
  );

  await runtime.sqlite3.exec(db, connection_pragmas(runtime.storage));
  await migrate_schema_if_needed(db);
  await runtime.sqlite3.exec(db, SEARCH_SCHEMA_SQL);
  db_by_vault.set(vault_id, db);
  return db;
}

async function sql_rows(
  db: number,
  sql: string,
  params: Array<string | number | bigint | Uint8Array | null> = [],
): Promise<unknown[][]> {
  const runtime = await ensure_runtime();
  const rows: unknown[][] = [];

  for await (const stmt of runtime.sqlite3.statements(db, sql)) {
    if (params.length > 0 && runtime.sqlite3.bind_parameter_count(stmt) > 0) {
      runtime.sqlite3.bind_collection(stmt, params as never);
    }

    while ((await runtime.sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
      rows.push(runtime.sqlite3.row(stmt) as unknown[]);
    }
  }

  return rows;
}

async function sql_run(
  db: number,
  sql: string,
  params: Array<string | number | bigint | Uint8Array | null> = [],
): Promise<void> {
  await sql_rows(db, sql, params);
}

async function upsert_note_record(db: number, doc: NoteDoc): Promise<void> {
  await sql_run(db, UPSERT_NOTE_SQL, [
    doc.meta.path,
    doc.meta.title,
    doc.meta.mtime_ms,
    doc.meta.size_bytes,
  ]);
  await sql_run(db, DELETE_NOTE_FTS_SQL, [doc.meta.path]);
  await sql_run(db, INSERT_NOTE_FTS_SQL, [
    doc.meta.title,
    file_stem(doc.meta.path),
    doc.meta.path,
    doc.markdown,
  ]);
}

async function set_outlinks(
  db: number,
  source: string,
  targets: string[],
): Promise<void> {
  await sql_run(db, DELETE_OUTLINKS_FOR_SOURCE_SQL, [source]);
  for (const target of targets) {
    await sql_run(db, INSERT_OUTLINK_SQL, [source, target]);
  }
}

async function reindex_outlinks_for_note(
  db: number,
  source: string,
  markdown: string,
): Promise<void> {
  const targets = gfm_link_targets(markdown, source);
  const resolved = new Set<string>();

  for (const target of targets) {
    if (target === source) continue;
    resolved.add(target);
  }

  await set_outlinks(db, source, [...resolved]);
}

async function rebuild_index(vault_id: string, docs: NoteDoc[]): Promise<void> {
  await begin_rebuild(
    vault_id,
    docs.map((doc) => doc.meta),
    docs.length,
  );
  for (let offset = 0; offset < docs.length; offset += BATCH_SIZE) {
    const batch = docs.slice(offset, offset + BATCH_SIZE);
    await rebuild_batch(vault_id, batch);
  }
  finish_rebuild(vault_id);
}

async function begin_rebuild(
  vault_id: string,
  _notes: WorkerNoteMeta[],
  total: number,
): Promise<void> {
  const db = await ensure_db(vault_id);
  await sql_run(db, DELETE_ALL_NOTES_SQL);
  await sql_run(db, DELETE_ALL_NOTES_FTS_SQL);
  await sql_run(db, DELETE_ALL_OUTLINKS_SQL);
  rebuild_state_by_vault.set(vault_id, {
    total,
    indexed: 0,
  });
  post_message({ type: "progress", vault_id, indexed: 0, total });
}

function get_rebuild_state(vault_id: string): RebuildState {
  const state = rebuild_state_by_vault.get(vault_id);
  if (!state) {
    throw new Error("Rebuild not initialized");
  }
  return state;
}

async function rebuild_batch(vault_id: string, docs: NoteDoc[]): Promise<void> {
  if (docs.length === 0) return;

  const db = await ensure_db(vault_id);
  const state = get_rebuild_state(vault_id);
  await sql_run(db, "BEGIN IMMEDIATE");
  try {
    for (const doc of docs) {
      await upsert_note_record(db, doc);
      await sql_run(db, DELETE_OUTLINKS_FOR_SOURCE_SQL, [doc.meta.path]);
      const resolved = new Set<string>();
      for (const target of gfm_link_targets(doc.markdown, doc.meta.path)) {
        if (target === doc.meta.path) continue;
        resolved.add(target);
      }
      for (const target of resolved) {
        await sql_run(db, INSERT_OUTLINK_SQL, [doc.meta.path, target]);
      }
      state.indexed += 1;
    }
    await sql_run(db, "COMMIT");
  } catch (error) {
    await sql_run(db, "ROLLBACK");
    throw error;
  }
  post_message({
    type: "progress",
    vault_id,
    indexed: state.indexed,
    total: state.total,
  });
}

function finish_rebuild(vault_id: string): void {
  rebuild_state_by_vault.delete(vault_id);
}

async function upsert_note(vault_id: string, doc: NoteDoc): Promise<void> {
  const db = await ensure_db(vault_id);
  await upsert_note_record(db, doc);
  await reindex_outlinks_for_note(db, doc.meta.path, doc.markdown);
}

async function remove_note(vault_id: string, note_id: string): Promise<void> {
  const db = await ensure_db(vault_id);
  await sql_run(db, DELETE_NOTE_SQL, [note_id]);
  await sql_run(db, DELETE_NOTE_FTS_SQL, [note_id]);
  await sql_run(db, DELETE_OUTLINKS_FOR_SOURCE_SQL, [note_id]);
}

function normalize_limit(limit: number, fallback: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return fallback;
  return Math.floor(limit);
}

async function search(
  vault_id: string,
  query: SearchWorkerRequest & { type: "search" },
): Promise<WorkerSearchHit[]> {
  const db = await ensure_db(vault_id);
  const trimmed = query.query.text.trim();
  if (trimmed === "") return [];

  const match_expr = search_match_expression(trimmed, query.query.scope);
  if (match_expr === "") return [];

  const rows = await sql_rows(db, SEARCH_SQL, [
    match_expr,
    normalize_limit(query.limit, 50),
  ]);
  return rows.map((row) => {
    const note = to_note_meta(row);
    const snippet = to_nullable_string(row[4]);
    return {
      note,
      score: to_number(row[5]),
      snippet: snippet ?? undefined,
    };
  });
}

async function suggest(
  vault_id: string,
  query: SearchWorkerRequest & { type: "suggest" },
): Promise<WorkerSuggestion[]> {
  const db = await ensure_db(vault_id);
  const trimmed = query.query.trim();
  if (trimmed === "") return [];

  const match_expr = suggest_match_expression(trimmed);
  if (match_expr === "") return [];

  const rows = await sql_rows(db, SUGGEST_SQL, [
    match_expr,
    normalize_limit(query.limit, 15),
  ]);
  return rows.map((row) => ({
    note: to_note_meta(row),
    score: to_number(row[4]),
  }));
}

async function suggest_planned(
  vault_id: string,
  query: SearchWorkerRequest & { type: "suggest_planned" },
): Promise<WorkerPlannedSuggestion[]> {
  const db = await ensure_db(vault_id);
  const match_expr = planned_match_expression(query.query);
  if (match_expr === "") return [];

  const rows = await sql_rows(db, PLANNED_SUGGEST_SQL, [
    match_expr,
    normalize_limit(query.limit, 15),
  ]);
  return rows.map((row) => ({
    target_path: to_string(row[0]),
    ref_count: to_number(row[1]),
  }));
}

async function close_all(): Promise<void> {
  const runtime = runtime_state;
  if (!runtime) return;
  for (const db of db_by_vault.values()) {
    await runtime.sqlite3.close(db);
  }
  db_by_vault.clear();
  rebuild_state_by_vault.clear();
  await runtime.vfs.close?.();
  runtime_state = null;
}

function is_unreachable_runtime_abort(error: unknown): boolean {
  const message = as_error_message(error).toLowerCase();
  return (
    message.includes("runtimeerror: unreachable") ||
    message.includes("aborted(")
  );
}

function post_result(id: number, data: unknown): void {
  post_message({ type: "result", id, data });
}

async function handle_request_once(
  request: SearchWorkerRequest,
): Promise<void> {
  if (request.type === "init") {
    await ensure_db(request.vault_id);
    const runtime = await ensure_runtime();
    post_message({
      type: "ready",
      id: request.id,
      vault_id: request.vault_id,
      storage: runtime.storage,
    });
    post_result(request.id, null);
    return;
  }

  if (request.type === "exec") {
    const db = await ensure_db(request.vault_id);
    const rows = await sql_rows(
      db,
      request.sql,
      (request.params ?? []) as Array<
        string | number | bigint | Uint8Array | null
      >,
    );
    post_result(request.id, rows);
    return;
  }

  if (request.type === "rebuild_begin") {
    await begin_rebuild(request.vault_id, request.notes, request.total);
    post_result(request.id, null);
    return;
  }

  if (request.type === "rebuild_batch") {
    await rebuild_batch(request.vault_id, request.docs);
    post_result(request.id, null);
    return;
  }

  if (request.type === "rebuild_finish") {
    finish_rebuild(request.vault_id);
    post_result(request.id, null);
    return;
  }

  if (request.type === "rebuild_index") {
    await rebuild_index(request.vault_id, request.docs);
    post_result(request.id, null);
    return;
  }

  if (request.type === "upsert_note") {
    await upsert_note(request.vault_id, request.doc);
    post_result(request.id, null);
    return;
  }

  if (request.type === "remove_note") {
    await remove_note(request.vault_id, request.note_id);
    post_result(request.id, null);
    return;
  }

  if (request.type === "search") {
    const hits = await search(request.vault_id, request);
    post_result(request.id, hits);
    return;
  }

  if (request.type === "suggest") {
    const hits = await suggest(request.vault_id, request);
    post_result(request.id, hits);
    return;
  }

  if (request.type === "suggest_planned") {
    const hits = await suggest_planned(request.vault_id, request);
    post_result(request.id, hits);
    return;
  }

  await close_all();
  post_result(request.id, null);
}

async function handle_request(request: SearchWorkerRequest): Promise<void> {
  try {
    await handle_request_once(request);
  } catch (error) {
    const message = as_error_message(error);
    if (is_unreachable_runtime_abort(error)) {
      log.error("Fatal wasm abort", {
        request_type: request.type,
        error,
      });
    }
    post_message({
      type: "error",
      id: request.id,
      message,
    });
  }
}

let request_queue: Promise<void> = Promise.resolve();

worker_scope.onmessage = (event: MessageEvent<SearchWorkerRequest>) => {
  request_queue = request_queue
    .then(() => handle_request(event.data))
    .catch(() => undefined);
};

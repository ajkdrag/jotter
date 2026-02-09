import SQLiteAsyncESMFactory from "wa-sqlite/dist/wa-sqlite-async.mjs";
import * as SQLite from "wa-sqlite";
import { IDBBatchAtomicVFS } from "wa-sqlite/src/examples/IDBBatchAtomicVFS.js";
import { MemoryAsyncVFS } from "wa-sqlite/src/examples/MemoryAsyncVFS.js";
import { OriginPrivateFileSystemVFS } from "wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js";
import type { NoteDoc } from "$lib/types/note";
import type {
  SearchWorkerMessage,
  SearchWorkerRequest,
  WorkerNoteMeta,
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
  SELECT_ALL_NOTES_SQL,
  SUGGEST_SQL,
  UPSERT_NOTE_SQL,
  search_match_expression,
  suggest_match_expression,
} from "$lib/db/search_queries";
import {
  build_key_map,
  resolve_wiki_target,
  wiki_link_targets,
} from "$lib/adapters/web/wiki_links_web";

const BATCH_SIZE = 100;
const SQLITE_OPEN_FLAGS =
  SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE;

type SQLiteApi = ReturnType<typeof SQLite.Factory>;

type RuntimeState = {
  sqlite3: SQLiteApi;
  vfs: VfsWithLifecycle;
  storage: WorkerStorageMode;
};

type NoteRef = {
  path: string;
  title: string;
  mtime_ms: number;
  size_bytes: number;
};

type VfsWithLifecycle = {
  name: string;
  close?: () => Promise<void> | void;
};

const worker_scope = self as unknown as {
  postMessage: (message: SearchWorkerMessage) => void;
  onmessage: ((event: MessageEvent<SearchWorkerRequest>) => void) | null;
};

let runtime_state: RuntimeState | null = null;
const db_by_vault = new Map<string, number>();

function as_error_message(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function to_number(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return 0;
}

function to_string(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }
  return "";
}

function to_nullable_string(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return to_string(value);
}

function to_note_meta(row: unknown[]): WorkerNoteMeta {
  const path = to_string(row[0]);
  return {
    id: path,
    path,
    title: to_string(row[1]),
    mtime_ms: to_number(row[2]),
    size_bytes: to_number(row[3]),
  };
}

function to_note_ref(row: unknown[]): NoteRef {
  return {
    path: to_string(row[0]),
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

async function test_vfs_open(
  sqlite3: SQLiteApi,
  vfs_name: string,
  storage: WorkerStorageMode,
): Promise<void> {
  const probe = `__probe_${storage}.db`;
  const db = await sqlite3.open_v2(probe, SQLITE_OPEN_FLAGS, vfs_name);
  await sqlite3.exec(
    db,
    "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; CREATE TABLE IF NOT EXISTS __probe (id INTEGER);",
  );
  await sqlite3.close(db);
}

async function create_runtime(): Promise<RuntimeState> {
  const module: unknown = await SQLiteAsyncESMFactory();
  const sqlite3 = SQLite.Factory(module);

  const candidates: Array<{
    storage: WorkerStorageMode;
    create: () => VfsWithLifecycle | null;
  }> = [
    {
      storage: "opfs",
      create: () => {
        if (!is_opfs_supported()) return null;
        return new OriginPrivateFileSystemVFS();
      },
    },
    {
      storage: "idb",
      create: () => {
        if (typeof indexedDB === "undefined") return null;
        return new IDBBatchAtomicVFS("jotter-search");
      },
    },
    {
      storage: "memory",
      create: () => new MemoryAsyncVFS(),
    },
  ];

  for (const candidate of candidates) {
    const vfs = candidate.create();
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

  await runtime.sqlite3.exec(
    db,
    "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;",
  );
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
  const result = await runtime.sqlite3.execWithParams(db, sql, params as never);
  return result.rows as unknown[][];
}

async function sql_run(
  db: number,
  sql: string,
  params: Array<string | number | bigint | Uint8Array | null> = [],
): Promise<void> {
  const runtime = await ensure_runtime();
  await runtime.sqlite3.run(db, sql, params as never);
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
    doc.meta.path,
    doc.markdown,
  ]);
}

async function list_all_notes(db: number): Promise<NoteRef[]> {
  const rows = await sql_rows(db, SELECT_ALL_NOTES_SQL);
  return rows.map(to_note_ref);
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
  const notes = await list_all_notes(db);
  const key_map = build_key_map(notes);
  const resolved = new Set<string>();

  for (const token of wiki_link_targets(markdown)) {
    const target = resolve_wiki_target(token, key_map);
    if (!target) continue;
    if (target === source) continue;
    resolved.add(target);
  }

  await set_outlinks(db, source, [...resolved]);
}

async function rebuild_index(vault_id: string, docs: NoteDoc[]): Promise<void> {
  const db = await ensure_db(vault_id);
  await sql_run(db, DELETE_ALL_NOTES_SQL);
  await sql_run(db, DELETE_ALL_NOTES_FTS_SQL);
  await sql_run(db, DELETE_ALL_OUTLINKS_SQL);

  const total = docs.length;
  let indexed = 0;
  post_message({ type: "progress", vault_id, indexed, total });

  const pending_links: Array<{ source: string; targets: string[] }> = [];

  for (let offset = 0; offset < docs.length; offset += BATCH_SIZE) {
    const batch = docs.slice(offset, offset + BATCH_SIZE);
    await sql_run(db, "BEGIN IMMEDIATE");
    try {
      for (const doc of batch) {
        await upsert_note_record(db, doc);
        const targets = wiki_link_targets(doc.markdown);
        if (targets.length > 0) {
          pending_links.push({
            source: doc.meta.path,
            targets,
          });
        }
        indexed += 1;
      }
      await sql_run(db, "COMMIT");
    } catch (error) {
      await sql_run(db, "ROLLBACK");
      throw error;
    }

    post_message({ type: "progress", vault_id, indexed, total });
  }

  const key_map = build_key_map(await list_all_notes(db));
  for (const link of pending_links) {
    const resolved = new Set<string>();
    for (const token of link.targets) {
      const target = resolve_wiki_target(token, key_map);
      if (!target) continue;
      if (target === link.source) continue;
      resolved.add(target);
    }
    await set_outlinks(db, link.source, [...resolved]);
  }
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

async function close_all(): Promise<void> {
  const runtime = runtime_state;
  if (!runtime) return;
  for (const db of db_by_vault.values()) {
    await runtime.sqlite3.close(db);
  }
  db_by_vault.clear();
  await runtime.vfs.close?.();
  runtime_state = null;
}

async function handle_request(request: SearchWorkerRequest): Promise<void> {
  try {
    if (request.type === "init") {
      await ensure_db(request.vault_id);
      const runtime = await ensure_runtime();
      post_message({
        type: "ready",
        id: request.id,
        vault_id: request.vault_id,
        storage: runtime.storage,
      });
      post_message({
        type: "result",
        id: request.id,
        data: null,
      });
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
      post_message({
        type: "result",
        id: request.id,
        data: rows,
      });
      return;
    }

    if (request.type === "rebuild_index") {
      await rebuild_index(request.vault_id, request.docs);
      post_message({
        type: "result",
        id: request.id,
        data: null,
      });
      return;
    }

    if (request.type === "upsert_note") {
      await upsert_note(request.vault_id, request.doc);
      post_message({
        type: "result",
        id: request.id,
        data: null,
      });
      return;
    }

    if (request.type === "remove_note") {
      await remove_note(request.vault_id, request.note_id);
      post_message({
        type: "result",
        id: request.id,
        data: null,
      });
      return;
    }

    if (request.type === "search") {
      const hits = await search(request.vault_id, request);
      post_message({
        type: "result",
        id: request.id,
        data: hits,
      });
      return;
    }

    if (request.type === "suggest") {
      const hits = await suggest(request.vault_id, request);
      post_message({
        type: "result",
        id: request.id,
        data: hits,
      });
      return;
    }

    await close_all();
    post_message({
      type: "result",
      id: request.id,
      data: null,
    });
    return;
  } catch (error) {
    post_message({
      type: "error",
      id: request.id,
      message: as_error_message(error),
    });
  }
}

worker_scope.onmessage = (event: MessageEvent<SearchWorkerRequest>) => {
  void handle_request(event.data);
};

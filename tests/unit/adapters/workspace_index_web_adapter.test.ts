import { describe, expect, it, vi } from "vitest";
import { create_workspace_index_web_adapter } from "$lib/adapters/web/workspace_index_web_adapter";
import { as_markdown_text, as_note_path, as_vault_id } from "$lib/types/ids";
import type { NotesPort } from "$lib/ports/notes_port";
import type { SearchDbWeb } from "$lib/adapters/web/search_db_web";
import type { NoteDoc, NoteMeta } from "$lib/types/note";

function build_meta(
  path: string,
  title: string,
  mtime_ms: number,
  size_bytes: number,
): NoteMeta {
  const note_path = as_note_path(path);
  return {
    id: note_path,
    path: note_path,
    name: path.split("/").at(-1)?.replace(/\.md$/, "") ?? "",
    title,
    mtime_ms,
    size_bytes,
  };
}

function build_doc(meta: NoteMeta): NoteDoc {
  return {
    meta,
    markdown: as_markdown_text(`# ${meta.title}`),
  };
}

function create_notes_port(docs: Map<string, NoteDoc>): {
  notes: NotesPort;
  mocks: {
    list_notes: ReturnType<typeof vi.fn>;
    read_note: ReturnType<typeof vi.fn>;
  };
} {
  const list_notes = vi
    .fn()
    .mockResolvedValue([...docs.values()].map((doc) => doc.meta));
  const read_note = vi.fn().mockImplementation((_vault_id, note_id) => {
    const doc = docs.get(String(note_id));
    if (!doc) return Promise.reject(new Error("missing note"));
    return Promise.resolve(doc);
  });
  return {
    notes: {
      list_notes,
      list_folders: vi.fn().mockResolvedValue([]),
      read_note,
      write_note: vi.fn().mockResolvedValue(undefined),
      create_note: vi.fn().mockRejectedValue(new Error("not implemented")),
      create_folder: vi.fn().mockResolvedValue(undefined),
      rename_note: vi.fn().mockResolvedValue(undefined),
      delete_note: vi.fn().mockResolvedValue(undefined),
      rename_folder: vi.fn().mockResolvedValue(undefined),
      delete_folder: vi.fn().mockResolvedValue(undefined),
      list_folder_contents: vi.fn().mockResolvedValue({
        notes: [],
        subfolders: [],
        total_count: 0,
        has_more: false,
      }),
      get_folder_stats: vi.fn().mockResolvedValue({
        note_count: 0,
        folder_count: 0,
      }),
    },
    mocks: {
      list_notes,
      read_note,
    },
  };
}

function create_search_db(overrides: Partial<SearchDbWeb> = {}): {
  search_db: SearchDbWeb;
  mocks: {
    exec: ReturnType<typeof vi.fn>;
    rebuild_begin: ReturnType<typeof vi.fn>;
    rebuild_batch: ReturnType<typeof vi.fn>;
    rebuild_finish: ReturnType<typeof vi.fn>;
    upsert_note: ReturnType<typeof vi.fn>;
    remove_note: ReturnType<typeof vi.fn>;
  };
} {
  const defaults = {
    exec: vi.fn().mockResolvedValue([]),
    rebuild_begin: vi.fn().mockResolvedValue(undefined),
    rebuild_batch: vi.fn().mockResolvedValue(undefined),
    rebuild_finish: vi.fn().mockResolvedValue(undefined),
    upsert_note: vi.fn().mockResolvedValue(undefined),
    remove_note: vi.fn().mockResolvedValue(undefined),
  };
  const merged = {
    ...defaults,
    ...overrides,
  };
  return {
    search_db: {
      ...merged,
      subscribe_progress: vi.fn(() => () => undefined),
    } as unknown as SearchDbWeb,
    mocks: merged as {
      exec: ReturnType<typeof vi.fn>;
      rebuild_begin: ReturnType<typeof vi.fn>;
      rebuild_batch: ReturnType<typeof vi.fn>;
      rebuild_finish: ReturnType<typeof vi.fn>;
      upsert_note: ReturnType<typeof vi.fn>;
      remove_note: ReturnType<typeof vi.fn>;
    },
  };
}

function create_deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush_ticks(times = 8): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

describe("workspace_index_web_adapter", () => {
  it("sync_index triggers force_scan reconciliation", async () => {
    const meta = build_meta("notes/a.md", "A", 1, 100);
    const docs = new Map<string, NoteDoc>([[String(meta.id), build_doc(meta)]]);
    const { notes } = create_notes_port(docs);
    const { search_db, mocks } = create_search_db({
      exec: vi.fn().mockResolvedValue([[String(meta.path), 1, 100]]),
    });

    const adapter = create_workspace_index_web_adapter(notes, search_db);
    const events: string[] = [];
    adapter.subscribe_index_progress((event) => {
      events.push(event.status);
    });

    await adapter.sync_index(as_vault_id("vault-sync"));
    await flush_ticks();

    expect(mocks.exec).toHaveBeenCalledWith(
      as_vault_id("vault-sync"),
      "SELECT path, mtime_ms, size_bytes FROM notes",
    );
    expect(events).toEqual(["started", "progress", "completed"]);
  });

  it("reports file-level progress totals during force_scan", async () => {
    const changed_meta = build_meta("notes/changed.md", "Changed", 2, 200);
    const same_meta = build_meta("notes/same.md", "Same", 1, 100);
    const docs = new Map<string, NoteDoc>([
      [String(changed_meta.id), build_doc(changed_meta)],
      [String(same_meta.id), build_doc(same_meta)],
    ]);
    const { notes } = create_notes_port(docs);
    const { search_db } = create_search_db({
      exec: vi.fn().mockResolvedValue([
        [String(changed_meta.path), 1, 100],
        ["notes/removed.md", 1, 100],
        [String(same_meta.path), 1, 100],
      ]),
    });

    const adapter = create_workspace_index_web_adapter(notes, search_db);
    const progress_totals: number[] = [];
    adapter.subscribe_index_progress((event) => {
      if (event.status === "progress") {
        progress_totals.push(event.total);
      }
    });

    await adapter.sync_index(as_vault_id("vault-file-progress"));
    await flush_ticks(16);

    expect(progress_totals.some((value) => value >= 2)).toBe(true);
  });

  it("force_scan progress advances even if some note reads fail", async () => {
    const meta_a = build_meta("notes/a.md", "A", 2, 200);
    const meta_b = build_meta("notes/b.md", "B", 2, 200);
    const docs = new Map<string, NoteDoc>([
      [String(meta_a.id), build_doc(meta_a)],
      [String(meta_b.id), build_doc(meta_b)],
    ]);
    const { notes, mocks: note_mocks } = create_notes_port(docs);
    note_mocks.read_note.mockImplementation((_vault_id, note_id) => {
      if (String(note_id) === String(meta_b.id)) {
        return Promise.reject(new Error("unreadable"));
      }
      const doc = docs.get(String(note_id));
      if (!doc) {
        return Promise.reject(new Error("missing note"));
      }
      return Promise.resolve(doc);
    });
    const { search_db } = create_search_db({
      exec: vi.fn().mockResolvedValue([
        [String(meta_a.path), 1, 100],
        [String(meta_b.path), 1, 100],
      ]),
    });

    const adapter = create_workspace_index_web_adapter(notes, search_db);
    const indexed_points: number[] = [];
    adapter.subscribe_index_progress((event) => {
      if (event.status === "progress") {
        indexed_points.push(event.indexed);
      }
    });

    await adapter.sync_index(as_vault_id("vault-progress-errors"));
    await flush_ticks(16);

    expect(indexed_points.some((value) => value > 0)).toBe(true);
    expect(indexed_points.at(-1)).toBeGreaterThanOrEqual(2);
  });

  it("reduces dirty work so remove_path dominates upsert_path", async () => {
    const meta = build_meta("notes/a.md", "A", 1, 100);
    const docs = new Map<string, NoteDoc>([[String(meta.id), build_doc(meta)]]);
    const { notes } = create_notes_port(docs);
    const { search_db, mocks } = create_search_db();

    const adapter = create_workspace_index_web_adapter(notes, search_db);
    const vault_id = as_vault_id("vault-reduce");

    const first = adapter.upsert_note(vault_id, as_note_path("notes/a.md"));
    const second = adapter.remove_note(vault_id, as_note_path("notes/a.md"));
    await first;
    await second;
    await flush_ticks();

    expect(mocks.upsert_note).not.toHaveBeenCalled();
    expect(mocks.remove_note).toHaveBeenCalledWith(
      vault_id,
      as_note_path("notes/a.md"),
    );
  });

  it("handles bulk remove_prefix without per-file reads", async () => {
    const docs = new Map<string, NoteDoc>();
    const { notes, mocks: note_mocks } = create_notes_port(docs);
    const { search_db, mocks } = create_search_db();

    const adapter = create_workspace_index_web_adapter(notes, search_db);
    await adapter.remove_notes_by_prefix(as_vault_id("vault-prefix"), "docs/");
    await flush_ticks();

    expect(note_mocks.read_note).not.toHaveBeenCalled();
    expect(mocks.exec).toHaveBeenCalledWith(
      as_vault_id("vault-prefix"),
      "BEGIN IMMEDIATE",
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      as_vault_id("vault-prefix"),
      "DELETE FROM notes WHERE path LIKE ?1 ESCAPE '\\'",
      ["docs/%"],
    );
  });

  it("handles bulk rename_prefix without per-file reads", async () => {
    const docs = new Map<string, NoteDoc>();
    const { notes, mocks: note_mocks } = create_notes_port(docs);
    const { search_db, mocks } = create_search_db();

    const adapter = create_workspace_index_web_adapter(notes, search_db);
    await adapter.rename_folder_paths(
      as_vault_id("vault-rename"),
      "old/",
      "new/",
    );
    await flush_ticks();

    expect(note_mocks.read_note).not.toHaveBeenCalled();
    expect(mocks.exec).toHaveBeenCalledWith(
      as_vault_id("vault-rename"),
      "BEGIN IMMEDIATE",
    );
    expect(mocks.exec).toHaveBeenCalledWith(
      as_vault_id("vault-rename"),
      expect.stringContaining("UPDATE notes SET path"),
      ["new/", 4, "old/%"],
    );
  });

  it("renames a single note path without rewriting inbound target rows", async () => {
    const docs = new Map<string, NoteDoc>();
    const { notes } = create_notes_port(docs);
    const { search_db, mocks } = create_search_db();

    const adapter = create_workspace_index_web_adapter(notes, search_db);
    await adapter.rename_note_path(
      as_vault_id("vault-rename-note"),
      as_note_path("old.md"),
      as_note_path("new.md"),
    );
    await flush_ticks();

    expect(mocks.exec).toHaveBeenCalledWith(
      as_vault_id("vault-rename-note"),
      "UPDATE outlinks SET source_path = ?1 WHERE source_path = ?2",
      ["new.md", "old.md"],
    );
    const rewrote_inbound_targets = mocks.exec.mock.calls.some(
      (call) =>
        typeof call[1] === "string" &&
        call[1].includes("UPDATE outlinks SET target_path = ?1"),
    );
    expect(rewrote_inbound_targets).toBe(false);
  });

  it("escapes sql like wildcards for prefix operations", async () => {
    const docs = new Map<string, NoteDoc>();
    const { notes } = create_notes_port(docs);
    const { search_db, mocks } = create_search_db();

    const adapter = create_workspace_index_web_adapter(notes, search_db);
    const vault_id = as_vault_id("vault-wildcards");

    await adapter.remove_notes_by_prefix(vault_id, "docs_50%/");
    await flush_ticks();

    expect(mocks.exec).toHaveBeenCalledWith(
      vault_id,
      "DELETE FROM notes WHERE path LIKE ?1 ESCAPE '\\'",
      ["docs\\_50\\%/%"],
    );

    await adapter.rename_folder_paths(vault_id, "old_50%/", "new/");
    await flush_ticks();

    expect(mocks.exec).toHaveBeenCalledWith(
      vault_id,
      expect.stringContaining("UPDATE notes SET path"),
      ["new/", 8, "old\\_50\\%/%"],
    );
  });

  it("processes follow-up dirty work without re-running full scan", async () => {
    const meta = build_meta("notes/a.md", "A", 1, 100);
    const docs = new Map<string, NoteDoc>([[String(meta.id), build_doc(meta)]]);
    const { notes, mocks: note_mocks } = create_notes_port(docs);
    const list_gate = create_deferred<NoteMeta[]>();

    note_mocks.list_notes.mockImplementation(() => list_gate.promise);

    const { search_db, mocks } = create_search_db({
      exec: vi.fn().mockResolvedValue([[String(meta.path), 1, 100]]),
    });

    const adapter = create_workspace_index_web_adapter(notes, search_db);
    const vault_id = as_vault_id("vault-follow-up");

    await adapter.sync_index(vault_id);
    await adapter.upsert_note(vault_id, meta.id);

    list_gate.resolve([meta]);
    await flush_ticks(16);

    expect(note_mocks.list_notes).toHaveBeenCalledTimes(1);
    expect(mocks.upsert_note).toHaveBeenCalledWith(vault_id, build_doc(meta));
  });

  it("runs per-vault actors independently", async () => {
    const meta_a = build_meta("notes/a.md", "A", 1, 100);
    const meta_b = build_meta("notes/b.md", "B", 1, 100);
    const docs = new Map<string, NoteDoc>([
      [String(meta_a.id), build_doc(meta_a)],
      [String(meta_b.id), build_doc(meta_b)],
    ]);
    const { notes, mocks: note_mocks } = create_notes_port(docs);
    const vault_a = as_vault_id("vault-a");
    const vault_b = as_vault_id("vault-b");
    const list_gate = create_deferred<NoteMeta[]>();

    note_mocks.list_notes.mockImplementation((requested_vault_id: string) => {
      if (requested_vault_id === vault_a) {
        return list_gate.promise;
      }
      return Promise.resolve([meta_b]);
    });

    const { search_db } = create_search_db({
      exec: vi.fn().mockResolvedValue([["notes/b.md", 1, 100]]),
    });

    const adapter = create_workspace_index_web_adapter(notes, search_db);

    await adapter.sync_index(vault_a);
    await adapter.upsert_note(vault_b, meta_b.id);
    await flush_ticks();

    expect(note_mocks.read_note).toHaveBeenCalledWith(vault_b, meta_b.id);

    list_gate.resolve([meta_a]);
    await flush_ticks(8);
  });
});

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
    subscribe_progress: ReturnType<typeof vi.fn>;
    upsert_note: ReturnType<typeof vi.fn>;
    remove_note: ReturnType<typeof vi.fn>;
  };
} {
  const mocks = {
    exec: vi.fn().mockResolvedValue([]),
    rebuild_begin: vi.fn().mockResolvedValue(undefined),
    rebuild_batch: vi.fn().mockResolvedValue(undefined),
    rebuild_finish: vi.fn().mockResolvedValue(undefined),
    subscribe_progress: vi.fn(() => () => undefined),
    upsert_note: vi.fn().mockResolvedValue(undefined),
    remove_note: vi.fn().mockResolvedValue(undefined),
  };
  return {
    search_db: {
      ...mocks,
      ...overrides,
    } as unknown as SearchDbWeb,
    mocks,
  };
}

describe("workspace_index_web_adapter", () => {
  it("falls back to full rebuild when index manifest is empty", async () => {
    const docs = new Map<string, NoteDoc>();
    for (let i = 0; i < 250; i += 1) {
      const idx = String(i);
      const meta = build_meta(
        `notes/note-${idx}.md`,
        `Note ${idx}`,
        i,
        100 + i,
      );
      docs.set(String(meta.id), build_doc(meta));
    }

    const { notes } = create_notes_port(docs);
    const { search_db, mocks } = create_search_db({
      exec: vi.fn().mockResolvedValue([]),
    });

    const adapter = create_workspace_index_web_adapter(notes, search_db);
    const vault_id = as_vault_id("vault-rebuild");
    const events: Array<{ status: string; total?: number; indexed?: number }> =
      [];
    adapter.subscribe_index_progress((event) => {
      events.push(
        event as { status: string; total?: number; indexed?: number },
      );
    });

    await adapter.build_index(vault_id);

    expect(mocks.rebuild_begin).toHaveBeenCalledTimes(1);
    expect(mocks.rebuild_batch).toHaveBeenCalledTimes(3);
    expect(mocks.rebuild_finish).toHaveBeenCalledTimes(1);
    expect(events[0]).toMatchObject({ status: "started", total: 250 });
    expect(events.at(-1)).toMatchObject({ status: "completed", indexed: 250 });
  });

  it("skips all writes when manifest matches disk state", async () => {
    const meta_a = build_meta("notes/a.md", "A", 10, 100);
    const meta_b = build_meta("notes/b.md", "B", 20, 200);
    const docs = new Map<string, NoteDoc>([
      [String(meta_a.id), build_doc(meta_a)],
      [String(meta_b.id), build_doc(meta_b)],
    ]);
    const { notes, mocks: note_mocks } = create_notes_port(docs);
    const { search_db, mocks } = create_search_db({
      exec: vi.fn().mockResolvedValue([
        [String(meta_a.path), meta_a.mtime_ms, meta_a.size_bytes],
        [String(meta_b.path), meta_b.mtime_ms, meta_b.size_bytes],
      ]),
    });
    const adapter = create_workspace_index_web_adapter(notes, search_db);

    const events: Array<{ status: string; total?: number; indexed?: number }> =
      [];
    adapter.subscribe_index_progress((event) => {
      events.push(
        event as { status: string; total?: number; indexed?: number },
      );
    });

    await adapter.build_index(as_vault_id("vault-noop"));

    expect(mocks.remove_note).not.toHaveBeenCalled();
    expect(mocks.upsert_note).not.toHaveBeenCalled();
    expect(note_mocks.read_note).not.toHaveBeenCalled();
    expect(events[0]).toMatchObject({ status: "started", total: 0 });
    expect(events.at(-1)).toMatchObject({ status: "completed", indexed: 0 });
  });

  it("applies remove and upsert for delta changes", async () => {
    const unchanged = build_meta("notes/unchanged.md", "Unchanged", 10, 100);
    const modified = build_meta("notes/modified.md", "Modified", 30, 300);
    const added = build_meta("notes/added.md", "Added", 40, 400);
    const docs = new Map<string, NoteDoc>([
      [String(unchanged.id), build_doc(unchanged)],
      [String(modified.id), build_doc(modified)],
      [String(added.id), build_doc(added)],
    ]);
    const { notes, mocks: note_mocks } = create_notes_port(docs);
    const { search_db, mocks } = create_search_db({
      exec: vi.fn().mockResolvedValue([
        [String(unchanged.path), unchanged.mtime_ms, unchanged.size_bytes],
        [String(modified.path), 10, 100],
        ["notes/removed.md", 99, 999],
      ]),
    });

    const adapter = create_workspace_index_web_adapter(notes, search_db);
    await adapter.build_index(as_vault_id("vault-delta"));

    expect(mocks.remove_note).toHaveBeenCalledWith(
      as_vault_id("vault-delta"),
      as_note_path("notes/removed.md"),
    );
    expect(mocks.upsert_note).toHaveBeenCalledTimes(2);
    expect(note_mocks.read_note).toHaveBeenCalledTimes(2);
  });

  it("falls back to full rebuild when manifest query fails", async () => {
    const meta = build_meta("notes/a.md", "A", 1, 100);
    const docs = new Map<string, NoteDoc>([[String(meta.id), build_doc(meta)]]);
    const { notes } = create_notes_port(docs);
    const { search_db, mocks } = create_search_db({
      exec: vi.fn().mockRejectedValue(new Error("manifest error")),
    });

    const adapter = create_workspace_index_web_adapter(notes, search_db);
    await adapter.build_index(as_vault_id("vault-fallback"));

    expect(mocks.rebuild_begin).toHaveBeenCalledTimes(1);
    expect(mocks.rebuild_batch).toHaveBeenCalledTimes(1);
    expect(mocks.rebuild_finish).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { create_workspace_index_web_adapter } from "$lib/adapters/web/workspace_index_web_adapter";
import { as_markdown_text, as_note_path, as_vault_id } from "$lib/types/ids";
import type { NotesPort } from "$lib/ports/notes_port";
import type { SearchDbWeb } from "$lib/adapters/web/search_db_web";
import type { NoteDoc, NoteMeta } from "$lib/types/note";

function build_meta(path: string, title: string): NoteMeta {
  const note_path = as_note_path(path);
  return {
    id: note_path,
    path: note_path,
    name: path.split("/").at(-1)?.replace(/\.md$/, "") ?? "",
    title,
    mtime_ms: 0,
    size_bytes: title.length,
  };
}

function build_doc(meta: NoteMeta): NoteDoc {
  return {
    meta,
    markdown: as_markdown_text(`# ${meta.title}`),
  };
}

function create_notes_port(docs: Map<string, NoteDoc>): NotesPort {
  return {
    list_notes: vi
      .fn()
      .mockResolvedValue([...docs.values()].map((doc) => doc.meta)),
    list_folders: vi.fn().mockResolvedValue([]),
    read_note: vi.fn().mockImplementation((_vault_id, note_id) => {
      const doc = docs.get(String(note_id));
      if (!doc) return Promise.reject(new Error("missing note"));
      return Promise.resolve(doc);
    }),
    write_note: vi.fn().mockResolvedValue(undefined),
    create_note: vi.fn().mockRejectedValue(new Error("not implemented")),
    create_folder: vi.fn().mockResolvedValue(undefined),
    rename_note: vi.fn().mockResolvedValue(undefined),
    delete_note: vi.fn().mockResolvedValue(undefined),
    rename_folder: vi.fn().mockResolvedValue(undefined),
    delete_folder: vi.fn().mockResolvedValue({
      deleted_notes: [],
      deleted_folders: [],
    }),
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
  };
}

describe("workspace_index_web_adapter", () => {
  it("indexes in chunks and emits started/completed", async () => {
    const docs = new Map<string, NoteDoc>();
    for (let i = 0; i < 250; i += 1) {
      const idx = String(i);
      const meta = build_meta(`notes/note-${idx}.md`, `Note ${idx}`);
      docs.set(String(meta.id), build_doc(meta));
    }

    const notes = create_notes_port(docs);
    const rebuild_begin = vi.fn().mockResolvedValue(undefined);
    const rebuild_batch = vi.fn().mockResolvedValue(undefined);
    const rebuild_finish = vi.fn().mockResolvedValue(undefined);
    const search_db = {
      rebuild_begin,
      rebuild_batch,
      rebuild_finish,
      subscribe_progress: vi.fn(() => () => undefined),
      upsert_note: vi.fn().mockResolvedValue(undefined),
      remove_note: vi.fn().mockResolvedValue(undefined),
    } as unknown as SearchDbWeb;

    const adapter = create_workspace_index_web_adapter(notes, search_db);
    const vault_id = as_vault_id("vault-1");
    const events: Array<{ status: string; total?: number; indexed?: number }> =
      [];
    adapter.subscribe_index_progress((event) => {
      events.push(
        event as { status: string; total?: number; indexed?: number },
      );
    });

    await adapter.build_index(vault_id);

    expect(rebuild_begin).toHaveBeenCalledTimes(1);
    expect(rebuild_batch).toHaveBeenCalledTimes(3);
    const rebuild_batch_calls = rebuild_batch.mock.calls as Array<
      [unknown, NoteDoc[]]
    >;
    expect(rebuild_batch_calls[0]?.[1]).toHaveLength(100);
    expect(rebuild_batch_calls[1]?.[1]).toHaveLength(100);
    expect(rebuild_batch_calls[2]?.[1]).toHaveLength(50);
    expect(rebuild_finish).toHaveBeenCalledTimes(1);

    expect(events[0]).toMatchObject({ status: "started", total: 250 });
    expect(events.at(-1)).toMatchObject({ status: "completed", indexed: 250 });
  });

  it("skips unreadable notes and reports completed indexed count", async () => {
    const readable_docs = new Map<string, NoteDoc>();
    const all_metas: NoteMeta[] = [];
    for (let i = 0; i < 5; i += 1) {
      const idx = String(i);
      const meta = build_meta(`notes/note-${idx}.md`, `Note ${idx}`);
      all_metas.push(meta);
      if (i === 2) continue;
      readable_docs.set(String(meta.id), build_doc(meta));
    }

    const notes: NotesPort = {
      ...create_notes_port(readable_docs),
      list_notes: vi.fn().mockResolvedValue(all_metas),
    };

    const rebuild_begin = vi.fn().mockResolvedValue(undefined);
    const rebuild_batch = vi.fn().mockResolvedValue(undefined);
    const rebuild_finish = vi.fn().mockResolvedValue(undefined);
    const search_db = {
      rebuild_begin,
      rebuild_batch,
      rebuild_finish,
      subscribe_progress: vi.fn(() => () => undefined),
      upsert_note: vi.fn().mockResolvedValue(undefined),
      remove_note: vi.fn().mockResolvedValue(undefined),
    } as unknown as SearchDbWeb;

    const adapter = create_workspace_index_web_adapter(notes, search_db);
    const events: Array<{ status: string; indexed?: number }> = [];
    adapter.subscribe_index_progress((event) => {
      events.push(event as { status: string; indexed?: number });
    });

    await adapter.build_index(as_vault_id("vault-2"));

    expect(rebuild_batch).toHaveBeenCalledTimes(1);
    const rebuild_batch_calls = rebuild_batch.mock.calls as Array<
      [unknown, NoteDoc[]]
    >;
    expect(rebuild_batch_calls[0]?.[1]).toHaveLength(4);
    expect(events.at(-1)).toMatchObject({ status: "completed", indexed: 4 });
  });
});

import { describe, expect, it, vi } from "vitest";
import { LinkRepairService } from "$lib/services/link_repair_service";
import { EditorStore } from "$lib/stores/editor_store.svelte";
import { TabStore } from "$lib/stores/tab_store.svelte";
import { as_markdown_text, as_note_path, type NoteId } from "$lib/types/ids";
import { create_test_vault } from "../helpers/test_fixtures";
import {
  create_mock_index_port,
  create_mock_notes_port,
} from "../helpers/mock_ports";
import type { SearchPort } from "$lib/ports/search_port";

const VAULT_ID = create_test_vault().id;

function create_mock_search_port(overrides?: Partial<SearchPort>) {
  return {
    search_notes: vi.fn(),
    suggest_wiki_links: vi.fn(),
    suggest_planned_links: vi.fn(),
    get_note_links_snapshot: vi.fn().mockResolvedValue({
      backlinks: [],
      outlinks: [],
      orphan_links: [],
    }),
    extract_local_note_links: vi.fn(),
    rewrite_note_links: vi
      .fn()
      .mockImplementation((markdown: string) =>
        Promise.resolve({ markdown, changed: false }),
      ),
    ...overrides,
  } as unknown as SearchPort;
}

describe("LinkRepairService", () => {
  it("rewrites inbound backlink sources on disk", async () => {
    const editor_store = new EditorStore();
    const tab_store = new TabStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();

    const source_note = {
      id: as_note_path("docs/source.md"),
      path: as_note_path("docs/source.md"),
      name: "source",
      title: "source",
      mtime_ms: 0,
      size_bytes: 0,
    };

    notes_port.read_note = vi
      .fn()
      .mockImplementation((_vid: unknown, note_id: NoteId) => {
        if (String(note_id) === "docs/source.md") {
          return Promise.resolve({
            meta: source_note,
            markdown: as_markdown_text("See [Old](old.md)"),
          });
        }
        return Promise.resolve({
          meta: { ...source_note, id: note_id, path: as_note_path(note_id) },
          markdown: as_markdown_text("# Content"),
        });
      });

    const search_port = create_mock_search_port({
      get_note_links_snapshot: vi.fn().mockResolvedValue({
        backlinks: [{ path: "docs/source.md" }],
        outlinks: [],
        orphan_links: [],
      }),
      rewrite_note_links: vi
        .fn()
        .mockImplementation(
          (
            _markdown: string,
            _old: string,
            _new: string,
            _map: Record<string, string>,
          ) =>
            Promise.resolve({
              markdown: "See [Old](new.md)",
              changed: true,
            }),
        ),
    });

    const service = new LinkRepairService(
      notes_port,
      search_port,
      index_port,
      editor_store,
      tab_store,
      () => 1,
    );

    const path_map = new Map([["docs/old.md", "docs/new.md"]]);
    await service.repair_links(VAULT_ID, path_map);

    expect(notes_port._calls.write_note).toContainEqual({
      vault_id: VAULT_ID,
      note_id: as_note_path("docs/source.md"),
      markdown: as_markdown_text("See [Old](new.md)"),
    });
    expect(index_port._calls.upsert_note).toContainEqual({
      vault_id: VAULT_ID,
      note_id: as_note_path("docs/source.md"),
    });
  });

  it("updates open dirty editor note in-memory instead of writing to disk", async () => {
    const editor_store = new EditorStore();
    const tab_store = new TabStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();

    const source_note = {
      id: as_note_path("docs/source.md"),
      path: as_note_path("docs/source.md"),
      name: "source",
      title: "source",
      mtime_ms: 0,
      size_bytes: 0,
    };

    editor_store.set_open_note({
      meta: source_note,
      markdown: as_markdown_text("See [Old](old.md)"),
      buffer_id: "source-buffer",
      is_dirty: true,
    });

    const search_port = create_mock_search_port({
      get_note_links_snapshot: vi.fn().mockResolvedValue({
        backlinks: [{ path: "docs/source.md" }],
        outlinks: [],
        orphan_links: [],
      }),
      rewrite_note_links: vi
        .fn()
        .mockImplementation(
          (
            markdown: string,
            old_source: string,
            new_source: string,
            _map: Record<string, string>,
          ) => {
            if (old_source === new_source) {
              return Promise.resolve({
                markdown: "See [Old](new.md)",
                changed: true,
              });
            }
            return Promise.resolve({ markdown, changed: false });
          },
        ),
    });

    const service = new LinkRepairService(
      notes_port,
      search_port,
      index_port,
      editor_store,
      tab_store,
      () => 1,
    );

    const path_map = new Map([["docs/old.md", "docs/new.md"]]);
    await service.repair_links(VAULT_ID, path_map);

    expect(editor_store.open_note?.markdown).toBe(
      as_markdown_text("See [Old](new.md)"),
    );
    expect(editor_store.open_note?.is_dirty).toBe(true);
    expect(editor_store.open_note?.buffer_id).toContain(":repair-links:");
    expect(notes_port._calls.write_note).toEqual([]);
  });

  it("invalidates tab cache and editor buffer for background notes", async () => {
    const editor_store = new EditorStore();
    const tab_store = new TabStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();
    const close_editor_buffer = vi.fn();

    const source_note = {
      id: as_note_path("docs/source.md"),
      path: as_note_path("docs/source.md"),
      name: "source",
      title: "source",
      mtime_ms: 0,
      size_bytes: 0,
    };

    const source_tab = tab_store.open_tab(source_note.path, source_note.title);
    tab_store.set_cached_note(source_tab.id, {
      meta: source_note,
      markdown: as_markdown_text("See [Old](old.md)"),
      buffer_id: "source-buffer",
      is_dirty: false,
    });

    notes_port.read_note = vi.fn().mockResolvedValue({
      meta: source_note,
      markdown: as_markdown_text("See [Old](old.md)"),
    });

    const search_port = create_mock_search_port({
      get_note_links_snapshot: vi.fn().mockResolvedValue({
        backlinks: [{ path: "docs/source.md" }],
        outlinks: [],
        orphan_links: [],
      }),
      rewrite_note_links: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ markdown: "See [Old](new.md)", changed: true }),
        ),
    });

    const service = new LinkRepairService(
      notes_port,
      search_port,
      index_port,
      editor_store,
      tab_store,
      () => 1,
      close_editor_buffer,
    );

    const path_map = new Map([["docs/old.md", "docs/new.md"]]);
    await service.repair_links(VAULT_ID, path_map);

    expect(tab_store.get_cached_note(source_tab.id)).toBeNull();
    expect(close_editor_buffer).toHaveBeenCalledWith(
      as_note_path("docs/source.md"),
    );
  });

  it("does nothing when path map has no backlinks", async () => {
    const editor_store = new EditorStore();
    const tab_store = new TabStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();

    const rewrite_note_links = vi.fn();
    const search_port = create_mock_search_port({
      get_note_links_snapshot: vi.fn().mockResolvedValue({
        backlinks: [],
        outlinks: [],
        orphan_links: [],
      }),
      rewrite_note_links,
    });

    const service = new LinkRepairService(
      notes_port,
      search_port,
      index_port,
      editor_store,
      tab_store,
      () => 1,
    );

    const path_map = new Map([["docs/old.md", "docs/new.md"]]);
    await service.repair_links(VAULT_ID, path_map);

    expect(notes_port._calls.write_note).toEqual([]);
    expect(rewrite_note_links).toHaveBeenCalled();
  });

  it("skips when path map is empty", async () => {
    const editor_store = new EditorStore();
    const tab_store = new TabStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();

    const get_note_links_snapshot = vi.fn();
    const search_port = create_mock_search_port({ get_note_links_snapshot });

    const service = new LinkRepairService(
      notes_port,
      search_port,
      index_port,
      editor_store,
      tab_store,
      () => 1,
    );

    await service.repair_links(VAULT_ID, new Map());

    expect(get_note_links_snapshot).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { FolderService } from "$lib/services/folder_service";
import { VaultStore } from "$lib/stores/vault_store.svelte";
import { NotesStore } from "$lib/stores/notes_store.svelte";
import { EditorStore } from "$lib/stores/editor_store.svelte";
import { OpStore } from "$lib/stores/op_store.svelte";
import { as_note_path } from "$lib/types/ids";
import { create_test_vault } from "../helpers/test_fixtures";
import {
  create_mock_index_port,
  create_mock_notes_port,
} from "../helpers/mock_ports";

function create_note(index: number) {
  const file = `note-${String(index).padStart(3, "0")}.md`;
  const path = as_note_path(file);
  return {
    id: path,
    path,
    name: file.replace(".md", ""),
    title: file.replace(".md", ""),
    mtime_ms: 0,
    size_bytes: 0,
  };
}

describe("FolderService", () => {
  it("loads first page and reports pagination metadata", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);
    notes_port._mock_notes.set(vault.id, [create_note(1), create_note(2)]);
    notes_port._mock_folders.set(vault.id, ["docs"]);

    const service = new FolderService(
      notes_port,
      index_port,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      () => 1,
    );

    const result = await service.load_folder("", vault_store.generation);

    expect(result).toEqual({
      status: "loaded",
      total_count: 3,
      has_more: false,
    });
    expect(notes_store.notes.map((note) => note.path)).toEqual([
      "note-001.md",
      "note-002.md",
    ]);
    expect(notes_store.folder_paths).toEqual(["docs"]);
  });

  it("loads additional pages additively", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);

    const many_notes = Array.from({ length: 205 }, (_, index) =>
      create_note(index + 1),
    );
    notes_port._mock_notes.set(vault.id, many_notes);

    const service = new FolderService(
      notes_port,
      index_port,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      () => 1,
    );

    const first = await service.load_folder("", vault_store.generation);
    expect(first).toEqual({
      status: "loaded",
      total_count: 205,
      has_more: true,
    });
    expect(notes_store.notes).toHaveLength(200);

    const second = await service.load_folder_page(
      "",
      200,
      vault_store.generation,
    );
    expect(second).toEqual({
      status: "loaded",
      total_count: 205,
      has_more: false,
    });
    expect(notes_store.notes).toHaveLength(205);
  });

  it("returns stale and does not mutate when generation changed", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);
    notes_port._mock_notes.set(vault.id, [create_note(1)]);

    const service = new FolderService(
      notes_port,
      index_port,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      () => 1,
    );

    const generation = vault_store.generation;
    vault_store.bump_generation();

    const result = await service.load_folder_page("", 0, generation);

    expect(result).toEqual({ status: "stale" });
    expect(notes_store.notes).toEqual([]);
  });

  it("removes recent notes by prefix when deleting a folder", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);

    const note_in_folder = {
      ...create_note(1),
      path: as_note_path("docs/note-001.md"),
      id: as_note_path("docs/note-001.md"),
    };
    const note_outside = create_note(2);
    notes_store.set_notes([note_in_folder, note_outside]);
    notes_store.add_recent_note(note_in_folder);
    notes_store.add_recent_note(note_outside);

    notes_port.delete_folder = vi.fn().mockResolvedValue(undefined);

    const service = new FolderService(
      notes_port,
      index_port,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      () => 1,
    );

    await service.delete_folder("docs");

    expect(notes_store.recent_notes).toHaveLength(1);
    expect(notes_store.recent_notes[0]?.path).toBe("note-002.md");
  });

  it("cleans up search index when deleting a folder", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);

    notes_port.delete_folder = vi.fn().mockResolvedValue(undefined);

    const service = new FolderService(
      notes_port,
      index_port,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      () => 1,
    );

    await service.delete_folder("docs");

    expect(index_port._calls.remove_notes_by_prefix).toEqual([
      { vault_id: vault.id, prefix: "docs/" },
    ]);
  });

  it("uses dedicated folder.delete_stats op key for delete preflight failures", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);
    notes_port.get_folder_stats = vi
      .fn()
      .mockRejectedValue(new Error("stats failed"));

    const service = new FolderService(
      notes_port,
      index_port,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      () => 1,
    );

    const result = await service.load_delete_stats("docs");

    expect(result.status).toBe("failed");
    expect(op_store.get("folder.delete_stats").status).toBe("error");
    expect(op_store.get("folder.delete").status).toBe("idle");
  });

  it("rename_folder performs backend FS rename without blocking on index", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);

    const note_meta = {
      ...create_note(1),
      path: as_note_path("docs/note-001.md"),
      id: as_note_path("docs/note-001.md"),
    };
    notes_store.set_notes([note_meta]);
    notes_store.add_recent_note(note_meta);

    const service = new FolderService(
      notes_port,
      index_port,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      () => 1,
    );

    const result = await service.rename_folder("docs", "archive");

    expect(result.status).toBe("success");
    expect(notes_port._calls.rename_folder).toEqual([
      { vault_id: vault.id, from_path: "docs", to_path: "archive" },
    ]);
    expect(index_port._calls.rename_folder_paths).toEqual([]);
    expect(notes_store.recent_notes[0]?.path).toBe("docs/note-001.md");
  });

  it("rename_folder_index delegates to index port", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);

    const service = new FolderService(
      notes_port,
      index_port,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      () => 1,
    );

    await service.rename_folder_index("docs/", "archive/");

    expect(index_port._calls.rename_folder_paths).toEqual([
      { vault_id: vault.id, old_prefix: "docs/", new_prefix: "archive/" },
    ]);
  });

  it("remove_notes_by_prefix delegates to index port", async () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);

    const service = new FolderService(
      notes_port,
      index_port,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      () => 1,
    );

    await service.remove_notes_by_prefix("docs/");

    expect(index_port._calls.remove_notes_by_prefix).toEqual([
      { vault_id: vault.id, prefix: "docs/" },
    ]);
  });

  it("apply_folder_rename updates stores with new paths", () => {
    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const notes_port = create_mock_notes_port();
    const index_port = create_mock_index_port();

    const vault = create_test_vault();
    vault_store.set_vault(vault);

    const note_meta = {
      ...create_note(1),
      path: as_note_path("docs/note-001.md"),
      id: as_note_path("docs/note-001.md"),
    };
    notes_store.set_notes([note_meta]);
    notes_store.add_recent_note(note_meta);

    const service = new FolderService(
      notes_port,
      index_port,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      () => 1,
    );

    service.apply_folder_rename("docs", "archive");

    expect(notes_store.recent_notes[0]?.path).toBe("archive/note-001.md");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { create_workspace_index_tauri_adapter } from "$lib/features/search/adapters/workspace_index_tauri_adapter";
import { as_note_path, as_vault_id } from "$lib/shared/types/ids";

const { tauri_invoke_mock } = vi.hoisted(() => ({
  tauri_invoke_mock: vi.fn().mockResolvedValue(undefined),
}));
const { listen_mock } = vi.hoisted(() => ({
  listen_mock: vi.fn(),
}));

vi.mock("$lib/shared/adapters/tauri_invoke", () => ({
  tauri_invoke: tauri_invoke_mock,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: listen_mock,
}));

describe("workspace_index_tauri_adapter", () => {
  let progress_handler:
    | ((event: { payload: Record<string, unknown> }) => void)
    | null = null;

  beforeEach(() => {
    tauri_invoke_mock.mockClear();
    tauri_invoke_mock.mockResolvedValue(undefined);
    progress_handler = null;
    listen_mock.mockReset();
    listen_mock.mockImplementation(
      (
        _event_name: string,
        handler: (event: { payload: Record<string, unknown> }) => void,
      ) => {
        progress_handler = handler;
        return Promise.resolve(() => undefined);
      },
    );
  });

  it("sync_index enqueues force_scan and emits lifecycle progress", async () => {
    const adapter = create_workspace_index_tauri_adapter();
    const events: string[] = [];
    adapter.subscribe_index_progress((event) => {
      events.push(event.status);
    });

    await adapter.sync_index(as_vault_id("vault-1"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(progress_handler).not.toBeNull();

    progress_handler?.({
      payload: { status: "started", vault_id: "vault-1", total: 0 },
    });
    progress_handler?.({
      payload: {
        status: "completed",
        vault_id: "vault-1",
        indexed: 0,
        elapsed_ms: 1,
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(tauri_invoke_mock).toHaveBeenCalledWith("index_build", {
      vaultId: "vault-1",
    });
    expect(events).toEqual(["started", "progress", "completed"]);
  });

  it("batches remove_paths through index_remove_notes", async () => {
    const adapter = create_workspace_index_tauri_adapter();

    await adapter.remove_notes(as_vault_id("vault-batch"), [
      as_note_path("a.md"),
      as_note_path("b.md"),
    ]);
    await Promise.resolve();
    await Promise.resolve();

    expect(tauri_invoke_mock).toHaveBeenCalledWith("index_remove_notes", {
      vaultId: "vault-batch",
      noteIds: ["a.md", "b.md"],
    });
  });

  it("maps folder rename to rename_prefix touch", async () => {
    const adapter = create_workspace_index_tauri_adapter();

    await adapter.rename_folder_paths(
      as_vault_id("vault-rename"),
      "old/",
      "new/",
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(tauri_invoke_mock).toHaveBeenCalledWith("index_rename_folder", {
      vaultId: "vault-rename",
      oldPrefix: "old/",
      newPrefix: "new/",
    });
  });

  it("maps note rename to rename_path touch", async () => {
    const adapter = create_workspace_index_tauri_adapter();

    await adapter.rename_note_path(
      as_vault_id("vault-rename-note"),
      as_note_path("old.md"),
      as_note_path("new.md"),
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(tauri_invoke_mock).toHaveBeenCalledWith("index_rename_note", {
      vaultId: "vault-rename-note",
      oldPath: "old.md",
      newPath: "new.md",
    });
  });
});

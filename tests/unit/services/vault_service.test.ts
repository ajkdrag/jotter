import { describe, expect, it, vi } from "vitest";
import { VaultService } from "$lib/services/vault_service";
import { VaultStore } from "$lib/stores/vault_store.svelte";
import { NotesStore } from "$lib/stores/notes_store.svelte";
import { EditorStore } from "$lib/stores/editor_store.svelte";
import { OpStore } from "$lib/stores/op_store.svelte";
import { SearchStore } from "$lib/stores/search_store.svelte";
import { as_note_path, as_vault_id, as_vault_path } from "$lib/types/ids";
import type { Vault } from "$lib/types/vault";

function create_deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("VaultService", () => {
  it("ignores stale vault-open completions when newer request wins", async () => {
    const vault_a: Vault = {
      id: as_vault_id("vault-a"),
      name: "Vault A",
      path: as_vault_path("/vault/a"),
      created_at: 1,
    };
    const vault_b: Vault = {
      id: as_vault_id("vault-b"),
      name: "Vault B",
      path: as_vault_path("/vault/b"),
      created_at: 1,
    };

    const open_a = create_deferred<Vault>();
    const open_b = create_deferred<Vault>();

    const vault_port = {
      choose_vault: vi.fn(),
      open_vault: vi.fn((vault_path: string) => {
        if (vault_path === vault_a.path) return open_a.promise;
        return open_b.promise;
      }),
      open_vault_by_id: vi.fn(),
      list_vaults: vi.fn().mockResolvedValue([vault_a, vault_b]),
      remember_last_vault: vi.fn().mockResolvedValue(undefined),
      get_last_vault_id: vi.fn().mockResolvedValue(null),
    };

    const notes_port = {
      list_folder_contents: vi.fn((vault_id: string) =>
        Promise.resolve({
          notes: [
            {
              id: as_note_path(`${vault_id}/alpha.md`),
              path: as_note_path(`${vault_id}/alpha.md`),
              name: "alpha",
              title: "alpha",
              mtime_ms: 0,
              size_bytes: 0,
            },
          ],
          subfolders: [],
          total_count: 1,
          has_more: false,
        }),
      ),
    };

    const index_port = {
      build_index: vi.fn().mockResolvedValue(undefined),
      upsert_note: vi.fn(),
      remove_note: vi.fn(),
      remove_notes: vi.fn(),
      rename_folder_paths: vi.fn(),
      subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
    };

    const settings_port = {
      get_setting: vi.fn().mockResolvedValue(null),
      set_setting: vi.fn(),
    };

    const vault_settings_port = {
      get_vault_setting: vi.fn().mockResolvedValue(null),
      set_vault_setting: vi.fn().mockResolvedValue(undefined),
      delete_vault_setting: vi.fn(),
    };

    const theme_port = {
      get_theme: vi.fn().mockReturnValue("system"),
      set_theme: vi.fn(),
    };

    const vault_store = new VaultStore();
    const notes_store = new NotesStore();
    const editor_store = new EditorStore();
    const op_store = new OpStore();
    const search_store = new SearchStore();

    const service = new VaultService(
      vault_port as never,
      notes_port as never,
      index_port as never,
      settings_port as never,
      vault_settings_port as never,
      theme_port as never,
      vault_store,
      notes_store,
      editor_store,
      op_store,
      search_store,
      () => 1,
    );

    const first = service.change_vault_by_path(vault_a.path);
    const second = service.change_vault_by_path(vault_b.path);

    open_b.resolve(vault_b);
    const second_result = await second;
    expect(second_result.status).toBe("opened");
    expect(vault_store.vault?.id).toBe(vault_b.id);

    open_a.resolve(vault_a);
    const first_result = await first;
    expect(first_result).toEqual({ status: "stale" });
    expect(vault_store.vault?.id).toBe(vault_b.id);
  });
});

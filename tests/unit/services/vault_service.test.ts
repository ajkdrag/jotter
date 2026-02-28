import { describe, expect, it, vi } from "vitest";
import { VaultService } from "$lib/features/vault/application/vault_service";
import { VaultStore } from "$lib/features/vault/state/vault_store.svelte";
import { NotesStore } from "$lib/features/note/state/note_store.svelte";
import { EditorStore } from "$lib/features/editor/state/editor_store.svelte";
import { OpStore } from "$lib/app/orchestration/op_store.svelte";
import { SearchStore } from "$lib/features/search/state/search_store.svelte";
import {
  as_note_path,
  as_vault_id,
  as_vault_path,
} from "$lib/shared/types/ids";
import type { Vault } from "$lib/shared/types/vault";

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
      touch_index: vi.fn().mockResolvedValue(undefined),
      cancel_index: vi.fn().mockResolvedValue(undefined),
      sync_index: vi.fn().mockResolvedValue(undefined),
      rebuild_index: vi.fn().mockResolvedValue(undefined),
      upsert_note: vi.fn(),
      remove_note: vi.fn(),
      remove_notes: vi.fn(),
      remove_notes_by_prefix: vi.fn(),
      rename_folder_paths: vi.fn(),
      subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
    };
    const watcher_port = {
      watch_vault: vi.fn().mockResolvedValue(undefined),
      unwatch_vault: vi.fn().mockResolvedValue(undefined),
      subscribe_fs_events: vi.fn().mockReturnValue(() => {}),
    };

    const settings_port = {
      get_setting: vi.fn().mockResolvedValue(null),
      set_setting: vi.fn(),
    };

    const vault_settings_port = {
      get_vault_setting: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(["vault-b/alpha.md"])
        .mockResolvedValue(null),
      set_vault_setting: vi.fn().mockResolvedValue(undefined),
      delete_vault_setting: vi.fn(),
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
      watcher_port as never,
      settings_port as never,
      vault_settings_port as never,
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
    expect(notes_store.starred_paths).toEqual(["vault-b/alpha.md"]);

    open_a.resolve(vault_a);
    const first_result = await first;
    expect(first_result).toEqual({ status: "stale" });
    expect(vault_store.vault?.id).toBe(vault_b.id);
  });

  it("watches opened vault and forwards fs note changes to touch_index", async () => {
    vi.useFakeTimers();
    try {
      const vault: Vault = {
        id: as_vault_id("vault-a"),
        name: "Vault A",
        path: as_vault_path("/vault/a"),
        created_at: 1,
      };

      const vault_port = {
        choose_vault: vi.fn(),
        open_vault: vi.fn().mockResolvedValue(vault),
        open_vault_by_id: vi.fn(),
        list_vaults: vi.fn().mockResolvedValue([vault]),
        remember_last_vault: vi.fn().mockResolvedValue(undefined),
        get_last_vault_id: vi.fn().mockResolvedValue(null),
      };

      const notes_port = {
        list_folder_contents: vi.fn().mockResolvedValue({
          notes: [],
          subfolders: [],
          total_count: 0,
          has_more: false,
        }),
      };

      const index_port = {
        touch_index: vi.fn().mockResolvedValue(undefined),
        cancel_index: vi.fn().mockResolvedValue(undefined),
        sync_index: vi.fn().mockResolvedValue(undefined),
        rebuild_index: vi.fn().mockResolvedValue(undefined),
        upsert_note: vi.fn(),
        remove_note: vi.fn(),
        remove_notes: vi.fn(),
        remove_notes_by_prefix: vi.fn(),
        rename_folder_paths: vi.fn(),
        subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
      };

      let fs_callback: unknown = null;
      const watcher_unsubscribe = vi.fn();
      const watcher_port = {
        watch_vault: vi.fn().mockResolvedValue(undefined),
        unwatch_vault: vi.fn().mockResolvedValue(undefined),
        subscribe_fs_events: vi.fn().mockImplementation((callback: unknown) => {
          fs_callback = callback;
          return watcher_unsubscribe;
        }),
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
      const service = new VaultService(
        vault_port as never,
        notes_port as never,
        index_port as never,
        watcher_port as never,
        settings_port as never,
        vault_settings_port as never,

        new VaultStore(),
        new NotesStore(),
        new EditorStore(),
        new OpStore(),
        new SearchStore(),
        () => 1,
      );

      const result = await service.change_vault_by_path(vault.path);
      expect(result.status).toBe("opened");
      expect(index_port.sync_index).toHaveBeenCalledTimes(1);
      expect(watcher_port.watch_vault).toHaveBeenCalledWith(vault.id);
      expect(watcher_port.subscribe_fs_events).toHaveBeenCalledTimes(1);

      if (typeof fs_callback === "function") {
        const emit_event = fs_callback as (event: {
          vault_id: string;
          type: string;
          note_path?: string;
        }) => void;
        emit_event({
          vault_id: vault.id,
          type: "note_changed_externally",
          note_path: "notes/a.md",
        });
        emit_event({
          vault_id: vault.id,
          type: "note_removed",
          note_path: "notes/b.md",
        });
      }
      await vi.runAllTimersAsync();

      expect(index_port.touch_index).toHaveBeenCalledTimes(2);
      expect(index_port.touch_index).toHaveBeenCalledWith(vault.id, {
        kind: "upsert_path",
        path: "notes/a.md",
      });
      expect(index_port.touch_index).toHaveBeenCalledWith(vault.id, {
        kind: "remove_path",
        path: "notes/b.md",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns failure when selecting an unavailable vault by id", async () => {
    const unavailable_error = "vault unavailable at path: /vault/missing";
    const vault_a: Vault = {
      id: as_vault_id("vault-a"),
      name: "Vault A",
      path: as_vault_path("/vault/a"),
      created_at: 1,
    };

    const vault_port = {
      choose_vault: vi.fn(),
      open_vault: vi.fn(),
      open_vault_by_id: vi.fn().mockRejectedValue(new Error(unavailable_error)),
      list_vaults: vi.fn().mockResolvedValue([vault_a]),
      remember_last_vault: vi.fn(),
      get_last_vault_id: vi.fn(),
    };

    const service = new VaultService(
      vault_port as never,
      {
        list_folder_contents: vi.fn().mockResolvedValue({
          notes: [],
          subfolders: [],
          total_count: 0,
          has_more: false,
        }),
      } as never,
      {
        touch_index: vi.fn(),
        cancel_index: vi.fn(),
        sync_index: vi.fn(),
        rebuild_index: vi.fn(),
        upsert_note: vi.fn(),
        remove_note: vi.fn(),
        remove_notes: vi.fn(),
        remove_notes_by_prefix: vi.fn(),
        rename_folder_paths: vi.fn(),
        subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
      } as never,
      {
        watch_vault: vi.fn(),
        unwatch_vault: vi.fn(),
        subscribe_fs_events: vi.fn().mockReturnValue(() => {}),
      } as never,
      {
        get_setting: vi.fn().mockResolvedValue(null),
        set_setting: vi.fn(),
      } as never,
      {
        get_vault_setting: vi.fn().mockResolvedValue(null),
        set_vault_setting: vi.fn().mockResolvedValue(undefined),
        delete_vault_setting: vi.fn(),
      } as never,

      new VaultStore(),
      new NotesStore(),
      new EditorStore(),
      new OpStore(),
      new SearchStore(),
      () => 1,
    );

    const result = await service.change_vault_by_id(vault_a.id);
    expect(result).toEqual({ status: "failed", error: unavailable_error });
  });

  it("saves starred paths to vault settings", async () => {
    const vault_id = as_vault_id("vault-a");

    const service = new VaultService(
      {
        choose_vault: vi.fn(),
        open_vault: vi.fn(),
        open_vault_by_id: vi.fn(),
        list_vaults: vi.fn(),
        remember_last_vault: vi.fn(),
        get_last_vault_id: vi.fn(),
      } as never,
      { list_folder_contents: vi.fn() } as never,
      {
        touch_index: vi.fn(),
        cancel_index: vi.fn(),
        sync_index: vi.fn().mockResolvedValue(undefined),
        rebuild_index: vi.fn(),
        upsert_note: vi.fn(),
        remove_note: vi.fn(),
        remove_notes: vi.fn(),
        remove_notes_by_prefix: vi.fn(),
        rename_folder_paths: vi.fn(),
        subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
      } as never,
      {
        watch_vault: vi.fn(),
        unwatch_vault: vi.fn(),
        subscribe_fs_events: vi.fn().mockReturnValue(() => {}),
      } as never,
      { get_setting: vi.fn(), set_setting: vi.fn() } as never,
      {
        get_vault_setting: vi.fn(),
        set_vault_setting: vi.fn().mockResolvedValue(undefined),
        delete_vault_setting: vi.fn(),
      } as never,

      new VaultStore(),
      new NotesStore(),
      new EditorStore(),
      new OpStore(),
      new SearchStore(),
      () => 1,
    );

    await service.save_starred_paths(vault_id, ["docs", "docs/a.md"]);

    const mock_port = (
      service as unknown as {
        vault_settings_port: { set_vault_setting: ReturnType<typeof vi.fn> };
      }
    ).vault_settings_port;
    expect(mock_port.set_vault_setting).toHaveBeenCalledWith(
      vault_id,
      "starred_paths",
      ["docs", "docs/a.md"],
    );
  });

  it("toggles vault pin and persists pinned IDs", async () => {
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

    const settings_port = {
      get_setting: vi.fn().mockResolvedValue([vault_b.id]),
      set_setting: vi.fn().mockResolvedValue(undefined),
    };

    const service = new VaultService(
      {
        choose_vault: vi.fn(),
        open_vault: vi.fn().mockResolvedValue(vault_a),
        open_vault_by_id: vi.fn(),
        list_vaults: vi.fn().mockResolvedValue([vault_a, vault_b]),
        remember_last_vault: vi.fn(),
        get_last_vault_id: vi.fn(),
      } as never,
      {
        list_folder_contents: vi.fn().mockResolvedValue({
          notes: [],
          subfolders: [],
          total_count: 0,
          has_more: false,
        }),
      } as never,
      {
        touch_index: vi.fn(),
        cancel_index: vi.fn(),
        sync_index: vi.fn().mockResolvedValue(undefined),
        rebuild_index: vi.fn(),
        upsert_note: vi.fn(),
        remove_note: vi.fn(),
        remove_notes: vi.fn(),
        remove_notes_by_prefix: vi.fn(),
        rename_folder_paths: vi.fn(),
        subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
      } as never,
      {
        watch_vault: vi.fn(),
        unwatch_vault: vi.fn(),
        subscribe_fs_events: vi.fn().mockReturnValue(() => {}),
      } as never,
      settings_port as never,
      {
        get_vault_setting: vi.fn().mockResolvedValue(null),
        set_vault_setting: vi.fn().mockResolvedValue(undefined),
        delete_vault_setting: vi.fn(),
      } as never,

      new VaultStore(),
      new NotesStore(),
      new EditorStore(),
      new OpStore(),
      new SearchStore(),
      () => 1,
    );

    const open_result = await service.change_vault_by_path(vault_a.path);
    expect(open_result.status).toBe("opened");

    const toggle_result = await service.toggle_vault_pin(vault_a.id);
    expect(toggle_result.status).toBe("success");
    expect(settings_port.set_setting).toHaveBeenLastCalledWith(
      "pinned_vault_ids",
      [vault_b.id, vault_a.id],
    );

    const untoggle_result = await service.toggle_vault_pin(vault_b.id);
    expect(untoggle_result.status).toBe("success");
    expect(settings_port.set_setting).toHaveBeenLastCalledWith(
      "pinned_vault_ids",
      [vault_a.id],
    );
  });

  it("selects pinned vault by slot and skips missing slots", async () => {
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

    const service = new VaultService(
      {
        choose_vault: vi.fn(),
        open_vault: vi.fn().mockResolvedValue(vault_a),
        open_vault_by_id: vi.fn().mockResolvedValue(vault_b),
        list_vaults: vi.fn().mockResolvedValue([vault_a, vault_b]),
        remember_last_vault: vi.fn(),
        get_last_vault_id: vi.fn(),
      } as never,
      {
        list_folder_contents: vi.fn().mockResolvedValue({
          notes: [],
          subfolders: [],
          total_count: 0,
          has_more: false,
        }),
      } as never,
      {
        touch_index: vi.fn(),
        cancel_index: vi.fn(),
        sync_index: vi.fn().mockResolvedValue(undefined),
        rebuild_index: vi.fn(),
        upsert_note: vi.fn(),
        remove_note: vi.fn(),
        remove_notes: vi.fn(),
        remove_notes_by_prefix: vi.fn(),
        rename_folder_paths: vi.fn(),
        subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
      } as never,
      {
        watch_vault: vi.fn(),
        unwatch_vault: vi.fn(),
        subscribe_fs_events: vi.fn().mockReturnValue(() => {}),
      } as never,
      {
        get_setting: vi.fn().mockResolvedValue([vault_b.id]),
        set_setting: vi.fn().mockResolvedValue(undefined),
      } as never,
      {
        get_vault_setting: vi.fn().mockResolvedValue(null),
        set_vault_setting: vi.fn().mockResolvedValue(undefined),
        delete_vault_setting: vi.fn(),
      } as never,

      new VaultStore(),
      new NotesStore(),
      new EditorStore(),
      new OpStore(),
      new SearchStore(),
      () => 1,
    );

    const open_result = await service.change_vault_by_path(vault_a.path);
    expect(open_result.status).toBe("opened");

    const selected = await service.select_pinned_vault_by_slot(0);
    expect(selected.status).toBe("opened");

    const skipped = await service.select_pinned_vault_by_slot(1);
    expect(skipped).toEqual({ status: "skipped" });
  });

  it("unsubscribes previous watcher subscription when vault changes", async () => {
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

    const vault_port = {
      choose_vault: vi.fn(),
      open_vault: vi.fn((vault_path: string) =>
        Promise.resolve(vault_path === vault_a.path ? vault_a : vault_b),
      ),
      open_vault_by_id: vi.fn(),
      list_vaults: vi.fn().mockResolvedValue([vault_a, vault_b]),
      remember_last_vault: vi.fn().mockResolvedValue(undefined),
      get_last_vault_id: vi.fn().mockResolvedValue(null),
    };

    const notes_port = {
      list_folder_contents: vi.fn().mockResolvedValue({
        notes: [],
        subfolders: [],
        total_count: 0,
        has_more: false,
      }),
    };

    const index_port = {
      touch_index: vi.fn().mockResolvedValue(undefined),
      cancel_index: vi.fn().mockResolvedValue(undefined),
      sync_index: vi.fn().mockResolvedValue(undefined),
      rebuild_index: vi.fn().mockResolvedValue(undefined),
      upsert_note: vi.fn(),
      remove_note: vi.fn(),
      remove_notes: vi.fn(),
      remove_notes_by_prefix: vi.fn(),
      rename_folder_paths: vi.fn(),
      subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
    };

    const unwatch_a = vi.fn();
    const unwatch_b = vi.fn();
    const watcher_port = {
      watch_vault: vi.fn().mockResolvedValue(undefined),
      unwatch_vault: vi.fn().mockResolvedValue(undefined),
      subscribe_fs_events: vi
        .fn()
        .mockReturnValueOnce(unwatch_a)
        .mockReturnValueOnce(unwatch_b),
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
    const service = new VaultService(
      vault_port as never,
      notes_port as never,
      index_port as never,
      watcher_port as never,
      settings_port as never,
      vault_settings_port as never,

      new VaultStore(),
      new NotesStore(),
      new EditorStore(),
      new OpStore(),
      new SearchStore(),
      () => 1,
    );

    await service.change_vault_by_path(vault_a.path);
    await service.change_vault_by_path(vault_b.path);

    expect(index_port.cancel_index).toHaveBeenCalledWith(vault_a.id);
    expect(unwatch_a).toHaveBeenCalledTimes(1);
    expect(watcher_port.watch_vault).toHaveBeenNthCalledWith(1, vault_a.id);
    expect(watcher_port.watch_vault).toHaveBeenNthCalledWith(2, vault_b.id);
  });

  it("skips rebuild while indexing is active", async () => {
    const vault: Vault = {
      id: as_vault_id("vault-a"),
      name: "Vault A",
      path: as_vault_path("/vault/a"),
      created_at: 1,
    };

    const vault_store = new VaultStore();
    vault_store.set_vault(vault);

    const search_store = new SearchStore();
    search_store.set_index_progress({
      status: "started",
      vault_id: vault.id,
      total: 100,
    });

    const index_port = {
      touch_index: vi.fn().mockResolvedValue(undefined),
      cancel_index: vi.fn().mockResolvedValue(undefined),
      sync_index: vi.fn().mockResolvedValue(undefined),
      rebuild_index: vi.fn().mockResolvedValue(undefined),
      upsert_note: vi.fn(),
      remove_note: vi.fn(),
      remove_notes: vi.fn(),
      remove_notes_by_prefix: vi.fn(),
      rename_folder_paths: vi.fn(),
      subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
    };

    const service = new VaultService(
      {
        choose_vault: vi.fn(),
        open_vault: vi.fn(),
        open_vault_by_id: vi.fn(),
        list_vaults: vi.fn(),
        remember_last_vault: vi.fn(),
        get_last_vault_id: vi.fn(),
      } as never,
      { list_folder_contents: vi.fn() } as never,
      index_port as never,
      {
        watch_vault: vi.fn(),
        unwatch_vault: vi.fn(),
        subscribe_fs_events: vi.fn().mockReturnValue(() => {}),
      } as never,
      { get_setting: vi.fn(), set_setting: vi.fn() } as never,
      {
        get_vault_setting: vi.fn(),
        set_vault_setting: vi.fn(),
        delete_vault_setting: vi.fn(),
      } as never,

      vault_store,
      new NotesStore(),
      new EditorStore(),
      new OpStore(),
      search_store,
      () => 1,
    );

    const result = await service.rebuild_index();
    expect(result).toEqual({ status: "skipped" });
    expect(index_port.rebuild_index).not.toHaveBeenCalled();
  });

  it("coalesces watcher bursts into a single force_scan touch", async () => {
    vi.useFakeTimers();
    try {
      const vault: Vault = {
        id: as_vault_id("vault-a"),
        name: "Vault A",
        path: as_vault_path("/vault/a"),
        created_at: 1,
      };

      const vault_port = {
        choose_vault: vi.fn(),
        open_vault: vi.fn().mockResolvedValue(vault),
        open_vault_by_id: vi.fn(),
        list_vaults: vi.fn().mockResolvedValue([vault]),
        remember_last_vault: vi.fn().mockResolvedValue(undefined),
        get_last_vault_id: vi.fn().mockResolvedValue(null),
      };

      const notes_port = {
        list_folder_contents: vi.fn().mockResolvedValue({
          notes: [],
          subfolders: [],
          total_count: 0,
          has_more: false,
        }),
      };

      const index_port = {
        touch_index: vi.fn().mockResolvedValue(undefined),
        cancel_index: vi.fn().mockResolvedValue(undefined),
        sync_index: vi.fn().mockResolvedValue(undefined),
        rebuild_index: vi.fn().mockResolvedValue(undefined),
        upsert_note: vi.fn(),
        remove_note: vi.fn(),
        remove_notes: vi.fn(),
        remove_notes_by_prefix: vi.fn(),
        rename_folder_paths: vi.fn(),
        subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
      };

      let fs_callback: unknown = null;
      const watcher_port = {
        watch_vault: vi.fn().mockResolvedValue(undefined),
        unwatch_vault: vi.fn().mockResolvedValue(undefined),
        subscribe_fs_events: vi.fn().mockImplementation((callback: unknown) => {
          fs_callback = callback;
          return () => {};
        }),
      };

      const service = new VaultService(
        vault_port as never,
        notes_port as never,
        index_port as never,
        watcher_port as never,
        {
          get_setting: vi.fn().mockResolvedValue(null),
          set_setting: vi.fn(),
        } as never,
        {
          get_vault_setting: vi.fn().mockResolvedValue(null),
          set_vault_setting: vi.fn().mockResolvedValue(undefined),
          delete_vault_setting: vi.fn(),
        } as never,

        new VaultStore(),
        new NotesStore(),
        new EditorStore(),
        new OpStore(),
        new SearchStore(),
        () => 1,
      );

      const result = await service.change_vault_by_path(vault.path);
      expect(result.status).toBe("opened");

      if (typeof fs_callback === "function") {
        const emit_event = fs_callback as (event: {
          vault_id: string;
          type: string;
          note_path?: string;
        }) => void;
        for (let i = 0; i < 300; i += 1) {
          emit_event({
            vault_id: vault.id,
            type: "note_added",
            note_path: `bulk/${String(i)}.md`,
          });
        }
      }

      await vi.runAllTimersAsync();

      expect(index_port.touch_index).toHaveBeenCalledTimes(1);
      expect(index_port.touch_index).toHaveBeenCalledWith(vault.id, {
        kind: "force_scan",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes non-active vault from registry and prunes pinned state", async () => {
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

    const vault_port = {
      choose_vault: vi.fn(),
      open_vault: vi.fn(),
      open_vault_by_id: vi.fn(),
      list_vaults: vi.fn().mockResolvedValue([vault_a]),
      remove_vault: vi.fn().mockResolvedValue(undefined),
      remember_last_vault: vi.fn(),
      get_last_vault_id: vi.fn(),
    };

    const settings_port = {
      get_setting: vi.fn().mockResolvedValue([vault_b.id]),
      set_setting: vi.fn().mockResolvedValue(undefined),
    };

    const vault_store = new VaultStore();
    vault_store.set_vault(vault_a);
    vault_store.set_recent_vaults([vault_a, vault_b]);
    vault_store.set_pinned_vault_ids([vault_b.id]);

    const service = new VaultService(
      vault_port as never,
      { list_folder_contents: vi.fn() } as never,
      {
        touch_index: vi.fn(),
        cancel_index: vi.fn(),
        sync_index: vi.fn(),
        rebuild_index: vi.fn(),
        upsert_note: vi.fn(),
        remove_note: vi.fn(),
        remove_notes: vi.fn(),
        remove_notes_by_prefix: vi.fn(),
        rename_folder_paths: vi.fn(),
        subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
      } as never,
      {
        watch_vault: vi.fn(),
        unwatch_vault: vi.fn(),
        subscribe_fs_events: vi.fn().mockReturnValue(() => {}),
      } as never,
      settings_port as never,
      {
        get_vault_setting: vi.fn(),
        set_vault_setting: vi.fn(),
        delete_vault_setting: vi.fn(),
      } as never,

      vault_store,
      new NotesStore(),
      new EditorStore(),
      new OpStore(),
      new SearchStore(),
      () => 1,
    );

    const result = await service.remove_vault_from_registry(vault_b.id);

    expect(result).toEqual({ status: "success" });
    expect(vault_port.remove_vault).toHaveBeenCalledWith(vault_b.id);
    expect(vault_store.recent_vaults.map((vault) => vault.id)).toEqual([
      vault_a.id,
    ]);
    expect(vault_store.pinned_vault_ids).toEqual([]);
    expect(settings_port.set_setting).toHaveBeenLastCalledWith(
      "pinned_vault_ids",
      [],
    );
  });

  it("blocks removing the active vault from registry", async () => {
    const vault_a: Vault = {
      id: as_vault_id("vault-a"),
      name: "Vault A",
      path: as_vault_path("/vault/a"),
      created_at: 1,
    };

    const vault_port = {
      choose_vault: vi.fn(),
      open_vault: vi.fn(),
      open_vault_by_id: vi.fn(),
      list_vaults: vi.fn(),
      remove_vault: vi.fn(),
      remember_last_vault: vi.fn(),
      get_last_vault_id: vi.fn(),
    };

    const vault_store = new VaultStore();
    vault_store.set_vault(vault_a);

    const service = new VaultService(
      vault_port as never,
      { list_folder_contents: vi.fn() } as never,
      {
        touch_index: vi.fn(),
        cancel_index: vi.fn(),
        sync_index: vi.fn(),
        rebuild_index: vi.fn(),
        upsert_note: vi.fn(),
        remove_note: vi.fn(),
        remove_notes: vi.fn(),
        remove_notes_by_prefix: vi.fn(),
        rename_folder_paths: vi.fn(),
        subscribe_index_progress: vi.fn().mockReturnValue(() => {}),
      } as never,
      {
        watch_vault: vi.fn(),
        unwatch_vault: vi.fn(),
        subscribe_fs_events: vi.fn().mockReturnValue(() => {}),
      } as never,
      { get_setting: vi.fn(), set_setting: vi.fn() } as never,
      {
        get_vault_setting: vi.fn(),
        set_vault_setting: vi.fn(),
        delete_vault_setting: vi.fn(),
      } as never,

      vault_store,
      new NotesStore(),
      new EditorStore(),
      new OpStore(),
      new SearchStore(),
      () => 1,
    );

    const result = await service.remove_vault_from_registry(vault_a.id);

    expect(result).toEqual({
      status: "failed",
      error: "Cannot remove active vault",
    });
    expect(vault_port.remove_vault).not.toHaveBeenCalled();
  });
});

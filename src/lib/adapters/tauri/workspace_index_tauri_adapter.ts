import {
  create_index_actor,
  type PrefixRename,
} from "$lib/adapters/shared/index_actor";
import { tauri_invoke } from "$lib/adapters/tauri/tauri_invoke";
import type {
  IndexChange,
  WorkspaceIndexPort,
} from "$lib/ports/workspace_index_port";
import type { NoteId, VaultId } from "$lib/types/ids";
import type { IndexProgressEvent } from "$lib/types/search";
import { listen } from "@tauri-apps/api/event";

type RunWaiter = {
  started: boolean;
  resolve: () => void;
  reject: (error: Error) => void;
};

export function create_workspace_index_tauri_adapter(): WorkspaceIndexPort {
  const run_waiters_by_vault = new Map<string, RunWaiter[]>();
  let progress_listener_ready: Promise<void> | null = null;

  function remove_waiter(vault_id: string, waiter: RunWaiter): void {
    const queue = run_waiters_by_vault.get(vault_id);
    if (!queue) {
      return;
    }
    const index = queue.indexOf(waiter);
    if (index >= 0) {
      queue.splice(index, 1);
    }
    if (queue.length === 0) {
      run_waiters_by_vault.delete(vault_id);
    }
  }

  async function ensure_progress_listener(): Promise<void> {
    if (progress_listener_ready) {
      await progress_listener_ready;
      return;
    }

    progress_listener_ready = listen<IndexProgressEvent>(
      "index_progress",
      (event) => {
        const payload = event.payload;
        const queue = run_waiters_by_vault.get(payload.vault_id);
        if (!queue || queue.length === 0) {
          return;
        }

        const waiter = queue[0];
        if (!waiter) {
          return;
        }

        if (!waiter.started) {
          if (payload.status === "started") {
            waiter.started = true;
          }
          return;
        }

        if (payload.status === "completed") {
          queue.shift();
          if (queue.length === 0) {
            run_waiters_by_vault.delete(payload.vault_id);
          }
          waiter.resolve();
          return;
        }

        if (payload.status === "failed") {
          queue.shift();
          if (queue.length === 0) {
            run_waiters_by_vault.delete(payload.vault_id);
          }
          waiter.reject(new Error(payload.error));
        }
      },
    ).then(() => undefined);

    await progress_listener_ready;
  }

  function enqueue_run_wait(vault_id: VaultId): {
    done: Promise<void>;
    cancel: (error: Error) => void;
  } {
    let resolve_done: (() => void) | null = null;
    let reject_done: ((error: Error) => void) | null = null;
    const done = new Promise<void>((resolve, reject) => {
      resolve_done = resolve;
      reject_done = reject;
    });

    const waiter: RunWaiter = {
      started: false,
      resolve: () => {
        const resolve = resolve_done;
        resolve_done = null;
        reject_done = null;
        resolve?.();
      },
      reject: (error: Error) => {
        const reject = reject_done;
        resolve_done = null;
        reject_done = null;
        reject?.(error);
      },
    };

    const key = String(vault_id);
    const queue = run_waiters_by_vault.get(key) ?? [];
    queue.push(waiter);
    run_waiters_by_vault.set(key, queue);

    return {
      done,
      cancel: (error: Error) => {
        remove_waiter(key, waiter);
        waiter.reject(error);
      },
    };
  }

  const actor = create_index_actor({
    async sync_index(vault_id: VaultId): Promise<void> {
      await ensure_progress_listener();
      const wait = enqueue_run_wait(vault_id);
      try {
        await tauri_invoke<undefined>("index_build", { vaultId: vault_id });
      } catch (error) {
        wait.cancel(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
      await wait.done;
    },
    async rebuild_index(vault_id: VaultId): Promise<void> {
      await ensure_progress_listener();
      const wait = enqueue_run_wait(vault_id);
      try {
        await tauri_invoke<undefined>("index_rebuild", { vaultId: vault_id });
      } catch (error) {
        wait.cancel(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
      await wait.done;
    },
    async upsert_paths(vault_id: VaultId, paths: string[]): Promise<void> {
      for (const path of paths) {
        await tauri_invoke<undefined>("index_upsert_note", {
          vaultId: vault_id,
          noteId: path,
        });
      }
    },
    async remove_paths(vault_id: VaultId, paths: string[]): Promise<void> {
      if (paths.length === 1) {
        const first = paths[0];
        if (!first) return;
        await tauri_invoke<undefined>("index_remove_note", {
          vaultId: vault_id,
          noteId: first,
        });
        return;
      }
      await tauri_invoke<undefined>("index_remove_notes", {
        vaultId: vault_id,
        noteIds: paths,
      });
    },
    async remove_prefixes(
      vault_id: VaultId,
      prefixes: string[],
    ): Promise<void> {
      for (const prefix of prefixes) {
        await tauri_invoke<undefined>("index_remove_notes_by_prefix", {
          vaultId: vault_id,
          prefix,
        });
      }
    },
    async rename_prefixes(
      vault_id: VaultId,
      renames: PrefixRename[],
    ): Promise<void> {
      for (const rename of renames) {
        await tauri_invoke<number>("index_rename_folder", {
          vaultId: vault_id,
          oldPrefix: rename.old_prefix,
          newPrefix: rename.new_prefix,
        });
      }
    },
  });

  return {
    async touch_index(vault_id: VaultId, change: IndexChange): Promise<void> {
      await actor.touch_index(vault_id, change);
    },
    async sync_index(vault_id: VaultId): Promise<void> {
      await actor.touch_index(vault_id, { kind: "force_scan" });
    },
    async rebuild_index(vault_id: VaultId): Promise<void> {
      await actor.touch_index(vault_id, { kind: "force_rebuild" });
    },
    async upsert_note(vault_id: VaultId, note_id: NoteId): Promise<void> {
      await actor.touch_index(vault_id, {
        kind: "upsert_path",
        path: note_id,
      });
    },
    async remove_note(vault_id: VaultId, note_id: NoteId): Promise<void> {
      await actor.touch_index(vault_id, {
        kind: "remove_path",
        path: note_id,
      });
    },
    async remove_notes(vault_id: VaultId, note_ids: NoteId[]): Promise<void> {
      for (const note_id of note_ids) {
        void actor.touch_index(vault_id, {
          kind: "remove_path",
          path: note_id,
        });
      }
      await Promise.resolve();
    },
    async remove_notes_by_prefix(
      vault_id: VaultId,
      prefix: string,
    ): Promise<void> {
      await actor.touch_index(vault_id, {
        kind: "remove_prefix",
        prefix,
      });
    },
    async rename_folder_paths(
      vault_id: VaultId,
      old_prefix: string,
      new_prefix: string,
    ): Promise<void> {
      await actor.touch_index(vault_id, {
        kind: "rename_prefix",
        old_prefix,
        new_prefix,
      });
    },
    subscribe_index_progress(callback) {
      return actor.subscribe_index_progress(callback);
    },
  };
}

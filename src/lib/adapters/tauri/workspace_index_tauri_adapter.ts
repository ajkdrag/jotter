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
  on_progress: ((indexed: number, total: number) => void) | null;
  latest_total: number;
  latest_indexed: number;
  resolve: () => void;
  reject: (error: Error) => void;
};

function create_abort_error(): Error {
  const error = new Error("Index run aborted");
  error.name = "AbortError";
  return error;
}

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
            waiter.latest_total = payload.total;
            waiter.latest_indexed = 0;
            waiter.on_progress?.(0, payload.total);
            return;
          }
          if (payload.status === "failed") {
            queue.shift();
            if (queue.length === 0) {
              run_waiters_by_vault.delete(payload.vault_id);
            }
            waiter.reject(new Error(payload.error));
          }
          return;
        }

        if (payload.status === "progress") {
          waiter.latest_total = payload.total;
          waiter.latest_indexed = payload.indexed;
          waiter.on_progress?.(payload.indexed, payload.total);
          return;
        }

        if (payload.status === "completed") {
          const final_total = Math.max(waiter.latest_total, payload.indexed);
          const final_indexed = Math.max(
            waiter.latest_indexed,
            payload.indexed,
          );
          if (
            final_indexed !== waiter.latest_indexed ||
            final_total !== waiter.latest_total
          ) {
            waiter.on_progress?.(final_indexed, final_total);
          }
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
    set_progress: (
      on_progress?: (indexed: number, total: number) => void,
    ) => void;
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
      on_progress: null,
      latest_total: 0,
      latest_indexed: 0,
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
      set_progress: (on_progress) => {
        waiter.on_progress = on_progress ?? null;
      },
      cancel: (error: Error) => {
        remove_waiter(key, waiter);
        waiter.reject(error);
      },
    };
  }

  const actor = create_index_actor({
    async sync_index(
      vault_id: VaultId,
      on_progress?: (indexed: number, total: number) => void,
      signal?: AbortSignal,
    ): Promise<void> {
      await ensure_progress_listener();
      const wait = enqueue_run_wait(vault_id);
      wait.set_progress(on_progress);
      const abort_error = create_abort_error();
      const on_abort = () => {
        void tauri_invoke<undefined>("index_cancel", {
          vaultId: vault_id,
        }).catch(() => undefined);
        wait.cancel(abort_error);
      };
      if (signal?.aborted) {
        on_abort();
        throw abort_error;
      }
      signal?.addEventListener("abort", on_abort, { once: true });
      try {
        await tauri_invoke<undefined>("index_build", { vaultId: vault_id });
        await wait.done;
      } catch (error) {
        wait.cancel(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        signal?.removeEventListener("abort", on_abort);
      }
      if (signal?.aborted) {
        throw abort_error;
      }
    },
    async rebuild_index(
      vault_id: VaultId,
      on_progress?: (indexed: number, total: number) => void,
      signal?: AbortSignal,
    ): Promise<void> {
      await ensure_progress_listener();
      const wait = enqueue_run_wait(vault_id);
      wait.set_progress(on_progress);
      const abort_error = create_abort_error();
      const on_abort = () => {
        void tauri_invoke<undefined>("index_cancel", {
          vaultId: vault_id,
        }).catch(() => undefined);
        wait.cancel(abort_error);
      };
      if (signal?.aborted) {
        on_abort();
        throw abort_error;
      }
      signal?.addEventListener("abort", on_abort, { once: true });
      try {
        await tauri_invoke<undefined>("index_rebuild", { vaultId: vault_id });
        await wait.done;
      } catch (error) {
        wait.cancel(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        signal?.removeEventListener("abort", on_abort);
      }
      if (signal?.aborted) {
        throw abort_error;
      }
    },
    async upsert_paths(vault_id: VaultId, paths: string[]): Promise<void> {
      for (const path of paths) {
        try {
          await tauri_invoke<undefined>("index_upsert_note", {
            vaultId: vault_id,
            noteId: path,
          });
        } catch {
          await tauri_invoke<undefined>("index_remove_note", {
            vaultId: vault_id,
            noteId: path,
          }).catch(() => undefined);
        }
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
    async rename_paths(
      vault_id: VaultId,
      renames: Array<{ old_path: string; new_path: string }>,
    ): Promise<void> {
      for (const rename of renames) {
        await tauri_invoke<undefined>("index_rename_note", {
          vaultId: vault_id,
          oldPath: rename.old_path,
          newPath: rename.new_path,
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
    async cancel_index(vault_id: VaultId): Promise<void> {
      await actor.cancel_index(vault_id);
      await tauri_invoke<undefined>("index_cancel", {
        vaultId: vault_id,
      }).catch(() => undefined);
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
    async rename_note_path(
      vault_id: VaultId,
      old_path: NoteId,
      new_path: NoteId,
    ): Promise<void> {
      await actor.touch_index(vault_id, {
        kind: "rename_path",
        old_path,
        new_path,
      });
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

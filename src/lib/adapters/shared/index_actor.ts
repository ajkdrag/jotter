import {
  count_index_workset_items,
  reduce_index_changes,
  type PrefixRename,
  type ReducedIndexWorkset,
} from "$lib/domain/index_workset";
import type {
  IndexChange,
  IndexProgressEvent,
} from "$lib/ports/workspace_index_port";
import type { VaultId } from "$lib/types/ids";

type IndexActorExecutor = {
  sync_index(vault_id: VaultId): Promise<void>;
  rebuild_index(vault_id: VaultId): Promise<void>;
  upsert_paths(vault_id: VaultId, paths: string[]): Promise<void>;
  remove_paths(vault_id: VaultId, paths: string[]): Promise<void>;
  remove_prefixes(vault_id: VaultId, prefixes: string[]): Promise<void>;
  rename_prefixes(vault_id: VaultId, renames: PrefixRename[]): Promise<void>;
};

type VaultActorState = {
  running: boolean;
  start_scheduled: boolean;
  run_id: number;
  pending_changes: IndexChange[];
};

const PATH_BATCH_SIZE = 200;

export type { PrefixRename };

function chunked<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const chunks: T[][] = [];
  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size));
  }
  return chunks;
}

export function create_index_actor(executor: IndexActorExecutor): {
  touch_index(vault_id: VaultId, change: IndexChange): Promise<void>;
  subscribe_index_progress(
    callback: (event: IndexProgressEvent) => void,
  ): () => void;
} {
  const listeners = new Set<(event: IndexProgressEvent) => void>();
  const vault_states = new Map<string, VaultActorState>();

  function emit(event: IndexProgressEvent): void {
    for (const listener of listeners) {
      listener(event);
    }
  }

  function get_state(vault_id: VaultId): VaultActorState {
    const key = String(vault_id);
    const existing = vault_states.get(key);
    if (existing) {
      return existing;
    }
    const initial: VaultActorState = {
      running: false,
      start_scheduled: false,
      run_id: 0,
      pending_changes: [],
    };
    vault_states.set(key, initial);
    return initial;
  }

  async function apply_workset(
    vault_id: VaultId,
    workset: ReducedIndexWorkset,
    run_id: number,
    queued_work_items: number,
  ): Promise<void> {
    const total = count_index_workset_items(workset);
    emit({
      status: "started",
      vault_id: String(vault_id),
      total,
      mode: "dumb",
      run_id,
      queued_work_items,
    });

    if (total === 0) {
      emit({
        status: "completed",
        vault_id: String(vault_id),
        indexed: 0,
        elapsed_ms: 0,
        mode: "smart",
        run_id,
        queued_work_items,
      });
      return;
    }

    const started_at = Date.now();
    let indexed = 0;

    const emit_progress = () => {
      emit({
        status: "progress",
        vault_id: String(vault_id),
        indexed,
        total,
        mode: "dumb",
        run_id,
        queued_work_items,
      });
    };

    if (workset.force_rebuild) {
      await executor.rebuild_index(vault_id);
      indexed = 1;
      emit_progress();
      emit({
        status: "completed",
        vault_id: String(vault_id),
        indexed,
        elapsed_ms: Date.now() - started_at,
        mode: "smart",
        run_id,
        queued_work_items,
      });
      return;
    }

    if (workset.rename_prefixes.length > 0) {
      await executor.rename_prefixes(vault_id, workset.rename_prefixes);
      indexed += workset.rename_prefixes.length;
      emit_progress();
    }

    if (workset.remove_prefixes.size > 0) {
      const prefixes = [...workset.remove_prefixes.values()];
      await executor.remove_prefixes(vault_id, prefixes);
      indexed += prefixes.length;
      emit_progress();
    }

    if (workset.remove_paths.size > 0) {
      const paths = [...workset.remove_paths.values()];
      for (const batch of chunked(paths, PATH_BATCH_SIZE)) {
        await executor.remove_paths(vault_id, batch);
        indexed += batch.length;
        emit_progress();
      }
    }

    if (workset.upsert_paths.size > 0) {
      const paths = [...workset.upsert_paths.values()];
      for (const batch of chunked(paths, PATH_BATCH_SIZE)) {
        await executor.upsert_paths(vault_id, batch);
        indexed += batch.length;
        emit_progress();
      }
    }

    if (workset.force_scan) {
      await executor.sync_index(vault_id);
      indexed += 1;
      emit_progress();
    }

    emit({
      status: "completed",
      vault_id: String(vault_id),
      indexed,
      elapsed_ms: Date.now() - started_at,
      mode: "smart",
      run_id,
      queued_work_items,
    });
  }

  async function drain(vault_id: VaultId): Promise<void> {
    const state = get_state(vault_id);
    if (state.running) {
      return;
    }
    state.running = true;
    try {
      while (state.pending_changes.length > 0) {
        const snapshot = state.pending_changes.splice(0);
        const workset = reduce_index_changes(snapshot);
        state.run_id += 1;
        const run_id = state.run_id;
        const queued_work_items = state.pending_changes.length;
        try {
          await apply_workset(vault_id, workset, run_id, queued_work_items);
        } catch (error) {
          emit({
            status: "failed",
            vault_id: String(vault_id),
            error: error instanceof Error ? error.message : String(error),
            mode: "dumb",
            run_id,
            queued_work_items,
          });
        }
      }
    } finally {
      state.running = false;
      state.start_scheduled = false;
    }
  }

  return {
    touch_index(vault_id: VaultId, change: IndexChange): Promise<void> {
      const state = get_state(vault_id);
      state.pending_changes.push(change);
      if (!state.running && !state.start_scheduled) {
        state.start_scheduled = true;
        queueMicrotask(() => {
          const current = get_state(vault_id);
          current.start_scheduled = false;
          void drain(vault_id);
        });
      }
      return Promise.resolve();
    },
    subscribe_index_progress(callback: (event: IndexProgressEvent) => void) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
  };
}

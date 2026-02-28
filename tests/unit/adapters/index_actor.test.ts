import { describe, expect, it, vi } from "vitest";
import { create_index_actor } from "$lib/features/search/adapters/index_actor";
import { as_note_path, as_vault_id } from "$lib/shared/types/ids";

function create_deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush_ticks(times = 8): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

describe("index_actor", () => {
  it("emits smart mode for reduced dirty-path runs", async () => {
    const executor = {
      sync_index: vi.fn().mockResolvedValue(undefined),
      rebuild_index: vi.fn().mockResolvedValue(undefined),
      upsert_paths: vi.fn().mockResolvedValue(undefined),
      remove_paths: vi.fn().mockResolvedValue(undefined),
      remove_prefixes: vi.fn().mockResolvedValue(undefined),
      rename_paths: vi.fn().mockResolvedValue(undefined),
      rename_prefixes: vi.fn().mockResolvedValue(undefined),
    };

    const actor = create_index_actor(executor);
    const vault_id = as_vault_id("vault-smart-mode");
    const events: Array<{ status: string; mode: string | undefined }> = [];
    actor.subscribe_index_progress((event) => {
      events.push({ status: event.status, mode: event.mode });
    });

    await actor.touch_index(vault_id, {
      kind: "upsert_path",
      path: as_note_path("notes/smart.md"),
    });
    await flush_ticks(16);

    expect(events[0]).toEqual({ status: "started", mode: "smart" });
    expect(events.some((entry) => entry.status === "progress")).toBe(true);
    expect(events.at(-1)).toEqual({ status: "completed", mode: "smart" });
  });

  it("reports queued work size from current snapshot", async () => {
    const sync_gate = create_deferred<void>();
    const executor = {
      sync_index: vi.fn(() => sync_gate.promise),
      rebuild_index: vi.fn().mockResolvedValue(undefined),
      upsert_paths: vi.fn().mockResolvedValue(undefined),
      remove_paths: vi.fn().mockResolvedValue(undefined),
      remove_prefixes: vi.fn().mockResolvedValue(undefined),
      rename_paths: vi.fn().mockResolvedValue(undefined),
      rename_prefixes: vi.fn().mockResolvedValue(undefined),
    };

    const actor = create_index_actor(executor);
    const vault_id = as_vault_id("vault-queue-count");
    const started_events: Array<{
      run_id: number;
      queued_work_items: number | undefined;
    }> = [];
    actor.subscribe_index_progress((event) => {
      if (event.status === "started") {
        started_events.push({
          run_id: event.run_id ?? -1,
          queued_work_items: event.queued_work_items,
        });
      }
    });

    await actor.touch_index(vault_id, { kind: "force_scan" });
    await actor.touch_index(vault_id, {
      kind: "upsert_path",
      path: as_note_path("notes/queued.md"),
    });

    sync_gate.resolve();
    await flush_ticks(16);

    expect(started_events).toEqual([
      { run_id: 1, queued_work_items: 1 },
      { run_id: 2, queued_work_items: 1 },
    ]);
  });

  it("runs follow-up dirty work after current run completes", async () => {
    const sync_gate = create_deferred<void>();
    const executor = {
      sync_index: vi.fn(() => sync_gate.promise),
      rebuild_index: vi.fn().mockResolvedValue(undefined),
      upsert_paths: vi.fn().mockResolvedValue(undefined),
      remove_paths: vi.fn().mockResolvedValue(undefined),
      remove_prefixes: vi.fn().mockResolvedValue(undefined),
      rename_paths: vi.fn().mockResolvedValue(undefined),
      rename_prefixes: vi.fn().mockResolvedValue(undefined),
    };

    const actor = create_index_actor(executor);
    const vault_id = as_vault_id("vault-followup");

    await actor.touch_index(vault_id, { kind: "force_scan" });
    await actor.touch_index(vault_id, {
      kind: "upsert_path",
      path: as_note_path("notes/a.md"),
    });

    sync_gate.resolve();
    await flush_ticks(16);

    expect(executor.sync_index).toHaveBeenCalledTimes(1);
    expect(executor.upsert_paths).toHaveBeenCalledWith(vault_id, [
      "notes/a.md",
    ]);
  });

  it("reduces conflicting path changes so remove dominates upsert", async () => {
    const executor = {
      sync_index: vi.fn().mockResolvedValue(undefined),
      rebuild_index: vi.fn().mockResolvedValue(undefined),
      upsert_paths: vi.fn().mockResolvedValue(undefined),
      remove_paths: vi.fn().mockResolvedValue(undefined),
      remove_prefixes: vi.fn().mockResolvedValue(undefined),
      rename_paths: vi.fn().mockResolvedValue(undefined),
      rename_prefixes: vi.fn().mockResolvedValue(undefined),
    };

    const actor = create_index_actor(executor);
    const vault_id = as_vault_id("vault-reduce");

    const first = actor.touch_index(vault_id, {
      kind: "upsert_path",
      path: as_note_path("notes/a.md"),
    });
    const second = actor.touch_index(vault_id, {
      kind: "remove_path",
      path: as_note_path("notes/a.md"),
    });
    await first;
    await second;
    await flush_ticks();

    expect(executor.upsert_paths).not.toHaveBeenCalled();
    expect(executor.remove_paths).toHaveBeenCalledWith(vault_id, [
      "notes/a.md",
    ]);
  });

  it("drops force_rebuild requests while a run is already active", async () => {
    const rebuild_gate = create_deferred<void>();
    const executor = {
      sync_index: vi.fn().mockResolvedValue(undefined),
      rebuild_index: vi.fn(() => rebuild_gate.promise),
      upsert_paths: vi.fn().mockResolvedValue(undefined),
      remove_paths: vi.fn().mockResolvedValue(undefined),
      remove_prefixes: vi.fn().mockResolvedValue(undefined),
      rename_paths: vi.fn().mockResolvedValue(undefined),
      rename_prefixes: vi.fn().mockResolvedValue(undefined),
    };

    const actor = create_index_actor(executor);
    const vault_id = as_vault_id("vault-rebuild-dedupe");

    await actor.touch_index(vault_id, { kind: "force_rebuild" });
    await actor.touch_index(vault_id, { kind: "force_rebuild" });

    rebuild_gate.resolve();
    await flush_ticks(16);

    expect(executor.rebuild_index).toHaveBeenCalledTimes(1);
  });
});

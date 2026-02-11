import { describe, expect, it, vi } from "vitest";
import { create_index_actor } from "$lib/adapters/shared/index_actor";
import { as_note_path, as_vault_id } from "$lib/types/ids";

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
  it("runs follow-up dirty work after current run completes", async () => {
    const sync_gate = create_deferred<void>();
    const executor = {
      sync_index: vi.fn(() => sync_gate.promise),
      rebuild_index: vi.fn().mockResolvedValue(undefined),
      upsert_paths: vi.fn().mockResolvedValue(undefined),
      remove_paths: vi.fn().mockResolvedValue(undefined),
      remove_prefixes: vi.fn().mockResolvedValue(undefined),
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

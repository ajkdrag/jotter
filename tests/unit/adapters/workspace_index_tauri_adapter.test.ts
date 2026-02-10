import { describe, expect, it, vi } from "vitest";
import { create_workspace_index_tauri_adapter } from "$lib/adapters/tauri/workspace_index_tauri_adapter";
import type { IndexProgressEvent } from "$lib/types/search";

const { listen_mock } = vi.hoisted(() => ({
  listen_mock: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listen_mock,
}));

function create_deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("workspace_index_tauri_adapter", () => {
  it("tears down listeners that resolve after early unsubscribe", async () => {
    let event_handler:
      | ((event: { payload: IndexProgressEvent }) => void)
      | undefined;
    const registration = create_deferred<() => void>();

    listen_mock.mockImplementation(
      (
        _event_name: string,
        handler: (event: { payload: IndexProgressEvent }) => void,
      ) => {
        event_handler = handler;
        return registration.promise;
      },
    );

    const adapter = create_workspace_index_tauri_adapter();
    const callback = vi.fn();

    const unsubscribe = adapter.subscribe_index_progress(callback);
    unsubscribe();

    const unlisten = vi.fn();
    registration.resolve(unlisten);
    await Promise.resolve();
    await Promise.resolve();

    expect(unlisten).toHaveBeenCalledTimes(1);

    event_handler?.({
      payload: { status: "started", vault_id: "vault-1", total: 1 },
    });
    expect(callback).not.toHaveBeenCalled();
  });
});

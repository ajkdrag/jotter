import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchDbWeb } from "$lib/adapters/web/search_db_web";
import { as_note_path, as_vault_id } from "$lib/types/ids";
import type {
  SearchWorkerMessage,
  SearchWorkerRequest,
} from "$lib/adapters/web/search_worker_protocol";

class MockWorker {
  static instances: MockWorker[] = [];

  onmessage: ((event: MessageEvent<SearchWorkerMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly posted: SearchWorkerRequest[] = [];
  readonly terminate = vi.fn();

  constructor(..._args: unknown[]) {
    MockWorker.instances.push(this);
  }

  postMessage(message: SearchWorkerRequest): void {
    this.posted.push(message);
  }

  emit(message: SearchWorkerMessage): void {
    this.onmessage?.({ data: message } as MessageEvent<SearchWorkerMessage>);
  }

  emit_error(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

describe("search_db_web", () => {
  const original_worker = globalThis.Worker;

  beforeEach(() => {
    MockWorker.instances = [];
    Object.defineProperty(globalThis, "Worker", {
      value: MockWorker,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(globalThis, "Worker", {
      value: original_worker,
      writable: true,
      configurable: true,
    });
  });

  it("creates worker lazily on first request", async () => {
    const db = new SearchDbWeb();
    expect(MockWorker.instances).toHaveLength(0);

    const vault_id = as_vault_id("vault-lazy");
    const init_promise = db.init(vault_id);
    const worker = MockWorker.instances[0];
    if (!worker) throw new Error("expected worker instance");

    const init_request = worker.posted[0];
    if (!init_request || init_request.type !== "init") {
      throw new Error("expected init request");
    }
    worker.emit({
      type: "ready",
      id: init_request.id,
      vault_id: String(vault_id),
      storage: "memory",
    });
    worker.emit({ type: "result", id: init_request.id, data: null });
    await init_promise;
  });

  it("initializes vault once and maps search results", async () => {
    const db = new SearchDbWeb();
    const worker = MockWorker.instances[0];
    const vault_id = as_vault_id("vault-1");

    const init_promise = db.init(vault_id);
    const created_worker = worker ?? MockWorker.instances[0];
    if (!created_worker) throw new Error("expected worker instance");
    const init_request = created_worker.posted[0];
    if (!init_request || init_request.type !== "init") {
      throw new Error("expected init request");
    }
    created_worker.emit({
      type: "ready",
      id: init_request.id,
      vault_id: String(vault_id),
      storage: "memory",
    });
    created_worker.emit({
      type: "result",
      id: init_request.id,
      data: null,
    });
    await init_promise;

    await db.init(vault_id);
    expect(
      created_worker.posted.filter((request) => request.type === "init"),
    ).toHaveLength(1);

    const search_promise = db.search(
      vault_id,
      { raw: "alpha", text: "alpha", scope: "all", domain: "notes" },
      10,
    );
    await Promise.resolve();

    const search_request = created_worker.posted[1];
    if (!search_request || search_request.type !== "search") {
      throw new Error("expected search request");
    }
    created_worker.emit({
      type: "result",
      id: search_request.id,
      data: [
        {
          note: {
            id: "docs/alpha.md",
            path: "docs/alpha.md",
            title: "Alpha",
            mtime_ms: 10,
            size_bytes: 20,
          },
          score: 1.5,
          snippet: "<b>alpha</b>",
        },
      ],
    });

    const hits = await search_promise;
    expect(hits[0]?.note.path).toBe(as_note_path("docs/alpha.md"));
    expect(hits[0]?.snippet).toBe("<b>alpha</b>");
  });

  it("times out pending worker requests", async () => {
    vi.useFakeTimers();
    const db = new SearchDbWeb({ request_timeout_ms: 50 });
    const vault_id = as_vault_id("vault-timeout");

    const init_promise = db.init(vault_id);
    const captured_error = init_promise.catch((error: unknown) => error);
    const worker = MockWorker.instances[0];
    if (!worker) throw new Error("expected worker instance");

    await vi.advanceTimersByTimeAsync(60);
    const error = await captured_error;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("timed out");
  });

  it("fails pending and future calls after worker fatal error", async () => {
    const db = new SearchDbWeb();
    const vault_id = as_vault_id("vault-fatal");

    const init_promise = db.init(vault_id);
    const worker = MockWorker.instances[0];
    if (!worker) throw new Error("expected worker instance");

    worker.emit_error("fatal worker crash");
    await expect(init_promise).rejects.toThrow("fatal worker crash");
    await expect(
      db.search(vault_id, {
        raw: "q",
        text: "q",
        scope: "all",
        domain: "notes",
      }),
    ).rejects.toThrow("fatal worker crash");
  });

  it("emits progress events to subscribers", async () => {
    const db = new SearchDbWeb();
    const vault_id = as_vault_id("vault-progress");
    const callback = vi.fn();

    const unsubscribe = db.subscribe_progress(callback);
    const init_promise = db.init(vault_id);
    const worker = MockWorker.instances[0];
    if (!worker) throw new Error("expected worker instance");

    const init_request = worker.posted[0];
    if (!init_request || init_request.type !== "init") {
      throw new Error("expected init request");
    }
    worker.emit({
      type: "ready",
      id: init_request.id,
      vault_id: String(vault_id),
      storage: "memory",
    });
    worker.emit({ type: "result", id: init_request.id, data: null });
    await init_promise;

    worker.emit({
      type: "progress",
      vault_id: String(vault_id),
      indexed: 2,
      total: 5,
    });

    expect(callback).toHaveBeenCalledWith({
      status: "progress",
      vault_id: String(vault_id),
      indexed: 2,
      total: 5,
    });

    unsubscribe();
    worker.emit({
      type: "progress",
      vault_id: String(vault_id),
      indexed: 3,
      total: 5,
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

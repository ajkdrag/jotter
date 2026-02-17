import type { NoteDoc, NoteMeta } from "$lib/types/note";
import { as_note_path, type NoteId, type VaultId } from "$lib/types/ids";
import type {
  IndexProgressEvent,
  NoteSearchHit,
  PlannedLinkSuggestion,
  SearchQuery,
  WikiSuggestion,
} from "$lib/types/search";
import type {
  SearchWorkerMessage,
  SearchWorkerRequest,
  WorkerNoteMeta,
  WorkerPlannedSuggestion,
  WorkerSearchHit,
  WorkerSuggestion,
} from "$lib/adapters/web/search_worker_protocol";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type SearchWorkerRequestWithoutId = SearchWorkerRequest extends infer Request
  ? Request extends { id: number }
    ? Omit<Request, "id">
    : never
  : never;

type ProgressListener = (event: IndexProgressEvent) => void;

type SearchDbWebOptions = {
  request_timeout_ms?: number;
};

export class SearchDbWeb {
  private worker: Worker | null = null;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly init_inflight = new Map<string, Promise<void>>();
  private readonly initialized_vaults = new Set<string>();
  private readonly progress_listeners = new Set<ProgressListener>();
  private readonly request_timeout_ms: number;
  private worker_fatal_error: string | null = null;
  private next_request_id = 1;
  private closed = false;

  constructor(options: SearchDbWebOptions = {}) {
    this.request_timeout_ms = options.request_timeout_ms ?? 60000;
  }

  subscribe_progress(listener: ProgressListener): () => void {
    this.progress_listeners.add(listener);
    return () => {
      this.progress_listeners.delete(listener);
    };
  }

  async init(vault_id: VaultId): Promise<void> {
    this.assert_open();
    const key = String(vault_id);
    if (this.initialized_vaults.has(key)) return;

    const inflight = this.init_inflight.get(key);
    if (inflight) {
      await inflight;
      return;
    }

    const promise = this.request<null>({
      type: "init",
      vault_id: key,
    }).then(() => {
      this.initialized_vaults.add(key);
    });

    this.init_inflight.set(key, promise);
    try {
      await promise;
    } finally {
      this.init_inflight.delete(key);
    }
  }

  async exec(
    vault_id: VaultId,
    sql: string,
    params: unknown[] = [],
  ): Promise<unknown[][]> {
    await this.init(vault_id);
    return this.request<unknown[][]>({
      type: "exec",
      vault_id: String(vault_id),
      sql,
      params,
    });
  }

  async search(
    vault_id: VaultId,
    query: SearchQuery,
    limit = 50,
  ): Promise<NoteSearchHit[]> {
    await this.init(vault_id);
    const hits = await this.request<WorkerSearchHit[]>({
      type: "search",
      vault_id: String(vault_id),
      query,
      limit,
    });
    return hits.map((hit) => ({
      note: this.to_note_meta(hit.note),
      score: hit.score,
      snippet: hit.snippet,
    }));
  }

  async suggest(
    vault_id: VaultId,
    query: string,
    limit = 15,
  ): Promise<WikiSuggestion[]> {
    await this.init(vault_id);
    const hits = await this.request<WorkerSuggestion[]>({
      type: "suggest",
      vault_id: String(vault_id),
      query,
      limit,
    });
    return hits.map((hit) => ({
      kind: "existing" as const,
      note: this.to_note_meta(hit.note),
      score: hit.score,
    }));
  }

  async suggest_planned(
    vault_id: VaultId,
    query: string,
    limit = 15,
  ): Promise<PlannedLinkSuggestion[]> {
    await this.init(vault_id);
    const hits = await this.request<WorkerPlannedSuggestion[]>({
      type: "suggest_planned",
      vault_id: String(vault_id),
      query,
      limit,
    });
    return hits.map((hit) => ({
      target_path: hit.target_path,
      ref_count: hit.ref_count,
    }));
  }

  async upsert_note(vault_id: VaultId, doc: NoteDoc): Promise<void> {
    await this.init(vault_id);
    await this.request<null>({
      type: "upsert_note",
      vault_id: String(vault_id),
      doc,
    });
  }

  async remove_note(vault_id: VaultId, note_id: NoteId): Promise<void> {
    await this.init(vault_id);
    await this.request<null>({
      type: "remove_note",
      vault_id: String(vault_id),
      note_id: String(note_id),
    });
  }

  async rebuild_index(vault_id: VaultId, docs: NoteDoc[]): Promise<void> {
    await this.init(vault_id);
    const notes = docs.map((doc) => this.to_worker_note_meta(doc.meta));
    await this.request<null>({
      type: "rebuild_begin",
      vault_id: String(vault_id),
      notes,
      total: docs.length,
    });
    await this.request<null>({
      type: "rebuild_batch",
      vault_id: String(vault_id),
      docs,
    });
    await this.request<null>({
      type: "rebuild_finish",
      vault_id: String(vault_id),
    });
  }

  async rebuild_begin(vault_id: VaultId, notes: NoteMeta[]): Promise<void> {
    await this.init(vault_id);
    await this.request<null>({
      type: "rebuild_begin",
      vault_id: String(vault_id),
      notes: notes.map((note) => this.to_worker_note_meta(note)),
      total: notes.length,
    });
  }

  async rebuild_batch(vault_id: VaultId, docs: NoteDoc[]): Promise<void> {
    await this.init(vault_id);
    await this.request<null>({
      type: "rebuild_batch",
      vault_id: String(vault_id),
      docs,
    });
  }

  async rebuild_finish(vault_id: VaultId): Promise<void> {
    await this.init(vault_id);
    await this.request<null>({
      type: "rebuild_finish",
      vault_id: String(vault_id),
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;

    if (this.worker) {
      await this.request<null>({
        type: "close",
      }).catch(() => null);
    }

    this.closed = true;
    this.worker?.terminate();
    this.worker = null;
    this.reject_all("Search worker closed");
  }

  private assert_open(): void {
    if (this.closed) {
      throw new Error("Search worker is closed");
    }
    if (this.worker_fatal_error) {
      throw new Error(this.worker_fatal_error);
    }
  }

  private ensure_worker(): Worker {
    if (this.worker) return this.worker;

    try {
      const worker = new Worker(
        new URL("./search_worker.ts", import.meta.url),
        {
          type: "module",
        },
      );

      worker.onmessage = (event: MessageEvent<SearchWorkerMessage>) => {
        this.handle_message(event.data);
      };

      worker.onerror = (event: ErrorEvent) => {
        const message = event.message || "Search worker error";
        this.fail_worker(message);
      };

      worker.onmessageerror = () => {
        this.fail_worker("Search worker message error");
      };

      this.worker = worker;
      return worker;
    } catch (error) {
      const message =
        error instanceof Error
          ? `Search worker initialization failed: ${error.message}`
          : `Search worker initialization failed: ${String(error)}`;
      this.worker_fatal_error = message;
      throw new Error(message);
    }
  }

  private fail_worker(message: string): void {
    if (this.closed) return;
    this.worker_fatal_error = message;
    this.initialized_vaults.clear();
    this.worker?.terminate();
    this.worker = null;
    this.reject_all(message);
  }

  private to_note_meta(note: WorkerNoteMeta): NoteMeta {
    const path = as_note_path(note.path);
    return {
      id: path,
      path,
      name: note.name,
      title: note.title,
      mtime_ms: note.mtime_ms,
      size_bytes: note.size_bytes,
    };
  }

  private to_worker_note_meta(note: NoteMeta): WorkerNoteMeta {
    return {
      id: String(note.id),
      path: String(note.path),
      name: note.name,
      title: note.title,
      mtime_ms: note.mtime_ms,
      size_bytes: note.size_bytes,
    };
  }

  private handle_message(message: SearchWorkerMessage): void {
    if (message.type === "progress") {
      const event: IndexProgressEvent = {
        status: "progress",
        vault_id: message.vault_id,
        indexed: message.indexed,
        total: message.total,
      };
      for (const listener of this.progress_listeners) {
        listener(event);
      }
      return;
    }

    if (message.type === "ready") {
      this.initialized_vaults.add(message.vault_id);
      return;
    }

    if (message.type === "result") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      pending.resolve(message.data);
      return;
    }

    if (message.id === undefined) {
      this.fail_worker(message.message);
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    pending.reject(new Error(message.message));
  }

  private reject_all(message: string): void {
    for (const entry of this.pending.values()) {
      entry.reject(new Error(message));
    }
    this.pending.clear();
  }

  private request<T>(payload: SearchWorkerRequestWithoutId): Promise<T> {
    this.assert_open();
    const worker = this.ensure_worker();
    const id = this.next_request_id++;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        pending.reject(
          new Error(
            `Search worker request timed out after ${String(this.request_timeout_ms)}ms`,
          ),
        );
      }, this.request_timeout_ms);

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      const request = { ...payload, id } as SearchWorkerRequest;
      try {
        worker.postMessage(request);
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(
          error instanceof Error
            ? error
            : new Error(`Search worker postMessage failed: ${String(error)}`),
        );
      }
    });
  }
}

export function create_search_db_web(): SearchDbWeb {
  return new SearchDbWeb();
}

import type { NoteDoc, NoteMeta } from "$lib/types/note";
import { as_note_path, type NoteId, type VaultId } from "$lib/types/ids";
import type {
  IndexProgressEvent,
  NoteSearchHit,
  SearchQuery,
  WikiSuggestion,
} from "$lib/types/search";
import type {
  SearchWorkerMessage,
  SearchWorkerRequest,
  WorkerNoteMeta,
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

export class SearchDbWeb {
  private readonly worker: Worker;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly init_inflight = new Map<string, Promise<void>>();
  private readonly initialized_vaults = new Set<string>();
  private readonly progress_listeners = new Set<ProgressListener>();
  private next_request_id = 1;
  private closed = false;

  constructor() {
    this.worker = new Worker(new URL("./search_worker.ts", import.meta.url), {
      type: "module",
    });

    this.worker.onmessage = (event: MessageEvent<SearchWorkerMessage>) => {
      this.handle_message(event.data);
    };

    this.worker.onerror = (event: ErrorEvent) => {
      this.reject_all(event.message || "Search worker error");
    };

    this.worker.onmessageerror = () => {
      this.reject_all("Search worker message error");
    };
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
      note: this.to_note_meta(hit.note),
      score: hit.score,
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
    await this.request<null>({
      type: "rebuild_index",
      vault_id: String(vault_id),
      docs,
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;

    await this.request<null>({
      type: "close",
    }).catch(() => null);

    this.closed = true;
    this.worker.terminate();
    this.reject_all("Search worker closed");
  }

  private assert_open(): void {
    if (this.closed) {
      throw new Error("Search worker is closed");
    }
  }

  private to_note_meta(note: WorkerNoteMeta): NoteMeta {
    const path = as_note_path(note.path);
    return {
      id: path,
      path,
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
      this.reject_all(message.message);
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
    const id = this.next_request_id++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => {
          resolve(value as T);
        },
        reject,
      });
      const request = { ...payload, id } as SearchWorkerRequest;
      this.worker.postMessage(request);
    });
  }
}

export function create_search_db_web(): SearchDbWeb {
  return new SearchDbWeb();
}

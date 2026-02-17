import type { NoteDoc } from "$lib/types/note";
import type { SearchQuery } from "$lib/types/search";

export type WorkerStorageMode = "opfs" | "idb" | "memory";

export type SearchWorkerRequest =
  | {
      type: "init";
      id: number;
      vault_id: string;
    }
  | {
      type: "exec";
      id: number;
      vault_id: string;
      sql: string;
      params?: unknown[];
    }
  | {
      type: "rebuild_begin";
      id: number;
      vault_id: string;
      notes: WorkerNoteMeta[];
      total: number;
    }
  | {
      type: "rebuild_batch";
      id: number;
      vault_id: string;
      docs: NoteDoc[];
    }
  | {
      type: "rebuild_finish";
      id: number;
      vault_id: string;
    }
  | {
      type: "rebuild_index";
      id: number;
      vault_id: string;
      docs: NoteDoc[];
    }
  | {
      type: "upsert_note";
      id: number;
      vault_id: string;
      doc: NoteDoc;
    }
  | {
      type: "remove_note";
      id: number;
      vault_id: string;
      note_id: string;
    }
  | {
      type: "search";
      id: number;
      vault_id: string;
      query: SearchQuery;
      limit: number;
    }
  | {
      type: "suggest";
      id: number;
      vault_id: string;
      query: string;
      limit: number;
    }
  | {
      type: "suggest_planned";
      id: number;
      vault_id: string;
      query: string;
      limit: number;
    }
  | {
      type: "close";
      id: number;
    };

export type WorkerNoteMeta = {
  id: string;
  path: string;
  name: string;
  title: string;
  mtime_ms: number;
  size_bytes: number;
};

export type WorkerSearchHit = {
  note: WorkerNoteMeta;
  score: number;
  snippet?: string | undefined;
};

export type WorkerSuggestion = {
  note: WorkerNoteMeta;
  score: number;
};

export type WorkerPlannedSuggestion = {
  target_path: string;
  ref_count: number;
};

export type SearchWorkerMessage =
  | {
      type: "ready";
      id: number;
      vault_id: string;
      storage: WorkerStorageMode;
    }
  | {
      type: "progress";
      vault_id: string;
      indexed: number;
      total: number;
    }
  | {
      type: "result";
      id: number;
      data: unknown;
    }
  | {
      type: "error";
      id?: number | undefined;
      message: string;
    };

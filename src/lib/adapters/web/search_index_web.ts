import type { NoteDoc } from "$lib/types/note";
import type { NoteId, VaultId } from "$lib/types/ids";
import type {
  IndexProgressEvent,
  NoteSearchHit,
  SearchQuery,
  WikiSuggestion,
} from "$lib/types/search";
import type { SearchDbWeb } from "$lib/adapters/web/search_db_web";

export type SearchIndexWeb = {
  build_index: (vault_id: VaultId, docs: NoteDoc[]) => Promise<void>;
  upsert_note: (vault_id: VaultId, doc: NoteDoc) => Promise<void>;
  remove_note: (vault_id: VaultId, note_id: NoteId) => Promise<void>;
  search: (
    vault_id: VaultId,
    query: SearchQuery,
    limit: number,
  ) => Promise<NoteSearchHit[]>;
  suggest: (
    vault_id: VaultId,
    query: string,
    limit: number,
  ) => Promise<WikiSuggestion[]>;
  subscribe_index_progress: (
    callback: (event: IndexProgressEvent) => void,
  ) => () => void;
};

export function create_search_index_web(
  search_db: SearchDbWeb,
): SearchIndexWeb {
  return {
    async build_index(vault_id: VaultId, docs: NoteDoc[]): Promise<void> {
      await search_db.rebuild_index(vault_id, docs);
    },
    async upsert_note(vault_id: VaultId, doc: NoteDoc): Promise<void> {
      await search_db.upsert_note(vault_id, doc);
    },
    async remove_note(vault_id: VaultId, note_id: NoteId): Promise<void> {
      await search_db.remove_note(vault_id, note_id);
    },
    async search(
      vault_id: VaultId,
      query: SearchQuery,
      limit: number,
    ): Promise<NoteSearchHit[]> {
      return search_db.search(vault_id, query, limit);
    },
    async suggest(
      vault_id: VaultId,
      query: string,
      limit: number,
    ): Promise<WikiSuggestion[]> {
      return search_db.suggest(vault_id, query, limit);
    },
    subscribe_index_progress(callback: (event: IndexProgressEvent) => void) {
      return search_db.subscribe_progress(callback);
    },
  };
}

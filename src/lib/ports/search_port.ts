import type { VaultId } from "$lib/types/ids";
import type {
  NoteSearchHit,
  SearchQuery,
  WikiSuggestion,
} from "$lib/types/search";
import type { NoteMeta } from "$lib/types/note";

export type NoteLinksSnapshot = {
  backlinks: NoteMeta[];
  outlinks: NoteMeta[];
  orphan_links: string[];
};

export interface SearchPort {
  search_notes(
    vault_id: VaultId,
    query: SearchQuery,
    limit?: number,
  ): Promise<NoteSearchHit[]>;
  suggest_wiki_links(
    vault_id: VaultId,
    query: string,
    limit?: number,
  ): Promise<WikiSuggestion[]>;
  get_note_links_snapshot(
    vault_id: VaultId,
    note_path: string,
  ): Promise<NoteLinksSnapshot>;
}

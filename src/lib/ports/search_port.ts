import type { VaultId } from "$lib/types/ids";
import type {
  NoteSearchHit,
  SearchQuery,
  WikiSuggestion,
} from "$lib/types/search";

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
}

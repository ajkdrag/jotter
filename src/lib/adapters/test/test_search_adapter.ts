import type { SearchPort } from "$lib/ports/search_port";
import type { VaultId } from "$lib/types/ids";
import type {
  NoteSearchHit,
  SearchQuery,
  WikiSuggestion,
} from "$lib/types/search";

export function create_test_search_adapter(): SearchPort {
  return {
    search_notes(
      _vault_id: VaultId,
      _query: SearchQuery,
      _limit?: number,
    ): Promise<NoteSearchHit[]> {
      return Promise.resolve([]);
    },

    suggest_wiki_links(
      _vault_id: VaultId,
      _query: string,
      _limit?: number,
    ): Promise<WikiSuggestion[]> {
      return Promise.resolve([]);
    },
  };
}

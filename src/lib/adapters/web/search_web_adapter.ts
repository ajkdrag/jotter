import type { SearchPort } from "$lib/ports/search_port";
import type { VaultId } from "$lib/types/ids";
import type { NoteSearchHit, WikiSuggestion } from "$lib/types/search";
import type { SearchDbWeb } from "$lib/adapters/web/search_db_web";
import type { SearchQuery } from "$lib/types/search";

export function create_search_web_adapter(search_db: SearchDbWeb): SearchPort {
  return {
    async search_notes(
      vault_id: VaultId,
      query: SearchQuery,
      limit = 50,
    ): Promise<NoteSearchHit[]> {
      return search_db.search(vault_id, query, limit);
    },

    async suggest_wiki_links(
      vault_id: VaultId,
      query: string,
      limit = 15,
    ): Promise<WikiSuggestion[]> {
      return search_db.suggest(vault_id, query, limit);
    },
  };
}

import type { SearchPort } from "$lib/ports/search_port";
import type { VaultId } from "$lib/types/ids";
import type {
  NoteSearchHit,
  PlannedLinkSuggestion,
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

    suggest_planned_links(
      _vault_id: VaultId,
      _query: string,
      _limit?: number,
    ): Promise<PlannedLinkSuggestion[]> {
      return Promise.resolve([]);
    },

    get_note_links_snapshot(_vault_id: VaultId, _note_path: string) {
      return Promise.resolve({
        backlinks: [],
        outlinks: [],
        orphan_links: [],
      });
    },

    extract_local_note_links(
      _vault_id: VaultId,
      _note_path: string,
      _markdown: string,
    ) {
      return Promise.resolve({
        outlink_paths: [],
        external_links: [],
      });
    },

    rewrite_note_links(
      markdown: string,
      _old_source_path: string,
      _new_source_path: string,
      _target_map: Record<string, string>,
    ) {
      return Promise.resolve({ markdown, changed: false });
    },
  };
}
